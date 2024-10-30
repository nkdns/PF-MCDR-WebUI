import uvicorn

from mcdreforged.api.types import PluginServerInterface

from .utils import amount_static_files
from .web_server import *
#============================================================#

def on_load(server: PluginServerInterface, old):
    global web_server_interface

    port = server.load_config_simple("config.json", DEFALUT_CONFIG)['port']

    amount_static_files(server)

    server.logger.info("[MCDR WebUI] 启动 WebUI 中...")

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
