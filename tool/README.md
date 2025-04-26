# MCDR 工具插件文件夹

此文件夹包含用于增强 MCDR (Minecraft Dedicated Reforged) 服务器功能的工具插件。

## 插件列表

### Pip安装器 (pip_installer.py)

一个允许在 MCDR 环境中管理 Python 包的插件。

#### 功能
通过简单的MCDR命令管理 Python 包，可以解决无法使用CMD终端的问题。

#### 命令
- `!!pip install <包名>` - 安装指定的 Python 包
- `!!pip uninstall <包名>` - 卸载指定的 Python 包
- `!!pip list` - 列出已安装的 Python 包

#### 权限要求
- 安装包: 权限等级 4
- 卸载包: 权限等级 4
- 列出包: 权限等级 4

#### 使用方法
1. 安装包: `!!pip install requests`
2. 卸载包: `!!pip uninstall requests`
3. 查看已安装的包: `!!pip list`

#### 注意事项
- 用完请删除，以免影造成风险
