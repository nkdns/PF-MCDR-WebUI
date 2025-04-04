/**
 * MCDR WebUI 页面预加载器
 * 用于加速页面切换和减少加载等待时间
 */

// 需要预加载的页面路径
const pagesToPreload = [
    '/index',
    '/mcdr',
    '/mc',
    '/plugins',
    '/online-plugins',
    '/cq',
    '/fabric',
    '/settings',
    '/about'
];

// 当前页面的路径 
const currentPath = window.location.pathname;

// 已经加载的页面缓存
const loadedPages = new Map();

/**
 * 预加载特定的页面
 * @param {string} url - 页面的URL
 */
async function preloadPage(url) {
    if (url === currentPath || loadedPages.has(url)) {
        return; // 跳过当前页面或已加载的页面
    }

    try {
        const response = await fetch(url, { 
            method: 'GET',
            cache: 'force-cache', // 强制使用缓存
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'text/html'
            }
        });
        
        if (response.ok) {
            const pageContent = await response.text();
            loadedPages.set(url, pageContent);
            console.log(`预加载页面成功: ${url}`);
        }
    } catch (error) {
        console.warn(`预加载页面失败 ${url}:`, error);
    }
}

/**
 * 使用缓存的页面内容替换当前页面
 * @param {string} url - 要导航到的URL
 * @returns {boolean} - 是否成功使用了缓存
 */
function useCachedPage(url) {
    if (loadedPages.has(url)) {
        // 我们可以在这里使用SPA式的页面替换逻辑
        // 但由于这可能会与服务器端渲染冲突，
        // 此处仅记录缓存已存在，依然使用传统导航
        console.log(`页面缓存已存在: ${url}`);
        return true;
    }
    return false;
}

/**
 * 为所有导航链接添加事件监听，优先使用缓存
 */
function setupNavigationHandler() {
    document.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        
        // 跳过外部链接和非导航链接
        if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:')) {
            return;
        }
        
        // 为每个链接添加hover事件，鼠标悬停时预加载
        link.addEventListener('mouseenter', () => {
            setTimeout(() => preloadPage(href), 100);
        });
        
        // 触摸设备的触摸开始时预加载
        link.addEventListener('touchstart', () => {
            setTimeout(() => preloadPage(href), 100);
        });
    });
}

/**
 * 初始化预加载功能
 */
function initPreloader() {
    // 页面完全加载后开始预加载其他页面
    if (document.readyState === 'complete') {
        startPreloading();
    } else {
        window.addEventListener('load', startPreloading);
    }
}

/**
 * 开始预加载其他页面
 */
function startPreloading() {
    // 设置导航事件处理
    setupNavigationHandler();
    
    // 延迟一段时间后开始预加载，避免与初始页面加载竞争资源
    setTimeout(() => {
        // 使用不同的延迟依次加载页面，避免同时发送太多请求
        pagesToPreload.forEach((url, index) => {
            setTimeout(() => preloadPage(url), index * 300);
        });
    }, 1000);
}

// 初始化预加载器
initPreloader(); 