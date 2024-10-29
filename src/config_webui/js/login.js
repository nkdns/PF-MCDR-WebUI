// 检查页面加载时是否有错误框
window.onload = function() {
    const errorBox = document.getElementById("errorBox");
    if (errorBox) {
        // 显示错误框
        errorBox.style.display = "block";
        // 15秒后隐藏错误框
        setTimeout(() => {
            errorBox.style.transition = "opacity 0.5s";
            errorBox.style.opacity = 0;
            setTimeout(() => errorBox.style.display = "none", 500);
        }, 15000);
    }
};