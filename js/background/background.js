import { logger, LogLevel } from '../core/logger.js';
import { errorHandler } from '../core/errorHandler.js';
import { storageManager } from '../core/storageManager.js';

class BackgroundService {
  constructor() {
    this.checkingStatus = {
      isChecking: false,
      total: 0,
      checked: 0,
      results: [],
      invalidCount: 0,
      shouldCancel: false
    };
    this.checkTimeout = 10000;
  }

  async init() {
    await logger.init();
    errorHandler.init();
    logger.info('Background service initialized');

    await this.loadCheckingStatus();
    this.setupEventListeners();
  }

  setupEventListeners() {
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstall(details);
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });

    chrome.commands.onCommand.addListener((command) => {
      this.handleCommand(command);
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      this.handleStorageChange(changes, namespace);
    });
  }

  async handleInstall(details) {
    logger.info('Extension installed:', details.reason);
    
    if (details.reason === 'install') {
      await this.initializeDefaultSettings();
    } else if (details.reason === 'update') {
      await this.handleUpdate(details.previousVersion);
    }
  }

  async initializeDefaultSettings() {
    const defaultSettings = {
      enableProxyRetry: false,
      proxyAddress: '',
      proxyPort: '',
      proxyType: 'http',
      threadsPerBatch: 10,
      theme: 'system',
      enableNotifications: true
    };

    await storageManager.set('extensionSettings', defaultSettings);
    logger.info('Default settings initialized');
  }

  async handleUpdate(previousVersion) {
    logger.info(`Updating from version ${previousVersion}`);
    const settings = await storageManager.get('extensionSettings', {});
    
    if (!settings.theme) {
      settings.theme = 'system';
    }
    if (!settings.enableNotifications) {
      settings.enableNotifications = true;
    }
    
    await storageManager.set('extensionSettings', settings);
  }

  handleMessage(message, sender, sendResponse) {
    const action = message.action;
    
    switch (action) {
      case 'startCheck':
        this.startBookmarkCheck(message.params).then(sendResponse);
        return true;
      case 'cancelCheck':
        this.cancelBookmarkCheck();
        sendResponse({ success: true });
        return true;
      case 'getCheckStatus':
        sendResponse({ status: this.checkingStatus });
        return true;
      case 'exportBookmarks':
        this.exportBookmarks(message.params).then(sendResponse);
        return true;
      case 'importBookmarks':
        this.importBookmarks(message.params).then(sendResponse);
        return true;
      case 'deleteBookmarks':
        this.deleteBookmarks(message.params).then(sendResponse);
        return true;
      case 'archiveBookmarks':
        this.archiveBookmarks(message.params).then(sendResponse);
        return true;
      case 'findDuplicates':
        this.findDuplicates().then(sendResponse);
        return true;
      case 'getStatistics':
        this.getStatistics().then(sendResponse);
        return true;
      default:
        sendResponse({ error: 'Unknown action' });
        return false;
    }
  }

  handleCommand(command) {
    logger.info('Command received:', command);
    
    switch (command) {
      case 'check_bookmarks':
        this.triggerQuickCheck();
        break;
      default:
        logger.warn('Unknown command:', command);
    }
  }

  handleStorageChange(changes, namespace) {
    logger.debug('Storage changed:', namespace, changes);
  }

  async startBookmarkCheck(params) {
    if (this.checkingStatus.isChecking) {
      return { error: 'Check already in progress' };
    }

    this.checkingStatus = {
      isChecking: true,
      total: 0,
      checked: 0,
      results: [],
      invalidCount: 0,
      shouldCancel: false
    };

    try {
      const bookmarks = await this.getAllBookmarks();
      const bookmarkUrls = this.extractBookmarkUrls(bookmarks, params?.folderId);
      
      this.checkingStatus.total = bookmarkUrls.length;
      this.checkingStatus.results = bookmarkUrls.map(bm => ({
        id: bm.id,
        title: bm.title,
        url: bm.url,
        parentId: bm.parentId,
        status: null
      }));

      await this.saveCheckingStatus();
      this.notifyPopup('checkStarted', { total: this.checkingStatus.total });

      await this.runCheckProcess(bookmarkUrls);
      
      return { success: true, results: this.checkingStatus.results };
    } catch (error) {
      logger.error('Bookmark check failed:', error);
      this.checkingStatus.isChecking = false;
      return { error: error.message };
    }
  }

  cancelBookmarkCheck() {
    this.checkingStatus.shouldCancel = true;
    logger.info('Bookmark check cancelled');
  }

  async runCheckProcess(bookmarkUrls) {
    const settings = await storageManager.get('extensionSettings', {});
    const batchSize = settings.threadsPerBatch || 10;
    
    for (let i = 0; i < bookmarkUrls.length; i += batchSize) {
      if (this.checkingStatus.shouldCancel) {
        break;
      }

      const batch = bookmarkUrls.slice(i, i + batchSize);
      const checkPromises = batch.map(bm => this.checkSingleBookmark(bm));
      
      await Promise.all(checkPromises);
      
      this.checkingStatus.checked += batch.length;
      await this.saveCheckingStatus();
      
      this.notifyPopup('checkProgress', {
        checked: this.checkingStatus.checked,
        total: this.checkingStatus.total,
        invalidCount: this.checkingStatus.invalidCount
      });

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.checkingStatus.isChecking = false;
    await this.saveCheckingStatus();
    
    this.notifyPopup('checkComplete', {
      total: this.checkingStatus.total,
      invalidCount: this.checkingStatus.invalidCount,
      results: this.checkingStatus.results
    });

    if (this.checkingStatus.invalidCount > 0 && settings.enableNotifications) {
      this.showNotification(
        '检测完成',
        `发现 ${this.checkingStatus.invalidCount} 个失效书签`
      );
    }
  }

  async checkSingleBookmark(bookmark) {
    if (this.checkingStatus.shouldCancel) return;

    const isAvailable = await this.checkUrlAvailability(bookmark.url);
    
    const resultIndex = this.checkingStatus.results.findIndex(r => r.url === bookmark.url);
    if (resultIndex !== -1) {
      this.checkingStatus.results[resultIndex].status = isAvailable;
      if (!isAvailable) {
        this.checkingStatus.invalidCount++;
      }
    }
  }

  async checkUrlAvailability(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.checkTimeout);
      
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-store'
      });

      clearTimeout(timeoutId);
      return true;
    } catch (error) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.checkTimeout);
        
        const response = await fetch(url, {
          method: 'GET',
          mode: 'no-cors',
          signal: controller.signal,
          cache: 'no-store'
        });

        clearTimeout(timeoutId);
        return true;
      } catch (error2) {
        logger.debug('URL check failed:', url, error2.message);
        return false;
      }
    }
  }

  async getAllBookmarks() {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getTree((bookmarkTreeNodes) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(bookmarkTreeNodes);
        }
      });
    });
  }

  extractBookmarkUrls(nodes, folderId = null, urls = []) {
    for (const node of nodes) {
      if (node.url) {
        if (!folderId || node.parentId === folderId || this.isNodeInFolder(node, folderId)) {
          urls.push({
            id: node.id,
            title: node.title,
            url: node.url,
            parentId: node.parentId
          });
        }
      }
      if (node.children) {
        this.extractBookmarkUrls(node.children, folderId, urls);
      }
    }
    return urls;
  }

  isNodeInFolder(node, folderId) {
    return node.path?.includes(folderId) || false;
  }

  async saveCheckingStatus() {
    await storageManager.set('bookmarkCheckResults', this.checkingStatus);
  }

  async loadCheckingStatus() {
    const saved = await storageManager.get('bookmarkCheckResults', null);
    if (saved) {
      this.checkingStatus = saved;
    }
  }

  notifyPopup(action, data) {
    chrome.runtime.sendMessage({
      type: 'backgroundNotification',
      action,
      data
    }).catch(() => {
    });
  }

  showNotification(title, message) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title,
      message
    });
  }

  async triggerQuickCheck() {
    const popupUrl = chrome.runtime.getURL('popup.html');
    await chrome.windows.create({
      url: popupUrl,
      type: 'popup',
      width: 420,
      height: 650
    });
  }

  async exportBookmarks(params) {
    try {
      const bookmarks = await this.getAllBookmarks();
      const format = params?.format || 'json';
      const folderId = params?.folderId;
      
      let exportedData;
      switch (format) {
        case 'html':
          exportedData = this.exportAsHTML(bookmarks, folderId);
          break;
        case 'csv':
          exportedData = this.exportAsCSV(bookmarks, folderId);
          break;
        case 'markdown':
          exportedData = this.exportAsMarkdown(bookmarks, folderId);
          break;
        default:
          exportedData = this.exportAsJSON(bookmarks, folderId);
      }

      return { success: true, data: exportedData, format };
    } catch (error) {
      logger.error('Export failed:', error);
      return { error: error.message };
    }
  }

  exportAsJSON(bookmarks, folderId) {
    if (folderId && folderId !== 'all') {
      const filtered = this.filterByFolder(bookmarks, folderId);
      return JSON.stringify(filtered, null, 2);
    }
    return JSON.stringify(bookmarks, null, 2);
  }

  exportAsHTML(bookmarks, folderId) {
    let html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n';
    html += '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n';
    html += '<TITLE>Bookmarks</TITLE>\n';
    html += '<H1>Bookmarks</H1>\n';
    html += '<DL><p>\n';

    const processNode = (node, level = 0) => {
      const indent = '    '.repeat(level);
      if (node.url) {
        html += `${indent}<DT><A HREF="${node.url}">${this.escapeHTML(node.title)}</A>\n`;
      } else if (node.children) {
        html += `${indent}<DT><H3>${this.escapeHTML(node.title || 'Bookmarks')}</H3>\n`;
        html += `${indent}<DL><p>\n`;
        node.children.forEach(child => processNode(child, level + 1));
        html += `${indent}</DL><p>\n`;
      }
    };

    if (folderId && folderId !== 'all') {
      const folder = this.findFolder(bookmarks, folderId);
      if (folder) {
        folder.children?.forEach(child => processNode(child));
      }
    } else {
      bookmarks[0].children?.forEach(node => processNode(node));
    }

    html += '</DL><p>';
    return html;
  }

  exportAsCSV(bookmarks, folderId) {
    let csv = '标题,网址,文件夹路径\n';
    const rows = [];

    const processNode = (node, path = '') => {
      if (node.url) {
        const title = (node.title || '').replace(/"/g, '""');
        const url = node.url.replace(/"/g, '""');
        const folderPath = path.replace(/"/g, '""');
        rows.push(`"${title}","${url}","${folderPath}"`);
      } else if (node.children) {
        const newPath = path ? `${path}/${node.title}` : (node.title || '');
        node.children.forEach(child => processNode(child, newPath));
      }
    };

    if (folderId && folderId !== 'all') {
      const folder = this.findFolder(bookmarks, folderId);
      if (folder) {
        folder.children?.forEach(child => processNode(child, folder.title || ''));
      }
    } else {
      bookmarks[0].children?.forEach(node => processNode(node));
    }

    csv += rows.join('\n');
    return csv;
  }

  exportAsMarkdown(bookmarks, folderId) {
    let md = '# 书签列表\n\n';

    const processNode = (node, level = 1) => {
      if (node.url) {
        md += `${'  '.repeat(level - 1)}- [${node.title || '无标题'}](${node.url})\n`;
      } else if (node.children) {
        if (node.title) {
          md += `\n${'#'.repeat(Math.min(level + 1, 6))} ${node.title}\n\n`;
        }
        node.children.forEach(child => processNode(child, level + 1));
      }
    };

    if (folderId && folderId !== 'all') {
      const folder = this.findFolder(bookmarks, folderId);
      if (folder) {
        md += `## ${folder.title || '书签'}\n\n`;
        folder.children?.forEach(child => processNode(child, 2));
      }
    } else {
      bookmarks[0].children?.forEach(node => processNode(node, 1));
    }

    return md;
  }

  findFolder(nodes, folderId) {
    for (const node of nodes) {
      if (node.id === folderId) return node;
      if (node.children) {
        const found = this.findFolder(node.children, folderId);
        if (found) return found;
      }
    }
    return null;
  }

  filterByFolder(bookmarks, folderId) {
    const folder = this.findFolder(bookmarks, folderId);
    return folder ? [folder] : bookmarks;
  }

  escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async findDuplicates() {
    try {
      const bookmarks = await this.getAllBookmarks();
      const urlMap = new Map();
      const duplicates = [];

      const processNode = (node) => {
        if (node.url) {
          const normalizedUrl = this.normalizeUrl(node.url);
          if (urlMap.has(normalizedUrl)) {
            const existing = urlMap.get(normalizedUrl);
            if (!duplicates.find(d => d.url === normalizedUrl)) {
              duplicates.push({
                url: normalizedUrl,
                originalTitle: existing.title,
                originalId: existing.id,
                duplicates: [{ id: node.id, title: node.title, url: node.url }]
              });
            } else {
              const dupGroup = duplicates.find(d => d.url === normalizedUrl);
              dupGroup.duplicates.push({ id: node.id, title: node.title, url: node.url });
            }
          } else {
            urlMap.set(normalizedUrl, { id: node.id, title: node.title, url: node.url });
          }
        }
        if (node.children) {
          node.children.forEach(processNode);
        }
      };

      bookmarks[0].children?.forEach(processNode);
      
      return { success: true, duplicates, total: duplicates.length };
    } catch (error) {
      logger.error('Find duplicates failed:', error);
      return { error: error.message };
    }
  }

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      urlObj.hash = '';
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  async getStatistics() {
    try {
      const bookmarks = await this.getAllBookmarks();
      const stats = {
        totalBookmarks: 0,
        totalFolders: 0,
        folders: [],
        urlsByDomain: {},
        lastCheckResults: null
      };

      const processNode = (node, path = []) => {
        if (node.url) {
          stats.totalBookmarks++;
          try {
            const domain = new URL(node.url).hostname;
            stats.urlsByDomain[domain] = (stats.urlsByDomain[domain] || 0) + 1;
          } catch {}
        } else if (node.children) {
          stats.totalFolders++;
          const folderPath = [...path, node.title];
          stats.folders.push({
            id: node.id,
            title: node.title,
            path: folderPath.join(' > '),
            bookmarkCount: this.countBookmarksInNode(node)
          });
          node.children.forEach(child => processNode(child, folderPath));
        }
      };

      bookmarks[0].children?.forEach(node => processNode(node));

      const savedResults = await storageManager.get('bookmarkCheckResults', null);
      if (savedResults) {
        stats.lastCheckResults = {
          total: savedResults.total,
          checked: savedResults.checked,
          invalidCount: savedResults.invalidCount || savedResults.results?.filter(r => r.status === false).length || 0,
          timestamp: savedResults.timestamp
        };
      }

      stats.topDomains = Object.entries(stats.urlsByDomain)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([domain, count]) => ({ domain, count }));

      stats.folders.sort((a, b) => b.bookmarkCount - a.bookmarkCount);

      return { success: true, statistics: stats };
    } catch (error) {
      logger.error('Get statistics failed:', error);
      return { error: error.message };
    }
  }

  countBookmarksInNode(node) {
    let count = 0;
    const process = (n) => {
      if (n.url) count++;
      if (n.children) n.children.forEach(process);
    };
    if (node.children) node.children.forEach(process);
    return count;
  }

  async deleteBookmarks(params) {
    const { bookmarkIds } = params;
    if (!Array.isArray(bookmarkIds) || bookmarkIds.length === 0) {
      return { error: 'No bookmark IDs provided' };
    }

    try {
      for (const id of bookmarkIds) {
        await chrome.bookmarks.remove(id);
      }
      logger.info(`Deleted ${bookmarkIds.length} bookmarks`);
      return { success: true, deletedCount: bookmarkIds.length };
    } catch (error) {
      logger.error('Delete bookmarks failed:', error);
      return { error: error.message };
    }
  }

  async archiveBookmarks(params) {
    const { bookmarkIds, archiveFolderName = '已归档书签' } = params;
    
    try {
      const archiveFolder = await this.getOrCreateArchiveFolder(archiveFolderName);
      let archivedCount = 0;

      for (const id of bookmarkIds) {
        try {
          const bookmark = await chrome.bookmarks.get(id);
          if (bookmark[0] && bookmark[0].url) {
            await chrome.bookmarks.move(id, { parentId: archiveFolder.id });
            archivedCount++;
          }
        } catch (error) {
          logger.warn(`Failed to archive bookmark ${id}:`, error);
        }
      }

      logger.info(`Archived ${archivedCount} bookmarks`);
      return { success: true, archivedCount, archiveFolderId: archiveFolder.id };
    } catch (error) {
      logger.error('Archive bookmarks failed:', error);
      return { error: error.message };
    }
  }

  async getOrCreateArchiveFolder(folderName) {
    const bookmarks = await this.getAllBookmarks();
    const otherBookmarks = bookmarks[0]?.children?.find(n => n.id === '2');
    
    let archiveFolder = this.findFolderInNode(otherBookmarks, folderName);
    
    if (!archiveFolder) {
      archiveFolder = await chrome.bookmarks.create({
        parentId: '2',
        title: folderName
      });
    }

    return archiveFolder;
  }

  findFolderInNode(node, folderName) {
    if (!node) return null;
    if (node.title === folderName && !node.url) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = this.findFolderInNode(child, folderName);
        if (found) return found;
      }
    }
    return null;
  }
}

const backgroundService = new BackgroundService();
backgroundService.init();

export { backgroundService };
