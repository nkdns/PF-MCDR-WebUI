import re
import time
import threading

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
        with self._lock:
            self._patterns = patterns
            self._result = {pattern: False for pattern in patterns}
            self._watching = True
            self._last_read_line = 0  # 重置日志读取位置

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
                    print("观察者停止，退出循环。")
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
