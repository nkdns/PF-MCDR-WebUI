// 加载 gugubot / cq_qq_api 信息栏 GET /api/gugubot_plugins
function set_gugu_plugin(plugin_id) {
    fetch('/api/gugubot_plugins') 
    .then(response => response.json())
    .then(data => {
            // 查找是否存在 id 为 'gugubot' 的插件
        const Plugin = data.gugubot_plugins.find(plugin => plugin.id === plugin_id);
        if (Plugin) {
            if (Plugin.status === 'loaded') {
                const container = document.getElementById('container');
                container.style.display = 'block';
            } else {
                const noRunHint = document.getElementById(`no-run-hint`);
                const container = document.getElementById('container');
                noRunHint.style.display = 'block';
                container.style.display = 'block';
            }
            const gugubot_version = document.getElementById(`${plugin_id}-version`);
            gugubot_version.innerText = `版本: ${Plugin.version}`;
        } else {
            const noPluginHint = document.getElementById(`no-plugin-hint`);
            noPluginHint.style.display = 'block';
        }
    })
    .catch(error => console.log("查询失败(忽略此报错):", error));
};

// plugin.html
function paginate(list_id, pagination) {
    const contentDiv = document.getElementById(list_id);
    const items = Array.from(contentDiv.children);
    const totalPages = Math.ceil(items.length / itemsPerPage);

    items.forEach((item, index) => {
        item.style.display = (index >= (currentPage - 1) * itemsPerPage && index < currentPage * itemsPerPage) ? 'flex' : 'none';
    });

    const paginationDiv = document.getElementById(pagination);
    paginationDiv.innerHTML = `
        ${currentPage > 1 ? '<button class="btn" onclick="changePage(-1)">上一页</button>' : ''}
        第 ${currentPage} 页 / 共 ${totalPages} 页
        ${currentPage < totalPages ? '<button class="btn" onclick="changePage(1)">下一页</button>' : ''}
    `;
}
function changePage(direction) {
    clean_config();
    currentPage += direction;
    paginate('plugin-list','pagination');
}
// author & description 显示函数
function listPluginsTip() {
    document.querySelectorAll('.plugin>div:first-child').forEach(container => {
        const tooltip = container.querySelector('.description');

        container.addEventListener('mousemove', (e) => {
            tooltip.style.left = e.pageX + 10 + 'px'; // 使用页面坐标
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';
        });

        container.addEventListener('mouseleave', () => {
            tooltip.style.visibility = 'hidden';
            tooltip.style.opacity = '0';
        });
    });
}
// 加载插件信息 GET /api/plugins?detail=true 
function loadPlugins() {
    const pluginList = document.getElementById('plugin-list');
    pluginList.innerHTML = ''; // 清空现有的插件列表
    fetch('/api/plugins?detail=true')
    .then(response => response.json())
    .then(data => {
        // 读取json
        const plugins = data.plugins;
        // 遍历插件数组，创建插件列表
        plugins.forEach(plugin => {
            const { id, name, description, author, github, version, version_latest, status, config_file } = plugin;

            // 创建插件的 HTML 结构
            const pluginDiv = document.createElement('div');
            pluginDiv.className = 'plugin';
            pluginDiv.id = `${id}`;

            // 决定是否显示 一键更新按钮
            const updateButtonStyle = id === 'guguwebui' || version === version_latest ? 'visibility: hidden;' : 'visibility: visible;';
            // 决定是否显示 状态切换和重载按钮
            const pluginStatusStyle = id === 'guguwebui' ? 'visibility: hidden;' : 'visibility: visible;';
            // 决定是否显示 GitHub链接
            const githubStyle = github ? 'visibility: visible;' : 'visibility: hidden;';
            // 决定是否显示 插件配置按钮
            const configButtonStyle = config_file === true && id != 'guguwebui' ? 'visibility: visible;' : 'visibility: hidden;';
            
            // 决定运行按钮的状态
            const runButtonClass = status === 'loaded' ? 'plugin-run run' : 'plugin-run stop';
            const runButtonText = status === 'loaded' ? '点击停止' : '点击运行';

            pluginDiv.innerHTML = `
                <div>
                    <div class="description">
                        <span class="plugin-author">作者：${author}</span>
                        <span class="plugin-description">说明：${description}</span>
                    </div>
                    <span class="plugin-name">${name}</span>
                    <a href="https://mcdreforged.com/zh-CN/plugin/${id}" class="plugin-mcdr" target="_blank">MCDR</a>
                    <a href="${github}" class="plugin-github" style="${githubStyle}" target="_blank">Github</a>
                    <span class="plugin-version">${version}</span>
                    <span class="plugin-latest-version" style="${updateButtonStyle}">${version_latest}</span>
                </div>
                <div>
                    <button class="plugin-update list-btn" style="${updateButtonStyle}" onclick="updatePlugin('${id}')">一键更新</button>
                    <button class="${runButtonClass} list-btn" style="${pluginStatusStyle}" onclick="toggleStatus('${id}')">${runButtonText}</button>
                    <button class="plugin-reload list-btn" style="${pluginStatusStyle}" onclick="reloadPlugin('${id}')">点击重载</button>
                    <button class="plugin-config list-btn" style="${configButtonStyle}" onclick="configPlugin('${id}')">插件配置</button>
                </div>
            `;

            // 将新创建的插件添加到插件列表中
            pluginList.appendChild(pluginDiv);
            // 加载动画
            const items = document.querySelectorAll('#plugins #plugin-list .plugin');
            items.forEach((item, index) => {
                const intraGroupDelay = (index % itemsPerPage) * 0.1; // 每组内的项按顺序增加 0.1s
                item.style.animationDelay = `${intraGroupDelay}s`;
            });
            paginate('plugin-list', 'pagination');
            listPluginsTip();
        });
    })
        .catch(error => {
            console.error('Error fetching plugins:', error)
            showMessage({type: '错误',content: '加载插件列表失败，请稍后重试或终端查看报错信息', autoCloseTime: 5000,});
        });
}


// 安装插件 调用 POST /api/install_plugin {plugin_id}
function installPlugin(plugin_id) {
    showMessage({ type: '提示', content: '是否安装 ' + plugin_id + ' 插件?', title: '安装插件' })
        .then(result => {
            if (!result) {
                return;
            } else {
                showMessage({ type: '提示', content: '已提交安装请求，请稍等片刻...', autoCloseTime: 5000, });
                // 准备请求体
                const requestBody = JSON.stringify({
                    plugin_id: plugin_id,
                });
                // 发送请求
                fetch('/api/install_plugin', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: requestBody
                })
                    .then(response => response.json())
                    .then(data => {
                        console.log("安装插件成功");
                        showMessage({type: '完成',content: '安装成功，请尝试刷新页面查看',autoCloseTime: 5000,});
                        // 刷新页面
                        location.reload();
                    })
                    .catch(error => {
                        console.error("安装插件失败:", error)
                        showMessage({type: '错误',content: '安装插件失败，请稍后重试或终端查看报错信息', autoCloseTime: 5000,});
                    });
            }
        });
}
// 启动插件 调用 POST /api/toggle_plugin {plugin_id, status=true}
function runPlugin(plugin_id) {
    // 准备请求体
    const requestBody = JSON.stringify({
        plugin_id: plugin_id,
        status: true
    });
    // 发送请求
    fetch('/api/toggle_plugin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: requestBody
    })
       .then(response => response.json())
       .then(data => {
            console.log("运行插件成功");
            showMessage({type: '完成',content: '运行成功，请尝试刷新页面查看',autoCloseTime: 5000,});
            // 刷新页面
            location.reload();
        })
       .catch(error => console.error("运行插件失败:", error));
}
// 重载插件 调用 POST /api/reload_plugin {plugin_id}
function reloadPlugin(plugin_id) {
    const requestBody = JSON.stringify({
        plugin_id: plugin_id
    });

    fetch('/api/reload_plugin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: requestBody
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'error') {
            showMessage({type: '错误',content: data.message,autoCloseTime: 5000,});
        } else if (data.status ==='success') {
            showMessage({type: '完成',content: '插件重载成功，请尝试刷新页面查看',autoCloseTime: 5000,});
        }
    })
    .catch(error => console.error('Error reloading plugin:', error));
}
// 更新插件 调用 POST /api/update_plugin {plugin_id}
function updatePlugin(plugin_id) {
    showMessage({ type: '提示', content: '是否更新 ' + plugin_id + ' 插件?', title: '更新插件' })
        .then(result => {
            if (!result) {
                return;
            } else { 
                showMessage({ type: '提示', content: '已提交更新请求，请稍等片刻...', autoCloseTime: 5000,});
                const requestBody = JSON.stringify({
                    plugin_id: plugin_id
                });
            
                fetch('/api/update_plugin', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: requestBody
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'error') {
                        showMessage({type: '错误',content: plugin_id + ' 插件更新失败：' + data.message + '\n通常可能是以下原因：\n1. 该插件无法更新，如插件为单文件模式，更新有冲突...\n2. 网络连接异常，请检查网络连接。',title: '更新失败',});
                    } else if (data.status ==='success') {
                        showMessage({type: '完成',content: plugin_id + ' 插件更新请求完成，请尝试刷新页面查看\n如果更新失败，可能是该插件无法更新或者网络异常。',autoCloseTime: 5000,});
                    }
                })
                    .catch(error => {
                        console.error('Error updating plugin:', error)
                        showMessage({type: '错误',content: '更新插件失败，请稍后重试或终端查看报错信息', autoCloseTime: 5000,});
                    });
            }
        });
}
// 启用/禁用插件 调用 POST /api/toggle_plugin {plugin_id, status}
function toggleStatus(plugin_id) {
    const plugin = document.getElementById(plugin_id);
    const pluginRunButton = plugin.querySelector('.plugin-run');
    let isRunning = false;
    if (pluginRunButton) {
        isRunning = pluginRunButton.classList.contains('run');
        plugin.querySelector('.plugin-run').classList.toggle('run', !isRunning);
        plugin.querySelector('.plugin-run').classList.toggle('stop', isRunning);
    } else {
        isRunning = plugin.classList.contains('run');
        
        // 切换状态类
        plugin.classList.toggle('run', !isRunning);
        plugin.classList.toggle('stop', isRunning);
    };
    
    // 准备请求体
    const requestBody = JSON.stringify({
        plugin_id: plugin_id,
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
        if (pluginRunButton) {
            loadPlugins();
        };
        if (window.location.hash === '#home') {
            load_gugu_plugins();
            load_other_plugins();
        };

    });
}


// 清空配置
function clean_config() {
    if (window.self !== window.top && window.location.pathname === "/plugins"){
        // 清空 save btn
        const buttons = document.querySelectorAll('button');
        const saveButtons = Array.from(buttons).filter(btn => btn.textContent === '保存配置');
        saveButtons.forEach(btn => {
            btn.style.display = 'none';
        });
        // 找到所有 class 为 'config' 的元素
        const configContainers = document.querySelectorAll('.config');
        // 遍历每个 'config' 容器
        configContainers.forEach(config => {
            // 在每个 'config' 容器中找到所有 'div' 子元素
            const innerDivs = config.querySelectorAll('div');

            // 清空每个 'div' 的内容
            innerDivs.forEach(div => {
                div.innerHTML = '';
            });
        });
        // 清空之前JSON的内容
        const jsonDiv = document.getElementById('JSON');
        jsonDiv.textContent = '';
    }
}
// 获取并生成config文件配置按钮 GET /api/list_files?plugin_id=xxx
// {"files": ["config.yml", "config.json"]}
// 需要后端排除掉_note.json文件
function configPlugin(plugin_id) {
    // 获取配置文件列表
    fetch(`/api/list_config_files?plugin_id=${plugin_id}`)
        .then(response => response.json())
        .then(data => {
            // 确保存在id为config的元素
            const configContainer = document.getElementById("config");
            if (!configContainer) {
                console.error("未找到id为config的元素");
                return;
            }

            // 清空现有内容
            configContainer.innerHTML = '';
            // 清空之前JSON的内容
            const jsonDiv = document.getElementById('JSON');
            jsonDiv.textContent = '';

            // 遍历文件列表，生成HTML
            data.files.forEach(path => {
                // 创建最外层的 container，用于包含所有元素
                const container = document.createElement('div');
                container.className = 'plugin-config-container';

                // 创建配置 div 容器
                const configtitleDiv = document.createElement('div');
                configtitleDiv.className = 'config-title';

                // 创建标题
                const title = document.createElement('h4');
                title.textContent = path;

                // 创建按钮容器
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'button-container';

                // 创建加载配置按钮
                const loadButton = document.createElement('button');
                loadButton.className = 'btn';
                loadButton.textContent = '加载配置';
                loadButton.onclick = () => loadconfigPlugin(path, plugin_id);

                const loadButton2 = document.createElement('button');
                loadButton2.className = 'btn';
                loadButton2.textContent = '加载配置(编辑器)';
                loadButton2.onclick = () => loadFromServer(path);

                // 将两个按钮添加到按钮容器中
                buttonContainer.appendChild(loadButton);
                buttonContainer.appendChild(loadButton2);

                configtitleDiv.appendChild(title);
                configtitleDiv.appendChild(buttonContainer);

                // 创建配置 div 容器
                const configDiv = document.createElement('div');
                configDiv.className = 'config';

                // 创建嵌套的 div 用于配置内容显示
                const contentDiv = document.createElement('div');
                contentDiv.id = path; // 替换特殊字符确保有效 ID
                configDiv.appendChild(contentDiv);

                // 创建保存配置按钮
                const saveButton = document.createElement('button');
                saveButton.className = 'btn';
                saveButton.textContent = '保存配置';
                saveButton.style.display = "none";
                saveButton.onclick = () => saveConfig(path);

                container.appendChild(configtitleDiv);
                container.appendChild(configDiv);
                container.appendChild(saveButton);

                // 将 container 添加到 configContainer
                configContainer.appendChild(container);
            });
        })
        .catch(error => {
            console.error("获取配置文件列表失败:", error);
            showMessage({type: '错误',content: '获取配置文件列表失败，请稍后重试或终端查看报错信息', autoCloseTime: 5000,});
        });
}
// * 调用 GET /api/load_config {path}
function loadconfigPlugin(file_path, containerId = undefined) { 
    fetch(`/api/load_config?path=${encodeURIComponent(file_path)}`)
        .then(response => response.json())
        .then(jsonData => {

            clean_config();
            // 将jsonData转为纯文本再检查行数
            const jsonText = JSON.stringify(jsonData, null, 2);
            const lines = jsonText.split('\n');
            const totalItems = countJsonItems(jsonData);
            // console.log(`加载 ${file_path} 成功，共 ${lines.length} 行，${totalItems} 个配置项`);
            // 判断行数和配置项数量是否过多
            if (lines.length > 200 && totalItems > 400) {
                showMessage({ type: '警告', content: '加载内容过长（超过200行和超过400个配置项），继续加载可能导致网页卡顿或崩溃！推荐使用编辑器进行加载。\n是否继续加载？', title: '内容过长' })
                    .then((result) => {
                        if (result) {
                            buildHtmlFromJson(jsonData, file_path, containerId);
                            showMessage({ type: '完成', content: '加载完成', autoCloseTime: 5000 });
                        } else {
                            showMessage({ type: '提示', content: '已取消加载', autoCloseTime: 5000 });
                            return;
                        }
                    });
                
            } else {
                buildHtmlFromJson(jsonData, file_path, containerId);

                if (file_path === 'server/server.properties') {
                    // 设置服务器 MOTD
                    const statusServerMotd = document.getElementById('Status-server-motd');
                    statusServerMotd.textContent = jsonData['motd'];
                }
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error)
            showMessage({type: '错误',content: '加载配置文件失败，请稍后重试或终端查看报错信息', autoCloseTime: 5000,});
        });
}


// saveConfig 辅助函数 调用 GET /api/load_config?path=config.json
async function loadConfigTemplate(file_path) {
    const response = await fetch(`/api/load_config?path=${encodeURIComponent(file_path)}`);
    if (!response.ok) {
        throw new Error('网络响应不是OK');
    }
    return await response.json();
}
// 根据模板顺序构建最终 JSON
function fillTemplate(template, data) {
    const result = {};
    for (const key in template) {
        if (typeof template[key] === "object" && !Array.isArray(template[key]) && template[key] !== null) {
            result[key] = fillTemplate(template[key], data[key] || {});
        } else {
            if (data[key] !== undefined) {
                // 根据模板类型转换 data[key]
                switch (typeof template[key]) {
                    case 'number':
                        result[key] = Number(data[key]); // 转换为数字
                        break;
                    case 'string':
                        result[key] = String(data[key]); // 转换为字符串
                        break;
                    case 'boolean':
                        result[key] = Boolean(data[key]); // 转换为布尔值
                        break;
                    default:
                        result[key] = data[key]; // 对于其他类型，保持不变
                        break;
                }
            } else {
                // 如果 data 中没有该属性，使用模板中的默认值
                result[key] = template[key];
            }
        }
    }
    return result;
}
// 调用 POST /api/save_config {file_path, config_data}
async function saveConfig(file_path) {
    try {
        // 加载配置模板
        const template = await loadConfigTemplate(file_path);
        
        const configDiv = document.getElementById(file_path);
        const configData = {};

        // 填充非分组项目
        configDiv.querySelectorAll('.config-item > div').forEach(item => {
            const key = item.querySelector('p').id;
            const inputList = item.querySelectorAll('input');

            if (inputList.length > 1 || Array.from(inputList).some(input => input.classList.contains('multiple_input_boxes'))) {
                configData[key] = Array.from(inputList).map(input => input.value);
            } else {
                const value = inputList[0].type === "text" ? inputList[0].value : inputList[0].checked;
                configData[key] = value; // 确保返回数组格式
            }
        });

        // 填充分组内容
        configDiv.querySelectorAll('.Group').forEach(group => {
            const groupId = group.id;
            const groupData = {};

            group.querySelectorAll('.config-item-child > div').forEach(item => {
                const key = item.querySelector('p').id;
                const inputList = item.querySelectorAll('input');

                if (inputList.length > 1 || Array.from(inputList).some(input => input.classList.contains('multiple_input_boxes'))) {
                    groupData[key] = Array.from(inputList).map(input => input.value);
                } else {
                    const value = inputList[0].type === "text" ? inputList[0].value : inputList[0].checked;
                    groupData[key] = value; // 确保返回数组格式
                }
            });

            configData[groupId] = groupData;
        });

        const finalJson = fillTemplate(template, configData);
        // 填充到div id=JSON
        const jsonDiv = document.getElementById('JSON');
        jsonDiv.textContent = JSON.stringify(finalJson, null, 2);

        // post 请求保存配置
        const requestBody = JSON.stringify({
            file_path: file_path,
            config_data: finalJson,
        });
        const response = await fetch('/api/save_config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: requestBody
        });
        const result = await response.json();
        console.log('保存配置成功:', result);
        showMessage({type: '完成',content: '保存成功',autoCloseTime: 5000,});

        if (window.self !== window.top && window.location.pathname === "/plugins") {
            // 获取父元素
            const parent = configDiv.parentElement.parentElement;
            // 在父元素中查找按钮元素
            const buttons = parent.querySelectorAll('button');
            const saveButton = Array.from(buttons).find(btn => btn.textContent === '保存配置');

            configDiv.innerHTML = "";
            saveButton.style.display = "none";
        }
        
    } catch (error) {
        console.error('保存配置时出错:', error);
        showMessage({type: '错误',content: '保存失败！请查看终端输出日志。',title: '保存失败',autoCloseTime: 5000,});
    }
}


// addInput 辅助函数
function removeInput(button) {
    const container = button.parentElement.parentElement;
    container.removeChild(button.parentElement);
    // toggleDeleteButtons(container.id);
}
// addPlusButtonToContainer 辅助函数
function addInput(containerId) {
    const container = document.getElementById(containerId);

    // 仅在 container 内含有 multiple_input_boxes 的输入框时才允许添加新输入框
    const hasMultipleInput = container.querySelector('.multiple_input_boxes');
    if (!hasMultipleInput) return;

    const inputDiv = document.createElement('div');
    inputDiv.className = 'input-container';

    inputDiv.innerHTML = `
        <input class="multiple_input_boxes" type="text">
        <button onclick="removeInput(this)">✖</button>
    `;

    // 找到最后一个 input-container
    const lastInputContainer = container.querySelector('.input-container:last-child');
    if (lastInputContainer) {
        // 在最后一个 input-container 前插入新元素
        container.insertBefore(inputDiv, lastInputContainer);
    } else {
        // 如果没有 input-container，直接添加
        container.appendChild(inputDiv);
    }
}
// addplusButton 辅助函数
function addPlusButtonToContainer(containerSelector, containerId = undefined) {
    let configDiv;

    if (containerId !== undefined){
        configDiv = document.getElementById(containerId).querySelectorAll(containerSelector);
    } else {
        configDiv = document.querySelectorAll(containerSelector);
    }

    configDiv.forEach((item) => {
        const pTag = item.querySelector('p');
        if (!pTag) return;

        // Dynamically set the ID for the input list container
        const containerId = `${pTag.id}_input_list`;
        const inputContainer = item.querySelector('.config-item-input');
        inputContainer.id = containerId; // Assign a unique ID to each container

        // Check if the input container contains `multiple_input_boxes`
        const hasMultipleInputBox = inputContainer.querySelector('.multiple_input_boxes');
        if (hasMultipleInputBox) {
            // Create "+ Add" button and add it to the input container
            const addButton = document.createElement('div');
            addButton.className = 'btn input-container';
            addButton.textContent = '＋ 添加';
            addButton.onclick = () => addInput(containerId);
            inputContainer.appendChild(addButton);
        }
    });
}
// buildHtmlFromJson 辅助函数
function addplusButton(containerId = undefined) {
    addPlusButtonToContainer('.config-item > div', containerId);
    addPlusButtonToContainer('.config-item-child > div', containerId);
}
// buildHtmlFromJson 辅助函数 调用 GET /api/load_config?path=file_path
function loadConfig(file_path, containerId = "config") {
    fetch(`/api/load_config?path=${encodeURIComponent(file_path)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            const configData = data;
            const configDiv = document.getElementById(containerId);

            // 填充非分组项目
            configDiv.querySelectorAll('.config-item > div').forEach(item => {
                const key = item.querySelector('p').id;
                const inputContainer = item.querySelector('.config-item-input');
                const containerId = `${key}_input_list`;

                // 检查是否是多项值
                if (Array.isArray(configData[key])) {
                    const values = configData[key];

                    // 填充第一个输入框，或添加多个输入框
                    values.forEach((value, index) => {
                        if (index === 0) {
                            // 设置第一个已有的输入框的值
                            inputContainer.querySelector('input').value = value;
                        } else {
                            // 添加并填充第二个及之后的输入框
                            addInput(containerId);
                            const newInput = inputContainer.querySelectorAll('input[type="text"]')[index];
                            newInput.value = value;
                        }
                    });
                } else {
                    // 单项值处理
                    inputContainer.querySelector('input').value = configData[key];
                    if (typeof configData[key] === 'boolean') {
                        inputContainer.querySelector('input').checked = configData[key];
                    }
                }
            });

            // 填充分组内容
            configDiv.querySelectorAll('.Group').forEach(group => {
                const groupId = group.id;
                const groupData = configData[groupId] || {};

                group.querySelectorAll('.config-item-child > div').forEach(item => {
                    const key = item.querySelector('p').id;
                    const input = item.querySelector('input');
                    const value = groupData[key];
                    input.value = value;
                    if (typeof value === 'boolean') {
                        input.checked = value;
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error fetching data:', error)
            showMessage({type: '错误',content: '加载配置文件失败，请稍后重试或终端查看报错信息', autoCloseTime: 5000,});
        });
}
// buildHtmlFromJson 辅助函数 调用 GET /api/load_config?path=${file_path}&translation=true
async function loadNoteConfig(file_path) {
    try {
        const response = await fetch(`/api/load_config?translation=true&path=${encodeURIComponent(file_path)}`);
        const data = await response.json();

        for (const [key, value] of Object.entries(data)) {
            const element = document.getElementById(key);

            if (!element) continue; // 如果元素不存在，跳过

            if (Array.isArray(value)) {
                let targetElement;
                if (element.tagName.toLowerCase() === 'div') {
                    targetElement = element.querySelector('p');
                } else if (element.tagName.toLowerCase() === 'p') {
                    targetElement = element;
                }

                if (targetElement) {
                    targetElement.textContent = value[0]; // 将数组第一个值赋给 p 标签内容

                    // 创建 <span class="tip"> 标签插入第二个值
                    if (value.length > 1) {
                        const tipSpan = document.createElement('span');
                        tipSpan.className = 'tip';
                        tipSpan.textContent = value[1];
                        targetElement.appendChild(tipSpan); // 插入到 p 标签内
                    }
                }
            } else {
                // 处理非数组值
                if (element.tagName.toLowerCase() === 'div') {
                    const firstParagraph = element.querySelector('p');
                    if (firstParagraph) {
                        firstParagraph.textContent = value; // 赋值给第一个 p 标签
                    }
                } else if (element.tagName.toLowerCase() === 'p') {
                    element.textContent = value; // 如果是 p 标签，直接赋值
                }
            }
        }
    } catch (error) {
        console.error('Error fetching config:', error);
        showMessage({type: '错误',content: '加载配置文件失败，请稍后重试或终端查看报错信息', autoCloseTime: 5000,});
    }
}

function buildHtmlFromJson(jsonData, file_path, containerId = undefined) {
    const container = document.getElementById(file_path);
    
    if (window.self !== window.top && window.location.pathname === "/plugins") {
        // 获取父元素
        const parent = container.parentElement.parentElement;
        // 在父元素中查找按钮元素
        const buttons = parent.querySelectorAll('button');
        const saveButton = Array.from(buttons).find(btn => btn.textContent === '保存配置');
        saveButton.style.display = "block";
    }
    if (container.innerHTML){
        if (containerId !== undefined){
            addplusButton(containerId);
            loadConfig(file_path, containerId);
            loadNoteConfig(file_path, containerId)
            return;
        }
    } 

    container.innerHTML = ''; // 清空容器
    
    function createElement(key, value) {
        const itemDiv = document.createElement('div');
        const p = document.createElement('p');
        p.id = key;
        p.textContent = key;

        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'config-item-input';

        const input = document.createElement('input');
        // 检查是否为数组并设置类名
        if (Array.isArray(value)) {
            input.className = 'multiple_input_boxes'; // 为数组项设置类名
            input.type = 'text'; // 统一设置为文本框
        } else {
            input.type = typeof value === 'boolean' ? 'checkbox' : 'text';
            input.value = value;

            // 如果是布尔值，设置为选中状态
            if (typeof value === 'boolean') {
                input.checked = value;
            }
        }

        inputWrapper.appendChild(input);
        itemDiv.appendChild(p);
        itemDiv.appendChild(inputWrapper);

        return itemDiv;
    }

    function createGroup(key) {
        const groupDiv = document.createElement('div');
        groupDiv.id = key;
        groupDiv.className = 'Group';

        const p = document.createElement('p');
        p.textContent = key; // 分组名
        groupDiv.appendChild(p);

        const childDiv = document.createElement('div');
        childDiv.className = 'config-item-child';
        groupDiv.appendChild(childDiv);

        return { groupDiv, childDiv };
    }

    function traverse(obj, container) {
        const ungroupedDiv = document.createElement('div');
        ungroupedDiv.className = 'config-item'; // 设置未分组项的类名

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                // 是字典
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    // 创建区域
                    const { groupDiv, childDiv } = createGroup(key);
                    for (const subKey in obj[key]) {
                        if (obj[key].hasOwnProperty(subKey)) {
                            const childElement = createElement(subKey, obj[key][subKey]);
                            childDiv.appendChild(childElement);
                        }
                    }
                    container.appendChild(groupDiv);
                } else {
                    // 列表，数字。。。
                    const element = createElement(key, obj[key]);
                    ungroupedDiv.appendChild(element);
                }
            }
        }

        // 将未分组的项添加到容器
        if (ungroupedDiv.children.length > 0) {
            container.appendChild(ungroupedDiv);
        }
    }

    traverse(jsonData, container); // 开始遍历 JSON 数据
    addplusButton();
    loadConfig(file_path);
    loadNoteConfig(file_path)

    // 将class="config-item"提到最前面
    const configItems = document.querySelectorAll('.config-item');
    for (let i = 0; i < configItems.length; i++) {
        container.insertBefore(configItems[i], container.firstChild);
    }
}

// 为每个文本输入框添加动态宽度调整
function adjustWidth(input) {
    const tempSpan = document.createElement("span");
    tempSpan.style.visibility = "hidden";
    tempSpan.style.position = "absolute";
    tempSpan.style.whiteSpace = "pre"; // 保持空格宽度
    tempSpan.textContent = input.value || " "; // 确保有最小宽度
    document.body.appendChild(tempSpan);

    // 根据 span 的宽度调整输入框宽度
    input.style.width = `${tempSpan.offsetWidth + 20 + 25}px`;

    // 清理临时的 span 元素
    document.body.removeChild(tempSpan);
}
// 获取所有的文本输入框并添加事件监听器
document.querySelectorAll('input[type="text"]').forEach(input => {
    // 输入事件
    input.addEventListener('input', function () {
        adjustWidth(input);
    });
    // 聚焦事件
    input.addEventListener('focus', function () {
        adjustWidth(input);
    });
});

// 循环，1秒执行一次
setInterval(() => {
    // 循环所有文本输入框并调整宽度
    document.querySelectorAll('input[type="text"]').forEach(input => {
        adjustWidth(input);
    }); 
}, 1000);

// 打开弹窗
const openPopup = (path) => {
    // 获取文件扩展名
    const extension = path.split('.').pop().toLowerCase();
    // 扩展名映射
    const modeMap = {
        js: "javascript",
        css: "css",
        json: "json",
        txt: "text",
        yml: "yaml"
    };

    // 获取对应的编辑模式，默认为纯文本
    const mode = modeMap[extension] || "text";
    editor.session.setMode("ace/mode/" + mode);
    current_path = path;

    // 加载内容和显示弹窗
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
const loadFromServer = async (path) => {

    try {
        const response = await fetch(`/api/load_config_file?path=`+path); 
        const serverContent = await response.text();
        const localContent = localStorage.getItem(localStorageKey(path));
        
        if (localContent && localContent !== serverContent) {
            showMessage({ type: '警告', content: '本地内容与服务器内容不同，是否使用本地内容？', title: '本地内容与服务器内容不同', })
                .then((result) => {
                    if (result) {
                        editor.setValue(localContent, -1);
                    } else {
                        editor.setValue(serverContent, -1);
                    }
                });
        } else {
            editor.setValue(serverContent, -1);
        }

        openPopup(path);
    } catch (error) {
        alert("加载失败：" + error);
    }
};
// 保存编辑内容到服务器
const saveToServer = async () => {
    const content = editor.getValue();
    const action = current_path;
    try {
        await fetch(`/api/save_config_file`, { //save_css or save_js
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, content })
        });
        localStorage.removeItem(localStorageKey(current_path));
        showMessage({type: '完成',content: '保存成功',autoCloseTime: 5000,});
    } catch (error) {
        alert("保存失败：" + error);
    }
};
// 加载本地内容
const loadLocalContent = () => {
    const savedContent = localStorage.getItem(localStorageKey(current_path));
    if (savedContent) {
        editor.setValue(savedContent, -1);
    }
};
