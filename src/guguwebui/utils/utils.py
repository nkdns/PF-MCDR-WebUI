import copy
import importlib
import javaproperties
import json
import os
import string
import zipfile

import datetime
import secrets

import requests
import re
import time
from threading import Thread, Lock
from concurrent.futures import ThreadPoolExecutor, as_completed

from mcdreforged.api.types import PluginServerInterface
from mcdreforged.plugin.meta.metadata import Metadata
from pathlib import Path

from .constant import user_db, pwd_context, SERVER_PROPERTIES_PATH

#============================================================#
# verify password
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)
# create temp password
def create_temp_password()->str:
    characters = string.ascii_uppercase + string.digits
    temp_password = ''.join(secrets.choice(characters) for _ in range(6))
    user_db['temp'][temp_password] = str(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15))
    user_db.save()
    return temp_password
# create password
def create_user_account(user_name:str, password:str)->bool:
    if user_name not in user_db['user']:
        user_db['user'][user_name] = pwd_context.hash(password)
        user_db.save()
        return True
    return False
# change password
def change_user_account(user_name:str, old_password:str, new_password:str)->bool:
    if user_name in user_db['user'] and verify_password(old_password, user_db['user'][user_name]):
        user_db['user'][user_name] = pwd_context.hash(new_password)
        user_db.save()
        return True
    return False
# MCDR command
def create_account_command(src, ctx, host:str, port:int):
    account, password = ctx['account'], ctx['password']
    success = create_user_account(account, password)
    if success:
        src.reply(f"账户: {account} 创建成功。\nguguwebui 地址: http://{host}:{port}")
    else:
        src.reply("账户已存在！")
# MCDR command
def change_account_command(src, ctx, host:str, port:int):
    account = ctx['account']
    old_password, new_password = ctx['old password'], ctx['new password']
    success = change_user_account(account, old_password, new_password)
    if success:
        src.reply(f"账户: {account} 修改成功。\nguguwebui 地址: http://{host}:{port}")
    else:
        src.reply("用户不存在 或 密码错误！")
# MCDR command
def get_temp_password_command(src, ctx, host:str, port:int):
    temp_password = create_temp_password()
    src.reply(f"临时密码(15分钟后过期): {temp_password}\nguguwebui 地址: http://{host}:{port}")
#============================================================#
# Find all configs for a plugin
def find_plugin_config_paths(plugin_id:str)->list:
    MCDR_plugin_folder = Path("./config") / plugin_id # config under ./config/plugin_id/*
    single_file_path = Path("./config") / plugin_id # config under ./config

    response = [] # list[config_path]
    config_suffix = [".json", ".yml", ".yaml"]
    single_file_paths = [single_file_path.with_suffix(suffix) for suffix in config_suffix]

    # Configs in ./config/plugin_id/
    response += [file for file in Path(MCDR_plugin_folder).rglob("*") if file.suffix in config_suffix]
    # Configs in ./config/
    response += [file_path for file_path in single_file_paths if file_path.exists()]

    # filter out translation files
    response = [str(i) for i in response if not Path(i).stem.endswith("_lang")]

    return response


# loading all the plugin information
def load_plugin_info(server_interface:PluginServerInterface):
    loaded_metadata = server_interface.get_all_metadata() #{plugin_id: metadata}
    disabled_plugins = server_interface.get_disabled_plugin_list()
    unloaded_plugins = server_interface.get_unloaded_plugin_list()

    unloaded_metadata = {}

    # extract metadata by reading files
    for plugin_path in disabled_plugins + unloaded_plugins:
        # extract metadata
        metadata = extract_metadata(plugin_path)

        if not metadata: continue # cannot find the metadata

        if metadata['id'] in unloaded_metadata \
            and metadata['version'] <= unloaded_metadata[metadata["id"]]['version']:
            continue # not the highest version of the plugin

        metadata['path'] = plugin_path
        unloaded_metadata[metadata["id"]] = metadata

    return loaded_metadata, unloaded_metadata, unloaded_plugins, disabled_plugins


# Get gugu plugins metadata
def get_gugubot_plugins_info(server_interface:PluginServerInterface):
    target_plugin = ["player_ip_logger", "online_player_api", "gugubot", "cq_qq_api"]
    loaded_metadata, unloaded_metadata, unloaded_plugins, disabled_plugins = load_plugin_info(server_interface)

    respond = []
    for plugin_name in target_plugin:
        if plugin_name in loaded_metadata: # loaded
            plugin_metadata = loaded_metadata[plugin_name]

        elif plugin_name in unloaded_metadata: # unloaded or disabled
            plugin_metadata = unloaded_metadata.get(plugin_name)

        else: continue # uninstall -> skip

        if not isinstance(plugin_metadata, Metadata): # convert dict to Metadata
            plugin_metadata = Metadata(plugin_metadata)

        respond.append({
            "id": plugin_name, 
            "version": str(plugin_metadata.version),
            "name": str(plugin_metadata.name) if plugin_metadata else plugin_name, 
            "status": "loaded" if plugin_name in loaded_metadata else "unloaded" if plugin_name in unloaded_metadata else "disabled",
            "path": plugin_name if plugin_name in unloaded_plugins + disabled_plugins else ""
        })
        
        # uninstall -> no return
    
    return respond

# get plugins' metadata 
def get_plugins_info(server_interface, detail=False):
    ignore_plugin = ["mcdreforged", "python"]
    main_page_ignore = ['gugubot', "cq_qq_api", "player_ip_logger", "online_player_api", "guguwebui"]
    loaded_metadata, unloaded_metadata, unloaded_plugins, disabled_plugins = load_plugin_info(server_interface)

    # 获取插件版本数据
    def fetch_plugin_versions():
        url = "https://looseprince.github.io/Plugin-Catalogue/plugins.json"
        try:
            response = requests.get(url)
            if response.status_code == 200:
                plugins_data = response.json()
                return {plugin["id"]: plugin["latest_version"] for plugin in plugins_data}
            else:
                return {}
        except requests.RequestException as e:
            print(f"Error fetching plugin versions: {e}")
            return {}

    # 获取插件版本
    plugin_versions = fetch_plugin_versions()

    respond = []

    # 合并已加载和未加载的插件元数据
    merged_metadata = copy.deepcopy(unloaded_metadata)
    merged_metadata.update(loaded_metadata)

    for plugin_name, plugin_metadata in merged_metadata.items():
        if plugin_name in ignore_plugin:
            continue  # 忽略 mcdr 和 python

        if not isinstance(plugin_metadata, Metadata):  # 将 dict 转换为 Metadata 对象
            plugin_metadata = Metadata(plugin_metadata)

        # 从API获取的最新版本号
        latest_version = plugin_versions.get(plugin_name, None)

        if not detail and plugin_name not in main_page_ignore:  # 主页面插件信息
            respond.append({
                "id": plugin_name, 
                "name": str(plugin_metadata.name) if plugin_metadata else plugin_name,
                "status": "loaded" if plugin_name in loaded_metadata else "disabled" if plugin_name in disabled_plugins else "unloaded",
                "path": plugin_name if plugin_name in unloaded_plugins + disabled_plugins else ""
            })
        elif detail:  # 插件列表详细信息
            description = plugin_metadata.description
            description = (description.get(server_interface.get_mcdr_language()) or description.get("en_us")) \
                if isinstance(description, dict) else description
            respond.append({
                "id": str(plugin_metadata.id),
                "name": str(plugin_metadata.name),
                "description": str(description),
                "author": ", ".join(plugin_metadata.author),
                "github": str(plugin_metadata.link),
                "version": str(plugin_metadata.version),
                "version_latest": str(latest_version) if latest_version else str(plugin_metadata.version),
                "status": "loaded" if str(plugin_metadata.id) in loaded_metadata else "disabled" if str(plugin_metadata.id) in disabled_plugins else "unloaded",
                "path": plugin_name if plugin_name in unloaded_plugins + disabled_plugins else "",
                "config_file": bool(find_plugin_config_paths(str(plugin_metadata.id)))
            })

    return respond
#============================================================#
# loading metadata
def extract_metadata(plugin_path):
    if os.path.isdir(plugin_path):  # folder plugin
        return extract_folder_plugin_metadata(plugin_path)
    elif zipfile.is_zipfile(plugin_path):  # MCDR zipped plugin
        return extract_zip_plugin_metadata(plugin_path)
    elif os.path.isfile(plugin_path):  # single-py plugin
        return extract_single_file_plugin_metadata(plugin_path) 
    else:
        return None
    
def extract_single_file_plugin_metadata(plugin_file_path):
    # import the file
    module_name = os.path.basename(plugin_file_path).replace('.py', '')
    spec = importlib.util.spec_from_file_location(module_name, plugin_file_path)
    plugin_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(plugin_module)

    # get the metadata
    metadata = getattr(plugin_module, 'PLUGIN_METADATA', None)

    return metadata if metadata else None

def extract_folder_plugin_metadata(plugin_path):
    # find mcdreforged.plugin.json in the folder
    for root, dirs, files in os.walk(plugin_path):
        for file in files:
            if file == 'mcdreforged.plugin.json': 
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    return json.load(f)

def extract_zip_plugin_metadata(zip_path):
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        # list all the file in zipped file
        for file in zip_ref.namelist():
            if file.endswith('mcdreforged.plugin.json'):
                with zip_ref.open(file) as f:
                    return json.load(f)
#============================================================#
# extract comments from ruamel.yaml's Comment object
def extract_comment(comment_object)->str:
    if not comment_object:
        return ""
    # Obtain first available comment
    comment = next((c[0].value if isinstance(c, list) and c else c.value for c in comment_object if c), "")
    # remove # & extract space
    comment = comment.split("\n", 1)[0].replace("#", "").strip()
    # segment by "::"
    return comment.split("::", 1) if "::" in comment else comment

# Read comment from yaml file
def get_comment(config:dict)->dict:
    name_map = {}

    for k,v in config.items(): 
        comment = extract_comment(config.ca.items.get(k))

        if comment: # save when it has comment
            name_map[k] = comment

        if isinstance(v,dict): # recurrsion for inner dict
            name_map.update(get_comment(v))

    return name_map
#============================================================#
# read server status
import socket

# Get server port
def get_server_port()->int:
    with open(SERVER_PROPERTIES_PATH, "r", encoding="UTF-8") as f:
        data = javaproperties.load(f)
    return int( data["server-port"] )

# Get java MC status
# original code from https://github.com/Spark-Code-China/MC-Server-Info
def get_java_server_info():
    temp_ip = "127.0.0.1"
    port = get_server_port()
    result_dict = {}
    tcp_client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        tcp_client.connect((temp_ip, port))
        tcp_client.sendall(b'\xfe\x01')
        data = tcp_client.recv(1024)
        print(data)
        if data:
            if data[:2] == b'\xff\x00':
                data_parts = data.split(b'\x00\x00\x00')
                if len(data_parts) >= 6:
                    result_dict["server_version"] = data_parts[2].decode('latin1').replace('\x00', '')
                    result_dict["server_player_count"] =  data_parts[4].decode('latin1').replace('\x00', '')
                    result_dict["server_maxinum_player_count"] = data_parts[5].decode('latin1').replace('\x00', '')
                    return result_dict
        return result_dict
    except socket.error as e:
        return result_dict
    finally:
        tcp_client.close()
 
#============================================================#
# move file from MCDR package
def __copyFile(server, path, target_path): 
    if "custom" in Path(target_path).parts and os.path.exists(target_path):
        return
    target_path = Path(target_path)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    with server.open_bundled_file(path) as file_handler: # extract from MCDR file
        message = file_handler.read()
    with open(target_path, 'wb') as f:                   # copy to target_path
        f.write(message)
        
def amount_static_files(server):
    __copyFile(server, 'guguwebui/css/about.css', './guguwebui_static/css/about.css')
    __copyFile(server, 'guguwebui/css/gugubot.css', './guguwebui_static/css/gugubot.css')
    __copyFile(server, 'guguwebui/css/home.css', './guguwebui_static/css/home.css')
    __copyFile(server, 'guguwebui/css/index.css', './guguwebui_static/css/index.css')
    __copyFile(server, 'guguwebui/css/login.css', './guguwebui_static/css/login.css')
    __copyFile(server, 'guguwebui/css/mc.css', './guguwebui_static/css/mc.css')
    __copyFile(server, 'guguwebui/css/plugins.css', './guguwebui_static/css/plugins.css')
    __copyFile(server, 'guguwebui/custom/overall.css', './guguwebui_static/custom/overall.css')
    __copyFile(server, 'guguwebui/custom/overall.js', './guguwebui_static/custom/overall.js')
    __copyFile(server, 'guguwebui/custom/server_lang.json', './server/server_lang.json')
    __copyFile(server, 'guguwebui/js/about.js', './guguwebui_static/js/about.js')
    __copyFile(server, 'guguwebui/js/home.js', './guguwebui_static/js/home.js')
    __copyFile(server, 'guguwebui/js/index.js', './guguwebui_static/js/index.js')
    __copyFile(server, 'guguwebui/js/login.js', './guguwebui_static/js/login.js')
    __copyFile(server, 'guguwebui/js/mc.js', './guguwebui_static/js/mc.js')
    __copyFile(server, 'guguwebui/js/plugins.js', './guguwebui_static/js/plugins.js')
    __copyFile(server, 'guguwebui/js/online-plugins.js', './guguwebui_static/js/online-plugins.js')
    __copyFile(server, 'guguwebui/js/overall.js', './guguwebui_static/js/overall.js')
    __copyFile(server, 'guguwebui/src/bg.png', './guguwebui_static/src/bg.png')
    __copyFile(server, 'guguwebui/src/checkbox_select.png', './guguwebui_static/src/checkbox_select.png')
    __copyFile(server, 'guguwebui/src/default_avatar.jpg', './guguwebui_static/src/default_avatar.jpg')
    __copyFile(server, 'guguwebui/templates/404.html', './guguwebui_static/templates/404.html')
    __copyFile(server, 'guguwebui/templates/about.html', './guguwebui_static/templates/about.html')
    __copyFile(server, 'guguwebui/templates/cq.html', './guguwebui_static/templates/cq.html')
    __copyFile(server, 'guguwebui/templates/fabric.html', './guguwebui_static/templates/fabric.html')
    __copyFile(server, 'guguwebui/templates/gugubot.html', './guguwebui_static/templates/gugubot.html')
    __copyFile(server, 'guguwebui/templates/home.html', './guguwebui_static/templates/home.html')
    __copyFile(server, 'guguwebui/templates/index.html', './guguwebui_static/templates/index.html')
    __copyFile(server, 'guguwebui/templates/login.html', './guguwebui_static/templates/login.html')
    __copyFile(server, 'guguwebui/templates/mc.html', './guguwebui_static/templates/mc.html')
    __copyFile(server, 'guguwebui/templates/mcdr.html', './guguwebui_static/templates/mcdr.html')
    __copyFile(server, 'guguwebui/templates/plugins.html', './guguwebui_static/templates/plugins.html')
    __copyFile(server, 'guguwebui/templates/online-plugins.html', './guguwebui_static/templates/online-plugins.html')

# Command to generate __copyFile list above
# import os
# from pathlib import Path
# def generate_copy_instructions(source_dir, target_base_dir):
#     instructions = []
#     source_dir = Path(source_dir)
#     for name in os.listdir(source_dir):
#         if not os.path.isdir(name) or name in ["utils", "__pycache__"]:
#             continue
#         for file_name in os.listdir(source_dir / name):
#             instructions.append(
#                 f"__copyFile(server, 'guguwebui/{name}/{file_name}', '{target_base_dir}/{name}/{file_name}')"
#             )

#     return instructions

# for i in generate_copy_instructions("./", "./guguwebui_static"):
#     print(i)

#============================================================#