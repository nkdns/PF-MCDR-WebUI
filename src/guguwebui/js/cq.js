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

        // i18n
        cqLang: 'zh-CN',
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
                const resp = await fetch(`lang/${this.mcLang}.json`, { cache: 'no-cache' });
                if (resp.ok) {
                    this.mcDict = await resp.json();
                }
            } catch (e) {
                // 忽略，保持空字典，使用 fallback
                console.warn('loadLangDict failed:', e);
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
                const response = await fetch('api/load_config?path=config/cq_qq_api/config_lang.json');
                const data = await response.json();
                // 兼容多种命名：zh_cn/zh_CN/zh-CN/en_us/en_US/en-US
                const candidates = this.cqLang === 'en-US' 
                    ? ['en_US', 'en_us', 'en-US', 'en']
                    : ['zh_CN', 'zh_cn', 'zh-CN', 'zh'];
                let picked = null;
                for (const k of candidates) {
                    if (data && Object.prototype.hasOwnProperty.call(data, k)) { picked = data[k]; break; }
                }
                if (!picked && data) {
                    const want = (this.cqLang === 'en-US' ? 'en_us' : 'zh_cn').replace(/[\-_]/g, '').toLowerCase();
                    for (const key of Object.keys(data)) {
                        const norm = String(key).replace(/[\-_]/g, '').toLowerCase();
                        if (norm.startsWith(want) || norm === want || (want.startsWith('en') && norm.startsWith('en')) || (want.startsWith('zh') && norm.startsWith('zh'))) {
                            picked = data[key];
                            break;
                        }
                    }
                }
                this.translations = picked || {};
            } catch (error) {
                console.error('Error loading translations:', error);
                this.showNotificationMsg(this.t('page.cq.msg.load_translations_failed', '加载翻译数据失败'), 'error');
                this.translations = {};
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
                this.showNotificationMsg(this.t('page.cq.msg.load_config_failed', '加载配置数据失败'), 'error');
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
                    this.showNotificationMsg(this.t('page.cq.msg.save_success', '配置保存成功'), 'success');
                } else {
                    this.showNotificationMsg(this.t('page.cq.msg.save_failed_prefix', '配置保存失败: ') + (result.message || ''), 'error');
                }
                
                this.saving = false;
            } catch (error) {
                console.error('Error saving config:', error);
                this.showNotificationMsg(this.t('page.cq.msg.save_error', '保存配置时出错'), 'error');
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
            this.loadLangDict();
            this.checkLoginStatus();
            this.checkServerStatus();
            this.loadTranslations();
            this.loadConfig();
            
            // 监听语言切换
            document.addEventListener('i18n:changed', (e) => {
                const nextLang = (e && e.detail && e.detail.lang) ? e.detail.lang : this.cqLang;
                this.cqLang = nextLang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
                this.loadLangDict().then(() => {
                    this.loadTranslations();
                });
            });
            
            // 每60秒自动刷新服务器状态
            setInterval(() => this.checkServerStatus(), 10001);
            
            // 保存主题设置到本地存储
            this.$watch('darkMode', value => {
                localStorage.setItem('darkMode', value);
            });
        }
    }));
});