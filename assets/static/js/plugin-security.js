/**
 * 插件安全管理界面交互脚本
 */

document.addEventListener('DOMContentLoaded', function() {
    // 初始化Alpine.js组件在HTML中定义
    
    // 添加全局事件监听器
    document.addEventListener('securityConfigSaved', function(e) {
        console.log('安全配置已保存:', e.detail);
        // 可以在这里添加额外的处理逻辑
    });
    
    document.addEventListener('securityEventCleared', function(e) {
        console.log('安全事件已清除:', e.detail);
        // 可以在这里添加额外的处理逻辑
    });
    
    // 添加CSP头处理
    function addCSPHeaders() {
        fetch('/api/security/config')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success' && data.data.enable_content_security_policy) {
                    // 获取CSP策略
                    fetch('/api/security/csp')
                        .then(response => response.json())
                        .then(cspData => {
                            if (cspData.status === 'success' && cspData.data) {
                                // 创建meta标签
                                const meta = document.createElement('meta');
                                meta.httpEquiv = 'Content-Security-Policy';
                                meta.content = cspData.data;
                                document.head.appendChild(meta);
                                console.log('已添加CSP头:', cspData.data);
                            }
                        })
                        .catch(error => console.error('获取CSP策略失败:', error));
                }
            })
            .catch(error => console.error('获取安全配置失败:', error));
    }
    
    // 初始化时添加CSP头
    addCSPHeaders();
});

/**
 * 格式化时间戳
 * @param {string} timestamp ISO格式的时间戳
 * @returns {string} 格式化后的时间字符串
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString();
}

/**
 * 显示通知
 * @param {string} message 通知消息
 * @param {string} type 通知类型 (success, error, warning, info)
 */
function showNotification(message, type = 'info') {
    // 检查是否存在通知容器
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
        document.body.appendChild(container);
    }
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = 'p-3 rounded-lg shadow-lg flex items-center gap-2 transform transition-all duration-300 translate-x-full';
    
    // 根据类型设置样式
    switch (type) {
        case 'success':
            notification.classList.add('bg-green-100', 'text-green-800', 'border-l-4', 'border-green-500');
            notification.innerHTML = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            notification.classList.add('bg-red-100', 'text-red-800', 'border-l-4', 'border-red-500');
            notification.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
            break;
        case 'warning':
            notification.classList.add('bg-yellow-100', 'text-yellow-800', 'border-l-4', 'border-yellow-500');
            notification.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            break;
        default:
            notification.classList.add('bg-blue-100', 'text-blue-800', 'border-l-4', 'border-blue-500');
            notification.innerHTML = '<i class="fas fa-info-circle"></i>';
    }
    
    // 添加消息
    notification.innerHTML += `<span>${message}</span>`;
    
    // 添加关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ml-auto text-gray-500 hover:text-gray-700';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.onclick = () => {
        notification.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => notification.remove(), 300);
    };
    notification.appendChild(closeBtn);
    
    // 添加到容器
    container.appendChild(notification);
    
    // 显示通知
    setTimeout(() => notification.classList.remove('translate-x-full'), 10);
    
    // 自动关闭
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// 将showNotification函数添加到全局作用域，以便在HTML中使用
window.showNotification = showNotification;