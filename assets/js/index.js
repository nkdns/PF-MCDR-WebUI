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
        
        // pip管理相关变量
        pipPackages: [],
        loadingPipPackages: true,
        pipOutput: [],
        showInstallPipModal: false,
        newPipPackage: '',
        installingPip: false,
        uninstallingPip: false,

        checkLoginStatus: async function() {
            try {
                // 检查localStorage中的登录状态
                const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
                if (isLoggedIn) {
                    this.userName = localStorage.getItem('username') || '演示用户';
                } else {
                    // 如果未登录，重定向到登录页面
                    window.location.href = 'login.html';
                }
            } catch (error) {
                console.error('Error checking login status:', error);
            }
        },
        
        checkServerStatus: async function() {
            try {
                this.serverStatus = 'loading';
                const response = await fetch('data/server_status.json');
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
                // 模拟服务器控制操作
                this.showNotificationMsg(`服务器${action === 'start' ? '启动' : (action === 'stop' ? '停止' : '重启')}命令已发送（演示模式）`, 'success');
                
                // 延迟几秒后刷新服务器状态
                setTimeout(() => this.checkServerStatus(), 3000);
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
        
        // pip管理功能的方法
        refreshPipPackages: async function() {
            this.loadingPipPackages = true;
            try {
                const response = await fetch('data/pip_packages.json');
                const data = await response.json();
                
                if (data.status === 'success') {
                    this.pipPackages = data.packages || [];
                } else {
                    this.showNotificationMsg(`获取pip包列表失败: ${data.message || '未知错误'}`, 'error');
                    this.pipPackages = [];
                }
            } catch (error) {
                console.error('Error fetching pip packages:', error);
                this.showNotificationMsg('获取pip包列表失败', 'error');
                this.pipPackages = [];
            } finally {
                this.loadingPipPackages = false;
            }
        },
        
        installPipPackage: async function() {
            if (!this.newPipPackage || this.installingPip) return;
            
            this.installingPip = true;
            this.pipOutput = [];
            this.showInstallPipModal = false;
            
            try {
                // 模拟安装过程
                this.pipOutput.push('正在安装包...');
                this.pipOutput.push('收集包信息...');
                this.pipOutput.push('下载包文件...');
                
                // 模拟延迟
                setTimeout(() => {
                    this.pipOutput.push('安装完成！');
                    this.showNotificationMsg('pip包安装成功（演示模式）', 'success');
                    this.installingPip = false;
                    this.newPipPackage = '';
                    this.refreshPipPackages();
                }, 2000);
                
            } catch (error) {
                console.error('Error installing pip package:', error);
                this.pipOutput.push('安装失败: ' + error.message);
                this.showNotificationMsg('安装pip包失败', 'error');
                this.installingPip = false;
            }
        },
        
        uninstallPipPackage: async function(packageName) {
            if (!packageName || this.uninstallingPip) return;
            
            this.uninstallingPip = true;
            this.pipOutput = [];
            
            try {
                // 模拟卸载过程
                this.pipOutput.push(`正在卸载包 ${packageName}...`);
                this.pipOutput.push('收集包信息...');
                this.pipOutput.push('删除包文件...');
                
                // 模拟延迟
                setTimeout(() => {
                    this.pipOutput.push('卸载完成！');
                    this.showNotificationMsg(`pip包 ${packageName} 卸载成功（演示模式）`, 'success');
                    this.uninstallingPip = false;
                    this.refreshPipPackages();
                }, 2000);
                
            } catch (error) {
                console.error('Error uninstalling pip package:', error);
                this.pipOutput.push('卸载失败: ' + error.message);
                this.showNotificationMsg('卸载pip包失败', 'error');
                this.uninstallingPip = false;
            }
        },
        
        // trackPipOperation 函数已移除，因为演示模式不需要跟踪任务状态
        
        formatPipOutput: function(output) {
            if (!output || output.length === 0) return '';
            
            return output.map(line => {
                // 对关键词进行着色
                line = line.replace(/ERROR/gi, '<span class="text-red-500">ERROR</span>');
                line = line.replace(/WARNING/gi, '<span class="text-yellow-500">WARNING</span>');
                line = line.replace(/Successfully/gi, '<span class="text-green-500">Successfully</span>');
                line = line.replace(/Successfully installed/gi, '<span class="text-green-500">Successfully installed</span>');
                line = line.replace(/\b(version|versions)\b/gi, '<span class="text-blue-400">$1</span>');
                
                return line;
            }).join('<br>');
        },
        
        init() {
            this.checkLoginStatus();
            this.checkServerStatus();
            this.refreshPipPackages();
            
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
            
            // 演示模式，直接设置版本号
            versionElement.textContent = '1.0.0 (演示版)';
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