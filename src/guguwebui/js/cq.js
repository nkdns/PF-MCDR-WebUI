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
                const response = await fetch('api/checkLogin');
                const data = await response.json();
                if (data.status === 'success') {
                    this.userName = data.username;
                }
            } catch (error) {
                console.error('Error checking login status:', error);
            }
        },
        
        checkServerStatus: async function() {
            try {
                this.serverStatus = 'loading';
                const response = await fetch('api/get_server_status');
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
                const response = await fetch('api/load_config?path=config/cq_qq_api/config.json&translation=true');
                this.translations = await response.json();
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
                const response = await fetch('api/load_config?path=config/cq_qq_api/config.json');
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
                
                const response = await fetch('api/save_config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        file_path: 'config/cq_qq_api/config.json',
                        config_data: this.configData
                    })
                });
                
                const result = await response.json();
                
                if (result.status === 'success') {
                    this.showNotificationMsg('配置保存成功', 'success');
                } else {
                    this.showNotificationMsg('配置保存失败: ' + result.message, 'error');
                }
                
                this.saving = false;
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