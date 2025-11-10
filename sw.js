// sw.js - MV3 Service Worker

// ===== 监听器 1: 处理来自 content.js 的所有消息 (修改) =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  
  // Case 1: 截图请求 (已有)
  if (msg && msg.type === "captureVisibleTab") {
    const quality = Math.round((msg.quality ?? 0.92) * 100); // 0~100
    chrome.tabs.captureVisibleTab(
      { format: "jpeg", quality },
      (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          sendResponse({
            ok: false,
            error: chrome.runtime.lastError?.message || "captureVisibleTab failed"
          });
        } else {
          sendResponse({ ok: true, dataUrl });
        }
      }
    );
    // 异步响应
    return true;
  }

  // Case 2: 打开选项页请求 (新增)
  if (msg && msg.type === "openOptionsPage") {
    chrome.runtime.openOptionsPage();
    // 这是一个同步操作，不需要 sendResponse，也不需要 return true
    return false;
  }

});


// ===== 监听器 2: 处理扩展图标点击事件 (已有) =====
chrome.action.onClicked.addListener(async (tab) => {
  // 当用户点击图标时，向当前页面的 content.js 发送消息
  try {
    // tab.id 是由 onClicked 事件自动提供的
    await chrome.tabs.sendMessage(tab.id, { type: "start_ocr_box" });
  } catch (e) {
    // 如果发送失败 (例如在 chrome://extensions 页面), 
    // 在图标上显示一个红色 "!" 提示用户
    console.warn(`无法在 Tab ${tab.id} 上启动 OCR Box: ${e.message}`);
    
    // 在当前 Tab 上显示徽章
    await chrome.action.setBadgeText({ text: '!', tabId: tab.id });
    await chrome.action.setBadgeBackgroundColor({ color: '#FF0000', tabId: tab.id });

    // 2秒后清除徽章
    setTimeout(async () => {
      await chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 2000);
  }
});