function chatApp() {
    return {
        // i18n 辅助与状态（参考 index.js 实现实时切换）
        chatLang: 'zh-CN',
        chatDict: {},
        t(key, fallback = '') {
            try {
                // 优先用本地字典
                const val = key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), this.chatDict);
                if (val != null) return String(val);
                // 退回全局 I18n
                if (window.I18n && typeof window.I18n.t === 'function') {
                    const v = window.I18n.t(key);
                    if (v && v !== key) return v;
                }
            } catch (_) {}
            return fallback || key;
        },
        
        // 服务器状态刷新
        startStatusRefresh() {
            if (this.statusInterval) {
                clearInterval(this.statusInterval);
            }
            // 立即拉取一次
            this.fetchServerStatus();
            // 每5秒刷新
            this.statusInterval = setInterval(() => {
                if (this.isLoggedIn) {
                    this.fetchServerStatus();
                }
            }, 5000);
        },
        
        // 启动离线成员清理任务（每5分钟）
        startOfflineCleanupTask() {
            if (this.offlineCleanupInterval) {
                clearInterval(this.offlineCleanupInterval);
            }
            // 立即清理一次
            this.cleanupExpiredOfflineMembers();
            // 每5分钟清理一次
            this.offlineCleanupInterval = setInterval(() => {
                this.cleanupExpiredOfflineMembers();
            }, 5 * 60 * 1000); // 5分钟
        },
        
        async fetchServerStatus() {
            try {
                const sessionId = localStorage.getItem('chat_session_id') || '';
                const url = sessionId ? `api/get_server_status?session_id=${encodeURIComponent(sessionId)}` : 'api/get_server_status';
                const resp = await fetch(url);
                const data = await resp.json();
                if (data) {
                    this.serverStatus = data.status || 'unknown';
                    this.serverVersion = data.version || '';
                    this.serverPlayers = data.players || '0/0';
                }
            } catch (e) {
                // 静默失败
            }
        },
        async loadLangDict() {
            const stored = localStorage.getItem('lang') || (navigator.language || 'zh-CN');
            this.chatLang = stored.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
            try {
                if (window.I18n && typeof window.I18n.fetchLangDict === 'function') {
                    this.chatDict = await window.I18n.fetchLangDict(this.chatLang);
                } else {
                    const resp = await fetch(`lang/${this.chatLang}.json`, { cache: 'no-cache' });
                    this.chatDict = resp.ok ? await resp.json() : {};
                }
            } catch (e) {
                console.warn('chat loadLangDict failed:', e);
                this.chatDict = {};
            }
            // 语言切换后，刷新当前显示的错误文本
            this.refreshVisibleI18nTexts();
        },
        refreshVisibleI18nTexts() {
            if (this.verificationErrorKey) {
                this.verificationError = this.t(this.verificationErrorKey, this.verificationErrorFallback || this.verificationError);
            }
            if (this.passwordErrorKey) {
                this.passwordError = this.t(this.passwordErrorKey, this.passwordErrorFallback || this.passwordError);
            }
            if (this.loginErrorKey) {
                this.loginError = this.t(this.loginErrorKey, this.loginErrorFallback || this.loginError);
            }
        },
        // 状态管理
        currentStep: 1,
        isLoggedIn: false,
        currentPlayer: '',
        verificationCode: '',
        newPassword: '',
        confirmPassword: '',
        loginPlayerId: '',
        loginPassword: '',
        chatMessage: '',
        
        // 聊天消息相关
        chatMessages: [],
        isLoadingMessages: false,
        messageOffset: 0,
        hasMoreMessages: true,
        lastMessageId: 0,  // 最后一条消息的ID
        refreshInterval: null,  // 定时刷新间隔
        isSending: false,  // 发送消息状态
        lastSendAtMs: 0,   // 前端冷却：上次发送时间戳（ms）
        
        // 服务器状态与在线列表
        serverStatus: 'unknown',
        serverVersion: '',
        serverPlayers: '',
        statusInterval: null,
        offlineCleanupInterval: null,
        onlineWeb: [],
        onlineGame: [],
        onlineBot: [],
        showOnlinePanel: false,
        
        // 离线成员缓存：存储离线时间和状态
        offlineMembers: {}, // {playerName: {lastSeen: timestamp, status: 'web'|'game'|'bot'}}
        
        // 本地存储键名
        OFFLINE_CACHE_KEY: 'chat_offline_members',
        
        // 主题管理
        darkMode: false,
        
        // 头像源：'crafatar' | 'mccag'
        avatarSource: 'crafatar',
        
        // MC 聊天栏高仿模式
        mcStyleMode: false,
        
        // 加载状态
        isGenerating: false,
        isChecking: false,
        isSettingPassword: false,
        isLoggingIn: false,
        
        // 错误信息（保留键与后备文案，便于语言切换时更新）
        verificationError: '',
        verificationErrorKey: '',
        verificationErrorFallback: '',
        passwordError: '',
        passwordErrorKey: '',
        passwordErrorFallback: '',
        loginError: '',
        loginErrorKey: '',
        loginErrorFallback: '',
        
        // 初始化
        init() {
            this.loadTheme();
            this.loadAvatarSource();
            this.loadMcStyleMode();
            // 加载离线成员缓存
            this.loadOfflineMembers();
            // 清理过期缓存
            this.cleanupExpiredOfflineMembers();
            // 加载语言并监听切换事件
            this.loadLangDict();
            document.addEventListener('i18n:changed', (e) => {
                const nextLang = (e && e.detail && e.detail.lang) ? e.detail.lang : this.chatLang;
                this.chatLang = nextLang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
                this.loadLangDict();
            });
            this.checkLoginStatus();
            
            // 启动定时刷新（每1秒）
            this.startMessageRefresh();
            // 启动服务器状态刷新（每5秒）
            this.startStatusRefresh();
            // 启动离线成员清理任务（每5分钟）
            this.startOfflineCleanupTask();
            
            // 页面卸载时清理资源
            window.addEventListener('beforeunload', () => {
                this.stopMessageRefresh();
            });
        },
        
        // 头像源：加载与切换
        loadAvatarSource() {
            const saved = localStorage.getItem('chat_avatar_source');
            this.avatarSource = saved === 'mccag' ? 'mccag' : 'crafatar';
        },
        toggleAvatarSource() {
            this.avatarSource = this.avatarSource === 'crafatar' ? 'mccag' : 'crafatar';
            localStorage.setItem('chat_avatar_source', this.avatarSource);
        },
        
        // MC 风格模式：加载与切换
        loadMcStyleMode() {
            const saved = localStorage.getItem('chat_mc_style');
            this.mcStyleMode = saved === 'true';
        },
        toggleMcStyleMode() {
            this.mcStyleMode = !this.mcStyleMode;
            localStorage.setItem('chat_mc_style', String(this.mcStyleMode));
        },
        
        // 启动消息刷新
        startMessageRefresh() {
            // 清除之前的定时器
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
            
            // 设置新的定时器，每1秒刷新一次
            this.refreshInterval = setInterval(() => {
                if (this.isLoggedIn) {
                    this.loadNewMessages();
                }
            }, 1000);
        },
        
        // 停止消息刷新
        stopMessageRefresh() {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
            if (this.statusInterval) {
                clearInterval(this.statusInterval);
                this.statusInterval = null;
            }
            if (this.offlineCleanupInterval) {
                clearInterval(this.offlineCleanupInterval);
                this.offlineCleanupInterval = null;
            }
        },
        
        // 获取聊天消息（首次加载或加载更多历史消息）
        async loadChatMessages(limit = 50, offset = 0) {
            if (this.isLoadingMessages) return;
            
            this.isLoadingMessages = true;
            try {
                const response = await fetch('api/chat/get_messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ limit, offset })
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    if (offset === 0) {
                        // 首次加载
                        this.chatMessages = result.messages;
                        // 设置最后一条消息的ID
                        if (result.messages.length > 0) {
                            this.lastMessageId = Math.max(...result.messages.map(m => m.id));
                        }
                        // 首次加载后更新离线成员缓存
                        this.updateOfflineMembers();
                    } else {
                        // 加载更多历史消息
                        this.chatMessages = [...this.chatMessages, ...result.messages];
                    }
                    
                    this.messageOffset = this.chatMessages.length;
                    this.hasMoreMessages = result.has_more;
                }
            } catch (error) {
                console.error('加载聊天消息失败:', error);
            } finally {
                this.isLoadingMessages = false;
            }
        },
        
        // 加载新消息（基于最后消息ID）
        async loadNewMessages() {
            if (this.isLoadingMessages || this.lastMessageId === 0) return;
            
            try {
                const response = await fetch('api/chat/get_new_messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ after_id: this.lastMessageId, player_id: this.currentPlayer })
                });
                
                const result = await response.json();
                if (result.status === 'success' && result.messages && result.messages.length > 0) {
                    // 将新消息添加到列表顶部
                    this.chatMessages = [...result.messages, ...this.chatMessages];
                    
                    // 更新最后消息ID
                    this.lastMessageId = result.last_message_id;
                    
                    // 限制消息数量，避免内存占用过多
                    if (this.chatMessages.length > 200) {
                        this.chatMessages = this.chatMessages.slice(0, 200);
                    }
                    
                    // 更新消息计数
                    this.messageOffset = this.chatMessages.length;
                }
                if (result.status === 'success' && result.online) {
                    const oldOnlineWeb = [...this.onlineWeb];
                    const oldOnlineGame = [...this.onlineGame];
                    const oldOnlineBot = [...this.onlineBot];
                    
                    this.onlineWeb = Array.isArray(result.online.web) ? result.online.web : [];
                    this.onlineGame = Array.isArray(result.online.game) ? result.online.game : [];
                    this.onlineBot = Array.isArray(result.online.bot) ? result.online.bot : [];
                    
                    // 检测玩家状态变化
                    this.detectPlayerStatusChanges(oldOnlineWeb, oldOnlineGame, oldOnlineBot);
                    
                    // 更新离线成员缓存
                    this.updateOfflineMembers();
                }
            } catch (error) {
                console.error('加载新消息失败:', error);
            }
        },
        
        // 加载更多历史消息
        loadMoreMessages() {
            if (this.hasMoreMessages && !this.isLoadingMessages) {
                this.loadChatMessages(50, this.messageOffset);
            }
        },
        
        // 格式化时间戳
        formatTimestamp(timestamp) {
            if (!timestamp) return '';
            
            const date = new Date(timestamp * 1000); // 转换为毫秒
            const now = new Date();
            const diff = now - date;
            
            // 如果是今天，只显示时间
            if (date.toDateString() === now.toDateString()) {
                return date.toLocaleTimeString('zh-CN', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                });
            }
            
            // 如果是昨天
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            if (date.toDateString() === yesterday.toDateString()) {
                return `昨天 ${date.toLocaleTimeString('zh-CN', { 
                    hour: '2-digit', 
                    minute: '2-digit'
                })}`;
            }
            
            // 其他情况显示完整日期和时间
            return date.toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        // 仅时间（HH:mm:ss），用于MC风格
        formatTimeOnly(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp * 1000);
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        },
        
        // 离线成员管理
        updateOfflineMembers() {
            const now = Math.floor(Date.now() / 1000);
            const allOnline = new Set([...this.onlineWeb, ...this.onlineGame, ...this.onlineBot]);
            
            // 清理已上线的玩家
            Object.keys(this.offlineMembers).forEach(name => {
                if (allOnline.has(name)) {
                    delete this.offlineMembers[name];
                }
            });
            
            // 从聊天消息中获取所有玩家，标记为离线
            this.chatMessages.forEach(message => {
                const playerName = message.player_id;
                if (!allOnline.has(playerName) && !this.offlineMembers[playerName]) {
                    this.offlineMembers[playerName] = {
                        lastSeen: message.timestamp,
                        status: 'offline'
                    };
                }
            });
            

            
            // 保存到本地存储
            this.saveOfflineMembers();
        },
        
        // 检测玩家状态变化
        detectPlayerStatusChanges(oldOnlineWeb, oldOnlineGame, oldOnlineBot) {
            const now = Math.floor(Date.now() / 1000);
            
            // 检测从游戏退出的玩家
            oldOnlineGame.forEach(name => {
                if (!this.onlineGame.includes(name)) {
                    // 玩家从游戏退出，如果不在web和bot中，标记为离线
                    if (!this.onlineWeb.includes(name) && !this.onlineBot.includes(name)) {
                        this.offlineMembers[name] = {
                            lastSeen: now,
                            status: 'offline'
                        };
                    }
                }
            });
            
            // 检测从web退出的玩家
            oldOnlineWeb.forEach(name => {
                if (!this.onlineWeb.includes(name)) {
                    // 玩家从web退出，如果不在游戏和bot中，标记为离线
                    if (!this.onlineGame.includes(name) && !this.onlineBot.includes(name)) {
                        this.offlineMembers[name] = {
                            lastSeen: now,
                            status: 'offline'
                        };
                    }
                }
            });
            
            // 检测从bot退出的玩家
            oldOnlineBot.forEach(name => {
                if (!this.onlineBot.includes(name)) {
                    // 玩家从bot退出，如果不在web和游戏中，标记为bot离线状态
                    if (!this.onlineWeb.includes(name) && !this.onlineGame.includes(name)) {
                        this.offlineMembers[name] = {
                            lastSeen: now,
                            status: 'bot'
                        };
                    }
                }
            });
            
            // 保存到本地存储
            this.saveOfflineMembers();
        },
        
        // 加载离线成员缓存
        loadOfflineMembers() {
            try {
                const cached = localStorage.getItem(this.OFFLINE_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    // 验证缓存数据的有效性
                    if (parsed && typeof parsed === 'object') {
                        this.offlineMembers = parsed;
                    }
                }
            } catch (e) {
                console.warn('加载离线成员缓存失败:', e);
                this.offlineMembers = {};
            }
        },
        
        // 保存离线成员缓存到本地存储
        saveOfflineMembers() {
            try {
                localStorage.setItem(this.OFFLINE_CACHE_KEY, JSON.stringify(this.offlineMembers));
            } catch (e) {
                console.warn('保存离线成员缓存失败:', e);
            }
        },
        
        // 清理过期的离线成员缓存
        cleanupExpiredOfflineMembers() {
            const now = Math.floor(Date.now() / 1000);
            const oneWeekInSeconds = 7 * 24 * 60 * 60; // 7天 * 24小时 * 60分钟 * 60秒
            const fiveMinutesInSeconds = 5 * 60; // 5分钟
            
            let removedCount = 0;
            Object.keys(this.offlineMembers).forEach(name => {
                const member = this.offlineMembers[name];
                const timeDiff = now - member.lastSeen;
                
                // bot状态5分钟后清除，其他状态一周后清除
                if (member.status === 'bot' && timeDiff > fiveMinutesInSeconds) {
                    delete this.offlineMembers[name];
                    removedCount++;
                } else if (member.status !== 'bot' && timeDiff > oneWeekInSeconds) {
                    delete this.offlineMembers[name];
                    removedCount++;
                }
            });
            
            if (removedCount > 0) {
                this.saveOfflineMembers();
            }
        },
        
        // 获取所有成员列表（在线+离线）
        getAllMembers() {
            const allMembers = [];
            const now = Math.floor(Date.now() / 1000);
            
            // 创建一个Map来跟踪每个玩家的状态
            const playerStatus = new Map();
            
            // 处理web在线玩家
            this.onlineWeb.forEach(name => {
                if (!playerStatus.has(name)) {
                    playerStatus.set(name, { status: 'web', lastSeen: now });
                } else {
                    // 如果已经在game中，标记为both
                    playerStatus.set(name, { status: 'both', lastSeen: now });
                }
            });
            
            // 处理game在线玩家
            this.onlineGame.forEach(name => {
                if (!playerStatus.has(name)) {
                    playerStatus.set(name, { status: 'game', lastSeen: now });
                } else {
                    // 如果已经在web中，标记为both
                    playerStatus.set(name, { status: 'both', lastSeen: now });
                }
            });
            
            // 处理bot在线玩家
            this.onlineBot.forEach(name => {
                if (!playerStatus.has(name)) {
                    playerStatus.set(name, { status: 'bot', lastSeen: now });
                } else {
                    // 如果已经在其他状态中，标记为both
                    const currentStatus = playerStatus.get(name).status;
                    if (currentStatus === 'web') {
                        playerStatus.set(name, { status: 'web_bot', lastSeen: now });
                    } else if (currentStatus === 'game') {
                        playerStatus.set(name, { status: 'game_bot', lastSeen: now });
                    } else if (currentStatus === 'both') {
                        playerStatus.set(name, { status: 'all', lastSeen: now });
                    } else {
                        playerStatus.set(name, { status: 'bot', lastSeen: now });
                    }
                }
            });
            
            // 转换为数组格式
            playerStatus.forEach((info, name) => {
                allMembers.push([name, info]);
            });
            
            // 添加离线成员
            Object.entries(this.offlineMembers).forEach(([name, info]) => {
                allMembers.push([name, { status: info.status, lastSeen: info.lastSeen }]);
            });
            
            return allMembers;
        },
        
        // 格式化离线时间
        formatOfflineTime(timestamp) {
            if (!timestamp) return '';
            
            const date = new Date(timestamp * 1000);
            const now = new Date();
            const diff = now - date;
            
            // 如果小于1分钟
            if (diff < 60000) {
                return this.t('page.chat.offline.just_offline', '刚刚离线');
            }
            
            // 如果小于1小时
            if (diff < 3600000) {
                const minutes = Math.floor(diff / 60000);
                return `${minutes}${this.t('page.chat.offline.minutes_ago', '分钟前离线')}`;
            }
            
            // 如果小于24小时
            if (diff < 86400000) {
                const hours = Math.floor(diff / 3600000);
                return `${hours}${this.t('page.chat.offline.hours_ago', '小时前离线')}`;
            }
            
            // 超过24小时显示日期
            return date.toLocaleDateString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        
        // 加载主题设置
        loadTheme() {
            const savedDarkMode = localStorage.getItem('darkMode');
            if (savedDarkMode !== null) {
                this.darkMode = savedDarkMode === 'true';
            } else {
                // 检查系统主题偏好
                this.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
            }
            this.applyTheme();
        },
        
        // 应用主题
        applyTheme() {
            if (this.darkMode) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        },
        
        // 检查登录状态
        checkLoginStatus() {
            const sessionId = localStorage.getItem('chat_session_id');
            if (sessionId) {
                this.checkSession(sessionId);
            }
        },
        
        // 检查会话状态
        async checkSession(sessionId) {
            try {
                const response = await fetch('api/chat/check_session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ session_id: sessionId })
                });
                
                const result = await response.json();
                if (result.status === 'success' && result.valid) {
                    this.isLoggedIn = true;
                    this.currentPlayer = result.player_id;
                    
                    // 加载聊天消息
                    this.loadChatMessages();
                    // 重新启动消息刷新
                    this.startMessageRefresh();
                } else {
                    localStorage.removeItem('chat_session_id');
                    this.stopMessageRefresh();
                }
            } catch (error) {
                console.error('检查会话状态失败:', error);
                localStorage.removeItem('chat_session_id');
            }
        },
        
        // 生成验证码
        async generateVerificationCode() {
            this.isGenerating = true;
            this.verificationError = '';
            this.verificationErrorKey = '';
            this.verificationErrorFallback = '';
            
            try {
                const response = await fetch('api/chat/generate_code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    this.verificationCode = result.code;
                    this.currentStep = 2;
                } else {
                    if (result.message) {
                        this.verificationError = result.message;
                        this.verificationErrorKey = '';
                        this.verificationErrorFallback = '';
                    } else {
                        this.verificationErrorKey = 'page.chat.msg.generate_failed';
                        this.verificationErrorFallback = '生成验证码失败';
                        this.verificationError = this.t(this.verificationErrorKey, this.verificationErrorFallback);
                    }
                }
            } catch (error) {
                console.error('生成验证码失败:', error);
                this.verificationErrorKey = 'page.chat.msg.network_retry';
                this.verificationErrorFallback = '网络错误，请重试';
                this.verificationError = this.t(this.verificationErrorKey, this.verificationErrorFallback);
            } finally {
                this.isGenerating = false;
            }
        },
        
        // 检查验证状态
        async checkVerification() {
            this.isChecking = true;
            this.verificationError = '';
            this.verificationErrorKey = '';
            this.verificationErrorFallback = '';
            
            try {
                const response = await fetch('api/chat/check_verification', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ code: this.verificationCode })
                });
                
                const result = await response.json();
                if (result.status === 'success' && result.verified) {
                    this.currentStep = 3;
                } else {
                    if (result.message) {
                        this.verificationError = result.message;
                    } else {
                        this.verificationErrorKey = 'page.chat.msg.verify_failed';
                        this.verificationErrorFallback = '验证失败，请确保已在游戏内执行验证命令';
                        this.verificationError = this.t(this.verificationErrorKey, this.verificationErrorFallback);
                    }
                }
            } catch (error) {
                console.error('检查验证状态失败:', error);
                this.verificationErrorKey = 'page.chat.msg.network_retry';
                this.verificationErrorFallback = '网络错误，请重试';
                this.verificationError = this.t(this.verificationErrorKey, this.verificationErrorFallback);
            } finally {
                this.isChecking = false;
            }
        },
        
        // 设置密码
        async setPassword() {
            if (this.newPassword !== this.confirmPassword) {
                this.passwordErrorKey = 'page.chat.msg.password_mismatch';
                this.passwordErrorFallback = '两次输入的密码不一致';
                this.passwordError = this.t(this.passwordErrorKey, this.passwordErrorFallback);
                return;
            }
            
            if (this.newPassword.length < 6) {
                this.passwordErrorKey = 'page.chat.msg.password_too_short';
                this.passwordErrorFallback = '密码长度至少6位';
                this.passwordError = this.t(this.passwordErrorKey, this.passwordErrorFallback);
                return;
            }
            
            this.isSettingPassword = true;
            this.passwordError = '';
            
            try {
                const response = await fetch('api/chat/set_password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        code: this.verificationCode,
                        password: this.newPassword
                    })
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    this.isLoggedIn = true;
                    this.currentPlayer = result.player_id;
                    this.verificationCode = '';
                    this.newPassword = '';
                    this.confirmPassword = '';
                    this.passwordErrorKey = '';
                    this.passwordErrorFallback = '';
                    this.passwordError = '';
                    // 加载聊天消息
                    this.loadChatMessages();
                    // 重新启动消息刷新
                    this.startMessageRefresh();
                } else {
                    if (result.message) {
                        this.passwordError = result.message;
                        this.passwordErrorKey = '';
                        this.passwordErrorFallback = '';
                    } else {
                        this.passwordErrorKey = 'page.chat.msg.set_password_failed';
                        this.passwordErrorFallback = '设置密码失败';
                        this.passwordError = this.t(this.passwordErrorKey, this.passwordErrorFallback);
                    }
                }
            } catch (error) {
                console.error('设置密码失败:', error);
                this.passwordErrorKey = 'page.chat.msg.network_retry';
                this.passwordErrorFallback = '网络错误，请重试';
                this.passwordError = this.t(this.passwordErrorKey, this.passwordErrorFallback);
            } finally {
                this.isSettingPassword = false;
            }
        },
        
        // 登录
        async login() {
            this.isLoggingIn = true;
            this.loginError = '';
            
            try {
                const response = await fetch('api/chat/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        player_id: this.loginPlayerId,
                        password: this.loginPassword
                    })
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    this.isLoggedIn = true;
                    this.currentPlayer = this.loginPlayerId;
                    localStorage.setItem('chat_session_id', result.session_id);
                    this.loginPlayerId = '';
                    this.loginPassword = '';
                    this.loginErrorKey = '';
                    this.loginErrorFallback = '';
                    this.loginError = '';
                    // 加载聊天消息
                    this.loadChatMessages();
                    // 重新启动消息刷新
                    this.startMessageRefresh();
                } else {
                    if (result.message) {
                        this.loginError = result.message;
                        this.loginErrorKey = '';
                        this.loginErrorFallback = '';
                    } else {
                        this.loginErrorKey = 'page.chat.msg.login_failed';
                        this.loginErrorFallback = '登录失败';
                        this.loginError = this.t(this.loginErrorKey, this.loginErrorFallback);
                    }
                }
            } catch (error) {
                console.error('登录失败:', error);
                this.loginErrorKey = 'page.chat.msg.network_retry';
                this.loginErrorFallback = '网络错误，请重试';
                this.loginError = this.t(this.loginErrorKey, this.loginErrorFallback);
            } finally {
                this.isLoggingIn = false;
            }
        },
        
        // 退出登录
        async logout() {
            try {
                const sessionId = localStorage.getItem('chat_session_id');
                if (sessionId) {
                    await fetch('api/chat/logout', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ session_id: sessionId })
                    });
                }
            } catch (error) {
                console.error('退出登录失败:', error);
            } finally {
                this.isLoggedIn = false;
                this.currentPlayer = '';
                this.currentStep = 1;
                this.lastMessageId = 0;
                this.chatMessages = [];
                localStorage.removeItem('chat_session_id');
                // 停止消息刷新
                this.stopMessageRefresh();
            }
        },
        
        // 重置到第一步
        resetToStep1() {
            this.currentStep = 1;
            this.verificationCode = '';
            this.newPassword = '';
            this.confirmPassword = '';
            this.verificationError = '';
            this.verificationErrorKey = '';
            this.verificationErrorFallback = '';
            this.passwordError = '';
            this.passwordErrorKey = '';
            this.passwordErrorFallback = '';
            this.loginError = '';
            this.loginErrorKey = '';
            this.loginErrorFallback = '';
        },
        
        // 发送消息
        async sendMessage() {
            if (!this.chatMessage.trim() || this.isSending) return;
            // 前端冷却：2秒内不允许再次发送
            const nowMs = Date.now();
            if (nowMs - this.lastSendAtMs < 2000) {
                return;
            }
            
            const message = this.chatMessage.trim();
            this.isSending = true;
            
            try {
                const sessionId = localStorage.getItem('chat_session_id');
                if (!sessionId) {
                    alert(this.t('page.chat.msg.session_expired', '会话已过期，请重新登录'));
                    this.logout();
                    return;
                }
                
                const response = await fetch('api/chat/send_message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: message,
                        player_id: this.currentPlayer,
                        session_id: sessionId
                    })
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    // 清空输入框
                    this.chatMessage = '';
                    this.lastSendAtMs = Date.now();
                    
                    // 显示成功提示
                    this.showMessageNotification(this.t('page.chat.msg.send_success', '消息发送成功'), 'success');
                    
                    // 立即刷新消息列表以显示新发送的消息
                    setTimeout(() => {
                        this.loadNewMessages();
                    }, 500);
                } else {
                    this.showMessageNotification(result.message || this.t('page.chat.msg.send_failed', '发送失败'), 'error');
                }
            } catch (error) {
                console.error('发送消息失败:', error);
                this.showMessageNotification(this.t('page.chat.msg.network_send_failed', '网络错误，发送失败'), 'error');
            } finally {
                this.isSending = false;
            }
        },
        
        // 显示消息通知
        showMessageNotification(message, type = 'info') {
            // 创建通知元素
            const notification = document.createElement('div');
            const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
            const icon = type === 'success' ? 'fa-check' : type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle';
            
            notification.className = `fixed top-20 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300`;
            notification.innerHTML = `
                <div class="flex items-center space-x-2">
                    <i class="fas ${icon} mr-2"></i>
                    <span>${message}</span>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // 显示通知
            setTimeout(() => {
                notification.classList.remove('translate-x-full');
            }, 100);
            
            // 3秒后隐藏通知
            setTimeout(() => {
                notification.classList.add('translate-x-full');
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        }
    };
}
