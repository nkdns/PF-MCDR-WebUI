import uvicorn

from fastapi.staticfiles import StaticFiles
from mcdreforged.api.command import *
from mcdreforged.api.types import PluginServerInterface


from .utils.utils import amount_static_files
from .web_server import *

# 导出 PluginInstaller 类及相关功能
from .utils.PIM import PluginInstaller, get_installer, create_installer

__all__ = ['PluginInstaller', 'get_installer', 'create_installer'] 
#============================================================#

def on_load(server: PluginServerInterface, old):
    global web_server_interface

    server.logger.info("[GUGUWebUI] 启动 WebUI 中...")

    plugin_config = server.load_config_simple("config.json", DEFALUT_CONFIG)
    host = plugin_config['host']
    port = plugin_config['port']
    register_command(server, host, port) # register MCDR command

    amount_static_files(server) # move static resource
    app.mount("/src", StaticFiles(directory=f"{STATIC_PATH}/src"), name="static")
    app.mount("/js", StaticFiles(directory=f"{STATIC_PATH}/js"), name="static")
    app.mount("/css", StaticFiles(directory=f"{STATIC_PATH}/css"), name="static")
    app.mount("/custom", StaticFiles(directory=f"{STATIC_PATH}/custom"), name="static")
    
    # 初始化应用程序和日志捕获器
    init_app(server)
    
    config = uvicorn.Config(app, host=host, port=port, log_level="warning")
    web_server_interface = ThreadedUvicorn(config)

    server.logger.info(f"[GUGUWebUI] 网页地址: http://{host}:{port}")
    web_server_interface.start()
    get_plugins_info(app.state.server_interface, 'true')


def on_unload(server: PluginServerInterface):
    # 停止日志捕获
    if 'log_watcher' in globals() and log_watcher:
        log_watcher.stop()
        
    web_server_interface.stop()
    server.logger.info("[GUGUWebUI] WebUI 已卸载")


def register_command(server:PluginServerInterface, host:str, port:int):
    # 注册指令
    server.register_command(
        Literal('!!webui')
        .requires(lambda src: src.has_permission(3))
        .then(
            Literal('create')
            .then(
                Text('account')
                .then(
                    Text('password').runs(lambda src, ctx: create_account_command(src, ctx, host, port))
                )
            )
        )
        .then(
            Literal('change')
            .then(
                Text('account').suggests(lambda: [i for i in user_db['user'].keys()])
                .then(
                    Text('old password').then(
                        Text('new password').runs(lambda src, ctx: change_account_command(src, ctx, host, port))
                    )
                )
            )
        )
        .then(
            Literal('temp').runs(lambda src, ctx: get_temp_password_command(src, ctx, host, port))
        )
    )
    server.register_help_message('!!webui create <account> <password>', '注册 guguwebui 账户')
    server.register_help_message('!!webui change <account> <old password> <new password>', '修改 guguwebui 账户密码')
    server.register_help_message('!!webui temp', '获取 guguwebui 临时密码')