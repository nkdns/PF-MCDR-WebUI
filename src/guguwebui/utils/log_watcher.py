import re
import time
import threading
import os

class LogWatcher:
    def __init__(self, log_file_path="logs/MCDR.log"):
        self._lock = threading.Lock()
        self._patterns = []
        self._result = {}
        self._watching = False
        self.log_file_path = log_file_path
        self._last_read_line = 0  # 用于记录上次读取的行数

    def _read_new_lines(self):
        """读取日志文件的新内容。"""
        with open(self.log_file_path, "r", encoding="utf-8") as log_file:
            lines = log_file.readlines()
        new_lines = lines[self._last_read_line:]
        self._last_read_line = len(lines)
        return new_lines

    def _process_lines(self, lines):
        """处理读取的日志行，更新匹配状态。"""
        with self._lock:
            for line in lines:
                for pattern in self._patterns:
                    if re.search(pattern, line):
                        self._result[pattern] = True

    def start_watch(self, patterns):
        """启动日志监控，设置匹配模式。

        Args:
            patterns (list): 需要匹配的多个日志内容模式。
        """
        self._cleanup()  # 清理资源
        with self._lock:
            self._patterns = patterns
            self._result = {pattern: False for pattern in patterns}
            self._watching = True
            
            # 读取文件的最后一行，确保从最新内容开始监控
            with open(self.log_file_path, "r", encoding="utf-8") as log_file:
                lines = log_file.readlines()
                self._last_read_line = len(lines)

    def get_result(self, timeout=10, match_all=True) -> dict:
        """
        获取日志匹配结果。

        Args:
            timeout (int): 获取结果的最大超时时间，单位：秒。
            match_all (bool): 是否要求所有模式都匹配才返回 `True`，否则只要匹配任意一个就返回 `True`。

        Returns:
            dict: 每个模式的匹配状态，`True`表示匹配成功，`False`表示未匹配。
        """
        start_time = time.time()
        end_time = start_time + timeout

        while time.time() < end_time:
            new_lines = self._read_new_lines()
            self._process_lines(new_lines)

            with self._lock:
                if not self._watching:
                    break
                
                if match_all:
                    if all(self._result.values()):
                        self._watching = False
                        return self._result
                else:
                    if any(self._result.values()):
                        self._watching = False
                        return self._result

            time.sleep(0.1)

        self._watching = False
        return self._result

    def _cleanup(self):
        """清理资源，释放状态。"""
        self._patterns = []
        self._result = {}
        self._last_read_line = 0
        
    def get_recent_logs(self, lines_count=100):
        """
        获取最近的日志内容
        
        Args:
            lines_count (int): 要获取的日志行数，默认100行
            
        Returns:
            list: 最近的日志行列表
        """
        try:
            with open(self.log_file_path, "r", encoding="utf-8") as log_file:
                all_lines = log_file.readlines()
                
            # 获取最后 lines_count 行
            recent_lines = all_lines[-lines_count:] if len(all_lines) > lines_count else all_lines
            return recent_lines
        except Exception as e:
            return [f"读取日志文件出错: {str(e)}"]
            
    def get_logs_after_line(self, start_line=0, max_lines=100):
        """
        获取指定行之后的日志内容
        
        Args:
            start_line (int): 开始行号（从0开始计数）
            max_lines (int): 最大返回行数，防止返回过多数据
            
        Returns:
            dict: 包含日志行和当前总行数的字典
        """
        try:
            # 检查日志文件是否存在
            if not os.path.exists(self.log_file_path):
                return {
                    "logs": [f"日志文件不存在: {self.log_file_path}"],
                    "total_lines": 1,
                    "start_line": 0,
                    "end_line": 1
                }
            
            with open(self.log_file_path, "r", encoding="utf-8") as log_file:
                all_lines = log_file.readlines()
                
            total_lines = len(all_lines)
            
            # 如果start_line超出范围，从最后返回max_lines行
            if start_line >= total_lines:
                start_line = max(0, total_lines - max_lines)
                
            # 确保不超过最大行数限制
            end_line = min(total_lines, start_line + max_lines)
            
            return {
                "logs": all_lines[start_line:end_line],
                "total_lines": total_lines,
                "start_line": start_line,
                "end_line": end_line
            }
        except Exception as e:
            return {
                "logs": [f"读取日志文件出错: {str(e)}"],
                "total_lines": 1,
                "start_line": 0,
                "end_line": 1
            }

    def get_latest_logs(self, max_lines=500):
        """
        获取最新的日志内容（从文件末尾向前读取）
        
        Args:
            max_lines (int): 要获取的最大日志行数，默认500行
            
        Returns:
            dict: 包含最新日志行和总行数的字典
        """
        try:
            # 检查日志文件是否存在
            if not os.path.exists(self.log_file_path):
                return {
                    "logs": [f"日志文件不存在: {self.log_file_path}"],
                    "total_lines": 1,
                    "start_line": 0,
                    "end_line": 1
                }
            
            with open(self.log_file_path, "r", encoding="utf-8") as log_file:
                all_lines = log_file.readlines()
                
            total_lines = len(all_lines)
            
            # 从末尾开始读取指定行数
            start_line = max(0, total_lines - max_lines)
            
            return {
                "logs": all_lines[start_line:total_lines],
                "total_lines": total_lines,
                "start_line": start_line,
                "end_line": total_lines
            }
        except Exception as e:
            return {
                "logs": [f"读取日志文件出错: {str(e)}"],
                "total_lines": 1,
                "start_line": 0,
                "end_line": 1
            }

    def parse_log_timestamp(self, log_line, log_type="mcdr"):
        """
        解析日志行中的时间戳
        
        Args:
            log_line (str): 日志行内容
            log_type (str): 日志类型，mcdr或minecraft
            
        Returns:
            datetime: 解析后的时间戳，如果解析失败则返回None
        """
        import datetime
        import re
        
        try:
            # 判断是否是接续行（前面有空格或制表符）
            if log_line.startswith((' ', '\t')):
                return None
            
            if log_type == "mcdr":
                # MCDR格式: [MCDR] [2025-04-03 22:45:53.14] [TaskExecutor/INFO] xxxx
                match = re.search(r'\[MCDR\] \[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+)\]', log_line)
                if match:
                    timestamp_str = match.group(1)
                    return datetime.datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S.%f')
                
                # 尝试匹配其他可能的MCDR日志格式
                match = re.search(r'\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)\]', log_line)
                if match:
                    timestamp_str = match.group(1)
                    try:
                        if '.' in timestamp_str:
                            return datetime.datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S.%f')
                        else:
                            return datetime.datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                    except ValueError:
                        pass
            else:
                # MC格式: [22:46:13] [Server thread/INFO]: xxxx
                match = re.search(r'^\[(\d{2}:\d{2}:\d{2})\]', log_line)
                if match:
                    timestamp_str = match.group(1)
                    today = datetime.datetime.now().strftime('%Y-%m-%d')
                    return datetime.datetime.strptime(f"{today} {timestamp_str}", '%Y-%m-%d %H:%M:%S')
        except Exception as e:
            print(f"解析日志时间戳出错: {e}, 日志: {log_line[:50]}...")
        
        return None

    def get_merged_logs(self, mcdr_log_path, mc_log_path, max_lines=500):
        """
        合并MCDR和Minecraft日志，按时间排序
        
        Args:
            mcdr_log_path (str): MCDR日志文件路径
            mc_log_path (str): Minecraft日志文件路径
            max_lines (int): 要获取的最大日志行数，默认500行
            
        Returns:
            dict: 包含合并后的日志行和总行数的字典
        """
        try:
            # 检查日志文件是否存在
            mcdr_exists = os.path.exists(mcdr_log_path)
            mc_exists = os.path.exists(mc_log_path)
            
            if not mcdr_exists and not mc_exists:
                return {
                    "logs": ["日志文件不存在"],
                    "total_lines": 1,
                    "start_line": 0,
                    "end_line": 1
                }
            
            mcdr_lines = []
            mc_lines = []
            
            # 读取MCDR日志
            if mcdr_exists:
                try:
                    with open(mcdr_log_path, "r", encoding="utf-8") as log_file:
                        mcdr_lines = log_file.readlines()
                        # 取最后max_lines/2行
                        mcdr_lines = mcdr_lines[-int(max_lines/2):]
                except Exception as e:
                    mcdr_lines = [f"读取MCDR日志出错: {str(e)}"]
            
            # 读取MC日志
            if mc_exists:
                try:
                    with open(mc_log_path, "r", encoding="utf-8") as log_file:
                        mc_lines = log_file.readlines()
                        # 取最后max_lines/2行
                        mc_lines = mc_lines[-int(max_lines/2):]
                except Exception as e:
                    mc_lines = [f"读取Minecraft日志出错: {str(e)}"]
            
            # 准备合并
            merged_logs = []
            
            # 处理MCDR日志，让没有时间戳的行继承前一行的时间戳
            last_timestamp = None
            for i, line in enumerate(mcdr_lines):
                timestamp = self.parse_log_timestamp(line, "mcdr")
                if timestamp:
                    last_timestamp = timestamp
                else:
                    # 如果当前行没有时间戳，使用上一个有效的时间戳
                    timestamp = last_timestamp
                    
                merged_logs.append({
                    "timestamp": timestamp,
                    "content": line.rstrip("\n"),
                    "source": "mcdr",
                    "line_number": i,
                    "raw_time": timestamp.strftime('%Y-%m-%d %H:%M:%S.%f') if timestamp else "无时间戳"
                })
            
            # 处理MC日志，让没有时间戳的行继承前一行的时间戳
            last_timestamp = None
            for i, line in enumerate(mc_lines):
                timestamp = self.parse_log_timestamp(line, "minecraft")
                if timestamp:
                    last_timestamp = timestamp
                else:
                    # 如果当前行没有时间戳，使用上一个有效的时间戳
                    timestamp = last_timestamp
                    
                merged_logs.append({
                    "timestamp": timestamp,
                    "content": line.rstrip("\n"),
                    "source": "minecraft",
                    "line_number": i,
                    "raw_time": timestamp.strftime('%H:%M:%S') if timestamp else "无时间戳"
                })
            
            # 按时间戳排序，修复排序逻辑
            sorted_logs = []
            if merged_logs:
                # 过滤掉没有时间戳的日志行
                filtered_logs = [log for log in merged_logs if log["timestamp"] is not None]
                if filtered_logs:
                    # 按时间升序排序（较早的在前）
                    sorted_logs = sorted(
                        filtered_logs, 
                        key=lambda x: x["timestamp"].timestamp() if x["timestamp"] else 0
                    )
                
                # 将没有时间戳的日志放到前面
                for log in merged_logs:
                    if log["timestamp"] is None:
                        sorted_logs.insert(0, log)
            
            # 只保留max_lines行
            sorted_logs = sorted_logs[:max_lines]
            
            # 移除调试用的raw_time字段
            for log in sorted_logs:
                if "raw_time" in log:
                    del log["raw_time"]
            
            return {
                "logs": sorted_logs,
                "total_lines": len(sorted_logs),
                "start_line": 0,
                "end_line": len(sorted_logs)
            }
        except Exception as e:
            import traceback
            error_msg = f"合并日志出错: {str(e)}\n{traceback.format_exc()}"
            print(error_msg)
            return {
                "logs": [{"content": error_msg, "timestamp": None, "source": "error", "line_number": 0}],
                "total_lines": 1,
                "start_line": 0,
                "end_line": 1
            }
