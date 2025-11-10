// options.js

/**
 * 将所有选项保存到 chrome.storage.sync
 */
function saveOptions() {
  const apiKey = document.getElementById('apiKey').value.trim();
  
  // 获取快捷键设置
  const hotkey_alt = document.getElementById('mod_alt').checked;
  const hotkey_ctrl = document.getElementById('mod_ctrl').checked;
  const hotkey_shift = document.getElementById('mod_shift').checked;
  const hotkey_key = document.getElementById('hotkey_key').value.trim();
  const ocrEngineSetting = document.getElementById('ocrEngine').value;

  const status = document.getElementById('status');

  // 检查快捷键是否为空
  if (!hotkey_key) {
    status.textContent = '错误：快捷键不能为空！';
    status.style.color = '#ef4444'; // 红色
    status.style.opacity = '1';
    setTimeout(() => { status.style.opacity = '0'; }, 2000);
    return;
  }

  // 检查是否至少选了一个修饰键 (可选，但推荐)
  if (!hotkey_alt && !hotkey_ctrl && !hotkey_shift) {
     status.textContent = '警告：建议至少选择一个修饰键 (Alt/Ctrl/Shift)';
     status.style.color = '#f59e0b'; // 黄色
  } else {
     status.textContent = '已保存 ✓';
     status.style.color = '#10b981'; // 绿色
  }

  chrome.storage.sync.set(
    { 
      ocrSpaceApiKey: apiKey,
      hotkey_alt: hotkey_alt,
      hotkey_ctrl: hotkey_ctrl,
      hotkey_shift: hotkey_shift,
      hotkey_key: hotkey_key,
      ocrEngineSetting: ocrEngineSetting
    },
    () => {
      // 保存成功后，显示状态提示
      if (chrome.runtime.lastError) {
        status.textContent = '保存失败!';
        status.style.color = '#ef4444';
      }
      
      status.style.opacity = '1';
      setTimeout(() => {
        status.style.opacity = '0';
      }, 1500);
    }
  );
}

/**
 * 页面加载时，从 chrome.storage.sync 恢复所有选项
 */
function restoreOptions() {
  // 设置默认值
  const defaultSettings = {
    ocrSpaceApiKey: "",
    hotkey_alt: true,
    hotkey_ctrl: false,
    hotkey_shift: false,
    hotkey_key: "0",
    ocrEngineSetting: "auto"
  };

  chrome.storage.sync.get(defaultSettings, (items) => {
    document.getElementById('apiKey').value = items.ocrSpaceApiKey;
    document.getElementById('mod_alt').checked = items.hotkey_alt;
    document.getElementById('mod_ctrl').checked = items.hotkey_ctrl;
    document.getElementById('mod_shift').checked = items.hotkey_shift;
    document.getElementById('hotkey_key').value = items.hotkey_key;
    document.getElementById('ocrEngine').value = items.ocrEngineSetting;
  });
}

// --- 修改：重构事件监听 ---
// 页面加载完成后，立即执行
document.addEventListener('DOMContentLoaded', () => {
  // 1. 恢复已保存的选项
  restoreOptions();

  // 2. 为“保存”按钮绑定点击事件
  document.getElementById('save').addEventListener('click', saveOptions);

  // 3. 为“显示/隐藏 API Key”复选框绑定事件
  const apiKeyInput = document.getElementById('apiKey');
  const showApiKeyCheckbox = document.getElementById('showApiKey');

  if (apiKeyInput && showApiKeyCheckbox) {
    showApiKeyCheckbox.addEventListener('change', () => {
      if (showApiKeyCheckbox.checked) {
        apiKeyInput.type = 'text';
      } else {
        apiKeyInput.type = 'password';
      }
    });
  }
});
// --- 结束修改 ---