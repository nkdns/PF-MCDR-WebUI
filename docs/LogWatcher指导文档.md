# LogWatcher日志获取系统指导文档

## 概述

`log_watcher.py` 是 GuGuWebUI 中用于实时获取和管理 MCDR（MCDReforged）及 Minecraft 服务器日志的核心模块。它通过多种拦截机制捕获不同来源的日志，并提供统一的 API 接口供前端获取日志内容。

## 系统架构

### 核心组件

1. **LogWatcher** - 主要的日志监控类
2. **LogHandler** - 自定义日志处理器
3. **MCServerLogCapture** - Minecraft服务器日志捕获线程
4. **StdoutInterceptor** - 标准输出拦截器

## 初始化流程

### 1. WebUI初始化时的日志系统设置

在 `web_server.py` 的 `init_app()` 函数中：

```python
def init_app(server_instance):
    global log_watcher
    
    # 清理现有监听器，避免重复注册
    if log_watcher:
        log_watcher.stop()
    
    # 初始化LogWatcher实例
    log_watcher = LogWatcher(server_interface=server_instance)
    
    # 设置日志捕获
    log_watcher._setup_log_capture()
    
    # 注册MCDR事件监听器
    server_instance.register_event_listener(MCDR.MCDRPluginEvents.GENERAL_INFO, on_mcdr_info)
    server_instance.register_event_listener(MCDR.MCDRPluginEvents.USER_INFO, on_server_output)
```

### 2. LogWatcher的初始化过程

在 `LogWatcher.__init__()` 中进行以下操作：

```python
def __init__(self, server_interface=None):
    # 1. 创建日志捕获器
    self.mcdr_log_handler = LogHandler()
    self.mc_log_capture = MCServerLogCapture()
    
    # 2. 拦截 logging.StreamHandler 的 emit 方法
    self.original_stream_handler_emit = logging.StreamHandler.emit
    logging.StreamHandler.emit = intercepted_emit
    
    # 3. 创建并启动标准输出拦截器
    self.stdout_interceptor = StdoutInterceptor(self)
    self.stdout_interceptor.start_interception()
    
    # 4. 启动MC日志捕获线程
    self.mc_log_capture.start()
```

## 日志捕获机制

### 1. Python Logging系统拦截

通过拦截 `logging.StreamHandler.emit` 方法：

```python
def intercepted_emit(self_handler, record):
    # 调用原始方法
    result = self.original_stream_handler_emit(self_handler, record)
    
    # 捕获MCDR相关日志
    if 'mcdreforged' in record.name.lower() or 'mcdr' in record.name.lower():
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        formatter = logging.Formatter('%(message)s')
        message = formatter.format(record)
        log_line = f"[{timestamp}] [{record.name}/{record.levelname}] {message}"
        self._add_log_line(log_line)
```

### 2. 标准输出/错误拦截

通过 `StdoutInterceptor` 类：

```python
class StdoutInterceptor:
    def start_interception(self):
        # 替换系统的stdout和stderr
        sys.stdout = InterceptedStream(self.original_stdout, self)
        sys.stderr = InterceptedStream(self.original_stderr, self)
```

### 3. MCDR事件监听

注册MCDR事件监听器：

```python
# 监听MCDR常规信息事件
server_instance.register_event_listener(MCDR.MCDRPluginEvents.GENERAL_INFO, on_mcdr_info)

# 监听用户输入事件
server_instance.register_event_listener(MCDR.MCDRPluginEvents.USER_INFO, on_server_output)
```

### 4. Minecraft服务器日志捕获

通过 `MCServerLogCapture` 线程专门处理服务器日志：

```python
def on_info(self, server, info):
    # 获取日志来源和内容
    source = getattr(info, 'source', 'Unknown')
    content = clean_color_codes(info.content)
    
    # 格式化日志
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [{str(source)}/INFO] {content}"
    
    # 添加到父LogWatcher
    if self.log_watcher:
        self.log_watcher._add_log_line(log_line)
```

## 日志存储与管理

### 1. 日志去重机制

使用哈希值进行去重：

```python
def _add_log_line(self, log_line):
    # 计算日志内容的哈希值
    log_hash = hash(log_line)
    
    with self._lock:
        # 检查是否重复
        if log_hash in self._handled_log_hashes:
            return False
            
        # 添加到已处理集合
        self._handled_log_hashes.add(log_hash)
        
        # 增加计数器并添加日志
        self.log_counter += 1
        numbered_log = f"[#{self.log_counter}] {log_line}"
        self.captured_logs.append(numbered_log)
```

### 2. 颜色代码清理

清理Minecraft和ANSI颜色代码：

```python
def clean_color_codes(text):
    # 清理 Minecraft 颜色代码（§ 后面跟着一个字符）
    text = re.sub(r'§[0-9a-fk-or]', '', text)
    
    # 清理 ANSI 颜色代码
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    text = ansi_escape.sub('', text)
    
    return text
```

## API接口

### 1. 获取服务器日志 (`/api/server_logs`)

**请求参数:**
- `start_line`: 开始行号（可选，默认0）
- `max_lines`: 最大返回行数（可选，默认100，最大500）

**响应格式:**
```json
{
    "status": "success",
    "logs": [
        {
            "line_number": 0,
            "content": "[#1] [2025-01-20 10:30:15] [MCDR/INFO] 服务器启动完成\n",
            "source": "all",
            "counter": 1
        }
    ],
    "total_lines": 150,
    "current_start": 50,
    "current_end": 150
}
```

**实现代码:**
```python
@app.get("/api/server_logs")
async def get_server_logs(request: Request, start_line: int = 0, max_lines: int = 100):
    # 获取合并日志
    result = log_watcher.get_merged_logs(max_lines)
    
    # 格式化日志内容
    formatted_logs = []
    for i, log in enumerate(result["logs"]):
        formatted_logs.append({
            "line_number": i,
            "content": log["content"],
            "source": log["source"],
            "counter": log.get("sequence_num", i)
        })
    
    return JSONResponse({
        "status": "success",
        "logs": formatted_logs,
        "total_lines": result["total_lines"],
        "current_start": result["start_line"],
        "current_end": result["end_line"]
    })
```

### 2. 获取新增日志 (`/api/new_logs`)

**请求参数:**
- `last_counter`: 上次获取的最后一条日志的计数器ID
- `max_lines`: 最大返回行数（可选，默认100，最大200）

**响应格式:**
```json
{
    "status": "success",
    "logs": [
        {
            "line_number": 150,
            "counter": 151,
            "timestamp": "2025-01-20 10:35:20",
            "timestamp_value": 1737347720.0,
            "content": "[#151] [2025-01-20 10:35:20] [SERVER/INFO] 玩家加入游戏\n",
            "source": "all",
            "is_command": false
        }
    ],
    "total_lines": 151,
    "last_counter": 151,
    "new_logs_count": 1
}
```

**实现代码:**
```python
@app.get("/api/new_logs")
async def get_new_logs(request: Request, last_counter: int = 0, max_lines: int = 100):
    # 获取新增日志
    result = log_watcher.get_logs_since_counter(last_counter, max_lines)
    
    return JSONResponse({
        "status": "success",
        "logs": result["logs"],
        "total_lines": result["total_lines"],
        "last_counter": result["last_counter"],
        "new_logs_count": result["new_logs_count"]
    })
```

## 前端实现

### 1. 日志加载 (terminal.js)

```javascript
async loadLogs() {
    const params = new URLSearchParams({
        max_lines: 500
    });
    
    const response = await fetch(`api/server_logs?${params.toString()}`);
    const data = await response.json();
    
    if (data.status === 'success') {
        this.logs = data.logs || [];
        this.totalLines = data.total_lines || 0;
        
        // 保存最后日志的计数器ID
        if (this.logs.length > 0) {
            const lastLog = this.logs[this.logs.length - 1];
            this.lastLogCounter = lastLog.counter || 0;
        }
    }
}
```

### 2. 实时日志更新

```javascript
async fetchNewLogs() {
    const params = new URLSearchParams({
        last_counter: this.lastLogCounter || 0,
        max_lines: 100
    });
    
    const response = await fetch(`api/new_logs?${params.toString()}`);
    const data = await response.json();
    
    if (data.status === 'success' && data.new_logs_count > 0) {
        // 创建已有计数器ID的集合，用于去重
        const existingCounters = new Set(this.logs.map(log => log.counter));
        
        // 筛选出不重复的新日志
        const uniqueNewLogs = data.logs.filter(log => !existingCounters.has(log.counter));
        
        if (uniqueNewLogs.length > 0) {
            // 添加新日志到现有日志列表
            this.logs.push(...uniqueNewLogs);
            this.lastLogCounter = data.last_counter;
        }
    }
}
```

## 使用指南

### 1. 基本用法

要在WebUI中查看日志：

1. 登录WebUI管理界面
2. 导航到"终端"页面
3. 日志会自动加载并实时更新

### 2. API调用示例

获取最新的100行日志：
```bash
curl "http://localhost:8080/api/server_logs?max_lines=100"
```

获取计数器ID 500之后的新日志：
```bash
curl "http://localhost:8080/api/new_logs?last_counter=500&max_lines=50"
```

### 3. 自定义日志处理

如果需要自定义日志处理，可以继承LogWatcher类：

```python
class CustomLogWatcher(LogWatcher):
    def _add_log_line(self, log_line):
        # 自定义日志处理逻辑
        processed_line = self.custom_process(log_line)
        return super()._add_log_line(processed_line)
    
    def custom_process(self, log_line):
        # 自定义处理
        return log_line
```

## 性能优化

### 1. 内存管理

- 使用去重集合避免重复日志
- 定期清理过大的去重集合（超过10000条记录）
- 限制单次返回的日志数量

### 2. 并发安全

- 使用线程锁保护共享资源
- 守护线程确保不阻止程序退出
- 非阻塞队列操作

### 3. 网络优化

- 支持增量日志获取
- 限制单次传输的数据量
- 压缩长日志内容

## 故障排除

### 1. 日志未显示

**可能原因:**
- LogWatcher未正确初始化
- 事件监听器注册失败
- 权限不足

**解决方法:**
1. 检查MCDR服务器接口是否正常
2. 确认事件监听器注册成功
3. 查看WebUI错误日志

### 2. 日志重复或缺失

**可能原因:**
- 去重机制失效
- 多个LogWatcher实例冲突

**解决方法:**
1. 确保只有一个LogWatcher实例
2. 检查日志计数器是否正常递增
3. 重启WebUI服务

### 3. 性能问题

**可能原因:**
- 日志量过大
- 内存泄漏
- 频繁的API调用

**解决方法:**
1. 调整max_lines参数
2. 增加日志清理频率
3. 优化前端刷新间隔

## 总结

LogWatcher系统通过多层次的日志拦截机制，实现了对MCDR和Minecraft服务器日志的完整捕获。它提供了统一的API接口，支持实时日志获取和增量更新，是WebUI日志管理的核心组件。

通过合理配置和使用，可以实现高效、稳定的日志监控和管理功能。 