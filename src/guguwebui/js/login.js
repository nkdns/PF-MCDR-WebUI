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

    // 获取guguwebui插件信息
    fetch('/api/plugins?detail=true')
        .then(response => response.json())
        .then(data => {
            // 取plugins中id为guguwebui的插件信息
            const guguwebui = data.plugins.find(plugin => plugin.id === 'guguwebui');
            if (guguwebui) {
                const footer = document.querySelector('.footer');
                if (footer) {
                    footer.innerHTML = `WebUI版本: ${guguwebui.version}`;
                }
            }
        })
        .catch(error => console.error('获取插件信息失败:', error));
};
