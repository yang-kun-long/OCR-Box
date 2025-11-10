// content.js
(() => {
  // ===== 修改点 START (1/3): API 常量配置 =====
  
  // 1. 移除了硬编码的 OCR_SPACE_API_KEY 和 HOTKEY
  
  // 2. 设置 ocr.space 识别参数
  const OCR_SPACE_LANG = "chs"; // "chs" (简体中文), "eng" (英文), "jpn" (日文), "kor" (韩文)
  const OCR_SPACE_OVERLAY = "false"; // 是否需要文字坐标，"true" 或 "false"

  // 3. 保留的 JPEG 参数
  const IMAGE_TYPE = "image/jpeg";
  const JPEG_QUALITY = 0.92;
  // ===== 修改点 END (1/3) =====


  // ===== 新增：快捷键配置 =====
  let settings = {
    hotkey_alt: true,
    hotkey_ctrl: false,
    hotkey_shift: false,
    hotkey_key: "0",
    ocrEngineSetting: "auto" // <-- 新增这行
  };

// 1. 脚本加载时，获取所有存储的设置
  chrome.storage.sync.get(settings, (items) => {
    settings = items; // 用存储的值覆盖默认值
    console.log("OCR Box settings loaded:", settings);
  });

  // 2. 监听设置变化，实时更新
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      let changedKeys = false;
      for (let key in changes) {
        if (settings.hasOwnProperty(key)) {
          settings[key] = changes[key].newValue;
          changedKeys = true;
        }
      }
      if (changedKeys) {
        console.log("OCR Box settings updated:", settings);
      }
    }
  });
  // ===== 快捷键配置结束 =====


  // ===== 小工具：提示与结果窗 =====
  // --- 修改：toast 函数现在支持 HTML 元素和更长的显示时间 ---
  const toast = (m, ok = true) => {
    const d = document.createElement("div");
    
    if (typeof m === 'string') {
      d.textContent = m;
    } else {
      d.appendChild(m); // 允许传入 HTML 元素 (例如带链接的提示)
    }
    
    Object.assign(d.style, {
      position: "fixed",
      right: "16px",
      top: "16px",
      zIndex: 2147483647,
      background: ok ? "rgba(16,185,129,.95)" : "rgba(239,68,68,.95)",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: "8px",
      fontSize: "12px",
      boxShadow: "0 6px 18px rgba(0,0,0,.25)"
    });
    document.body.appendChild(d);
    // 错误/操作提示显示得更久
    setTimeout(() => d.remove(), ok ? 2200 : 4500);
  };
  // --- 结束修改 ---

  // ===== 美化后的结果窗，增大字体 + 复制按钮 =====
  const showResult = (text) => {
    // 注入一次性样式（仅含动画）
    (function ensureStyles() {
      if (document.getElementById("ocr-result-styles")) return;
      const style = document.createElement("style");
      style.id = "ocr-result-styles";
      style.textContent = `
        @keyframes ocrPop {
          0% { transform: translateY(8px) scale(.98); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    })();

    // 渐变描边外壳
    const shell = document.createElement("div");
    shell.id = "ocr-result-shell-container"; 
    Object.assign(shell.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: 2147483647,
      padding: "1px",
      borderRadius: "14px",
      background: "linear-gradient(135deg,#a78bfa 0%,#60a5fa 50%,#34d399 100%)",
      boxShadow: "0 16px 50px rgba(0,0,0,.18)",
      animation: "ocrPop .18s ease-out"
    });

    // 主容器（默认浅色）
    const w = document.createElement("div");
    w.setAttribute("data-ocr", "result");
    w.setAttribute("data-theme", "light"); // 默认浅色，可切换为 dark
    Object.assign(w.style, {
      width: "min(620px,62vw)",
      height: "min(360px,46vh)",
      borderRadius: "13px",
      overflow: "hidden",
      display: "grid",
      gridTemplateRows: "48px 1fr",
      background: "rgba(255,255,255,.92)",
      backdropFilter: "saturate(140%) blur(6px)",
      border: "1px solid rgba(0,0,0,.06)",
      color: "#0b1220"
    });

    // 根据主题切换颜色
    const applyTheme = () => {
      const dark = w.getAttribute("data-theme") === "dark";
      w.style.background = dark ? "rgba(24,26,33,.82)" : "rgba(255,255,255,.92)";
      w.style.border = dark ? "1px solid rgba(255,255,255,.06)" : "1px solid rgba(0,0,0,.06)";
      w.style.color = dark ? "#f3f4f6" : "#0b1220";
      bar.style.background = dark
        ? "linear-gradient(180deg,rgba(47,49,57,.95),rgba(36,38,45,.95))"
        : "linear-gradient(180deg,rgba(248,250,252,.95),rgba(241,245,249,.95))";
      title.style.color = dark ? "rgba(255,255,255,.9)" : "rgba(15,23,42,.9)";
      ta.style.background = dark ? "rgba(16,18,24,.55)" : "rgba(255,255,255,.7)";
      ta.style.color = dark ? "#eaeef7" : "#0b1220";
      ta.style.border = dark ? "1px solid rgba(255,255,255,.10)" : "1px solid rgba(0,0,0,.06)";
      const borderColor = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)";
      settingsBtn.style.borderColor = borderColor; // <-- 新增这行 (变量在下面定义)
      nextBtn.style.borderColor = borderColor;
      copyBtn.style.borderColor = borderColor;
      themeBtn.style.borderColor = borderColor;
    };

    // 顶栏：标题 + 操作
    const bar = document.createElement("div");
    Object.assign(bar.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 10px 0 14px",
      borderBottom: "1px solid rgba(0,0,0,.06)",
      userSelect: "none",
      cursor: "pointer"
    });
    const title = document.createElement("div");
    title.textContent = "OCR 结果（点击此栏关闭 / ESC）";
    Object.assign(title.style, { fontSize: "12px", letterSpacing: ".2px" });

    const ops = document.createElement("div");
    Object.assign(ops.style, { display: "flex", alignItems: "center", gap: "8px", cursor: "default" });

    const mkBtn = (label) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      Object.assign(btn.style, {
        height: "30px",
        padding: "0 10px",
        borderRadius: "9px",
        border: "1px solid rgba(0,0,0,.12)",
        background: "rgba(255,255,255,.35)",
        fontSize: "12px",
        color: "inherit",
        letterSpacing: ".2px",
        cursor: "pointer",
        transition: "transform .06s ease, background .2s ease, border-color .2s ease, opacity .2s",
        backdropFilter: "blur(2px)"
      });
      btn.onmouseenter = () => { btn.style.opacity = "0.9"; };
      btn.onmouseleave = () => { btn.style.opacity = "1"; };
      btn.onmousedown = () => { btn.style.transform = "scale(.98)"; };
      btn.onmouseup = () => { btn.style.transform = "scale(1)"; };
      return btn;
    };
    // --- 新增：设置按钮 ---
    const settingsBtn = mkBtn("设置");
    settingsBtn.addEventListener("click", (ev) => {
      ev.stopPropagation(); // 防止触发顶栏的关闭事件
      // 发送消息给 sw.js 来打开选项页
      chrome.runtime.sendMessage({ type: "openOptionsPage" });
    });

    // --- 新增：下一张按钮 ---
    const nextBtn = mkBtn("下一张");
    nextBtn.addEventListener("click", (ev) => {
      ev.stopPropagation(); // 防止触发顶栏的关闭事件
      // startBox() 函数内部已经包含了关闭旧结果窗的逻辑
      startBox(); 
    });
    // --- 结束新增 ---

    // 复制
    const copyBtn = mkBtn("复制");
    // 主题切换
    const themeBtn = mkBtn("浅/深");
    themeBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const cur = w.getAttribute("data-theme");
      w.setAttribute("data-theme", cur === "light" ? "dark" : "light");
      applyTheme();
    });

    copyBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(ta.value);
        } else {
          ta.focus(); ta.select(); document.execCommand("copy"); ta.setSelectionRange(0, 0); ta.blur();
        }
        copyBtn.textContent = "已复制 ✓";
        copyBtn.style.borderColor = "rgba(16,185,129,.7)";
        setTimeout(() => { copyBtn.textContent = "复制"; applyTheme(); }, 1200);
      } catch {
        copyBtn.textContent = "复制失败";
        copyBtn.style.borderColor = "rgba(239,68,68,.7)";
        setTimeout(() => { copyBtn.textContent = "复制"; applyTheme(); }, 1200);
      }
    });

    // --- 修改：添加 nextBtn ---
    ops.append(settingsBtn, nextBtn, copyBtn, themeBtn);
    bar.append(title, ops);
    // --- 结束修改 ---

    // 文本区域（更大字体 + 柔和背景）
    const ta = document.createElement("textarea");
    ta.readOnly = true;
    ta.value = text;
    Object.assign(ta.style, {
      width: "100%",
      height: "100%",
      padding: "16px",
      border: "1px solid rgba(0,0,0,.06)",
      borderRadius: "10px",
      margin: "10px",
      outline: "none",
      background: "rgba(255,255,255,.7)",
      color: "#0b1220",
      fontFamily: "ui-monospace,Menlo,Consolas,monospace",
      fontSize: "15px",
      lineHeight: "1.65",
      whiteSpace: "pre-wrap",
      resize: "both",
      minWidth: "340px",
      minHeight: "180px",
      boxShadow: "inset 0 1px 2px rgba(0,0,0,.06)"
    });

    const close = () => shell.remove();
    bar.onclick = close;
    function onEsc(e) { if (e.key === "Escape") { close(); window.removeEventListener("keydown", onEsc); } }
    window.addEventListener("keydown", onEsc);

    w.append(bar, ta);
    shell.appendChild(w);
    document.body.appendChild(shell);
    applyTheme(); // 按当前主题渲染
  };



  // ===== 关键：为“fixed 选框”做 transform/zoom 矫正 =====
  function applyViewportCorrection(overlay) {
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.transform = "none";
    overlay.style.transformOrigin = "0 0";
    overlay.style.visibility = "hidden";
    document.documentElement.appendChild(overlay);

    // 探针
    const probe = document.createElement("div");
    Object.assign(probe.style, { position: "fixed", left: "0", top: "0", width: "1px", height: "1px", pointerEvents: "none" });
    overlay.appendChild(probe);

    const r = overlay.getBoundingClientRect();
    const dx = r.left;
    const dy = r.top;
    const sx = window.innerWidth / r.width;
    const sy = window.innerHeight / r.height;

    overlay.style.transform = `translate(${-dx}px, ${-dy}px) scale(${sx}, ${sy})`;
    overlay.style.visibility = "visible";
    return { sx, sy, dx, dy };
  }

  // ===== 后台截图并按选框裁剪（高成功率） =====
  async function captureAndCrop(rectAbs, quality = JPEG_QUALITY) {
    // rectAbs: 以 viewport client 坐标为基准的矩形 {x,y,w,h}
    const resp = await chrome.runtime.sendMessage({ type: "captureVisibleTab", quality });
    if (!resp?.ok) throw new Error(resp?.error || "captureVisibleTab failed");

    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = resp.dataUrl;
    });

    // 可见截图像素尺寸 与 viewport client 尺寸 的映射
    // 在高 DPI/缩放场景下，img.width 通常 ≈ window.innerWidth * devicePixelRatio
    const ratioX = img.width  / window.innerWidth;
    const ratioY = img.height / window.innerHeight;

    const sx = Math.max(0, Math.round(rectAbs.x * ratioX));
    const sy = Math.max(0, Math.round(rectAbs.y * ratioY));
    const sw = Math.max(1, Math.round(rectAbs.w * ratioX));
    const sh = Math.max(1, Math.round(rectAbs.h * ratioY));

    // 先把整张截图画到画布（可选，用于 debug 或后续标注）
    const stage = document.createElement("canvas");
    stage.width = img.width;
    stage.height = img.height;
    stage.getContext("2d").drawImage(img, 0, 0);

    // 再裁剪指定区域
    const cut = document.createElement("canvas");
    cut.width = sw;
    cut.height = sh;
    cut.getContext("2d").drawImage(stage, sx, sy, sw, sh, 0, 0, sw, sh);

    return cut;
  }

  
  // ===== 修改点 START (2/3): 上传 OCR (完全重构) =====
  async function uploadAndOcr(canvas) {
    
    // 1. 获取 API Key
    let userApiKey;
    try {
      // 注意：API Key 仍然是独立存储的
      const storageData = await chrome.storage.sync.get("ocrSpaceApiKey");
      userApiKey = storageData.ocrSpaceApiKey;
    } catch (e) {
      console.error("无法读取 chrome.storage:", e);
      toast("读取插件存储失败", false);
      return;
    }

    // 2. 检查 Key 是否存在 (这部分逻辑不变，包含带链接的 toast)
    if (!userApiKey) {
      const msgContainer = document.createElement('div');
      msgContainer.appendChild(document.createTextNode('未找到 API Key。请 '));
      const link = document.createElement('a');
      link.textContent = '点击此处';
      link.href = '#';
      Object.assign(link.style, { color: '#fff', textDecoration: 'underline', fontWeight: 'bold', cursor: 'pointer' });
      link.onclick = (e) => { e.preventDefault(); chrome.runtime.sendMessage({ type: "openOptionsPage" }); };
      msgContainer.appendChild(link);
      msgContainer.appendChild(document.createTextNode(' 立即设置。'));
      toast(msgContainer, false);
      return; // 中止执行
    }
    
    // 3. 转换为 Base64
    const base64DataUrl = canvas.toDataURL(IMAGE_TYPE, JPEG_QUALITY);

    // 4. (新增) 定义一个可重用的、带超时的 fetch 辅助函数
    const performFetch = async (engine) => {
        const fd = new FormData();
        fd.append("apikey", userApiKey);
        fd.append("base64Image", base64DataUrl);
        fd.append("language", OCR_SPACE_LANG);
        fd.append("OCREngine", engine); // 使用传入的引擎
        fd.append("isOverlayRequired", OCR_SPACE_OVERLAY);
        
        const url = "https://api.ocr.space/parse/image";
        
        // 关键：添加 10 秒超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 秒

        const res = await fetch(url, {
            method: "POST",
            body: fd,
            cache: "no-store",
            signal: controller.signal // 关联超时控制器
        });
        
        clearTimeout(timeoutId); // 成功则清除超时

        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        
        const json = await res.json();
        
        // API 返回的内部错误
        if (json.IsErroredOnProcessing) {
            throw new Error(json.ErrorMessage.join(" ") || "OCR.space API Error");
        }
        // API 成功但没结果
        if (!json.ParsedResults || json.ParsedResults.length === 0) {
            throw new Error("API 返回了空结果 (未识别到文本)");
        }
        return json;
    };

    // 5. 根据用户设置执行 OCR
    let t0 = performance.now();
    const userChoice = settings.ocrEngineSetting; // 从全局 settings 读取

    try {
      let jsonResult;
      let engineUsed;

      if (userChoice === "1") {
        toast("正在上传识别 (引擎1)...");
        jsonResult = await performFetch("1");
        engineUsed = "1";

      } else if (userChoice === "2") {
        toast("正在上传识别 (引擎2)...");
        jsonResult = await performFetch("2");
        engineUsed = "2";

      } else { 
        // 默认 "auto" 模式
        toast("正在上传识别 (引擎2)...");
        try {
          // 5a. 优先尝试引擎 2
          jsonResult = await performFetch("2");
          engineUsed = "2";
        } catch (e1) {
          // 5b. 引擎 2 失败，自动备援
          console.warn(`[OCR] 自动备援: 引擎 2 失败: ${e1.message}。正在尝试引擎 1...`);
          
          // 如果是 API Key 错误，则不重试，直接抛出
          if (e1.message.includes("Invalid API Key") || e1.message.includes("E207")) {
            throw e1; 
          }

          // 提示用户正在重试
          if (e1.name === 'AbortError') { // AbortError 是超时的错误名
            toast("引擎 2 请求超时，自动切换引擎 1...", false);
          } else if (e1.message.includes("E208")) {
             toast("引擎 2 服务器错误(E208)，自动切换引擎 1...", false);
          } else {
             toast("引擎 2 失败，自动切换引擎 1...", false);
          }
          
          // 5c. 尝试引擎 1
          t0 = performance.now(); // 重置计时器
          jsonResult = await performFetch("1");
          engineUsed = "1";
        }
      }
      
      // 6. 统一处理成功结果
      const text = jsonResult.ParsedResults[0].ParsedText;
      const dt = performance.now() - t0;
      showResult(text || "（未识别到文本）");
      toast(`识别完成 (引擎${engineUsed}) (${dt.toFixed(0)} ms）`, true);

    } catch (err) {
      // 7. 统一处理最终失败 (包括重试失败)
      console.error("[OCR] 最终识别失败:", err);
      
      if (err.name === 'AbortError') {
        toast("OCR 请求超时 (10秒)。", false);
      } else if (err.message.includes("Invalid API Key") || err.message.includes("E207")) {
        toast("API Key 无效或已过期。请在“选项”页中更新。", false);
      } else if (err.message.includes("E208")) {
        toast("OCR 服务器内部错误 (E208)，请稍后再试。", false);
      } else if (err.message.includes("File size") || err.message.includes("E209")) {
        toast("截屏文件太大，请截取较小区域。", false);
      } else {
        toast(`OCR 失败: ${err.message}`, false);
      }
    }
  }

  // ===== 修改点 END (2/3) =====


  // ===== 修改点 START (3/3): 启动框选 (快捷键监听) =====
  window.addEventListener("keydown", async (e) => {
    
    // 使用从 storage 加载的动态配置进行判断
    // --- 修改：从 hotkeySettings 改为 settings ---
    const hotkeyMatches = 
      e.altKey   === settings.hotkey_alt &&
      e.ctrlKey  === settings.hotkey_ctrl &&
      e.shiftKey === settings.hotkey_shift &&
      e.key.toLowerCase() === settings.hotkey_key.toLowerCase();
      
    if (hotkeyMatches && settings.hotkey_key !== "") {
    // --- 结束修改 ---
      e.preventDefault();
      
      // --- 新增：防重入检查 ---
      // 检查是否已有一个截图框在运行
      if (document.querySelector("[ocr-overlay='1']")) {
        console.log("OCR Box is already active.");
        return; 
      }
      // --- 结束新增 ---

      startBox();
    }
  });
  // ===== 修改点 END (3/3) =====


  // ===== 框选 UI 与交互 =====
  async function startBox() {
    // --- 新增：关闭上一个结果窗 ---
    const prevResult = document.getElementById("ocr-result-shell-container");
    if (prevResult) {
      prevResult.remove();
    }
    // --- 结束新增 ---

    // 遮罩
    const overlay = document.createElement("div");
    overlay.setAttribute("ocr-overlay", "1");
    Object.assign(overlay.style, { zIndex: 2147483646, cursor: "crosshair" });

    // 十字线
    const hline = document.createElement("div"), vline = document.createElement("div");
    Object.assign(hline.style, { position: "fixed", left: 0, width: "100vw", height: "1px", background: "rgba(255,255,255,.6)", pointerEvents: "none", display: "none", zIndex: 2147483647 });
    Object.assign(vline.style, { position: "fixed", top: 0, height: "100vh", width: "1px", background: "rgba(255,255,255,.6)", pointerEvents: "none", display: "none", zIndex: 2147483647 });
    overlay.append(hline, vline);

    // 暗化四周
    const dimTop = mkDim(), dimLeft = mkDim(), dimRight = mkDim(), dimBottom = mkDim();
    overlay.append(dimTop, dimLeft, dimRight, dimBottom);
    function mkDim() { const d = document.createElement("div"); Object.assign(d.style, { position: "fixed", background: "rgba(0,0,0,.38)", pointerEvents: "none", zIndex: 2147483646 }); return d; }
    function placeDims(r) {
      dimTop.style.left = "0px"; dimTop.style.top = "0px";
      dimTop.style.width = "100vw"; dimTop.style.height = r ? `${r.y}px` : "100vh";
      dimLeft.style.left = "0px"; dimLeft.style.top = r ? `${r.y}px` : "0px";
      dimLeft.style.width = r ? `${r.x}px` : "0px"; dimLeft.style.height = r ? `${r.h}px` : "0px";
      dimRight.style.left = r ? `${r.x + r.w}px` : "100vw";
      dimRight.style.top = r ? `${r.y}px` : "0px";
      dimRight.style.width = r ? `calc(100vw - ${r.x + r.w}px)` : "0px";
      dimRight.style.height = r ? `${r.h}px` : "0px";
      dimBottom.style.left = "0px"; dimBottom.style.top = r ? `${r.y + r.h}px` : "0px";
      dimBottom.style.width = "100vw"; dimBottom.style.height = r ? `calc(100vh - ${r.y + r.h}px)` : "0px";
    }

    // 选框
    const box = document.createElement("div");
    Object.assign(box.style, { position: "fixed", outline: "2px solid #4ade80", boxSizing: "border-box", pointerEvents: "none", display: "none", zIndex: 2147483647 });
    overlay.appendChild(box);

    // 标注尺寸
    const tag = document.createElement("div");
    Object.assign(tag.style, { position: "fixed", padding: "2px 6px", fontSize: "12px", background: "rgba(17,24,39,.95)", color: "#fff", borderRadius: "4px", pointerEvents: "none", display: "none", zIndex: 2147483647 });
    overlay.appendChild(tag);

    // 应用矫正
    applyViewportCorrection(overlay);

    // 禁止文本选择
    const prevSel = document.body.style.userSelect; document.body.style.userSelect = "none";
    toast("按下设置左上角 → 拖到右下角；ESC 取消。");

    let start = null, rectAbs = null, dragging = false;

    function cleanup() {
      overlay.remove();
      document.body.style.userSelect = prevSel;
      window.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") cleanup(); }

    overlay.addEventListener("mousemove", (e) => {
      // 十字线跟随鼠标（使用 client 坐标）
      hline.style.top = e.clientY + "px";
      vline.style.left = e.clientX + "px";
      hline.style.display = vline.style.display = "block";

      if (!dragging || !start) return;
      const cx = Math.max(e.clientX, start.absX);
      const cy = Math.max(e.clientY, start.absY);
      rectAbs = { x: start.absX, y: start.absY, w: cx - start.absX, h: cy - start.absY };

      Object.assign(box.style, { left: rectAbs.x + "px", top: rectAbs.y + "px", width: rectAbs.w + "px", height: rectAbs.h + "px", display: "block" });
      placeDims({ x: rectAbs.x, y: rectAbs.y, w: rectAbs.w, h: rectAbs.h });
      Object.assign(tag.style, { left: (rectAbs.x + rectAbs.w + 8) + "px", top: (rectAbs.y + rectAbs.h + 8) + "px", display: "block" });
      tag.textContent = `${rectAbs.w} × ${rectAbs.h}`;
    });

    overlay.addEventListener("mousedown", (e) => {
      const r = overlay.getBoundingClientRect(); // 未直接使用，仅保留以防后续扩展
      start = { absX: e.clientX, absY: e.clientY };
      dragging = true;
      rectAbs = { x: start.absX, y: start.absY, w: 0, h: 0 };
      Object.assign(box.style, { left: rectAbs.x + "px", top: rectAbs.y + "px", width: "0px", height: "0px", display: "block" });
      placeDims({ x: rectAbs.x, y: rectAbs.y, w: 0, h: 0 });
      Object.assign(tag.style, { left: (rectAbs.x + 8) + "px", top: (rectAbs.y + 8) + "px", display: "block" });
    });

    overlay.addEventListener("mouseup", async () => {
      if (!dragging) return; dragging = false;
      if (!rectAbs || rectAbs.w < 2 || rectAbs.h < 2) { cleanup(); return; }
      try {
        // 先移除遮罩，确保截图不包含遮罩元素
        overlay.remove();
        const cut = await captureAndCrop(rectAbs, JPEG_QUALITY);
        await uploadAndOcr(cut);
      } catch (err) {
        console.error("[OCR] capture/crop failed:", err);
        toast("截图失败（captureVisibleTab）", false);
      } finally { cleanup(); }
    });

    window.addEventListener("keydown", onKey, { passive: false });
  }

  // ===== 新增：监听来自 Service Worker (icon click) 的消息 =====
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "start_ocr_box") {
      
      // --- 新增：防重入检查 ---
      // 检查是否已有一个截图框在运行
      if (document.querySelector("[ocr-overlay='1']")) {
        console.log("OCR Box is already active.");
        sendResponse({ ok: false, error: "Already active" });
        return; 
      }
      // --- 结束新增 ---

      startBox();
      sendResponse({ ok: true }); // 告知 sw.js 消息已收到
    }
  });
  // ===== 消息监听结束 =====

})();