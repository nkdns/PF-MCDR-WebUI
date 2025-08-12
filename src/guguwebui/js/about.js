function appData() {
    return {
        serverStatus: 'loading',
        userName: '',
        serverVersion: '',
        serverPlayers: '0/0',

        // i18n
        aboutLang: 'zh-CN',
        aboutDict: {},
        t(key, fallback = '') {
            const val = key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), this.aboutDict);
            if (val != null) return String(val);
            if (window.I18n && typeof window.I18n.t === 'function') {
                const v = window.I18n.t(key);
                if (v && v !== key) return v;
            }
            return fallback || key;
        },
        async loadLangDict() {
            const stored = localStorage.getItem('lang') || (navigator.language || 'zh-CN');
            this.aboutLang = stored.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
            try {
                if (window.I18n && typeof window.I18n.fetchLangDict === 'function') {
                    this.aboutDict = await window.I18n.fetchLangDict(this.aboutLang);
                } else {
                    const resp = await fetch(`lang/${this.aboutLang}.json`, { cache: 'no-cache' });
                    if (resp.ok) {
                        this.aboutDict = await resp.json();
                    }
                }
            } catch (e) {
                console.warn('about loadLangDict failed:', e);
            }
        },

        // 初始化
        init() {
            // 先加载语言包，再初始化其它逻辑
            this.loadLangDict().then(() => {
                this.checkLoginStatus();
                this.checkServerStatus();
                this.getVersions();
            });

            // 监听语言切换
            document.addEventListener('i18n:changed', (e) => {
                const nextLang = (e && e.detail && e.detail.lang) ? e.detail.lang : this.aboutLang;
                this.aboutLang = nextLang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
                this.loadLangDict().then(() => {
                    // 重新刷新一次版本展示（保持文案语言一致）
                    this.getVersions();
                });
            });

            // 每60秒自动刷新服务器状态
            setInterval(() => this.checkServerStatus(), 10001);
        },

        // 检查登录状态
        async checkLoginStatus() {
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

        // 检查服务器状态
        async checkServerStatus() {
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

        // 获取插件版本
        async getVersions() {
            try {
                const response = await fetch('api/gugubot_plugins');
                const data = await response.json();

                const gugubotVersion = document.getElementById('gugubot-version');
                const cqQqApiVersion = document.getElementById('cq-qq-api-version');
                const webVersion = document.getElementById('web-version');

                if (data.gugubot_plugins) {
                    const gugubot = data.gugubot_plugins.find(p => p.id === 'gugubot');
                    const cq_qq_api = data.gugubot_plugins.find(p => p.id === 'cq_qq_api');
                    const guguwebui = data.gugubot_plugins.find(p => p.id === 'guguwebui');

                    if (gugubotVersion) {
                        if (gugubot) gugubotVersion.textContent = `${gugubot.version || this.t('common.unknown', '未知')}`;
                        else gugubotVersion.textContent = this.t('common.not_installed', '未安装');
                    }

                    if (cqQqApiVersion) {
                        if (cq_qq_api) cqQqApiVersion.textContent = `${cq_qq_api.version || this.t('common.unknown', '未知')}`;
                        else cqQqApiVersion.textContent = this.t('common.not_installed', '未安装');
                    }

                    if (webVersion && guguwebui) {
                        webVersion.textContent = `${guguwebui.version || this.t('common.unknown', '未知')}`;
                    }
                } else {
                    // 无法获取插件列表
                    if (gugubotVersion) gugubotVersion.textContent = this.t('common.not_installed', '未安装');
                    if (cqQqApiVersion) cqQqApiVersion.textContent = this.t('common.not_installed', '未安装');
                    if (webVersion) webVersion.textContent = this.t('common.unknown', '未知');
                }
            } catch (error) {
                console.error('Error fetching plugin versions:', error);
                const gugubotVersion = document.getElementById('gugubot-version');
                const cqQqApiVersion = document.getElementById('cq-qq-api-version');
                if (gugubotVersion) gugubotVersion.textContent = this.t('common.not_installed', '未安装');
                if (cqQqApiVersion) cqQqApiVersion.textContent = this.t('common.not_installed', '未安装');
            }
        }
    };
}
