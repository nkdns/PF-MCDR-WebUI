function appData() {
    return {
        // 演示模式标志
        isDemoMode: true,
        serverStatus: 'online',
        userName: '演示用户',
        serverVersion: '1.20.1',
        serverPlayers: '5/20',
        
        // 初始化
        init() {
            this.checkLoginStatus();
            this.checkServerStatus();
            this.getVersions();
            
            // 每60秒自动刷新服务器状态
            setInterval(() => this.checkServerStatus(), 10001);
            
            // 设置当前年份
            document.getElementById('year').textContent = new Date().getFullYear();
        },
        
        // 检查登录状态
        async checkLoginStatus() {
            if (this.isDemoMode) {
                this.userName = '演示用户';
                return;
            }
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
            if (this.isDemoMode) {
                this.serverStatus = 'online';
                this.serverVersion = '1.20.1';
                this.serverPlayers = '5/20';
                return;
            }
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
            if (this.isDemoMode) {
                try {
                    // 演示模式：从本地数据文件获取版本信息
                    const response = await fetch('../data/guguwebui/about.json');
                    const data = await response.json();
                    
                    const gugubotVersion = document.getElementById('gugubot-version');
                    const cqQqApiVersion = document.getElementById('cq-qq-api-version');
                    const webVersion = document.getElementById('web-version');
                    
                    if (data.gugubot_plugins) {
                        const gugubot = data.gugubot_plugins.find(p => p.id === 'gugubot');
                        const cq_qq_api = data.gugubot_plugins.find(p => p.id === 'cq_qq_api');
                        const guguwebui = data.gugubot_plugins.find(p => p.id === 'guguwebui');
                        
                        // 设置GUGUbot版本，如果未安装则显示"未安装"
                        if (gugubot) {
                            gugubotVersion.textContent = `版本：${gugubot.version || '未知'}`;
                        } else {
                            gugubotVersion.textContent = `版本：未安装`;
                        }
                        
                        // 设置cq_qq_api版本，如果未安装则显示"未安装"
                        if (cq_qq_api) {
                            cqQqApiVersion.textContent = `版本：${cq_qq_api.version || '未知'}`;
                        } else {
                            cqQqApiVersion.textContent = `版本：未安装`;
                        }
                        
                        if (guguwebui) {
                            webVersion.textContent = `版本：${guguwebui.version || '未知'}`;
                        }
                    } else {
                        // 如果无法获取插件列表，将插件状态设置为"未安装"
                        gugubotVersion.textContent = `版本：未安装`;
                        cqQqApiVersion.textContent = `版本：未安装`;
                        webVersion.textContent = `版本：未知`;
                    }
                    
                    console.log('演示模式：成功加载版本信息');
                } catch (error) {
                    console.error('演示模式：加载版本信息失败', error);
                    // 出错时也显示"未安装"
                    const gugubotVersion = document.getElementById('gugubot-version');
                    const cqQqApiVersion = document.getElementById('cq-qq-api-version');
                    if (gugubotVersion) gugubotVersion.textContent = `版本：未安装`;
                    if (cqQqApiVersion) cqQqApiVersion.textContent = `版本：未安装`;
                }
                return;
            }
            
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
                    
                    // 设置GUGUbot版本，如果未安装则显示"未安装"
                    if (gugubot) {
                        gugubotVersion.textContent = `版本：${gugubot.version || '未知'}`;
                    } else {
                        gugubotVersion.textContent = `版本：未安装`;
                    }
                    
                    // 设置cq_qq_api版本，如果未安装则显示"未安装"
                    if (cq_qq_api) {
                        cqQqApiVersion.textContent = `版本：${cq_qq_api.version || '未知'}`;
                    } else {
                        cqQqApiVersion.textContent = `版本：未安装`;
                    }
                    
                    if (guguwebui) {
                        webVersion.textContent = `版本：${guguwebui.version || '未知'}`;
                    }
                } else {
                    // 如果无法获取插件列表，将插件状态设置为"未安装"
                    gugubotVersion.textContent = `版本：未安装`;
                    cqQqApiVersion.textContent = `版本：未安装`;
                    webVersion.textContent = `版本：未知`;
                }
            } catch (error) {
                console.error('Error fetching plugin versions:', error);
                // 出错时也显示"未安装"
                const gugubotVersion = document.getElementById('gugubot-version');
                const cqQqApiVersion = document.getElementById('cq-qq-api-version');
                if (gugubotVersion) gugubotVersion.textContent = `版本：未安装`;
                if (cqQqApiVersion) cqQqApiVersion.textContent = `版本：未安装`;
            }
        }
    };
}