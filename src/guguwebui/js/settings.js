function settingsApp() {
    return {
        serverStatus: 'loading',
        userName: '',
        webConfig: {
            host: '',
            port: 8000,
            super_admin_account: '',
            disable_admin_login_web: false,
            enable_temp_login_password: false
        },
        deepseekApiKey: '',
        deepseekModel: 'deepseek-chat',
        isKeyValid: false,
        keyValidated: false,
        repositories: [],
        officialRepoUrl: 'https://api.mcdreforged.com/catalogue/everything_slim.json.xz',
        newRepo: {
            name: '',
            url: ''
        },
        mcdrPluginsUrl: '',
        pimStatus: 'checking',
        
        // 初始化
        init() {
            this.checkLoginStatus();
            this.checkServerStatus();
            this.getConfig();
            this.checkPimStatus();
            
            // 每60秒自动刷新服务器状态
            setInterval(() => this.checkServerStatus(), 10001);
            
            // 设置当前年份
            document.getElementById('year').textContent = new Date().getFullYear();
        },
        
        // 检查登录状态
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
        
        // 检查服务器状态
        async checkServerStatus() {
            try {
                this.serverStatus = 'loading';
                const response = await fetch('/api/get_server_status');
                const data = await response.json();
                this.serverStatus = data.status || 'offline';
            } catch (error) {
                console.error('Error checking server status:', error);
                this.serverStatus = 'error';
            }
        },
        
        // 获取配置
        async getConfig() {
            try {
                const response = await fetch('/api/get_web_config');
                const config = await response.json();
                
                this.webConfig.host = config.host || '0.0.0.0';
                this.webConfig.port = config.port || 8000;
                this.webConfig.super_admin_account = config.super_admin_account || '';
                this.webConfig.disable_admin_login_web = config.disable_admin_login_web || false;
                this.webConfig.enable_temp_login_password = config.enable_temp_login_password || false;
                this.deepseekModel = config.deepseek_model || 'deepseek-chat';
                // 不加载已保存的API密钥，留空等待用户设置新的密钥
                this.deepseekApiKey = '';
                // 如果已配置过密钥，标记为已验证和有效
                if (config.deepseek_api_key && config.deepseek_api_key.trim() !== '') {
                    this.isKeyValid = true;
                    this.keyValidated = true;
                }
                
                // 处理仓库配置
                // 兼容旧版单一URL的配置方式
                if (config.mcdr_plugins_url && !config.repositories) {
                    // 如果存在旧版的单一URL配置，但还没有repositories配置
                    // 并且URL不是官方仓库URL，则添加为自定义仓库
                    if (config.mcdr_plugins_url !== this.officialRepoUrl) {
                        this.repositories = [{
                            name: '自定义仓库',
                            url: config.mcdr_plugins_url
                        }];
                    } else {
                        this.repositories = []; // 如果只有官方仓库，则清空自定义仓库列表
                    }
                } else if (config.repositories && Array.isArray(config.repositories)) {
                    // 使用新的多仓库配置
                    this.repositories = config.repositories;
                } else {
                    this.repositories = []; // 初始化为空数组
                }
                
                this.mcdrPluginsUrl = config.mcdr_plugins_url || '';
                this.pimStatus = config.pim_status || 'checking';
                
                // 更新后台切换开关状态
                this.$nextTick(() => {
                    const toggleSwitches = document.querySelectorAll('.toggle-switch');
                    toggleSwitches.forEach((switchEl) => {
                        switchEl.checked = this[switchEl.id];
                    });
                });
            } catch (error) {
                console.error('Error loading config:', error);
                this.showNotification('加载配置失败', 'error');
            }
        },
        
        // 保存网络配置
        async saveNetworkConfig() {
            try {
                // 验证输入
                if (!this.webConfig.host) {
                    this.showNotification('主机地址不能为空', 'error');
                    return;
                }
                
                if (!this.webConfig.port || this.webConfig.port < 1 || this.webConfig.port > 65535) {
                    this.showNotification('端口必须是1-65535之间的有效数字', 'error');
                    return;
                }
                
                const response = await fetch('/api/save_web_config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'config',
                        host: this.webConfig.host,
                        port: this.webConfig.port
                    })
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    this.showNotification('网络设置保存成功', 'success');
                } else {
                    this.showNotification('保存失败: ' + result.message, 'error');
                }
            } catch (error) {
                console.error('Error saving network config:', error);
                this.showNotification('保存出错: ' + error.message, 'error');
            }
        },
        
        // 保存账户配置
        async saveAccountConfig() {
            try {
                // 验证输入
                if (!this.webConfig.super_admin_account) {
                    this.showNotification('超级管理员账号不能为空', 'error');
                    return;
                }
                
                const response = await fetch('/api/save_web_config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'config',
                        superaccount: this.webConfig.super_admin_account
                    })
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    this.showNotification('账户设置保存成功', 'success');
                } else {
                    this.showNotification('保存失败: ' + result.message, 'error');
                }
            } catch (error) {
                console.error('Error saving account config:', error);
                this.showNotification('保存出错: ' + error.message, 'error');
            }
        },
        
        // 切换布尔设置
        async toggleSetting(setting) {
            try {
                const apiSetting = setting === 'disable_admin_login_web' ? 'disable_admin_login_web' : 'enable_temp_login_password';
                
                const response = await fetch('/api/save_web_config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: apiSetting
                    })
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    // 切换本地状态
                    this.webConfig[setting] = result.message;
                    this.showNotification(`设置已${this.webConfig[setting] ? '启用' : '禁用'}`, 'success');
                } else {
                    this.showNotification('设置切换失败: ' + result.message, 'error');
                }
            } catch (error) {
                console.error('Error toggling setting:', error);
                this.showNotification('设置出错: ' + error.message, 'error');
            }
        },
        
        // 显示通知
        showNotification(message, type = 'info') {
            // 获取或创建通知容器
            let notificationContainer = document.getElementById('notification-container');
            if (!notificationContainer) {
                notificationContainer = document.createElement('div');
                notificationContainer.id = 'notification-container';
                notificationContainer.className = 'fixed top-16 right-4 z-50 flex flex-col gap-2';
                document.body.appendChild(notificationContainer);
            }
            
            // 创建通知元素
            const notification = document.createElement('div');
            notification.className = `p-3 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full opacity-0`;
            
            // 根据类型设置样式
            switch (type) {
                case 'success':
                    notification.className += ' bg-green-500 text-white';
                    notification.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${message}`;
                    break;
                case 'error':
                    notification.className += ' bg-red-500 text-white';
                    notification.innerHTML = `<i class="fas fa-times-circle mr-2"></i>${message}`;
                    break;
                default:
                    notification.className += ' bg-blue-500 text-white';
                    notification.innerHTML = `<i class="fas fa-info-circle mr-2"></i>${message}`;
            }
            
            // 添加到容器
            notificationContainer.appendChild(notification);
            
            // 触发动画
            setTimeout(() => {
                notification.classList.remove('translate-x-full', 'opacity-0');
                notification.classList.add('translate-x-0', 'opacity-100');
            }, 10);
            
            // 自动移除
            setTimeout(() => {
                notification.classList.remove('translate-x-0', 'opacity-100');
                notification.classList.add('translate-x-full', 'opacity-0');
                setTimeout(() => {
                    notificationContainer.removeChild(notification);
                }, 300);
            }, 3000);
        },
        
        // 保存DeepSeek配置
        async saveDeepseekConfig() {
            try {
                // 如果没有验证，提示用户先验证密钥
                if (this.deepseekApiKey && !this.keyValidated) {
                    this.showNotification('请先验证API密钥', 'warning');
                    return;
                }
                
                // 如果密钥不为空且验证不通过，提示用户
                if (this.deepseekApiKey && !this.isKeyValid) {
                    this.showNotification('API密钥无效，请重新输入', 'error');
                    return;
                }
                
                // 如果密钥为空且没有之前验证过的有效密钥，显示警告
                if (!this.deepseekApiKey && !this.isKeyValid) {
                    if (!confirm('您没有设置API密钥，确定要保存吗？')) {
                        return;
                    }
                }
                
                const response = await fetch('/api/save_web_config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'config',
                        deepseek_api_key: this.deepseekApiKey || undefined, // 如果为空，传undefined表示不修改
                        deepseek_model: this.deepseekModel
                    })
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    this.showNotification('DeepSeek配置保存成功', 'success');
                    // 保存成功后重置状态
                    if (this.deepseekApiKey) {
                        this.deepseekApiKey = '';
                        this.keyValidated = false;
                    }
                } else {
                    this.showNotification('保存失败: ' + result.message, 'error');
                }
            } catch (error) {
                console.error('Error saving DeepSeek config:', error);
                this.showNotification('保存出错: ' + error.message, 'error');
            }
        },
        
        // 切换密码可见性
        togglePasswordVisibility(id) {
            const input = document.getElementById(id);
            const toggle = document.getElementById(`${id}_toggle`);
            
            if (input.type === 'password') {
                input.type = 'text';
                toggle.classList.remove('fa-eye');
                toggle.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                toggle.classList.remove('fa-eye-slash');
                toggle.classList.add('fa-eye');
            }
        },
        
        // 添加API密钥验证方法
        async validateApiKey() {
            if (!this.deepseekApiKey) {
                this.showNotification('请输入API密钥', 'error');
                return;
            }
            
            try {
                this.showNotification('正在验证API密钥...', 'info');
                
                // 向DeepSeek API发送简单测试请求
                const response = await fetch('/api/deepseek', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        query: '测试密钥是否有效，请回复"有效"',
                        system_prompt: '你是一个简单的验证程序，只需回复"有效"',
                        model: this.deepseekModel
                    })
                });
                
                const result = await response.json();
                
                if (result.status === 'success') {
                    this.isKeyValid = true;
                    this.keyValidated = true;
                    this.showNotification('API密钥验证成功', 'success');
                } else {
                    this.isKeyValid = false;
                    this.keyValidated = true;
                    this.showNotification(`API密钥验证失败: ${result.message}`, 'error');
                }
            } catch (error) {
                console.error('API密钥验证错误:', error);
                this.isKeyValid = false;
                this.keyValidated = true;
                this.showNotification(`验证出错: ${error.message}`, 'error');
            }
        },
        
        // 添加新仓库
        addRepository() {
            if (!this.newRepo.name || !this.newRepo.url) {
                this.showNotification('仓库名称和URL不能为空', 'error');
                return;
            }
            
            // 检查URL格式
            try {
                new URL(this.newRepo.url);
            } catch (e) {
                this.showNotification('请输入有效的URL', 'error');
                return;
            }
            
            // 检查是否与官方仓库URL重复
            if (this.newRepo.url === this.officialRepoUrl) {
                this.showNotification('不能添加与官方仓库相同的URL', 'error');
                return;
            }
            
            // 检查是否与现有仓库重复
            const isDuplicate = this.repositories.some(repo => 
                repo.url === this.newRepo.url || repo.name === this.newRepo.name
            );
            
            if (isDuplicate) {
                this.showNotification('仓库名称或URL已存在', 'error');
                return;
            }
            
            // 添加到仓库列表
            this.repositories.push({
                name: this.newRepo.name,
                url: this.newRepo.url
            });
            
            // 清空输入框
            this.newRepo.name = '';
            this.newRepo.url = '';
            
            this.showNotification('仓库已添加，请点击保存按钮保存配置', 'success');
        },
        
        // 删除仓库
        deleteRepository(index) {
            if (index >= 0 && index < this.repositories.length) {
                this.repositories.splice(index, 1);
                this.showNotification('仓库已删除，请点击保存按钮保存配置', 'success');
            }
        },
        
        // 保存仓库配置
        async saveRepositories() {
            try {
                const response = await fetch('/api/save_web_config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'config',
                        repositories: this.repositories
                    })
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    this.showNotification('仓库配置保存成功', 'success');
                } else {
                    this.showNotification('保存失败: ' + result.message, 'error');
                }
            } catch (error) {
                console.error('Error saving repositories:', error);
                this.showNotification('保存出错: ' + error.message, 'error');
            }
        },
        
        // 保存MCDR插件目录配置 - 保留此方法兼容旧版
        async saveMcdrPluginsUrl() {
            try {
                const response = await fetch('/api/save_web_config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'config',
                        mcdr_plugins_url: this.mcdrPluginsUrl || this.officialRepoUrl
                    })
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    this.showNotification('MCDR插件目录URL保存成功', 'success');
                } else {
                    this.showNotification('保存失败: ' + result.message, 'error');
                }
            } catch (error) {
                console.error('Error saving MCDR plugins URL:', error);
                this.showNotification('保存出错: ' + error.message, 'error');
            }
        },
        
        // 检查PIM插件状态
        async checkPimStatus() {
            try {
                const response = await fetch('/api/check_pim_status');
                const result = await response.json();
                
                if (result.status === 'success') {
                    this.pimStatus = result.pim_status;
                } else {
                    this.pimStatus = 'not_installed';
                    console.error('Error checking PIM status:', result.message);
                }
            } catch (error) {
                this.pimStatus = 'not_installed';
                console.error('Error checking PIM status:', error);
            }
        },
        
        // 安装PIM插件
        async installPimPlugin() {
            try {
                this.pimStatus = 'installing';
                const response = await fetch('/api/install_pim_plugin');
                const result = await response.json();
                
                if (result.status === 'success') {
                    this.showNotification('PIM插件安装成功', 'success');
                    this.pimStatus = 'installed';
                } else {
                    this.showNotification('安装失败: ' + result.message, 'error');
                    await this.checkPimStatus(); // 重新检查状态
                }
            } catch (error) {
                console.error('Error installing PIM plugin:', error);
                this.showNotification('安装出错: ' + error.message, 'error');
                await this.checkPimStatus(); // 重新检查状态
            }
        }
    };
}