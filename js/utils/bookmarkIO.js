import { cryptoUtils } from '../core/cryptoUtils.js';
import { logger } from '../core/logger.js';

const BookmarkFormat = {
  JSON: 'json',
  HTML: 'html',
  CSV: 'csv',
  MARKDOWN: 'markdown'
};

class BookmarkIO {
  constructor() {
    this.encryptionEnabled = false;
    this.encryptionPassword = null;
  }

  async enableEncryption(password) {
    this.encryptionEnabled = true;
    this.encryptionPassword = password;
    logger.info('Encryption enabled for bookmark I/O');
  }

  disableEncryption() {
    this.encryptionEnabled = false;
    this.encryptionPassword = null;
    logger.info('Encryption disabled for bookmark I/O');
  }

  async exportBookmarks(bookmarks, format = BookmarkFormat.JSON, options = {}) {
    try {
      let exportedData;
      let filename = this.generateFilename(format);

      switch (format) {
        case BookmarkFormat.HTML:
          exportedData = this.exportAsHTML(bookmarks, options);
          break;
        case BookmarkFormat.CSV:
          exportedData = this.exportAsCSV(bookmarks, options);
          break;
        case BookmarkFormat.MARKDOWN:
          exportedData = this.exportAsMarkdown(bookmarks, options);
          break;
        default:
          exportedData = this.exportAsJSON(bookmarks, options);
      }

      if (this.encryptionEnabled && this.encryptionPassword) {
        const encrypted = await cryptoUtils.encrypt(exportedData, this.encryptionPassword);
        exportedData = JSON.stringify({
          encrypted: true,
          data: encrypted,
          format,
          timestamp: new Date().toISOString()
        });
        filename = `encrypted_${filename}`;
      }

      return {
        data: exportedData,
        format,
        filename,
        encrypted: this.encryptionEnabled
      };
    } catch (error) {
      logger.error('Export failed:', error);
      throw error;
    }
  }

  async importBookmarks(content, fileExtension, options = {}) {
    try {
      const isEncrypted = this.checkEncrypted(content);
      let actualContent = content;
      let actualFormat = fileExtension;

      if (isEncrypted && options.password) {
        const parsed = JSON.parse(content);
        actualContent = await cryptoUtils.decrypt(parsed.data, options.password);
        actualFormat = parsed.format || fileExtension;
        logger.info('Decrypted bookmark data successfully');
      }

      let bookmarks;
      switch (actualFormat.toLowerCase()) {
        case 'json':
          bookmarks = this.importFromJSON(actualContent);
          break;
        case 'html':
          bookmarks = this.importFromHTML(actualContent);
          break;
        case 'csv':
          bookmarks = this.importFromCSV(actualContent);
          break;
        case 'md':
        case 'markdown':
          bookmarks = this.importFromMarkdown(actualContent);
          break;
        default:
          throw new Error(`Unsupported format: ${actualFormat}`);
      }

      if (options.importMode === 'flatten') {
        bookmarks = this.flattenBookmarks(bookmarks);
      }

      return {
        bookmarks,
        format: actualFormat,
        encrypted: isEncrypted
      };
    } catch (error) {
      logger.error('Import failed:', error);
      throw error;
    }
  }

  checkEncrypted(content) {
    try {
      const parsed = JSON.parse(content);
      return parsed.encrypted === true && parsed.data;
    } catch {
      return false;
    }
  }

  async convertFormat(content, fromFormat, toFormat, options = {}) {
    const importResult = await this.importBookmarks(content, fromFormat, options);
    const exportResult = await this.exportBookmarks(importResult.bookmarks, toFormat, options);
    return exportResult;
  }

  async batchConvert(files, targetFormat, options = {}) {
    const results = [];
    
    for (const file of files) {
      try {
        const content = await this.readFileAsText(file);
        const extension = file.name.split('.').pop().toLowerCase();
        
        const converted = await this.convertFormat(
          content,
          extension,
          targetFormat,
          options
        );
        
        results.push({
          originalName: file.name,
          originalFormat: extension,
          targetFormat,
          data: converted.data,
          success: true
        });
      } catch (error) {
        results.push({
          originalName: file.name,
          error: error.message,
          success: false
        });
      }
    }

    return results;
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  exportAsJSON(bookmarks, options = {}) {
    const exportData = {
      version: '1.0',
      exporter: 'Bookmark Inspector',
      timestamp: new Date().toISOString(),
      bookmarks: bookmarks
    };
    return JSON.stringify(exportData, null, 2);
  }

  exportAsHTML(bookmarks, options = {}) {
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

  exportAsCSV(bookmarks, options = {}) {
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

  exportAsMarkdown(bookmarks, options = {}) {
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

  importFromJSON(content) {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return this.parseLegacyJSON(content);
    }

    if (parsed.bookmarks) {
      return parsed.bookmarks;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed.children) {
      return [parsed];
    }
    
    return [parsed];
  }

  parseLegacyJSON(content) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed[0]?.children) {
        return parsed[0].children;
      }
      return [parsed];
    } catch (error) {
      throw new Error('无效的 JSON 格式');
    }
  }

  importFromHTML(content) {
    const bookmarks = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    
    const processDL = (dlElement, parentTitle = null) => {
      const items = [];
      const children = dlElement.children;
      
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        
        if (child.tagName === 'DT') {
          const dtContent = child.firstElementChild;
          
          if (dtContent?.tagName === 'A') {
            const url = dtContent.getAttribute('href');
            const title = dtContent.textContent || '无标题';
            const addDate = dtContent.getAttribute('add_date');
            
            items.push({
              title,
              url,
              dateAdded: addDate ? parseInt(addDate, 10) : null
            });
          } else if (dtContent?.tagName === 'H3') {
            const folderTitle = dtContent.textContent || '未命名文件夹';
            const addDate = dtContent.getAttribute('add_date');
            
            let nextIndex = i + 1;
            let dl = null;
            
            while (nextIndex < children.length) {
              const next = children[nextIndex];
              if (next.tagName === 'DL') {
                dl = next;
                break;
              }
              if (next.tagName === 'DT') break;
              nextIndex++;
            }

            const folder = {
              title: folderTitle,
              dateAdded: addDate ? parseInt(addDate, 10) : null,
              children: []
            };

            if (dl) {
              folder.children = processDL(dl, folderTitle);
            }

            items.push(folder);
          }
        }
      }

      return items;
    };

    const mainDL = doc.querySelector('DL');
    if (mainDL) {
      bookmarks.push({
        title: '导入的书签',
        children: processDL(mainDL)
      });
    }

    return bookmarks;
  }

  importFromCSV(content) {
    const lines = content.split('\n');
    if (lines.length < 2) {
      throw new Error('CSV 文件格式无效');
    }

    const headers = this.parseCSVLine(lines[0]);
    const titleIndex = headers.findIndex(h => h.includes('标题') || h.toLowerCase().includes('title'));
    const urlIndex = headers.findIndex(h => h.includes('网址') || h.toLowerCase().includes('url'));
    const pathIndex = headers.findIndex(h => h.includes('路径') || h.toLowerCase().includes('path') || h.toLowerCase().includes('folder'));

    if (urlIndex === -1) {
      throw new Error('CSV 缺少网址列');
    }

    const folderMap = new Map();
    const root = { title: '导入的书签', children: [] };
    folderMap.set('', root);

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCSVLine(line);
      const title = values[titleIndex] || '无标题';
      const url = values[urlIndex];
      const path = pathIndex >= 0 ? values[pathIndex] : '';

      if (!url) continue;

      const parentFolder = this.getOrCreateFolder(path, folderMap);
      parentFolder.children.push({
        title,
        url,
        dateAdded: Date.now()
      });
    }

    return [root];
  }

  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  }

  getOrCreateFolder(path, folderMap) {
    if (folderMap.has(path)) {
      return folderMap.get(path);
    }

    const parts = path.split(/[>\/]/).map(p => p.trim()).filter(p => p);
    let currentPath = '';
    let parent = folderMap.get('');

    for (const part of parts) {
      const newPath = currentPath ? `${currentPath} > ${part}` : part;
      
      if (!folderMap.has(newPath)) {
        const folder = { title: part, children: [] };
        folderMap.set(newPath, folder);
        if (parent) {
          parent.children.push(folder);
        }
      }
      
      parent = folderMap.get(newPath);
      currentPath = newPath;
    }

    return parent;
  }

  importFromMarkdown(content) {
    const lines = content.split('\n');
    const root = { title: '导入的书签', children: [] };
    const headerStack = [{ level: 0, node: root }];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;

      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();
        
        while (headerStack.length > 0 && headerStack[headerStack.length - 1].level >= level) {
          headerStack.pop();
        }

        const parent = headerStack[headerStack.length - 1]?.node || root;
        const newFolder = { title, children: [] };
        parent.children.push(newFolder);
        headerStack.push({ level, node: newFolder });
        continue;
      }

      const listMatch = line.match(/^[\s*\-]*\s*\[([^\]]+)\]\(([^)]+)\)/);
      if (listMatch) {
        const title = listMatch[1].trim();
        const url = listMatch[2].trim();
        
        const parent = headerStack[headerStack.length - 1]?.node || root;
        parent.children.push({
          title: title || '无标题',
          url,
          dateAdded: Date.now()
        });
      }
    }

    return [root];
  }

  flattenBookmarks(bookmarks) {
    const flatList = [];
    
    const flatten = (nodes) => {
      for (const node of nodes) {
        if (node.url) {
          flatList.push(node);
        } else if (node.children) {
          flatten(node.children);
        }
      }
    };

    flatten(bookmarks);
    return flatList;
  }

  generateFilename(format) {
    const date = new Date().toISOString().slice(0, 10);
    return `bookmarks_${date}.${format}`;
  }

  escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async downloadBookmarks(data, filename, format) {
    let blob;
    let mimeType;

    switch (format) {
      case 'html':
        mimeType = 'text/html;charset=utf-8';
        blob = new Blob([data], { type: mimeType });
        break;
      case 'csv':
        mimeType = 'text/csv;charset=utf-8';
        blob = new Blob([data], { type: mimeType });
        break;
      case 'markdown':
        mimeType = 'text/markdown;charset=utf-8';
        blob = new Blob([data], { type: mimeType });
        break;
      default:
        mimeType = 'application/json';
        blob = new Blob([data], { type: mimeType });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

const bookmarkIO = new BookmarkIO();

export { bookmarkIO, BookmarkIO, BookmarkFormat };
