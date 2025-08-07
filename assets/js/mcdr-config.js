/**
 * MCDR配置页面的JavaScript功能
 * 处理配置加载、保存、表单数据绑定等功能
 */

document.addEventListener('DOMContentLoaded', function() {
    // 设置当前时间和版权年份
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
});

// Alpine.js 组件
window.mcdrConfigApp = function() {
    return {
        serverStatus: 'loading',
        userName: '',
        serverVersion: '',
        serverPlayers: '0/0',
        configData: {},
        activeConfigFile: 'config.yml',

        // 初始化
        init() {
            this.checkLoginStatus();
            this.checkServerStatus();
            this.loadConfig('config.yml');
            
            // 每60秒自动刷新服务器状态
            setInterval(() => this.checkServerStatus(), 10001);
            
            // 保存主题设置到本地存储
            this.$watch('darkMode', value => {
                localStorage.setItem('darkMode', value);
            });
        },

        // 检查登录状态
        async checkLoginStatus() {
            try {
                // 检查localStorage中的登录状态
                const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
                if (isLoggedIn) {
                    this.userName = localStorage.getItem('username') || '演示用户';
                } else {
                    // 如果未登录，重定向到登录页面
                    window.location.href = '../login.html';
                }
            } catch (error) {
                console.error('Error checking login status:', error);
            }
        },

        // 检查服务器状态
        async checkServerStatus() {
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

        // 加载配置文件
        async loadConfig(file) {
            try {
                console.log(`正在加载配置文件: ${file}`);
                
                // 根据文件名选择对应的JSON文件
                let jsonFile;
                if (file === 'config.yml') {
                    jsonFile = '../data/mcdr_config.yml.json';
                } else if (file === 'permission.yml') {
                    jsonFile = '../data/mcdr_permission.yml.json';
                } else {
                    throw new Error(`不支持的配置文件: ${file}`);
                }
                
                const response = await fetch(jsonFile);
                const data = await response.json();
                
                console.log('加载的配置数据:', data);
                
                // 特别检查权限数据
                if (file === 'permission.yml') {
                    console.log('权限数据:');
                    console.log('- owner:', data.owner);
                    console.log('- admin:', data.admin);
                    console.log('- helper:', data.helper);
                    console.log('- user:', data.user);
                    console.log('- guest:', data.guest);
                }
                
                this.configData = data;
                this.activeConfigFile = file;
                
                // 确保表单可见
                const configForm = document.getElementById('config-yml-form');
                const permissionForm = document.getElementById('permission-yml-form');
                
                if (file === 'config.yml') {
                    configForm.style.display = 'block';
                    permissionForm.style.display = 'none';
                } else {
                    configForm.style.display = 'none';
                    permissionForm.style.display = 'block';
                }
                
                // 绑定表单值
                this.bindConfigValues();
            } catch (error) {
                console.error('Error loading config:', error);
                this.showNotification('加载配置文件失败: ' + error.message, 'error');
            }
        },

        // 保存配置文件
        async saveConfig(file) {
            try {
                const data = this.gatherConfigValues();
                console.log('保存的配置数据:', data);
                
                // 演示模式，模拟保存成功
                this.showNotification('配置保存成功（演示模式）', 'success');
                
                // 更新本地配置数据
                this.configData = { ...this.configData, ...data };
                
            } catch (error) {
                console.error('Error saving config:', error);
                this.showNotification('保存出错: ' + error.message, 'error');
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
            notification.className = `p-3 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full`;
            
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
                notification.classList.remove('translate-x-full');
                notification.classList.add('translate-x-0');
            }, 10);
            
            // 自动移除
            setTimeout(() => {
                notification.classList.remove('translate-x-0');
                notification.classList.add('translate-x-full');
                setTimeout(() => {
                    notificationContainer.removeChild(notification);
                }, 300);
            }, 3000);
        },

        // 绑定配置值到表单
        bindConfigValues() {
            // 根据当前激活的配置文件选择对应的表单ID
            const formId = this.activeConfigFile === 'config.yml' ? 'config-yml-form' : 'permission-yml-form';
            const activeTab = document.getElementById(formId);
            
            if (!activeTab) {
                console.error('无法找到活动表单:', formId);
                return;
            }
            
            // Alpine.js标签列表可以通过$watch监听配置数据变化自动更新，不需要在这里处理
            
            // 将配置数据绑定到普通表单元素
            const inputs = activeTab.querySelectorAll('.config-input:not([id="owner"]):not([id="admin"]):not([id="helper"]):not([id="user"]):not([id="guest"]), .config-select');
            inputs.forEach(input => {
                const key = input.getAttribute('data-key');
                const value = this.getNestedValue(this.configData, key);
                
                if (input.type === 'checkbox') {
                    input.checked = value === true;
                } else if (input.classList.contains('multiple-input')) {
                    // 处理传统的数组类型
                    if (Array.isArray(value)) {
                        input.value = value.join(', ');
                    } else {
                        input.value = '';
                    }
                } else if (input.tagName.toLowerCase() === 'select') {
                    // 处理下拉选择框
                    if (value !== undefined) {
                        // 尝试找到匹配的option
                        const option = Array.from(input.options).find(opt => opt.value === value);
                        if (option) {
                            input.value = value;
                        } else {
                            // 如果没有匹配的选项，添加一个新选项
                            const newOption = document.createElement('option');
                            newOption.value = value;
                            newOption.text = value;
                            input.add(newOption);
                            input.value = value;
                        }
                    }
                } else {
                    input.value = value !== undefined ? value : '';
                }
            });
            
            // 手动触发一次Alpine.js的更新
            if (window.Alpine) {
                setTimeout(() => {
                    window.Alpine.nextTick(() => {
                        console.log('Alpine update triggered');
                    });
                }, 50);
            }
        },

        // 从表单收集配置值
        gatherConfigValues() {
            // 收集表单数据到配置对象
            const result = {};
            // 根据当前激活的配置文件选择对应的表单ID
            const formId = this.activeConfigFile === 'config.yml' ? 'config-yml-form' : 'permission-yml-form';
            const activeTab = document.getElementById(formId);
            
            if (!activeTab) {
                console.error('无法找到活动表单:', formId);
                return {};
            }
            
            const inputs = activeTab.querySelectorAll('.config-input, .config-select');
            
            inputs.forEach(input => {
                const key = input.getAttribute('data-key');
                let value;
                
                if (input.type === 'checkbox') {
                    value = input.checked;
                } else if (input.classList.contains('multiple-input')) {
                    // 处理标签式输入的隐藏字段
                    if (input.type === 'hidden' && input.id && ['owner', 'admin', 'helper', 'user', 'guest'].includes(input.id)) {
                        try {
                            // 从JSON字符串解析标签数组
                            value = JSON.parse(input.value);
                        } catch (e) {
                            console.error('解析标签JSON失败:', e);
                            value = [];
                        }
                    } else {
                        // 处理传统的多值输入
                        value = input.value.split(',').map(item => item.trim()).filter(item => item);
                    }
                } else {
                    value = input.value;
                    // 尝试转换为数字
                    if (!isNaN(value) && value !== '') {
                        value = Number(value);
                    }
                }
                
                this.setNestedValue(result, key, value);
            });
            
            return result;
        },

        // 解析嵌套路径读取数据
        getNestedValue(obj, path) {
            if (!obj || !path) return undefined;
            const keys = path.split('.');
            return keys.reduce((o, k) => (o || {})[k], obj);
        },

        // 设置嵌套路径数据
        setNestedValue(obj, path, value) {
            if (!obj || !path) return;
            const keys = path.split('.');
            const lastKey = keys.pop();
            const lastObj = keys.reduce((o, k) => {
                if (o[k] === undefined) o[k] = {};
                return o[k];
            }, obj);
            lastObj[lastKey] = value;
        }
    };
}; 