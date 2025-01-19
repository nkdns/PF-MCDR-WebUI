// 检查登录状态的函数
function checkLogin() {
    fetch('/api/checkLogin')
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

function getUserInfo(username) {
    const cachedUserInfo = localStorage.getItem('userInfo');
    const cachedTime = localStorage.getItem('userInfoTime');

    // 检查缓存是否存在且有效
    if (cachedUserInfo && cachedTime) {
        const currentTime = Date.now();
        const expiryTime = parseInt(cachedTime) + (2 * 60 * 60 * 1000); // 1 天的有效期

        if (currentTime < expiryTime) {
            // 解析缓存的用户信息并展示
            const userInfo = JSON.parse(cachedUserInfo);
            displayUserInfo(userInfo);
            return;
        } else {
            // 缓存已过期，清除缓存
            localStorage.removeItem('userInfo');
            localStorage.removeItem('userInfoTime');
        }
    }

    // 只对数字账号发请求
    const num = Number(username);
    if (!Number.isInteger(num)){
        const userInfo = {
            nickname: username,
            avatar: "src/default_avatar.jpg"
        };
        localStorage.setItem('userInfo', JSON.stringify(userInfo));
        localStorage.setItem('userInfoTime', Date.now().toString());
        // 展示用户信息
        displayUserInfo(userInfo);
        return;
    }

    // 发起请求获取用户信息
    fetch(`https://api.leafone.cn/api/qqnick?qq=${username}`)
        .then(response => response.json())
        .then(data => {
            if (data.code === 200) {
                // 使用指定的头像链接
                const userInfo = {
                    nickname: data.data.nickname,
                    avatar: `https://q1.qlogo.cn/g?b=qq&nk=${username}&s=640`
                };
                localStorage.setItem('userInfo', JSON.stringify(userInfo));
                localStorage.setItem('userInfoTime', Date.now().toString());

                // 展示用户信息
                displayUserInfo(userInfo);
            } else {
                console.error('获取用户信息失败:', data.msg);
            }
        })
        .catch(error => console.error('Error fetching user info:', error));
}

// 展示用户信息的辅助函数
function displayUserInfo(userInfo) {
    if (userInfo.nickname !== "tempuser") {
        document.getElementById('nickname').innerText = userInfo.nickname;
    }
    const avatar = document.getElementById('avatar');
    avatar.src = userInfo.avatar;
    avatar.style.display = 'block'; // 显示头像
    // 获取时间,判断是早上(6~9)、上午(9~11)、中午(11~13)、下午(13~18)、晚上(18~21)、深夜(21~24)、凌晨(0~6)
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 6 && hour < 9) {
        document.querySelector('.nav-time').innerText = '早上好，早起的你值得拥有阳光与美好~';
    } else if (hour >= 9 && hour < 11) {
        document.querySelector('.nav-time').innerText = '上午好，愿你的每个小目标都能实现~';
    } else if (hour >= 11 && hour < 13) {
        document.querySelector('.nav-time').innerText = '中午好，吃好午餐，才有力气继续奋斗~';
    } else if (hour >= 13 && hour < 18) {
        document.querySelector('.nav-time').innerText = '下午好，记得给自己喝杯水哦~';
    } else if (hour >= 18 && hour < 21) { 
        document.querySelector('.nav-time').innerText = '晚上好，放松一下，享受美好的时光~';
    } else if (hour >= 21 && hour < 24) {
        document.querySelector('.nav-time').innerText = '深夜好，愿你有个甜美的梦~';
    } else {
        document.querySelector('.nav-time').innerText = '凌晨好，夜晚安静，适合思考~';
    }
}

// 主题相关功能
const THEME_KEY = 'guguwebui-theme';
const THEMES = ['light', 'dark', 'auto'];

// 初始化主题
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'auto';
  const themeSelect = document.querySelector('.theme-select select');
  themeSelect.value = savedTheme;
  applyTheme(savedTheme);
}

// 应用主题
function applyTheme(theme) {
  const body = document.body;
  body.classList.remove(...THEMES);
  body.classList.add(theme);
  localStorage.setItem(THEME_KEY, theme);
  
  // 通知iframe主题变化
  const iframe = document.getElementById('content-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({ type: 'theme-change', theme }, '*');
  }
}

// 监听主题切换
function setupThemeSwitcher() {
  const themeSelect = document.querySelector('.theme-select select');
  themeSelect.addEventListener('change', (e) => {
    const selectedTheme = e.target.value;
    applyTheme(selectedTheme);
  });
}

// 监听主题变化
window.addEventListener('message', (event) => {
  if (event.data.type === 'theme-change') {
    document.body.classList.remove('light', 'dark', 'auto');
    document.body.classList.add(event.data.theme);
  }
});

// 页面加载时检查登录状态
window.onload = function () {
  // 初始化主题
  initTheme();
  setupThemeSwitcher();
    // 获取guguwebui插件信息
    fetch('/api/plugins?detail=true')
        .then(response => response.json())
        .then(data => {
            // 取plugins中id为guguwebui的插件信息
            const guguwebui = data.plugins.find(plugin => plugin.id === 'guguwebui');
            if (guguwebui) {
                const footer = document.querySelector('.footer');
                if (footer) {
                    footer.innerHTML = `WebUI版本: ${guguwebui.version}`;
                }
            }
        })
        .catch(error => console.error('获取插件信息失败:', error));
    // 页面及其所有资源已加载完毕
    checkLogin();
};

function logout() {
    // 清除本地缓存
    localStorage.removeItem('userInfo');
    localStorage.removeItem('userInfoTime');
    // 清除cookie
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    // 发送退出登录请求，不接收响应
    fetch('/logout')
    .then(
        window.location.href = "/login"
    );

}

const owner = 'LoosePrince'; // 替换为你的 GitHub 用户名
const repo = 'PF-GUGUbot-Web'; // 替换为你的仓库名
const tag = 'notice'; // 替换为公告的标签
async function fetchReleases() {

    const url = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}?access_token=`;
    const cacheKey = 'githubReleases';
    const cachedData = JSON.parse(localStorage.getItem(cacheKey));
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
            throw new Error('网络响应错误');
        }

        const data = await response.json();
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data }));
        displayRelease(data);
    } catch (error) {
        console.error('获取 标题 失败:', error);
        document.querySelector('.nav-notice-text').innerText = '获取 内容 失败';
    }
}

function displayRelease(release) {
    const titleElement = document.querySelector('.nav-notice-title');
    const contentElement = document.querySelector('.nav-notice-text');
    const bgImageElement = document.querySelector('#bg-img');
    const bgTitleElement = document.querySelector('#bg-title');

    // 解析 release.body 中的 JSON 内容
    const releaseData = JSON.parse(release.body);

    // 设置标题和内容链接
    titleElement.innerText = release.name + ': ';
    contentElement.innerText = releaseData.text;  // 设置 nav-notice-text 的文本内容

    // 设置背景图片链接
    if (bgImageElement) {
        bgImageElement.src = releaseData.bg;
    }

    // 设置背景标题文本
    if (bgTitleElement) {
        bgTitleElement.innerText = releaseData.bgtitile;
        // 设置链接
        bgTitleElement.setAttribute('href', releaseData.bg);
    }
}

// 调用函数
fetchReleases();

// 页面加载时检查并加载对应的tab
const hash = window.location.hash.substring(1);
if (hash) {
    changeTab(hash);
} else {
    changeTab('home');
}


function changeTab(tab) {
    document.querySelectorAll('.tab-container >div > div,.tab-fold > div').forEach(tab => {
        tab.classList.remove('select');
    });

    // 清除所有.expand的.select
    const expandElements = document.querySelectorAll('.expand');
    expandElements.forEach(element => {
        element.classList.remove('select');
    });

    // 获取指定的 tab 元素
    const tabElement = document.getElementById(tab);
    const parentElement = tabElement ? tabElement.parentElement : null;
    if (parentElement && parentElement.classList.contains('tab-fold')) {
        const siblings = Array.from(parentElement.children);
        siblings.forEach(sibling => {
            // 只为符合条件的兄弟元素添加 .select 类
            if (sibling !== tabElement && sibling.classList.contains('expand')) {
                sibling.classList.remove('select');
                sibling.classList.add('select');
            }
        });
    }

    document.getElementById(tab).classList.add('select');

    // 获取tab对应的data-text文本
    const tabText = document.getElementById(tab).getAttribute('data-text');

    // 设置页面标题
    document.querySelector('.nav-title').innerText = tabText;

    //设置iframe的src
    if (tab === 'home') {
        document.getElementById('content-iframe').src = '/home';
    } else if (tab === 'gugubot') {
        document.getElementById('content-iframe').src = '/gugubot';
    } else if (tab === 'cq') {
        document.getElementById('content-iframe').src = '/cq';
    } else if (tab === 'mc') {
        document.getElementById('content-iframe').src = '/mc';
    } else if (tab === 'mcdr') {
        document.getElementById('content-iframe').src = '/mcdr';
    } else if (tab === 'plugins') {
        document.getElementById('content-iframe').src = '/plugins';
    } else if (tab === 'about') {
        document.getElementById('content-iframe').src = '/about';
    } else if (tab === 'server-terminal') {
        document.getElementById('content-iframe').src = '/server-terminal';
    } else if (tab === 'fabric') {
        document.getElementById('content-iframe').src = '/fabric';
    }
    window.location.href = "#" + tab; 
}

// 折叠函数
function changeTabFromFold(foldId) {
    const foldElement = document.getElementById(foldId);
    if (!foldElement) return;

    const expandButton = foldElement.querySelector('.expand');
    const foldButton = foldElement.querySelector('.fold');
    const contentTabs = foldElement.querySelectorAll('.tab:not(.expand):not(.fold)');

    const isContentVisible = contentTabs[0].style.display !== 'none';

    if (isContentVisible) {
        contentTabs.forEach(tab => {
            tab.style.height = '0';
            // 延迟0.5s
            setTimeout(() => {
                tab.style.display = 'none';
            }, 500);
        });
        expandButton.style.display = 'block';
        foldButton.style.height = '0';
        setTimeout(() => {
            foldButton.style.display = 'none';
            expandButton.style.height = '40px';
            foldElement.style.border = '0 solid rgb(233, 241, 246)';
            foldElement.style.margin = '0';
        }, 500);
    } else {
        contentTabs.forEach(tab => {
            tab.style.display = 'block';
            setTimeout(() => {
                tab.style.height = '40px';
            }, 500);
        });
        expandButton.style.height = '0';
        foldButton.style.display = 'block';
        setTimeout(() => {
            expandButton.style.display = 'none';
            foldButton.style.height = '40px';
            foldElement.style.border = '2px solid #e9f1f6';
            foldElement.style.margin = '5px auto';
        }, 500);
    }
}

function fullScreen() {
    // 给class="nav"和class="tabs"和class="content"的元素添加class
    // 先判断是否有class="xxx-full"，有的话就移除，没有的话就添加
    const nav = document.querySelector('.nav');
    const tabs = document.querySelector('.tabs');
    const content = document.querySelector('.content');
    if (nav.classList.contains('nav-full')) {
        nav.classList.remove('nav-full');
        tabs.classList.remove('tabs-full');
        content.classList.remove('content-full');
    } else {
        nav.classList.add('nav-full');
        tabs.classList.add('tabs-full');
        content.classList.add('content-full');
    }
}
