import os
import struct
import datetime
import json
from typing import List, Dict, Optional
from pathlib import Path

class ChatLogger:
    """聊天消息记录器，将消息保存到二进制文件中"""
    
    def __init__(self, data_dir=None):
        if data_dir is None:
            data_dir = Path("guguwebui_static")
        self.data_dir = Path(data_dir)
        self.chat_messages_file = self.data_dir / "chat_messages.bin"
        self.chat_index_file = self.data_dir / "chat_index.json"
        
        # 确保数据目录存在
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # 初始化索引
        self._init_index()
        
        # 消息计数器
        self._message_counter = self._get_next_message_id()
    
    def _init_index(self):
        """初始化索引文件"""
        if not self.chat_index_file.exists():
            index = {
                "message_count": 0,
                "next_message_id": 1,
                "file_size": 0
            }
            self._write_index(index)
    
    def _read_index(self):
        """读取索引文件"""
        try:
            with open(self.chat_index_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            # 如果索引文件损坏，重新初始化
            self._init_index()
            return self._read_index()
    
    def _write_index(self, index):
        """写入索引文件"""
        with open(self.chat_index_file, 'w', encoding='utf-8') as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
    
    def _get_next_message_id(self):
        """获取下一个消息ID"""
        index = self._read_index()
        return index.get("next_message_id", 1)
    
    def _pack_message(self, message_id, player_id, message, timestamp):
        """打包消息数据为二进制格式
        
        消息格式: [消息ID(8字节)][时间戳(8字节)][玩家ID长度(4字节)][玩家ID][消息长度(4字节)][消息]
        """
        if not isinstance(player_id, str) or not isinstance(message, str):
            raise ValueError("player_id 和 message 必须是字符串")
        
        if not player_id.strip() or not message.strip():
            raise ValueError("player_id 和 message 不能为空")
        
        timestamp_bytes = struct.pack('Q', int(timestamp.timestamp() * 1000))  # 毫秒时间戳
        message_id_bytes = struct.pack('Q', message_id)  # 消息ID
        player_id_bytes = player_id.encode('utf-8')
        message_bytes = message.encode('utf-8')
        
        return (message_id_bytes + timestamp_bytes + 
                struct.pack('I', len(player_id_bytes)) + player_id_bytes + 
                struct.pack('I', len(message_bytes)) + message_bytes)
    
    def _unpack_message(self, data, offset):
        """从二进制数据中解包消息
        
        返回: (消息字典, 新的偏移量)
        """
        try:
            # 读取消息ID (8字节)
            if offset + 8 > len(data):
                return None, offset
            
            message_id = struct.unpack('Q', data[offset:offset+8])[0]
            offset += 8
            
            # 读取时间戳 (8字节)
            if offset + 8 > len(data):
                return None, offset
            
            timestamp_ms = struct.unpack('Q', data[offset:offset+8])[0]
            offset += 8
            
            # 读取玩家ID长度 (4字节)
            if offset + 4 > len(data):
                return None, offset
            
            player_id_len = struct.unpack('I', data[offset:offset+4])[0]
            offset += 4
            
            # 读取玩家ID
            if offset + player_id_len > len(data):
                return None, offset
            
            player_id = data[offset:offset+player_id_len].decode('utf-8')
            offset += player_id_len
            
            # 读取消息长度 (4字节)
            if offset + 4 > len(data):
                return None, offset
            
            message_len = struct.unpack('I', data[offset:offset+4])[0]
            offset += 4
            
            # 读取消息内容
            if offset + message_len > len(data):
                return None, offset
            
            message = data[offset:offset+message_len].decode('utf-8')
            offset += message_len
            
            # 转换时间戳
            timestamp = datetime.datetime.fromtimestamp(timestamp_ms / 1000, tz=datetime.timezone.utc)
            
            return {
                'id': message_id,
                'player_id': player_id,
                'message': message,
                'timestamp': timestamp,
                'timestamp_str': timestamp.strftime('%Y-%m-%d %H:%M:%S')
            }, offset
            
        except (struct.error, UnicodeDecodeError, ValueError) as e:
            print(f"解析消息失败: {e}")
            return None, offset
    
    def add_message(self, player_id, message, timestamp=None):
        """添加新消息"""
        if not isinstance(player_id, str) or not isinstance(message, str):
            raise ValueError("player_id 和 message 必须是字符串")
        
        if not player_id.strip() or not message.strip():
            raise ValueError("player_id 和 message 不能为空")
        
        if timestamp is None:
            timestamp = datetime.datetime.now(datetime.timezone.utc)
        
        # 获取下一个消息ID
        message_id = self._get_next_message_id()
        
        # 打包消息
        packed_message = self._pack_message(message_id, player_id, message, timestamp)
        
        # 追加到文件
        with open(self.chat_messages_file, 'ab') as f:
            f.write(packed_message)
        
        # 更新索引
        index = self._read_index()
        index["message_count"] += 1
        index["next_message_id"] = message_id + 1
        index["file_size"] = self.chat_messages_file.stat().st_size
        self._write_index(index)
        
        return message_id

    def get_messages(self, limit=50, offset=0, after_id=None, before_id=None):
        """获取消息

        Args:
            limit: 限制返回的消息数量
            offset: 偏移量（用于向后兼容）
            after_id: 只返回ID大于此值的消息（新消息）
            before_id: 只返回ID小于此值的消息（历史消息）
        """
        if not self.chat_messages_file.exists():
            return []

        messages = []
        max_attempts = 1000  # 防止无限循环

        try:
            with open(self.chat_messages_file, 'rb') as f:
                data = f.read()

            if not data:
                return []

            # 如果指定了after_id，找到对应的位置
            if after_id is not None:
                offset_pos = 0
                attempt_count = 0
                while offset_pos < len(data) and attempt_count < max_attempts:
                    message, new_offset = self._unpack_message(data, offset_pos)
                    if message is None:
                        break
                    if message['id'] > after_id:
                        break
                    offset_pos = new_offset
                    attempt_count += 1

                # 从找到的位置开始读取消息
                attempt_count = 0
                while offset_pos < len(data) and len(messages) < limit and attempt_count < max_attempts:
                    message, offset_pos = self._unpack_message(data, offset_pos)
                    if message is None:
                        break

                    # 确保返回的数据可以被JSON序列化
                    serializable_message = {
                        'id': message['id'],
                        'player_id': message['player_id'],
                        'message': message['message'],
                        'timestamp': int(message['timestamp'].timestamp()),  # Unix时间戳（秒）
                        'timestamp_ms': int(message['timestamp'].timestamp() * 1000),  # 毫秒时间戳
                        'timestamp_str': message['timestamp_str']  # 可读的时间字符串
                    }
                    messages.append(serializable_message)
                    attempt_count += 1

            # 如果指定了before_id，获取指定ID之前的历史消息
            elif before_id is not None:
                all_messages = []
                offset_pos = 0
                attempt_count = 0

                # 先读取所有消息
                while offset_pos < len(data) and attempt_count < max_attempts:
                    message, new_offset = self._unpack_message(data, offset_pos)
                    if message is None:
                        break

                    # 确保返回的数据可以被JSON序列化
                    serializable_message = {
                        'id': message['id'],
                        'player_id': message['player_id'],
                        'message': message['message'],
                        'timestamp': int(message['timestamp'].timestamp()),  # Unix时间戳（秒）
                        'timestamp_ms': int(message['timestamp'].timestamp() * 1000),  # 毫秒时间戳
                        'timestamp_str': message['timestamp_str']  # 可读的时间字符串
                    }
                    all_messages.append(serializable_message)
                    offset_pos = new_offset
                    attempt_count += 1

                # 筛选出ID小于before_id的消息，按时间排序（最新的在前），然后取前limit条
                historical_messages = [msg for msg in all_messages if msg['id'] < before_id]
                historical_messages.sort(key=lambda x: x['timestamp'], reverse=True)
                messages = historical_messages[:limit]

            # 如果没有指定after_id（首次加载或历史消息）
            else:
                # 当offset=0时，获取最近的消息（从文件末尾开始）
                if offset == 0:
                    # 从文件末尾开始向前读取
                    all_messages = []
                    offset_pos = 0
                    attempt_count = 0

                    # 先读取所有消息
                    while offset_pos < len(data) and attempt_count < max_attempts:
                        message, new_offset = self._unpack_message(data, offset_pos)
                        if message is None:
                            break

                        # 确保返回的数据可以被JSON序列化
                        serializable_message = {
                            'id': message['id'],
                            'player_id': message['player_id'],
                            'message': message['message'],
                            'timestamp': int(message['timestamp'].timestamp()),  # Unix时间戳（秒）
                            'timestamp_ms': int(message['timestamp'].timestamp() * 1000),  # 毫秒时间戳
                            'timestamp_str': message['timestamp_str']  # 可读的时间字符串
                        }
                        all_messages.append(serializable_message)
                        offset_pos = new_offset
                        attempt_count += 1

                    # 按时间排序（最新的在前），然后取前limit条
                    all_messages.sort(key=lambda x: x['timestamp'], reverse=True)
                    messages = all_messages[:limit]

                # 当offset>0时，使用传统的offset方式（用于加载更多历史消息）
                else:
                    offset_pos = 0
                    attempt_count = 0
                    messages_read = 0

                    # 读取消息，直到达到offset
                    while offset_pos < len(data) and messages_read < (offset + limit) and attempt_count < max_attempts:
                        message, offset_pos = self._unpack_message(data, offset_pos)
                        if message is None:
                            break

                        messages_read += 1

                        # 只保留offset之后的消息
                        if messages_read > offset:
                            # 确保返回的数据可以被JSON序列化
                            serializable_message = {
                                'id': message['id'],
                                'player_id': message['player_id'],
                                'message': message['message'],
                                'timestamp': int(message['timestamp'].timestamp()),  # Unix时间戳（秒）
                                'timestamp_ms': int(message['timestamp'].timestamp() * 1000),  # 毫秒时间戳
                                'timestamp_str': message['timestamp_str']  # 可读的时间字符串
                            }
                            messages.append(serializable_message)

                        attempt_count += 1

                    # 按时间顺序排序（最新的在前）
                    messages.sort(key=lambda x: x['timestamp'], reverse=True)

        except Exception as e:
            print(f"读取消息失败: {e}")
            return []

        return messages
    
    def get_new_messages(self, after_id):
        """获取指定ID之后的新消息"""
        return self.get_messages(after_id=after_id, limit=100)
    
    def get_message_count(self):
        """获取消息总数"""
        index = self._read_index()
        return index.get("message_count", 0)
    
    def get_last_message_id(self):
        """获取最后一条消息的ID"""
        index = self._read_index()
        return index.get("next_message_id", 1) - 1
    
    def clear_messages(self):
        """清空所有消息"""
        if self.chat_messages_file.exists():
            self.chat_messages_file.unlink()
        
        # 重置索引
        index = {
            "message_count": 0,
            "next_message_id": 1,
            "file_size": 0
        }
        self._write_index(index)
    
    def get_file_size(self):
        """获取消息文件大小"""
        if self.chat_messages_file.exists():
            return self.chat_messages_file.stat().st_size
        return 0




