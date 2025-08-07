/**
 * 插件资源管理器
 * 用于管理插件资源的版本控制和热更新
 */

// 存储插件资源版本信息
const pluginResourceVersions = {};

/**
 * 获取带版本号的资源URL
 * @param {string} pluginId 插件ID
 * @param {string} resourcePath 资源路径
 * @returns {string} 带版本号的URL
 */
function getVersionedResourceUrl(pluginId, resourcePath) {
    const version = pluginResourceVersions[pluginId] || '';
    const baseUrl = `/plugin/${pluginId}/`;
    
    // 确保路径格式正确
    let path = resourcePath || '';
    if (path && !path.startsWith('/')) {
        path = '/' + path;
    }
    
    // 添加版本参数
    const versionParam = version ? `?v=${version}` : '';
    return baseUrl + (path || '') + versionParam;
}

/**
 * 更新插件资源版本
 * @param {string} pluginId 插件ID
 * @param {string} version 资源版本
 */
function updateResourceVersion(pluginId, version) {
    if (pluginId && version) {
        pluginResourceVersions[pluginId] = version;
        console.log(`已更新插件 ${pluginId} 的资源版本: ${version}`);
    }
}

/**
 * 刷新插件资源
 * @param {string} pluginId 插件ID
 * @returns {Promise<object>} 刷新结果
 */
async function refreshPluginResources(pluginId) {
    try {
        const response = await fetch(`/api/plugin-resources/${pluginId}/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.status === 'success' && result.version) {
            // 更新资源版本
            updateResourceVersion(pluginId, result.version);
            
            // 如果当前页面是该插件的页面，刷新页面
            if (window.location.pathname.startsWith(`/plugin/${pluginId}/`)) {
                window.location.reload();
            }
        }
        
        return result;
    } catch (error) {
        console.error(`刷新插件 ${pluginId} 资源失败:`, error);
        return { status: 'error', message: error.message };
    }
}

/**
 * 重载插件扩展
 * @param {string} pluginId 插件ID
 * @returns {Promise<object>} 重载结果
 */
async function reloadPluginExtension(pluginId) {
    try {
        const response = await fetch(`/api/plugin-extensions/${pluginId}/reload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.status === 'success' && result.version) {
            // 更新资源版本
            updateResourceVersion(pluginId, result.version);
            
            // 如果当前页面是该插件的页面，刷新页面
            if (window.location.pathname.startsWith(`/plugin/${pluginId}/`)) {
                window.location.reload();
            }
        }
        
        return result;
    } catch (error) {
        console.error(`重载插件 ${pluginId} 失败:`, error);
        return { status: 'error', message: error.message };
    }
}

/**
 * 清理未使用的插件资源
 * @param {number} maxAge 最大保留时间（秒），默认为7天
 * @returns {Promise<object>} 清理结果
 */
async function cleanupPluginResources(maxAge = 604800) {
    try {
        const response = await fetch('/api/plugin-resources/cleanup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ max_age: maxAge })
        });
        
        return await response.json();
    } catch (error) {
        console.error('清理插件资源失败:', error);
        return { status: 'error', message: error.message };
    }
}

/**
 * 初始化插件资源版本信息
 * @returns {Promise<void>}
 */
async function initPluginResourceVersions() {
    try {
        // 获取所有插件扩展信息
        const response = await fetch('/api/plugin-extensions');
        const result = await response.json();
        
        if (result.status === 'success' && result.extensions) {
            // 遍历插件扩展，获取资源版本
            for (const extension of result.extensions) {
                if (extension.plugin_id) {
                    // 获取插件资源版本
                    const resourceResponse = await fetch(`/api/plugin-resources/${extension.plugin_id}/refresh`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const resourceResult = await resourceResponse.json();
                    
                    if (resourceResult.status === 'success' && resourceResult.version) {
                        // 更新资源版本
                        updateResourceVersion(extension.plugin_id, resourceResult.version);
                    }
                }
            }
        }
    } catch (error) {
        console.error('初始化插件资源版本信息失败:', error);
    }
}

// 导出函数
window.pluginResourceManager = {
    getVersionedResourceUrl,
    updateResourceVersion,
    refreshPluginResources,
    reloadPluginExtension,
    cleanupPluginResources,
    initPluginResourceVersions
};

// 页面加载完成后初始化资源版本信息
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，避免影响页面加载速度
    setTimeout(() => {
        initPluginResourceVersions();
    }, 1000);
});