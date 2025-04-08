// 控制面板页面的JavaScript功能
document.addEventListener('alpine:init', () => {
    Alpine.data('indexData', () => ({
        serverStatus: 'loading',
        userName: '',
        serverVersion: '',
        serverPlayers: '0/0',
        processingServer: false,
        showNotification: false,
        notificationMessage: '',
        notificationType: 'success',

        checkLoginStatus: async function() {
            try {
                const response = await fetch('/api/checkLogin');
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
                const response = await fetch('/api/get_server_status');
                const data = await response.json();
                this.serverStatus = data.status || 'offline';
                this.serverVersion = data.version || '';
                this.serverPlayers = data.players || '0/0';
            } catch (error) {
                console.error('Error checking server status:', error);
                this.serverStatus = 'error';
            }
        },
        
        controlServer: async function(action) {
            if (this.processingServer) return;
            
            this.processingServer = true;
            
            try {
                const response = await fetch('/api/control_server', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ action: action })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    this.showNotificationMsg(data.message || `服务器${action === 'start' ? '启动' : (action === 'stop' ? '停止' : '重启')}命令已发送`, 'success');
                    
                    // 延迟几秒后刷新服务器状态
                    setTimeout(() => this.checkServerStatus(), 5000);
                } else {
                    this.showNotificationMsg(`操作失败: ${data.message || '未知错误'}`, 'error');
                }
            } catch (error) {
                console.error('Error controlling server:', error);
                this.showNotificationMsg('服务器控制操作失败', 'error');
            } finally {
                this.processingServer = false;
            }
        },
        
        showNotificationMsg: function(message, type = 'success') {
            this.notificationMessage = message;
            this.notificationType = type;
            this.showNotification = true;
            
            setTimeout(() => {
                this.showNotification = false;
            }, 5000);
        },
        
        init() {
            this.checkLoginStatus();
            this.checkServerStatus();
            
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
    // 设置当前时间和版权年份
    function updateTime() {
        const now = new Date();
        const timeElement = document.getElementById('current-time');
        if (timeElement) {
            timeElement.textContent = now.toLocaleString('zh-CN');
        }
    }
    
    updateTime();
    setInterval(updateTime, 1000);
    
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
    
    // 获取WebUI版本
    async function getWebUIVersion() {
        try {
            const versionElement = document.getElementById('web-version');
            if (!versionElement) return;
            
            const response = await fetch('/api/gugubot_plugins');
            const data = await response.json();
            
            if (data.gugubot_plugins) {
                const guguwebui = data.gugubot_plugins.find(p => p.id === 'guguwebui');
                
                if (guguwebui && guguwebui.version) {
                    versionElement.textContent = guguwebui.version;
                } else {
                    versionElement.textContent = '未知';
                }
            }
        } catch (error) {
            console.error('获取WebUI版本失败:', error);
            const versionElement = document.getElementById('web-version');
            if (versionElement) {
                versionElement.textContent = '获取失败';
            }
        }
    }
    
    // 获取版本
    getWebUIVersion();
}); 