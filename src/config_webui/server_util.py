import asyncio
import uvicorn
import threading

from mcdreforged.api.types import PluginServerInterface

class ThreadedUvicorn:
    def __init__(self, config: uvicorn.Config):
        self.server = uvicorn.Server(config)
        self.thread = threading.Thread(daemon=True, target=self.server.run)

    def start(self):
        self.thread.start()
        asyncio.run(self.wait_for_started())

    async def wait_for_started(self):
        while not self.server.started:
            await asyncio.sleep(0.1)

    def stop(self):
        if self.thread.is_alive():
            self.server.should_exit = True
            while self.thread.is_alive():
                continue

def gugubot_plugins(server_interface:PluginServerInterface):
    target_plugin = ["player_ip_logger", "online_player_api", "config_webui"]
    loaded_plugins = server_interface.get_plugin_list()
    disabled_plugins = server_interface.get_disabled_plugin_list()
    unloaded_plugins = server_interface.get_unloaded_plugin_list()

    respond = []
    for plugin_name in target_plugin:
        respond.append(
            {"id": plugin_name, 
             "name": server_interface.get_plugin_metadata(plugin_name).name, 
             "status": "loaded" if plugin_name in loaded_plugins else "disabled" if plugin_name in disabled_plugins else "unloaded"}
        )

    return respond

def plugins(server_interface:PluginServerInterface):
    ignore_plugin = ['gugubot', "cq_qq_api", "player_ip_logger", "online_player_api", "config_webui"]

    loaded_plugins = server_interface.get_plugin_list()
    disabled_plugins = server_interface.get_disabled_plugin_list()
    unloaded_plugins = server_interface.get_unloaded_plugin_list()
    plugins = loaded_plugins + disabled_plugins # + unloaded_plugins

    respond = []
    for plugin_name in plugins:
        if plugin_name in ignore_plugin:
            continue
        respond.append(
            {"id": plugin_name, 
             "name": server_interface.get_plugin_metadata(plugin_name).name,
             "status": "loaded" if plugin_name in loaded_plugins else "disabled" if plugin_name in disabled_plugins else "unloaded"}
        )

    return respond

