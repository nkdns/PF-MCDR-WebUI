document.addEventListener("DOMContentLoaded", function() {
    // 获取插件状态
    load_gugu_plugins();

    // 获取其他插件
    load_other_plugins();
});

function load_gugu_plugins() {
    fetch('/api/gugubot_plugins')
        .then(response => response.json())
        .then(data => {
            const statusList = document.getElementById("gugubot-status-list");
            statusList.innerHTML = '';

            const div = document.createElement("div");
            div.classList.add("plugin");
            div.classList.add('run');
            div.id = "guguwebui";
            div.innerHTML = `<span>GUGUWebUI</span><span>运行中</span>`;
            statusList.appendChild(div);

            // 按照 id 排序
            const sortedGugubotPlugins = data.gugubot_plugins.sort((a, b) => {
                return a.id - b.id;
            });

            // 状态中文映射
            const statusTranslation = {
                'loaded': '已加载',
                'disabled': '已禁用',
                'unloaded': '未加载'
            };

            // 按状态排序
            const statusOrder = {
                'loaded': 1,
                'disabled': 2,
                'unloaded': 3
            };

            const sortedPlugins = sortedGugubotPlugins.sort((a, b) => {
                return (statusOrder[a.status] || 999) - (statusOrder[b.status] || 999);
            });

            sortedPlugins.forEach(plugin => {
                const div = document.createElement("div");
                div.classList.add("plugin");
                div.classList.add(plugin.status === 'loaded' ? 'run' : 'stop');
                div.id = plugin.id;
                div.onclick = () => toggleStatus(plugin.id);
                div.innerHTML = `<span>${plugin.name}</span><span>${statusTranslation[plugin.status] || plugin.status}</span>`;
                statusList.appendChild(div);
            });
        })
        .catch(error => console.error('Error fetching gugubot plugins:', error));
}

function load_other_plugins() {
    fetch('/api/plugins')
        .then(response => response.json())
        .then(data => {
            const pluginsDiv = document.getElementById("plugins");
            pluginsDiv.innerHTML = '';
            // 按照 id 排序
            const sortedPlugins = data.plugins.sort((a, b) => {
                return a.id - b.id;
            });

            // 状态中文映射
            const statusTranslation = {
                'loaded': '已加载',
                'disabled': '已禁用',
                'unloaded': '未加载'
            };

            // 按状态排序
            const statusOrder = {
                'loaded': 1,
                'disabled': 2,
                'unloaded': 3
            };

            const finalPluginsList = sortedPlugins.sort((a, b) => {
                return (statusOrder[a.status] || 999) - (statusOrder[b.status] || 999);
            });

            finalPluginsList.forEach(plugin => {
                const div = document.createElement("div");
                div.classList.add("plugin");
                div.classList.add(plugin.status === 'loaded' ? 'run' : 'stop');
                div.id = plugin.id;
                div.onclick = () => toggleStatus(plugin.id);
                div.innerHTML = `<span>${plugin.name}</span><span>${statusTranslation[plugin.status] || plugin.status}</span>`;
                pluginsDiv.appendChild(div);
            });
        })
        .catch(error => console.error('Error fetching plugins:', error));
}

function toggleStatus(pluginId) {
    const plugin = document.getElementById(pluginId);
    const isRunning = plugin.classList.contains('run');
    
    // 切换状态类
    plugin.classList.toggle('run', !isRunning);
    plugin.classList.toggle('stop', isRunning);
    
    // 准备请求体
    const requestBody = JSON.stringify({
        plugin_id: pluginId,
        status: !isRunning
    });
    
    fetch('/api/toggle_plugin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: requestBody
    })
    .then(response => response.json())
    .then(data => {
        // 更新状态
        load_gugu_plugins();

        load_other_plugins();
    });
}

function sortPlugins(pluginLists) {
    const pluginList = document.getElementById(pluginLists);
    const plugins = Array.from(pluginList.children);

    // 找到特定 ID 的插件
    const fixedPlugin = plugins.find(plugin => plugin.id === 'guguwebui');
    const otherPlugins = plugins.filter(plugin => plugin.id !== 'guguwebui');

    // 按状态和 ID 对其他插件排序
    otherPlugins.sort((a, b) => {
        const aStatus = a.classList.contains('run') ? 0 : 1; // 运行中排在前面
        const bStatus = b.classList.contains('run') ? 0 : 1;

        // 如果状态相同，按 ID 排序
        if (aStatus === bStatus) {
            return a.id.localeCompare(b.id);
        }
        return aStatus - bStatus;
    });

    // 清空插件列表并重新插入
    pluginList.innerHTML = '';
    if (fixedPlugin) {
        pluginList.appendChild(fixedPlugin); // 先插入固定插件
    }
    otherPlugins.forEach(plugin => pluginList.appendChild(plugin)); // 插入其他插件
}

// 请求api.php?action=loadwebconfig，获得json
document.addEventListener("DOMContentLoaded", function() {
    fetch('/api/get_web_config')
        .then(response => response.json())
        .then(data => {
            // 端口填入id="port"输入框
            document.getElementById('port').value = data.port;
            // 禁用管理后台登录填入id="disable_admin_login_after_run"输入框
            document.getElementById('disable_admin_login_after_run').value = data.super_admin_account;

            // 点击禁用管理后台登录 基于值（true/false） 修改id="disable_admin_login_web"的内容和class（true添加enable）
            const disableAdminLoginBtn = document.getElementById('disable_admin_login_web');
            if (data.disable_admin_login_web) {
                disableAdminLoginBtn.classList.add('enable');
                disableAdminLoginBtn.textContent = '点击禁用';
            } else {
                disableAdminLoginBtn.classList.remove('enable');
                disableAdminLoginBtn.textContent = '点击启用';
            }

            // enable_temp_login_password
            const enableTempLoginPasswordBtn = document.getElementById('enable_temp_login_password');
            if (data.enable_temp_login_password) {
                enableTempLoginPasswordBtn.classList.add('enable');
                enableTempLoginPasswordBtn.textContent = '点击禁用';
            } else {
                enableTempLoginPasswordBtn.classList.remove('enable');
                enableTempLoginPasswordBtn.textContent = '点击启用';
            }
        })
        .catch(error => console.error('Error fetching config:', error));
});

function saveWebConfig(action) {
    // 创建请求体
    const requestData = {
        action: action,
    };

    // 根据不同的按钮，决定是否传递其他参数
    if (action === 'config') {
        const port = document.getElementById('port').value;
        const superaccount = document.getElementById('disable_admin_login_after_run').value;

        requestData.port = port;
        requestData.superaccount = superaccount;
    }

    fetch("/api/save_web_config", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            const btn = document.getElementById(action);
            if (action === 'config') {
                showAutoCloseAlert("保存成功", "#00BC12");
            }
            if (action !== 'config') { 
                if (data.message) {
                    btn.classList.add('enable');
                    btn.textContent = '点击禁用';
                }else {
                    btn.classList.remove('enable');
                    btn.textContent = '点击启用';
                }
            }
        } else {
            console.error('操作失败: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function showAutoCloseAlert(message, backgroundColor) {
    // 创建一个 div 元素用于显示消息
    const alertBox = document.createElement('div');
    alertBox.textContent = message;
    alertBox.style.position = 'fixed';
    alertBox.style.top = '60px';
    alertBox.style.right = '20px';
    alertBox.style.backgroundColor = backgroundColor;
    alertBox.style.color = 'white';
    alertBox.style.padding = '15px';
    alertBox.style.borderRadius = '5px';
    alertBox.style.zIndex = '1000';
    alertBox.style.animation = "fadeOut 5s ease-out forwards";
    
    document.body.appendChild(alertBox);

    // 自动关闭提示框
    setTimeout(() => {
        alertBox.remove();
    }, 5000); // 5秒后自动关闭
}

// 编辑器
const editor = ace.edit("editor");
const overlay = document.getElementById("overlay");
const editorPopup = document.getElementById("editor-popup");
let currentLang = 'css';
const localStorageKey = (lang) => `editor_content_${lang}`;

// 读取本地存储中的主题
const savedTheme = localStorage.getItem('editor_theme');
if (savedTheme) {
    editor.setTheme("ace/theme/" + savedTheme);
} else {
    editor.setTheme("ace/theme/monokai"); // 默认主题
}

editor.setOptions({
    enableBasicAutocompletion: true,
    enableLiveAutocompletion: true,
    fontSize: "14px",
    useSoftTabs: true,
});

// 主题选择事件
document.getElementById("theme-select").addEventListener("change", function() {
    const selectedTheme = this.value;
    editor.setTheme("ace/theme/" + selectedTheme);
    localStorage.setItem('editor_theme', selectedTheme); // 缓存主题到本地
});

// 打开弹窗
const openPopup = (lang) => {
    editor.session.setMode("ace/mode/" + lang);
    currentLang = lang;
    loadLocalContent();
    overlay.style.display = "block";
    editorPopup.style.display = "block";
};

// 关闭弹窗
const closePopup = () => {
    overlay.style.display = "none";
    editorPopup.style.display = "none";
};

// 从服务器加载代码
const loadFromServer = async (lang) => {
    const action = lang === "css" ? "css" : "js";
    try {
        const response = await fetch(`/api/load_file?file=${action}`);  //load_css or load_js
        const serverContent = await response.text();
        const localContent = localStorage.getItem(localStorageKey(lang));
        
        if (localContent && localContent !== serverContent) {
            if (confirm("本地内容与服务器内容不同，是否使用本地内容？")) {
                editor.setValue(localContent, -1);
            } else {
                editor.setValue(serverContent, -1);
            }
        } else {
            editor.setValue(serverContent, -1);
        }

        openPopup(lang);
    } catch (error) {
        alert("加载失败：" + error);
    }
};

// 保存编辑内容到服务器
const saveToServer = async () => {
    const content = editor.getValue();
    const action = currentLang === "css" ? "css" : "js";
    try {
        await fetch(`/api/save_file`, { //save_css or save_js
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, content })
        });
        localStorage.removeItem(localStorageKey(currentLang));
        showAutoCloseAlert("保存成功", "#00BC12");
    } catch (error) {
        alert("保存失败：" + error);
    }
};

// 加载本地内容
const loadLocalContent = () => {
    const savedContent = localStorage.getItem(localStorageKey(currentLang));
    if (savedContent) {
        editor.setValue(savedContent, -1);
    }
};


// 事件监听
document.getElementById("load-css").addEventListener("click", () => loadFromServer("css"));
document.getElementById("load-js").addEventListener("click", () => loadFromServer("javascript"));
document.getElementById("save-file").addEventListener("click", saveToServer);
document.getElementById("cancel").addEventListener("click", () => {
    localStorage.removeItem(localStorageKey(currentLang));
    closePopup();
});

// 输入时实时保存到本地存储
editor.on("input", () => {
    localStorage.setItem(localStorageKey(currentLang), editor.getValue());
});

// 监听 Ctrl + S 快捷键
document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key === "s") {
        event.preventDefault(); // 阻止默认保存操作
        saveToServer(); // 调用保存函数
    }
});

// 为每个文本输入框添加动态宽度调整
function adjustWidth(input) {
    const tempSpan = document.createElement("span");
    tempSpan.style.visibility = "hidden";
    tempSpan.style.position = "absolute";
    tempSpan.style.whiteSpace = "pre"; // 保持空格宽度
    tempSpan.textContent = input.value || " "; // 确保有最小宽度
    document.body.appendChild(tempSpan);

    // 根据 span 的宽度调整输入框宽度
    input.style.width = `${tempSpan.offsetWidth + 20}px`;

    // 清理临时的 span 元素
    document.body.removeChild(tempSpan);
}

// 获取所有的文本输入框并添加事件监听器
document.querySelectorAll('input[type="text"]').forEach(input => {
    input.addEventListener('input', function () {
        adjustWidth(input);
    });
});