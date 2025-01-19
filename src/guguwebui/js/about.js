// 监听主题变化
window.addEventListener('message', (event) => {
  if (event.data.type === 'theme-change') {
    document.body.classList.remove('light', 'dark', 'auto');
    document.body.classList.add(event.data.theme);
  }
});

document.addEventListener("DOMContentLoaded", function () {
  // 初始化主题
  const savedTheme = localStorage.getItem('guguwebui-theme') || 'auto';
  document.body.classList.add(savedTheme);
    // 获取插件状态
    fetch('/api/gugubot_plugins') 
        .then(response => response.json())
        .then(data => {
            // 查找 id 为 'gugubot' 的插件
            const gugubotPlugin = data.gugubot_plugins.find(plugin => plugin.id === 'gugubot');
            const gugubot_version = document.getElementById('gugubot-version');
            if (gugubotPlugin) {
                gugubot_version.innerText = `版本: ${gugubotPlugin.version}`;
            } else {
                gugubot_version.innerText = "版本: 未安装";
                console.log("GUGUbot 插件未找到。");
            }

            // 查找 id 为 'cq_qq_api' 的插件
            const cq_qq_apiPlugin = data.gugubot_plugins.find(plugin => plugin.id === 'cq_qq_api');
            const cq_qq_api_version = document.getElementById('cq-qq-api-version');
            if (cq_qq_apiPlugin) {
                cq_qq_api_version.innerText = `版本: ${cq_qq_apiPlugin.version}`;
            } else {
                cq_qq_api_version.innerText = "版本: 未安装";
                console.log("CQ-QQ-API 插件未找到。");
            }
        });

    // 获取guguwebui插件信息
    fetch('/api/plugins?detail=true')
        .then(response => response.json())
        .then(data => {
            // 取plugins中id为guguwebui的插件信息
            const guguwebui = data.plugins.find(plugin => plugin.id === 'guguwebui');
            const webVersion = document.getElementById('web-version');
            webVersion.innerText = `版本: ${guguwebui.version}`;
        })
        .catch(error => console.error("获取插件信息失败:", error));
});
