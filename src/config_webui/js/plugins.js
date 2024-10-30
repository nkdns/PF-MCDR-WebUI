document.addEventListener("DOMContentLoaded", () => {
    loadPlugins();
});

async function loadPlugins() {
    const response = await fetch('/api/plugins');
    const plugins = await response.json();

    const pluginsContainer = document.getElementById("plugins");
    pluginsContainer.innerHTML = plugins.map(plugin => `
        <div class="plugin" id="plugin-${plugin.id}">
            <span>${plugin.name}</span>
            <span>${plugin.author}</span>
            <a href="${plugin.mcdr}" target="_blank">MCDR仓库</a>
            <a href="${plugin.github}" target="_blank">Github仓库</a>
            <span>${plugin.version}</span>
            <span>${plugin.version_latest}</span>
            <button onclick="updatePlugin(${plugin.id})" display="${plugin.version === plugin.version_latest ? 'None;' : 'block'}">一键更新</button>
            <button onclick="togglePlugin(${plugin.id})">${plugin.status === 'running' ? '点击禁用' : '点击启用'}</button>
            <button onclick="reloadPlugin(${plugin.id})">点击重载</button>
            <button onclick="setPlugin(${plugin.id})">设置</button>
        </div>
    `).join('');
}

function updateAll() {
    fetch('/api/updateAll')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                // 获取用户信息
                getUserInfo(data.username);
            } else {
                console.error('Error:', data.message); // 输出具体错误信息
                // 跳转到登录页
                window.location.href = '/login';
            }
        })
        .catch(error => {
            console.error('Error:', error.message); // 输出网络错误信息
            // 跳转到登录页
            window.location.href = '/login';
        });
}