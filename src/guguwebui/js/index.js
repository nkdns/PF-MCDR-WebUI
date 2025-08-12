// 控制面板页面的JavaScript功能
document.addEventListener('alpine:init', () => {
    Alpine.data('indexData', () => ({
        // i18n（仅本页用）
        indexLang: 'zh-CN',
        indexDict: {},
        t(key, fallback = '') {
            const val = key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), this.indexDict);
            if (val != null) return String(val);
            if (window.I18n && typeof window.I18n.t === 'function') {
                const v = window.I18n.t(key);
                if (v && v !== key) return v;
            }
            return fallback || key;
        },
        async loadLangDict() {
            const stored = localStorage.getItem('lang') || (navigator.language || 'zh-CN');
            this.indexLang = stored.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
            try {
                if (window.I18n && typeof window.I18n.fetchLangDict === 'function') {
                    this.indexDict = await window.I18n.fetchLangDict(this.indexLang);
                } else {
                    const resp = await fetch(`lang/${this.indexLang}.json`, { cache: 'no-cache' });
                    if (resp.ok) {
                        this.indexDict = await resp.json();
                    } else {
                        this.indexDict = {};
                    }
                }
            } catch (e) {
                console.warn('index loadLangDict failed:', e);
                this.indexDict = {};
            }
        },
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
                    const actionText = action === 'start'
                        ? this.t('page.index.msg.action_start', '启动')
                        : (action === 'stop' ? this.t('page.index.msg.action_stop', '停止') : this.t('page.index.msg.action_restart', '重启'));
                    const msg = data.message || (
                        this.t('page.index.msg.control_sent_prefix', '服务器') + actionText + this.t('page.index.msg.control_sent_suffix', '命令已发送')
                    );
                    this.showNotificationMsg(msg, 'success');
                    
                    // 延迟几秒后刷新服务器状态
                    setTimeout(() => this.checkServerStatus(), 5000);
                } else {
                    this.showNotificationMsg(
                        this.t('page.index.msg.control_failed_prefix', '操作失败: ') + (data.message || this.t('common.unknown', '未知错误')),
                        'error'
                    );
                }
            } catch (error) {
                console.error('Error controlling server:', error);
                this.showNotificationMsg(this.t('page.index.msg.control_error', '服务器控制操作失败'), 'error');
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
                    this.showNotificationMsg(
                        this.t('page.index.msg.pip_list_failed_prefix', '获取pip包列表失败: ') + (data.message || this.t('common.unknown', '未知错误')),
                        'error'
                    );
                    this.pipPackages = [];
                }
            } catch (error) {
                console.error('Error fetching pip packages:', error);
                this.showNotificationMsg(this.t('page.index.msg.pip_list_failed', '获取pip包列表失败'), 'error');
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
                this.pipOutput.push(this.t('page.index.msg.install_failed_prefix', '安装失败: ') + error.message);
                this.showNotificationMsg(this.t('page.index.msg.install_pip_failed', '安装pip包失败'), 'error');
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
                this.pipOutput.push(this.t('page.index.msg.uninstall_failed_prefix', '卸载失败: ') + error.message);
                this.showNotificationMsg(this.t('page.index.msg.uninstall_pip_failed', '卸载pip包失败'), 'error');
                this.uninstallingPip = false;
            }
        },
        
        trackPipOperation: async function(response) {
            if (!response.ok) {
                const errorText = await response.text();
                this.pipOutput.push(this.t('page.index.msg.operation_failed_prefix', '操作失败: ') + errorText);
                this.showNotificationMsg(this.t('page.index.msg.pip_op_failed', 'pip操作失败'), 'error');
                this.installingPip = false;
                this.uninstallingPip = false;
                return;
            }
            
            const data = await response.json();
            if (data.status !== 'success' || !data.task_id) {
                this.pipOutput.push(this.t('page.index.msg.operation_failed_prefix', '操作失败: ') + (data.message || this.t('common.unknown', '未知错误')));
                this.showNotificationMsg(this.t('page.index.msg.pip_op_failed', 'pip操作失败'), 'error');
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
                                this.showNotificationMsg(this.t('page.index.msg.pip_op_succeeded', 'pip操作成功完成'), 'success');
                            } else {
                                this.showNotificationMsg(this.t('page.index.msg.pip_op_failed', 'pip操作失败'), 'error');
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
                        this.pipOutput.push(this.t('page.index.msg.get_task_status_failed_prefix', '获取任务状态失败: ') + (statusData.message || this.t('common.unknown', '未知错误')));
                        this.installingPip = false;
                        this.uninstallingPip = false;
                    }
                } catch (error) {
                    console.error('Error checking pip task status:', error);
                    this.pipOutput.push(this.t('page.index.msg.get_task_status_failed_prefix', '获取任务状态失败: ') + error.message);
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
            // 语言
            this.loadLangDict();
            document.addEventListener('i18n:changed', (e) => {
                const nextLang = (e && e.detail && e.detail.lang) ? e.detail.lang : this.indexLang;
                this.indexLang = nextLang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
                this.loadLangDict();
            });

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