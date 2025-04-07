# MCDReforged 插件库数据格式说明

`everything_slim.json` 是MCDReforged的插件库索引文件，包含了所有插件的元数据、发布信息和仓库数据。本文档将详细说明该文件的格式结构以及如何从中获取特定插件的信息。

从[https://api.mcdreforged.com/catalogue/everything_slim.json.xz](https://api.mcdreforged.com/catalogue/everything_slim.json.xz)获取`everything_slim.json`的压缩文件`everything_slim.json.xz`（需要解压提取`everything_slim.json`）。

## 文件结构

`everything_slim.json` 是一个JSON格式的文件，其顶层结构如下：

```json
{
    "timestamp": 1743983570,          // 更新时间戳
    "authors": {                      // 作者信息
        "amount": 91,                 // 作者总数
        "authors": { ... }            // 作者详细信息
    },
    "plugins": {                      // 插件列表
        "plugin_id1": { ... },
        "plugin_id2": { ... },
        // 更多插件...
    }
}
```

### authors (作者信息)

```json
"authors": {
    "作者一": {
        "name": "作者一",                   // 作者名称
        "link": "https://github.com/作者一" // 作者链接
    },
    // 更多作者...
}
```

## 插件信息结构

每个插件的信息结构包含以下几个主要部分：

```json
"plugin_id": {
    "meta": { ... },           // 插件元数据
    "plugin": { ... },         // 插件信息
    "release": { ... },        // 发布信息
    "repository": { ... }      // 仓库信息
}
```

### meta (元数据)

```json
"meta": {
    "schema_version": 4,              // 元数据结构版本
    "id": "plugin_id",                // 插件ID
    "name": "PluginName",             // 插件名称
    "version": "1.0.0",               // 版本号
    "link": "https://...",            // 项目链接
    "authors": ["作者1", "作者2"],    // 作者列表
    "dependencies": {                 // 依赖的其他插件
        "依赖插件1": ">=版本要求",
        "依赖插件2": ">=版本要求"
    },
    "requirements": [                 // Python库依赖
        "需要的库1>=版本",
        "需要的库2>=版本"
    ],
    "description": {                  // 多语言描述
        "en_us": "英文描述",
        "zh_cn": "中文描述"
    }
}
```

### plugin (插件信息)

```json
"plugin": {
    "schema_version": 1,              // 插件信息结构版本
    "id": "plugin_id",                // 插件ID
    "authors": ["作者1", "作者2"],    // 作者列表
    "repository": "https://...",      // 仓库URL
    "branch": "master",               // 仓库分支
    "related_path": "src/...",        // 相关路径
    "labels": ["tool", "management"], // 标签分类
    "introduction": { ... },          // 介绍（可选）
    "introduction_urls": { ... }      // 介绍URL（可选）
}
```

### release (发布信息)

```json
"release": {
    "schema_version": 8,              // 发布信息结构版本
    "id": "plugin_id",                // 插件ID
    "latest_version": "1.0.0",        // 最新版本
    "latest_version_index": 0,        // 最新版本索引
    "releases": [                     // 所有发布版本列表
        {
            "url": "https://...",                       // 发布页面URL
            "name": "版本名称",                         // 发布名称
            "tag_name": "v1.0.0",                       // 标签名
            "created_at": "2023-01-19T16:59:59Z",       // 创建时间
            "description": "描述",                      // 描述
            "prerelease": false,                        // 是否预发布
            "asset": {                                  // 资源文件
                "id": 92299861,
                "name": "Plugin-v1.0.0.mcdr",           // 文件名
                "size": 2518,                           // 大小(bytes)
                "download_count": 1412,                 // 下载次数
                "created_at": "2023-01-19T17:01:07Z",   // 创建时间
                "browser_download_url": "https://...",  // 下载URL
                "hash_md5": "哈希值",                   // MD5哈希
                "hash_sha256": "哈希值"                 // SHA256哈希
            },
            "meta": { ... }                             // 此版本的元数据
        },
        // 更多发布版本...
    ]
}
```

### repository (仓库信息)

```json
"repository": {
    "url": "https://...",             // 仓库URL
    "name": "仓库名",                 // 仓库名
    "full_name": "用户名/仓库名",     // 完整仓库名
    "html_url": "https://...",        // HTML页面URL
    "description": "描述",            // 仓库描述
    "archived": false,                // 是否已归档
    "stargazers_count": 96,           // star数量
    "watchers_count": 96,             // 关注者数量
    "forks_count": 54,                // fork数量
    "readme": null,                   // 自述文件内容(通常为null)
    "readme_url": "https://...",      // 自述文件URL
    "license": {                      // 许可证信息
        "key": "gpl-3.0",                               // 许可证名
        "name": "GNU General Public License v3.0",      // 许可证名称
        "spdx_id": "GPL-3.0",                           // 许可证ID
        "url": "https://..."                            // 许可证URL
    }
}
```

## 解析方法

以下是在Python中获取指定插件信息的示例代码：

```python
import json

# 读取everything_slim.json文件
def load_plugin_data(file_path='everything_slim.json'):
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

# 获取特定插件的信息
def get_plugin_info(plugin_id, data=None):
    if data is None:
        data = load_plugin_data()
    
    if plugin_id in data['plugins']:
        return data['plugins'][plugin_id]
    return None

# 获取插件的特定部分信息
def get_plugin_specific_info(plugin_id, info_type, data=None):
    """
    获取插件的特定部分信息
    
    参数:
    - plugin_id: 插件ID
    - info_type: 信息类型，如'meta', 'plugin', 'release', 'repository'
    - data: 可选，已加载的数据
    
    返回:
    - 指定类型的插件信息，如果不存在则返回None
    """
    plugin_info = get_plugin_info(plugin_id, data)
    if plugin_info and info_type in plugin_info:
        return plugin_info[info_type]
    return None

# 获取插件的最新版本信息
def get_plugin_latest_version(plugin_id, data=None):
    release_info = get_plugin_specific_info(plugin_id, 'release', data)
    if release_info:
        latest_idx = release_info.get('latest_version_index', 0)
        if 'releases' in release_info and len(release_info['releases']) > latest_idx:
            return release_info['releases'][latest_idx]
    return None

# 获取插件的下载URL
def get_plugin_download_url(plugin_id, data=None):
    latest_version = get_plugin_latest_version(plugin_id, data)
    if latest_version and 'asset' in latest_version:
        return latest_version['asset'].get('browser_download_url')
    return None

# 获取所有可用插件的ID列表
def get_all_plugin_ids(data=None):
    if data is None:
        data = load_plugin_data()
    return list(data['plugins'].keys())

# 搜索插件（按名称或描述）
def search_plugins(keyword, data=None):
    if data is None:
        data = load_plugin_data()
    
    results = []
    keyword = keyword.lower()
    
    for plugin_id, plugin_info in data['plugins'].items():
        meta = plugin_info.get('meta', {})
        
        # 检查ID和名称
        if keyword in plugin_id.lower() or keyword in meta.get('name', '').lower():
            results.append(plugin_id)
            continue
            
        # 检查描述
        description = meta.get('description', {})
        for lang, desc in description.items():
            if keyword in desc.lower():
                results.append(plugin_id)
                break
                
    return results
```

## 使用示例

```python
# 加载数据
data = load_plugin_data()

# 获取zip_backup插件的基本信息
zip_backup_info = get_plugin_info('zip_backup', data)

# 获取zip_backup插件的元数据
zip_backup_meta = get_plugin_specific_info('zip_backup', 'meta', data)
print(f"插件名称: {zip_backup_meta['name']}")
print(f"版本: {zip_backup_meta['version']}")
print(f"作者: {', '.join(zip_backup_meta['authors'])}")

# 获取下载链接
download_url = get_plugin_download_url('zip_backup', data)
print(f"下载链接: {download_url}")

# 搜索包含"backup"关键词的插件
backup_plugins = search_plugins('backup', data)
print(f"找到 {len(backup_plugins)} 个与'backup'相关的插件: {', '.join(backup_plugins)}")
```

使用上述代码，您可以轻松地从`everything_slim.json`文件中获取指定插件的详细信息、最新版本和下载链接，以及进行插件搜索等操作。
