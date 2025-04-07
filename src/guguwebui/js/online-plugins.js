// 在线插件页面的JavaScript功能
document.addEventListener('alpine:init', () => {
    Alpine.data('onlinePluginsData', () => ({
        serverStatus: 'loading',
        userName: '',
        serverVersion: '',
        serverPlayers: '0/0',
        plugins: [],
        localPlugins: [], // 本地已安装的插件列表
        loading: true,
        processingPlugins: {},
        searchQuery: '',
        currentPage: 1,
        itemsPerPage: 10,
        showNotification: false,
        notificationMessage: '',
        notificationType: 'success',
        showPluginModal: false,
        currentPlugin: null,
        // 添加插件浏览历史
        pluginHistory: [],
        showRepoModal: false,
        currentRepoUrl: '',
        sortMethod: 'time', // 'name', 'time'
        sortDirection: 'desc', // 'asc', 'desc'
        
        // 插件安装相关属性
        installTaskId: null,
        installProgress: 0,
        installMessage: '',
        installStatus: 'pending', // pending, running, completed, failed
        showInstallModal: false,
        installPluginId: '',
        installLogMessages: [],
        installProgressTimer: null,
        
        async checkLoginStatus() {
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
        
        async checkServerStatus() {
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
        
        // 加载本地插件信息
        async loadLocalPlugins() {
            try {
                const response = await fetch('/api/plugins?detail=true');
                const data = await response.json();
                if (data && data.plugins) {
                    this.localPlugins = data.plugins;
                    console.log('已加载本地插件信息:', this.localPlugins.length);
                }
            } catch (error) {
                console.error('加载本地插件信息失败:', error);
                this.localPlugins = [];
            }
        },
        
        // 检查插件是否已安装
        isPluginInstalled(pluginId) {
            return this.localPlugins.some(p => p.id === pluginId);
        },
        
        // 获取已安装插件的版本
        getInstalledPluginVersion(pluginId) {
            const plugin = this.localPlugins.find(p => p.id === pluginId);
            return plugin ? plugin.version : null;
        },
        
        // 检查插件是否已安装且为最新版本
        isPluginUpToDate(pluginId, latestVersion) {
            const plugin = this.localPlugins.find(p => p.id === pluginId);
            return plugin && plugin.version === plugin.version_latest && plugin.version === latestVersion;
        },
        
        async loadPlugins() {
            try {
                this.loading = true;
                
                // 先加载本地插件信息
                await this.loadLocalPlugins();
                
                // 再加载在线插件信息
                const response = await fetch('/api/online-plugins');
                const data = await response.json();
                this.plugins = data || [];
                this.loading = false;
                
                // 确保每个插件的处理状态被正确初始化
                if (this.plugins && this.plugins.length > 0) {
                    this.plugins.forEach(plugin => {
                        if (!this.processingPlugins.hasOwnProperty(plugin.id)) {
                            this.processingPlugins[plugin.id] = false;
                        }
                    });
                }
            } catch (error) {
                console.error('Error loading online plugins:', error);
                this.loading = false;
                this.showNotificationMsg('加载在线插件列表失败', 'error');
            }
        },
        
        filterPlugins() {
            if (!this.searchQuery) return this.sortPlugins(this.plugins);
            
            const query = this.searchQuery.toLowerCase();
            const filtered = this.plugins.filter(plugin => {
                if (!plugin) return false;
                
                return (
                    (plugin.id && plugin.id.toLowerCase().includes(query)) ||
                    (plugin.name && plugin.name.toLowerCase().includes(query)) ||
                    (plugin.description && plugin.description.zh_cn && plugin.description.zh_cn.toLowerCase().includes(query)) ||
                    (plugin.description && plugin.description.en_us && plugin.description.en_us.toLowerCase().includes(query)) ||
                    (plugin.authors && Array.isArray(plugin.authors) && plugin.authors.some(author => author && author.name && author.name.toLowerCase().includes(query)))
                );
            });
            
            return this.sortPlugins(filtered);
        },
        
        sortPlugins(pluginsArray) {
            if (!pluginsArray || pluginsArray.length === 0) return [];
            
            const sorted = [...pluginsArray];
            
            if (this.sortMethod === 'name') {
                sorted.sort((a, b) => {
                    if (!a || !b) return 0;
                    const nameA = (a.name || a.id || '').toLowerCase();
                    const nameB = (b.name || b.id || '').toLowerCase();
                    return this.sortDirection === 'asc' 
                        ? nameA.localeCompare(nameB) 
                        : nameB.localeCompare(nameA);
                });
            } else if (this.sortMethod === 'time') {
                sorted.sort((a, b) => {
                    if (!a || !b) return 0;
                    const timeA = a.last_update_time ? new Date(a.last_update_time).getTime() : 0;
                    const timeB = b.last_update_time ? new Date(b.last_update_time).getTime() : 0;
                    return this.sortDirection === 'asc' 
                        ? timeA - timeB 
                        : timeB - timeA;
                });
            }
            
            return sorted;
        },
        
        toggleSortMethod(method) {
            if (this.sortMethod === method) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortMethod = method;
                this.sortDirection = method === 'time' ? 'desc' : 'asc'; // 默认时间是最新的在前
            }
            this.currentPage = 1; // 重置到第一页
        },
        
        getPaginatedPlugins() {
            const filtered = this.filterPlugins();
            const start = (this.currentPage - 1) * this.itemsPerPage;
            const end = start + this.itemsPerPage;
            return filtered.slice(start, end);
        },
        
        getTotalPages() {
            return Math.ceil(this.filterPlugins().length / this.itemsPerPage);
        },
        
        goToPage(page) {
            if (page < 1 || page > this.getTotalPages()) return;
            this.currentPage = page;
        },
        
        getPageNumbers() {
            const totalPages = this.getTotalPages();
            if (totalPages <= 7) {
                return Array.from({length: totalPages}, (_, i) => i + 1);
            }
            
            let pages = [];
            
            // 始终显示第一页
            pages.push(1);
            
            if (this.currentPage > 3) {
                pages.push('...');
            }
            
            // 当前页附近的页码
            let start = Math.max(2, this.currentPage - 1);
            let end = Math.min(totalPages - 1, this.currentPage + 1);
            
            // 确保在开始和结束位置显示更多页码
            if (this.currentPage <= 3) {
                end = Math.min(5, totalPages - 1);
            }
            
            if (this.currentPage >= totalPages - 2) {
                start = Math.max(2, totalPages - 4);
            }
            
            // 添加当前页附近的页码
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
            
            if (this.currentPage < totalPages - 2) {
                pages.push('...');
            }
            
            // 始终显示最后一页
            if (totalPages > 1) {
                pages.push(totalPages);
            }
            
            return pages;
        },
        
        showPluginDetails(plugin) {
            // 如果当前已经显示插件详情，将其加入历史记录
            if (this.currentPlugin) {
                this.pluginHistory.push(this.currentPlugin);
            }
            this.currentPlugin = plugin;
            this.showPluginModal = true;
        },
        
        // 返回到上一个插件详情
        goBackToPlugin() {
            if (this.pluginHistory.length > 0) {
                this.currentPlugin = this.pluginHistory.pop();
            }
        },
        
        // 显示依赖插件的详情
        showDependencyDetails(dependencyId) {
            // 排除MCDR自身
            if (dependencyId.toLowerCase() === 'mcdreforged') {
                return;
            }
            
            // 查找依赖插件
            const dependencyPlugin = this.plugins.find(p => p.id === dependencyId);
            if (dependencyPlugin) {
                // 将当前插件加入历史记录
                this.pluginHistory.push(this.currentPlugin);
                // 显示依赖插件详情
                this.currentPlugin = dependencyPlugin;
            } else {
                // 依赖插件不在当前列表中，可能需要刷新插件列表
                this.showNotificationMsg(`未找到插件 ${dependencyId} 的详细信息，尝试刷新插件列表...`, 'info');
                
                // 尝试刷新整个插件列表
                this.loadPlugins().then(() => {
                    // 重新查找依赖插件
                    const refreshedDependency = this.plugins.find(p => p.id === dependencyId);
                    if (refreshedDependency) {
                        // 将当前插件加入历史记录
                        this.pluginHistory.push(this.currentPlugin);
                        // 显示依赖插件详情
                        this.currentPlugin = refreshedDependency;
                    } else {
                        this.showNotificationMsg(`刷新后仍未找到插件 ${dependencyId}`, 'error');
                    }
                });
            }
        },
        
        closePluginModal() {
            this.showPluginModal = false;
            this.currentPlugin = null;
            // 清空插件历史
            this.pluginHistory = [];
        },
        
        showRepositoryPage(pluginId) {
            this.currentRepoUrl = 'https://mcdreforged.com/zh-CN/plugin/' + pluginId;
            this.showRepoModal = true;
        },
        
        closeRepoModal() {
            this.showRepoModal = false;
            this.currentRepoUrl = '';
        },
        
        async installPlugin(pluginId) {
            if (this.processingPlugins[pluginId]) return;
            
            // 前端拦截guguwebui安装请求
            if (pluginId === "guguwebui") {
                this.showNotificationMsg('不允许安装WebUI自身，这可能会导致WebUI无法正常工作', 'error');
                return;
            }
            
            this.processingPlugins[pluginId] = true;
            
            try {
                // 准备安装模态框
                this.installPluginId = pluginId;
                this.installProgress = 0;
                this.installMessage = '正在准备安装...';
                this.installStatus = 'running';
                this.installLogMessages = [];
                this.showInstallModal = true;
                
                // 尝试使用新版PIM安装器API
                let response = await fetch('/api/pim/install_plugin', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        plugin_id: pluginId
                    })
                });
                
                let result = await response.json();
                
                // 判断是否成功使用PIM API
                if (result.success) {
                    // 使用PIM API成功
                    this.installTaskId = result.task_id;
                    console.log(`使用PIM API安装插件 ${pluginId}, 任务ID: ${result.task_id}`);
                    
                    // 开始轮询安装进度，2秒查询一次
                    this.installProgressTimer = setInterval(() => {
                        this.checkInstallProgress();
                    }, 2000);
                    
                    // 立即执行一次查询，避免等待第一个间隔
                    this.checkInstallProgress();
                } else if (response.status !== 404 && !result.error?.includes('未知API')) {
                    // PIM API请求失败，但服务端存在此API（非404错误）
                    this.installStatus = 'failed';
                    this.installMessage = `安装失败: ${result.error || ''}`;
                    this.showNotificationMsg(`安装插件失败: ${result.error || ''}`, 'error');
                    this.processingPlugins[pluginId] = false;
                } else {
                    // 回退到旧版API
                    console.error('PIM API不可用');
                    this.installStatus = 'failed';
                    this.installMessage = 'PIM 安装器不可用，请向开发者反馈！';
                    this.installLogMessages.push('PIM安装器不可用，请向开发者反馈！');
                    this.showNotificationMsg('PIM 安装器不可用，请向开发者反馈！', 'error');
                    this.processingPlugins[pluginId] = false;
                }
            } catch (error) {
                console.error(`Error installing plugin ${pluginId}:`, error);
                this.installStatus = 'failed';
                this.installMessage = '安装插件失败';
                this.showNotificationMsg('安装插件失败', 'error');
                this.processingPlugins[pluginId] = false;
            }
        },
        
        // 检查安装进度
        async checkInstallProgress() {
            if (!this.installTaskId) return;
            
            try {
                console.log(`检查任务 ${this.installTaskId} 进度，插件ID: ${this.installPluginId}`);
                // 添加插件ID作为备用参数
                const response = await fetch(`/api/pim/task_status?task_id=${this.installTaskId}&plugin_id=${this.installPluginId}`);
                const data = await response.json();
                
                if (data.success && data.task_info) {
                    const taskInfo = data.task_info;
                    console.log('收到任务信息:', taskInfo);
                    
                    // 更新进度和消息
                    this.installProgress = taskInfo.progress * 100;
                    this.installMessage = taskInfo.message || '处理中...';
                    this.installStatus = taskInfo.status;
                    
                    // 更新日志消息
                    if (taskInfo.all_messages && Array.isArray(taskInfo.all_messages)) {
                        this.installLogMessages = taskInfo.all_messages;
                    } else if (taskInfo.error_messages && Array.isArray(taskInfo.error_messages)) {
                        this.installLogMessages = taskInfo.error_messages;
                    }
                    
                    // 强制立即更新DOM
                    this.$nextTick(() => {
                        const progressBar = document.getElementById('install-progress-bar');
                        const progressText = document.getElementById('install-progress-text');
                        if (progressBar) {
                            progressBar.style.width = `${this.installProgress}%`;
                        }
                        if (progressText) {
                            progressText.textContent = `${Math.round(this.installProgress)}%`;
                        }
                    });
                    
                    // 检查任务是否完成
                    if (taskInfo.status === 'completed' || taskInfo.status === 'failed') {
                        // 停止轮询
                        clearInterval(this.installProgressTimer);
                        this.installProgressTimer = null;
                        
                        // 加载最新的插件列表
                        await this.loadPlugins();
                        
                        // 设置处理状态
                        this.processingPlugins[this.installPluginId] = false;
                        
                        // 显示完成通知
                        if (taskInfo.status === 'completed') {
                            this.showNotificationMsg(`插件 ${this.installPluginId} 操作成功！`, 'success');
                        } else {
                            this.showNotificationMsg(`插件 ${this.installPluginId} 操作失败: ${taskInfo.message}`, 'error');
                        }
                    }
                } else if (response.status === 404 || (data.error && data.error.includes('不存在'))) {
                    console.log(`任务 ${this.installTaskId} 不存在，尝试刷新插件列表检查状态`);
                    
                    // 重新尝试直接使用插件ID查询
                    try {
                        const retryResponse = await fetch(`/api/pim/task_status?plugin_id=${this.installPluginId}`);
                        const retryData = await retryResponse.json();
                        
                        if (retryData.success && retryData.task_info) {
                            console.log(`找到插件 ${this.installPluginId} 的任务`, retryData.task_info);
                            // 更新任务ID和任务信息
                            this.installTaskId = retryData.task_info.id || this.installTaskId;
                            
                            // 更新进度和消息
                            this.installProgress = retryData.task_info.progress * 100;
                            this.installMessage = retryData.task_info.message || '处理中...';
                            this.installStatus = retryData.task_info.status;
                            
                            // 如果任务已经完成或失败
                            if (retryData.task_info.status === 'completed' || retryData.task_info.status === 'failed') {
                                // 停止轮询
                                clearInterval(this.installProgressTimer);
                                this.installProgressTimer = null;
                                
                                // 刷新插件列表
                                await this.loadPlugins();
                                
                                // 设置处理状态
                                this.processingPlugins[this.installPluginId] = false;
                                
                                // 显示通知
                                if (retryData.task_info.status === 'completed') {
                                    this.showNotificationMsg(`插件 ${this.installPluginId} 操作成功！`, 'success');
                                } else {
                                    this.showNotificationMsg(`插件 ${this.installPluginId} 操作失败: ${retryData.task_info.message}`, 'error');
                                }
                                return;
                            }
                            
                            // 如果找到了正在进行的任务，继续轮询
                            return;
                        }
                    } catch (retryError) {
                        console.warn('重试查询任务状态失败:', retryError);
                    }
                    
                    // 检查插件是否已经安装成功（通过加载插件列表来检查）
                    await this.loadPlugins();
                    
                    // 标记为完成
                    this.installStatus = 'completed';
                    this.installProgress = 100;
                    this.installMessage = `插件 ${this.installPluginId} 操作可能已完成，请检查插件列表`;
                    
                    // 停止轮询
                    clearInterval(this.installProgressTimer);
                    this.installProgressTimer = null;
                    
                    // 设置处理状态
                    this.processingPlugins[this.installPluginId] = false;
                    
                    // 显示通知
                    this.showNotificationMsg(`任务状态未知，请检查插件列表确认是否成功`, 'info');
                } else if (data.error) {
                    console.warn('获取任务状态出错，但将继续尝试:', data.error);
                    this.installMessage = "获取任务状态出错，但操作可能正在进行中...";
                    this.installLogMessages.push(`获取任务状态出错: ${data.error}`);
                }
            } catch (error) {
                console.error('Error checking install progress:', error);
                // 错误可能是暂时的，继续轮询
                this.installMessage = "获取任务状态出错，但操作可能正在进行中...";
                this.installLogMessages.push(`获取任务状态出错: ${error.message}`);
            }
        },
        
        // 关闭安装模态框
        closeInstallModal() {
            if (this.installStatus === 'running') {
                // 如果任务仍在运行，只关闭模态框但继续轮询进度
                this.showInstallModal = false;
            } else {
                // 完全清理状态
                this.showInstallModal = false;
                this.installTaskId = null;
                this.installProgress = 0;
                this.installMessage = '';
                this.installStatus = 'pending';
                this.installPluginId = '';
                this.installLogMessages = [];
                
                if (this.installProgressTimer) {
                    clearInterval(this.installProgressTimer);
                    this.installProgressTimer = null;
                }
            }
        },
        
        showNotificationMsg(message, type = 'success') {
            this.notificationMessage = message;
            this.notificationType = type;
            this.showNotification = true;
            
            setTimeout(() => {
                this.showNotification = false;
            }, 5000);
        },
        
        getPluginDescription(plugin) {
            if (!plugin.description) return '';
            return plugin.description.zh_cn || plugin.description.en_us || '';
        },
        
        formatDate(dateString) {
            if (!dateString) return '';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } catch (e) {
                return dateString;
            }
        },
        
        init() {
            this.checkLoginStatus();
            this.checkServerStatus();
            this.loadPlugins();
            
            // 初始化处理中插件状态
            this.processingPlugins = {};
            
            // 每60秒自动刷新服务器状态
            setInterval(() => this.checkServerStatus(), 60000);
            
            // 保存主题设置到本地存储
            this.$watch('darkMode', value => {
                localStorage.setItem('darkMode', value);
            });

            // 重置分页
            this.$watch('searchQuery', () => {
                this.currentPage = 1;
            });
            
            // 监视排序方法和方向的变化
            this.$watch('sortMethod', () => {
                // 强制重新计算分页数据
                const temp = this.currentPage;
                this.currentPage = 0;
                this.currentPage = temp;
            });
            
            this.$watch('sortDirection', () => {
                // 强制重新计算分页数据
                const temp = this.currentPage;
                this.currentPage = 0;
                this.currentPage = temp;
            });
            
            // 设置当前年份
            const yearElement = document.getElementById('year');
            if (yearElement) {
                yearElement.textContent = new Date().getFullYear();
            }
        }
    }));
});