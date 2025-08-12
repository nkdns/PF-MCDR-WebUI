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

        // i18n
        mcLang: 'zh-CN',
        mcDict: {},
        t(key, fallback = '') {
            // 在已加载的语言包中查找 key（支持 a.b.c 链式）
            const val = key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), this.mcDict);
            if (val != null) return String(val);
            // 回退到全局 I18n.t（若可用）
            if (window.I18n && typeof window.I18n.t === 'function') {
                const v = window.I18n.t(key);
                if (v && v !== key) return v;
            }
            return fallback || key;
        },
        async loadLangDict() {
            // 读取本地存储语言（由 i18n.js 维护）
            const stored = localStorage.getItem('lang') || (navigator.language || 'zh-CN');
            this.mcLang = stored.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
            try {
                if (window.I18n && typeof window.I18n.fetchLangDict === 'function') {
                    this.mcDict = await window.I18n.fetchLangDict(this.mcLang);
                } else {
                    const resp = await fetch(`lang/${this.mcLang}.json`, { cache: 'no-cache' });
                    if (resp.ok) {
                        this.mcDict = await resp.json();
                    }
                }
            } catch (e) {
                // 忽略，保持空字典，使用 fallback
                console.warn('loadLangDict failed:', e);
            }
        },
        updateCategoryLabels() {
            // 使用翻译更新分类名称（提供中文回退）
            this.categories.all.name = this.t('page.mc.categories.all', '全部设置');
            this.categories.basic.name = this.t('page.mc.categories.basic', '基础设置');
            this.categories.game.name = this.t('page.mc.categories.game', '游戏规则');
            this.categories.network.name = this.t('page.mc.categories.network', '网络设置');
            this.categories.performance.name = this.t('page.mc.categories.performance', '性能设置');
            this.categories.world.name = this.t('page.mc.categories.world', '世界设置');
            this.categories.security.name = this.t('page.mc.categories.security', '安全设置');
        },

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
                const response = await fetch('custom/server_lang.json');
                const data = await response.json();
                // 根据当前界面语言选择对应翻译表（兼容多种命名：zh_cn/zh_CN/zh-CN 等）
                const candidates = this.mcLang === 'en-US' ? 'en-US' : 'zh-CN';
                let picked = null;
                for (const k of candidates) {
                    if (data && Object.prototype.hasOwnProperty.call(data, k)) { picked = data[k]; break; }
                }
                if (!picked && data) {
                    // 额外宽松匹配：去掉下划线/短横线并小写后比较
                    const want = (this.mcLang === 'en-US' ? 'en_us' : 'zh_cn').replace(/[\-_]/g, '').toLowerCase();
                    for (const key of Object.keys(data)) {
                        const norm = String(key).replace(/[\-_]/g, '').toLowerCase();
                        if (norm.startsWith(want) || norm === want || (want.startsWith('en') && norm.startsWith('en')) || (want.startsWith('zh') && norm.startsWith('zh'))) {
                            picked = data[key];
                            break;
                        }
                    }
                }
                this.translations = picked || data.zh_CN || data.zh_cn || {};
            } catch (error) {
                console.error('Error loading translations:', error);
                this.showNotificationMsg(this.t('page.mc.msg.load_translations_failed', '加载翻译数据失败'), 'error');
            }
        },

        // 加载MCDR配置获取服务器路径
        loadMcdrConfig: async function() {
            try {
                const response = await fetch('api/load_config?path=config.yml');
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
                const response = await fetch(`api/load_config?path=${this.serverPath}server.properties`);
                this.configData = await response.json();
                this.loading = false;
            } catch (error) {
                console.error('Error loading config:', error);
                this.loading = false;
                this.showNotificationMsg(this.t('page.mc.msg.load_config_failed', '加载配置数据失败'), 'error');
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

                const response = await fetch('api/save_config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        file_path: `${this.serverPath}server.properties`,
                        config_data: formattedConfig
                    })
                });

                const result = await response.json();

                if (result.status === 'success') {
                    this.showNotificationMsg(this.t('page.mc.msg.save_success', '配置保存成功'), 'success');
                } else {
                    this.showNotificationMsg(this.t('page.mc.msg.save_failed_prefix', '配置保存失败: ') + (result.message || ''), 'error');
                }

                this.saving = false;
            } catch (error) {
                console.error('Error saving config:', error);
                this.showNotificationMsg(this.t('page.mc.msg.save_error', '保存配置时出错'), 'error');
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
            // 先加载语言包，再更新分类并加载配置项翻译
            this.loadLangDict().then(() => {
                this.updateCategoryLabels();
                this.loadTranslations();
            });
            // 监听全局语言变化事件
            document.addEventListener('i18n:changed', (e) => {
                const nextLang = (e && e.detail && e.detail.lang) ? e.detail.lang : this.mcLang;
                this.mcLang = nextLang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
                // 重新加载语言包与翻译，并刷新分类标签
                this.loadLangDict().then(() => {
                    this.updateCategoryLabels();
                    this.loadTranslations();
                });
            });
            // 先加载MCDR配置获取服务器路径
            this.loadMcdrConfig().then(() => {
                // 加载完成后再加载配置
                this.loadConfig();
            });

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
