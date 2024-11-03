import uvicorn

from fastapi.staticfiles import StaticFiles
from mcdreforged.api.command import *
from mcdreforged.api.types import PluginServerInterface


from .utils.utils import amount_static_files
from .web_server import *
#============================================================#

def on_load(server: PluginServerInterface, old):
    global web_server_interface, port

    port = server.load_config_simple("config.json", DEFALUT_CONFIG)['port']

    server.logger.info("[MCDR WebUI] 启动 WebUI 中...")
    register_command(server)

    amount_static_files(server)
    app.mount("/src", StaticFiles(directory=f"{STATIC_PATH}/src"), name="static")
    app.mount("/js", StaticFiles(directory=f"{STATIC_PATH}/js"), name="static")
    app.mount("/css", StaticFiles(directory=f"{STATIC_PATH}/css"), name="static")
    app.mount("/custom", StaticFiles(directory=f"{STATIC_PATH}/custom"), name="static")
    app.state.server_interface = server
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")

    web_server_interface = ThreadedUvicorn(config)

    server.logger.info(f"[MCDR WebUI] 网页地址: http://127.0.0.1:{port}")
    web_server_interface.start()


def on_unload(server: PluginServerInterface):
    web_server_interface.stop()
    server.logger.info("[MCDR WebUI] WebUI 已卸载")


def register_command(server:PluginServerInterface):
    # 注册指令
    server.register_command(
        Literal('!!webui')
        .requires(lambda src: src.has_permission(3))
        .then(
            Literal('create')
            .then(
                Text('account')
                .then(
                    Text('password').runs(lambda src, ctx: create_account_command(src, ctx, port))
                )
            )
        )
        .then(
            Literal('change')
            .then(
                Text('account').suggests(lambda: [i for i in user_db['user'].keys()])
                .then(
                    Text('old password').then(
                        Text('new password').runs(lambda src, ctx: change_account_command(src, ctx, port))
                    )
                )
            )
        )
        .then(
            Literal('temp').runs(lambda src, ctx: get_temp_password_command(src, ctx, port))
        )
    )
    server.register_help_message('!!webui create <account> <password>','注册 guguwebui 账户')
    server.register_help_message('!!webui change <account> <old password> <new password>', '修改 guguwebui 账户密码')
    server.register_help_message('!!webui temp', '获取 guguwebui 临时密码')