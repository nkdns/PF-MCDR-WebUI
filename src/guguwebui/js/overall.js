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


// 显示消息弹窗

// type: 提示/警告/错误/完成
// content: 消息内容
// autoCloseTime: 自动关闭时间，单位：毫秒，如果为0则不自动关闭
// title: 弹窗标题
// icon: 弹窗图标

// 返回值：调用示例
// showMessage({ type: "提示", content: "是否继续操作？", title: "确认操作" })
//   .then((result) => {
//     console.log("用户选择：", result); // true 或 false
//   });

function showMessage({ type, content, autoCloseTime, title = '', icon = '' }) {
  if (!type || !content) {
    throw new Error("消息类型和消息内容是必填项");
  }

  const typeColors = {
    提示: "#007BFF",
    警告: "#FFC107",
    错误: "#DC3545",
    完成: "#28A745"
  };

  const color = typeColors[type];
  if (!color) {
    throw new Error("不支持的消息类型");
  }

  if (window !== window.parent) {
    return new Promise((resolve) => {
      const messageId = `msg_${Date.now()}`;
      window.parent.postMessage(
        { action: 'showMessage', params: { type, content, autoCloseTime, title, icon, messageId } },
        "*"
      );

      function handleMessage(event) {
        const { action, result, messageId: returnedId } = event.data;
        if (action === 'showMessageResult' && returnedId === messageId) {
          window.removeEventListener("message", handleMessage);
          resolve(result);
        }
      }
      window.addEventListener("message", handleMessage);
    });
  }

  return new Promise((resolve) => {
    // 创建遮罩层
    const overlay = document.createElement("div");
    overlay.className = "custom-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 9998;
    `;
    document.body.appendChild(overlay);

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

    if (title) {
      const titleContainer = document.createElement("div");
      titleContainer.style.cssText = `
        display: flex;
        align-items: center;
        margin-bottom: 10px;
      `;

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

    const popupContent = document.createElement("p");
    popupContent.textContent = content;
    popupContent.style.cssText = `
      margin: 0;
      font-size: 16px;
      text-align: center;
      color: #333;
    `;
    popup.appendChild(popupContent);

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = "margin-top: 15px; text-align: center;";

    function closePopup(result) {
      popup.style.opacity = "0";
      popup.style.transform = "translate(-50%, -60%) scale(0.8)";
      overlay.style.opacity = "0";
      setTimeout(() => {
        popup.remove();
        overlay.remove();
        resolve(result);
      }, 300);
    }

    if (autoCloseTime) {
      setTimeout(() => closePopup(null), autoCloseTime);
    } else {
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
      closeButton.addEventListener("click", () => closePopup(false));
      buttonContainer.appendChild(closeButton);

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
      confirmButton.addEventListener("click", () => closePopup(true));
      buttonContainer.appendChild(confirmButton);

      popup.appendChild(buttonContainer);
    }

    document.body.appendChild(popup);

    setTimeout(() => {
      popup.style.opacity = "1";
      popup.style.transform = "translate(-50%, -10%) scale(1)";
    }, 10);
  });
}

window.addEventListener("message", (event) => {
  const { action, params } = event.data;
  if (action === 'showMessage') {
    showMessage(params).then((result) => {
      event.source.postMessage(
        { action: 'showMessageResult', result, messageId: params.messageId },
        "*"
      );
    });
  }
});
