const DEFAULT_SETTINGS = {
  enableProxyRetry: false,
  proxyAddress: '',
  proxyPort: '',
  proxyType: 'http',
  threadsPerBatch: 10
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

document.addEventListener('DOMContentLoaded', async () => {
  const enableProxyRetry = document.getElementById('enableProxyRetry');
  const proxyAddress = document.getElementById('proxyAddress');
  const proxyPort = document.getElementById('proxyPort');
  const proxyType = document.getElementById('proxyType');
  const threadsPerBatch = document.getElementById('threadsPerBatch');
  const form = document.getElementById('settingsForm');

  try {
    const settings = await loadSettings();
    enableProxyRetry.checked = settings.enableProxyRetry;
    proxyAddress.value = settings.proxyAddress || '';
    proxyPort.value = settings.proxyPort || '';
    proxyType.value = settings.proxyType || 'http';
    threadsPerBatch.value = settings.threadsPerBatch || DEFAULT_SETTINGS.threadsPerBatch;
    toggleProxyFields(enableProxyRetry.checked);
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
      proxyType: proxyType.value,
      threadsPerBatch: threadCount
    };

    try {
      await chrome.storage.local.set({ extensionSettings: newSettings });
      showSettingsMessage('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      showSettingsMessage('保存失败，请重试', true);
    }
  });
});
