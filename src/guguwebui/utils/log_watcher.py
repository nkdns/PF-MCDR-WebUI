import re
import time
import threading

class LogWatcher:
    def __init__(self, log_file_path="logs/MCDR.log"):
        self._lock = threading.Lock()
        self._pattern = None
        self._result = {}
        self.log_file_path = log_file_path

    def on_info(self, info):
        with self._lock:
            # 记录日志内容的基本信息
            print(f"LogWatcher on_info: {info.content}")

            for pattern in self._pattern:
                if re.search(pattern, info.content):
                    self._result[pattern] = True

    def watch_log(self, patterns, timeout=10, backtrack=5, match_all=True) -> dict:
        """
        Args:
            patterns (list): 需要匹配的多个日志内容模式。
            timeout (int): 监听的最大超时时间，单位：秒。
            backtrack (int): 向前回溯的日志行数。
            match_all (bool): 是否要求所有模式都匹配才返回 `True`，否则只要匹配任意一个就返回 `True`。
        
        Returns:
            dict: 每个模式的匹配状态，`True`表示匹配成功，`False`表示未匹配。
        """
        with self._lock:
            self._pattern = patterns
            self._result = {pattern: False for pattern in patterns}

        start_time = time.time()
        end_time = start_time + timeout

        # print(f"开始监听日志文件 {self.log_file_path}，匹配模式: {patterns}")

        while time.time() < end_time:
            # 读取日志文件最新内容进行匹配
            with open(self.log_file_path, "r", encoding="utf-8") as log_file:
                log_lines = log_file.readlines()

            # 如果有新日志内容，检查每一行是否匹配模式
            for line in log_lines[-backtrack:]:  # 向后回溯指定行数
                for pattern in patterns:
                    if re.search(pattern, line):
                        self._result[pattern] = True

            # 根据是否要求全部匹配来判断是否立即返回
            if match_all:
                if all(self._result.values()):  # 如果所有模式都匹配了
                    # print(f"匹配到所有模式：{self._result}")
                    return self._result
            else:
                if any(self._result.values()):  # 如果任意一个模式匹配了
                    # print(f"匹配到任意一个模式：{self._result}")
                    return self._result

            time.sleep(0.1)

        # 如果超时未匹配到模式，返回当前匹配结果
        # print(f"监听超时，未匹配到全部日志")
        return self._result
