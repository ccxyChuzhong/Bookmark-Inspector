import { logger, LogLevel } from './core/logger.js';
import { errorHandler } from './core/errorHandler.js';
import { storageManager } from './core/storageManager.js';
import { cryptoUtils } from './core/cryptoUtils.js';
import { bookmarkManager } from './utils/bookmarkManager.js';
import { bookmarkIO } from './utils/bookmarkIO.js';

const UIState = {
  isChecking: false,
  shouldCancelCheck: false,
  checkResults: [],
  totalCount: 0,
  checkedCount: 0,
  invalidCount: 0,
  validCount: 0,
  pendingFile: null,
  currentTheme: 'light',
  confirmCallback: null
};

const elements = {};

async function init() {
  try {
    await logger.init();
    errorHandler.init();
    logger.info('Bookmark Inspector initialized');

    cacheElements();
    
    setupEventListeners();
    
    await loadTheme();
    
    try {
      await initFolderSelects();
    } catch (folderError) {
      logger.error('Failed to initialize folder selects:', folderError);
      showToast('加载文件夹列表失败: ' + folderError.message, 'error');
    }
    
    try {
      await loadSavedResults();
    } catch (loadError) {
      logger.error('Failed to load saved results:', loadError);
    }
    
    logger.info('Initialization completed');
  } catch (error) {
    logger.error('Initialization failed:', error);
    console.error('Popup initialization error:', error);
    
    if (typeof showToast === 'function') {
      showToast('初始化失败: ' + error.message, 'error');
    }
  }
}

function cacheElements() {
  elements.themeToggleBtn = document.getElementById('themeToggleBtn');
  elements.openSettingsBtn = document.getElementById('openSettingsBtn');
  elements.exportBtn = document.getElementById('exportBtn');
  elements.importBtn = document.getElementById('importBtn');
  elements.importFile = document.getElementById('importFile');
  elements.checkUrlsBtn = document.getElementById('checkUrlsBtn');
  elements.folderSelect = document.getElementById('folderSelect');
  elements.findDuplicatesBtn = document.getElementById('findDuplicatesBtn');
  elements.showStatsBtn = document.getElementById('showStatsBtn');

  elements.message = document.getElementById('message');
  elements.notificationArea = document.querySelector('.notification-area');

  elements.progressContainer = document.getElementById('progressContainer');
  elements.progressBar = document.getElementById('progressBar');
  elements.progressText = document.getElementById('progressText');
  elements.validCount = document.getElementById('validCount');
  elements.invalidCount = document.getElementById('invalidCount');
  elements.pendingCount = document.getElementById('pendingCount');

  elements.batchActions = document.getElementById('batchActions');
  elements.selectedCount = document.getElementById('selectedCount');
  elements.batchArchiveBtn = document.getElementById('batchArchiveBtn');
  elements.batchCategorizeBtn = document.getElementById('batchCategorizeBtn');
  elements.batchDeleteBtn = document.getElementById('batchDeleteBtn');
  elements.selectAllBtn = document.getElementById('selectAllBtn');

  elements.resultsContainer = document.getElementById('resultsContainer');

  elements.exportModal = document.getElementById('exportModal');
  elements.importModal = document.getElementById('importModal');
  elements.statsModal = document.getElementById('statsModal');
  elements.duplicatesModal = document.getElementById('duplicatesModal');
  elements.confirmModal = document.getElementById('confirmModal');
  elements.batchCategorizeModal = document.getElementById('batchCategorizeModal');

  elements.exportFormat = document.getElementById('exportFormat');
  elements.exportFolder = document.getElementById('exportFolder');
  elements.enableEncryption = document.getElementById('enableEncryption');
  elements.encryptionFields = document.getElementById('encryptionFields');
  elements.encryptPassword = document.getElementById('encryptPassword');
  elements.confirmEncryptPassword = document.getElementById('confirmEncryptPassword');
  elements.togglePasswordVisibility = document.getElementById('togglePasswordVisibility');

  elements.importDropZone = document.getElementById('importDropZone');
  elements.importTargetFolder = document.getElementById('importTargetFolder');
  elements.importMode = document.getElementById('importMode');
  elements.importModeDescription = document.getElementById('importModeDescription');
  elements.isEncryptedFile = document.getElementById('isEncryptedFile');
  elements.decryptionFields = document.getElementById('decryptionFields');
  elements.decryptPassword = document.getElementById('decryptPassword');

  elements.toastContainer = document.getElementById('toastContainer');
}

function setupEventListeners() {
  try {
    if (elements.themeToggleBtn) {
      elements.themeToggleBtn.addEventListener('click', toggleTheme);
    }
    if (elements.openSettingsBtn) {
      elements.openSettingsBtn.addEventListener('click', openSettings);
    }

    if (elements.exportBtn) {
      elements.exportBtn.addEventListener('click', showExportModal);
    }
    if (elements.importBtn && elements.importFile) {
      elements.importBtn.addEventListener('click', () => elements.importFile.click());
    }
    if (elements.importFile) {
      elements.importFile.addEventListener('change', handleFileSelect);
    }
    if (elements.checkUrlsBtn) {
      elements.checkUrlsBtn.addEventListener('click', toggleCheckUrls);
    }

    if (elements.folderSelect) {
      elements.folderSelect.addEventListener('change', clearResults);
    }

    if (elements.findDuplicatesBtn) {
      elements.findDuplicatesBtn.addEventListener('click', showDuplicatesModal);
    }
    if (elements.showStatsBtn) {
      elements.showStatsBtn.addEventListener('click', showStatsModal);
    }

    if (elements.batchArchiveBtn) {
      elements.batchArchiveBtn.addEventListener('click', batchArchive);
    }
    if (elements.batchCategorizeBtn) {
      elements.batchCategorizeBtn.addEventListener('click', showCategorizeModal);
    }
    if (elements.batchDeleteBtn) {
      elements.batchDeleteBtn.addEventListener('click', batchDelete);
    }
    if (elements.selectAllBtn) {
      elements.selectAllBtn.addEventListener('click', toggleSelectAll);
    }

    document.querySelectorAll('.modal .close-btn, .modal #closeExportModal, .modal #closeImportModal, .modal #closeStatsModal, .modal #closeDuplicatesModal, .modal #closeConfirmModal, .modal #closeCategorizeModal').forEach(btn => {
      if (btn) btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) hideModal(modal);
      });
    });

    document.querySelectorAll('.modal #cancelExport, .modal #cancelImport, .modal #closeStatsBtn, .modal #closeDuplicatesBtn, .modal #cancelConfirm, .modal #cancelCategorize').forEach(btn => {
      if (btn) btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) hideModal(modal);
      });
    });

    if (elements.enableEncryption) {
      elements.enableEncryption.addEventListener('change', toggleEncryptionFields);
    }
    if (elements.togglePasswordVisibility) {
      elements.togglePasswordVisibility.addEventListener('click', togglePasswordShow);
    }
    const confirmExportBtn = document.getElementById('confirmExport');
    if (confirmExportBtn) {
      confirmExportBtn.addEventListener('click', confirmExport);
    }

    if (elements.importMode) {
      elements.importMode.addEventListener('change', updateImportModeDescription);
    }
    if (elements.isEncryptedFile) {
      elements.isEncryptedFile.addEventListener('change', toggleDecryptionFields);
    }
    const confirmImportBtn = document.getElementById('confirmImport');
    if (confirmImportBtn) {
      confirmImportBtn.addEventListener('click', confirmImport);
    }

    setupDragDrop();

    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn) btn.addEventListener('click', handleTabSwitch);
    });

    const deduplicateBtn = document.getElementById('deduplicateBtn');
    if (deduplicateBtn) {
      deduplicateBtn.addEventListener('click', deduplicateAll);
    }
    const confirmActionBtn = document.getElementById('confirmAction');
    if (confirmActionBtn) {
      confirmActionBtn.addEventListener('click', handleConfirmAction);
    }
    const confirmCategorizeBtn = document.getElementById('confirmCategorize');
    if (confirmCategorizeBtn) {
      confirmCategorizeBtn.addEventListener('click', confirmCategorize);
    }

    document.querySelectorAll('.modal').forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            hideModal(modal);
          }
        });
      }
    });

    logger.info('Event listeners set up successfully');
  } catch (error) {
    logger.error('Failed to set up event listeners:', error);
    console.error('Event listener setup error:', error);
  }
}

function setupDragDrop() {
  const dropZone = elements.importDropZone;
  if (!dropZone) return;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect({ target: { files } });
    }
  });

  dropZone.addEventListener('click', () => {
    elements.importFile.click();
  });
}

async function loadTheme() {
  const savedTheme = await storageManager.get('theme', 'light');
  UIState.currentTheme = savedTheme;
  applyTheme(savedTheme);
  updateThemeIcon();
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  UIState.currentTheme = theme;
  storageManager.set('theme', theme);
}

function toggleTheme() {
  const newTheme = UIState.currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const icon = elements.themeToggleBtn.querySelector('i');
  if (UIState.currentTheme === 'dark') {
    icon.className = 'bi bi-sun';
  } else {
    icon.className = 'bi bi-moon';
  }
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

async function initFolderSelects() {
  try {
    const bookmarks = await bookmarkManager.getAllBookmarks();
    const folders = bookmarkManager.getAllFolders(bookmarks);

    [elements.folderSelect, elements.exportFolder, elements.importTargetFolder, document.getElementById('categorizeTargetFolder')].forEach(select => {
      if (!select) return;
      
      const currentValue = select.value;
      const options = select.querySelectorAll('option:not([value="all"]):not([value="1"])');
      options.forEach(opt => opt.remove());

      folders.forEach(folder => {
        if (folder.title) {
          const option = document.createElement('option');
          option.value = folder.id;
          option.textContent = folder.title;
          select.appendChild(option);
        }
      });

      if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
        select.value = currentValue;
      }
    });

    logger.info('Folder selects initialized', { folderCount: folders.length });
  } catch (error) {
    logger.error('Failed to initialize folder selects:', error);
    showToast('加载文件夹列表失败', 'error');
  }
}

async function showExportModal() {
  await initFolderSelects();
  elements.exportFormat.value = 'json';
  elements.exportFolder.value = 'all';
  elements.enableEncryption.checked = false;
  elements.encryptionFields.classList.add('hidden');
  elements.encryptPassword.value = '';
  elements.confirmEncryptPassword.value = '';
  showModal(elements.exportModal);
}

function toggleEncryptionFields() {
  if (elements.enableEncryption.checked) {
    elements.encryptionFields.classList.remove('hidden');
  } else {
    elements.encryptionFields.classList.add('hidden');
  }
}

function togglePasswordShow() {
  const passwordInput = elements.encryptPassword;
  const icon = elements.togglePasswordVisibility.querySelector('i');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    icon.className = 'bi bi-eye-slash';
  } else {
    passwordInput.type = 'password';
    icon.className = 'bi bi-eye';
  }
}

async function confirmExport() {
  const format = elements.exportFormat.value;
  const folderId = elements.exportFolder.value;
  const enableEncryption = elements.enableEncryption.checked;

  try {
    if (enableEncryption) {
      const password = elements.encryptPassword.value;
      const confirmPassword = elements.confirmEncryptPassword.value;

      if (!password || password.length < 8) {
        showToast('密码至少需要 8 位', 'error');
        return;
      }

      if (password !== confirmPassword) {
        showToast('两次输入的密码不一致', 'error');
        return;
      }

      bookmarkIO.enableEncryption(password);
    } else {
      bookmarkIO.disableEncryption();
    }

    showToast('正在导出...', 'info');
    
    const exportData = await bookmarkManager.exportBookmarks(format, folderId);
    const date = new Date().toISOString().slice(0, 10);
    let filename = `bookmarks_${date}.${format}`;

    if (enableEncryption) {
      const encrypted = await cryptoUtils.encrypt(exportData, elements.encryptPassword.value);
      const finalData = JSON.stringify({
        encrypted: true,
        data: encrypted,
        format,
        timestamp: new Date().toISOString()
      });
      filename = `encrypted_${filename}`;
      downloadFile(finalData, filename, 'application/json');
    } else {
      downloadFile(exportData, filename, getMimeType(format));
    }

    hideModal(elements.exportModal);
    showToast('导出成功！', 'success');
    logger.info('Bookmarks exported successfully', { format, folderId, encrypted: enableEncryption });
  } catch (error) {
    logger.error('Export failed:', error);
    showToast('导出失败: ' + error.message, 'error');
  } finally {
    bookmarkIO.disableEncryption();
  }
}

function getMimeType(format) {
  switch (format) {
    case 'html': return 'text/html';
    case 'csv': return 'text/csv';
    case 'markdown': return 'text/markdown';
    default: return 'application/json';
  }
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  UIState.pendingFile = file;
  updateImportModeDescription();
  showModal(elements.importModal);
}

function updateImportModeDescription() {
  const mode = elements.importMode.value;
  const description = elements.importModeDescription;
  
  if (mode === 'flatten') {
    description.textContent = '平铺模式：将所有书签提取出来，全部导入到选中文件夹的根目录下，不保持原有的文件夹结构。适合将多个来源的书签整合到一个文件夹。';
  } else {
    description.textContent = '保持结构：完整保持导入文件中的原有文件夹层次结构，适合完整迁移书签。';
  }
}

function toggleDecryptionFields() {
  if (elements.isEncryptedFile.checked) {
    elements.decryptionFields.classList.remove('hidden');
  } else {
    elements.decryptionFields.classList.add('hidden');
  }
}

async function confirmImport() {
  if (!UIState.pendingFile) {
    showToast('请先选择文件', 'error');
    return;
  }

  const targetFolderId = elements.importTargetFolder.value;
  const importMode = elements.importMode.value;
  const isEncrypted = elements.isEncryptedFile.checked;

  try {
    showToast('正在导入...', 'info');
    
    const content = await readFileAsText(UIState.pendingFile);
    const fileExtension = UIState.pendingFile.name.split('.').pop().toLowerCase();

    let actualContent = content;
    let importOptions = { importMode };

    if (isEncrypted) {
      const password = elements.decryptPassword.value;
      if (!password) {
        showToast('请输入解密密码', 'error');
        return;
      }

      try {
        const parsed = JSON.parse(content);
        if (parsed.encrypted && parsed.data) {
          actualContent = await cryptoUtils.decrypt(parsed.data, password);
        }
      } catch (error) {
        showToast('解密失败，请检查密码是否正确', 'error');
        return;
      }
    }

    const importResult = await bookmarkIO.importBookmarks(
      actualContent,
      fileExtension,
      importOptions
    );

    const bookmarksToImport = importMode === 'flatten' 
      ? importResult.bookmarks 
      : importResult.bookmarks;

    await importBookmarksToBrowser(bookmarksToImport, targetFolderId, importMode);

    hideModal(elements.importModal);
    showToast('导入成功！', 'success');
    logger.info('Bookmarks imported successfully', { 
      filename: UIState.pendingFile.name,
      targetFolderId,
      importMode 
    });
    
    UIState.pendingFile = null;
    elements.importFile.value = '';
    elements.isEncryptedFile.checked = false;
    elements.decryptionFields.classList.add('hidden');
    elements.decryptPassword.value = '';

  } catch (error) {
    logger.error('Import failed:', error);
    showToast('导入失败: ' + error.message, 'error');
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

async function importBookmarksToBrowser(bookmarks, parentId, importMode) {
  async function createNode(node, targetParentId) {
    if (node.url) {
      await bookmarkManager.createBookmark(
        targetParentId,
        node.title || '无标题',
        node.url
      );
    } else if (node.children) {
      const folder = await bookmarkManager.createFolder(
        targetParentId,
        node.title || '未命名文件夹'
      );
      for (const child of node.children) {
        await createNode(child, folder.id);
      }
    }
  }

  if (importMode === 'flatten') {
    for (const bookmark of bookmarks) {
      if (bookmark.url) {
        await bookmarkManager.createBookmark(
          parentId,
          bookmark.title || '无标题',
          bookmark.url
        );
      }
    }
  } else {
    for (const bookmark of bookmarks) {
      await createNode(bookmark, parentId);
    }
  }
}

async function toggleCheckUrls() {
  if (UIState.isChecking) {
    UIState.shouldCancelCheck = true;
    elements.checkUrlsBtn.innerHTML = '<i class="bi bi-x-circle"></i> 正在取消...';
    elements.checkUrlsBtn.disabled = true;
    return;
  }

  await startCheckUrls();
}

async function startCheckUrls() {
  try {
    const folderId = elements.folderSelect.value;
    const bookmarks = await bookmarkManager.getAllBookmarks();
    const allUrls = extractBookmarkUrls(bookmarks, folderId);

    if (allUrls.length === 0) {
      showToast('没有找到书签', 'info');
      return;
    }

    UIState.isChecking = true;
    UIState.shouldCancelCheck = false;
    UIState.totalCount = allUrls.length;
    UIState.checkedCount = 0;
    UIState.invalidCount = 0;
    UIState.validCount = 0;
    UIState.checkResults = allUrls.map(url => ({ ...url, status: null }));

    elements.checkUrlsBtn.innerHTML = '<i class="bi bi-x-circle"></i> 取消检测';
    elements.progressContainer.classList.remove('hidden');
    bookmarkManager.clearSelection();
    updateSelectionUI();
    clearResults();

    updateProgressUI();

    const settings = await storageManager.get('extensionSettings', { threadsPerBatch: 10 });
    const batchSize = settings.threadsPerBatch || 10;

    for (let i = 0; i < allUrls.length; i += batchSize) {
      if (UIState.shouldCancelCheck) break;

      const batch = allUrls.slice(i, i + batchSize);
      const batchPromises = batch.map(async (item, index) => {
        if (UIState.shouldCancelCheck) return;
        
        const result = await bookmarkManager.checkUrlAvailability(item.url);
        const globalIndex = UIState.checkResults.findIndex(r => r.url === item.url);
        
        if (globalIndex !== -1) {
          UIState.checkResults[globalIndex].status = result.available;
          UIState.checkedCount++;
          
          if (result.available) {
            UIState.validCount++;
          } else {
            UIState.invalidCount++;
          }
        }
      });

      await Promise.all(batchPromises);
      updateProgressUI();
      renderResults();

      if (i + batchSize < allUrls.length && !UIState.shouldCancelCheck) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    await saveCheckResults();
    
    UIState.isChecking = false;
    elements.checkUrlsBtn.innerHTML = '<i class="bi bi-check-circle"></i> 检测网址可用性';
    elements.checkUrlsBtn.disabled = false;

    if (UIState.shouldCancelCheck) {
      showToast('检测已取消', 'info');
    } else {
      showToast(`检测完成，发现 ${UIState.invalidCount} 个失效书签`, UIState.invalidCount > 0 ? 'warning' : 'success');
    }

    logger.info('URL check completed', {
      total: UIState.totalCount,
      valid: UIState.validCount,
      invalid: UIState.invalidCount,
      cancelled: UIState.shouldCancelCheck
    });

  } catch (error) {
    logger.error('URL check failed:', error);
    showToast('检测失败: ' + error.message, 'error');
    UIState.isChecking = false;
    elements.checkUrlsBtn.innerHTML = '<i class="bi bi-check-circle"></i> 检测网址可用性';
  }
}

function extractBookmarkUrls(bookmarks, folderId) {
  const urls = [];
  
  function extract(nodes, targetFolder, extractAll = true) {
    for (const node of nodes) {
      if (node.url) {
        if (extractAll || node.parentId === targetFolder || isDescendant(node, targetFolder)) {
          urls.push({
            id: node.id,
            title: node.title,
            url: node.url,
            parentId: node.parentId
          });
        }
      }
      if (node.children) {
        extract(node.children, targetFolder, extractAll);
      }
    }
  }

  const extractAll = folderId === 'all';
  if (bookmarks[0]?.children) {
    extract(bookmarks[0].children, folderId, extractAll);
  }

  return urls;
}

function isDescendant(node, folderId) {
  return node.path?.includes(folderId) || false;
}

function updateProgressUI() {
  const progress = Math.floor((UIState.checkedCount / UIState.totalCount) * 100);
  
  elements.progressBar.style.width = `${progress}%`;
  elements.progressText.innerHTML = `<i class="bi bi-arrow-repeat progress-icon"></i> ${progress}% (${UIState.checkedCount}/${UIState.totalCount})`;
  
  elements.validCount.textContent = UIState.validCount;
  elements.invalidCount.textContent = UIState.invalidCount;
  elements.pendingCount.textContent = UIState.totalCount - UIState.checkedCount;
}

function renderResults() {
  const container = elements.resultsContainer;
  
  const invalidResults = UIState.checkResults.filter(r => r.status === false);
  const allResults = UIState.checkResults.filter(r => r.status !== null);

  if (allResults.length === 0) {
    container.innerHTML = `
      <div class="results-empty">
        <i class="bi bi-hourglass-split"></i>
        <div class="empty-title">正在检测中...</div>
        <div class="empty-subtitle">已检测 ${UIState.checkedCount}/${UIState.totalCount} 个书签</div>
      </div>
    `;
    return;
  }

  if (invalidResults.length === 0) {
    container.innerHTML = `
      <div class="results-empty">
        <i class="bi bi-check-circle-fill" style="color: var(--success-color)"></i>
        <div class="empty-title">太棒了！</div>
        <div class="empty-subtitle">所有 ${UIState.validCount} 个书签都有效</div>
      </div>
    `;
    elements.batchActions.classList.add('hidden');
    return;
  }

  elements.batchActions.classList.remove('hidden');

  let html = '';
  invalidResults.forEach((result, index) => {
    const isSelected = bookmarkManager.selectedBookmarks.has(result.id);
    const domain = extractDomain(result.url);
    
    html += `
      <div class="url-item ${isSelected ? 'selected' : ''}" data-id="${result.id}" data-url="${result.url}">
        <div class="checkbox-wrapper">
          <input type="checkbox" class="url-checkbox" ${isSelected ? 'checked' : ''}>
        </div>
        <div class="url-title">
          ${result.title || '无标题'}
          ${domain ? `<span class="url-domain">${domain}</span>` : ''}
        </div>
        <div class="url-status unavailable">失效</div>
        <div class="url-actions">
          <button class="action-btn new-tab-btn" title="在新标签页打开">
            <i class="bi bi-box-arrow-up-right"></i>
          </button>
          <button class="action-btn popup-btn" title="在弹窗打开">
            <i class="bi bi-window"></i>
          </button>
          <button class="action-btn copy-btn" title="复制链接">
            <i class="bi bi-clipboard"></i>
          </button>
          <button class="action-btn delete-btn" title="删除">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  setupResultItemListeners();
}

function setupResultItemListeners() {
  const items = elements.resultsContainer.querySelectorAll('.url-item');
  
  items.forEach(item => {
    const checkbox = item.querySelector('.url-checkbox');
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const id = item.dataset.id;
        bookmarkManager.toggleSelection(id);
        item.classList.toggle('selected');
        updateSelectionUI();
      });
    }

    const newTabBtn = item.querySelector('.new-tab-btn');
    if (newTabBtn) {
      newTabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.tabs.create({ url: item.dataset.url });
      });
    }

    const popupBtn = item.querySelector('.popup-btn');
    if (popupBtn) {
      popupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.windows.create({
          url: item.dataset.url,
          type: 'popup',
          width: 800,
          height: 600
        });
      });
    }

    const copyBtn = item.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(item.dataset.url);
          copyBtn.innerHTML = '<i class="bi bi-check"></i>';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="bi bi-clipboard"></i>';
          }, 1500);
          showToast('链接已复制', 'success');
        } catch (error) {
          showToast('复制失败', 'error');
        }
      });
    }

    const deleteBtn = item.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = item.dataset.id;
        const title = item.querySelector('.url-title').textContent.trim();
        showConfirmModal(
          '确认删除',
          'bi bi-exclamation-triangle warning-icon',
          `确定要删除书签「${title}」吗？`,
          '此操作不可撤销。',
          async () => {
            try {
              await bookmarkManager.deleteBookmark(id);
              item.remove();
              bookmarkManager.selectedBookmarks.delete(id);
              updateSelectionUI();
              
              const index = UIState.checkResults.findIndex(r => r.id === id);
              if (index !== -1) {
                UIState.checkResults.splice(index, 1);
                UIState.invalidCount--;
              }
              
              await saveCheckResults();
              showToast('已删除', 'success');
              
              if (elements.resultsContainer.querySelectorAll('.url-item').length === 0) {
                renderResults();
              }
            } catch (error) {
              showToast('删除失败', 'error');
            }
          }
        );
      });
    }
  });
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

function updateSelectionUI() {
  const count = bookmarkManager.getSelectionCount();
  elements.selectedCount.textContent = count;
}

function toggleSelectAll() {
  const items = elements.resultsContainer.querySelectorAll('.url-item');
  const allSelected = Array.from(items).every(item => 
    bookmarkManager.selectedBookmarks.has(item.dataset.id)
  );

  if (allSelected) {
    bookmarkManager.clearSelection();
    items.forEach(item => {
      item.classList.remove('selected');
      const checkbox = item.querySelector('.url-checkbox');
      if (checkbox) checkbox.checked = false;
    });
  } else {
    const ids = Array.from(items).map(item => item.dataset.id);
    bookmarkManager.selectAll(ids);
    items.forEach(item => {
      item.classList.add('selected');
      const checkbox = item.querySelector('.url-checkbox');
      if (checkbox) checkbox.checked = true;
    });
  }
  
  updateSelectionUI();
}

async function batchArchive() {
  const selectedIds = bookmarkManager.getSelectedIds();
  if (selectedIds.length === 0) {
    showToast('请先选择要归档的书签', 'info');
    return;
  }

  showConfirmModal(
    '确认归档',
    'bi bi-archive warning-icon',
    `确定要归档 ${selectedIds.length} 个书签吗？`,
    '书签将被移动到「已归档书签」文件夹。',
    async () => {
      try {
        showToast('正在归档...', 'info');
        const result = await bookmarkManager.archiveBookmarks(selectedIds);
        
        selectedIds.forEach(id => {
          const item = elements.resultsContainer.querySelector(`[data-id="${id}"]`);
          if (item) item.remove();
        });

        bookmarkManager.clearSelection();
        updateSelectionUI();
        
        selectedIds.forEach(id => {
          const index = UIState.checkResults.findIndex(r => r.id === id);
          if (index !== -1) {
            UIState.checkResults.splice(index, 1);
            UIState.invalidCount--;
          }
        });

        await saveCheckResults();
        renderResults();
        
        showToast(`已归档 ${result.archivedCount} 个书签`, 'success');
        logger.info('Batch archive completed', { count: result.archivedCount });
      } catch (error) {
        showToast('归档失败: ' + error.message, 'error');
      }
    }
  );
}

async function batchDelete() {
  const selectedIds = bookmarkManager.getSelectedIds();
  if (selectedIds.length === 0) {
    showToast('请先选择要删除的书签', 'info');
    return;
  }

  showConfirmModal(
    '确认删除',
    'bi bi-exclamation-triangle error-icon',
    `确定要删除 ${selectedIds.length} 个书签吗？`,
    '此操作不可撤销。',
    async () => {
      try {
        showToast('正在删除...', 'info');
        const result = await bookmarkManager.batchDeleteBookmarks(selectedIds);
        
        selectedIds.forEach(id => {
          const item = elements.resultsContainer.querySelector(`[data-id="${id}"]`);
          if (item) item.remove();
        });

        bookmarkManager.clearSelection();
        updateSelectionUI();
        
        selectedIds.forEach(id => {
          const index = UIState.checkResults.findIndex(r => r.id === id);
          if (index !== -1) {
            UIState.checkResults.splice(index, 1);
            UIState.invalidCount--;
          }
        });

        await saveCheckResults();
        renderResults();
        
        showToast(`已删除 ${result.deletedCount} 个书签`, 'success');
        logger.info('Batch delete completed', { count: result.deletedCount });
      } catch (error) {
        showToast('删除失败: ' + error.message, 'error');
      }
    }
  );
}

async function saveCheckResults() {
  const results = {
    total: UIState.totalCount,
    checked: UIState.checkedCount,
    validCount: UIState.validCount,
    invalidCount: UIState.invalidCount,
    results: UIState.checkResults,
    timestamp: Date.now()
  };
  
  await storageManager.set('bookmarkCheckResults', results);
}

async function loadSavedResults() {
  const saved = await storageManager.get('bookmarkCheckResults', null);
  if (saved) {
    UIState.totalCount = saved.total || 0;
    UIState.checkedCount = saved.checked || 0;
    UIState.validCount = saved.validCount || 0;
    UIState.invalidCount = saved.invalidCount || 0;
    UIState.checkResults = saved.results || [];
    
    const invalidCount = UIState.checkResults.filter(r => r.status === false).length;
    if (invalidCount > 0) {
      elements.batchActions.classList.remove('hidden');
      renderResults();
    }
  }
}

function clearResults() {
  elements.resultsContainer.innerHTML = `
    <div class="results-empty">
      <i class="bi bi-bookmark-check"></i>
      <div class="empty-title">暂无检测结果</div>
      <div class="empty-subtitle">点击「检测网址可用性」开始检测</div>
    </div>
  `;
  elements.batchActions.classList.add('hidden');
  bookmarkManager.clearSelection();
  updateSelectionUI();
}

async function showDuplicatesModal() {
  showModal(elements.duplicatesModal);
  document.getElementById('duplicatesCount').textContent = '正在检测...';
  document.getElementById('duplicatesList').innerHTML = '';

  try {
    const result = await bookmarkManager.findDuplicates();
    
    document.getElementById('duplicatesCount').textContent = 
      result.duplicates.length === 0 
        ? '太棒了！没有发现重复书签' 
        : `发现 ${result.duplicates.length} 组重复书签`;

    if (result.duplicates.length === 0) {
      document.getElementById('duplicatesList').innerHTML = `
        <div class="results-empty" style="min-height: 100px;">
          <i class="bi bi-check-circle-fill" style="color: var(--success-color)"></i>
          <div class="empty-title">所有书签都是唯一的</div>
        </div>
      `;
      document.getElementById('deduplicateBtn').style.display = 'none';
      return;
    }

    document.getElementById('deduplicateBtn').style.display = '';

    let html = '';
    result.duplicates.forEach((group, index) => {
      html += `
        <div class="stat-card">
          <div class="stat-card-title">
            <i class="bi bi-files"></i> 第 ${index + 1} 组 (${group.duplicates.length + 1} 个)
          </div>
          <div class="url-item" data-id="${group.originalId}">
            <div class="checkbox-wrapper">
              <input type="checkbox" class="duplicate-checkbox" checked disabled>
            </div>
            <div class="url-title">
              <span style="color: var(--success-color); font-weight: 600;">[保留]</span> 
              ${group.originalTitle || '无标题'}
            </div>
          </div>
          ${group.duplicates.map(dup => `
            <div class="url-item" data-id="${dup.id}" style="opacity: 0.8;">
              <div class="checkbox-wrapper">
                <input type="checkbox" class="duplicate-checkbox" data-type="duplicate" checked>
              </div>
              <div class="url-title">
                <span style="color: var(--error-color); font-weight: 600;">[删除]</span> 
                ${dup.title || '无标题'}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    });

    document.getElementById('duplicatesList').innerHTML = html;

  } catch (error) {
    logger.error('Find duplicates failed:', error);
    document.getElementById('duplicatesCount').textContent = '检测失败: ' + error.message;
  }
}

async function deduplicateAll() {
  const checkboxes = document.querySelectorAll('.duplicate-checkbox[data-type="duplicate"]:checked');
  const idsToDelete = Array.from(checkboxes).map(cb => {
    const item = cb.closest('.url-item');
    return item.dataset.id;
  });

  if (idsToDelete.length === 0) {
    showToast('没有选择要删除的重复书签', 'info');
    return;
  }

  showConfirmModal(
    '确认去重',
    'bi bi-exclamation-triangle warning-icon',
    `确定要删除 ${idsToDelete.length} 个重复书签吗？`,
    '此操作不可撤销。',
    async () => {
      try {
        showToast('正在去重...', 'info');
        const result = await bookmarkManager.batchDeleteBookmarks(idsToDelete);
        hideModal(elements.duplicatesModal);
        showToast(`已删除 ${result.deletedCount} 个重复书签`, 'success');
        logger.info('Deduplication completed', { count: result.deletedCount });
      } catch (error) {
        showToast('去重失败: ' + error.message, 'error');
      }
    }
  );
}

async function showStatsModal() {
  showModal(elements.statsModal);
  
  try {
    const result = await bookmarkManager.getStatistics();
    const stats = result.statistics;

    document.getElementById('statTotalBookmarks').textContent = stats.totalBookmarks;
    document.getElementById('statTotalFolders').textContent = stats.totalFolders;
    document.getElementById('statUniqueDomains').textContent = Object.keys(stats.urlsByDomain).length;

    if (stats.lastCheckResults) {
      document.getElementById('lastCheckStatus').innerHTML = `
        上次检测: ${new Date(stats.lastCheckResults.timestamp).toLocaleString()}<br>
        共 ${stats.lastCheckResults.total} 个，有效 ${stats.lastCheckResults.total - stats.lastCheckResults.invalidCount} 个，失效 ${stats.lastCheckResults.invalidCount} 个
      `;
    } else {
      document.getElementById('lastCheckStatus').textContent = '暂无检测记录';
    }

    renderDomainsList(stats.topDomains);
    renderFoldersList(stats.folders);

  } catch (error) {
    logger.error('Get statistics failed:', error);
    showToast('获取统计数据失败', 'error');
  }
}

function renderDomainsList(domains) {
  if (domains.length === 0) {
    document.getElementById('domainsList').innerHTML = `
      <div class="results-empty" style="min-height: 100px;">
        <div class="empty-title">暂无数据</div>
      </div>
    `;
    return;
  }

  const maxCount = domains[0]?.count || 1;
  let html = '';
  
  domains.forEach(domain => {
    const percentage = Math.round((domain.count / maxCount) * 100);
    html += `
      <div class="stat-row">
        <span class="stat-label">${domain.domain}</span>
        <span class="stat-value">${domain.count}</span>
      </div>
      <div class="progress-bar-small">
        <div class="progress-bar-fill primary" style="width: ${percentage}%"></div>
      </div>
    `;
  });

  document.getElementById('domainsList').innerHTML = html;
}

function renderFoldersList(folders) {
  if (folders.length === 0) {
    document.getElementById('foldersList').innerHTML = `
      <div class="results-empty" style="min-height: 100px;">
        <div class="empty-title">暂无数据</div>
      </div>
    `;
    return;
  }

  const maxCount = folders[0]?.bookmarkCount || 1;
  let html = '';
  
  folders.slice(0, 10).forEach(folder => {
    const percentage = Math.round((folder.bookmarkCount / maxCount) * 100);
    html += `
      <div class="stat-row">
        <span class="stat-label">
          <i class="bi bi-folder2" style="color: var(--primary-color); margin-right: 6px;"></i>
          ${folder.path || folder.title}
        </span>
        <span class="stat-value">${folder.bookmarkCount}</span>
      </div>
      <div class="progress-bar-small">
        <div class="progress-bar-fill primary" style="width: ${percentage}%"></div>
      </div>
    `;
  });

  document.getElementById('foldersList').innerHTML = html;
}

function handleTabSwitch(e) {
  const targetTab = e.target.dataset.tab;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  e.target.classList.add('active');

  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`tab-${targetTab}`).classList.add('active');
}

async function showCategorizeModal() {
  const selectedIds = bookmarkManager.getSelectedIds();
  if (selectedIds.length === 0) {
    showToast('请先选择要分类的书签', 'info');
    return;
  }

  await initFolderSelects();
  showModal(elements.batchCategorizeModal);
}

function showModal(modal) {
  modal.classList.remove('hidden');
}

function hideModal(modal) {
  modal.classList.add('hidden');
}

function showConfirmModal(title, iconClass, messageTitle, message, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmIcon').className = iconClass;
  document.getElementById('confirmMessageTitle').textContent = messageTitle;
  document.getElementById('confirmMessage').textContent = message;
  
  UIState.confirmCallback = callback;
  showModal(elements.confirmModal);
}

function handleConfirmAction() {
  if (UIState.confirmCallback) {
    UIState.confirmCallback();
    UIState.confirmCallback = null;
  }
  hideModal(elements.confirmModal);
}

async function confirmCategorize() {
  const targetFolderId = document.getElementById('categorizeTargetFolder').value;
  const selectedIds = bookmarkManager.getSelectedIds();
  
  if (selectedIds.length === 0) {
    showToast('请先选择要分类的书签', 'info');
    return;
  }

  try {
    showToast('正在移动...', 'info');
    const result = await bookmarkManager.categorizeBookmarks(selectedIds, targetFolderId);
    
    selectedIds.forEach(id => {
      const item = elements.resultsContainer.querySelector(`[data-id="${id}"]`);
      if (item) item.remove();
    });

    bookmarkManager.clearSelection();
    updateSelectionUI();
    hideModal(elements.batchCategorizeModal);
    
    showToast(`已移动 ${result.movedCount} 个书签`, 'success');
    logger.info('Batch categorize completed', { count: result.movedCount });
  } catch (error) {
    showToast('移动失败: ' + error.message, 'error');
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast`;
  
  const iconClass = {
    success: 'bi bi-check-circle-fill',
    error: 'bi bi-x-circle-fill',
    warning: 'bi bi-exclamation-triangle-fill',
    info: 'bi bi-info-circle-fill'
  }[type] || 'bi bi-info-circle-fill';

  toast.innerHTML = `
    <i class="toast-icon ${type} ${iconClass}"></i>
    <div class="toast-content">
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close"><i class="bi bi-x"></i></button>
  `;

  elements.toastContainer.appendChild(toast);

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.style.animation = 'toastIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  });

  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'toastIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }
  }, 3000);
}

init();
