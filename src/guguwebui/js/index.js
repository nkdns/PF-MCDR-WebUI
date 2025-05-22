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
        
        controlServer: async function(action) {
            if (this.processingServer) return;
            
            this.processingServer = true;
            
            try {
                const response = await fetch('api/control_server', {
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
        
        // pip管理功能的方法
        refreshPipPackages: async function() {
            this.loadingPipPackages = true;
            try {
                const response = await fetch('api/pip/list');
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
                const response = await fetch('api/pip/install', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ package: this.newPipPackage })
                });
                
                this.trackPipOperation(response);
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
                const response = await fetch('api/pip/uninstall', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ package: packageName })
                });
                
                this.trackPipOperation(response);
            } catch (error) {
                console.error('Error uninstalling pip package:', error);
                this.pipOutput.push('卸载失败: ' + error.message);
                this.showNotificationMsg('卸载pip包失败', 'error');
                this.uninstallingPip = false;
            }
        },
        
        trackPipOperation: async function(response) {
            if (!response.ok) {
                const errorText = await response.text();
                this.pipOutput.push('操作失败: ' + errorText);
                this.showNotificationMsg('pip操作失败', 'error');
                this.installingPip = false;
                this.uninstallingPip = false;
                return;
            }
            
            const data = await response.json();
            if (data.status !== 'success' || !data.task_id) {
                this.pipOutput.push('操作失败: ' + (data.message || '未知错误'));
                this.showNotificationMsg('pip操作失败', 'error');
                this.installingPip = false;
                this.uninstallingPip = false;
                return;
            }
            
            const taskId = data.task_id;
            const checkProgress = async () => {
                try {
                    const statusResponse = await fetch(`api/pip/task_status?task_id=${taskId}`);
                    const statusData = await statusResponse.json();
                    
                    if (statusData.status === 'success') {
                        // 更新输出日志
                        if (statusData.output && statusData.output.length > 0) {
                            this.pipOutput = statusData.output;
                        }
                        
                        // 任务完成
                        if (statusData.completed) {
                            if (statusData.success) {
                                this.showNotificationMsg('pip操作成功完成', 'success');
                            } else {
                                this.showNotificationMsg('pip操作失败', 'error');
                            }
                            this.installingPip = false;
                            this.uninstallingPip = false;
                            this.newPipPackage = '';
                            this.refreshPipPackages();
                            return;
                        }
                        
                        // 继续检查进度
                        setTimeout(checkProgress, 1000);
                    } else {
                        this.pipOutput.push('获取任务状态失败: ' + (statusData.message || '未知错误'));
                        this.installingPip = false;
                        this.uninstallingPip = false;
                    }
                } catch (error) {
                    console.error('Error checking pip task status:', error);
                    this.pipOutput.push('获取任务状态失败: ' + error.message);
                    this.installingPip = false;
                    this.uninstallingPip = false;
                }
            };
            
            // 开始检查进度
            checkProgress();
        },
        
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
            
            const response = await fetch('api/gugubot_plugins');
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