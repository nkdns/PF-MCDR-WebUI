// CQ-QQ-API页面的JavaScript功能
document.addEventListener('alpine:init', () => {
    Alpine.data('cqData', () => ({
        serverStatus: 'loading',
        userName: '',
        serverVersion: '',
        serverPlayers: '0/0',
        configData: {},
        translations: {},
        loading: true,
        saving: false,
        notificationMessage: '',
        notificationType: 'success',
        showNotification: false,
        
        checkLoginStatus: async function() {
            try {
                // 检查localStorage中的登录状态
                const isLoggedIn = localStorage.getItem('isLoggedIn');
                const username = localStorage.getItem('username');
                
                if (isLoggedIn === 'true' && username) {
                    this.userName = username;
                    return;
                }
                
                // 如果localStorage中没有登录状态，重定向到登录页
                window.location.href = '../login.html';
            } catch (error) {
                console.error('Error checking login status:', error);
                window.location.href = '../login.html';
            }
        },
        
        checkServerStatus: async function() {
            try {
                this.serverStatus = 'loading';
                const response = await fetch('../data/server_status.json');
                const data = await response.json();
                this.serverStatus = data.status || 'offline';
                this.serverVersion = data.version || '';
                this.serverPlayers = data.players || '0/0';
            } catch (error) {
                console.error('Error checking server status:', error);
                this.serverStatus = 'error';
            }
        },
        
        // 加载翻译数据
        loadTranslations: async function() {
            try {
                const response = await fetch('../data/cq_qq_api/config_lang.json');
                const data = await response.json();
                this.translations = data.zh_cn || {};
            } catch (error) {
                console.error('Error loading translations:', error);
                this.showNotificationMsg('加载翻译数据失败', 'error');
                // 默认翻译数据
                this.translations = {
                    'host': ['host', 'IP地址'],
                    'port': ['port', '正向 Websocket 端口号'],
                    'post_path': ['Endpoint', 'host:port/Endpoint (一般不用动)'],
                    'token': ['token', 'QQ 的加密 token'],
                    'language': ['language', ''],
                    'max_wait_time': ['API 最长等待时间', '单位（秒）']
                };
            }
        },
        
        // 加载配置数据
        loadConfig: async function() {
            try {
                this.loading = true;
                const response = await fetch('../data/cq_qq_api/config.json');
                this.configData = await response.json();
                this.loading = false;
            } catch (error) {
                console.error('Error loading config:', error);
                this.loading = false;
                this.showNotificationMsg('加载配置数据失败', 'error');
            }
        },
        
        // 保存配置数据
        saveConfig: async function() {
            try {
                this.saving = true;
                
                // 模拟保存成功
                setTimeout(() => {
                    this.showNotificationMsg('配置保存成功', 'success');
                    this.saving = false;
                }, 1000);
                
            } catch (error) {
                console.error('Error saving config:', error);
                this.showNotificationMsg('保存配置时出错', 'error');
                this.saving = false;
            }
        },
        
        // 获取配置的翻译名称
        getConfigName: function(key) {
            if (this.translations[key]) {
                return this.translations[key][0] || key;
            }
            return key;
        },
        
        // 获取配置的翻译描述
        getConfigDescription: function(key) {
            if (this.translations[key]) {
                return this.translations[key][1] || '';
            }
            return '';
        },
        
        // 更新配置值
        updateConfigValue: function(key, value) {
            // 对于数字类型的配置项，转换为数字
            if (key === 'port' || key === 'max_wait_time') {
                value = parseInt(value);
            }
            
            this.configData[key] = value;
        },
        
        // 显示通知
        showNotificationMsg: function(message, type = 'success') {
            this.notificationMessage = message;
            this.notificationType = type;
            this.showNotification = true;
            
            // 3秒后自动关闭通知
            setTimeout(() => {
                this.showNotification = false;
            }, 3000);
        },
        
        init() {
            this.checkLoginStatus();
            this.checkServerStatus();
            this.loadTranslations();
            this.loadConfig();
            
            // 每60秒自动刷新服务器状态
            setInterval(() => this.checkServerStatus(), 10001);
            
            // 保存主题设置到本地存储
            this.$watch('darkMode', value => {
                localStorage.setItem('darkMode', value);
            });
        }
    }));
});

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 设置当前年份
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}); 