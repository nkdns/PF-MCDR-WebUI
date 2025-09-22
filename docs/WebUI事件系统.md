# WebUI 事件系统文档

## 概述

WebUI 提供了事件系统，用于其他插件监听WebUI的消息发送活动。

本功能尚处于测试开发阶段，可能会随时更新，请注意本文档的更新情况。

## 可用事件

### WebUI 聊天消息事件

**事件名称**: `webui.chat_message_sent`

**触发时机**: 
- 当用户通过 WebUI 聊天页面发送消息到游戏时
- 当其他插件调用 `send_message_to_webui` 函数发送消息时

**事件数据**:

```python
# 事件监听器接收的参数顺序：
# args[0] = source          # 事件来源（"webui" 或插件名称）
# args[1] = player_id       # 发送消息的玩家ID（WebUI消息）或插件名称（插件消息）
# args[2] = player_uuid     # 玩家的UUID（WebUI消息）或插件标识（插件消息）
# args[3] = message         # 实际发送的消息内容
# args[4] = session_id      # WebUI会话ID（WebUI消息）或插件会话ID（插件消息）
# args[5] = timestamp       # 事件发生时间（Unix时间戳，整数）
# 注意：WebUI发送的聊天消息现在会自动保存为RText格式，以便前端正确渲染
```

**注意**: 
- WebUI用户发送的消息会同步到游戏中（如果有玩家在线）
- 插件发送的消息也会同步到游戏中（如果有玩家在线）
- 所有消息都会记录到聊天日志中，可以在WebUI的聊天界面中查看

## 发送消息到WebUI

其他插件可以使用以下方式发送消息到WebUI：

**重要说明**: 推荐使用插件管理器方式调用，这样可以避免循环依赖问题，并且更符合MCDR的插件架构设计。

### 通过插件管理器调用

```python
from mcdreforged.api.all import PluginServerInterface, LiteralEvent

# 获取WebUI插件实例
webui_plugin = server.get_plugin_instance("guguwebui")
if webui_plugin and hasattr(webui_plugin, 'send_message_to_webui'):
    webui_plugin.send_message_to_webui(
        server_interface=server,
        source="your_plugin_name",
        message="消息内容",
        message_type="info"
    )
```

### 发送RText消息到WebUI

```python
from mcdreforged.api.all import PluginServerInterface, RText, RTextList, RColor, RStyle

# 获取WebUI插件实例
webui_plugin = server.get_plugin_instance("guguwebui")
if webui_plugin and hasattr(webui_plugin, 'send_message_to_webui'):
    # 方式1：发送JSON格式的RText消息
    rtext_data = {
        "text": "这是一条",
        "color": "red",
        "bold": True,
        "extra": [
            {"text": "彩色", "color": "blue"},
            {"text": "消息", "color": "green", "italic": True}
        ]
    }
    webui_plugin.send_message_to_webui(
        server_interface=server,
        source="your_plugin_name",
        message=rtext_data,
        message_type="info",
        is_rtext=True
    )
    
    # 方式2：发送MCDR RText对象消息
    mcdr_rtext = RTextList(
        RText("这是", color=RColor.red, styles=RStyle.bold),
        RText("一条", color=RColor.blue),
        RText("MCDR", color=RColor.green, styles=RStyle.italic),
        RText("RText", color=RColor.gold, styles=RStyle.underlined),
        RText("消息", color=RColor.aqua)
    )
    webui_plugin.send_message_to_webui(
        server_interface=server,
        source="your_plugin_name",
        message=mcdr_rtext,
        message_type="info",
        is_rtext=True
    )
```

### 函数参数说明

**`send_message_to_webui` 函数参数**:

- `server_interface`: MCDR服务器接口
- `source`: 消息来源（插件名称等）
- `message`: 消息内容（字符串、RText对象或RText数据）
- `message_type`: 消息类型（info, warning, error, success）
- `target_players`: 目标玩家列表，None表示所有玩家
- `metadata`: 额外的元数据
- `is_rtext`: 是否为RText格式，如果为True，message应该是RText对象或JSON字符串

**返回值**: `bool` - 是否成功发送

**重要说明**: 
- 现在使用统一的 `send_message_to_webui` 函数发送所有类型的消息
- 通过 `is_rtext=True` 参数指定消息为RText格式
- 支持JSON格式和MCDR RText对象格式
- 消息会同步到游戏中（如果有玩家在线）
- 插件发送消息时会触发 `webui.chat_message_sent` 事件

### RText格式支持

WebUI支持两种RText格式：

#### JSON格式RText
```python
# 单个组件
rtext_data = {
    "text": "消息内容",
    "color": "red",
    "bold": True,
    "italic": True,
    "underlined": True,
    "clickEvent": {
        "action": "run_command",
        "value": "/say Hello!"
    },
    "hoverEvent": {
        "action": "show_text",
        "value": "悬停提示"
    }
}

# 复合组件
rtext_data = [
    {"text": "欢迎", "color": "green", "bold": True},
    {"text": "使用", "color": "blue"},
    {"text": "RText", "color": "gold", "italic": True, "underlined": True}
]
```

#### MCDR RText对象格式
```python
from mcdreforged.api.all import RText, RTextList, RColor, RStyle, RAction

# 单个RText对象
rtext = RText("消息内容", color=RColor.red, styles=[RStyle.bold, RStyle.italic])
rtext.c(RAction.run_command, "/say Hello!")
rtext.h("悬停提示")

# 复合RText对象
rtext_list = RTextList(
    RText("欢迎", color=RColor.green, styles=RStyle.bold),
    RText("使用", color=RColor.blue),
    RText("RText", color=RColor.gold, styles=[RStyle.italic, RStyle.underlined])
)
```

## 注册事件监听器

在你的插件中注册事件监听器：

```python
from mcdreforged.api.all import LiteralEvent

def on_load(server, old):
    # 注册WebUI聊天消息事件监听器
    server.register_event_listener(
        LiteralEvent("webui.chat_message_sent"), 
        on_webui_chat_message
    )
```

## 注意事项

1. **事件顺序**: 事件按照注册顺序依次处理，但不保证严格的执行顺序
2. **事件数据**: 事件数据是只读的
3. **插件依赖**: 确保你的插件在 WebUI 插件加载后再加载，或在 WebUI 未加载时不处理事件
4. **错误隔离**: 一个插件的错误不会影响其他插件的正常处理
5. **时间戳格式**: 时间戳使用Unix时间戳格式（整数），表示UTC时间
6. **RText支持**: 插件发送的RText消息会同步到游戏中，支持所有Minecraft文本组件功能
7. **性能优化**: 插件发送的消息不会进行网络请求获取UUID，使用插件标识作为UUID
8. **事件触发**: 插件调用 `send_message_to_webui` 时也会触发 `webui.chat_message_sent` 事件