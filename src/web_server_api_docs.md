# Web Server API 文档

## 接口列表

### 1. 登录相关接口

#### 1.1 根路径重定向
- 路径: `/`
- 方法: GET
- 描述: 重定向到登录页面
- 调用示例:
  ```bash
  curl -X GET http://localhost:8000/
  ```

#### 1.2 获取登录页面
- 路径: `/login`
- 方法: GET  
- 描述: 返回登录页面HTML
- 调用示例:
  ```bash
  curl -X GET http://localhost:8000/login
  ```

#### 1.3 提交登录请求
- 路径: `/login`
- 方法: POST
- 参数:
  - account: 账号
  - password: 密码
  - temp_code: 临时登录码
  - remember: 是否记住登录状态
- 描述: 处理登录请求，返回登录结果
- 调用示例:
  ```bash
  curl -X POST http://localhost:8000/login \
  -d "account=admin&password=123456"
  ```

#### 1.4 登出
- 路径: `/logout`
- 方法: GET
- 描述: 清除登录状态，重定向到登录页面
- 调用示例:
  ```bash
  curl -X GET http://localhost:8000/logout
  ```

### 2. 页面相关接口

#### 2.1 首页
- 路径: `/index`
- 方法: GET
- 描述: 返回首页HTML
- 调用示例:
  ```bash
  curl -X GET http://localhost:8000/index
  ```

#### 2.2 主页
- 路径: `/home`
- 方法: GET
- 描述: 返回后台主页HTML
- 调用示例:
  ```bash
  curl -X GET http://localhost:8000/home
  ```

#### 2.3 其他页面
- 路径: `/gugubot`, `/cq`, `/mc`, `/mcdr`, `/plugins`, `/fabric`, `/about`
- 方法: GET
- 描述: 返回对应功能的页面HTML
- 调用示例:
  ```bash
  curl -X GET http://localhost:8000/about
  ```

### 3. API接口

#### 3.1 检查登录状态
- 路径: `/api/checkLogin`
- 方法: GET
- 描述: 检查当前用户登录状态
- 调用示例:
  ```bash
  curl -X GET http://localhost:8000/api/checkLogin
  ```

#### 3.2 获取插件信息
- 路径: `/api/plugins`
- 方法: GET
- 参数:
  - detail: 是否获取详细信息
- 描述: 获取所有插件信息
- 调用示例:
  ```bash
  curl -X GET "http://localhost:8000/api/plugins?detail=true"
  ```

#### 3.3 安装插件
- 路径: `/api/install_plugin`
- 方法: POST
- 参数:
  - plugin_id: 插件ID
- 描述: 安装指定插件
- 调用示例:
  ```bash
  curl -X POST http://localhost:8000/api/install_plugin \
  -H "Content-Type: application/json" \
  -d '{"plugin_id": "example_plugin"}'
  ```

#### 3.4 加载/卸载插件
- 路径: `/api/toggle_plugin`
- 方法: POST
- 参数:
  - plugin_id: 插件ID
  - status: 目标状态（true/false）
- 描述: 切换插件加载状态
- 调用示例:
  ```bash
  curl -X POST http://localhost:8000/api/toggle_plugin \
  -H "Content-Type: application/json" \
  -d '{"plugin_id": "example_plugin", "status": true}'
  ```

#### 3.5 获取服务器状态
- 路径: `/api/get_server_status`
- 方法: GET
- 描述: 获取Minecraft服务器状态信息
- 调用示例:
  ```bash
  curl -X GET http://localhost:8000/api/get_server_status
  ```

### 4. 配置文件相关接口

#### 4.1 获取配置文件列表
- 路径: `/api/list_config_files`
- 方法: GET
- 参数:
  - plugin_id: 插件ID
- 描述: 获取指定插件的配置文件列表
- 调用示例:
  ```bash
  curl -X GET "http://localhost:8000/api/list_config_files?plugin_id=example_plugin"
  ```

#### 4.2 加载配置文件
- 路径: `/api/load_config`
- 方法: GET
- 参数:
  - path: 配置文件路径
  - translation: 是否需要翻译
- 描述: 加载指定配置文件内容
- 调用示例:
  ```bash
  curl -X GET "http://localhost:8000/api/load_config?path=config.json&translation=true"
  ```

#### 4.3 保存配置文件
- 路径: `/api/save_config`
- 方法: POST
- 参数:
  - file_path: 文件路径
  - config_data: 配置数据
- 描述: 保存配置文件
- 调用示例:
  ```bash
  curl -X POST http://localhost:8000/api/save_config \
  -H "Content-Type: application/json" \
  -d '{"file_path": "config.json", "config_data": {"key": "value"}}'
  ```

### 5. 文件操作接口

#### 5.1 加载文件
- 路径: `/api/load_file`
- 方法: GET
- 参数:
  - file: 文件类型（css/js）
- 描述: 加载overall.css或overall.js文件内容
- 调用示例:
  ```bash
  curl -X GET "http://localhost:8000/api/load_file?file=css"
  ```

#### 5.2 保存文件
- 路径: `/api/save_file`
- 方法: POST
- 参数:
  - action: 文件类型（css/js）
  - content: 文件内容
- 描述: 保存overall.css或overall.js文件
- 调用示例:
  ```bash
  curl -X POST http://localhost:8000/api/save_file \
  -H "Content-Type: application/json" \
  -d '{"action": "css", "content": "body {background: red;}"}'
  ```

### 6. Web配置接口

#### 6.1 获取Web配置
- 路径: `/api/get_web_config`
- 方法: GET
- 描述: 获取Web界面配置信息
- 调用示例:
  ```bash
  curl -X GET http://localhost:8000/api/get_web_config
  ```

#### 6.2 保存Web配置
- 路径: `/api/save_web_config`
- 方法: POST
- 参数:
  - action: 操作类型
  - port: 端口号
  - host: 主机地址
  - superaccount: 超级管理员账号
- 描述: 保存Web界面配置
- 调用示例:
  ```bash
  curl -X POST http://localhost:8000/api/save_web_config \
  -H "Content-Type: application/json" \
  -d '{"action": "config", "port": 8000, "host": "localhost"}'
