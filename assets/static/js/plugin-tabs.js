/**
 * 插件选项卡管理脚本
 * 处理插件选项卡的点击事件和iframe容器的动态加载
 */

// 在DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化插件选项卡
    initPluginTabs();
    
    // 检查当前URL是否匹配插件路径
    checkCurrentPath();
});

/**
 * 初始化插件选项卡
 */
function initPluginTabs() {
    // 获取所有插件选项卡
    const pluginTabs = document.querySelectorAll('.plugin-tab');
    
    // 为每个插件选项卡添加点击事件处理
    pluginTabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            // 阻止默认行为，使用JavaScript处理导航
            e.preventDefault();
            
            // 获取插件ID和URL
            const pluginId = this.getAttribute('data-plugin-id');
            const url = this.getAttribute('href');
            
            // 更新URL，但不刷新页面
            history.pushState({}, '', url);
            
            // 移除所有选项卡的active类
            pluginTabs.forEach(t => t.classList.remove('active'));
            
            // 为当前选项卡添加active类
            this.classList.add('active');
            
            // 加载插件内容到iframe
            loadPluginContent(url);
        });
    });
}

/**
 * 检查当前URL是否匹配插件路径
 */
function checkCurrentPath() {
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/plugin/')) {
        // 提取插件ID
        const pathParts = currentPath.split('/');
        if (pathParts.length >= 3) {
            const pluginId = pathParts[2];
            
            // 查找对应的选项卡
            const tab = document.querySelector(`.plugin-tab[data-plugin-id="${pluginId}"]`);
            if (tab) {
                // 获取所有插件选项卡
                const pluginTabs = document.querySelectorAll('.plugin-tab');
                
                // 激活选项卡
                pluginTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // 加载插件内容
                loadPluginContent(currentPath);
            }
        }
    }
}

/**
 * 加载插件内容到iframe
 * @param {string} url - 插件内容URL
 */
function loadPluginContent(url) {
    // 检查是否已存在内容容器
    let contentContainer = document.getElementById('plugin-content-container');
    
    // 处理URL，添加版本参数以避免缓存问题
    let versionedUrl = url;
    
    // 如果存在插件资源管理器，使用它来获取带版本的URL
    if (window.pluginResourceManager && window.pluginResourceManager.getVersionedResourceUrl) {
        // 从URL中提取插件ID和路径
        const urlParts = url.split('/');
        if (urlParts.length >= 3 && urlParts[1] === 'plugin') {
            const pluginId = urlParts[2];
            const path = urlParts.slice(3).join('/');
            
            // 获取带版本的URL
            versionedUrl = window.pluginResourceManager.getVersionedResourceUrl(pluginId, path);
        }
    }
    
    // 如果不存在，创建一个
    if (!contentContainer) {
        // 获取主内容区域
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;
        
        // 隐藏主内容
        mainContent.style.display = 'none';
        
        // 创建iframe容器
        contentContainer = document.createElement('div');
        contentContainer.id = 'plugin-content-container';
        contentContainer.className = 'w-full h-full';
        contentContainer.style.position = 'absolute';
        contentContainer.style.top = '0';
        contentContainer.style.left = '0';
        contentContainer.style.right = '0';
        contentContainer.style.bottom = '0';
        contentContainer.style.zIndex = '10';
        
        // 创建iframe
        const iframe = document.createElement('iframe');
        iframe.id = 'plugin-content-iframe';
        iframe.className = 'w-full h-full';
        iframe.style.border = 'none';
        iframe.src = versionedUrl;
        
        // 添加iframe到容器
        contentContainer.appendChild(iframe);
        
        // 添加容器到body
        document.body.appendChild(contentContainer);
    } else {
        // 更新iframe的src
        const iframe = document.getElementById('plugin-content-iframe');
        if (iframe) {
            iframe.src = versionedUrl;
        }
    }
}

/**
 * 关闭插件内容
 */
function closePluginContent() {
    // 获取内容容器
    const contentContainer = document.getElementById('plugin-content-container');
    if (contentContainer) {
        // 移除容器
        contentContainer.remove();
        
        // 显示主内容
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.style.display = '';
        }
        
        // 移除所有选项卡的active类
        const pluginTabs = document.querySelectorAll('.plugin-tab');
        pluginTabs.forEach(t => t.classList.remove('active'));
        
        // 更新URL
        history.pushState({}, '', '/');
    }
}

// 导出函数供全局使用
window.pluginTabs = {
    init: initPluginTabs,
    loadContent: loadPluginContent,
    closeContent: closePluginContent
};