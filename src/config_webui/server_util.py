import copy
import datetime
import importlib.util
import json
import os
import zipfile

import asyncio
import uvicorn
import threading

from fastapi import HTTPException, Request, status
from fastapi.responses import RedirectResponse
from mcdreforged.api.types import PluginServerInterface

from .constant import *

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

def load_plugin_info(server_interface:PluginServerInterface):
    loaded_metadata = server_interface.get_all_metadata() #{plugin_id: metadata}
    disabled_plugins = server_interface.get_disabled_plugin_list()
    unloaded_plugins = server_interface.get_unloaded_plugin_list()

    unloaded_metadata = {}
    for plugin_path in disabled_plugins + unloaded_plugins:
        metadata = extract_metadata(plugin_path)
        metadata['path'] = plugin_path
        if metadata and metadata['id'] not in unloaded_metadata:
            unloaded_metadata[metadata["id"]] = metadata
        # update metadata if higher version is found
        elif metadata and metadata['version'] > unloaded_metadata[metadata["id"]]['version']:
            unloaded_metadata[metadata["id"]] = metadata
    return loaded_metadata, unloaded_metadata, unloaded_plugins, disabled_plugins

def get_gugubot_plugins_info(server_interface:PluginServerInterface):
    target_plugin = ["player_ip_logger", "online_player_api", "gugubot", "cq_qq_api"]
    loaded_metadata, unloaded_metadata, unloaded_plugins, disabled_plugins = load_plugin_info(server_interface)

    respond = []
    for plugin_name in target_plugin:
        if plugin_name in loaded_metadata:
            plugin_metadata = loaded_metadata[plugin_name]
            respond.append({
                "id": plugin_name, 
                "name": plugin_metadata.name if plugin_metadata else plugin_name, 
                "status": "loaded"
            })
        else: # unloaded or disabled
            plugin_metadata = unloaded_metadata.get(plugin_name)
            respond.append({
                "id": plugin_name, 
                "name": plugin_metadata["name"] if plugin_metadata else plugin_name, 
                "status": "unloaded" if plugin_name in unloaded_plugins else "disabled" if plugin_name in unloaded_metadata else "uninstall"
            })
    
    return respond

def get_plugins_info(server_interface:PluginServerInterface, detail=False):
    ignore_plugin = ["mcdreforged", "python", 
                     'gugubot', "cq_qq_api", "player_ip_logger", "online_player_api", "guguweb"]
    loaded_metadata, unloaded_metadata, unloaded_plugins, disabled_plugins = load_plugin_info(server_interface)

    respond = []
    merged_metadata = copy.deepcopy(unloaded_metadata)
    merged_metadata.update(loaded_metadata)

    for plugin_name, plugin_metadata in merged_metadata.items():
        if not detail:
            if plugin_name in ignore_plugin:
                continue
            respond.append(
                {"id": plugin_name, 
                "name": plugin_metadata.name if plugin_metadata else plugin_name,
                "status": "loaded" if plugin_name in loaded_metadata else "disabled" if plugin_name in disabled_plugins else "unloaded"}
            )
        else:
            respond.append({
                "id": plugin_metadata.get("id", ""),
                "name": plugin_metadata.get("name", ""),
                "mcdr": f'https://mcdreforged.com/en/plugin/{plugin_metadata.get("id", "")}',
                "author": ", ".join(plugin_metadata.get("author", [])),
                "github": plugin_metadata.get("link", ""),
                "version": plugin_metadata.get("version", ""),
                "version_lastest": plugin_metadata.get("version", ""),
            })

    return respond

def verify_token(request: Request):
    # 从 cookie 中获取 token
    token = request.cookies.get("token")
    
    # 检查是否有 token
    if not token:
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)

    # 检查 session 中是否存在该 token 和过期时间
    session_token = request.session.get("token")
    token_expiry = request.session.get("token_expiry")

    if token != session_token or not token_expiry or datetime.datetime.now(datetime.timezone.utc) >= datetime.datetime.fromisoformat(token_expiry):
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)

    return True

def extract_metadata(plugin_path):
    if os.path.isdir(plugin_path):  # 文件夹裁剪插件
        return extract_folder_plugin_metadata(plugin_path)
    elif zipfile.is_zipfile(plugin_path):  # MCDR 压缩包插件
        return extract_zip_plugin_metadata(plugin_path)
    elif os.path.isfile(plugin_path):  # 单文件插件
        return extract_single_file_plugin_metadata(plugin_path) 
    else:
        return None
    
def extract_single_file_plugin_metadata(plugin_file_path):
    # 动态导入插件模块
    module_name = os.path.basename(plugin_file_path).replace('.py', '')
    spec = importlib.util.spec_from_file_location(module_name, plugin_file_path)
    plugin_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(plugin_module)

    # 获取 PLUGIN_METADATA
    metadata = getattr(plugin_module, 'PLUGIN_METADATA', None)

    return metadata if metadata else None

def extract_folder_plugin_metadata(plugin_path):
    # 遍历文件夹中的所有文件
    for root, dirs, files in os.walk(plugin_path):
        for file in files:
            if file == 'mcdreforged.plugin.json': 
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    return json.load(f)

def extract_zip_plugin_metadata(zip_path):
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        # 列出压缩包内的所有文件
        for file in zip_ref.namelist():
            if file.endswith('mcdreforged.plugin.json'):
                with zip_ref.open(file) as f:
                    return json.load(f)




