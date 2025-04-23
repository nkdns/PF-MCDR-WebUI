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
        sortMethod: 'time', // 'name', 'time', 'downloads'
        sortDirection: 'desc', // 'asc', 'desc'
        
        // 添加第三方仓库警告相关属性
        showRepoWarningModal: false,
        pendingRepositorySwitch: null,
        
        // 协议模态框相关属性
        showLicenseModal: false,
        currentLicense: null,
        licenseFetching: false,
        licenseError: false,
        
        // README相关属性
        showReadmeModal: false,
        currentReadmePlugin: null,
        readmeLoading: false,
        readmeError: false,
        readmeErrorMessage: '',
        vditor: null,
        readmeContent: '',
        readmeType: 'readme', // 'readme' 或 'catalogue'
        readmeUrl: '',
        catalogueUrl: '',
        
        // 插件安装相关属性
        installTaskId: null,
        installProgress: 0,
        installMessage: '',
        installStatus: 'pending', // pending, running, completed, failed
        showInstallModal: false,
        installPluginId: '',
        installLogMessages: [],
        installProgressTimer: null,
        
        // 添加仓库选择相关
        repositories: [],
        selectedRepository: null,
        
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
        
        async loadPlugins(skipRepositoryLoad = false) {
            try {
                this.loading = true;
                
                // 先加载本地插件信息
                await this.loadLocalPlugins();
                
                // 保存当前选择的仓库URL
                const currentRepoUrl = this.selectedRepository ? this.selectedRepository.url : null;
                
                // 加载仓库列表，除非明确跳过（如临时仓库模式）
                if (!skipRepositoryLoad) {
                    await this.loadRepositories(currentRepoUrl);
                }
                
                // 构建API URL，如果有选择仓库则添加repo_url参数
                let apiUrl = '/api/online-plugins';
                if (this.selectedRepository) {
                    apiUrl += `?repo_url=${encodeURIComponent(this.selectedRepository.url)}`;
                }
                
                // 加载在线插件信息
                const response = await fetch(apiUrl);
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
        
        // 加载仓库列表
        async loadRepositories(currentRepoUrl = null) {
            try {
                const response = await fetch('/api/get_web_config');
                const data = await response.json();
                
                // 添加官方仓库，编号为0
                this.repositories = [{
                    name: '官方仓库',
                    url: data.mcdr_plugins_url || 'https://api.mcdreforged.com/catalogue/everything_slim.json.xz',
                    repoId: 0  // 官方仓库编号为0
                }];
                
                // 添加树梢的仓库作为默认的第三方仓库选项
                const looseRepoUrl = 'https://looseprince.github.io/Plugin-Catalogue/plugins.json';
                const looseRepo = {
                    name: '树梢的仓库',
                    url: looseRepoUrl,
                    repoId: 1  // 给树梢的仓库一个固定的ID
                };
                this.repositories.push(looseRepo);
                
                // 添加用户配置的其他仓库，编号从2开始递增
                if (data.repositories && Array.isArray(data.repositories)) {
                    // 检查是否已经包含了树梢的仓库，避免重复添加
                    const otherRepos = data.repositories.filter(repo => repo.url !== looseRepoUrl);
                    const thirdPartyRepos = otherRepos.map((repo, index) => ({
                        ...repo,
                        repoId: index + 2  // 其他第三方仓库编号从2开始递增
                    }));
                    this.repositories = [...this.repositories, ...thirdPartyRepos];
                }
                
                // 如果有当前仓库URL，则尝试保持选中状态
                if (currentRepoUrl) {
                    const currentRepo = this.repositories.find(repo => repo.url === currentRepoUrl);
                    if (currentRepo) {
                        this.selectedRepository = currentRepo;
                        return;
                    }
                    
                    // 如果找不到匹配的仓库，但有URL，可能是临时仓库
                    this.selectedRepository = {
                        name: '临时仓库',
                        url: currentRepoUrl,
                        repoId: -1 // 临时仓库使用-1作为ID
                    };
                } else {
                    // 默认选择官方仓库
                    this.selectedRepository = this.repositories[0];
                }
                
            } catch (error) {
                console.error('Error loading repositories:', error);
                this.showNotificationMsg('加载仓库列表失败', 'error');
            }
        },
        
        // 切换仓库
        async switchRepository(repo) {
            if (this.selectedRepository && this.selectedRepository.url === repo.url) {
                return; // 不需要重新加载相同的仓库
            }
            
            // 检查是否需要显示第三方仓库警告
            if (repo.repoId !== 0 && this.shouldShowRepoWarning()) {
                // 保存待切换的仓库，等待用户确认
                this.pendingRepositorySwitch = repo;
                this.showRepoWarningModal = true;
                return;
            }
            
            // 直接切换仓库
            await this.doSwitchRepository(repo);
        },
        
        // 实际执行仓库切换操作
        async doSwitchRepository(repo) {
            this.selectedRepository = repo;
            this.showNotificationMsg(`正在从 ${repo.name} 加载插件列表...`, 'info');
            
            // 使用skipRepositoryLoad=true参数调用loadPlugins，避免覆盖临时仓库设置
            await this.loadPlugins(true);
        },
        
        // 检查是否应该显示第三方仓库警告
        shouldShowRepoWarning() {
            // 获取上次确认的时间戳
            const lastWarningTime = localStorage.getItem('thirdPartyRepoWarningTime');
            if (!lastWarningTime) {
                return true; // 从未确认过，显示警告
            }
            
            // 检查是否是同一天
            const lastTime = new Date(parseInt(lastWarningTime));
            const now = new Date();
            return lastTime.toDateString() !== now.toDateString();
        },
        
        // 确认第三方仓库警告
        confirmRepoWarning() {
            // 保存确认时间戳到本地存储
            localStorage.setItem('thirdPartyRepoWarningTime', Date.now().toString());
            
            // 关闭警告模态窗口
            this.showRepoWarningModal = false;
            
            // 如果有待切换的仓库，继续切换
            if (this.pendingRepositorySwitch) {
                this.doSwitchRepository(this.pendingRepositorySwitch);
                this.pendingRepositorySwitch = null;
            }
        },
        
        // 取消第三方仓库警告
        cancelRepoWarning() {
            this.showRepoWarningModal = false;
            this.pendingRepositorySwitch = null;
        },
        
        // 显示README内容
        async showReadme(plugin) {
            this.currentReadmePlugin = plugin;
            this.showReadmeModal = true;
            this.readmeLoading = true;
            this.readmeError = false;
            this.readmeErrorMessage = '';
            
            // 保存 README URL
            this.readmeUrl = plugin.readme_url;
            
            // 解析 Catalogue URL
            this.catalogueUrl = this.parseCatalogueUrl(plugin.readme_url);
            
            // 默认打开 Catalogue 文档（如果存在），否则打开 README
            this.readmeType = this.catalogueUrl ? 'catalogue' : 'readme';
            
            try {
                // 加载默认文档内容
                const defaultUrl = this.readmeType === 'readme' ? this.readmeUrl : this.catalogueUrl;
                await this.loadReadmeContent(defaultUrl);
                
            } catch (error) {
                console.error('Error loading content:', error);
                this.readmeError = true;
                this.readmeErrorMessage = error.message || '加载文档时出错';
                this.readmeLoading = false;
            }
        },
        
        // 从readme_url解析出catalogue_url
        parseCatalogueUrl(readmeUrl) {
            try {
                // 检查是否是GitHub的raw内容URL
                if (readmeUrl.includes('raw.githubusercontent.com')) {
                    // 提取仓库信息
                    const urlParts = readmeUrl.split('/');
                    const username = urlParts[3];
                    const repo = urlParts[4];
                    const branch = urlParts[5];
                    
                    // 构建catalogue_url - 保持原始URL的分支名和大小写风格
                    const lastPart = urlParts[urlParts.length - 1];
                    const readmeFileName = lastPart.toLowerCase() === 'readme.md' ? 'README.md' : 'readme.md';
                    
                    return `https://raw.githubusercontent.com/${username}/${repo}/${branch}/${readmeFileName}`;
                }
                
                // 如果不是GitHub的raw内容URL，尝试构建
                if (readmeUrl.includes('github.com')) {
                    // 将github.com转换为raw.githubusercontent.com
                    let url = readmeUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
                    
                    // 确保README文件名匹配
                    if (url.toLowerCase().endsWith('/readme.md')) {
                        const basePath = url.substring(0, url.toLowerCase().lastIndexOf('/readme.md'));
                        const readmeFileName = url.toLowerCase().endsWith('/readme.md') ? 'README.md' : 'readme.md';
                        url = `${basePath}/${readmeFileName}`;
                    }
                    
                    return url;
                }
                
                return '';
            } catch (error) {
                console.warn('解析catalogue_url失败:', error);
                return '';
            }
        },
        
        // 加载README内容
        async loadReadmeContent(url) {
            try {
                // 直接从url获取内容
                let response = await fetch(url);
                
                // 如果获取失败，尝试不同的文件名和分支名组合
                if (!response.ok) {
                    console.log(`初始URL获取失败: ${url}, 尝试其他路径组合`);
                    
                    // 生成备选URL
                    let alternativeUrls = [];
                    
                    if (url.includes('githubusercontent.com')) {
                        // 提取URL的各个部分
                        const parts = url.split('/');
                        if (parts.length >= 7) {
                            const username = parts[3];
                            const repo = parts[4];
                            const branch = parts[5];
                            const originalFilename = parts[parts.length - 1]; // 保持原始文件名，不转换大小写
                            
                            // 创建备选分支和文件名组合
                            const branches = ['master', 'main']; // 尝试所有可能的分支名
                            const filenames = ['README.md', 'readme.md']; // 尝试所有可能的文件名
                            
                            // 生成所有可能的组合
                            for (const altBranch of branches) {
                                for (const altFilename of filenames) {
                                    // 跳过原始URL的组合(已经尝试过了)
                                    if (altBranch === branch && altFilename === originalFilename) {
                                        continue;
                                    }
                                    const altUrl = `https://raw.githubusercontent.com/${username}/${repo}/${altBranch}/${altFilename}`;
                                    alternativeUrls.push(altUrl);
                                }
                            }
                        }
                    }
                    
                    // 依次尝试备选URL
                    for (const altUrl of alternativeUrls) {
                        // console.log(`尝试备选URL: ${altUrl}`);
                        response = await fetch(altUrl);
                        if (response.ok) {
                            // console.log(`成功获取内容: ${altUrl}`);
                            break;
                        }
                    }
                }
                
                if (!response.ok) {
                    throw new Error(`获取文档失败: ${response.status} ${response.statusText}`);
                }
                
                const content = await response.text();
                this.readmeContent = content;
                
                // 初始化或更新Vditor
                this.initVditor(content);
                
            } catch (error) {
                console.error('Error loading content:', error);
                this.readmeError = true;
                this.readmeErrorMessage = error.message || '加载文档时出错';
                this.readmeLoading = false;
            }
        },
        
        // 切换文档类型
        async switchReadmeType(type) {
            if (this.readmeType === type) return;
            
            this.readmeType = type;
            this.readmeLoading = true;
            
            try {
                const url = type === 'readme' ? this.readmeUrl : this.catalogueUrl;
                
                if (!url) {
                    throw new Error(`未找到${type === 'readme' ? '自述文件' : '介绍'}文档链接`);
                }
                
                await this.loadReadmeContent(url);
                
            } catch (error) {
                console.error(`Error switching to ${type}:`, error);
                this.readmeError = true;
                this.readmeErrorMessage = error.message || `切换到${type === 'readme' ? '自述文件' : '介绍'}文档时出错`;
                this.readmeLoading = false;
            }
        },
        
        // 初始化Vditor
        initVditor(content) {
            // 初始化Vditor
            if (!this.vditor) {
                this.vditor = new Vditor('vditor', {
                    mode: 'ir',
                    theme: this.darkMode ? 'dark' : 'classic',
                    preview: {
                        theme: {
                            current: this.darkMode ? 'dark' : 'light'
                        },
                        maxLength: 100000,
                        scrollable: true,
                        markdown: {
                            toc: true,
                            mark: true,
                            footnotes: true,
                            autoSpace: true,
                            fixTermTypo: true,
                            math: true,
                            mermaid: true,
                            plantuml: true,
                        }
                    },
                    cache: {
                        enable: false
                    },
                    toolbar: [],
                    counter: {
                        enable: false
                    },
                    upload: {
                        enable: false
                    },
                    select: {
                        enable: false
                    },
                    typewriterMode: false,
                    toolbarConfig: {
                        pin: false
                    },
                    after: () => {
                        // 在Vditor完全初始化后设置内容
                        this.vditor.setValue(content);
                        this.readmeLoading = false;
                        
                        // 确保内容可以滚动
                        const vditorElement = document.getElementById('vditor');
                        if (vditorElement) {
                            vditorElement.style.overflow = 'auto';
                            vditorElement.style.maxHeight = 'calc(90vh - 165px)';
                        }
                    }
                });
            } else {
                // 更新主题 - 修复主题设置问题
                try {
                    // 完全重新初始化Vditor以确保主题正确应用
                    this.vditor.destroy();
                    this.vditor = new Vditor('vditor', {
                        mode: 'ir',
                        theme: this.darkMode ? 'dark' : 'classic',
                        preview: {
                            theme: {
                                current: this.darkMode ? 'dark' : 'light'
                            },
                            maxLength: 100000,
                            scrollable: true,
                            markdown: {
                                toc: true,
                                mark: true,
                                footnotes: true,
                                autoSpace: true,
                                fixTermTypo: true,
                                math: true,
                                mermaid: true,
                                plantuml: true,
                            }
                        },
                        cache: {
                            enable: false
                        },
                        toolbar: [],
                        counter: {
                            enable: false
                        },
                        upload: {
                            enable: false
                        },
                        select: {
                            enable: false
                        },
                        typewriterMode: false,
                        toolbarConfig: {
                            pin: false
                        },
                        after: () => {
                            // 在Vditor完全初始化后设置内容
                            this.vditor.setValue(content);
                            this.readmeLoading = false;
                            
                            // 确保内容可以滚动
                            const vditorElement = document.getElementById('vditor');
                            if (vditorElement) {
                                vditorElement.style.overflow = 'auto';
                                vditorElement.style.maxHeight = 'calc(90vh - 165px)';
                            }
                        }
                    });
                } catch (themeError) {
                    console.warn('设置主题时出错，继续处理:', themeError);
                    
                    // 如果重新初始化失败，尝试直接设置内容
                    this.vditor.setValue(content);
                    this.readmeLoading = false;
                    
                    // 确保内容可以滚动
                    const vditorElement = document.getElementById('vditor');
                    if (vditorElement) {
                        vditorElement.style.overflow = 'auto';
                        vditorElement.style.maxHeight = 'calc(90vh - 165px)';
                    }
                }
            }
        },
        
        // 重试加载README
        retryLoadReadme() {
            if (this.currentReadmePlugin) {
                this.showReadme(this.currentReadmePlugin);
            }
        },
        
        // 关闭README模态窗口
        closeReadmeModal() {
            this.showReadmeModal = false;
            this.currentReadmePlugin = null;
            this.readmeLoading = false;
            this.readmeError = false;
            this.readmeErrorMessage = '';
        },
        
        // 格式化数字（添加千位分隔符）
        formatNumber(num) {
            if (num === undefined || num === null) return '0';
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
            } else if (this.sortMethod === 'downloads') {
                sorted.sort((a, b) => {
                    if (!a || !b) return 0;
                    const downloadsA = a.downloads || 0;
                    const downloadsB = b.downloads || 0;
                    return this.sortDirection === 'asc' 
                        ? downloadsA - downloadsB 
                        : downloadsB - downloadsA;
                });
            }
            
            return sorted;
        },
        
        toggleSortMethod(method) {
            if (this.sortMethod === method) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortMethod = method;
                // 默认排序方向：名称升序，时间和下载量降序
                this.sortDirection = (method === 'time' || method === 'downloads') ? 'desc' : 'asc';
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
                
                // 获取当前选择的仓库URL
                let repoUrl = null;
                if (this.selectedRepository) {
                    repoUrl = this.selectedRepository.url;
                }
                
                // 尝试使用新版PIM安装器API
                let response = await fetch('/api/pim/install_plugin', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        plugin_id: pluginId,
                        repo_url: repoUrl
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
                        
                        // 加载最新的插件列表，保持当前仓库
                        await this.loadPlugins(true);
                        
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
                                
                                // 刷新插件列表，保持当前仓库
                                await this.loadPlugins(true);
                                
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
                    await this.loadPlugins(true);
                    
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
        
        // 显示许可证详情
        async showLicenseDetails(licenseKey, licenseUrl) {
            if (!licenseKey && !licenseUrl) return;
            
            this.showLicenseModal = true;
            this.licenseFetching = true;
            this.licenseError = false;
            
            // 立即创建一个基本许可证对象，以防在异步操作完成前访问属性
            this.currentLicense = {
                key: licenseKey || '',
                name: licenseKey ? `${licenseKey.toUpperCase()} 协议` : '加载中...',
                description: '加载中...',
                body: '',
                html_url: '',
                permissions: [],
                conditions: [],
                limitations: []
            };
            
            try {
                // 尝试从URL获取许可证信息
                const apiUrl = licenseUrl || `https://api.github.com/licenses/${licenseKey}`;
                console.log(`正在获取协议信息，URL: ${apiUrl}`);
                
                // 设置超时
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
                
                const response = await fetch(apiUrl, {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`获取许可证信息失败: ${response.status} ${response.statusText}`);
                }
                
                const licenseData = await response.json();
                
                // 验证许可证数据的必要字段
                if (!licenseData) {
                    throw new Error('获取到的许可证数据为空');
                }
                
                // 合并返回的数据与基本对象
                this.currentLicense = {...this.currentLicense, ...licenseData};
                
                console.log('获取到许可证信息:', this.currentLicense);
                this.licenseFetching = false;
            } catch (error) {
                console.error('Error loading license information:', error);
                
                // 更新许可证对象以显示错误状态
                this.currentLicense = {
                    ...this.currentLicense,
                    name: licenseKey ? `${licenseKey.toUpperCase()} 协议` : '未知协议',
                    description: '无法获取详细描述',
                };
                
                this.licenseError = true;
                this.licenseFetching = false;
                this.showNotificationMsg(`获取协议信息失败: ${error.message}`, 'error');
            }
        },
        
        // 关闭许可证模态框
        closeLicenseModal() {
            this.showLicenseModal = false;
            this.currentLicense = null;
            this.licenseFetching = false;
            this.licenseError = false;
        },
        
        init() {
            this.checkLoginStatus();
            this.checkServerStatus();
            this.loadPlugins();
            
            // 初始化处理中插件状态
            this.processingPlugins = {};
            
            // 每60秒自动刷新服务器状态
            setInterval(() => this.checkServerStatus(), 10001);
            
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