// 本地插件页面的JavaScript功能 - 演示模式
document.addEventListener('alpine:init', () => {
    Alpine.data('pluginsData', () => ({
        // 演示模式标识
        isDemoMode: true,
        
        serverStatus: 'online', // 演示模式固定为在线
        userName: '演示用户',
        serverVersion: '1.20.1',
        serverPlayers: '5/20',
        plugins: [],
        loading: true,
        searchQuery: '',
        notificationMessage: '',
        notificationType: 'success',
        showNotification: false,
        processingPlugins: {},
        showConfigModal: false,
        currentPlugin: null,
        configFiles: [],
        selectedFile: '',
        configContent: '',
        showEditor: false,
        editorMode: 'code', // 'code' or 'form'
        configData: {},
        configTranslations: {},
        showInstallModal: false,
        installStatus: 'pending',
        installProgress: 0,
        installMessage: '',
        installPluginId: '',
        installLogMessages: [],
        showConfirmModal: false,
        confirmType: '',
        confirmTitle: '',
        confirmMessage: '',
        confirmAction: null,
        showVersionModal: false,
        versionsLoading: false,
        versions: [],
        versionError: false,
        versionErrorMessage: '',
        currentVersionPlugin: null, 
        installedVersion: '',
        currentPluginRepository: {
            name: '官方仓库',
            url: 'https://api.mcdreforged.com/catalogue/everything_slim.json.xz',
            is_official: true
        },
        pluginRepositories: [],

        // 版本比较函数
        compareVersions(v1, v2) {
            if (!v1 || !v2) return 0;
            const parts1 = v1.split('.').map(Number);
            const parts2 = v2.split('.').map(Number);
            const maxLength = Math.max(parts1.length, parts2.length);
            
            for (let i = 0; i < maxLength; i++) {
                const part1 = parts1[i] || 0;
                const part2 = parts2[i] || 0;
                if (part1 > part2) return 1;
                if (part1 < part2) return -1;
            }
            return 0;
        },

        // 演示模式：检查登录状态
        async checkLoginStatus() {
            // 演示模式直接返回成功
            this.userName = '演示用户';
            return true;
        },

        // 演示模式：检查服务器状态
        async checkServerStatus() {
            // 演示模式固定为在线
            this.serverStatus = 'online';
            this.serverVersion = '1.20.1';
            this.serverPlayers = '5/20';
        },

        // 演示模式：加载插件列表
        async loadPlugins() {
            this.loading = true;
            try {
                // 使用本地数据
                const response = await fetch('../data/plugins/plugins_detail.json');
                const data = await response.json();
                this.plugins = data.plugins || [];
                
                // 为演示模式设置默认仓库
                    this.plugins.forEach(plugin => {
                    if (!plugin.repository || plugin.repository === null) {
                        plugin.repository = '官方仓库';
                        }
                    });
                    
                // 模拟加载延迟
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error('演示模式：加载插件数据失败', error);
                this.plugins = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 演示模式：加载插件仓库
        async loadPluginRepositories() {
            try {
                const response = await fetch('../data/plugins/plugin_repository.json');
                const data = await response.json();
                this.pluginRepositories = data || [];
            } catch (error) {
                console.error('演示模式：加载插件仓库失败', error);
                this.pluginRepositories = [];
            }
        },

        // 演示模式：切换插件状态
        async togglePlugin(pluginId, targetStatus) {
            this.showDemoModeNotification('切换插件状态');
        },

        // 演示模式：重载插件
        async reloadPlugin(pluginId) {
            this.showDemoModeNotification('重载插件');
        },

        // 演示模式：更新插件
        async updatePlugin(pluginId) {
            this.showDemoModeNotification('更新插件');
        },

        // 演示模式：安装插件
        async installPlugin(pluginId) {
            this.showDemoModeNotification('安装插件');
        },

        // 演示模式：检查安装进度
        async checkInstallProgress() {
            // 演示模式不执行任何操作
        },

        // 演示模式：关闭安装模态窗口
        closeInstallModal() {
                this.showInstallModal = false;
            this.installStatus = 'pending';
                this.installProgress = 0;
                this.installMessage = '';
                this.installPluginId = '';
                this.installLogMessages = [];
        },

        // 获取插件状态样式
        getPluginStatus(plugin) {
            if (plugin.status === true || plugin.status === 'loaded') {
                return 'border-l-4 border-l-green-500';
            } else if (plugin.status === false || plugin.status === 'disabled') {
                return 'border-l-4 border-l-gray-500';
            } else if (plugin.status === 'unloaded') {
                return 'border-l-4 border-l-yellow-500';
            }
            return '';
        },

        // 过滤插件
        filterPlugins() {
            if (!this.searchQuery) {
                return this.plugins;
            }
            const query = this.searchQuery.toLowerCase();
            return this.plugins.filter(plugin => 
                (plugin.name && plugin.name.toLowerCase().includes(query)) ||
                (plugin.id && plugin.id.toLowerCase().includes(query)) ||
                (plugin.description && plugin.description.toLowerCase().includes(query))
            );
        },

        // 显示演示模式通知
        showDemoModeNotification(operation) {
            this.notificationMessage = `演示模式不支持${operation}操作`;
            this.notificationType = 'error';
            this.showNotification = true;
            setTimeout(() => {
                this.showNotification = false;
            }, 3000);
        },

        // 显示通知消息
        showNotificationMsg(message, type = 'success') {
            this.notificationMessage = message;
            this.notificationType = type;
            this.showNotification = true;
            setTimeout(() => {
                this.showNotification = false;
            }, 3000);
        },

        // 演示模式：打开配置模态窗口
        async openConfigModal(plugin) {
            this.showDemoModeNotification('打开插件配置');
        },

        // 演示模式：打开配置文件
        async openConfigFile(file, mode = 'code') {
            this.showDemoModeNotification('打开配置文件');
        },

        // 演示模式：保存配置文件
        async saveConfigFile() {
            this.showDemoModeNotification('保存配置文件');
        },

        // 演示模式：关闭配置模态窗口
        closeConfigModal() {
            this.showConfigModal = false;
            this.currentPlugin = null;
            this.configFiles = [];
            this.selectedFile = '';
            this.configContent = '';
            this.showEditor = false;
            this.configData = {};
            this.configTranslations = {};
        },

        // 演示模式：关闭编辑器
        closeEditor() {
            this.showEditor = false;
            this.selectedFile = '';
            this.configContent = '';
            this.configData = {};
            this.configTranslations = {};
        },

        // 演示模式：重载当前文件
        async reloadCurrentFile(mode) {
            this.showDemoModeNotification('重载配置文件');
        },
        
        // 演示模式：卸载插件
        async uninstallPlugin(pluginId) {
            this.showDemoModeNotification('卸载插件');
        },

        // 演示模式：打开确认模态窗口
        openConfirmModal(type, pluginId, title, message, action) {
            this.showDemoModeNotification('确认操作');
        },

        // 演示模式：关闭确认模态窗口
        closeConfirmModal() {
            this.showConfirmModal = false;
        },
        
        // 演示模式：执行确认操作
        async executeConfirmedAction() {
            this.showDemoModeNotification('执行操作');
        },

        // 演示模式：显示插件版本
        async showPluginVersions(plugin) {
            this.versionsLoading = true;
            this.showVersionModal = true;
            this.currentVersionPlugin = plugin;
            this.installedVersion = plugin.version;
            
            try {
                // 查找插件对应的仓库信息
                this.currentPluginRepository = this.pluginRepositories.find(repo => 
                    repo.success && repo.repository && repo.repository.name === plugin.repository
                )?.repository || {
                    name: plugin.repository || '官方仓库',
                    url: 'https://api.mcdreforged.com/catalogue/everything_slim.json.xz',
                    is_official: true
                };
                
                // 生成模拟的版本数据
                const baseVersion = plugin.version || '1.0.0';
                const versionParts = baseVersion.split('.');
                const major = parseInt(versionParts[0]) || 1;
                const minor = parseInt(versionParts[1]) || 0;
                const patch = parseInt(versionParts[2]) || 0;
                
                this.versions = [
                    {
                        version: `${major}.${minor}.${patch + 2}`,
                        release_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                        download_count: Math.floor(Math.random() * 1000) + 100,
                        is_installed: false
                    },
                    {
                        version: `${major}.${minor}.${patch + 1}`,
                        release_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
                        download_count: Math.floor(Math.random() * 500) + 50,
                        is_installed: false
                    },
                    {
                        version: plugin.version,
                        release_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                        download_count: Math.floor(Math.random() * 2000) + 500,
                        is_installed: true
                    },
                    {
                        version: `${major}.${minor - 1}.${patch}`,
                        release_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
                        download_count: Math.floor(Math.random() * 300) + 20,
                        is_installed: false
                    }
                ];
                
                // 按版本号排序（新版本在前）
                this.versions.sort((a, b) => this.compareVersions(b.version, a.version));
                
                this.versionError = false;
                this.versionErrorMessage = '';
                
            } catch (error) {
                console.error('演示模式：加载版本信息失败', error);
                this.versionError = true;
                this.versionErrorMessage = '演示模式：加载版本信息失败';
                this.versions = [];
            } finally {
                this.versionsLoading = false;
            }
        },
        
        // 演示模式：切换插件版本
        async switchPluginVersion(version) {
            this.showDemoModeNotification('切换插件版本');
        },

        // 演示模式：关闭版本模态窗口
        closeVersionModal() {
            this.showVersionModal = false;
            this.versionsLoading = false;
            this.versions = [];
            this.versionError = false;
            this.versionErrorMessage = '';
            this.currentVersionPlugin = null;
            this.installedVersion = '';
            this.currentPluginRepository = null;
        },
        
        // 格式化日期
        formatDate(dateString) {
            if (!dateString) return '未知';
                const date = new Date(dateString);
            return date.toLocaleDateString('zh-CN');
        },

        // 格式化数字
        formatNumber(num) {
            if (!num) return '0';
            if (num >= 1000000) {
                return (num / 1000000).toFixed(1) + 'M';
            } else if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'K';
            }
            return num.toString();
        },

        // 初始化
        async init() {
            // 设置年份
            document.getElementById('year').textContent = new Date().getFullYear();
            
            // 检查登录状态
            await this.checkLoginStatus();
            
            // 检查服务器状态
            await this.checkServerStatus();
            
            // 加载插件仓库
            await this.loadPluginRepositories();
            
            // 加载插件列表
            await this.loadPlugins();
            
            // 显示演示模式提示
            setTimeout(() => {
                this.showNotificationMsg('当前为演示模式，所有操作仅作展示用途', 'success');
            }, 1000);
        }
    }));
});