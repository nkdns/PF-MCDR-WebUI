document.addEventListener("DOMContentLoaded", function () {
    // 获取插件状态
    fetch('/api/gugubot_plugins') 
        .then(response => response.json())
        .then(data => {
            // 查找 id 为 'gugubot' 的插件
            const gugubotPlugin = data.gugubot_plugins.find(plugin => plugin.id === 'gugubot');
            if (gugubotPlugin) {
                const gugubot_version = document.getElementById('gugubot-version');
                gugubot_version.innerText = `版本: ${gugubotPlugin.version}`;
            } else {
                console.log("GUGUbot 插件未找到。");
            }

            // 查找 id 为 'cq_qq_api' 的插件
            const cq_qq_apiPlugin = data.gugubot_plugins.find(plugin => plugin.id === 'cq_qq_api');
            if (cq_qq_apiPlugin) {
                const cq_qq_api_version = document.getElementById('cq-qq-api-version');
                cq_qq_api_version.innerText = `版本: ${cq_qq_apiPlugin.version}`;
            } else {
                console.error("CQ-QQ-API 插件未找到。");
            }
        })
       .catch(error => console.error("查询失败:", error));
});
