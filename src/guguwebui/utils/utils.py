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
    if Path(MCDR_plugin_folder).exists():
        # 直接使用存在的目录
        response += [file for file in Path(MCDR_plugin_folder).rglob("*") if file.suffix.lower() in config_suffix]
    else:
        # 查找不区分大小写的目录
        config_dir = Path("./config")
        if config_dir.exists():
            for item in config_dir.iterdir():
                if item.is_dir() and item.name.lower() == plugin_id.lower():
                    response += [file for file in item.rglob("*") if file.suffix.lower() in config_suffix]
    
    # Configs in ./config/
    for file_path in single_file_paths:
        if file_path.exists():
            response.append(file_path)
        else:
            # 查找不区分大小写的文件
            parent_dir = file_path.parent
            if parent_dir.exists():
                for item in parent_dir.iterdir():
                    if item.is_file() and item.stem.lower() == plugin_id.lower() and item.suffix.lower() in config_suffix:
                        response.append(item)

    # filter out translation files
    response = [str(i) for i in response if not Path(i).stem.lower().endswith("_lang")]

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
    target_plugin = ["player_ip_logger", "online_player_api", "gugubot", "cq_qq_api", "guguwebui"]
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
        try:
            # 创建PIMHelper实例来获取插件元数据
            from guguwebui.utils.PIM import PIMHelper
            
            class DummySource:
                def reply(self, message):
                    pass
                    
                def get_server(self):
                    return server_interface
            
            # 初始化PIMHelper并获取插件目录元数据
            pim_helper = PIMHelper(server_interface)
            dummy_source = DummySource()
            cata_meta = pim_helper.get_cata_meta(dummy_source)
            
            # 获取所有插件数据并提取最新版本号
            plugins = cata_meta.get_plugins()
            return {plugin_id: plugin_data.latest_version for plugin_id, plugin_data in plugins.items()}
        except Exception as e:
            # print(f"Error fetching plugin versions from PIM: {e}")
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
        
        # 格式化版本号，去除插件ID前缀和v前缀
        if latest_version and ("-v" in latest_version or "-" in latest_version):
            version_parts = latest_version.split("-v")
            if len(version_parts) > 1:
                latest_version = version_parts[1]  # 使用-v分隔的后半部分
            else:
                # 尝试使用'-'分隔并保留最后一部分
                version_parts = latest_version.split("-")
                if len(version_parts) > 1:
                    latest_version = version_parts[-1]
                    # 如果最后一部分以'v'开头，去掉'v'
                    if latest_version.startswith("v"):
                        latest_version = latest_version[1:]

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
        # print(data)
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

def __copyFolder(server, folder_path, target_folder):
    """
    从插件内部提取一个文件夹到指定目录
    
    :param server: PluginServerInterface实例
    :param folder_path: 插件内的文件夹路径
    :param target_folder: 目标目录路径
    """
    # 确保目标目录存在
    target_folder = Path(target_folder)
    target_folder.mkdir(parents=True, exist_ok=True)
    
    try:
        # 首先尝试作为文件处理，如果成功，则说明这是一个文件而不是文件夹
        try:
            with server.open_bundled_file(folder_path) as _:
                # 如果能打开，说明是文件，直接复制
                __copyFile(server, folder_path, target_folder)
                return True
        except FileNotFoundError:
            # 不是文件，继续作为文件夹处理
            pass
        except Exception as e:
            # 其他错误，记录并继续
            server.logger.debug(f"尝试作为文件处理'{folder_path}'时出错: {e}")
            pass

        # 尝试使用插件的内部方法列出文件夹内容
        items = []
        try:
            # 使用__plugin是插件内部属性，可能不稳定，但是尝试直接访问
            items = server._PluginServerInterface__plugin.list_directory(folder_path)
        except Exception:
            # 如果上面的方法失败，尝试其他方法
            # 直接使用MultiFilePlugin.list_directory方法
            from mcdreforged.plugin.type.multi_file_plugin import MultiFilePlugin
            if isinstance(server._PluginServerInterface__plugin, MultiFilePlugin):
                items = server._PluginServerInterface__plugin.list_directory(folder_path)
        
        if not items:
            server.logger.warning(f"无法获取文件夹 '{folder_path}' 的内容列表")
            return False
            
        for item in items:
            # 忽略__pycache__文件夹、utils文件夹和.py文件
            if item == "__pycache__" or item == "utils" or item.endswith(".py"):
                server.logger.debug(f"忽略文件/文件夹: {item}")
                continue
                
            # 构建插件内的完整路径
            plugin_item_path = f"{folder_path}/{item}"
            # 构建目标路径
            target_item_path = target_folder / item
            
            # 尝试判断是文件还是文件夹
            try:
                # 尝试作为文件打开
                with server.open_bundled_file(plugin_item_path) as _:
                    # 如果能打开，说明是文件，直接复制
                    __copyFile(server, plugin_item_path, target_item_path)
            except Exception:
                # 如果打开失败，可能是文件夹，尝试递归复制
                __copyFolder(server, plugin_item_path, target_item_path)
                
        server.logger.debug(f"成功从插件提取文件夹 '{folder_path}' 到 '{target_folder}'")
        return True
    except Exception as e:
        server.logger.error(f"提取插件文件夹 '{folder_path}' 时出错: {e}")
        return False
        
def amount_static_files(server):
    # 创建主目录
    os.makedirs('./guguwebui_static', exist_ok=True)
    
    # 使用新的文件夹复制函数来复制各个目录
    success = True
    # 复制各个子目录
    for folder in ['src', 'css', 'js', 'templates', 'custom']:
        if not __copyFolder(server, f'guguwebui/{folder}', f'./guguwebui_static/{folder}'):
            success = False
            server.logger.warning(f"复制 'guguwebui/{folder}' 目录失败")
    
    if success:
        server.logger.debug("成功复制所有guguwebui目录")
        return
    
    # 如果文件夹复制失败，退回到单文件复制方式
    server.logger.warning("部分文件夹复制失败")

# 检查是否存在旧配置，并自动继承旧的deepseek_api_key和deepseek_model参数
def migrate_old_config():
    try:
        plugin_config_dir = Path("./config") / "guguwebui"
        config_path = plugin_config_dir / "config.json"
        
        # 如果存在旧配置文件
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                old_config = json.load(f)
                
            # 检查是否存在旧的deepseek参数
            need_save = False
            
            # 如果存在旧的deepseek_api_key参数且ai_api_key为空
            if "deepseek_api_key" in old_config and old_config["deepseek_api_key"] and not old_config.get("ai_api_key"):
                old_config["ai_api_key"] = old_config["deepseek_api_key"]
                need_save = True
                
            # 如果存在旧的deepseek_model参数且ai_model为空
            if "deepseek_model" in old_config and old_config["deepseek_model"] and not old_config.get("ai_model"):
                old_config["ai_model"] = old_config["deepseek_model"]
                need_save = True
                
            # 删除旧参数
            if "deepseek_api_key" in old_config:
                del old_config["deepseek_api_key"]
                need_save = True
                
            if "deepseek_model" in old_config:
                del old_config["deepseek_model"]
                need_save = True
                
            # 如果有变更，保存配置
            if need_save:
                # 确保配置目录存在
                plugin_config_dir.mkdir(parents=True, exist_ok=True)
                
                # 保存更新后的配置
                with open(config_path, "w", encoding="utf-8") as f:
                    json.dump(old_config, f, ensure_ascii=False, indent=4)
    except Exception as e:
        pass

#============================================================#

def get_minecraft_log_path(server_interface=None):
    """
    获取Minecraft服务器日志文件的完整路径
    基于MCDR配置中的working_directory值
    
    Args:
        server_interface: MCDR服务器接口，用于获取配置
        
    Returns:
        str: Minecraft服务器日志文件的完整路径
    """
    try:
        import os
        from ruamel.yaml import YAML
        
        # 尝试通过服务器接口获取配置
        working_directory = None
        if server_interface:
            try:
                # 尝试获取MCDR配置中的工作目录
                mcdr_config = server_interface.get_mcdr_config()
                if hasattr(mcdr_config, 'working_directory'):
                    working_directory = mcdr_config.working_directory
            except:
                pass
        
        # 如果无法通过接口获取，尝试读取配置文件
        if not working_directory:
            # 尝试读取MCDR的配置文件
            mcdr_config_path = "config.yml"
            if not os.path.exists(mcdr_config_path):
                # 如果找不到配置文件，返回默认路径
                return "server/logs/latest.log"
            
            # 读取配置文件
            yaml = YAML()
            with open(mcdr_config_path, 'r', encoding='utf-8') as f:
                config = yaml.load(f)
            
            # 获取工作目录
            working_directory = config.get('working_directory', '')
        
        # 构建日志路径
        if working_directory:
            return os.path.join(working_directory, "logs", "latest.log")
        else:
            return "server/logs/latest.log"
    except Exception as e:
        # 出错时返回默认路径
        return "server/logs/latest.log"

#============================================================#