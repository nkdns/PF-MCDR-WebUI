/**
 * 插件选项卡管理界面脚本
 * 用于管理插件选项卡的排序和显示
 */

// 在DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 如果在设置页面，初始化插件选项卡管理界面
    if (window.location.pathname.includes('/settings')) {
        initPluginTabsAdmin();
    }
});

/**
 * 初始化插件选项卡管理界面
 */
function initPluginTabsAdmin() {
    // 加载插件扩展列表
    loadPluginExtensions();
    
    // 添加事件监听器
    document.addEventListener('click', function(e) {
        // 处理启用/禁用插件扩展
        if (e.target.classList.contains('toggle-extension')) {
            const pluginId = e.target.getAttribute('data-plugin-id');
            const enabled = e.target.checked;
            togglePluginExtension(pluginId, enabled);
        }
        
        // 处理更新选项卡排序
        if (e.target.classList.contains('update-tab-order')) {
            const pluginId = e.target.getAttribute('data-plugin-id');
            const orderInput = document.querySelector(`.tab-order-input[data-plugin-id="${pluginId}"]`);
            if (orderInput) {
                const order = parseInt(orderInput.value);
                if (!isNaN(order)) {
                    updateTabOrder(pluginId, order);
                }
            }
        }
    });
}

/**
 * 加载插件扩展列表
 */
function loadPluginExtensions() {
    // 获取插件扩展管理容器
    const container = document.getElementById('plugin-extensions-container');
    if (!container) return;
    
    // 显示加载中
    container.innerHTML = '<div class="text-center py-4"><i class="fas fa-circle-notch fa-spin text-blue-500 dark:text-blue-400 text-xl"></i></div>';
    
    // 发送API请求
    fetch('/api/plugin-extensions')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                renderPluginExtensions(container, data.extensions);
            } else {
                container.innerHTML = `<div class="text-center py-4 text-red-500">${data.message || '加载插件扩展失败'}</div>`;
            }
        })
        .catch(error => {
            container.innerHTML = `<div class="text-center py-4 text-red-500">加载插件扩展失败: ${error.message}</div>`;
        });
}

/**
 * 渲染插件扩展列表
 * @param {HTMLElement} container - 容器元素
 * @param {Array} extensions - 插件扩展列表
 */
function renderPluginExtensions(container, extensions) {
    // 如果没有插件扩展
    if (!extensions || extensions.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-gray-500 dark:text-gray-400">暂无已注册的插件扩展</div>';
        return;
    }
    
    // 创建表格
    let html = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">插件ID</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">显示名称</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">版本</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">选项卡</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">排序</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">状态</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
    `;
    
    // 添加每个插件扩展
    extensions.forEach(extension => {
        html += `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${extension.plugin_id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${extension.display_name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${extension.version}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    ${extension.sidebar_tab ? `
                        <div class="flex items-center">
                            <i class="${extension.sidebar_tab.icon} mr-2"></i>
                            <span>${extension.sidebar_tab.title}</span>
                        </div>
                    ` : '无'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    ${extension.sidebar_tab ? `
                        <div class="flex items-center">
                            <input type="number" class="tab-order-input w-16 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white" 
                                data-plugin-id="${extension.plugin_id}" value="${extension.sidebar_tab.order}">
                            <button class="update-tab-order ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/30 transition"
                                data-plugin-id="${extension.plugin_id}">
                                <i class="fas fa-save"></i>
                            </button>
                        </div>
                    ` : '无'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <label class="inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="toggle-extension sr-only peer" data-plugin-id="${extension.plugin_id}" ${extension.enabled ? 'checked' : ''}>
                        <div class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        <span class="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">${extension.enabled ? '已启用' : '已禁用'}</span>
                    </label>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * 启用/禁用插件扩展
 * @param {string} pluginId - 插件ID
 * @param {boolean} enabled - 是否启用
 */
function togglePluginExtension(pluginId, enabled) {
    // 发送API请求
    fetch(`/api/plugin-extensions/${pluginId}/toggle`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // 显示成功消息
                showNotification('success', data.message);
                
                // 更新标签文本
                const label = document.querySelector(`.toggle-extension[data-plugin-id="${pluginId}"]`).nextElementSibling.nextElementSibling;
                if (label) {
                    label.textContent = enabled ? '已启用' : '已禁用';
                }
            } else {
                // 显示错误消息
                showNotification('error', data.message);
                
                // 恢复复选框状态
                const checkbox = document.querySelector(`.toggle-extension[data-plugin-id="${pluginId}"]`);
                if (checkbox) {
                    checkbox.checked = !enabled;
                }
            }
        })
        .catch(error => {
            // 显示错误消息
            showNotification('error', `操作失败: ${error.message}`);
            
            // 恢复复选框状态
            const checkbox = document.querySelector(`.toggle-extension[data-plugin-id="${pluginId}"]`);
            if (checkbox) {
                checkbox.checked = !enabled;
            }
        });
}

/**
 * 更新选项卡排序
 * @param {string} pluginId - 插件ID
 * @param {number} order - 排序值
 */
function updateTabOrder(pluginId, order) {
    // 发送API请求
    fetch(`/api/plugin-tabs/${pluginId}/order`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(order)
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // 显示成功消息
                showNotification('success', data.message);
            } else {
                // 显示错误消息
                showNotification('error', data.message);
            }
        })
        .catch(error => {
            // 显示错误消息
            showNotification('error', `操作失败: ${error.message}`);
        });
}

/**
 * 显示通知消息
 * @param {string} type - 消息类型 (success, error)
 * @param {string} message - 消息内容
 */
function showNotification(type, message) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-md shadow-md z-50 ${
        type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 
        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    }`;
    notification.textContent = message;
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 3秒后移除
    setTimeout(() => {
        notification.classList.add('opacity-0');
        notification.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 3000);
}

// 导出函数供全局使用
window.pluginTabsAdmin = {
    init: initPluginTabsAdmin,
    loadExtensions: loadPluginExtensions,
    toggleExtension: togglePluginExtension,
    updateTabOrder: updateTabOrder
};