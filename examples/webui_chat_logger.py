# WebUI 聊天消息记录器示例插件
# 文件名: webui_chat_logger.py
# 功能: 监听来自WebUI的聊天消息并记录到文件

from mcdreforged.api.all import *
from mcdreforged.api.event import LiteralEvent
import json
import os
from datetime import datetime
from pathlib import Path

class WebUIChatLogger:
    def __init__(self, server):
        self.server = server
        # 在插件目录下创建日志文件
        plugin_dir = Path(__file__).parent
        self.log_file = plugin_dir / "webui_chat_log.txt"
        
    def _handle_event(self, server, *args):
        """记录WebUI聊天消息到文件"""
        try:
            # 根据MCDR文档，dispatch_event会自动添加PluginServerInterface作为第一个参数
            # 然后才是我们传递的参数，所以args[0]应该是event_data
            if len(args) == 0:
                server.logger.warning("收到WebUI事件但没有事件数据")
                return
                
            # 从参数中提取事件数据
            if len(args) >= 7:
                # 现在WebUI直接传递值，参数顺序为：
                # args[0] = source, args[1] = player_id, args[2] = player_uuid, 
                # args[3] = message, args[4] = session_id, args[5] = timestamp, args[6] = tellraw_command
                event_data = {
                    "source": args[0],
                    "player_id": args[1],
                    "player_uuid": args[2],
                    "message": args[3],
                    "session_id": args[4],
                    "timestamp": args[5],
                    "tellraw_command": args[6]
                }
                server.logger.info("成功从事件参数中提取数据")
            else:
                server.logger.error(f"参数数量不足: {len(args)}，需要7个参数")
                return
            
            # 添加调试日志
            server.logger.info(f"处理的事件数据: {event_data}")
            
            timestamp = event_data.get("timestamp", "未知")
            player_id = event_data.get("player_id", "未知")
            message = event_data.get("message", "未知")
            player_uuid = event_data.get("player_uuid", "未知")
            session_id = event_data.get("session_id", "未知")
            
            # 格式化日志条目
            log_entry = f"[{timestamp}] {player_id}({player_uuid}) [会话:{session_id}]: {message}\n"
            
            # 写入日志文件
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(log_entry)
                
            server.logger.info(f"已记录WebUI消息: {player_id}: {message}")
            
            # 可选：同时发送到游戏内
            server.execute(f"tellraw @a {{\"text\":\"[WebUI日志] {player_id}: {message}\",\"color\":\"gray\"}}")
            
        except Exception as e:
            server.logger.error(f"记录WebUI消息失败: {e}")
            import traceback
            server.logger.error(f"错误详情: {traceback.format_exc()}")
    
    def get_stats(self):
        """获取统计信息"""
        try:
            if not self.log_file.exists():
                return {"total_messages": 0, "file_size": 0}
            
            with open(self.log_file, "r", encoding="utf-8") as f:
                lines = f.readlines()
            
            return {
                "total_messages": len(lines),
                "file_size": self.log_file.stat().st_size
            }
        except Exception as e:
            # 这里不能使用self.server，因为可能还没有初始化
            return {"total_messages": 0, "file_size": 0}

def on_webui_chat_message(server, *args):
    """处理WebUI聊天消息事件的独立函数"""
    try:
        # 调试：打印所有参数
        server.logger.info(f"收到WebUI事件，参数数量: {len(args)}")
        server.logger.info(f"参数内容: {args}")
        
        # 使用全局的chat_logger实例
        if chat_logger:
            chat_logger._handle_event(server, *args)
        else:
            server.logger.error("chat_logger实例不存在")
            
    except Exception as e:
        server.logger.error(f"处理WebUI聊天消息事件失败: {e}")
        import traceback
        server.logger.error(f"错误详情: {traceback.format_exc()}")

def on_load(server: PluginServerInterface, old):
    global chat_logger
    
    # 创建日志记录器实例
    chat_logger = WebUIChatLogger(server)
    
    # 注册事件监听器 - 使用独立函数而不是类方法
    server.register_event_listener(
        LiteralEvent("webui.chat_message_sent"), 
        on_webui_chat_message
    )
    
    # 测试：注册一个通用事件监听器来调试
    server.register_event_listener(
        LiteralEvent("mcdreforged.plugin_manager.plugin_loaded"),
        lambda s, plugin_id: server.logger.info(f"插件加载事件: {plugin_id}")
    )
    
    # 注册命令
    server.register_command(
        Literal("webui_logger")
        .requires(lambda src: src.has_permission_level(1))
        .runs(lambda src, ctx: show_stats(src, ctx))
    )
    
    server.logger.info("WebUI聊天消息记录器已启动")
    server.logger.info(f"日志文件路径: {chat_logger.log_file}")
    server.logger.info("已注册事件监听器: webui.chat_message_sent")

def on_unload(server):
    server.logger.info("WebUI聊天消息记录器已卸载")

def show_stats(src, ctx):
    """显示统计信息"""
    if not hasattr(src, 'server'):
        return
    
    stats = chat_logger.get_stats()
    src.reply(f"WebUI聊天记录统计:")
    src.reply(f"  总消息数: {stats['total_messages']}")
    src.reply(f"  文件大小: {stats['file_size']} 字节")
    src.reply(f"  日志文件: {chat_logger.log_file}")

# 全局变量
chat_logger = None
