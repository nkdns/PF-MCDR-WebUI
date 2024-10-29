import uvicorn

from mcdreforged.api.types import PluginServerInterface

from .web_server import *
#============================================================#

def on_load(server: PluginServerInterface, old):
    global web_server_interface

    web_config = server.load_config_simple("config.json", DEFALUT_CONFIG)
    port = web_config['port']

    server.logger.info("[MCDR WebUI] 启动 WebUI 中...")

    app.state.server_interface = server
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    web_server_interface = ThreadedUvicorn(config)

    server.logger.info(f"[MCDR WebUI] 网页地址: http://127.0.0.1:{web_config['port']}")
    web_server_interface.start()

def on_unload(server: PluginServerInterface):
    web_server_interface.stop()
    server.logger.info("[MCDR WebUI] WebUI 已卸载")
