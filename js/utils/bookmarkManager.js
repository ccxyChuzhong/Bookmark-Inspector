class BookmarkManager {
  constructor() {
    this.selectedBookmarks = new Set();
    this.archiveFolderName = '已归档书签';
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

  async getBookmarkById(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.get(id, (bookmarks) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(bookmarks[0]);
        }
      });
    });
  }

  async createBookmark(parentId, title, url) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.create(
        {
          parentId,
          title,
          url
        },
        (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  async createFolder(parentId, title) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.create(
        {
          parentId,
          title
        },
        (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  async deleteBookmark(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.remove(id, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  async deleteBookmarks(ids) {
    const results = [];
    for (const id of ids) {
      try {
        await this.deleteBookmark(id);
        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }
    return results;
  }

  async updateBookmark(id, changes) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.update(id, changes, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }

  async moveBookmark(id, parentId, index) {
    const changes = { parentId };
    if (index !== undefined) {
      changes.index = index;
    }
    return this.updateBookmark(id, changes);
  }

  async getOrCreateArchiveFolder() {
    const bookmarks = await this.getAllBookmarks();
    const otherBookmarks = bookmarks[0]?.children?.find(n => n.id === '2');
    
    let archiveFolder = this.findFolderInNode(otherBookmarks, this.archiveFolderName);
    
    if (!archiveFolder) {
      archiveFolder = await this.createFolder('2', this.archiveFolderName);
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

  findFolderById(nodes, folderId) {
    for (const node of nodes) {
      if (node.id === folderId) return node;
      if (node.children) {
        const found = this.findFolderById(node.children, folderId);
        if (found) return found;
      }
    }
    return null;
  }

  async archiveBookmarks(bookmarkIds) {
    const archiveFolder = await this.getOrCreateArchiveFolder();
    const results = [];

    for (const id of bookmarkIds) {
      try {
        await this.moveBookmark(id, archiveFolder.id);
        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }

    return {
      success: true,
      archivedCount: results.filter(r => r.success).length,
      results
    };
  }

  async batchDeleteBookmarks(bookmarkIds) {
    const results = [];
    for (const id of bookmarkIds) {
      try {
        await this.deleteBookmark(id);
        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }

    return {
      success: true,
      deletedCount: results.filter(r => r.success).length,
      results
    };
  }

  async categorizeBookmarks(bookmarkIds, targetFolderId) {
    const results = [];

    for (const id of bookmarkIds) {
      try {
        await this.moveBookmark(id, targetFolderId);
        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }

    return {
      success: true,
      movedCount: results.filter(r => r.success).length,
      results
    };
  }

  async findDuplicates() {
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
              originalParentId: existing.parentId,
              duplicates: [{ id: node.id, title: node.title, url: node.url, parentId: node.parentId }]
            });
          } else {
            const dupGroup = duplicates.find(d => d.url === normalizedUrl);
            dupGroup.duplicates.push({ id: node.id, title: node.title, url: node.url, parentId: node.parentId });
          }
        } else {
          urlMap.set(normalizedUrl, { id: node.id, title: node.title, url: node.url, parentId: node.parentId });
        }
      }
      if (node.children) {
        node.children.forEach(processNode);
      }
    };

    bookmarks[0].children?.forEach(processNode);

    return {
      duplicates,
      totalDuplicates: duplicates.length,
      totalBookmarks: urlMap.size + duplicates.reduce((sum, d) => sum + d.duplicates.length, 0)
    };
  }

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      urlObj.hash = '';
      urlObj.searchParams.sort();
      let normalized = urlObj.toString();
      if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }
      return normalized.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  async getStatistics() {
    const bookmarks = await this.getAllBookmarks();
    const stats = {
      totalBookmarks: 0,
      totalFolders: 0,
      folders: [],
      urlsByDomain: {},
      foldersByDepth: {},
      maxDepth: 0
    };

    const processNode = (node, path = [], depth = 0) => {
      if (node.url) {
        stats.totalBookmarks++;
        try {
          const domain = new URL(node.url).hostname;
          stats.urlsByDomain[domain] = (stats.urlsByDomain[domain] || 0) + 1;
        } catch {}
      } else if (node.children) {
        stats.totalFolders++;
        stats.foldersByDepth[depth] = (stats.foldersByDepth[depth] || 0) + 1;
        stats.maxDepth = Math.max(stats.maxDepth, depth);
        
        const folderPath = [...path, node.title];
        stats.folders.push({
          id: node.id,
          title: node.title,
          path: folderPath.join(' > '),
          pathArray: folderPath,
          depth,
          bookmarkCount: this.countBookmarksInNode(node)
        });
        
        node.children.forEach(child => processNode(child, folderPath, depth + 1));
      }
    };

    bookmarks[0].children?.forEach(node => processNode(node, [], 0));

    stats.topDomains = Object.entries(stats.urlsByDomain)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([domain, count]) => ({ domain, count }));

    stats.folders.sort((a, b) => b.bookmarkCount - a.bookmarkCount);

    const savedResults = await this.loadCheckResults();
    if (savedResults) {
      stats.lastCheckResults = {
        total: savedResults.total || savedResults.totalCount || 0,
        checked: savedResults.checked || savedResults.checkedCount || 0,
        invalidCount: savedResults.invalidCount || savedResults.results?.filter(r => r.status === false).length || 0,
        timestamp: savedResults.timestamp
      };
    }

    return {
      success: true,
      statistics: stats
    };
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

  async loadCheckResults() {
    try {
      const data = await chrome.storage.local.get('bookmarkCheckResults');
      return data.bookmarkCheckResults || null;
    } catch {
      return null;
    }
  }

  async saveCheckResults(results) {
    try {
      await chrome.storage.local.set({ bookmarkCheckResults: results });
      return true;
    } catch {
      return false;
    }
  }

  getAllFolders(bookmarks) {
    const folders = [];
    const process = (nodes) => {
      for (const node of nodes) {
        if (node.children && !node.url) {
          folders.push({
            id: node.id,
            title: node.title
          });
          process(node.children);
        }
      }
    };
    if (bookmarks[0]?.children) {
      process(bookmarks[0].children);
    }
    return folders;
  }

  async getFolderTree() {
    const bookmarks = await this.getAllBookmarks();
    return this.buildFolderTree(bookmarks[0]?.children || []);
  }

  buildFolderTree(nodes, level = 0) {
    const tree = [];
    for (const node of nodes) {
      if (node.children && !node.url) {
        tree.push({
          id: node.id,
          title: node.title,
          level,
          children: this.buildFolderTree(node.children, level + 1)
        });
      }
    }
    return tree;
  }

  toggleSelection(id) {
    if (this.selectedBookmarks.has(id)) {
      this.selectedBookmarks.delete(id);
    } else {
      this.selectedBookmarks.add(id);
    }
    return this.selectedBookmarks.size;
  }

  clearSelection() {
    this.selectedBookmarks.clear();
  }

  selectAll(ids) {
    ids.forEach(id => this.selectedBookmarks.add(id));
    return this.selectedBookmarks.size;
  }

  getSelectedIds() {
    return Array.from(this.selectedBookmarks);
  }

  getSelectionCount() {
    return this.selectedBookmarks.size;
  }

  async checkUrlAvailability(url, timeout = 10000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-store'
      });

      clearTimeout(timeoutId);
      return { available: true, status: 'success' };
    } catch (error) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          method: 'GET',
          mode: 'no-cors',
          signal: controller.signal,
          cache: 'no-store'
        });

        clearTimeout(timeoutId);
        return { available: true, status: 'success' };
      } catch (error2) {
        return { available: false, status: 'error', error: error2.message };
      }
    }
  }

  async batchCheckUrls(urls, onProgress, batchSize = 10, delay = 500) {
    const results = [];
    let checked = 0;

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchPromises = batch.map(async (item) => {
        const result = await this.checkUrlAvailability(item.url);
        return {
          ...item,
          ...result
        };
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      checked += batch.length;

      if (onProgress) {
        onProgress(checked, urls.length, results);
      }

      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  async exportBookmarks(format = 'json', folderId = 'all') {
    const bookmarks = await this.getAllBookmarks();
    let dataToExport = bookmarks;

    if (folderId !== 'all') {
      const folder = this.findFolderById(bookmarks, folderId);
      if (folder) {
        dataToExport = [folder];
      }
    }

    switch (format) {
      case 'html':
        return this.exportAsHTML(dataToExport);
      case 'csv':
        return this.exportAsCSV(dataToExport);
      case 'markdown':
        return this.exportAsMarkdown(dataToExport);
      default:
        return this.exportAsJSON(dataToExport);
    }
  }

  exportAsJSON(bookmarks) {
    const exportData = {
      version: '1.0',
      exporter: 'Bookmark Inspector',
      timestamp: new Date().toISOString(),
      bookmarks
    };
    return JSON.stringify(exportData, null, 2);
  }

  exportAsHTML(bookmarks) {
    let html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n';
    html += '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n';
    html += '<TITLE>Bookmarks</TITLE>\n';
    html += '<H1>Bookmarks</H1>\n';
    html += '<DL><p>\n';

    const processNode = (node, level = 0) => {
      const indent = '    '.repeat(level);
      if (node.url) {
        const addDate = node.dateAdded || Math.floor(Date.now() / 1000);
        html += `${indent}<DT><A HREF="${node.url}" ADD_DATE="${addDate}">${this.escapeHTML(node.title || '无标题')}</A>\n`;
      } else if (node.children) {
        const addDate = node.dateAdded || Math.floor(Date.now() / 1000);
        html += `${indent}<DT><H3 ADD_DATE="${addDate}">${this.escapeHTML(node.title || 'Bookmarks')}</H3>\n`;
        html += `${indent}<DL><p>\n`;
        node.children.forEach(child => processNode(child, level + 1));
        html += `${indent}</DL><p>\n`;
      }
    };

    bookmarks.forEach(node => processNode(node));
    html += '</DL><p>';
    return html;
  }

  exportAsCSV(bookmarks) {
    const rows = ['标题,网址,文件夹路径,添加日期'];

    const processNode = (node, path = []) => {
      if (node.url) {
        const title = (node.title || '').replace(/"/g, '""');
        const url = node.url.replace(/"/g, '""');
        const folderPath = path.join(' > ').replace(/"/g, '""');
        const addDate = node.dateAdded ? new Date(node.dateAdded * 1000).toISOString() : '';
        rows.push(`"${title}","${url}","${folderPath}","${addDate}"`);
      } else if (node.children) {
        const newPath = node.title ? [...path, node.title] : path;
        node.children.forEach(child => processNode(child, newPath));
      }
    };

    bookmarks.forEach(node => processNode(node));
    return '\uFEFF' + rows.join('\n');
  }

  exportAsMarkdown(bookmarks) {
    let md = '# 书签列表\n\n';
    md += `> 导出时间: ${new Date().toLocaleString()}\n\n`;

    const processNode = (node, level = 1) => {
      if (node.url) {
        const indent = '  '.repeat(Math.max(0, level - 2));
        md += `${indent}- [${node.title || '无标题'}](${node.url})\n`;
      } else if (node.children && node.children.length > 0) {
        if (node.title) {
          const headerLevel = Math.min(level + 1, 6);
          md += `\n${'#'.repeat(headerLevel)} ${node.title}\n\n`;
        }
        node.children.forEach(child => processNode(child, level + 1));
      }
    };

    bookmarks.forEach(node => processNode(node));
    return md;
  }

  escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

const bookmarkManager = new BookmarkManager();

export { bookmarkManager, BookmarkManager };
