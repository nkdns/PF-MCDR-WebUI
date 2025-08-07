// Minecraft服务器配置页面的JavaScript功能
document.addEventListener('alpine:init', () => {
    Alpine.data('mcData', () => ({
        serverStatus: 'loading',
        userName: '',
        serverVersion: '',
        serverPlayers: '0/0',
        configData: {},
        translations: {},
        searchQuery: '',
        activeCategory: 'all',
        loading: true,
        saving: false,
        notificationMessage: '',
        notificationType: 'success',
        showNotification: false,
        serverPath: 'server/', // 默认服务器路径，将在初始化时更新
        
        // 配置分类
        categories: {
            all: { name: '全部设置', icon: 'fa-sliders-h' },
            basic: { name: '基础设置', icon: 'fa-cog' },
            game: { name: '游戏规则', icon: 'fa-gamepad' },
            network: { name: '网络设置', icon: 'fa-network-wired' },
            performance: { name: '性能设置', icon: 'fa-tachometer-alt' },
            world: { name: '世界设置', icon: 'fa-globe' },
            security: { name: '安全设置', icon: 'fa-shield-alt' }
        },
        
        // 配置项分类
        configCategories: {
            // 基础设置
            'motd': 'basic',
            'server-port': 'basic',
            'server-ip': 'basic',
            'level-name': 'basic',
            'max-players': 'basic',
            'gamemode': 'basic',
            'difficulty': 'basic',
            
            // 游戏规则
            'pvp': 'game',
            'hardcore': 'game',
            'force-gamemode': 'game',
            'allow-nether': 'game',
            'spawn-animals': 'game',
            'spawn-monsters': 'game',
            'spawn-npcs': 'game',
            'allow-flight': 'game',
            'function-permission-level': 'game',
            'op-permission-level': 'game',
            
            // 网络设置
            'network-compression-threshold': 'network',
            'rate-limit': 'network',
            'enable-status': 'network',
            'enable-query': 'network',
            'query.port': 'network',
            'enable-rcon': 'network',
            'rcon.port': 'network',
            'rcon.password': 'network',
            'broadcast-rcon-to-ops': 'network',
            
            // 性能设置
            'view-distance': 'performance',
            'simulation-distance': 'performance',
            'max-tick-time': 'performance',
            'entity-broadcast-range-percentage': 'performance',
            'max-chained-neighbor-updates': 'performance',
            
            // 世界设置
            'level-seed': 'world',
            'level-type': 'world',
            'generate-structures': 'world',
            'generator-settings': 'world',
            'max-world-size': 'world',
            'max-build-height': 'world',
            
            // 安全设置
            'white-list': 'security',
            'enforce-whitelist': 'security',
            'online-mode': 'security',
            'prevent-proxy-connections': 'security',
            'player-idle-timeout': 'security',
            'spawn-protection': 'security'
        },
        
        // 需要特殊处理的配置项类型
        specialConfigTypes: {
            'boolean': [
                'accepts-transfers', 'pvp', 'hardcore', 'online-mode', 'enable-status', 'enable-query', 'enable-rcon',
                'enable-command-block', 'force-gamemode', 'allow-nether', 'spawn-animals',
                'spawn-monsters', 'spawn-npcs', 'white-list', 'enforce-whitelist', 
                'generate-structures', 'allow-flight', 'sync-chunk-writes', 'use-native-transport',
                'prevent-proxy-connections', 'enable-jmx-monitoring', 'broadcast-rcon-to-ops',
                'broadcast-console-to-ops', 'enforce-secure-profile', 'hide-online-players'
            ],
            'select': {
                'difficulty': ['peaceful', 'easy', 'normal', 'hard', '0', '1', '2', '3'],
                'gamemode': ['survival', 'creative', 'adventure', 'spectator'],
                'level-type': ['DEFAULT', 'FLAT', 'LARGEBIOMES', 'AMPLIFIED', 'BUFFET', 'normal', 'flat'],
                'function-permission-level': ['1', '2', '3', '4'],
                'op-permission-level': ['1', '2', '3', '4']
            }
        },
        
        checkLoginStatus: async function() {
            try {
                // 检查localStorage中的登录状态
                const isLoggedIn = localStorage.getItem('isLoggedIn');
                const username = localStorage.getItem('username');
                
                if (isLoggedIn === 'true' && username) {
                    this.userName = username;
                } else {
                    // 如果未登录，重定向到登录页面
                    window.location.href = '../login.html';
                    return;
                }
                
                // 模拟API调用
                const response = await fetch('../data/checkLogin.json');
                const data = await response.json();
                if (data.status === 'success') {
                    this.userName = data.username;
                }
            } catch (error) {
                console.error('Error checking login status:', error);
                // 如果出错，重定向到登录页面
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
                const response = await fetch('../custom/server_lang.json');
                const data = await response.json();
                this.translations = data.zh_cn || {};
            } catch (error) {
                console.error('Error loading translations:', error);
                this.showNotificationMsg('加载翻译数据失败', 'error');
            }
        },
        
        // 加载MCDR配置获取服务器路径
        loadMcdrConfig: async function() {
            try {
                const response = await fetch('../data/mcdr_config.yml.json');
                const mcdrConfig = await response.json();
                
                // 获取工作目录
                if (mcdrConfig && mcdrConfig.working_directory) {
                    // 确保路径以斜杠结尾
                    this.serverPath = mcdrConfig.working_directory.endsWith('/') 
                        ? mcdrConfig.working_directory 
                        : mcdrConfig.working_directory + '/';
                    
                    console.log('从MCDR配置获取到服务器路径:', this.serverPath);
                } else {
                    console.warn('未能从MCDR配置获取工作目录，使用默认路径:', this.serverPath);
                }
            } catch (error) {
                console.error('加载MCDR配置失败:', error);
                console.warn('使用默认服务器路径:', this.serverPath);
            }
        },
        
        // 加载配置数据
        loadConfig: async function() {
            try {
                this.loading = true;
                const response = await fetch('../data/server.properties.json');
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
                
                // 转换布尔值
                const formattedConfig = {};
                for (const key in this.configData) {
                    if (this.specialConfigTypes.boolean.includes(key)) {
                        formattedConfig[key] = this.configData[key] ? 'true' : 'false';
                    } else {
                        formattedConfig[key] = this.configData[key];
                    }
                }
                
                // 模拟保存成功
                console.log('模拟保存配置:', formattedConfig);
                
                // 更新本地数据
                this.configData = { ...formattedConfig };
                
                this.showNotificationMsg('配置保存成功', 'success');
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
        
        // 获取配置的类型
        getConfigType: function(key) {
            if (this.specialConfigTypes.boolean.includes(key)) {
                return 'boolean';
            }
            
            if (key in this.specialConfigTypes.select) {
                return 'select';
            }
            
            return 'text';
        },
        
        // 获取配置项的选项
        getConfigOptions: function(key) {
            return this.specialConfigTypes.select[key] || [];
        },
        
        // 更新配置值
        updateConfigValue: function(key, value) {
            // 对于布尔类型的配置项，转换为布尔值
            if (this.specialConfigTypes.boolean.includes(key)) {
                if (typeof value === 'string') {
                    value = value.toLowerCase() === 'true';
                }
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
        
        // 检查配置项是否应该显示（基于搜索和分类）
        shouldShowConfig: function(key) {
            // 搜索过滤
            if (this.searchQuery) {
                const name = this.getConfigName(key).toLowerCase();
                const desc = this.getConfigDescription(key).toLowerCase();
                const query = this.searchQuery.toLowerCase();
                
                if (!name.includes(query) && !desc.includes(query) && !key.toLowerCase().includes(query)) {
                    return false;
                }
            }
            
            // 分类过滤
            if (this.activeCategory !== 'all') {
                const category = this.configCategories[key] || 'basic';
                if (category !== this.activeCategory) {
                    return false;
                }
            }
            
            return true;
        },
        
        // 切换分类
        switchCategory: function(category) {
            this.activeCategory = category;
        },
        
        // 清除搜索
        clearSearch: function() {
            this.searchQuery = '';
        },
        
        init() {
            // 先加载MCDR配置获取服务器路径
            this.loadMcdrConfig().then(() => {
                // 加载完成后再加载配置
                this.loadConfig();
            });
            
            this.checkLoginStatus();
            this.checkServerStatus();
            this.loadTranslations();
            
            // 每60秒自动刷新服务器状态
            setInterval(() => this.checkServerStatus(), 10001);
            
            // 保存主题设置到本地存储
            this.$watch('darkMode', value => {
                localStorage.setItem('darkMode', value);
            });
            
            // 设置当前年份
            const yearElement = document.getElementById('year');
            if (yearElement) {
                yearElement.textContent = new Date().getFullYear();
            }
        }
    }));
}); 