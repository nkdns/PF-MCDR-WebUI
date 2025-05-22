// 终端页面的JavaScript功能
document.addEventListener('alpine:init', () => {
    Alpine.data('terminalData', () => ({
        serverStatus: 'loading',
        userName: '',
        serverVersion: '',
        processingServer: false,
        showNotification: false,
        notificationMessage: '',
        notificationType: 'success',
        
        // 终端相关数据
        logs: [],
        lastLine: 0,
        totalLines: 0,
        isLoading: true,
        autoScroll: true,
        autoRefresh: true,
        filterText: '',
        refreshInterval: null,
        commandInput: '', // 命令输入框内容
        commandHistory: [], // 命令历史记录
        historyIndex: -1, // 当前历史记录索引
        tempCommand: '', // 临时保存当前命令

        // AI询问相关
        showAiQueryModal: false,
        aiQueryTitle: 'AI日志分析询问',
        aiQuery: '',
        aiLogPreview: '',
        aiSelectedText: '',
        aiResponse: '',
        aiLoading: false,
        aiContinueChat: false,
        aiChatHistory: [], // 用于连续对话

        // API Key设置相关
        showApiKeyModal: false,
        apiKey: '',
        apiKeyValidated: false,
        
        // 新增的日志计数器
        lastLogCounter: 0,
        
        // 命令补全相关数据和方法
        commandSuggestions: [],
        showSuggestions: false,
        selectedSuggestionIndex: -1,
        suggestionTimer: null,
        
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
        
        async checkServerStatus() {
            try {
                this.serverStatus = 'loading';
                const response = await fetch('api/get_server_status');
                const data = await response.json();
                this.serverStatus = data.status || 'offline';
                this.serverVersion = data.version || '';
            } catch (error) {
                console.error('Error checking server status:', error);
                this.serverStatus = 'error';
            }
        },
        
        // 加载日志
        async loadLogs() {
            this.isLoading = true;
            try {
                // 构建URL参数，不再指定日志类型
                const params = new URLSearchParams({
                    max_lines: 500
                });
                
                const response = await fetch(`api/server_logs?${params.toString()}`);
                const data = await response.json();
                
                if (data.status === 'success') {
                    this.logs = data.logs || [];
                    this.totalLines = data.total_lines || 0;
                    this.lastLine = data.current_end || this.totalLines;
                    
                    // 保存最后日志的计数器ID，用于增量更新
                    if (this.logs.length > 0) {
                        // 假设日志按计数器顺序排列，取最后一条的计数器
                        const lastLog = this.logs[this.logs.length - 1];
                        this.lastLogCounter = lastLog.counter || 0;
                    } else {
                        this.lastLogCounter = 0;
                    }
                    
                    // 加载完成后始终滚动到底部
                    if (this.autoScroll) {
                        this.$nextTick(() => {
                            const terminal = document.getElementById('terminal');
                            if (terminal) {
                                terminal.scrollTop = terminal.scrollHeight;
                            }
                        });
                    }
                } else {
                    this.showNotificationMsg(`加载日志失败: ${data.message || '未知错误'}`, 'error');
                }
            } catch (error) {
                console.error('Error loading logs:', error);
                this.showNotificationMsg('加载日志失败', 'error');
            } finally {
                this.isLoading = false;
            }
        },
        
        // 获取新日志
        async fetchNewLogs() {
            if (this.isLoading) return;
            
            try {
                // 使用计数器增量获取新日志
                const params = new URLSearchParams({
                    last_counter: this.lastLogCounter || 0,
                    max_lines: 100  // 每次获取的最大新日志数量
                });
                
                const response = await fetch(`api/new_logs?${params.toString()}`);
                const data = await response.json();
                
                if (data.status === 'success') {
                    // 如果有新日志
                    if (data.new_logs_count > 0) {
                        // 创建一个已有计数器ID的集合，用于去重
                        const existingCounters = new Set(this.logs.map(log => log.counter));
                        
                        // 筛选出不重复的新日志
                        const uniqueNewLogs = data.logs.filter(log => !existingCounters.has(log.counter));
                        
                        if (uniqueNewLogs.length > 0) {
                            // 追加不重复的新日志到现有日志列表
                            this.logs = [...this.logs, ...uniqueNewLogs];
                            this.totalLines = data.total_lines || this.totalLines;
                            
                            // 更新最后日志计数器
                            this.lastLogCounter = data.last_counter;
                            
                            // 限制日志数量，避免内存溢出
                            const maxLogsToKeep = 1000;
                            if (this.logs.length > maxLogsToKeep) {
                                this.logs = this.logs.slice(this.logs.length - maxLogsToKeep);
                            }
                            
                            // 如果启用了自动滚动，滚动到底部
                            if (this.autoScroll) {
                                this.$nextTick(() => {
                                    const terminal = document.getElementById('terminal');
                                    if (terminal) {
                                        terminal.scrollTop = terminal.scrollHeight;
                                    }
                                });
                            }
                        } else {
                            // 虽然服务器返回了新日志，但都是重复的
                            // console.log('收到的日志都是重复的，已跳过');
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching new logs:', error);
            }
        },
        
        // 获取命令补全建议
        async fetchCommandSuggestions(input) {
            try {
                if (!input || !input.startsWith('!!')) {
                    this.commandSuggestions = [];
                    this.showSuggestions = false;
                    return;
                }
                
                // 添加300ms延迟，避免频繁请求
                clearTimeout(this.suggestionTimer);
                this.suggestionTimer = setTimeout(async () => {
                    const params = new URLSearchParams({
                        input: input
                    });
                    
                    const response = await fetch(`api/command_suggestions?${params.toString()}`);
                    const data = await response.json();
                    
                    if (data.status === 'success') {
                        this.commandSuggestions = data.suggestions || [];
                        this.showSuggestions = this.commandSuggestions.length > 0;
                        this.selectedSuggestionIndex = this.showSuggestions ? 0 : -1;
                    } else {
                        this.commandSuggestions = [];
                        this.showSuggestions = false;
                    }
                }, 300);
            } catch (error) {
                console.error('Error fetching command suggestions:', error);
                this.commandSuggestions = [];
                this.showSuggestions = false;
            }
        },
        
        // 处理输入框内容变化
        handleCommandInputChange() {
            // 只有以!!开头的输入才触发补全
            if (this.commandInput && this.commandInput.startsWith('!!')) {
                this.fetchCommandSuggestions(this.commandInput);
            } else {
                this.showSuggestions = false;
                this.commandSuggestions = [];
            }
        },
        
        // 选择命令补全建议
        selectSuggestion(index) {
            if (index >= 0 && index < this.commandSuggestions.length) {
                const suggestion = this.commandSuggestions[index];
                
                // 检查命令是否包含参数提示（被<>包围的部分）
                if (suggestion.command.includes('<') && suggestion.command.includes('>')) {
                    // 如果包含参数提示，不要直接补全整个命令
                    // 而是保留到参数开始的部分
                    const parts = suggestion.command.split('<');
                    // 使用第一部分（命令前缀，不包括参数提示）
                    this.commandInput = parts[0].trim();
                } else {
                    // 不包含参数提示的命令，直接使用完整命令
                    this.commandInput = suggestion.command;
                }
                
                this.showSuggestions = false;
                this.commandSuggestions = [];
                
                // 聚焦回输入框，并将光标移到末尾
                this.$nextTick(() => {
                    const inputElement = document.getElementById('commandInput');
                    if (inputElement) {
                        inputElement.focus();
                        inputElement.selectionStart = inputElement.selectionEnd = inputElement.value.length;
                    }
                });
            }
        },
        
        // 处理键盘事件
        handleKeyDown(event) {
            // 如果显示补全列表，处理上下方向键
            if (this.showSuggestions) {
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    this.selectedSuggestionIndex = (this.selectedSuggestionIndex + 1) % this.commandSuggestions.length;
                    this.$nextTick(() => this.scrollToSelectedSuggestion());
                } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    this.selectedSuggestionIndex = (this.selectedSuggestionIndex - 1 + this.commandSuggestions.length) % this.commandSuggestions.length;
                    this.$nextTick(() => this.scrollToSelectedSuggestion());
                } else if (event.key === 'Tab' || event.key === 'Enter') {
                    event.preventDefault();
                    this.selectSuggestion(this.selectedSuggestionIndex);
                    return;
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    this.showSuggestions = false;
                    return;
                }
            } else {
                // 处理历史记录导航
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                    this.handleHistoryNavigation(event);
                } else if (event.key === 'Tab') {
                    // Tab键触发命令补全
                    event.preventDefault();
                    if (this.commandInput && this.commandInput.startsWith('!!')) {
                        this.fetchCommandSuggestions(this.commandInput);
                    }
                } else if (event.key === ' ' && this.commandInput && this.commandInput.startsWith('!!')) {
                    // 输入空格时自动触发子命令补全
                    this.$nextTick(() => {
                        this.fetchCommandSuggestions(this.commandInput);
                    });
                }
            }
        },
        
        // 滚动到当前选中的建议
        scrollToSelectedSuggestion() {
            if (this.selectedSuggestionIndex >= 0) {
                // 获取补全列表容器
                const suggestionsList = document.querySelector('.command-suggestions');
                if (!suggestionsList) return;
                
                // 获取当前选中的项
                const selectedItem = suggestionsList.querySelectorAll('li')[this.selectedSuggestionIndex];
                if (!selectedItem) return;
                
                // 计算元素的可见性
                const listRect = suggestionsList.getBoundingClientRect();
                const itemRect = selectedItem.getBoundingClientRect();
                
                // 检查选中项是否在视口外
                if (itemRect.bottom > listRect.bottom || itemRect.top < listRect.top) {
                    // 如果选中项在视口下方，滚动到能看到选中项的底部
                    if (itemRect.bottom > listRect.bottom) {
                        suggestionsList.scrollTop += (itemRect.bottom - listRect.bottom);
                    }
                    // 如果选中项在视口上方，滚动到能看到选中项的顶部
                    else if (itemRect.top < listRect.top) {
                        suggestionsList.scrollTop -= (listRect.top - itemRect.top);
                    }
                }
            }
        },
        
        // 切换自动刷新
        toggleAutoRefresh() {
            this.autoRefresh = !this.autoRefresh;
            
            if (this.autoRefresh) {
                // 启动定时刷新
                this.refreshInterval = setInterval(() => this.fetchNewLogs(), 3000);
            } else {
                // 停止定时刷新
                clearInterval(this.refreshInterval);
            }
        },
        
        // 清空终端
        clearTerminal() {
            this.logs = [];
        },
        
        // 高亮日志
        highlightLog(log) {
            // 如果log是undefined，返回空字符串
            if (!log || !log.content) return '';
            
            // 根据日志内容添加高亮类
            const content = log.content;
            
            if (content.includes('INFO') || content.includes('[I]')) return 'log-info';
            if (content.includes('WARN') || content.includes('[W]')) return 'log-warning';
            if (content.includes('ERROR') || content.includes('[E]')) return 'log-error';
            if (content.includes('SUCCESS')) return 'log-success';
            if (content.includes('Command')) return 'log-command';
            return '';
        },
        
        // 过滤日志
        filteredLogs() {
            if (!this.filterText) return this.logs;
            return this.logs.filter(log => 
                log.content.toLowerCase().includes(this.filterText.toLowerCase())
            );
        },
        
        // 复制日志到剪贴板
        copyLogs() {
            if (!this.logs || this.logs.length === 0) {
                this.showNotificationMsg('没有日志可复制', 'error');
                return;
            }
            
            const logText = this.logs.map(log => `${log.line_number}: ${log.content}`).join('\n');
            navigator.clipboard.writeText(logText)
                .then(() => this.showNotificationMsg('日志已复制到剪贴板', 'success'))
                .catch(err => {
                    console.error('复制失败:', err);
                    this.showNotificationMsg('复制失败', 'error');
                });
        },
        
        showNotificationMsg(message, type = 'success') {
            this.notificationMessage = message;
            this.notificationType = type;
            this.showNotification = true;
            
            setTimeout(() => {
                this.showNotification = false;
            }, 3000);
        },
        
        // 发送命令到MCDR终端
        async sendCommand() {
            if (!this.commandInput.trim()) {
                return;
            }
            
            const command = this.commandInput.trim();
            
            // 检查是否为禁止的命令（会导致UI自身插件卸载或重载）
            const forbiddenCommands = [
                '!!MCDR plugin reload guguwebui',
                '!!MCDR plugin unload guguwebui',
                'stop'
            ];
            
            if (forbiddenCommands.includes(command)) {
                this.showNotificationMsg(`不允许执行该命令，这可能导致运行崩溃或卡死！`, 'error');
                return;
            }
            
            try {
                const response = await fetch('api/send_command', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ command: command })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    // 添加到历史记录
                    if (this.commandHistory.length === 0 || this.commandHistory[0] !== command) {
                        this.commandHistory.unshift(command);
                        // 限制历史记录长度
                        if (this.commandHistory.length > 50) {
                            this.commandHistory.pop();
                        }
                        // 保存到本地存储
                        localStorage.setItem('commandHistory', JSON.stringify(this.commandHistory));
                    }
                    
                    // 重置历史索引
                    this.historyIndex = -1;
                    // 命令发送成功后清空输入框
                    this.commandInput = '';
                    // 可以选择显示提示信息
                    this.showNotificationMsg(`命令已发送：${data.feedback}`, 'success');
                } else {
                    this.showNotificationMsg(`发送失败: ${data.message || '未知错误'}`, 'error');
                }
            } catch (error) {
                console.error('Error sending command:', error);
                this.showNotificationMsg('发送命令失败', 'error');
            }
        },
        
        // 处理键盘上下键浏览历史记录
        handleHistoryNavigation(event) {
            // 上方向键
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (this.historyIndex === -1) {
                    // 首次按上键，保存当前输入
                    this.tempCommand = this.commandInput;
                }
                
                if (this.historyIndex < this.commandHistory.length - 1) {
                    this.historyIndex++;
                    this.commandInput = this.commandHistory[this.historyIndex];
                }
            } 
            // 下方向键
            else if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    this.commandInput = this.commandHistory[this.historyIndex];
                } else if (this.historyIndex === 0) {
                    // 返回到临时保存的命令
                    this.historyIndex = -1;
                    this.commandInput = this.tempCommand;
                }
            }
        },
        
        // 打开AI询问弹窗
        async openAIQueryModal(selectedText = '') {
            // 先检查API Key是否已设置
            const keyIsSet = await this.checkApiKeyStatus();
            if (!keyIsSet) {
                // 如果API Key未设置，显示设置弹窗
                this.showApiKeySettingModal();
                return;
            }
            
            this.aiQuery = '';
            this.aiResponse = '';
            this.aiLoading = false;
            this.aiSelectedText = selectedText;
            
            // 如果有选中的文本，则使用选中的文本作为询问内容
            if (selectedText) {
                this.aiLogPreview = selectedText;
                this.aiQueryTitle = '询问选中内容';
            } else {
                // 否则，获取最近的200行日志
                const recentLogs = this.logs.slice(Math.max(0, this.logs.length - 200));
                this.aiLogPreview = recentLogs.map(log => {
                    let prefix = '';
                    return `${prefix}${log.content}`;
                }).join('\n');
                this.aiQueryTitle = 'AI日志分析询问';
            }
            
            // 显示弹窗
            const modal = document.getElementById('aiQueryModal');
            if (modal) {
                modal.classList.add('active');
                this.showAiQueryModal = true;
            }
        },
        
        // 检查API Key状态
        async checkApiKeyStatus() {
            try {
                const response = await fetch('api/get_web_config');
                const config = await response.json();
                return !!(config.ai_api_key && config.ai_api_key.trim() !== '');
            } catch (error) {
                console.error('检查API Key状态失败:', error);
                return false;
            }
        },
        
        // 显示API Key设置弹窗
        showApiKeySettingModal() {
            this.apiKey = '';
            this.apiKeyValidated = false;
            this.showApiKeyModal = true;
            
            // 显示弹窗
            const modal = document.getElementById('apiKeyModal');
            if (modal) {
                modal.classList.add('active');
            }
        },
        
        // 关闭API Key设置弹窗
        closeApiKeyModal() {
            const modal = document.getElementById('apiKeyModal');
            if (modal) {
                modal.classList.remove('active');
                setTimeout(() => {
                    this.showApiKeyModal = false;
                }, 300);
            }
        },
        
        // 保存API Key
        async saveApiKey() {
            if (!this.apiKey.trim()) {
                this.showNotificationMsg('请输入API密钥', 'error');
                return;
            }
            
            this.aiLoading = true;
            
            try {
                // 保存API Key
                const response = await fetch('api/save_web_config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'config',
                        ai_api_key: this.apiKey.trim()
                    })
                });
                
                const result = await response.json();
                
                if (result.status === 'success') {
                    this.showNotificationMsg('API密钥已保存', 'success');
                    this.closeApiKeyModal();
                    // 如果有选中的文本，则重新打开AI询问弹窗
                    if (this.aiSelectedText) {
                        this.openAIQueryModal(this.aiSelectedText);
                    } else {
                        this.openAIQueryModal();
                    }
                } else {
                    this.showNotificationMsg(`保存失败: ${result.message || '未知错误'}`, 'error');
                }
            } catch (error) {
                console.error('保存API密钥失败:', error);
                this.showNotificationMsg('保存API密钥失败', 'error');
            } finally {
                this.aiLoading = false;
            }
        },
        
        // 关闭AI询问弹窗
        closeAIQueryModal() {
            const modal = document.getElementById('aiQueryModal');
            if (modal) {
                modal.classList.remove('active');
                setTimeout(() => {
                    this.showAiQueryModal = false;
                }, 300);
            }
        },
        
        // 提交AI询问
        submitAIQuery() {
            if (this.aiLoading) return;
            
            this.aiLoading = true;
            this.aiResponse = '';
            
            // 如果用户没有输入问题，使用默认问题
            const query = this.aiQuery.trim() || '分析这些日志中的错误并提供解决方案';
            
            // 准备发送到API的数据
            let requestData = {
                query: query,
                system_prompt: '你是一个Minecraft服务器日志分析专家，请分析以下日志并提供详细的解释和解决方案。请只关注与问题相关的内容，不要重复日志内容。'
            };
            
            // 如果启用了连续对话，添加聊天历史
            if (this.aiContinueChat && this.aiChatHistory.length > 0) {
                requestData.chat_history = this.aiChatHistory;
            }
            
            // 添加日志内容
            if (this.aiSelectedText) {
                requestData.query += `\n\n选中的日志内容：\n${this.aiSelectedText}`;
            } else {
                requestData.query += `\n\n最近的日志内容：\n${this.aiLogPreview}`;
            }
            
            // 发送请求到API
            fetch('api/deepseek', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            })
            .then(response => response.json())
            .then(data => {
                this.aiLoading = false;
                
                if (data.status === 'success') {
                    this.aiResponse = data.answer;
                    
                    // 如果启用了连续对话，更新聊天历史
                    if (this.aiContinueChat) {
                        this.aiChatHistory.push({
                            role: 'user',
                            content: query
                        });
                        this.aiChatHistory.push({
                            role: 'assistant',
                            content: data.answer
                        });
                        
                        // 限制历史长度，避免token过多
                        if (this.aiChatHistory.length > 10) {
                            this.aiChatHistory = this.aiChatHistory.slice(this.aiChatHistory.length - 10);
                        }
                    }
                } else {
                    this.aiResponse = `错误: ${data.message || '请求失败'}`;
                }
            })
            .catch(error => {
                console.error('AI询问出错:', error);
                this.aiLoading = false;
                this.aiResponse = `请求出错: ${error.message}`;
            });
        },
        
        // 初始化选择文本悬浮按钮
        initSelectionButton() {
            const terminal = document.getElementById('terminal');
            const selectionButton = document.getElementById('selectionActionButton');
            const self = this;
            
            if (!terminal || !selectionButton) return;
            
            document.addEventListener('mouseup', function(e) {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                
                // 如果有选中文本并且在终端内部
                if (selectedText && terminal.contains(selection.anchorNode)) {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    
                    // 计算按钮位置
                    const terminalRect = terminal.getBoundingClientRect();
                    selectionButton.style.top = (rect.bottom - terminalRect.top + 8) + 'px';
                    selectionButton.style.left = (rect.left - terminalRect.left + rect.width / 2 - 40) + 'px';
                    selectionButton.style.display = 'block';
                    
                    // 设置点击事件
                    selectionButton.onclick = function() {
                        self.openAIQueryModal(selectedText);
                        selectionButton.style.display = 'none';
                    };
                } else {
                    selectionButton.style.display = 'none';
                }
            });
            
            // 点击其他地方时隐藏按钮
            document.addEventListener('mousedown', function(e) {
                if (!selectionButton.contains(e.target)) {
                    selectionButton.style.display = 'none';
                }
            });
        },
        
        init() {
            this.checkLoginStatus();
            this.checkServerStatus();
            this.loadLogs();
            this.initSelectionButton();
            
            // 启动自动刷新
            if (this.autoRefresh) {
                this.refreshInterval = setInterval(() => this.fetchNewLogs(), 3000);
            }
            
            // 每60秒自动刷新服务器状态
            setInterval(() => this.checkServerStatus(), 10001);

            // 处理页面关闭前清理
            window.addEventListener('beforeunload', () => {
                if (this.refreshInterval) {
                    clearInterval(this.refreshInterval);
                }
            });
        }
    }));
});