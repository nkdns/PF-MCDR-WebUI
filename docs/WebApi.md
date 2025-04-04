# MCDR WebUI API 文档

本文档记录了MCDR WebUI前端界面使用的API接口。

## 认证相关API

### 检查登录状态
- 端点: `/api/checkLogin`
- 方法: GET
- 功能: 检查当前用户是否已登录
- 响应: 
  ```json
  {
    "status": "success|error",
    "username": "用户名"
  }
  ```
- 调用示例:
  ```javascript
  async function checkLoginStatus() {
    try {
      const response = await fetch('/api/checkLogin');
      const data = await response.json();
      if (data.status === 'success') {
        console.log(`已登录，用户名: ${data.username}`);
      } else {
        console.log('未登录');
      }
    } catch (error) {
      console.error('检查登录状态出错:', error);
    }
  }
  ```
- 使用位置: 所有需要认证的页面

### 登录
- 端点: `/login`
- 方法: POST
- 参数: 
  - `account`: 账号（表单提交）
  - `password`: 密码（表单提交）
  - `temp_code`: 临时登录码（可选，表单提交）
  - `remember`: 是否记住登录状态（表单提交）
- 功能: 用户登录
- 响应:
  - 成功时：重定向到首页或指定的redirect地址
  - 失败时：重新渲染登录页面并显示错误信息
- 调用示例（表单提交）:
  ```html
  <form action="/login" method="post">
    <input type="text" name="account" placeholder="账号" required>
    <input type="password" name="password" placeholder="密码" required>
    <input type="checkbox" name="remember" value="true"> 记住我
    <button type="submit">登录</button>
  </form>
  ```
- 使用位置: 登录页面

### 登出
- 端点: `/logout`
- 方法: GET
- 功能: 用户退出登录
- 响应: 重定向到登录页面
- 调用示例:
  ```javascript
  function logout() {
    window.location.href = '/logout';
  }
  ```
- 使用位置: 所有页面的退出登录按钮

## 服务器状态API

### 获取服务器状态
- 端点: `/api/get_server_status`
- 方法: GET
- 功能: 获取Minecraft服务器状态
- 响应:
  ```json
  {
    "status": "online|offline|error",
    "version": "服务器版本信息",
    "players": "在线人数/最大人数"
  }
  ```
- 调用示例:
  ```javascript
  async function checkServerStatus() {
    try {
      const response = await fetch('/api/get_server_status');
      const data = await response.json();
      
      if (data.status === 'online') {
        console.log(`服务器在线，版本: ${data.version}, 玩家: ${data.players}`);
      } else if (data.status === 'offline') {
        console.log('服务器离线');
      } else {
        console.log('获取服务器状态出错');
      }
    } catch (error) {
      console.error('检查服务器状态出错:', error);
    }
  }
  ```
- 使用位置: 首页、控制面板

### 控制服务器
- 端点: `/api/control_server`
- 方法: POST
- 参数:
  - `action`: 操作类型（"start"/"stop"/"restart"）
- 功能: 启动、停止或重启Minecraft服务器
- 响应:
  ```json
  {
    "status": "success|error",
    "message": "操作结果信息"
  }
  ```
- 调用示例:
  ```javascript
  async function controlServer(action) {
    try {
      const response = await fetch('/api/control_server', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: action })
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        console.log(`服务器${action}命令已发送: ${result.message}`);
      } else {
        console.error(`操作失败: ${result.message}`);
      }
    } catch (error) {
      console.error('控制服务器出错:', error);
    }
  }
  
  // 使用示例
  // controlServer('start');   // 启动服务器
  // controlServer('stop');    // 停止服务器
  // controlServer('restart'); // 重启服务器
  ```
- 使用位置: 服务器控制面板

### 获取服务器日志
- 端点: `/api/server_logs`
- 方法: GET
- 参数:
  - `start_line`: 开始行号（默认0）
  - `max_lines`: 最大返回行数（默认100，最大500）
  - `log_type`: 日志类型（"mcdr"/"minecraft"，默认"mcdr"）
  - `merged`: 是否获取合并日志（可选，布尔值，默认false）
- 功能: 获取服务器日志内容
- 响应:
  ```json
  {
    "status": "success|error",
    "logs": [
      {
        "line_number": 0,
        "content": "日志内容",
        "source": "mcdr|minecraft" // 合并模式下才有此字段
      }
    ],
    "total_lines": 总行数,
    "current_start": 开始行号,
    "current_end": 结束行号,
    "log_type": "日志类型"
  }
  ```
- 调用示例:
  ```javascript
  async function getServerLogs(logType = 'mcdr', startLine = 0, maxLines = 100, merged = false) {
    try {
      const params = new URLSearchParams({
        start_line: startLine,
        max_lines: maxLines,
        log_type: logType
      });
      
      if (merged) {
        params.append('merged', 'true');
      }
      
      const response = await fetch(`/api/server_logs?${params.toString()}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        console.log(`获取到 ${data.logs.length} 行日志`);
        console.log(`总行数: ${data.total_lines}`);
        // 处理日志
        data.logs.forEach(log => {
          console.log(`${log.line_number}: ${log.content}`);
        });
      } else {
        console.error('获取日志失败');
      }
    } catch (error) {
      console.error('获取服务器日志出错:', error);
    }
  }
  ```
- 使用位置: 日志查看页面
- 备注: 当`merged`参数为true时，返回的日志会包含来源信息（mcdr或minecraft）

### 获取最新日志更新
- 端点: `/api/new_logs`
- 方法: GET
- 参数:
  - `last_line`: 客户端已有的最后一行行号
  - `log_type`: 日志类型（"mcdr"/"minecraft"，默认"mcdr"）
- 功能: 获取最新的日志更新，用于实时更新日志显示
- 响应:
  ```json
  {
    "status": "success|error",
    "logs": [
      {
        "line_number": 行号,
        "content": "日志内容"
      }
    ],
    "total_lines": 总行数,
    "has_new": true|false,
    "next_line": 下一次请求的起始行号
  }
  ```
- 调用示例:
  ```javascript
  async function fetchNewLogs(lastLine, logType = 'mcdr') {
    try {
      const response = await fetch(`/api/new_logs?last_line=${lastLine}&log_type=${logType}`);
      const data = await response.json();
      
      if (data.status === 'success' && data.has_new) {
        console.log(`获取到 ${data.logs.length} 行新日志`);
        // 处理新日志
        data.logs.forEach(log => {
          console.log(`${log.line_number}: ${log.content}`);
        });
        
        // 更新最后一行行号
        return data.total_lines;
      }
      
      return lastLine; // 没有新日志，返回原行号
    } catch (error) {
      console.error('获取新日志出错:', error);
      return lastLine;
    }
  }
  
  // 定时获取新日志
  let lastLine = 0;
  setInterval(async () => {
    lastLine = await fetchNewLogs(lastLine);
  }, 3000);
  ```
- 使用位置: 日志实时监控页面
- 备注: 通常与`setInterval`配合使用，定期轮询获取新日志

## 插件管理API

### 获取插件列表
- 端点: `/api/plugins`
- 方法: GET
- 参数: 
  - `detail`: 是否获取详细信息（可选，布尔值）
- 功能: 获取已安装的插件列表
- 响应:
  ```json
  {
    "status": "success",
    "plugins": [
      {
        "id": "插件ID",
        "name": "插件名称",
        "version": "插件版本",
        "description": "插件描述",
        "status": "loaded|unloaded|disabled",
        "author": "插件作者",
        "link": "插件链接",
        "dependencies": ["依赖插件列表"],
        "repository": "代码仓库地址"
      }
    ]
  }
  ```
- 调用示例:
  ```javascript
  async function getPlugins(detail = false) {
    try {
      const url = detail ? '/api/plugins?detail=true' : '/api/plugins';
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'success') {
        console.log(`获取到 ${data.plugins.length} 个插件`);
        // 处理插件列表
        data.plugins.forEach(plugin => {
          console.log(`${plugin.name} (${plugin.id}) - ${plugin.status}`);
        });
      } else {
        console.error('获取插件列表失败');
      }
    } catch (error) {
      console.error('获取插件列表出错:', error);
    }
  }
  ```
- 使用位置: 插件管理页面
- 备注: 当`detail`参数为true时，返回的插件信息会更加详细，包括作者、链接等

### 获取咕咕机器人插件
- 端点: `/api/gugubot_plugins`
- 方法: GET
- 功能: 获取咕咕机器人相关插件的元数据
- 响应:
  ```json
  {
    "status": "success",
    "gugubot_plugins": [
      {
        "id": "插件ID",
        "name": "插件名称",
        "version": "插件版本",
        "description": "插件描述",
        "status": "loaded|unloaded|disabled",
        "handlers": ["处理器列表"],
        "commands": ["命令列表"]
      }
    ]
  }
  ```
- 调用示例:
  ```javascript
  async function getGugubotPlugins() {
    try {
      const response = await fetch('/api/gugubot_plugins');
      const data = await response.json();
      
      if (data.status === 'success') {
        console.log(`获取到 ${data.gugubot_plugins.length} 个咕咕机器人插件`);
        // 处理插件列表
        data.gugubot_plugins.forEach(plugin => {
          console.log(`${plugin.name} (${plugin.id}) - ${plugin.status}`);
          console.log(`命令: ${plugin.commands.join(', ')}`);
        });
      } else {
        console.error('获取咕咕机器人插件列表失败');
      }
    } catch (error) {
      console.error('获取咕咕机器人插件列表出错:', error);
    }
  }
  ```
- 使用位置: 咕咕机器人配置页面

### 切换插件状态
- 端点: `/api/toggle_plugin`
- 方法: POST
- 参数: 
  - `plugin_id`: 插件ID
  - `status`: 目标状态（true为启用，false为禁用）
- 功能: 启用或禁用指定插件
- 响应:
  ```json
  {
    "status": "success|error",
    "message": "操作结果信息"
  }
  ```
- 调用示例:
  ```javascript
  async function togglePlugin(pluginId, enable) {
    try {
      const response = await fetch('/api/toggle_plugin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plugin_id: pluginId,
          status: enable
        })
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        console.log(`插件 ${pluginId} ${enable ? '已启用' : '已禁用'}: ${result.message}`);
      } else {
        console.error(`操作失败: ${result.message}`);
      }
    } catch (error) {
      console.error('切换插件状态出错:', error);
    }
  }
  
  // 使用示例
  // togglePlugin('example_plugin', true);  // 启用插件
  // togglePlugin('example_plugin', false); // 禁用插件
  ```
- 使用位置: 插件管理页面

### 重载插件
- 端点: `/api/reload_plugin`
- 方法: POST
- 参数: 
  - `plugin_id`: 插件ID
- 功能: 重新加载指定插件
- 响应:
  ```json
  {
    "status": "success|error",
    "message": "操作结果信息"
  }
  ```
- 调用示例:
  ```javascript
  async function reloadPlugin(pluginId) {
    try {
      const response = await fetch('/api/reload_plugin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plugin_id: pluginId
        })
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        console.log(`插件 ${pluginId} 已重载: ${result.message}`);
      } else {
        console.error(`重载失败: ${result.message}`);
      }
    } catch (error) {
      console.error('重载插件出错:', error);
    }
  }
  ```
- 使用位置: 插件管理页面

### 在线插件仓库
- 端点: `/api/online-plugins`
- 方法: GET
- 参数:
  - `page`: 页码（可选，默认1）
  - `per_page`: 每页项目数（可选，默认20）
  - `search`: 搜索关键词（可选）
- 功能: 获取在线插件仓库中的插件列表
- 响应:
  ```json
  {
    "status": "success",
    "plugins": [
      {
        "id": "插件ID",
        "name": "插件名称",
        "version": "最新版本",
        "description": {
          "en_us": "英文描述",
          "zh_cn": "中文描述"
        },
        "author": "插件作者",
        "tags": ["标签列表"],
        "dependencies": ["依赖插件列表"],
        "repository": "代码仓库地址",
        "installed": true|false,
        "installed_version": "已安装版本（如果已安装）",
        "update_available": true|false
      }
    ],
    "total": 总插件数,
    "page": 当前页码,
    "total_pages": 总页数
  }
  ```
- 调用示例:
  ```javascript
  async function getOnlinePlugins(page = 1, perPage = 20, search = '') {
    try {
      const params = new URLSearchParams({
        page: page,
        per_page: perPage
      });
      
      if (search) {
        params.append('search', search);
      }
      
      const response = await fetch(`/api/online-plugins?${params.toString()}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        console.log(`获取到 ${data.plugins.length} 个在线插件`);
        console.log(`总计: ${data.total} 个插件，共 ${data.total_pages} 页`);
        
        // 处理插件列表
        data.plugins.forEach(plugin => {
          const status = plugin.installed 
            ? (plugin.update_available ? '可更新' : '已安装') 
            : '未安装';
          console.log(`${plugin.name} (${plugin.id}) - ${status}`);
        });
      } else {
        console.error('获取在线插件列表失败');
      }
    } catch (error) {
      console.error('获取在线插件列表出错:', error);
    }
  }
  
  // 搜索示例
  // getOnlinePlugins(1, 20, 'backup');  // 搜索包含"backup"的插件
  ```
- 使用位置: 在线插件页面
- 备注: 
  - 支持分页和搜索功能
  - 返回的插件会标记是否已安装及是否有更新可用

### 安装插件
- 端点: `/api/install_plugin`
- 方法: POST
- 参数: 
  - `plugin_id`: 插件ID
  - `from_url`: 是否从URL安装（可选，布尔值，默认false）
  - `url`: 安装URL（当from_url为true时需要）
- 功能: 安装指定插件
- 响应:
  ```json
  {
    "status": "success|error",
    "message": "操作结果信息"
  }
  ```
- 调用示例:
  ```javascript
  // 从仓库安装插件
  async function installPlugin(pluginId) {
    try {
      const response = await fetch('/api/install_plugin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plugin_id: pluginId
        })
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        console.log(`插件 ${pluginId} 安装成功: ${result.message}`);
      } else {
        console.error(`安装失败: ${result.message}`);
      }
    } catch (error) {
      console.error('安装插件出错:', error);
    }
  }
  
  // 从URL安装插件
  async function installPluginFromUrl(pluginId, url) {
    try {
      const response = await fetch('/api/install_plugin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plugin_id: pluginId,
          from_url: true,
          url: url
        })
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        console.log(`插件从URL安装成功: ${result.message}`);
      } else {
        console.error(`安装失败: ${result.message}`);
      }
    } catch (error) {
      console.error('安装插件出错:', error);
    }
  }
  ```
- 使用位置: 在线插件页面

### 更新插件
- 端点: `/api/update_plugin`
- 方法: POST
- 参数: 
  - `plugin_id`: 插件ID
- 功能: 更新指定插件
- 响应:
  ```json
  {
    "status": "success|error",
    "message": "操作结果信息"
  }
  ```
- 调用示例:
  ```javascript
  async function updatePlugin(pluginId) {
    try {
      const response = await fetch('/api/update_plugin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plugin_id: pluginId
        })
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        console.log(`插件 ${pluginId} 更新成功: ${result.message}`);
      } else {
        console.error(`更新失败: ${result.message}`);
      }
    } catch (error) {
      console.error('更新插件出错:', error);
    }
  }
  ```
- 使用位置: 插件管理页面

## 配置相关API

### 获取配置文件列表
- 端点: `/api/list_config_files`
- 方法: GET
- 参数: 
  - `plugin_id`: 插件ID
- 功能: 获取指定插件的配置文件列表
- 响应:
  ```json
  {
    "status": "success|error",
    "files": ["配置文件路径列表"],
    "message": "错误信息（如果失败）"
  }
  ```
- 调用示例:
  ```javascript
  async function getConfigFiles(pluginId) {
    try {
      const response = await fetch(`/api/list_config_files?plugin_id=${encodeURIComponent(pluginId)}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        console.log(`获取到 ${data.files.length} 个配置文件`);
        // 处理文件列表
        data.files.forEach(file => {
          console.log(`配置文件: ${file}`);
        });
        return data.files;
      } else {
        console.error(`获取配置文件列表失败: ${data.message}`);
        return [];
      }
    } catch (error) {
      console.error('获取配置文件列表出错:', error);
      return [];
    }
  }
  ```
- 使用位置: 插件配置页面

### 加载配置文件
- 端点: `/api/load_config`
- 方法: GET
- 参数: 
  - `path`: 配置文件路径
  - `translation`: 是否需要翻译（可选，布尔值）
  - `type`: 配置类型（可选，默认为"auto"）
- 功能: 加载指定配置文件内容
- 使用位置: 配置编辑页面

### 保存配置文件
- 端点: `/api/save_config`
- 方法: POST
- 参数: 
  - `file_path`: 文件路径
  - `config_data`: 配置数据
- 功能: 保存配置文件
- 使用位置: 配置编辑页面

### 加载配置文件内容
- 端点: `/api/load_config_file`
- 方法: GET
- 参数: 
  - `path`: 配置文件路径
- 功能: 加载指定配置文件的原始内容
- 响应: 文件内容（纯文本）
- 使用位置: 配置编辑页面

### 保存配置文件内容
- 端点: `/api/save_config_file`
- 方法: POST
- 参数: 
  - `action`: 文件路径
  - `content`: 文件内容
- 功能: 保存配置文件原始内容
- 使用位置: 配置编辑页面

### 获取WebUI配置
- 端点: `/api/get_web_config`
- 方法: GET
- 功能: 获取WebUI本身的配置
- 响应:
  ```json
  {
    "host": "主机地址",
    "port": "端口",
    "super_admin_account": "超级管理员账号",
    "disable_admin_login_web": "是否禁用其他管理员登录",
    "enable_temp_login_password": "是否启用临时登录密码"
  }
  ```
- 使用位置: WebUI设置页面

### 保存WebUI配置
- 端点: `/api/save_web_config`
- 方法: POST
- 参数: 
  - `action`: 操作类型（"config"/"disable_admin_login_web"/"enable_temp_login_password"）
  - `host`: 主机地址（可选）
  - `port`: 端口（可选）
  - `superaccount`: 超级管理员账号（可选）
  - `deepseek_api_key`: DeepSeek API密钥（可选）
  - `deepseek_model`: DeepSeek模型选择（可选）
- 功能: 保存WebUI配置
- 响应:
  ```json
  {
    "status": "success|error",
    "message": "操作结果信息（如果有）"
  }
  ```
- 调用示例:
  ```javascript
  // 保存基本配置
  async function saveWebConfig(host, port, superAccount) {
    try {
      const response = await fetch('/api/save_web_config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'config',
          host: host,
          port: port,
          superaccount: superAccount
        })
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        console.log('WebUI配置保存成功');
      } else {
        console.error(`保存失败: ${result.message}`);
      }
    } catch (error) {
      console.error('保存WebUI配置出错:', error);
    }
  }
  
  // 保存DeepSeek配置
  async function saveDeepseekConfig(apiKey, model) {
    try {
      const response = await fetch('/api/save_web_config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'config',
          deepseek_api_key: apiKey,
          deepseek_model: model
        })
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        console.log('DeepSeek配置保存成功');
      } else {
        console.error(`保存失败: ${result.message}`);
      }
    } catch (error) {
      console.error('保存DeepSeek配置出错:', error);
    }
  }
  
  // 切换其他管理员登录权限
  async function toggleAdminLoginWeb() {
    try {
      const response = await fetch('/api/save_web_config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'disable_admin_login_web'
        })
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        console.log(`其他管理员登录权限已${result.message ? '禁用' : '启用'}`);
      } else {
        console.error(`操作失败`);
      }
    } catch (error) {
      console.error('切换其他管理员登录权限出错:', error);
    }
  }
  ```
- 使用位置: WebUI设置页面
- 备注: 保存DeepSeek API密钥时，如果不提供值，将保持原值不变

## 文件操作API

### 加载CSS/JS文件
- 端点: `/api/load_file`
- 方法: GET
- 参数: 
  - `file`: 文件类型（css/js）
- 功能: 加载overall.css或overall.js文件内容
- 响应: 文件内容（纯文本）
- 使用位置: 自定义样式/脚本编辑页面

### 保存CSS/JS文件
- 端点: `/api/save_file`
- 方法: POST
- 参数: 
  - `action`: 文件类型（css/js）
  - `content`: 文件内容
- 功能: 保存overall.css或overall.js文件
- 使用位置: 自定义样式/脚本编辑页面

## 外部API

### 获取QQ昵称
- 端点: `https://api.leafone.cn/api/qqnick`
- 方法: GET
- 参数:
  - `qq`: QQ号码
- 功能: 获取QQ昵称和头像信息
- 响应:
  ```json
  {
    "code": 200,
    "msg": "获取成功",
    "data": {
      "nickname": "QQ昵称",
      "avatar": "头像信息"
    }
  }
  ```
- 使用位置: 用户信息显示

### 获取QQ头像
- 端点: `https://q1.qlogo.cn/g`
- 方法: GET
- 参数:
  - `b`: 固定值为"qq"
  - `nk`: QQ号码
  - `s`: 图像尺寸（640为最大）
- 功能: 获取QQ头像图片
- 响应: 图片文件
- 使用位置: 用户头像显示

## AI 辅助 API

### 发送命令到MCDR终端
- 端点: `/api/send_command`
- 方法: POST
- 功能: 向MCDR服务器发送命令
- 参数:
  ```json
  {
    "command": "要执行的命令"
  }
  ```
- 响应:
  ```json
  {
    "status": "success|error",
    "message": "操作结果信息",
    "feedback": "命令执行反馈（RCON模式下）" 
  }
  ```
- 调用示例:
  ```javascript
  async function sendCommand(command) {
    try {
      const response = await fetch('/api/send_command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command: command })
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        console.log(`命令已发送: ${result.message}`);
        
        // 如果有RCON反馈
        if (result.feedback) {
          console.log(`命令反馈: ${result.feedback}`);
        }
        
        return true;
      } else {
        console.error(`发送失败: ${result.message}`);
        return false;
      }
    } catch (error) {
      console.error('发送命令出错:', error);
      return false;
    }
  }
  
  // 使用示例
  // sendCommand('list');            // MCDR命令
  // sendCommand('/say Hello');      // 带/前缀的MC命令，会尝试通过RCON发送
  ```
- 使用位置: 终端页面
- 备注: 
  - 当命令以"/"开头时，如果RCON已启用并连接，会优先使用RCON发送命令并返回直接反馈
  - 如果RCON未启用或执行失败，会回退到使用普通方式发送命令
  - 禁止执行以下命令以保护WebUI功能：`!!MCDR plugin reload guguwebui`、`!!MCDR plugin unload guguwebui`

### DeepSeek AI 查询
- 端点: `/api/deepseek`
- 方法: POST
- 功能: 向DeepSeek API发送问题并获取AI回答
- 参数:
  ```json
  {
    "query": "你的问题",
    "system_prompt": "可选的系统指令",
    "model": "可选指定模型名",
    "chat_history": [
      {"role": "user", "content": "之前的问题"},
      {"role": "assistant", "content": "之前的回答"}
    ]
  }
  ```
- 响应:
  ```json
  {
    "status": "success|error",
    "answer": "AI回答内容",
    "model": "使用的模型名称"
  }
  ```
- 错误响应:
  ```json
  {
    "status": "error",
    "message": "错误信息"
  }
  ```
- 调用示例:
  ```javascript
  // 简单问答
  async function askAI(query, systemPrompt = null) {
    try {
      const requestData = {
        query: query
      };
      
      if (systemPrompt) {
        requestData.system_prompt = systemPrompt;
      }
      
      const response = await fetch('/api/deepseek', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        console.log(`AI回答: ${result.answer}`);
        return result.answer;
      } else {
        console.error(`查询失败: ${result.message}`);
        return null;
      }
    } catch (error) {
      console.error('AI查询出错:', error);
      return null;
    }
  }
  
  // 连续对话示例
  async function chatWithAI(query, chatHistory = []) {
    try {
      const requestData = {
        query: query,
        chat_history: chatHistory
      };
      
      const response = await fetch('/api/deepseek', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        // 更新聊天历史
        chatHistory.push(
          { role: 'user', content: query },
          { role: 'assistant', content: result.answer }
        );
        
        return {
          answer: result.answer,
          history: chatHistory
        };
      } else {
        console.error(`查询失败: ${result.message}`);
        return { answer: null, history: chatHistory };
      }
    } catch (error) {
      console.error('AI查询出错:', error);
      return { answer: null, history: chatHistory };
    }
  }
  ```
- 使用位置: 终端日志AI分析功能
- 备注: 
  - 需要在Web设置中配置有效的DeepSeek API密钥
  - chat_history参数用于支持连续对话，保留上下文
  - 支持的模型包括：`deepseek-chat`、`deepseek-coder`等
