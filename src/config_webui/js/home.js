document.addEventListener("DOMContentLoaded", function() {
    // 获取插件状态
    fetch('/api/gugubot_plugins')
        .then(response => response.json())
        .then(data => {
            const statusList = document.getElementById("gugubot-status-list");

            // 按照 id 排序
            const sortedGugubotPlugins = data.gugubot_plugins.sort((a, b) => {
                if (a.id < b.id) return -1;
                if (a.id > b.id) return 1;
                return 0;
            });

            // 将未启用的插件放到末尾
            const enabledPlugins = sortedGugubotPlugins.filter(plugin => plugin.status);
            const disabledPlugins = sortedGugubotPlugins.filter(plugin => !plugin.status);
            const sortedPlugins = [...enabledPlugins, ...disabledPlugins];

            sortedPlugins.forEach(plugin => {
                const div = document.createElement("div");
                div.classList.add("plugin");
                div.classList.add(plugin.status ? 'run' : 'stop');
                div.id = plugin.id;
                div.onclick = () => toggleStatus(plugin.id);
                div.innerHTML = `<span>${plugin.name}</span><span>${plugin.status ? '运行中' : '已停止'}</span>`;
                statusList.appendChild(div);
            });
        })
        .catch(error => console.error('Error fetching gugubot plugins:', error));

    // 获取其他插件
    fetch('/api/plugins')
        .then(response => response.json())
        .then(data => {
            const pluginsDiv = document.getElementById("plugins");

            // 按照 id 排序
            const sortedPlugins = data.plugins.sort((a, b) => {
                if (a.id < b.id) return -1;
                if (a.id > b.id) return 1;
                return 0;
            });

            // 将未启用的插件放到末尾
            const enabledPlugins = sortedPlugins.filter(plugin => plugin.status);
            const disabledPlugins = sortedPlugins.filter(plugin => !plugin.status);
            const finalPluginsList = [...enabledPlugins, ...disabledPlugins];

            finalPluginsList.forEach(plugin => {
                const div = document.createElement("div");
                div.classList.add("plugin");
                div.classList.add(plugin.status ? 'run' : 'stop');
                div.id = plugin.id;
                div.onclick = () => toggleStatus(plugin.id);
                div.innerHTML = `<span>${plugin.name}</span><span>${plugin.status ? '运行中' : '已停止'}</span>`;
                pluginsDiv.appendChild(div);
            });
        })
        .catch(error => console.error('Error fetching plugins:', error));
});

function toggleStatus(pluginId) {
    const plugin = document.getElementById(pluginId);
    const status = plugin.classList.contains('run');
    plugin.classList.toggle('run', !status);
    plugin.classList.toggle('stop', status);
    
    fetch(`/api/toggle_plugin&plugin_id=${pluginId}&status=${!status}`)
        .then(response => response.json())
        .then(data => {
            // 更新状态
            if (pluginId === 'gugubot' || pluginId === 'cq-qq-api') {
                if (data.status) {
                    plugin.classList.toggle('run', status);
                    plugin.classList.toggle('stop', !status);
                    plugin.querySelector('span:nth-child(2)').textContent = '运行中';
                }
            } else {
                if (data.status == 'error') {
                    alert(data.message);
                    plugin.classList.toggle('run', status);
                    plugin.classList.toggle('stop', !status);
                } else if (data.status == 'success') {
                    const statusText = !status ? '运行中' : '已停止';
                    plugin.querySelector('span:nth-child(2)').textContent = statusText;
                }
            }
            sortPlugins('gugubot-status-list'); // 调用排序函数
            sortPlugins('plugins');
        })
        .catch(error => console.error('Error toggling plugin:', error));
}

function sortPlugins(pluginLists) {
    const pluginList = document.getElementById(pluginLists);
    const plugins = Array.from(pluginList.children);

    // 将 GUGUbot 和 cq-qq-api 分开
    const fixedPlugins = plugins.filter(plugin => plugin.id === 'gugubot' || plugin.id === 'cq-qq-api');
    const otherPlugins = plugins.filter(plugin => plugin.id !== 'gugubot' && plugin.id !== 'cq-qq-api');

    // 按状态和 ID 对其他插件排序
    otherPlugins.sort((a, b) => {
        const aStatus = a.classList.contains('run') ? 0 : 1; // 运行中排在前面
        const bStatus = b.classList.contains('run') ? 0 : 1;

        // 如果状态相同，按 ID 排序
        if (aStatus === bStatus) {
            return a.id.localeCompare(b.id);
        }
        return aStatus - bStatus;
    });

    // 清空插件列表并重新插入
    pluginList.innerHTML = '';
    fixedPlugins.forEach(plugin => pluginList.appendChild(plugin));
    otherPlugins.forEach(plugin => pluginList.appendChild(plugin));
}

function saveWebConfig(action) {
    // 创建请求体
    const requestData = {
        action: action,
    };

    // 根据不同的按钮，决定是否传递其他参数
    if (action === 'config') {
        const port = document.getElementById('port').value;
        const superaccount = document.getElementById('disable_admin_login_after_run').value;

        requestData.port = port;
        requestData.superaccount = superaccount;
    }

    fetch("/api/save_web_config", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // 根据不同的按钮操作切换状态
            if (action === 'disable_admin_login_web') {
                const btn = document.getElementById(action);
                btn.classList.toggle('disabled');
                btn.textContent = btn.classList.contains('disabled') ? '点击启用' : '点击禁用';
            } else if (action === 'enable_temp_login_password') {
                const btn = document.getElementById(action);
                btn.classList.toggle('disabled');
                btn.textContent = btn.classList.contains('disabled') ? '点击启用' : '点击禁用';
            }
        } else {
            console.error('操作失败: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        // alert('请求失败，请稍后重试');
    });
}