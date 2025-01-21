// 全局可调用函数
// 自动区分是否在iframe中，如果在iframe中，则发送到父页面进行处理

// 区分是否在iframe中
function isInIframe() {
  try {
    return window.self!== window.top;
  } catch (e) {
    return true;
  }
}

// 消息弹窗
function showMessage({ type, content, autoCloseTime, title = '', icon = '' }) {
  if (!type || !content) {
    throw new Error("消息类型和消息内容是必填项");
  }

  // 定义颜色映射
  const typeColors = {
    提示: "#007BFF", // 蓝色
    警告: "#FFC107", // 黄色
    错误: "#DC3545", // 红色
    完成: "#28A745"  // 绿色
  };

  const color = typeColors[type];
  if (!color) {
    throw new Error("不支持的消息类型");
  }

  // 如果在嵌套页面中，递交给父页面执行
  if (window !== window.parent) {
    window.parent.postMessage({ action: 'showMessage', params: { type, content, autoCloseTime, title, icon } }, "*");
    return;
  }

  // 创建弹窗容器
  const popup = document.createElement("div");
  popup.className = "custom-popup";
  popup.style.cssText = `
    position: fixed;
    top: 10%;
    left: 50%;
    transform: translate(-50%, -60%) scale(0.8);
    background-color: white;
    border: 1px solid ${color};
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 20px;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.3s ease, transform 0.3s ease;
  `;

  // 创建标题容器
  if (title) {
    const titleContainer = document.createElement("div");
    titleContainer.style.cssText = `
      display: flex;
      align-items: center;
      margin-bottom: 10px;
    `;

    // 创建图标
    if (icon) {
      const popupIcon = document.createElement("img");
      popupIcon.src = icon;
      popupIcon.alt = "icon";
      popupIcon.style.cssText = `
        width: 24px;
        height: 24px;
        margin-right: 10px;
      `;
      titleContainer.appendChild(popupIcon);
    }

    // 创建标题文本
    const popupTitle = document.createElement("h3");
    popupTitle.textContent = title;
    popupTitle.style.cssText = `
      margin: 0;
      color: ${color};
      font-size: 18px;
    `;
    titleContainer.appendChild(popupTitle);

    popup.appendChild(titleContainer);
  }

  // 创建内容
  const popupContent = document.createElement("p");
  popupContent.textContent = content;
  popupContent.style.cssText = `
    margin: 0;
    font-size: 16px;
    text-align: center;
    color: #333;
  `;
  popup.appendChild(popupContent);

  // 创建按钮容器
  const buttonContainer = document.createElement("div");
  buttonContainer.style.cssText = "margin-top: 15px; text-align: center;";

  // 关闭函数
  function closePopup() {
    popup.style.opacity = "0";
    popup.style.transform = "translate(-50%, -60%) scale(0.8)";
    setTimeout(() => popup.remove(), 300);
  }

  // 自动关闭逻辑
  if (autoCloseTime) {
    setTimeout(closePopup, autoCloseTime);
  } else {
    // 创建关闭按钮
    const closeButton = document.createElement("button");
    closeButton.textContent = "关闭";
    closeButton.style.cssText = `
      padding: 8px 15px;
      margin-right: 10px;
      background-color: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    closeButton.addEventListener("click", closePopup);
    buttonContainer.appendChild(closeButton);

    // 创建确定按钮
    const confirmButton = document.createElement("button");
    confirmButton.textContent = "确定";
    confirmButton.style.cssText = `
      padding: 8px 15px;
      background-color: ${color};
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    confirmButton.addEventListener("click", closePopup);
    buttonContainer.appendChild(confirmButton);

    popup.appendChild(buttonContainer);
  }

  // 加入页面
  document.body.appendChild(popup);

  // 打开动画
  setTimeout(() => {
    popup.style.opacity = "1";
    popup.style.transform = "translate(-50%, -10%) scale(1)";
  }, 10);
}

// 父页面监听子页面请求并执行
window.addEventListener("message", (event) => {
  const { action, params } = event.data;
  if (action && typeof window[action] === "function") {
    window[action](params);
  }
});
