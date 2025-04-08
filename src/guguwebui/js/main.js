/**
 * MCDR WebUI 主脚本
 * 实现前端交互和页面动态效果
 */

// 初始化主题
function initTheme() {
    // 检查localStorage中是否有主题设置
    const savedTheme = localStorage.getItem('darkMode');
    
    // 如果有设置，使用保存的设置
    if (savedTheme !== null) {
        const isDark = savedTheme === 'true';
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    } else {
        // 如果没有设置，根据系统主题设置
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        // 保存初始主题设置
        localStorage.setItem('darkMode', prefersDark);
    }
    
    // 添加系统主题变化监听
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeMediaQuery.addEventListener('change', (e) => {
        // 如果用户没有明确设置主题偏好，则跟随系统
        if (localStorage.getItem('darkMode') === null) {
            const darkMode = e.matches;
            document.documentElement.classList.toggle('dark', darkMode);
            localStorage.setItem('darkMode', darkMode);
        }
    });
}

// 切换主题
function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    const newMode = !isDark;
    
    if (newMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    
    // 保存到localStorage，确保使用字符串值
    localStorage.setItem('darkMode', String(newMode));
    
    // 如果页面使用Alpine.js管理深色模式，需要同步Alpine状态
    const alpineRoot = document.querySelector('[x-data]');
    if (alpineRoot && alpineRoot.__x) {
        alpineRoot.__x.$data.darkMode = newMode;
    }
}

// 检查登录状态
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/checkLogin');
        const data = await response.json();
        
        if (data.status !== 'success') {
            // 用户未登录，重定向到登录页面
            window.location.href = '/login';
            return false;
        }
        
        // 更新UI显示用户名
        if (data.username) {
            const userNameElements = document.querySelectorAll('.js-username');
            userNameElements.forEach(el => {
                el.textContent = data.username;
            });
            
            // 检查是否是QQ号，如果是则获取QQ信息
            if (/^\d{5,11}$/.test(data.username)) {
                fetchQQInfo(data.username);
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error checking login status:', error);
        return false;
    }
}

// 获取QQ昵称和头像
async function fetchQQInfo(qqNumber) {
    try {
        // 检查缓存
        const cachedInfo = getQQInfoFromCache(qqNumber);
        if (cachedInfo) {
            console.log('Using cached QQ info for', qqNumber);
            updateUIWithQQInfo(qqNumber, cachedInfo);
            return;
        }

        // 获取QQ昵称
        const response = await fetch(`https://api.leafone.cn/api/qqnick?qq=${qqNumber}`);
        const data = await response.json();
        
        if (data.code === 200 && data.data) {
            // 缓存昵称信息
            saveQQInfoToCache(qqNumber, data.data.nickname);
            
            // 更新UI
            updateUIWithQQInfo(qqNumber, data.data.nickname);
        }
    } catch (error) {
        console.error('Error fetching QQ info:', error);
    }
}

// 从缓存获取QQ信息
function getQQInfoFromCache(qqNumber) {
    const cacheKey = 'qqInfo';
    const cacheExpiryTime = 2 * 60 * 60 * 1000; // 2小时（毫秒）
    
    try {
        const cachedData = localStorage.getItem(cacheKey);
        if (!cachedData) return null;
        
        const qqInfoCache = JSON.parse(cachedData);
        const qqData = qqInfoCache[qqNumber];
        
        // 如果缓存存在且未过期
        if (qqData && (Date.now() - qqData.timestamp < cacheExpiryTime)) {
            return qqData.nickname;
        }
        
        return null;
    } catch (error) {
        console.error('Error reading QQ info from cache:', error);
        return null;
    }
}

// 保存QQ信息到缓存
function saveQQInfoToCache(qqNumber, nickname) {
    const cacheKey = 'qqInfo';
    
    try {
        // 获取现有缓存或创建新的缓存对象
        let qqInfoCache = {};
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
            qqInfoCache = JSON.parse(cachedData);
        }
        
        // 更新缓存
        qqInfoCache[qqNumber] = {
            nickname: nickname,
            timestamp: Date.now()
        };
        
        // 保存回缓存
        localStorage.setItem(cacheKey, JSON.stringify(qqInfoCache));
        console.log('QQ info cached for', qqNumber);
    } catch (error) {
        console.error('Error saving QQ info to cache:', error);
    }
}

// 使用QQ信息更新UI
function updateUIWithQQInfo(qqNumber, nickname) {
    // 更新昵称
    const userNameElements = document.querySelectorAll('.js-username');
    userNameElements.forEach(el => {
        el.textContent = nickname || qqNumber;
    });
    
    // 更新头像
    const avatarElements = document.querySelectorAll('.user-avatar');
    const avatarUrl = `https://q1.qlogo.cn/g?b=qq&nk=${qqNumber}&s=640`;
    
    avatarElements.forEach(el => {
        // 如果是img标签
        if (el.tagName === 'IMG') {
            el.src = avatarUrl;
            el.alt = nickname || qqNumber;
        } 
        // 如果是div等容器，设置背景图
        else {
            el.style.backgroundImage = `url('${avatarUrl}')`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            
            // 移除内部图标
            const iconElement = el.querySelector('i.fa-user');
            if (iconElement) {
                iconElement.remove();
            }
        }
        
        // 添加头像加载失败回退处理
        if (el.tagName === 'IMG') {
            el.onerror = function() {
                this.onerror = null;
                this.src = '';
                this.style.display = 'none';
                
                // 创建并添加图标作为后备
                const iconElement = document.createElement('i');
                iconElement.className = 'fas fa-user';
                el.parentNode.appendChild(iconElement);
            };
        }
    });
}

// 检查服务器状态
async function checkServerStatus() {
    try {
        const statusIndicator = document.getElementById('server-status-indicator');
        const statusText = document.getElementById('server-status-text');
        const versionText = document.getElementById('server-version');
        const playersText = document.getElementById('server-players');
        
        if (!statusIndicator || !statusText) return;
        
        // 设置加载状态
        statusIndicator.className = 'animate-pulse text-gray-500';
        statusIndicator.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        statusText.textContent = '正在检查...';
        
        const response = await fetch('/api/get_server_status');
        const data = await response.json();
        
        // 更新状态显示
        if (data.status === 'online') {
            statusIndicator.className = 'text-green-500';
            statusIndicator.innerHTML = '<i class="fas fa-circle"></i>';
            statusText.textContent = '在线';
        } else if (data.status === 'offline') {
            statusIndicator.className = 'text-red-500';
            statusIndicator.innerHTML = '<i class="fas fa-circle"></i>';
            statusText.textContent = '离线';
        } else {
            statusIndicator.className = 'text-yellow-500';
            statusIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            statusText.textContent = '未知';
        }
        
        // 更新版本和玩家信息
        if (versionText) versionText.textContent = data.version || '未知版本';
        if (playersText) playersText.textContent = data.players || '0/0';
        
    } catch (error) {
        console.error('Error checking server status:', error);
        
        // 错误状态
        if (statusIndicator && statusText) {
            statusIndicator.className = 'text-yellow-500';
            statusIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            statusText.textContent = '连接错误';
        }
    }
}

// 初始化侧边栏状态
function initSidebar() {
    // 检查localStorage中是否有侧边栏状态
    const sidebarState = localStorage.getItem('sidebarOpen');
    
    // 根据屏幕宽度默认值
    const defaultState = window.innerWidth >= 1024;
    
    // 如果有设置，使用保存的设置
    if (sidebarState !== null) {
        const isOpen = sidebarState === 'true';
        toggleSidebar(isOpen);
    } else {
        // 如果没有设置，使用默认值
        toggleSidebar(defaultState);
    }
}

// 切换侧边栏状态
function toggleSidebar(forceState) {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const header = document.getElementById('header');
    
    if (!sidebar || !mainContent || !header) return;
    
    const isOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('translate-x-0');
    
    if (isOpen) {
        sidebar.classList.remove('-translate-x-full');
        sidebar.classList.add('translate-x-0');
        mainContent.classList.add('sidebar-open');
        header.classList.add('left-[260px]');
        header.classList.remove('left-0');
    } else {
        sidebar.classList.remove('translate-x-0');
        sidebar.classList.add('-translate-x-full');
        mainContent.classList.remove('sidebar-open');
        header.classList.remove('left-[260px]');
        header.classList.add('left-0');
    }
    
    // 保存状态到localStorage
    localStorage.setItem('sidebarOpen', isOpen);
}

// 登录表单验证
function validateLoginForm() {
    const loginForm = document.getElementById('login-form');
    const tempForm = document.getElementById('temp-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            const account = document.getElementById('account');
            const password = document.getElementById('password');
            const errorText = document.getElementById('error-text');
            
            if (!account.value || !password.value) {
                e.preventDefault();
                errorText.textContent = '请填写完整的登录信息';
                errorText.classList.remove('hidden');
                return false;
            }
            
            return true;
        });
    }
    
    if (tempForm) {
        tempForm.addEventListener('submit', function(e) {
            const tempCode = document.getElementById('temp_code');
            const errorText = document.getElementById('error-text');
            
            if (!tempCode.value) {
                e.preventDefault();
                errorText.textContent = '请输入临时登录码';
                errorText.classList.remove('hidden');
                return false;
            }
            
            return true;
        });
    }
}

// 更新时间显示
function updateTime() {
    const timeElement = document.getElementById('current-time');
    const yearElement = document.getElementById('year');
    
    if (timeElement) {
        const now = new Date();
        timeElement.textContent = now.toLocaleString('zh-CN');
    }
    
    if (yearElement) {
        const year = new Date().getFullYear();
        yearElement.textContent = year;
    }
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化主题
    initTheme();
    
    // 初始化登录表单验证
    validateLoginForm();
    
    // 在需要验证登录的页面检查登录状态
    const needsAuth = !window.location.pathname.includes('/login');
    if (needsAuth) {
        checkLoginStatus();
        initSidebar();
        checkServerStatus();
        
        // 定时刷新服务器状态 (每60秒)
        setInterval(checkServerStatus, 10001);
        
        // 定时更新时间显示 (每秒)
        updateTime();
        setInterval(updateTime, 1000);
    }
    
    // 为主题切换按钮添加事件监听
    const themeToggleButtons = document.querySelectorAll('.theme-toggle');
    themeToggleButtons.forEach(btn => {
        btn.addEventListener('click', toggleTheme);
    });
    
    // 为侧边栏切换按钮添加事件监听
    const sidebarToggleButtons = document.querySelectorAll('.sidebar-toggle');
    sidebarToggleButtons.forEach(btn => {
        btn.addEventListener('click', () => toggleSidebar());
    });
});

// 页面可见性变化时刷新服务器状态
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        const needsAuth = !window.location.pathname.includes('/login');
        if (needsAuth) {
            checkServerStatus();
        }
    }
}); 