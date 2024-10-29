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
        const expiryTime = parseInt(cachedTime) + (24 * 60 * 60 * 1000); // 1 天的有效期

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

    if (username === "") {
        // 发起请求获取用户信息
        fetch(`https://api.usuuu.com/qq/${username}`)
            .then(response => response.json())
            .then(data => {
                if (data.code === 200) {
                    // 缓存用户信息到本地
                    const userInfo = {
                        name: data.data.name,
                        avatar: data.data.avatar
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
    } else {
        const userInfo = {
            name: "temp_user",
            avatar: "/src/bg.png"
        };
        localStorage.setItem('userInfo', JSON.stringify(userInfo));
        localStorage.setItem('userInfoTime', Date.now().toString());

        // 展示用户信息
        displayUserInfo(userInfo);
    }
}

// 展示用户信息的辅助函数
function displayUserInfo(userInfo) {
    document.getElementById('nickname').innerText = userInfo.name;
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

// 页面加载时检查登录状态
window.onload = checkLogin;

function logout() {
    // 发送退出登录请求，不接收响应
    fetch('/logout');
    // 清除本地缓存
    localStorage.removeItem('userInfo');
    localStorage.removeItem('userInfoTime');
    // 清除cookie
    document.cookie = 'username=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    window.location.href = '/login';
}

const owner = 'LoosePrince'; // 替换为你的 GitHub 用户名
const repo = 'PF-GUGUbot-Web'; // 替换为你的仓库名
const tag = 'notice'; // 替换为你想要获取的标签
async function fetchReleases() {

const url = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}?access_token=`;
const cacheKey = 'githubReleases';
const cachedData = JSON.parse(localStorage.getItem(cacheKey));
const now = Date.now();

// 检查缓存
if (cachedData && (now - cachedData.timestamp < 7200000)) {
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
    console.error('获取 Releases 失败:', error);
    document.querySelector('.nav-notice-text').innerText = '获取 Releases 失败';
}
}

function displayRelease(release) {
const titleElement = document.querySelector('.nav-notice-title');
const contentElement = document.querySelector('.nav-notice-text');

titleElement.innerText = release.name + ': ';
contentElement.innerHTML = `<a href="${release.html_url}" target="_blank">${release.body}</a>`;
}

// 调用函数
fetchReleases();

// 页面加载时检查并加载对应的tab
const hash = window.location.hash.substring(1);
if (hash) {
    changeTab(hash);
}


function changeTab(tab) {
    const home = document.getElementById('home');
    const gugubot = document.getElementById('gugubot');
    const cq = document.getElementById('cq');
    const mc = document.getElementById('mc');
    const mcdr = document.getElementById('mcdr');
    const plugins = document.getElementById('plugins');
    const about = document.getElementById('about');
    const fabric = document.getElementById('fabric');

    home.classList.remove('select');
    gugubot.classList.remove('select');
    cq.classList.remove('select');
    mc.classList.remove('select');
    mcdr.classList.remove('select');
    plugins.classList.remove('select');
    about.classList.remove('select');
    fabric.classList.remove('select');

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
    } else if (tab === 'fabric') {
        document.getElementById('content-iframe').src = '/fabric';
    }
}