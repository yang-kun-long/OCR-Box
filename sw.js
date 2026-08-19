// sw.js - MV3 Service Worker

// ===== 处理扩展图标点击事件 =====
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

function generateFakeId() {
  return 'xxxxxxxxxxxxxxxx'.replace(/[x]/g, function() {
    return (Math.random() * 16 | 0).toString(16);
  });
}

function normalizeCaptureQuality(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 92;

  const percentage = numericValue <= 1 ? numericValue * 100 : numericValue;
  return Math.min(100, Math.max(0, Math.round(percentage)));
}

// 监听来自 content.js 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request && request.type === "captureVisibleTab") {
    const windowId = sender.tab?.windowId;
    const options = {
      format: "jpeg",
      quality: normalizeCaptureQuality(request.quality)
    };

    const handleCapture = (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({
          ok: false,
          error: chrome.runtime.lastError?.message || "captureVisibleTab failed"
        });
      } else {
        sendResponse({ ok: true, dataUrl });
      }
    };

    if (Number.isInteger(windowId)) {
      chrome.tabs.captureVisibleTab(windowId, options, handleCapture);
    } else {
      chrome.tabs.captureVisibleTab(options, handleCapture);
    }
    return true;
  }

  if (request && request.type === "openOptionsPage") {
    chrome.runtime.openOptionsPage();
    return false;
  }

  // === 【新增】处理百度极速版请求 ===
  if (request && request.type === "perform_baidu_ocr") {
    // 必须返回 true，表示我们会异步发送响应
    handleBaiduOcr(request.base64).then(sendResponse);
    return true; 
  }
});

// 3. 网络请求逻辑 (运行在后台，不受 CORS 限制)
async function handleBaiduOcr(base64Image) {
  try {
    // A. 获取 Token
    const fakeUid = generateFakeId();
    // 注意：这里的请求会经过 rules.json 自动修改 Origin 头
    const tokenRes = await fetch("https://fastocr.lingduquan.com/ocr/flash", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "x-am": fakeUid, 
        "x-display": "json"
      },
      body: JSON.stringify({ "iam": fakeUid, "version": "1.2.8", "lang": "zh-CN" })
    });

    if (!tokenRes.ok) throw new Error("获取 Token 网络错误");
    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson?.data?.info?.token;

    if (!accessToken) throw new Error("鉴权失败 (未获取到 Token)");

    // B. 调用百度 API
    const baiduParams = new URLSearchParams();
    baiduParams.append("access_token", accessToken);
    baiduParams.append("image", base64Image); 
    baiduParams.append("language_type", "CHN_ENG");
    baiduParams.append("detect_direction", "true");

    const baiduRes = await fetch("https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: baiduParams
    });

    if (!baiduRes.ok) throw new Error("百度 API 请求失败");
    const resultJson = await baiduRes.json();

    if (resultJson.error_code) throw new Error("百度 API 报错: " + resultJson.error_msg);

    return { ok: true, data: resultJson };

  } catch (error) {
    console.error("Background OCR Error:", error);
    return { ok: false, error: error.message };
  }
}
