const DEFAULT_SETTINGS = {
  enableProxyRetry: false,
  proxyAddress: '',
  proxyPort: '',
  proxyType: 'http',
  threadsPerBatch: 10,
  theme: 'light',
  enableNotifications: true
};

function getNormalizedThreadCount(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_SETTINGS.threadsPerBatch;
  }
  return Math.min(20, Math.max(1, parsed));
}

async function loadSettings() {
  const stored = await chrome.storage.local.get('extensionSettings');
  return {
    ...DEFAULT_SETTINGS,
    ...(stored.extensionSettings || {})
  };
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ extensionSettings: settings });
}

function showSettingsMessage(text, isError = false) {
  const message = document.getElementById('settingsMessage');
  if (!message) return;
  message.textContent = text;
  message.className = `message ${isError ? 'error' : 'success'}`;
}

function toggleProxyFields(visible) {
  const container = document.getElementById('proxyFields');
  if (!container) return;
  container.style.display = visible ? 'grid' : 'none';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('#themeToggleBtn i');
  if (icon) {
    icon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon';
  }
}

function toggleTheme(currentTheme) {
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
  return newTheme;
}

async function getBookmarkStats() {
  try {
    const bookmarks = await chrome.bookmarks.getTree();
    let totalBookmarks = 0;
    let totalFolders = 0;

    const countNodes = (nodes) => {
      for (const node of nodes) {
        if (node.url) {
          totalBookmarks++;
        } else if (node.children) {
          totalFolders++;
          countNodes(node.children);
        }
      }
    };

    if (bookmarks[0]?.children) {
      countNodes(bookmarks[0].children);
    }

    const savedResults = await chrome.storage.local.get('bookmarkCheckResults');
    let lastCheck = null;
    if (savedResults.bookmarkCheckResults) {
      lastCheck = savedResults.bookmarkCheckResults.timestamp;
    }

    return {
      totalBookmarks,
      totalFolders,
      lastCheck
    };
  } catch (error) {
    console.error('获取书签统计失败:', error);
    return {
      totalBookmarks: 0,
      totalFolders: 0,
      lastCheck: null
    };
  }
}

function formatLastCheck(timestamp) {
  if (!timestamp) return '无';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  
  return date.toLocaleDateString();
}

async function updateStatsDisplay() {
  const stats = await getBookmarkStats();
  
  const totalBookmarksEl = document.getElementById('statTotalBookmarks');
  const totalFoldersEl = document.getElementById('statTotalFolders');
  const lastCheckEl = document.getElementById('statLastCheck');
  
  if (totalBookmarksEl) totalBookmarksEl.textContent = stats.totalBookmarks;
  if (totalFoldersEl) totalFoldersEl.textContent = stats.totalFolders;
  if (lastCheckEl) lastCheckEl.textContent = formatLastCheck(stats.lastCheck);
}

async function openPopupWithAction(action) {
  const popupUrl = chrome.runtime.getURL('popup.html');
  await chrome.windows.create({
    url: popupUrl,
    type: 'popup',
    width: 420,
    height: 650
  });
}

async function clearCache() {
  try {
    await chrome.storage.local.remove('bookmarkCheckResults');
    showSettingsMessage('缓存已清除');
    updateStatsDisplay();
  } catch (error) {
    console.error('清除缓存失败:', error);
    showSettingsMessage('清除缓存失败', true);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const enableProxyRetry = document.getElementById('enableProxyRetry');
  const proxyAddress = document.getElementById('proxyAddress');
  const proxyPort = document.getElementById('proxyPort');
  const proxyType = document.getElementById('proxyType');
  const threadsPerBatch = document.getElementById('threadsPerBatch');
  const form = document.getElementById('settingsForm');

  const quickCheckBtn = document.getElementById('quickCheckBtn');
  const quickDuplicatesBtn = document.getElementById('quickDuplicatesBtn');
  const quickExportBtn = document.getElementById('quickExportBtn');
  const quickClearCacheBtn = document.getElementById('quickClearCacheBtn');

  let currentTheme = 'light';

  try {
    const settings = await loadSettings();
    
    currentTheme = settings.theme || 'light';
    applyTheme(currentTheme);

    enableProxyRetry.checked = settings.enableProxyRetry;
    proxyAddress.value = settings.proxyAddress || '';
    proxyPort.value = settings.proxyPort || '';
    proxyType.value = settings.proxyType || 'http';
    threadsPerBatch.value = settings.threadsPerBatch || DEFAULT_SETTINGS.threadsPerBatch;
    toggleProxyFields(enableProxyRetry.checked);

    await updateStatsDisplay();
  } catch (error) {
    console.error('加载设置失败:', error);
    showSettingsMessage('加载设置失败，请刷新后重试', true);
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', async () => {
      currentTheme = toggleTheme(currentTheme);
      const settings = await loadSettings();
      settings.theme = currentTheme;
      await saveSettings(settings);
    });
  }

  if (enableProxyRetry) {
    enableProxyRetry.addEventListener('change', (event) => {
      toggleProxyFields(event.target.checked);
    });
  }

  if (quickCheckBtn) {
    quickCheckBtn.addEventListener('click', () => openPopupWithAction('check'));
  }

  if (quickDuplicatesBtn) {
    quickDuplicatesBtn.addEventListener('click', () => openPopupWithAction('duplicates'));
  }

  if (quickExportBtn) {
    quickExportBtn.addEventListener('click', () => openPopupWithAction('export'));
  }

  if (quickClearCacheBtn) {
    quickClearCacheBtn.addEventListener('click', async () => {
      if (confirm('确定要清除所有检测缓存吗？')) {
        await clearCache();
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const threadCount = getNormalizedThreadCount(threadsPerBatch.value);
      const portValue = proxyPort.value.trim();
      const portNumber = portValue ? parseInt(portValue, 10) : '';

      if (enableProxyRetry.checked) {
        if (!proxyAddress.value.trim() || !portValue) {
          showSettingsMessage('请完整填写代理地址和端口', true);
          return;
        }
        if (Number.isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
          showSettingsMessage('端口必须在 1 到 65535 之间', true);
          return;
        }
      }

      const newSettings = {
        enableProxyRetry: enableProxyRetry.checked,
        proxyAddress: proxyAddress.value.trim(),
        proxyPort: enableProxyRetry.checked ? String(portNumber) : '',
        proxyType: proxyType.value,
        threadsPerBatch: threadCount,
        theme: currentTheme
      };

      try {
        await saveSettings(newSettings);
        showSettingsMessage('设置已保存');
      } catch (error) {
        console.error('保存设置失败:', error);
        showSettingsMessage('保存失败，请重试', true);
      }
    });
  }
});
