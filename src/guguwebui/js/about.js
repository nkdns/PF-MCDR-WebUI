document.addEventListener("DOMContentLoaded", function () {
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
        })
       .catch(error => console.error("查询失败:", error));
});
