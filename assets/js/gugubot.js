document.addEventListener('alpine:init', () => {
    Alpine.data('gugubotData', () => ({
        loading: true,
        saving: false,
        serverStatus: 'loading',
        userName: '',
        activeTab: null, // 初始化为 null，等待加载后设置
        
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
                
                // 设置当前年份
                document.getElementById('year').textContent = new Date().getFullYear();
                
            } catch (error) {
                console.error('初始化失败:', error);
                this.showNotificationMessage('页面初始化失败: ' + error.message, 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 加载用户信息
        async loadUserInfo() {
            try {
                // 检查localStorage中的登录状态
                const isLoggedIn = localStorage.getItem('isLoggedIn');
                const username = localStorage.getItem('username');
                
                if (isLoggedIn === 'true' && username) {
                    this.userName = username;
                    return;
                }
                
                // 如果localStorage中没有登录状态，重定向到登录页
                window.location.href = '../login.html';
            } catch (error) {
                console.error('加载用户信息失败:', error);
                window.location.href = '../login.html';
            }
        },
        
        // 加载服务器状态
        async loadServerStatus() {
            try {
                const response = await fetch('../data/server_status.json');
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
                // 直接定义配置文件列表
                this.configFiles = [
                    { path: 'config.json', type: 'json', id: 'main', label: '主配置' },
                    { path: 'ban_word.json', type: 'json', id: 'ban_word', label: '违禁词' },
                    { path: 'key_word.json', type: 'json', id: 'key_word', label: 'QQ关键词' },
                    { path: 'key_word_ingame.json', type: 'json', id: 'key_word_ingame', label: '游戏内关键词' },
                    { path: 'help_msg.json', type: 'json', id: 'help_msg', label: '帮助信息' },
                    { path: 'shenheman.json', type: 'json', id: 'shenheman', label: '审核员' },
                    { path: 'start_commands.json', type: 'json', id: 'start_commands', label: '开服指令' },
                    { path: 'uuid_qqid.json', type: 'json', id: 'uuid_qqid', label: 'UUID-QQID' },
                    { path: 'GUGUbot.json', type: 'json', id: 'bind', label: 'QQ-游戏ID绑定' }
                ];
                
                // 初始化配置选项卡
                this.configTabs = this.configFiles.map(file => ({
                    id: file.id,
                    label: file.label
                }));
                
                // 设置默认选项卡
                if (this.configTabs.length > 0) {
                    this.activeTab = this.configTabs[0].id;
                }
                
                // 生成 configPaths
                this.configPaths = {};
                this.configFiles.forEach(file => {
                    this.configPaths[file.id] = file.path;
                });

                // 设置默认激活的tab为main
                this.activeTab = 'main';

                // 加载翻译数据
                try {
                    const transResponse = await fetch('../data/GUGUBot/config_lang.json');
                    if (transResponse.ok) {
                        const transData = await transResponse.json();
                        this.translations = transData.zh_cn || {};
                    } else {
                        console.warn('加载翻译文件失败，使用默认翻译');
                        this.translations = {};
                    }
                } catch (transError) {
                    console.error('加载翻译数据失败:', transError);
                    this.translations = {};
                }

            } catch (error) {
                console.error('加载配置文件列表或翻译失败:', error);
                this.showNotificationMessage('无法加载配置信息: ' + error.message, 'error');
                // 保留空状态，让用户知道出错了
                this.configFiles = [];
                this.configPaths = {};
                this.configTabs = [];
                this.translations = {};
            }
        },

        // 为指定选项卡加载配置
        async loadConfigForTab(tabId) {
            // 如果数据已加载，则不重复加载 (除非强制刷新)
            if (this.configData[tabId]) {
                console.log(`配置 ${tabId} 已加载，跳过。`);
                return;
            }

            this.loading = true; // 开始加载特定tab的数据
            try {
                let data;
                
                // 根据tabId加载对应的本地JSON文件
                switch (tabId) {
                    case 'main':
                        const mainResponse = await fetch('../data/GUGUBot/config.json');
                        if (!mainResponse.ok) {
                            throw new Error(`加载主配置失败: ${mainResponse.status}`);
                        }
                        data = await mainResponse.json();
                        break;
                    case 'ban_word':
                        const banWordResponse = await fetch('../data/GUGUBot/ban_word.json');
                        data = await banWordResponse.json();
                        break;
                    case 'key_word':
                        const keyWordResponse = await fetch('../data/GUGUBot/key_word.json');
                        data = await keyWordResponse.json();
                        break;
                    case 'key_word_ingame':
                        const keyWordIngameResponse = await fetch('../data/GUGUBot/key_word_ingame.json');
                        data = await keyWordIngameResponse.json();
                        break;
                    case 'help_msg':
                        const helpMsgResponse = await fetch('../data/GUGUBot/help_msg.json');
                        data = await helpMsgResponse.json();
                        break;
                    case 'shenheman':
                        const shenhemanResponse = await fetch('../data/GUGUBot/shenheman.json');
                        data = await shenhemanResponse.json();
                        break;
                    case 'start_commands':
                        const startCommandsResponse = await fetch('../data/GUGUBot/start_commands.json');
                        data = await startCommandsResponse.json();
                        break;
                    case 'uuid_qqid':
                        const uuidQqidResponse = await fetch('../data/GUGUBot/uuid_qqid.json');
                        data = await uuidQqidResponse.json();
                        break;
                    case 'bind':
                        const bindResponse = await fetch('../data/GUGUBot/GUGUbot.json');
                        data = await bindResponse.json();
                        break;
                    default:
                        throw new Error(`未知的配置类型: ${tabId}`);
                }
                
                // 处理特殊情况：如果 shenheman.json 返回空对象，则将其转换为空数组
                if ((tabId === 'shenheman') && typeof data === 'object' && data !== null && Object.keys(data).length === 0) {
                    this.configData[tabId] = {};
                } else {
                    this.configData[tabId] = data;
                 }

            } catch (error) {
                console.error(`加载配置 ${tabId} 失败:`, error);
                this.showNotificationMessage(`加载 ${this.getTabLabel(tabId)} 配置失败: ${error.message}`, 'error');
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
                         "键已存在",
                         `键 "${this.newMapKey}" 已存在，要覆盖它吗？`,
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
                     "确认删除",
                     `确定要删除键 "${key}" 吗？`,
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
                this.showNotificationMessage('键名不能为空', 'error'); 
                return; 
            }
            if (this.configData['main']) {
                 if (!this.configData['main'][key]) { this.configData['main'][key] = {}; }
                  // 检查 key 是否已存在
                  if (this.configData['main'][key].hasOwnProperty(this.newObjectKey)) {
                      this.showConfirmDialog(
                          "属性已存在",
                          `属性 "${this.newObjectKey}" 已存在于 "${key}" 中，要覆盖它吗？`,
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
                     "确认删除",
                     `确定要删除 "${key}" 中的属性 "${subKey}" 吗？`,
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
                 "添加QQ绑定",
                 "请输入要绑定的QQ号",
                 "QQ号",
                 "请输入QQ号码",
                 "^[0-9]+$",
                 (newKey) => {
                     if (newKey && newKey.trim() && /^[0-9]+$/.test(newKey)) { // 验证是否为纯数字
                         const currentData = this.configData['bind'] || {};
                          // 检查 key 是否已存在
                         if (currentData.hasOwnProperty(newKey)) {
                             this.showConfirmDialog(
                                 "QQ号已存在",
                                 `QQ号 "${newKey}" 已存在绑定信息，要继续添加吗 (这可能会覆盖原有数据)？`,
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
                          this.showNotificationMessage('请输入有效的QQ号。', 'error');
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
                         "确认删除",
                         `QQ号 "${qqId}" 下已没有绑定的游戏ID，要删除这个QQ号的绑定记录吗？`,
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
                     "确认删除",
                     `确定要删除QQ号 "${qqId}" 的所有绑定信息吗？`,
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
                        "确认删除",
                        `QQ号 "${qqId}" 下已没有别名，要删除这个审核员QQ号记录吗？`,
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
                "添加审核员",
                "请输入新的审核员QQ号",
                "QQ号",
                "请输入审核员QQ号码",
                "^[0-9]+$",
                (newKey) => {
                    if (newKey && newKey.trim() && /^[0-9]+$/.test(newKey)) { // 验证是否为纯数字
                        const currentData = this.configData['shenheman'] || {};
                        // 检查 key 是否已存在
                        if (currentData.hasOwnProperty(newKey)) {
                            this.showConfirmDialog(
                                "QQ号已存在",
                                `QQ号 "${newKey}" 已存在审核信息，要继续添加吗?`,
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
                        this.showNotificationMessage('请输入有效的QQ号。', 'error');
                    }
                }
            );
        },
        
        // 删除审核员QQ
        removeShenhemanQQ(qqId) {
            if (this.configData['shenheman']) {
                this.showConfirmDialog(
                    "确认删除",
                    `确定要删除审核员QQ号 "${qqId}" 的所有信息吗？`,
                    () => {
                        delete this.configData['shenheman'][qqId];
                    }
                );
            }
        },

        // 保存配置
        async saveConfig() {
            this.saving = true;
            try {
                // 模拟保存成功
                setTimeout(() => {
                    this.showNotificationMessage('所有配置保存成功', 'success');
                    this.saving = false;
                }, 1000);
                
            } catch (error) {
                console.error('保存配置时出错:', error);
                this.showNotificationMessage('保存配置失败: ' + error.message, 'error');
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