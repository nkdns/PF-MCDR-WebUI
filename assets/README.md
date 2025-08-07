# MCDR WebUI 演示网站

这是一个无后端的MCDR WebUI演示网站，用于展示WebUI的功能和界面。

## 功能特性

- ✅ 登录/退出登录功能
- ✅ 主题切换（深色/浅色模式）
- ✅ 响应式设计
- ✅ 侧边栏导航
- 🔄 服务器状态模拟
- 🔄 插件管理模拟
- 🔄 配置管理模拟

## 文件结构

```
assets/
├── data/                    # 模拟数据文件
│   ├── login.json          # 登录响应数据
│   ├── checkLogin.json     # 检查登录状态数据
│   └── logout.json         # 退出登录响应数据
├── js/                     # JavaScript文件
│   ├── main.js            # 主要功能脚本
│   ├── index.js           # 主页脚本
│   └── ...                # 其他页面脚本
├── css/                    # 样式文件
├── templates/              # 模板文件
├── index.html             # 主页
├── login.html             # 登录页面
├── demo.html              # 演示页面
└── README.md              # 说明文档
```

## 使用方法

1. **直接打开HTML文件**
   - 在浏览器中打开 `test-mcdr.html` 进行MCDR配置测试
- 在浏览器中打开 `test-mc.html` 进行MC配置测试
- 在浏览器中打开 `test-terminal.html` 进行终端页面测试
- 在浏览器中打开 `test-cq.html` 进行CQ-QQ-API配置测试
- 在浏览器中打开 `test-gugubot.html` 进行GUGUBot配置测试
   - 打开 `login.html` 进行登录
   - 打开 `index.html` 查看主页

2. **使用本地服务器**（推荐）
   ```bash
   # 使用Python
   python -m http.server 8000
   
   # 使用Node.js
   npx http-server
   
   # 使用PHP
   php -S localhost:8000
   ```

3. **访问地址**
   - 登录页面: `http://localhost:8000/login.html`
   - 主页: `http://localhost:8000/index.html`
   - MCDR配置页面: `http://localhost:8000/templates/mcdr.html`
   - MC配置页面: `http://localhost:8000/templates/mc.html`
   - 终端页面: `http://localhost:8000/templates/terminal.html`
   - CQ-QQ-API配置页面: `http://localhost:8000/templates/cq.html`
   - GUGUBot配置页面: `http://localhost:8000/templates/gugubot.html`

## 登录功能

### 账号登录
- 用户名: 任意输入
- 密码: 任意输入
- 点击登录按钮即可成功登录

### 临时码登录
- 临时码: 任意输入
- 点击登录按钮即可成功登录

### 退出登录
- 在侧边栏底部点击"退出登录"按钮
- 或使用演示页面的退出登录功能

## 数据模拟

所有API请求都指向 `data/` 文件夹中的JSON文件：

- `data/login.json` - 模拟登录API响应
- `data/checkLogin.json` - 模拟检查登录状态API响应
- `data/logout.json` - 模拟退出登录API响应
- `data/server_status.json` - 模拟服务器状态API响应
- `data/pip_packages.json` - 模拟pip包列表API响应
- `data/mcdr_config.yml.json` - 模拟MCDR配置文件数据
- `data/mcdr_permission.yml.json` - 模拟MCDR权限配置文件数据
- `data/server.properties.json` - 模拟Minecraft服务器配置文件数据
- `custom/server_lang.json` - 模拟服务器语言配置文件数据
- `data/server_logs.json` - 模拟服务器日志数据
- `data/new_logs.json` - 模拟新日志数据
- `data/command_suggestions.json` - 模拟命令补全建议
- `data/send_command.json` - 模拟命令发送响应
- `data/get_web_config.json` - 模拟Web配置数据
- `data/deepseek.json` - 模拟AI询问响应
- `data/cq_qq_api/config.json` - 模拟CQ-QQ-API配置数据
- `data/cq_qq_api/config_lang.json` - 模拟CQ-QQ-API配置翻译数据
- `data/GUGUBot/config.json` - 模拟GUGUBot主配置文件
- `data/GUGUBot/config_lang.json` - 模拟GUGUBot配置翻译数据
- `data/GUGUBot/GUGUbot.json` - 模拟GUGUBot QQ-游戏ID绑定
- `data/GUGUBot/help_msg.json` - 模拟GUGUBot帮助信息
- `data/GUGUBot/key_word.json` - 模拟GUGUBot QQ关键词
- `data/GUGUBot/key_word_ingame.json` - 模拟GUGUBot游戏内关键词
- `data/GUGUBot/ban_word.json` - 模拟GUGUBot违禁词
- `data/GUGUBot/shenheman.json` - 模拟GUGUBot审核员
- `data/GUGUBot/start_commands.json` - 模拟GUGUBot开服指令
- `data/GUGUBot/uuid_qqid.json` - 模拟GUGUBot UUID-QQID映射

## 本地存储

登录状态使用浏览器的localStorage存储：

- `isLoggedIn` - 登录状态（true/false）
- `username` - 用户名
- `darkMode` - 主题模式（true/false）