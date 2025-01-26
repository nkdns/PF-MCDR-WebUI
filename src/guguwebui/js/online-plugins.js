// author & description 显示函数
// 计算相对时间
function getRelativeTime(dateStr) {
    if (!dateStr) return '未知时间';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    const month = day * 30;
    const year = day * 365;
    
    if (diff < minute) {
        return '刚刚';
    } else if (diff < hour) {
        return `${Math.floor(diff / minute)}分钟前`;
    } else if (diff < day) {
        return `${Math.floor(diff / hour)}小时前`;
    } else if (diff < week) {
        return `${Math.floor(diff / day)}天前`;
    } else if (diff < month) {
        return `${Math.floor(diff / week)}周前`;
    } else if (diff < year) {
        return `${Math.floor(diff / month)}个月前`;
    } else {
        return `${Math.floor(diff / year)}年前`;
    }
}

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
let searchText = '';  // 存储当前的搜索文本

// 搜索功能
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', function() {
        searchText = searchInput.value.toLowerCase(); // 获取输入框内容并转为小写
        currentPage = 1;  // 每次搜索时重置为第一页
        filterAndPaginate(searchText); // 过滤并分页
    });
}

// 过滤插件并重新分页
function filterAndPaginate(searchText) {
    const pluginList = document.getElementById('plugin-list');
    const items = Array.from(pluginList.children);

    // 过滤插件项，除了id、name、description、version，还要检查authors
    let filteredItems = items.filter(item => {
        const id = item.id.toLowerCase();
        const name = item.querySelector('.plugin-name').textContent.toLowerCase();
        const description = item.querySelector('.plugin-description').textContent.toLowerCase();
        const version = item.querySelector('.plugin-version').textContent.toLowerCase();
        const authors = item.querySelector('.plugin-author').textContent.toLowerCase(); // 获取作者文本

        return id.includes(searchText) || 
               name.includes(searchText) || 
               description.includes(searchText) || 
               version.includes(searchText) || 
               authors.includes(searchText); // 也要匹配作者
    });

    // 隐藏所有插件项
    items.forEach(item => item.style.display = 'none');
    
    // 显示符合搜索条件的插件项
    filteredItems.forEach(item => item.style.display = 'flex');
    
    // 重新分页并分配动画时长
    paginate('plugin-list', 'pagination', filteredItems);
}


// 修改分页函数，接受过滤后的插件列表
function paginate(list_id, pagination, filteredItems = null) {
    const contentDiv = document.getElementById(list_id);
    const items = filteredItems || Array.from(contentDiv.children); // 使用过滤后的插件列表
    const totalPages = Math.ceil(items.length / itemsPerPage);

    // 根据当前页码显示分页项
    items.forEach((item, index) => {
        item.style.display = (index >= (currentPage - 1) * itemsPerPage && index < currentPage * itemsPerPage) ? 'flex' : 'none';
    });

    // 重新分配动画延迟
    const displayedItems = items.filter((item, index) => index >= (currentPage - 1) * itemsPerPage && index < currentPage * itemsPerPage);
    displayedItems.forEach((item, index) => {
        const intraGroupDelay = (index % itemsPerPage) * 0.1; // 每组内的项按顺序增加 0.1s
        item.style.animationDelay = `${intraGroupDelay}s`;
    });

    const paginationDiv = document.getElementById(pagination);
    paginationDiv.innerHTML = `
        ${currentPage > 1 ? '<button class="btn" onclick="changePage(-1)">上一页</button>' : ''}
        第 ${currentPage} 页 / 共 ${totalPages} 页
        ${currentPage < totalPages ? '<button class="btn" onclick="changePage(1)">下一页</button>' : ''}
    `;
}

function changePage(direction) {
    currentPage += direction;
    filterAndPaginate(searchText); // 保持当前搜索条件
}


// 初始化插件加载
function loadPlugins() {
    const pluginList = document.getElementById('plugin-list');
    pluginList.innerHTML = ''; // 清空现有的插件列表
    fetch('/api/online-plugins')
    .then(response => response.json())
    .then(data => {
        // 按last_update_time逆序排序，null/none的排在最后
        data.sort((a, b) => {
            const timeA = a.last_update_time ? new Date(a.last_update_time) : null;
            const timeB = b.last_update_time ? new Date(b.last_update_time) : null;
            
            if (timeA === null && timeB === null) return 0;
            if (timeA === null) return 1;
            if (timeB === null) return -1;
            return timeB - timeA;
        });
        // 遍历插件数组，创建插件列表
        data.forEach(plugin => {
            const { id, name, description, authors, repository_url, version, latest_version } = plugin;
            const authorNames = authors.map(author => `${author.name}`).join(',');

            // 创建插件的 HTML 结构
            const pluginDiv = document.createElement('div');
            pluginDiv.className = 'plugin';
            pluginDiv.id = `${id}`;


            const installButtonStyle = (version === latest_version && latest_version !== null) ? 'visibility: visible;' : 'visibility: hidden;';
            const updateButtonStyle = version === latest_version ? 'visibility: hidden;' : 'visibility: visible;';

            pluginDiv.innerHTML = `
                <div last_update_time="${plugin.last_update_time}">
                    <div class="description">
                        <span class="plugin-author">作者：${authorNames}</span>
                        <span class="plugin-update-time">${getRelativeTime(plugin.last_update_time)}</span>
                        <span class="plugin-description">说明：${description.zh_cn || description.en_us}</span>
                    </div>
                    <span class="plugin-name">${name || id}</span>
                    <span class="plugin-version">${latest_version || version}</span>
                    <span class="plugin-description">${description.zh_cn || description.en_us}</span>
                </div>
                <div>
                    <button class="plugin-install list-btn" style="${installButtonStyle}" onclick="installPlugin('${id}')">一键安装</button>
                    <button class="plugin-showPlugin list-btn" onclick="showPlugin('${id}')">插件详情</button>
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
        });

        // 初始化分页
        paginate('plugin-list', 'pagination');
        listPluginsTip();
        setupSearch(); // 设置搜索功能
    })
    .catch(error => {
        console.error('Error fetching plugins:', error);
        showMessage({type: '错误', content: '加载插件列表失败，请稍后重试或终端查看报错信息', autoCloseTime: 5000});
    });
}



function showPlugin(id) { 
    const mcdrPopup = document.getElementById('mcdr-popup');
    const popupControls = mcdrPopup.querySelector('#popup-controls');
    const cancelButton = mcdrPopup.querySelector('#cancel');
    const installButton = mcdrPopup.querySelector('#install');
    const mcdrFrame = mcdrPopup.querySelector('#mcdr-frame');

    // 显示画布
    mcdrPopup.style.display = 'block';

    // 加载插件详情页面
    mcdrFrame.src = `https://mcdreforged.com/zh-CN/plugin/${id}`;

    // 安装插件的事件处理函数
    const installHandler = () => {
        installPlugin(id);
    };

    // 安装插件
    installButton.addEventListener('click', installHandler);

    // 关闭画布
    cancelButton.addEventListener('click', () => {
        mcdrPopup.style.display = 'none';
        mcdrFrame.src = '';
        // 清理安装插件按钮的点击事件
        installButton.removeEventListener('click', installHandler);
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
                        if (data.status === 'error') {
                            showMessage({type: '错误',content: plugin_id + ' 插件安装失败：' + data.message,title: '安装失败',});
                        } else if (data.status ==='success') {
                            showMessage({type: '完成',content: plugin_id + ' 插件安装请求完成，请前往本地插件页面查看\n如果更新失败，可能是该插件无法安装或者网络异常。',autoCloseTime: 5000,});
                        }
                    })
                        .catch(error => {
                            console.error('Error updating plugin:', error)
                            showMessage({type: '错误',content: '安装插件失败，请稍后重试或终端查看报错信息', autoCloseTime: 5000,});
                        });
            }
        });
    }
