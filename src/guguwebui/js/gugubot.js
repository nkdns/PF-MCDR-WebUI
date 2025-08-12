document.addEventListener('alpine:init', () => {
    Alpine.data('gugubotData', () => ({
        loading: true,
        saving: false,
        serverStatus: 'loading',
        userName: '',
        activeTab: null, // 初始化为 null，等待加载后设置
        
        // i18n（仅本页用）
        guguLang: 'zh-CN',
        guguDict: {},
        t(key, fallback = '') {
            const val = key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), this.guguDict);
            if (val != null) return String(val);
            if (window.I18n && typeof window.I18n.t === 'function') {
                const v = window.I18n.t(key);
                if (v && v !== key) return v;
            }
            return fallback || key;
        },
        async loadLangDict() {
            const stored = localStorage.getItem('lang') || (navigator.language || 'zh-CN');
            this.guguLang = stored.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
            try {
                const resp = await fetch(`lang/${this.guguLang}.json`, { cache: 'no-cache' });
                if (resp.ok) {
                    this.guguDict = await resp.json();
                } else {
                    this.guguDict = {};
                }
            } catch (e) {
                console.warn('loadLangDict failed:', e);
                this.guguDict = {};
            }
        },
        
        // 配置数据 (动态加载)
        configData: {}, // 使用一个对象存储所有配置数据，以 tabId 为键
        
        // 通知
        showNotification: false,
        notificationMessage: '',
        notificationType: 'success',
        
        // 对话框
        showDialog: false,
        dialogType: 'confirm', // 'confirm' 或 'prompt'
        dialogTitle: '',
        dialogMessage: '',
        dialogInputValue: '',
        dialogInputLabel: '',
        dialogInputPlaceholder: '',
        dialogInputPattern: '',
        dialogConfirmCallback: null,
        dialogCancelCallback: null,
        
        // 新增对象/键值对/列表项的临时变量
        newObjectKey: '',
        newObjectValue: '',
        newListItem: '',
        newMapKey: '',
        newMapValue: '',

        // 配置文件路径和标签 (动态加载)
        configFiles: [], // 存储从API获取的原始文件信息 { path: string, type: string, id: string, label: string }
        configPaths: {}, // 存储 tabId 到 文件路径的映射
        configTabs: [], // 存储选项卡信息 { id: string, label: string }

        // 翻译数据 (动态加载)
        translations: {}, // 存储配置项的翻译
        
        // 初始化
        async init() {
            try {
                // 语言包
                await this.loadLangDict();
                // 监听语言切换
                document.addEventListener('i18n:changed', (e) => {
                    const nextLang = (e && e.detail && e.detail.lang) ? e.detail.lang : this.guguLang;
                    this.guguLang = nextLang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
                    this.loadLangDict().then(() => {
                        this.rebuildTabLabels();
                    });
                });

                // 加载用户信息
                await this.loadUserInfo();
                
                // 加载服务器状态
                await this.loadServerStatus();

                // 加载配置文件列表和翻译
                await this.loadConfigFilesAndTranslations();

                // 加载当前活动选项卡的配置 (如果存在)
                if (this.activeTab) {
                    await this.loadConfigForTab(this.activeTab);
                }
                
            } catch (error) {
                console.error('初始化失败:', error);
                this.showNotificationMessage(this.t('page.gugubot.msg.init_failed_prefix', '页面初始化失败: ') + error.message, 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 根据id获取i18n的选项卡名称
        getI18nTabLabel(id, fallback = null) {
            // 优先 page.gugubot.tabs.{id}
            const key = `page.gugubot.tabs.${id}`;
            const usedFallback = fallback != null ? fallback : id;
            return this.t(key, usedFallback);
        },
        
        // 重建选项卡的 label（用于语言切换）
        rebuildTabLabels() {
            if (!Array.isArray(this.configTabs) || this.configTabs.length === 0) return;
            this.configTabs = this.configTabs.map(tab => ({
                id: tab.id,
                label: this.getI18nTabLabel(tab.id, tab.label || tab.id)
            }));
        },
        
        // 加载用户信息
        async loadUserInfo() {
            try {
                const response = await fetch('api/checkLogin');
                const data = await response.json();
                if (data.status === 'success') {
                    this.userName = data.username;
                }
            } catch (error) {
                 console.error('加载用户信息失败:', error);
                 // 即使失败也继续，可能只是无法显示用户名
            }
        },
        
        // 加载服务器状态
        async loadServerStatus() {
            try {
                const response = await fetch('api/get_server_status');
                const data = await response.json();
                this.serverStatus = data.status || 'error';
            } catch (error) {
                console.error('服务器状态获取失败:', error);
                this.serverStatus = 'error';
            }
        },

        // 加载配置文件列表和翻译
        async loadConfigFilesAndTranslations() {
            try {
                // 首先加载main配置(config.yml)以获取dict_address
                const mainResponse = await fetch('api/list_config_files?plugin_id=gugubot');
                
                if (!mainResponse.ok) {
                    throw new Error(`HTTP error! status: ${mainResponse.status}`);
                }
                
                const mainData = await mainResponse.json();
                
                if (!mainData || !Array.isArray(mainData.files)) {
                    throw new Error('无法获取配置文件列表');
                }
                
                // 找到config.yml文件
                let mainConfigPath = null;
                for (const path of mainData.files) {
                    if (path.endsWith('config.yml')) {
                        mainConfigPath = path;
                        break;
                    }
                }
                
                if (!mainConfigPath) {
                    throw new Error('无法找到config.yml文件');
                }
                
                // 加载config.yml内容
                const configResponse = await fetch(`api/load_config?path=${encodeURIComponent(mainConfigPath)}`);
                
                if (!configResponse.ok) {
                    throw new Error(`加载config.yml失败: ${configResponse.status}`);
                }
                
                const configData = await configResponse.json();
                
                // 确保有dict_address字段
                if (!configData.dict_address) {
                    throw new Error('config.yml中没有dict_address字段');
                }
                
                // 初始化配置文件列表
                this.configFiles = [];
                
                // 添加主配置
                this.configFiles.push({
                    path: mainConfigPath,
                    type: 'yml',
                    id: 'main',
                    label: this.getI18nTabLabel('main', '主配置')
                });
                
                // 从dict_address获取其他配置文件路径
                const dictAddress = configData.dict_address;
                
                // 将dict_address中的路径映射为configFiles
                const pathMapping = {
                    'ban_word_dict': { id: 'ban_word', labelKey: 'page.gugubot.tabs.ban_word' },
                    'key_word_dict': { id: 'key_word', labelKey: 'page.gugubot.tabs.key_word' },
                    'key_word_ingame_dict': { id: 'key_word_ingame', labelKey: 'page.gugubot.tabs.key_word_ingame' },
                    'customized_help_path': { id: 'help_msg', labelKey: 'page.gugubot.tabs.help_msg' },
                    'shenheman': { id: 'shenheman', labelKey: 'page.gugubot.tabs.shenheman' },
                    'start_command_dict': { id: 'start_commands', labelKey: 'page.gugubot.tabs.start_commands' },
                    'uuid_qqid': { id: 'uuid_qqid', labelKey: 'page.gugubot.tabs.uuid_qqid' }
                };
                
                // 遍历dict_address，添加到configFiles
                for (const [key, path] of Object.entries(dictAddress)) {
                    if (pathMapping[key]) {
                        const fileType = path.split('.').pop().toLowerCase();
                        this.configFiles.push({
                            path: path,
                            type: fileType,
                            id: pathMapping[key].id,
                            label: this.t(pathMapping[key].labelKey, pathMapping[key].id)
                        });
                    }
                }
                
                // 查找GUGUbot.json，可能不在dict_address中
                let bindFilePath = null;
                for (const path of mainData.files) {
                    if (path.includes('GUGUbot.json')) {
                        bindFilePath = path;
                        break;
                    }
                }
                
                if (bindFilePath) {
                    this.configFiles.push({
                        path: bindFilePath,
                        type: 'json',
                        id: 'bind',
                        label: this.getI18nTabLabel('bind', 'QQ-ID绑定')
                    });
                }

                // 生成 configPaths 和 configTabs
                this.configPaths = {};
                this.configTabs = [];
                let mainTab = { id: 'main', label: this.getI18nTabLabel('main', '主配置') };
                
                // 先将其添加到tabs中
                this.configTabs.push(mainTab);
                
                // 处理每个配置文件路径
                this.configFiles.forEach(file => {
                    this.configPaths[file.id] = file.path;
                    // 主配置已经添加过，跳过
                    if (file.id !== 'main') {
                        this.configTabs.push({ id: file.id, label: this.getI18nTabLabel(file.id, file.label || file.id) });
                    }
                });

                // 设置默认激活的tab为main
                this.activeTab = 'main';

                // 加载主配置的翻译
                try {
                    const transResponse = await fetch(`api/load_config?path=${encodeURIComponent(mainConfigPath)}&translation=true`);
                    if (transResponse.ok) {
                        const tdata = await transResponse.json();
                        this.translations = this.normalizeAnyTranslations(tdata);
                    } else {
                        console.warn(this.t('page.gugubot.msg.load_translations_failed', '加载翻译数据失败') + `: ${transResponse.status}`);
                        this.translations = {}; // 即使失败也继续
                    }
                } catch (transError) {
                    console.error(this.t('page.gugubot.msg.load_translations_failed', '加载翻译数据失败') + ':', transError);
                    this.translations = {}; // 保证 translations 是一个对象
                }

            } catch (error) {
                console.error('加载配置文件列表或翻译失败:', error);
                this.showNotificationMessage(this.t('page.gugubot.msg.load_config_files_failed_prefix', '无法加载配置信息: ') + error.message, 'error');
                // 保留空状态，让用户知道出错了
                this.configFiles = [];
                this.configPaths = {};
                this.configTabs = [];
                this.translations = {};
            }
        },

        // 为指定选项卡加载配置
        async loadConfigForTab(tabId) {
            if (!this.configPaths[tabId]) {
                console.error(`未找到选项卡 ${tabId} 的路径`);
                this.showNotificationMessage(this.t('page.gugubot.msg.cannot_load_tab_prefix', '无法加载 ') + this.getTabLabel(tabId) + this.t('page.gugubot.msg.config_suffix', ' 的配置'), 'error');
                return;
            }
            // 如果数据已加载，则不重复加载 (除非强制刷新)
             if (this.configData[tabId]) {
                 console.log(`配置 ${tabId} 已加载，跳过。`);
                 return;
             }


            this.loading = true; // 开始加载特定tab的数据
            try {
                const path = this.configPaths[tabId];
                const response = await fetch(`api/load_config?path=${encodeURIComponent(path)}`);
                 if (!response.ok) {
                     const errorText = await response.text();
                     throw new Error(`加载 ${path} 失败: ${response.status} ${errorText}`);
                 }
                const data = await response.json();
                 // 处理特殊情况：如果 shenheman.json 返回空对象，则将其转换为空数组
                 if ((tabId === 'shenheman') && typeof data === 'object' && data !== null && Object.keys(data).length === 0) {
                     this.configData[tabId] = {};
                 } else {
                    this.configData[tabId] = data;
                 }

            } catch (error) {
                console.error(`加载配置 ${tabId} 失败:`, error);
                this.showNotificationMessage(this.t('page.gugubot.msg.load_tab_failed_prefix', '加载配置失败: ') + this.getTabLabel(tabId) + `: ${error.message}`, 'error');
                this.configData[tabId] = null; // 标记为加载失败
            } finally {
                 this.loading = false;
            }
        },
        
        // 切换选项卡
        async switchTab(tabId) {
            this.activeTab = tabId;
            // 切换时加载配置数据
            await this.loadConfigForTab(tabId);
        },

        // 检查当前是否为帮助信息配置页
        isHelpMsgTab() {
            return this.activeTab === 'help_msg';
        },

        // 获取可编辑的帮助信息字段（仅允许编辑admin_help_msg和group_help_msg）
        getEditableHelpMsgFields() {
            if (!this.isHelpMsgTab() || !this.configData['help_msg']) {
                return [];
            }
            return Object.keys(this.configData['help_msg']).filter(key => 
                key === 'admin_help_msg' || key === 'group_help_msg'
            );
        },

        // 获取帮助提示信息（通常是A和W字段）
        getHelpMsgHints() {
            if (!this.isHelpMsgTab() || !this.configData['help_msg']) {
                return {};
            }
            return Object.fromEntries(
                Object.entries(this.configData['help_msg']).filter(([key]) => 
                    key !== 'admin_help_msg' && key !== 'group_help_msg'
                )
            );
        },

        // 更新帮助信息内容
        updateHelpMsgContent(key, value) {
            if (this.configData['help_msg']) {
                // 只允许更新admin_help_msg和group_help_msg
                if (key === 'admin_help_msg' || key === 'group_help_msg') {
                    this.configData['help_msg'][key] = value;
                }
            }
        },

        // 格式化帮助信息内容，将\n转换为HTML的<br>标签
        formatHelpMsgContent(content) {
            if (!content) return '';
            return content.replace(/\\n/g, '<br>');
        },

        // 获取Tab标签
        getTabLabel(tabId) {
            const tab = this.configTabs.find(t => t.id === tabId);
            return tab ? tab.label : tabId;
        },
        
        // 获取配置项名称 (优先使用翻译)
        getConfigName(key) {
            // 尝试从翻译中获取，translations[key] 可能是字符串或数组
            const translation = this.translations[key];
            if (typeof translation === 'string') {
                return translation;
            } else if (Array.isArray(translation) && translation.length > 0) {
                return translation[0]; // 取数组第一个元素作为名称
            }
            return key; // 没有翻译则返回原始 key
        },
        
        // 获取配置项描述 (优先使用翻译)
        getConfigDescription(key) {
            // 尝试从翻译中获取，取数组第二个元素作为描述
             const translation = this.translations[key];
            if (Array.isArray(translation) && translation.length > 1) {
                return translation[1];
            }
            return ''; // 没有翻译或翻译格式不对则返回空
        },

        // 归一化后端返回的多语言结构（YAML/JSON）到旧格式
        normalizeAnyTranslations(data) {
            if (!data || typeof data !== 'object') return {};
            // YAML/JSON 统一结构 { default, translations }
            if ('translations' in data) {
                const translations = data.translations || {};
                const ui = (window.I18n && window.I18n.lang) || 'zh-CN';
                const norm = (s) => {
                    if (!s) return 'zh-CN';
                    const t = String(s).replace('_', '-');
                    if (t.toLowerCase().startsWith('zh')) return 'zh-CN';
                    if (t.toLowerCase() === 'en' || t.toLowerCase() === 'en-us') return 'en-US';
                    if (t.includes('-')) { const [a,b] = t.split('-',2); return `${a.toLowerCase()}-${(b||'').toUpperCase()}`; }
                    return t;
                };
                const current = norm(ui);
                const def = norm(data.default || 'zh-CN');
                const pick = translations[current] || translations[def] || translations[Object.keys(translations)[0]] || {};
                const out = {};
                Object.keys(pick).forEach(k => {
                    const entry = pick[k];
                    if (Array.isArray(entry)) {
                        out[k] = entry.length > 1 ? [String(entry[0]||''), String(entry[1]||'')] : String(entry[0]||'');
                    } else if (entry && typeof entry === 'object') {
                        const name = entry.name != null ? String(entry.name) : '';
                        const desc = entry.desc != null ? String(entry.desc) : undefined;
                        out[k] = desc != null ? [name, desc] : name;
                    } else if (typeof entry === 'string') {
                        out[k] = entry;
                    }
                });
                return out;
            }
            // 旧格式：直接返回
            return data;
        },
        
        // 判断是否应该显示主配置中的项 (过滤掉 dict_address 本身)
        shouldDisplayMainConfigItem(key) {
            return key !== 'dict_address';
        },

        // 获取当前活动选项卡的文件类型
        getActiveFileType() {
            const file = this.configFiles.find(f => f.id === this.activeTab);
            return file ? file.type : null;
        },
        
        // 获取当前活动选项卡的数据
        getActiveConfigData() {
            return this.configData[this.activeTab];
        },

        // --- 对话框相关函数 ---
        
        // 显示确认对话框
        showConfirmDialog(title, message, confirmCallback, cancelCallback = null) {
            this.dialogType = 'confirm';
            this.dialogTitle = title;
            this.dialogMessage = message;
            this.dialogConfirmCallback = confirmCallback;
            this.dialogCancelCallback = cancelCallback;
            this.showDialog = true;
        },
        
        // 显示输入对话框
        showPromptDialog(title, message, inputLabel, placeholder, pattern = '', confirmCallback, cancelCallback = null) {
            this.dialogType = 'prompt';
            this.dialogTitle = title;
            this.dialogMessage = message;
            this.dialogInputLabel = inputLabel;
            this.dialogInputPlaceholder = placeholder;
            this.dialogInputPattern = pattern;
            this.dialogInputValue = '';
            this.dialogConfirmCallback = confirmCallback;
            this.dialogCancelCallback = cancelCallback;
            this.showDialog = true;
        },
        
        // 确认对话框
        confirmDialog() {
            if (this.dialogConfirmCallback) {
                if (this.dialogType === 'prompt') {
                    this.dialogConfirmCallback(this.dialogInputValue);
                } else {
                    this.dialogConfirmCallback();
                }
            }
            this.showDialog = false;
        },
        
        // 取消对话框
        cancelDialog() {
            if (this.dialogCancelCallback) {
                this.dialogCancelCallback();
            }
            this.showDialog = false;
        },

        // --- 通用编辑函数 ---
        updateConfigValue(key, value) {
            if (this.configData[this.activeTab]) {
                this.configData[this.activeTab][key] = value;
            }
        },
        
        // 安全地解析JSON字符串并更新配置值
        updateJsonValue(key, jsonString) {
            try {
                const parsedValue = JSON.parse(jsonString);
                this.updateConfigValue(key, parsedValue);
            } catch (error) {
                console.warn('无效的JSON数据:', error);
                // 可选：在此处添加用户通知，但由于是实时输入，可能导致过多通知
            }
        },
        
        updateListItem(index, value) {
            if (Array.isArray(this.configData[this.activeTab])) {
                this.configData[this.activeTab][index] = value;
            }
        },
        addListItem() {
            if (!this.newListItem.trim()) return;
            if (Array.isArray(this.configData[this.activeTab])) {
                 this.configData[this.activeTab].push(this.newListItem);
                 this.newListItem = '';
             } else {
                 // 如果当前不是数组，则创建一个新数组 (适用于 ban_word 等空文件的情况)
                 this.configData[this.activeTab] = [this.newListItem];
                 this.newListItem = '';
             }
        },
        removeListItem(index) {
            if (Array.isArray(this.configData[this.activeTab])) {
                this.configData[this.activeTab].splice(index, 1);
            }
        },
         addMapItem() {
             if (!this.newMapKey.trim()) return;
             if (typeof this.configData[this.activeTab] === 'object' && this.configData[this.activeTab] !== null) {
                  // 检查key是否已存在
                 if (this.configData[this.activeTab].hasOwnProperty(this.newMapKey)) {
                     this.showConfirmDialog(
                         this.t('page.gugubot.msg.key_exists_title', '键已存在'),
                         this.t('page.gugubot.msg.key_exists_prefix', '键 "') + this.newMapKey + this.t('page.gugubot.msg.key_exists_suffix', '" 已存在，要覆盖它吗？'),
                         () => {
                             this.configData[this.activeTab][this.newMapKey] = this.newMapValue;
                             this.newMapKey = '';
                             this.newMapValue = '';
                         }
                     );
                     return;
                 }
                 this.configData[this.activeTab][this.newMapKey] = this.newMapValue;
                 this.newMapKey = '';
                 this.newMapValue = '';
             } else {
                  // 如果当前不是对象，创建新对象
                  this.configData[this.activeTab] = { [this.newMapKey]: this.newMapValue };
                  this.newMapKey = '';
                  this.newMapValue = '';
             }
         },
         removeMapItem(key) {
             if (typeof this.configData[this.activeTab] === 'object' && this.configData[this.activeTab] !== null) {
                 this.showConfirmDialog(
                     this.t('page.gugubot.msg.confirm_delete_title', '确认删除'),
                     this.t('page.gugubot.msg.confirm_delete_key_prefix', '确定要删除键 "') + key + this.t('page.gugubot.msg.confirm_delete_key_suffix', '" 吗？'),
                     () => {
                         delete this.configData[this.activeTab][key];
                     }
                 );
             }
         },


        // --- 针对特定配置文件的编辑函数 ---

        // 更新主配置 (config.yml)
        updateMainConfigValue(key, value) { this.updateConfigValue(key, value); },
        updateMainConfigArrayItem(key, index, value) {
            if (this.configData['main'] && Array.isArray(this.configData['main'][key])) {
                this.configData['main'][key][index] = value;
            }
        },
        addMainConfigArrayItem(key) {
            if (this.configData['main'] && !Array.isArray(this.configData['main'][key])) {
                 this.configData['main'][key] = [];
            }
             if (this.configData['main']) {
                this.configData['main'][key].push('');
             }
        },
        removeMainConfigArrayItem(key, index) {
            if (this.configData['main'] && Array.isArray(this.configData['main'][key])) {
                this.configData['main'][key].splice(index, 1);
            }
        },
        updateMainConfigObjectProperty(key, subKey, value) {
            if (this.configData['main'] && typeof this.configData['main'][key] === 'object' && this.configData['main'][key] !== null) {
                this.configData['main'][key][subKey] = value;
            }
        },
        addMainConfigObjectProperty(key) {
            if (!this.newObjectKey.trim()) { 
                this.showNotificationMessage(this.t('page.gugubot.msg.key_required', '键名不能为空'), 'error'); 
                return; 
            }
            if (this.configData['main']) {
                 if (!this.configData['main'][key]) { this.configData['main'][key] = {}; }
                  // 检查 key 是否已存在
                  if (this.configData['main'][key].hasOwnProperty(this.newObjectKey)) {
                       this.showConfirmDialog(
                           this.t('page.gugubot.msg.prop_exists_title', '属性已存在'),
                           this.t('page.gugubot.msg.prop_exists_prefix', '属性 "') + this.newObjectKey + this.t('page.gugubot.msg.prop_exists_middle', '" 已存在于 "') + key + this.t('page.gugubot.msg.prop_exists_suffix', '" 中，要覆盖它吗？'),
                          () => {
                              this.configData['main'][key][this.newObjectKey] = this.newObjectValue;
                              this.newObjectKey = ''; 
                              this.newObjectValue = '';
                          }
                      );
                      return;
                  }
                this.configData['main'][key][this.newObjectKey] = this.newObjectValue;
                this.newObjectKey = ''; 
                this.newObjectValue = '';
            }
        },
         removeMainConfigObjectProperty(key, subKey) {
             if (this.configData['main'] && typeof this.configData['main'][key] === 'object' && this.configData['main'][key] !== null) {
                 this.showConfirmDialog(
                     this.t('page.gugubot.msg.confirm_delete_title', '确认删除'),
                     this.t('page.gugubot.msg.confirm_delete_prop_prefix', '确定要删除 "') + key + this.t('page.gugubot.msg.confirm_delete_prop_middle', '" 中的属性 "') + subKey + this.t('page.gugubot.msg.confirm_delete_prop_suffix', '" 吗？'),
                     () => {
                         delete this.configData['main'][key][subKey];
                     }
                 );
             }
         },


        // 关键词配置 (key_word.json, key_word_ingame.json)
        updateKeywordValue(key, value) { this.updateConfigValue(key, value); },
        addKeyword() { this.addMapItem(); },
        removeKeyword(key) { this.removeMapItem(key); },

        // 绑定配置 (GUGUbot.json)
         updateBindValue(qqId, index, gameId) {
             if (this.configData['bind'] && Array.isArray(this.configData['bind'][qqId])) {
                 this.configData['bind'][qqId][index] = gameId;
             }
         },
         addBindQQ() {
             this.showPromptDialog(
                 this.t('page.gugubot.bind.prompt_add_title', '添加QQ绑定'),
                 this.t('page.gugubot.bind.prompt_add_message', '请输入要绑定的QQ号'),
                 this.t('page.gugubot.uuid_qqid.label_qq', 'QQ号'),
                 this.t('page.gugubot.bind.placeholder_qq', '请输入QQ号码'),
                 "^[0-9]+$",
                 (newKey) => {
                     if (newKey && newKey.trim() && /^[0-9]+$/.test(newKey)) { // 验证是否为纯数字
                         const currentData = this.configData['bind'] || {};
                          // 检查 key 是否已存在
                         if (currentData.hasOwnProperty(newKey)) {
                             this.showConfirmDialog(
                                 this.t('page.gugubot.bind.qq_exists_title', 'QQ号已存在'),
                                 this.t('page.gugubot.bind.qq_exists_prefix', 'QQ号 "') + newKey + this.t('page.gugubot.bind.qq_exists_suffix', '" 已存在绑定信息，要继续添加吗 (这可能会覆盖原有数据)？'),
                                 () => {
                                     // 初始化为空数组，允许用户添加第一个游戏ID
                                     currentData[newKey] = ['']; // 添加一个空字符串，让用户可以编辑第一个游戏ID
                                     this.configData['bind'] = currentData;
                                 }
                             );
                         } else {
                             // 初始化为空数组，允许用户添加第一个游戏ID
                             currentData[newKey] = ['']; // 添加一个空字符串，让用户可以编辑第一个游戏ID
                             this.configData['bind'] = currentData;
                         }
                     } else {
                           this.showNotificationMessage(this.t('page.gugubot.bind.qq_invalid', '请输入有效的QQ号。'), 'error');
                     }
                 }
             );
         },
          addBindGameId(qqId) {
             if (this.configData['bind'] && Array.isArray(this.configData['bind'][qqId])) {
                  // 添加一个空字符串，让用户可以编辑
                  this.configData['bind'][qqId].push('');
             }
         },
         removeBindGameId(qqId, index) {
             if (this.configData['bind'] && Array.isArray(this.configData['bind'][qqId])) {
                 this.configData['bind'][qqId].splice(index, 1);
                 // 如果移除后数组为空，则询问是否删除整个QQ绑定
                 if (this.configData['bind'][qqId].length === 0) {
                      this.showConfirmDialog(
                          this.t('page.gugubot.msg.confirm_delete_title', '确认删除'),
                          this.t('page.gugubot.bind.confirm_delete_qq_when_empty_prefix', 'QQ号 "') + qqId + this.t('page.gugubot.bind.confirm_delete_qq_when_empty_suffix', '" 下已没有绑定的游戏ID，要删除这个QQ号的绑定记录吗？'),
                         () => {
                             delete this.configData['bind'][qqId];
                         },
                         () => {
                             // 如果用户取消，添加一个空ID防止显示错误
                             this.configData['bind'][qqId].push('');
                         }
                     );
                 }
             }
         },
         removeBindQQ(qqId) {
             if (this.configData['bind']) {
                  this.showConfirmDialog(
                      this.t('page.gugubot.msg.confirm_delete_title', '确认删除'),
                      this.t('page.gugubot.bind.confirm_delete_all_prefix', '确定要删除QQ号 "') + qqId + this.t('page.gugubot.bind.confirm_delete_all_suffix', '" 的所有绑定信息吗？'),
                     () => {
                         delete this.configData['bind'][qqId];
                     }
                 );
             }
         },


        // 违禁词配置 (ban_word.json) / 审核员 (shenheman.json)
        updateBanWord(index, value) { this.updateListItem(index, value); },
        addBanWord() { 
            if (this.activeTab === 'ban_word') {
                // 违禁词使用键值对编辑器
                this.addMapItem();
            } else {
                // 审核员仍然使用列表编辑器
                this.addMapItem();
            }
        },
        removeBanWord(index) { 
            if (this.activeTab === 'ban_word') {
                // 这个不会被调用，因为界面上使用的是键而不是索引
                // 实际删除操作在removeKeyword中进行
            } else {
                this.removeListItem(index);
            }
        },
        
        // 更新审核员别名数组项
        updateShenhemanAlias(qqId, index, value) {
            if (this.configData['shenheman'] && Array.isArray(this.configData['shenheman'][qqId])) {
                this.configData['shenheman'][qqId][index] = value;
            }
        },
        
        // 添加审核员别名
        addShenhemanAlias(qqId) {
            if (this.configData['shenheman'] && Array.isArray(this.configData['shenheman'][qqId])) {
                this.configData['shenheman'][qqId].push('');
            }
        },
        
        // 删除审核员别名
        removeShenhemanAlias(qqId, index) {
            if (this.configData['shenheman'] && Array.isArray(this.configData['shenheman'][qqId])) {
                this.configData['shenheman'][qqId].splice(index, 1);
                // 如果移除后数组为空，询问是否删除整个审核员
                if (this.configData['shenheman'][qqId].length === 0) {
                      this.showConfirmDialog(
                          this.t('page.gugubot.msg.confirm_delete_title', '确认删除'),
                          this.t('page.gugubot.shenhe.confirm_delete_qq_when_empty_prefix', 'QQ号 "') + qqId + this.t('page.gugubot.shenhe.confirm_delete_qq_when_empty_suffix', '" 下已没有别名，要删除这个审核员QQ号记录吗？'),
                        () => {
                            delete this.configData['shenheman'][qqId];
                        },
                        () => {
                            // 如果用户取消，添加一个空别名防止显示错误
                            this.configData['shenheman'][qqId].push('');
                        }
                    );
                }
            }
        },
        
        // 添加审核员QQ
        addShenhemanQQ() {
            this.showPromptDialog(
                this.t('page.gugubot.shenhe.prompt_add_title', '添加审核员'),
                this.t('page.gugubot.shenhe.prompt_add_message', '请输入新的审核员QQ号'),
                this.t('page.gugubot.shenhe.qq', '审核员QQ'),
                this.t('page.gugubot.shenhe.placeholder_qq', '请输入审核员QQ号码'),
                "^[0-9]+$",
                (newKey) => {
                    if (newKey && newKey.trim() && /^[0-9]+$/.test(newKey)) { // 验证是否为纯数字
                        const currentData = this.configData['shenheman'] || {};
                        // 检查 key 是否已存在
                        if (currentData.hasOwnProperty(newKey)) {
                            this.showConfirmDialog(
                                this.t('page.gugubot.shenhe.qq_exists_title', 'QQ号已存在'),
                                this.t('page.gugubot.shenhe.qq_exists_prefix', 'QQ号 "') + newKey + this.t('page.gugubot.shenhe.qq_exists_suffix', '" 已存在审核信息，要继续添加吗？'),
                                () => {
                                    // 初始化为空数组
                                    currentData[newKey] = [''];
                                    this.configData['shenheman'] = currentData;
                                }
                            );
                        } else {
                            // 初始化为空数组
                            currentData[newKey] = [''];
                            this.configData['shenheman'] = currentData;
                        }
                    } else {
                        this.showNotificationMessage(this.t('page.gugubot.shenhe.qq_invalid', '请输入有效的QQ号。'), 'error');
                    }
                }
            );
        },
        
        // 删除审核员QQ
        removeShenhemanQQ(qqId) {
            if (this.configData['shenheman']) {
                this.showConfirmDialog(
                    this.t('page.gugubot.msg.confirm_delete_title', '确认删除'),
                    this.t('page.gugubot.shenhe.confirm_delete_all_prefix', '确定要删除审核员QQ号 "') + qqId + this.t('page.gugubot.shenhe.confirm_delete_all_suffix', '" 的所有信息吗？'),
                    () => {
                        delete this.configData['shenheman'][qqId];
                    }
                );
            }
        },

        // 保存配置
        async saveConfig() {
            if (!this.activeTab || !this.configPaths[this.activeTab]) {
                 this.showNotificationMessage(this.t('page.gugubot.msg.no_active_or_invalid_path', '没有活动的配置或路径无效'), 'error');
                 return;
            }
            this.saving = true;
            const tabId = this.activeTab;
            const path = this.configPaths[tabId];
            const dataToSave = this.configData[tabId];
             const tabLabel = this.getTabLabel(tabId);


            try {
                const response = await fetch('api/save_config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file_path: path,
                        config_data: dataToSave
                    })
                });
                
                const result = await response.json();
                
                if (result.status !== 'success') {
                    throw new Error(result.message || '保存失败');
                }
                
                this.showNotificationMessage(`${tabLabel}` + this.t('page.gugubot.msg.save_success_suffix', ' 配置保存成功！'), 'success');
            } catch (error) {
                console.error(`保存配置 ${tabLabel} 失败:`, error);
                this.showNotificationMessage(this.t('page.gugubot.msg.save_failed_prefix', '保存 ') + `${tabLabel}` + this.t('page.gugubot.msg.config_failed_suffix', ' 配置失败: ') + error.message, 'error');
            } finally {
                this.saving = false;
            }
        },
        
        // 显示通知消息
        showNotificationMessage(message, type = 'success') {
            this.notificationMessage = message;
            this.notificationType = type;
            this.showNotification = true;
            setTimeout(() => { this.showNotification = false; }, 3000);
        }
    }));
}); 