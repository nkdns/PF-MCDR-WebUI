/**
 * 公告系统脚本
 * 从GitHub获取公告信息并显示在顶部导航栏
 */

// i18n 支持
let noticeLang = 'zh-CN';
let noticeDict = {};

// 翻译函数
function t(key, fallback = '') {
    // 在已加载的语言包中查找 key（支持 a.b.c 链式）
    const val = key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), noticeDict);
    if (val != null) return String(val);
    // 回退到全局 I18n.t（若可用）
    if (window.I18n && typeof window.I18n.t === 'function') {
        const v = window.I18n.t(key);
        if (v && v !== key) return v;
    }
    return fallback || key;
}

// 加载语言字典
async function loadNoticeLangDict() {
    // 读取本地存储语言（由 i18n.js 维护）
    const stored = localStorage.getItem('lang') || (navigator.language || 'zh-CN');
    noticeLang = stored.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
    try {
        if (window.I18n && typeof window.I18n.fetchLangDict === 'function') {
            noticeDict = await window.I18n.fetchLangDict(noticeLang);
        } else {
            const resp = await fetch(`lang/${noticeLang}.json`, { cache: 'no-cache' });
            if (resp.ok) {
                noticeDict = await resp.json();
            }
        }
    } catch (e) {
        // 忽略，保持空字典，使用 fallback
        console.warn('loadNoticeLangDict failed:', e);
    }
}

const owner = 'LoosePrince';
const repo = 'PF-GUGUbot-Web';
const tag = 'notice';

/**
 * 解析公告内容，支持普通文本和JSON格式
 * @param {string} body - 公告正文内容
 * @returns {Object} 解析后的公告数据
 */
function parseNoticeContent(body) {
    try {
        // 尝试解析为JSON
        const jsonData = JSON.parse(body);
        return {
            isJson: true,
            text: jsonData.text || '',
            bg: jsonData.bg || '',
            bgtitle: jsonData.bgtitle || ''
        };
    } catch (e) {
        // 如果不是有效的JSON，则当作普通文本处理
        return {
            isJson: false,
            text: body
        };
    }
}

/**
 * 显示公告内容
 * @param {Object} releaseData - GitHub release数据
 */
function displayRelease(releaseData) {
    try {
        const noticeElement = document.querySelector('.nav-notice-text');
        if (!noticeElement) return;

        // 从release名称中获取公告标题
        const title = releaseData.name || t('notice.default_title', '公告');
        // 从release正文中获取公告内容
        const body = releaseData.body || '';
        
        // 解析公告内容
        const noticeData = parseNoticeContent(body);
        
        // 设置公告文本
        noticeElement.innerHTML = `<i class="fas fa-bullhorn mr-1.5"></i> ${noticeData.isJson ? noticeData.text : title}`;
        
        // 如果有正文内容，添加点击事件显示详情
        if (body.trim()) {
            const noticeContainer = document.querySelector('.nav-notice');
            if (noticeContainer) {
                noticeContainer.style.cursor = 'pointer';
                noticeContainer.title = t('notice.click_to_view', '点击查看公告详情');
                
                noticeContainer.addEventListener('click', () => {
                    // 创建模态窗口显示公告详情
                    showNoticeModal(title, noticeData);
                });
            }
        }
    } catch (error) {
        console.error(t('notice.error.processing_data', '处理公告数据出错:'), error);
    }
}

/**
 * 显示公告详情的模态窗口
 * @param {string} title - 公告标题
 * @param {Object} noticeData - 公告内容数据
 */
function showNoticeModal(title, noticeData) {
    // 创建模态背景
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center transition-opacity duration-300 opacity-0';
    document.body.appendChild(modalBackdrop);
    
    // 创建模态内容
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] transform transition-all duration-300 scale-95 opacity-0';
    
    // 根据数据类型选择不同的显示方式
    let contentHtml = '';
    
    if (noticeData.isJson) {
        // 使用JSON格式显示
        contentHtml = `
            <div class="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${title}</h3>
                <button class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="overflow-hidden">
                ${noticeData.bg ? `<div class="w-full flex justify-center p-3" id="notice-img-container">
                    <img src="${noticeData.bg}" alt="${noticeData.bgtitle || t('notice.image_alt', '公告图片')}" 
                        class="max-w-full h-auto rounded-lg shadow-md" 
                        onerror="this.parentElement.style.display='none'; document.getElementById('notice-content').style.maxHeight = 'calc(80vh - 180px);" />
                </div>` : ''}
                <div id="notice-content" class="p-5 overflow-y-auto" style="max-height: calc(80vh - ${noticeData.bg ? '280' : '180'}px);">
                    <div class="prose dark:prose-invert prose-sm max-w-none">${markdownToHtml(noticeData.text)}</div>
                </div>
            </div>
            <div class="p-4 border-t border-gray-200 dark:border-gray-700 text-right">
                <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800">
                    ${t('notice.close', '关闭')}
                </button>
            </div>
        `;
    } else {
        // 使用普通文本显示
        contentHtml = `
            <div class="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${title}</h3>
                <button class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="p-5 overflow-y-auto" style="max-height: calc(80vh - 120px);">
                <div class="prose dark:prose-invert prose-sm max-w-none">${markdownToHtml(noticeData.text)}</div>
            </div>
            <div class="p-4 border-t border-gray-200 dark:border-gray-700 text-right">
                <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800">
                    ${t('notice.close', '关闭')}
                </button>
            </div>
        `;
    }
    
    modalContent.innerHTML = contentHtml;
    modalBackdrop.appendChild(modalContent);
    
    // 添加关闭事件
    const closeModal = () => {
        modalBackdrop.classList.remove('opacity-100');
        modalContent.classList.remove('opacity-100', 'scale-100');
        modalBackdrop.classList.add('opacity-0');
        modalContent.classList.add('opacity-0', 'scale-95');
        
        setTimeout(() => {
            document.body.removeChild(modalBackdrop);
        }, 300);
    };
    
    // 绑定关闭按钮事件
    modalContent.querySelector('.p-5.border-b button').addEventListener('click', closeModal);
    modalContent.querySelector('.p-4.border-t button').addEventListener('click', closeModal);
    
    // 点击背景关闭
    modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
            closeModal();
        }
    });
    
    // 显示模态窗口
    setTimeout(() => {
        modalBackdrop.classList.add('opacity-100');
        modalContent.classList.add('opacity-100', 'scale-100');
        modalContent.classList.remove('scale-95', 'opacity-0');
    }, 10);
}

/**
 * 简单的Markdown转HTML函数
 * @param {string} markdown - Markdown格式文本
 * @returns {string} HTML格式文本
 */
function markdownToHtml(markdown) {
    if (!markdown) return '';
    
    // 替换链接 [text](url)
    let html = markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-500 hover:underline">$1</a>');
    
    // 替换标题 ### Heading
    html = html.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold my-3">$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold my-3">$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold my-4">$1</h1>');
    
    // 替换粗体 **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 替换斜体 *text*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // 替换代码 `code`
    html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm">$1</code>');
    
    // 替换换行符为<br>
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

/**
 * 从GitHub获取公告信息
 */
async function fetchReleases() {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}?access_token=`;
    const cacheKey = 'githubReleases';
    const cachedData = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    const now = Date.now();

    // 检查缓存
    const latest = cachedData && (now - cachedData.timestamp < 7200000);
    // const latest = 0; // 禁用缓存
    if (latest) {
        displayRelease(cachedData.data);
        return;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(t('notice.error.network_response', '网络响应错误'));
        }

        const data = await response.json();
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data }));
        displayRelease(data);
    } catch (error) {
        console.error(t('notice.error.fetch_failed', '获取公告失败:'), error);
        const noticeElement = document.querySelector('.nav-notice-text');
        if (noticeElement) {
            noticeElement.innerHTML = `<i class="fas fa-exclamation-circle mr-1.5"></i> ${t('notice.error.fetch_failed_text', '获取公告失败')}`;
        }
    }
}

// 用于测试的函数，可以在控制台调用测试JSON格式公告
window.testNotice = function(jsonString) {
    try {
        const data = {
            name: t('notice.test.title', '测试公告'),
            body: jsonString
        };
        displayRelease(data);
    } catch (error) {
        console.error(t('notice.error.test_error', '测试公告错误:'), error);
    }
};

// 页面加载完成后初始化公告
document.addEventListener('DOMContentLoaded', () => {
    // 初始化语言
    loadNoticeLangDict();
    
    // 获取公告
    fetchReleases();
    
    // 监听语言切换
    document.addEventListener('i18n:changed', (e) => {
        const nextLang = (e && e.detail && e.detail.lang) ? e.detail.lang : noticeLang;
        noticeLang = nextLang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
        loadNoticeLangDict();
    });
});