const DEFAULT_SETTINGS = {
  enableProxyRetry: false,
  proxyAddress: '',
  proxyPort: '',
  proxyType: 'http',
  threadsPerBatch: 10,
  webdavUrl: '',
  webdavUsername: '',
  webdavPassword: '',
  webdavPath: '/bookmarks/'
};

const DEFAULT_SYNC_INFO = {
  remoteBackupAt: '',
  lastPulledAt: '',
  lastPushedAt: '',
  lastQueryAt: ''
};

function getNormalizedThreadCount(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_SETTINGS.threadsPerBatch;
  }
  return Math.min(20, Math.max(1, parsed));
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(['extensionSettings', 'webdavSyncInfo']);
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      ...(stored.extensionSettings || {})
    },
    syncInfo: {
      ...DEFAULT_SYNC_INFO,
      ...(stored.webdavSyncInfo || {})
    }
  };
}

function showSettingsMessage(text, isError = false) {
  const message = document.getElementById('settingsMessage');
  if (!message) return;
  message.textContent = text;
  message.className = `message ${isError ? 'error' : 'success'}`;
}

function showWebdavMessage(text, isError = false) {
  const message = document.getElementById('webdavTestResult');
  if (!message) return;
  message.textContent = text;
  message.className = `message ${isError ? 'error' : 'success'}`;
}

function toggleProxyFields(visible) {
  const container = document.getElementById('proxyFields');
  if (!container) return;
  container.style.display = visible ? 'grid' : 'none';
}

function getSelectedProxyType() {
  const selected = document.querySelector('input[name="proxyType"]:checked');
  return selected ? selected.value : DEFAULT_SETTINGS.proxyType;
}

function setSelectedProxyType(value) {
  const target = value || DEFAULT_SETTINGS.proxyType;
  const radios = document.querySelectorAll('input[name="proxyType"]');
  radios.forEach((radio) => {
    radio.checked = radio.value === target;
  });
}

function formatSyncTime(value) {
  if (!value) return '暂无记录';
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return value;
  return time.toLocaleString('zh-CN', { hour12: false });
}

function renderSyncInfo(syncInfo) {
  const remoteBackupTime = document.getElementById('remoteBackupTime');
  const lastPulledTime = document.getElementById('lastPulledTime');
  const lastPushedTime = document.getElementById('lastPushedTime');

  if (remoteBackupTime) {
    remoteBackupTime.textContent = syncInfo.remoteBackupAt ? formatSyncTime(syncInfo.remoteBackupAt) : '未查询';
  }
  if (lastPulledTime) {
    lastPulledTime.textContent = formatSyncTime(syncInfo.lastPulledAt);
  }
  if (lastPushedTime) {
    lastPushedTime.textContent = formatSyncTime(syncInfo.lastPushedAt);
  }
}

async function saveSyncInfo(patch) {
  const stored = await chrome.storage.local.get('webdavSyncInfo');
  const nextInfo = {
    ...DEFAULT_SYNC_INFO,
    ...(stored.webdavSyncInfo || {}),
    ...patch
  };
  await chrome.storage.local.set({ webdavSyncInfo: nextInfo });
  renderSyncInfo(nextInfo);
  return nextInfo;
}

function getWebDAVConfigFromForm() {
  const url = document.getElementById('webdavUrl').value.trim();
  const username = document.getElementById('webdavUsername').value.trim();
  const password = document.getElementById('webdavPassword').value;
  const remotePath = document.getElementById('webdavPath').value.trim() || '/bookmarks/';

  if (!url || !username || !password) return null;
  return { url, username, password, remotePath };
}

async function buildSettingsBackupPayload() {
  const bookmarks = await chrome.bookmarks.getTree();
  const stored = await chrome.storage.local.get([
    'extensionSettings',
    'bookmarkCheckResults',
    'bookmarkResultsById'
  ]);

  return {
    version: '2.1',
    timestamp: new Date().toISOString(),
    bookmarks,
    settings: stored.extensionSettings || {},
    checkResults: stored.bookmarkCheckResults || null,
    resultsById: stored.bookmarkResultsById || {}
  };
}

async function importBookmarkItemFromBackup(item, parentId) {
  try {
    if (!item || typeof item !== 'object') return;

    if (item.url) {
      await chrome.bookmarks.create({
        parentId,
        title: item.title || '未命名',
        url: item.url
      });
      return;
    }

    if (item.children && Array.isArray(item.children)) {
      const newFolder = await chrome.bookmarks.create({
        parentId,
        title: item.title || '未命名'
      });

      for (const child of item.children) {
        await importBookmarkItemFromBackup(child, newFolder.id);
      }
      return;
    }

    await chrome.bookmarks.create({
      parentId,
      title: item.title || '未命名'
    });
  } catch (error) {
    console.error('导入书签失败:', error);
  }
}

function setButtonBusy(button, busyText, idleHtml) {
  if (!button) return () => {};
  const previousDisabled = button.disabled;
  button.disabled = true;
  button.innerHTML = busyText;
  return () => {
    button.disabled = previousDisabled;
    button.innerHTML = idleHtml;
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  const enableProxyRetry = document.getElementById('enableProxyRetry');
  const proxyAddress = document.getElementById('proxyAddress');
  const proxyPort = document.getElementById('proxyPort');
  const threadsPerBatch = document.getElementById('threadsPerBatch');
  const form = document.getElementById('settingsForm');

  try {
    const { settings, syncInfo } = await loadSettings();

    enableProxyRetry.checked = settings.enableProxyRetry;
    proxyAddress.value = settings.proxyAddress || '';
    proxyPort.value = settings.proxyPort || '';
    setSelectedProxyType(settings.proxyType || DEFAULT_SETTINGS.proxyType);
    threadsPerBatch.value = settings.threadsPerBatch || DEFAULT_SETTINGS.threadsPerBatch;
    document.getElementById('webdavUrl').value = settings.webdavUrl || '';
    document.getElementById('webdavUsername').value = settings.webdavUsername || '';
    document.getElementById('webdavPassword').value = settings.webdavPassword || '';
    document.getElementById('webdavPath').value = settings.webdavPath || '/bookmarks/';

    toggleProxyFields(enableProxyRetry.checked);
    renderSyncInfo(syncInfo);
  } catch (error) {
    console.error('加载设置失败:', error);
    showSettingsMessage('加载设置失败，请刷新后重试', true);
  }

  enableProxyRetry.addEventListener('change', (event) => {
    toggleProxyFields(event.target.checked);
  });

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
      proxyType: getSelectedProxyType(),
      threadsPerBatch: threadCount,
      webdavUrl: document.getElementById('webdavUrl').value.trim(),
      webdavUsername: document.getElementById('webdavUsername').value.trim(),
      webdavPassword: document.getElementById('webdavPassword').value,
      webdavPath: document.getElementById('webdavPath').value.trim() || '/bookmarks/'
    };

    try {
      await chrome.storage.local.set({ extensionSettings: newSettings });
      showSettingsMessage('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      showSettingsMessage('保存失败，请重试', true);
    }
  });

  document.getElementById('testWebdavBtn').addEventListener('click', async () => {
    const button = document.getElementById('testWebdavBtn');
    const restoreButton = setButtonBusy(button, '<i class="bi bi-arrow-repeat"></i> 测试中...', '<i class="bi bi-plug"></i> 测试连接');
    const config = getWebDAVConfigFromForm();

    if (!config) {
      showWebdavMessage('请先填写服务器地址、用户名和密码', true);
      restoreButton();
      return;
    }

    showWebdavMessage('正在测试连接...');

    try {
      const client = new WebDAVClient(config);
      const result = await client.testConnection();
      showWebdavMessage(result.message, !result.success);
    } catch (error) {
      showWebdavMessage('连接失败: ' + error.message, true);
    }

    restoreButton();
  });

  document.getElementById('queryWebdavBtn').addEventListener('click', async () => {
    const button = document.getElementById('queryWebdavBtn');
    const restoreButton = setButtonBusy(button, '<i class="bi bi-arrow-repeat"></i> 查询中...', '<i class="bi bi-search"></i> 查询远端');
    const config = getWebDAVConfigFromForm();

    if (!config) {
      showWebdavMessage('请先填写完整的 WebDAV 配置', true);
      restoreButton();
      return;
    }

    showWebdavMessage('正在查询远端备份...');

    try {
      const client = new WebDAVClient(config);
      const result = await client.getBackupInfo('bookmark_inspector_backup.json');

      if (!result.success) {
        showWebdavMessage(result.message || '查询失败', true);
        restoreButton();
        return;
      }

      await saveSyncInfo({
        remoteBackupAt: result.timestamp || '',
        lastQueryAt: new Date().toISOString()
      });

      const remoteTime = result.timestamp ? formatSyncTime(result.timestamp) : '远端文件存在，但未记录时间';
      showWebdavMessage('查询成功，远端备份时间：' + remoteTime);
    } catch (error) {
      showWebdavMessage('查询失败: ' + error.message, true);
    }

    restoreButton();
  });

  document.getElementById('webdavBackupBtn').addEventListener('click', async () => {
    const button = document.getElementById('webdavBackupBtn');
    const restoreButton = setButtonBusy(button, '<i class="bi bi-arrow-repeat"></i> 备份中...', '<i class="bi bi-cloud-arrow-up"></i> 备份');
    const config = getWebDAVConfigFromForm();

    if (!config) {
      showWebdavMessage('请先填写完整的 WebDAV 配置', true);
      restoreButton();
      return;
    }

    showWebdavMessage('正在备份...');

    try {
      const client = new WebDAVClient(config);
      const dirResult = await client.ensureDirectory();
      if (!dirResult.success) {
        showWebdavMessage(dirResult.message || '无法创建远程目录', true);
        restoreButton();
        return;
      }

      const payload = await buildSettingsBackupPayload();
      const result = await client.put('bookmark_inspector_backup.json', payload);

      if (!result.success) {
        showWebdavMessage(result.message || '备份失败', true);
        restoreButton();
        return;
      }

      await saveSyncInfo({
        remoteBackupAt: payload.timestamp,
        lastPushedAt: payload.timestamp
      });
      showWebdavMessage('备份成功');
    } catch (error) {
      showWebdavMessage('备份失败: ' + error.message, true);
    }

    restoreButton();
  });

  document.getElementById('webdavRestoreBtn').addEventListener('click', async () => {
    const button = document.getElementById('webdavRestoreBtn');
    const restoreButton = setButtonBusy(button, '<i class="bi bi-arrow-repeat"></i> 恢复中...', '<i class="bi bi-cloud-arrow-down"></i> 恢复');
    const config = getWebDAVConfigFromForm();

    if (!config) {
      showWebdavMessage('请先填写完整的 WebDAV 配置', true);
      restoreButton();
      return;
    }

    if (!confirm('确定要从远端恢复书签和配置吗？当前数据将被覆盖。')) {
      restoreButton();
      return;
    }

    showWebdavMessage('正在从远端拉取...');

    try {
      const client = new WebDAVClient(config);
      const result = await client.get('bookmark_inspector_backup.json');

      if (!result.success) {
        showWebdavMessage(result.message || '恢复失败', true);
        restoreButton();
        return;
      }

      const data = result.data;
      if (!data || !data.bookmarks) {
        showWebdavMessage('备份文件格式错误，缺少书签数据', true);
        restoreButton();
        return;
      }

      const existingBookmarks = await chrome.bookmarks.getTree();
      const rootNode = existingBookmarks[0];
      if (rootNode.children) {
        for (const topFolder of rootNode.children) {
          if (!topFolder.children) continue;
          for (const child of [...topFolder.children]) {
            try {
              await chrome.bookmarks.removeTree(child.id);
            } catch (error) {
              console.warn('删除旧书签失败:', error);
            }
          }
        }
      }

      const backupRoot = data.bookmarks[0];
      if (backupRoot && backupRoot.children) {
        for (const topFolder of backupRoot.children) {
          if (!topFolder.children) continue;
          for (const child of topFolder.children) {
            await importBookmarkItemFromBackup(child, topFolder.id);
          }
        }
      }

      if (data.settings) {
        await chrome.storage.local.set({ extensionSettings: data.settings });
      }
      if (data.checkResults || data.resultsById) {
        await chrome.storage.local.set({
          bookmarkCheckResults: data.checkResults || null,
          bookmarkResultsById: data.resultsById || {}
        });
      }

      await saveSyncInfo({
        remoteBackupAt: data.timestamp || '',
        lastPulledAt: new Date().toISOString()
      });

      showWebdavMessage('恢复成功，页面即将刷新');
      setTimeout(() => location.reload(), 600);
    } catch (error) {
      showWebdavMessage('恢复失败: ' + error.message, true);
    }

    restoreButton();
  });
});
