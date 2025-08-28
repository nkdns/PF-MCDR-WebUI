# WebUI 事件系统文档

## 概述

WebUI 提供了两个事件系统，一个是用于其他插件向WebUI发送消息，另一个是用于WebUI向其他插件发送消息。

本功能尚处于测试开发阶段，可能会随时更新，请注意本文档的更新情况。

## 可用事件

### 1. WebUI 聊天消息事件

**事件名称**: `webui.chat_message_sent`

**触发时机**: 当用户通过 WebUI 聊天页面发送消息到游戏时

**事件数据**:

```python
# 事件监听器接收的参数顺序：
# args[0] = source          # 事件来源，固定为 "webui"
# args[1] = player_id       # 发送消息的玩家ID
# args[2] = player_uuid     # 玩家的UUID（如果可用）
# args[3] = message         # 实际发送的消息内容
# args[4] = session_id      # WebUI会话ID
# args[5] = timestamp       # 事件发生时间（Unix时间戳，整数）
# args[6] = tellraw_command # 实际执行的tellraw命令
```

### 2. WebUI 消息接收事件

**事件名称**: `webui.message_received`

**触发时机**: 当其他插件通过WebUI接口发送消息时

**事件数据**:

```python
# 事件监听器接收的参数顺序：
# args[0] = source          # 消息来源（插件名称等）
# args[1] = message         # 消息内容
# args[2] = message_type    # 消息类型（info, warning, error, success等）
# args[3] = target_players  # 目标玩家列表
# args[4] = metadata        # 额外的元数据
# args[5] = timestamp       # 事件发生时间（Unix时间戳，整数）
# args[6] = message_id      # 消息唯一ID
```

## 发送消息到WebUI

### 1. 发送消息到WebUI

**重要说明**: 推荐使用插件管理器方式调用，这样可以避免循环依赖问题，并且更符合MCDR的插件架构设计。

其他插件可以使用以下方式发送消息到WebUI：

#### 通过插件管理器调用

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

### 2. 函数参数说明

**`send_message_to_webui` 函数参数**:

- `server_interface`: MCDR服务器接口
- `source`: 消息来源（插件名称等）
- `message`: 消息内容
- `message_type`: 消息类型（info, warning, error, success等）
- `target_players`: 目标玩家列表，None表示所有玩家
- `metadata`: 额外的元数据

**返回值**: `bool` - 是否成功发送

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

## 事件处理最佳实践

### 1. 错误处理

始终在事件处理函数中添加适当的错误处理，避免因为错误而中断其他插件的处理。

### 2. 性能考虑

事件处理应该是轻量级的，避免长时间阻塞。对于耗时操作，考虑异步处理。

### 3. 数据验证

在处理事件数据前进行验证，确保参数数量和类型正确。

## 注意事项

1. **事件顺序**: 事件按照注册顺序依次处理，但不保证严格的执行顺序
2. **事件数据**: 事件数据是只读的，不要修改原始数据
3. **插件依赖**: 确保你的插件在 WebUI 插件加载后再加载
4. **错误隔离**: 一个插件的错误不会影响其他插件的正常处理
5. **时间戳格式**: 时间戳使用Unix时间戳格式（整数），表示UTC时间