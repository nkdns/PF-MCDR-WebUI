import os
import re
import shutil
import json
import threading
import time
import sys
import requests
import lzma
import uuid
from typing import List, Dict, Optional, Union, Tuple, Any, Set
from dataclasses import dataclass

from mcdreforged.api.all import *
from mcdreforged.plugin.meta.version import Version, VersionRequirement
from mcdreforged.minecraft.rtext.style import RColor, RAction, RStyle
from mcdreforged.minecraft.rtext.text import RText, RTextList

# 添加元数据信息
PLUGIN_METADATA = {
    'id': 'pim_helper',
    'version': '1.1.0',
    'name': 'PIM Helper',
    'description': '自定义的安装MCDR插件的辅助工具',
    'author': 'LoosePrince',
    'link': '',
    'dependencies': {}
}

# 添加待删除文件的全局变量
PENDING_DELETE_FILES = {}  # {plugin_id: [file_paths]}

# 添加全局插件安装器变量
plugin_installer = None

# 全局元数据注册表
_global_registry = None

# 自定义实现，替代MCDR内部模块
class PluginRequirementSource:
    existing = "existing"
    existing_pinned = "existing_pinned"

# 扩展VersionRequirement类，添加check方法
class ExtendedVersionRequirement(VersionRequirement):
    def check(self, version: str) -> bool:
        """调用accept方法，兼容我们的代码"""
        return self.accept(version)

@dataclass
class PluginRequirement:
    id: str
    requirement: VersionRequirement
    
    def satisfied_by(self, plugin_id: str, version: str) -> bool:
        return self.id == plugin_id and self.requirement.accept(version)

@dataclass
class ReleaseData:
    """发布数据类"""
    name: str
    tag_name: str
    created_at: str
    description: str
    prerelease: bool
    url: str
    browser_download_url: str
    download_count: int
    size: int
    file_name: str
    
    @property
    def version(self) -> str:
        """获取版本号，兼容原始接口"""
        return self.tag_name.lstrip('v') if self.tag_name else ""

@dataclass
class PluginData:
    """插件数据类"""
    id: str
    name: str
    version: str
    description: Dict[str, str]
    author: List[str]
    link: str
    dependencies: Dict[str, VersionRequirement]
    requirements: List[str]
    releases: List[ReleaseData] = None
    repos_owner: str = ""
    repos_name: str = ""
    
    def __post_init__(self):
        if self.releases is None:
            self.releases = []
        
        # 尝试从link中解析仓库信息
        if self.link and 'github.com' in self.link:
            try:
                parts = self.link.split('github.com/')[1].split('/')
                if len(parts) >= 2:
                    self.repos_owner = parts[0]
                    self.repos_name = parts[1]
            except:
                pass
    
    def get_dependencies(self) -> Dict[str, VersionRequirement]:
        """获取依赖项"""
        return self.dependencies
    
    def get_latest_release(self) -> Optional[ReleaseData]:
        """获取最新版本"""
        if not self.releases:
            return None
        return self.releases[0]
    
    @property
    def latest_version(self) -> Optional[str]:
        """获取最新版本号，兼容原始接口"""
        release = self.get_latest_release()
        if release:
            return release.tag_name.lstrip('v') if release.tag_name else self.version
        return self.version

class EmptyMetaRegistry:
    """空元数据注册表"""
    def __init__(self):
        self.plugins = {}
    
    def get_plugin_data(self, plugin_id: str) -> Optional[PluginData]:
        return None
    
    def has_plugin(self, plugin_id: str) -> bool:
        return False
    
    def get_plugins(self) -> Dict[str, PluginData]:
        return {}

class MetaRegistry:
    """简化的元数据注册表实现"""
    def __init__(self, data: Dict = None):
        self.data = data or {}
        self.plugins: Dict[str, PluginData] = {}
        self._parse_data()
    
    def _parse_data(self):
        """解析数据为插件数据对象"""
        if not self.data or 'plugins' not in self.data:
            return
        
        for plugin_id, plugin_info in self.data['plugins'].items():
            meta = plugin_info.get('meta', {})
            release_info = plugin_info.get('release', {})
            releases = []
            
            for rel in release_info.get('releases', []):
                asset = rel.get('asset', {})
                release_data = ReleaseData(
                    name=rel.get('name', ''),
                    tag_name=rel.get('tag_name', ''),
                    created_at=rel.get('created_at', ''),
                    description=rel.get('description', ''),
                    prerelease=rel.get('prerelease', False),
                    url=rel.get('url', ''),
                    browser_download_url=asset.get('browser_download_url', ''),
                    download_count=asset.get('download_count', 0),
                    size=asset.get('size', 0),
                    file_name=asset.get('name', '')
                )
                releases.append(release_data)
            
            dependencies = {}
            for dep_id, dep_req in meta.get('dependencies', {}).items():
                dependencies[dep_id] = ExtendedVersionRequirement(dep_req)
            
            plugin_data = PluginData(
                id=meta.get('id', plugin_id),
                name=meta.get('name', plugin_id),
                version=meta.get('version', ''),
                description=meta.get('description', {}),
                author=meta.get('authors', []),
                link=meta.get('link', ''),
                dependencies=dependencies,
                requirements=meta.get('requirements', []),
                releases=releases
            )
            
            self.plugins[plugin_id] = plugin_data
    
    def get_plugin_data(self, plugin_id: str) -> Optional[PluginData]:
        """获取指定ID的插件数据"""
        return self.plugins.get(plugin_id)
    
    def has_plugin(self, plugin_id: str) -> bool:
        """检查是否存在指定ID的插件"""
        return plugin_id in self.plugins
    
    def get_plugins(self) -> Dict[str, PluginData]:
        """获取所有插件数据"""
        return self.plugins
    
    def filter_plugins(self, keyword: str = None) -> List[str]:
        """根据关键词筛选插件"""
        result = []
        if not keyword:
            return list(self.plugins.keys())
        
        # 先尝试直接匹配ID
        for plugin_id, plugin_data in self.plugins.items():
            if keyword.lower() in plugin_id.lower():
                result.append(plugin_id)
            # 然后尝试匹配名称
            elif plugin_data.name and keyword.lower() in plugin_data.name.lower():
                result.append(plugin_id)
            # 最后尝试匹配描述
            elif plugin_data.description:
                for lang, desc in plugin_data.description.items():
                    if desc and keyword.lower() in desc.lower():
                        result.append(plugin_id)
                        break
        
        return result

def get_global_registry() -> MetaRegistry:
    """
    获取全局元数据注册表
    如果不存在，则创建一个新的，加载 everything_slim.json 数据
    
    Returns:
        MetaRegistry: 全局元数据注册表
    """
    global _global_registry
    
    if _global_registry is None:
        # 使用缓存目录存放缓存
        cache_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "cache")
        cache_file = os.path.join(cache_dir, "everything_slim.json")
        
        # 创建缓存目录
        os.makedirs(cache_dir, exist_ok=True)
        
        # 如果缓存文件存在，读取并解析
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    everything_data = json.load(f)
                # 创建元数据注册表
                _global_registry = MetaRegistry(everything_data)
            except Exception:
                # 解析失败，返回空注册表
                _global_registry = EmptyMetaRegistry()
        else:
            # 缓存文件不存在，返回空注册表
            _global_registry = EmptyMetaRegistry()
    
    return _global_registry

class PluginCatalogueAccess:
    """插件目录访问实现，替代MCDR内部实现"""
    @staticmethod
    def filter_sort(plugins: List[PluginData], keyword: str = None) -> List[PluginData]:
        """筛选并排序插件"""
        if not keyword:
            return list(plugins)
        
        keyword = keyword.lower()
        result = []
        
        for plugin in plugins:
            if (keyword in plugin.id.lower() or 
                keyword in plugin.name.lower() or
                any(keyword in str(desc).lower() for desc in plugin.description.values())):
                result.append(plugin)
        
        return result
    
    @staticmethod
    def list_plugin(meta: MetaRegistry, replier, keyword: str = None, table_header: Tuple = None) -> int:
        """列出插件"""
        plugins = list(meta.get_plugins().values())
        filtered_plugins = PluginCatalogueAccess.filter_sort(plugins, keyword)
        
        if not filtered_plugins:
            replier.reply(f"没有找到包含关键词 '{keyword}' 的插件")
            return 0
        
        # 显示表格信息
        replier.reply(f"找到 {len(filtered_plugins)} 个插件:")
        
        for plugin in filtered_plugins:
            desc = plugin.description.get('zh_cn', 
                   plugin.description.get('en_us', '无描述'))
            
            replier.reply(f"{plugin.id} | {plugin.name} | {plugin.version} | {desc}")
        
        return len(filtered_plugins)
    
    @staticmethod
    def download_plugin(meta: MetaRegistry, replier, plugin_ids: List[str], target_dir: str) -> int:
        """下载插件"""
        success_count = 0
        
        if not os.path.exists(target_dir):
            os.makedirs(target_dir)
        
        downloader = ReleaseDownloader()
        
        for plugin_id in plugin_ids:
            plugin_data = meta.get_plugin_data(plugin_id)
            
            if not plugin_data:
                replier.reply(f"未找到插件 {plugin_id}")
                continue
            
            release = plugin_data.get_latest_release()
            if not release or not release.browser_download_url:
                replier.reply(f"插件 {plugin_id} 没有可用的下载链接")
                continue
            
            file_name = release.file_name or f"{plugin_id}.mcdr"
            target_path = os.path.join(target_dir, file_name)
            
            replier.reply(f"正在下载 {plugin_id} 到 {target_path}")
            if downloader.download(release.browser_download_url, target_path):
                replier.reply(f"下载 {plugin_id} 成功")
                success_count += 1
            else:
                replier.reply(f"下载 {plugin_id} 失败")
        
        return success_count

class ReleaseDownloader:
    """发布下载器"""
    def __init__(self, server=None):
        self.server = server
    
    def download(self, url: str, target_path: str) -> bool:
        """下载文件到指定路径"""
        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                os.makedirs(os.path.dirname(target_path), exist_ok=True)
                with open(target_path, 'wb') as f:
                    f.write(response.content)
                return True
            return False
        except Exception as e:
            if self.server:
                self.server.logger.error(f"下载文件失败: {e}")
            return False

class CommandSourceReplier:
    """命令源回复器"""
    def __init__(self, source):
        self.source = source
    
    def reply(self, message, **kwargs):
        """回复消息"""
        if hasattr(self.source, 'reply'):
            self.source.reply(message)

class PluginDependencyResolver:
    """插件依赖解析器"""
    def __init__(self, meta_registry: MetaRegistry):
        self.meta_registry = meta_registry
    
    def resolve_dependencies(self, plugin_id: str) -> Tuple[List[str], Dict[str, str]]:
        """解析插件依赖
        返回: (缺失的依赖列表, 满足的依赖字典)
        """
        plugin_data = self.meta_registry.get_plugin_data(plugin_id)
        if not plugin_data:
            return [], {}
        
        missing_deps = []
        resolved_deps = {}
        
        for dep_id, req in plugin_data.get_dependencies().items():
            dep_data = self.meta_registry.get_plugin_data(dep_id)
            if not dep_data:
                missing_deps.append(dep_id)
            else:
                if req.accept(dep_data.version):
                    resolved_deps[dep_id] = dep_data.version
                else:
                    missing_deps.append(dep_id)  # 版本不匹配视为缺失
        
        return missing_deps, resolved_deps

def as_requirement(plugin_id: str, version: str, op: Optional[str] = None) -> PluginRequirement:
    if op is not None:
        req = op + version
    else:
        req = ''
    return PluginRequirement(
        id=plugin_id,
        requirement=ExtendedVersionRequirement(req),
    )

class PIMHelper:
    def __init__(self, server: PluginServerInterface):
        self.server = server
        self.logger = server.logger
        # 获取内部的MetaRegistryHolder
        try:
            # 尝试直接获取 plugin_manager
            # plugin_manager = server._PluginServerInterface__plugin.plugin_manager
            # self.logger.info("成功获取plugin_manager")
            
            # 不再尝试获取 pim_ext 对象，直接使用其他可用API
            # self.logger.info("直接使用替代API，不获取pim_ext对象")
            
            # 设置为 None，在后续方法中使用替代API
            self.pim_ext = None
            self.meta_holder = None
            self.tr = None
            self.install_handler = None
            
            # self.logger.info("成功初始化PIM辅助工具")
        except Exception as e:
            self.logger.error(f"初始化PIM辅助工具失败: {e}")
            raise

    def get_cata_meta(self, source, ignore_ttl: bool = False) -> MetaRegistry:
        """获取插件目录元数据，使用everything_slim.json"""
        # 使用缓存目录存放缓存
        cache_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "cache")
        cache_file = os.path.join(cache_dir, "everything_slim.json")
        cache_xz_file = os.path.join(cache_dir, "everything_slim.json.xz")
        
        # 创建缓存目录
        os.makedirs(cache_dir, exist_ok=True)
        
        # 检查缓存是否过期（2小时）
        cache_expired = True
        if os.path.exists(cache_file):
            file_time = os.path.getmtime(cache_file)
            if not ignore_ttl and time.time() - file_time < 7200:  # 2小时 = 7200秒
                cache_expired = False
        
        # 如果缓存已过期或不存在，则下载并解压新文件
        if cache_expired:
            try:
                source.reply("正在获取插件目录元数据...")
                # 从配置中获取插件目录URL
                server_config = self.server.load_config_simple("config.json", {"mcdr_plugins_url": "https://api.mcdreforged.com/catalogue/everything_slim.json.xz"})
                url = server_config.get("mcdr_plugins_url", "https://api.mcdreforged.com/catalogue/everything_slim.json.xz")
                response = requests.get(url, timeout=30)  # 增加超时时间设置
                
                if response.status_code == 200:
                    # 保存压缩文件
                    with open(cache_xz_file, 'wb') as f:
                        f.write(response.content)
                    
                    # 解压文件
                    with lzma.open(cache_xz_file, 'rb') as f_in:
                        with open(cache_file, 'wb') as f_out:
                            f_out.write(f_in.read())
                    source.reply("获取元数据成功")
                else:
                    source.reply(f"获取元数据失败: HTTP {response.status_code}")
                    # 如果下载失败但缓存文件存在，继续使用旧缓存
                    if not os.path.exists(cache_file):
                        source.reply("缓存不存在，返回空元数据")
                        return EmptyMetaRegistry()
            except Exception as e:
                source.reply(f"获取元数据失败: {e}")
                # 下载或解压出错，如果缓存文件存在则使用旧缓存
                if not os.path.exists(cache_file):
                    return EmptyMetaRegistry()
        
        # 读取并解析文件
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                everything_data = json.load(f)
            
            # 创建元数据注册表
            return MetaRegistry(everything_data)
        except Exception as e:
            source.reply(f"解析元数据失败: {e}")
            return EmptyMetaRegistry()

    def list_plugins(self, source, keyword: Optional[str] = None) -> int:
        """列出插件目录中的插件"""
        cata_meta = self.get_cata_meta(source)
        # 使用自定义实现
        return PluginCatalogueAccess.list_plugin(
            meta=cata_meta,
            replier=CommandSourceReplier(source),
            keyword=keyword,
            table_header=("ID", "名称", "版本", "描述")
        )
        
    def download_plugins(self, source, plugin_ids: List[str], target_dir: str) -> int:
        """下载插件到指定目录"""
        cata_meta = self.get_cata_meta(source)
        # 使用自定义实现而非MCDR内部接口
        success_count = 0
        
        if not os.path.exists(target_dir):
            os.makedirs(target_dir)
        
        downloader = ReleaseDownloader(self.server)
        
        for plugin_id in plugin_ids:
            plugin_data = cata_meta.get_plugin_data(plugin_id)
            
            if not plugin_data:
                source.reply(f"未找到插件 {plugin_id}")
                continue
            
            release = plugin_data.get_latest_release()
            if not release or not release.browser_download_url:
                source.reply(f"插件 {plugin_id} 没有可用的下载链接")
                continue
            
            file_name = release.file_name or f"{plugin_id}.mcdr"
            target_path = os.path.join(target_dir, file_name)
            
            source.reply(f"正在下载 {plugin_id} 到 {target_path}")
            if downloader.download(release.browser_download_url, target_path):
                source.reply(f"下载 {plugin_id} 成功")
                success_count += 1
            else:
                source.reply(f"下载 {plugin_id} 失败")
        
        return success_count
        
    def get_local_plugins(self) -> Dict[str, List[str]]:
        """
        获取本地插件信息，包括已加载、未加载和禁用的
        返回: Dict[str, List[str]] - 包含插件路径的字典
        """
        result = {
            'loaded': {},    # 已加载插件 {id: path}
            'unloaded': [],  # 未加载的 .mcdr 文件路径
            'disabled': []   # 禁用的插件文件路径
        }
        
        # 获取已加载的插件信息
        loaded_plugin_ids = self.server.get_plugin_list()
        for plugin_id in loaded_plugin_ids:
            plugin_instance = self.server.get_plugin_instance(plugin_id)
            if plugin_instance:
                # Try to get path, might still rely on internal attribute
                plugin_path = getattr(plugin_instance, 'file_path', None)
                if plugin_path:
                    result['loaded'][plugin_id] = str(plugin_path)
        
        # 获取配置中的插件目录
        mcdr_config = self.server.get_mcdr_config()
        plugin_dirs = []
        
        if 'plugin_directories' in mcdr_config and mcdr_config['plugin_directories']:
            plugin_dirs = mcdr_config['plugin_directories']
        else:
            default_plugin_dir = os.path.join(os.getcwd(), 'plugins')
            if os.path.isdir(default_plugin_dir):
                plugin_dirs = [default_plugin_dir]
        
        # 获取禁用的插件列表
        disabled_plugins = []
        try:
            # 从MCDR获取禁用的插件列表
            disabled_plugins = self.server.get_disabled_plugin_list()
        except:
            self.logger.debug("无法获取禁用插件列表")
        
        # 扫描所有.mcdr和.py文件
        for plugin_dir in plugin_dirs:
            if not os.path.isdir(plugin_dir):
                continue
                
            for file_name in os.listdir(plugin_dir):
                if file_name.endswith('.mcdr') or file_name.endswith('.py'):
                    file_path = os.path.join(plugin_dir, file_name)
                    
                    # 检查是否已加载
                    if file_path not in result['loaded'].values():
                        # 检查是否为禁用插件
                        is_disabled = False
                        plugin_id = self.detect_unloaded_plugin_id(file_path)
                        
                        if plugin_id and plugin_id in disabled_plugins:
                            result['disabled'].append(file_path)
                            is_disabled = True
                            
                        # 如果不是禁用的，则添加到未加载列表
                        if not is_disabled:
                            result['unloaded'].append(file_path)
        
        return result
        
    def detect_unloaded_plugin_id(self, plugin_path: str) -> Optional[str]:
        """
        检测未加载插件的ID
        """
        try:
            import zipfile
            import json
            from pathlib import Path
            
            if not os.path.exists(plugin_path):
                return None
            
            # 处理.py文件
            if plugin_path.endswith('.py'):
                try:
                    with open(plugin_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                        # 尝试查找PLUGIN_METADATA定义
                        import re
                        metadata_match = re.search(r'PLUGIN_METADATA\s*=\s*({[^}]+})', content)
                        if metadata_match:
                            metadata_str = metadata_match.group(1)
                            # 将单引号替换为双引号，以便json解析
                            metadata_str = metadata_str.replace("'", '"')
                            try:
                                metadata = json.loads(metadata_str)
                                if 'id' in metadata:
                                    return metadata['id']
                            except:
                                pass
                except:
                    pass
                
                # 尝试直接从文件名中提取ID
                basename = os.path.basename(plugin_path)
                if basename.endswith('.py'):
                    return basename[:-3]  # 移除.py后缀
                    
                return None
            
            # 处理zip或mcdr文件
            if not zipfile.is_zipfile(plugin_path):
                return None
                
            with zipfile.ZipFile(plugin_path, 'r') as zip_ref:
                file_list = zip_ref.namelist()
                
                # 寻找mcdr_plugin.json或mcdreforged.plugin.json
                json_file = None
                for f in file_list:
                    if f.endswith('mcdr_plugin.json') or f == 'mcdr_plugin.json' or f.endswith('mcdreforged.plugin.json') or f == 'mcdreforged.plugin.json':
                        json_file = f
                        break
                
                if not json_file:
                    return None
                    
                with zip_ref.open(json_file) as f:
                    metadata = json.load(f)
                    if 'id' in metadata:
                        return metadata['id']
            
            return None
        except Exception as e:
            self.logger.debug(f"检测插件ID失败: {e}")
            return None
            
    def check_plugin_dependencies(self, source, plugin_id: str, cata_meta: MetaRegistry = None, downloaded_file: str = None) -> Tuple[List[str], Dict[str, str]]:
        """
        检查插件依赖，返回需要先安装的依赖插件列表和需要更新的依赖
        返回值: (missing_deps, outdated_deps)
            missing_deps: 缺失的依赖列表
            outdated_deps: 需要更新的依赖字典 {插件ID: 需要的版本}
        """
        if cata_meta is None:
            cata_meta = self.get_cata_meta(source)
            
        # 获取插件数据
        plugin_data = cata_meta.get_plugin_data(plugin_id)
        if not plugin_data:
            source.reply(f"无法检查依赖: 未找到插件 '{plugin_id}'")
            return [], {}
            
        # 获取已安装的插件
        installed_plugins = {}
        for pid in self.server.get_plugin_list():
            instance = self.server.get_plugin_instance(pid)
            if instance:
                installed_plugins[pid] = instance
        
        # 检查依赖
        missing_deps = []
        outdated_deps = {}
        
        # 检查元数据中的依赖
        if plugin_data.dependencies:
            source.reply(f"检查插件 {plugin_id} 的依赖...")
            
            for dep_id, version_req in plugin_data.dependencies.items():
                # 检查依赖插件是否已安装
                if dep_id not in installed_plugins:
                    missing_deps.append(dep_id)
                    source.reply(f"缺少依赖插件: {dep_id} {version_req}")
                else:
                    # 检查版本是否符合要求
                    installed_plugin = installed_plugins[dep_id]
                    installed_metadata = self.server.get_plugin_metadata(dep_id)
                    installed_version = str(installed_metadata.version) if installed_metadata else 'unknown'
                    
                    # 解析版本需求
                    try:
                        if not VersionRequirement(version_req).accept(Version(installed_version)):
                            source.reply(RText(f"依赖版本不满足: {dep_id}@{installed_version} 不满足 {version_req}", color=RColor.yellow))
                            outdated_deps[dep_id] = str(version_req)
                        else:
                            source.reply(f"已安装依赖: {dep_id}@{installed_version} 满足要求 {version_req}")
                    except Exception as e:
                        source.reply(f"版本检查错误: {e}")
                        source.reply(f"已安装依赖: {dep_id}@{installed_version}")
        
        # 尝试从下载的文件获取MCDR插件依赖信息
        if downloaded_file and os.path.exists(downloaded_file):
            source.reply(f"检查插件 {plugin_id} 的MCDR插件依赖...")
            try:
                # 解压并检查mcdr_plugin.json
                import zipfile
                import json
                
                if not zipfile.is_zipfile(downloaded_file):
                    source.reply(f"插件文件不是有效的zip格式，无法检查MCDR插件依赖")
                    return missing_deps, outdated_deps
                
                with zipfile.ZipFile(downloaded_file, 'r') as zip_ref:
                    file_list = zip_ref.namelist()
                    
                    # 查找mcdr_plugin.json
                    mcdr_plugin_json = None
                    for file_path in file_list:
                        if file_path.endswith('mcdr_plugin.json') or file_path == 'mcdr_plugin.json' or file_path.endswith('mcdreforged.plugin.json'):
                            mcdr_plugin_json = file_path
                            break
                    
                    if not mcdr_plugin_json:
                        source.reply(f"未在插件中找到MCDR元数据文件")
                        return missing_deps, outdated_deps
                    
                    # 读取元数据
                    with zip_ref.open(mcdr_plugin_json) as f:
                        meta_content = f.read().decode('utf-8')
                        meta = json.loads(meta_content)
                        
                        # 检查MCDR插件依赖
                        if 'dependencies' in meta:
                            deps = meta['dependencies']
                            for dep_id, version_req in deps.items():
                                # 跳过MCDR本身和Python版本要求
                                if dep_id.lower() == 'mcdreforged' or dep_id.lower() == 'python':
                                    continue
                                
                                # 检查依赖是否已安装
                                if dep_id not in installed_plugins:
                                    missing_deps.append(dep_id)
                                    source.reply(f"缺少MCDR插件依赖: {dep_id} {version_req}")
                                else:
                                    # 检查版本是否符合要求
                                    installed_plugin = installed_plugins[dep_id]
                                    installed_metadata = self.server.get_plugin_metadata(dep_id)
                                    installed_version = str(installed_metadata.version) if installed_metadata else 'unknown'
                                    
                                    try:
                                        version_requirement = VersionRequirement(version_req)
                                        if not version_requirement.accept(Version(installed_version)):
                                            source.reply(RText(f"依赖版本不满足: {dep_id}@{installed_version} 不满足 {version_req}", color=RColor.yellow))
                                            outdated_deps[dep_id] = version_req
                                        else:
                                            source.reply(RText(f"已安装MCDR插件依赖: {dep_id}@{installed_version} 满足要求 {version_req}", color=RColor.green))
                                    except Exception as e:
                                        source.reply(f"版本检查错误: {e}")
                                        source.reply(f"已安装MCDR插件依赖: {dep_id}@{installed_version}")
                        else:
                            source.reply(RText("插件没有声明MCDR插件依赖", color=RColor.green))
            except Exception as e:
                source.reply(f"检查MCDR插件依赖时出错: {e}")
                self.logger.exception(f"检查插件 {plugin_id} 的MCDR插件依赖时出错")
        # 如果没有本地文件，尝试下载插件以检查依赖
        elif not downloaded_file and plugin_data.releases:
            source.reply(f"尝试下载插件以检查依赖...")
            try:
                # 获取最新版本
                release = plugin_data.get_latest_release()
                if not release or not release.browser_download_url:
                    source.reply(f"无法获取插件 {plugin_id} 的下载链接")
                    return missing_deps, outdated_deps
                
                # 创建临时目录
                temp_dir = self.get_temp_dir()
                os.makedirs(temp_dir, exist_ok=True)
                
                # 下载文件
                from pathlib import Path
                import tempfile
                
                with tempfile.TemporaryDirectory(dir=temp_dir) as tmp_dir:
                    temp_file = os.path.join(tmp_dir, release.file_name or f"{plugin_id}.mcdr")
                    
                    # 下载插件
                    downloader = ReleaseDownloader(self.server)
                    source.reply(f"正在下载 {plugin_id} 以检查依赖...")
                    
                    if downloader.download(release.browser_download_url, temp_file):
                        # 递归调用自身检查依赖
                        return self.check_plugin_dependencies(source, plugin_id, cata_meta, temp_file)
                    else:
                        source.reply(f"下载插件失败，无法检查MCDR插件依赖")
            except Exception as e:
                source.reply(f"下载插件以检查依赖时出错: {e}")
        
        # 返回缺失的依赖和需要更新的依赖
        return missing_deps, outdated_deps

    def force_delete_file(self, file_path: str) -> bool:
        """
        强制删除文件，解除占用后删除
        返回是否成功删除
        """
        try:
            import os
            import time
            import ctypes
            import subprocess
            
            # 首先尝试常规方式删除
            try:
                os.remove(file_path)
                return True
            except PermissionError:
                pass  # 文件被占用，继续尝试其他方法
            except Exception as e:
                self.logger.warning(f"删除文件时出现未知错误: {e}")
                return False
            
            # Windows系统下，尝试使用系统命令强制删除
            if os.name == 'nt':
                # 关闭打开的句柄
                try:
                    # 先关闭Python打开的文件句柄
                    import gc
                    gc.collect()
                    
                    # 使用del命令强制删除
                    subprocess.run(['del', '/f', '/q', file_path], shell=True, check=False)
                    if not os.path.exists(file_path):
                        return True
                    
                    # 如果还存在，尝试使用Windows API
                    try:
                        kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
                        MoveFileExW = kernel32.MoveFileExW
                        MoveFileExW.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_uint32]
                        
                        # MOVEFILE_DELAY_UNTIL_REBOOT = 0x4
                        # 标记文件在下次重启时删除
                        MoveFileExW(file_path, None, 4)
                        
                        # 再次尝试删除
                        os.remove(file_path)
                        return True
                    except Exception:
                        pass
                    
                    # 最后尝试使用taskkill和handle释放所有句柄
                    try:
                        # 使用handle.exe (需要提前下载Sysinternals工具)
                        # 这里会尝试使用内置cmd命令
                        # 创建临时批处理文件
                        import tempfile
                        with tempfile.NamedTemporaryFile(suffix='.bat', delete=False) as batch_file:
                            batch_path = batch_file.name
                            batch_file.write(f'@echo off\nfsutil file setZeroData offset=0 length=1000 "{file_path}"\ndel /f /q "{file_path}"'.encode())
                        
                        # 执行批处理文件
                        subprocess.run(['cmd', '/c', batch_path], shell=True, check=False)
                        
                        # 删除批处理文件
                        try:
                            os.remove(batch_path)
                        except:
                            pass
                        
                        # 检查是否删除成功
                        if not os.path.exists(file_path):
                            return True
                    except Exception:
                        pass
                except Exception as e:
                    self.logger.warning(f"强制删除文件时出错: {e}")
            
            # 最后尝试重命名后删除
            try:
                temp_path = file_path + ".to_delete"
                os.rename(file_path, temp_path)
                os.remove(temp_path)
                return True
            except Exception:
                pass
                
            return False
            
        except Exception as e:
            self.logger.warning(f"强制删除文件时出现异常: {e}")
            return False
            
    def remove_old_plugin(self, source, plugin_id: str) -> Tuple[bool, List[str]]:
        """
        标记旧版本插件文件待删除
        返回: (是否成功, 待删除文件列表)
        """
        try:
            global PENDING_DELETE_FILES
            
            # 检查插件是否已加载
            plugin = self.server.get_plugin_instance(plugin_id)
            old_path = None
            pending_files = []
            
            if plugin is not None:
                # 获取插件文件路径
                old_path = getattr(plugin, 'file_path', None)
                if old_path:
                    # 卸载插件
                    source.reply(f"卸载旧版本插件: {plugin_id}")
                    self.server.unload_plugin(plugin_id)
                    
                    # 将文件添加到待删除列表，而不是立即删除
                    pending_files.append(old_path)
            
            # 查找所有相关插件文件
            # 扫描未加载的插件
            local_plugins = self.get_local_plugins()
            for file_path in local_plugins['unloaded']:
                detected_id = self.detect_unloaded_plugin_id(file_path)
                if detected_id == plugin_id:
                    if file_path not in pending_files:  # 避免重复
                        pending_files.append(file_path)
            
            # 如果找到了待删除文件，添加到全局待删除列表
            if pending_files:
                source.reply(f"找到 {len(pending_files)} 个旧版本插件文件待删除")
                # 更新待删除列表
                if plugin_id in PENDING_DELETE_FILES:
                    # 合并列表，避免重复
                    for file_path in pending_files:
                        if file_path not in PENDING_DELETE_FILES[plugin_id]:
                            PENDING_DELETE_FILES[plugin_id].append(file_path)
                else:
                    PENDING_DELETE_FILES[plugin_id] = pending_files
                    
                source.reply(RText(f"已标记旧版本文件待删除，将在安装完成后清理", color=RColor.yellow))
                
                # 尝试解除文件占用
                for file_path in pending_files:
                    self._release_file_locks(file_path)
                    
                return True, pending_files
            else:
                return False, []
                
        except Exception as e:
            source.reply(f"标记旧版本插件文件失败: {e}")
            self.logger.exception(f"标记旧版本插件 {plugin_id} 文件失败")
            return False, []
            
    def _release_file_locks(self, file_path: str) -> None:
        """尝试解除文件占用"""
        try:
            import gc
            
            # 强制垃圾回收，释放可能的文件句柄
            gc.collect()
            
            # 在Windows系统下，尝试使用系统命令解除占用
            if os.name == 'nt':
                try:
                    import subprocess
                    # 静默执行以避免输出
                    subprocess.run(
                        f'handle -c "{file_path}" >nul 2>&1',
                        shell=True,
                        check=False,
                        timeout=2
                    )
                except Exception:
                    pass
                    
        except Exception as e:
            self.logger.debug(f"尝试解除文件占用时出错: {e}")
            
    def _delete_pending_files(self, source, plugin_id: str = None) -> None:
        """删除待删除的文件"""
        global PENDING_DELETE_FILES
        
        try:
            # 如果指定了插件ID，只删除该插件的文件
            if plugin_id is not None and plugin_id in PENDING_DELETE_FILES:
                files_to_delete = PENDING_DELETE_FILES[plugin_id]
                source.reply(RText(f"正在删除插件 {plugin_id} 的旧版本文件...", color=RColor.yellow))
                
                success_count = 0
                for file_path in files_to_delete:
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                            success_count += 1
                            source.reply(RText(f"✓ 已删除: {file_path}", color=RColor.green))
                        except Exception as e:
                            source.reply(RText(f"⚠ 常规删除失败: {e}", color=RColor.yellow))
                            
                            # 尝试强制删除
                            if self.force_delete_file(file_path):
                                success_count += 1
                                source.reply(RText(f"✓ 强制删除成功: {file_path}", color=RColor.green))
                            else:
                                source.reply(RText(f"⚠ 强制删除失败: {file_path}", color=RColor.red))
                
                if success_count > 0:
                    source.reply(RText(f"✓ 已成功删除 {success_count}/{len(files_to_delete)} 个旧版本文件", color=RColor.green))
                    
                # 清理已处理的插件文件记录
                del PENDING_DELETE_FILES[plugin_id]
                
            # 如果没有指定插件ID，删除所有待删除文件
            elif plugin_id is None and PENDING_DELETE_FILES:
                source.reply(RText(f"正在删除所有待删除的旧版本文件...", color=RColor.yellow))
                
                total_files = sum(len(files) for files in PENDING_DELETE_FILES.values())
                success_count = 0
                
                for p_id, files in list(PENDING_DELETE_FILES.items()):
                    for file_path in files:
                        if os.path.exists(file_path):
                            try:
                                os.remove(file_path)
                                success_count += 1
                                source.reply(RText(f"✓ 已删除: {file_path}", color=RColor.green))
                            except Exception as e:
                                source.reply(RText(f"⚠ 常规删除失败: {e}", color=RColor.yellow))
                                
                                # 尝试强制删除
                                if self.force_delete_file(file_path):
                                    success_count += 1
                                    source.reply(RText(f"✓ 强制删除成功: {file_path}", color=RColor.green))
                                else:
                                    source.reply(RText(f"⚠ 强制删除失败: {file_path}", color=RColor.red))
                    
                    # 清理已处理的插件文件记录
                    del PENDING_DELETE_FILES[p_id]
                
                if success_count > 0:
                    source.reply(RText(f"✓ 已成功删除 {success_count}/{total_files} 个旧版本文件", color=RColor.green))
                
        except Exception as e:
            source.reply(RText(f"删除待删除文件时出错: {e}", color=RColor.red))
            self.logger.exception("删除待删除文件时出错")

    def install_plugin(self, source, plugin_id: str) -> bool:
        """安装单个插件"""
        temp_dir = None
        downloaded_file = None
        
        try:
            # 获取元数据
            cata_meta = self.get_cata_meta(source)
            
            # 获取插件数据
            plugin_data = cata_meta.get_plugin_data(plugin_id)
            if not plugin_data:
                source.reply(f"未找到插件 '{plugin_id}'")
                return False
                
            if plugin_data.latest_version is None:
                source.reply(f"插件 '{plugin_id}' 没有可用的发布版本")
                return False
                
            # 检查插件是否已存在
            latest_version = plugin_data.latest_version
            installed_plugin = self.server.get_plugin_instance(plugin_id)
            
            # 如果插件已加载，检查版本
            if installed_plugin is not None:
                # current_version = str(installed_plugin.get_version()) # Removed
                metadata = self.server.get_plugin_metadata(plugin_id)
                current_version = str(metadata.version) if metadata else 'unknown'
                
                if current_version == latest_version:
                    source.reply(RText(f"插件 {plugin_id}@{current_version} 已安装且是最新版本", color=RColor.green))
                    return True
                    
                source.reply(f"已安装版本: {current_version}, 最新版本: {latest_version}")
                # 先卸载当前插件，然后继续安装新版本
                source.reply(RText(f"正在卸载旧版本 {plugin_id}@{current_version}...", color=RColor.aqua))
                self.server.unload_plugin(plugin_id)
                # 标记旧文件以便后续删除，而不立即删除
                self.remove_old_plugin(source, plugin_id)
            
            # 检查未加载但存在的插件文件
            local_plugins = self.get_local_plugins()
            found_latest_local = False
            
            for file_path in local_plugins['unloaded']:
                try:
                    import zipfile
                    import json
                    
                    if not zipfile.is_zipfile(file_path):
                        continue
                        
                    with zipfile.ZipFile(file_path, 'r') as zip_ref:
                        # 查找元数据文件
                        meta_file = None
                        for f in zip_ref.namelist():
                            if f.endswith('mcdr_plugin.json') or f == 'mcdr_plugin.json' or f.endswith('mcdreforged.plugin.json'):
                                meta_file = f
                                break
                                
                        if not meta_file:
                            continue
                            
                        # 读取元数据
                        with zip_ref.open(meta_file) as f:
                            meta = json.loads(f.read().decode('utf-8'))
                            
                            # 检查ID和版本
                            if meta.get('id') == plugin_id:
                                file_version = meta.get('version')
                                
                                # 如果不是最新版本，标记删除
                                if file_version != latest_version:
                                    source.reply(RText(f"发现旧版本插件文件 {plugin_id}@{file_version}，标记为待删除", color=RColor.yellow))
                                    # 将文件添加到待删除列表
                                    global PENDING_DELETE_FILES
                                    if plugin_id in PENDING_DELETE_FILES:
                                        if file_path not in PENDING_DELETE_FILES[plugin_id]:
                                            PENDING_DELETE_FILES[plugin_id].append(file_path)
                                    else:
                                        PENDING_DELETE_FILES[plugin_id] = [file_path]
                                    
                                    # 尝试解除文件占用
                                    self._release_file_locks(file_path)
                                    continue
                                
                                # 找到了最新版本的本地文件
                                found_latest_local = True
                                source.reply(RText(f"在本地找到未加载的最新版本插件: {file_path}", color=RColor.yellow))
                                
                                # 直接从本地文件检查依赖，而不是重新下载
                                source.reply(RText(f"从本地文件检查依赖...", color=RColor.aqua))
                                
                                # 读取依赖信息
                                missing_deps = []
                                outdated_deps = {}
                                
                                # 获取已安装的插件
                                installed_plugins = {}
                                for pid in self.server.get_plugin_list():
                                    instance = self.server.get_plugin_instance(pid)
                                    if instance:
                                        installed_plugins[pid] = instance
                                
                                # 检查MCDR插件依赖
                                if 'dependencies' in meta:
                                    deps = meta['dependencies']
                                    for dep_id, version_req in deps.items():
                                        # 跳过MCDR本身和Python版本要求
                                        if dep_id.lower() == 'mcdreforged' or dep_id.lower() == 'python':
                                            continue
                                        
                                        # 检查依赖是否已安装
                                        if dep_id not in installed_plugins:
                                            missing_deps.append(dep_id)
                                            source.reply(RText(f"缺少MCDR插件依赖: {dep_id} {version_req}", color=RColor.yellow))
                                        else:
                                            # 检查版本是否符合要求
                                            installed_plugin = installed_plugins[dep_id]
                                            installed_metadata = self.server.get_plugin_metadata(dep_id)
                                            installed_version = str(installed_metadata.version) if installed_metadata else 'unknown'
                                            
                                            try:
                                                from mcdreforged.plugin.meta.version import VersionRequirement, Version
                                                version_requirement = VersionRequirement(version_req)
                                                if not version_requirement.accept(Version(installed_version)):
                                                    source.reply(RText(f"依赖版本不满足: {dep_id}@{installed_version} 不满足 {version_req}", color=RColor.yellow))
                                                    outdated_deps[dep_id] = version_req
                                                else:
                                                    source.reply(RText(f"已安装MCDR插件依赖: {dep_id}@{installed_version} 满足要求 {version_req}", color=RColor.green))
                                            except Exception as e:
                                                source.reply(f"版本检查错误: {e}")
                                                source.reply(f"已安装MCDR插件依赖: {dep_id}@{installed_version}")
                                else:
                                    source.reply(RText("插件没有声明MCDR插件依赖", color=RColor.green))
                                
                                all_deps_ok = True
                                
                                # 处理缺失的依赖
                                if missing_deps:
                                    source.reply(f"插件 {plugin_id} 依赖于以下插件: {', '.join(missing_deps)}")
                                    source.reply("正在安装依赖插件...")
                                    
                                    # 同步安装依赖，不使用线程
                                    failed_deps = []
                                    
                                    for dep_id in missing_deps:
                                        try:
                                            # 跳过 python 和 mcdreforged
                                            if dep_id.lower() in ('python', 'mcdreforged'):
                                                source.reply(RText(f"忽略依赖: {dep_id} (非插件依赖)", color=RColor.gray))
                                                continue
                                            
                                            source.reply(RText(f"⏳ 开始安装依赖: {dep_id}", color=RColor.yellow))
                                            success = self.install_plugin(source, dep_id)
                                            if success:
                                                source.reply(RText(f"✓ 依赖 {dep_id} 安装成功", color=RColor.green))
                                            else:
                                                source.reply(RText(f"⚠ 依赖 {dep_id} 安装失败", color=RColor.red))
                                                failed_deps.append(dep_id)
                                                all_deps_ok = False
                                        except Exception as e:
                                            failed_deps.append(dep_id)
                                            all_deps_ok = False
                                            source.reply(RText(f"⚠ 依赖 {dep_id} 安装出错: {e}", color=RColor.red))
                                    
                                    # 检查依赖安装结果
                                    if failed_deps:
                                        source.reply(RText("⚠ 注意: 以下依赖安装失败，主插件可能无法正常工作:", color=RColor.red))
                                        for dep_id in failed_deps:
                                            source.reply(RText(f"  - {dep_id}", color=RColor.red))
                                        source.reply(RText("提示: 使用 !!pim_helper install <插件ID> 重新安装失败的依赖", color=RColor.aqua))
                                        all_deps_ok = False
                                
                                # 处理需要升级的依赖
                                if outdated_deps:
                                    source.reply(f"插件 {plugin_id} 需要更新以下依赖版本:")
                                    
                                    # 依次处理每个需要更新的依赖
                                    for dep_id, version_req in outdated_deps.items():
                                        source.reply(f"- {dep_id} 需要 {version_req}")
                                        
                                        # 先卸载旧版本
                                        source.reply(RText(f"正在卸载旧版本依赖 {dep_id}...", color=RColor.aqua))
                                        self.server.unload_plugin(dep_id)
                                        time.sleep(1)  # 给一点时间让卸载完成
                                        
                                        # 删除旧文件
                                        self.remove_old_plugin(source, dep_id)
                                        
                                        # 安装新版本
                                        source.reply(RText(f"正在安装新版本依赖 {dep_id}...", color=RColor.aqua))
                                        success = self.install_plugin(source, dep_id)
                                        if not success:
                                            source.reply(RText(f"⚠ 依赖 {dep_id} 更新失败", color=RColor.red))
                                            all_deps_ok = False
                                        else:
                                            source.reply(RText(f"✓ 依赖 {dep_id} 更新成功", color=RColor.green))
                                
                                # 安装Python依赖
                                self._install_dependencies(source, file_path)
                                
                                # 尝试加载插件
                                source.reply(f"正在加载插件 {plugin_id}...")
                                load_result = self.server.load_plugin(str(file_path))
                                
                                if load_result:
                                    source.reply(RText(f"✓ 插件 {plugin_id}@{latest_version} 已成功加载", color=RColor.green))
                                    return True
                                else:
                                    source.reply(RText(f"⚠ 加载插件失败，请检查日志", color=RColor.red))
                                    # 检查是否因为前置插件加载失败
                                    self._check_load_failure(source, file_path)
                                    if not all_deps_ok:
                                        source.reply(RText("可能原因: 依赖未满足。请检查上面的依赖安装/更新是否成功。", color=RColor.yellow))
                                    return False
                except Exception as e:
                    self.logger.debug(f"检查本地插件文件时出错: {e}")
                    continue
            
            # 如果已经找到了最新版本的本地文件但处理失败了，不再继续下载
            if found_latest_local:
                source.reply(RText("已找到本地最新版本文件，但处理失败。不再继续下载。", color=RColor.red))
                return False
            
            # 下载插件
            release = plugin_data.get_latest_release()
            if not release:
                source.reply(f"插件 {plugin_id} 没有可用的发布版本")
                return False
            
            # 创建临时目录 - 使用固定路径
            import os
            from pathlib import Path
            
            # 获取临时目录
            temp_dir_path = self.get_temp_dir()
            
            # 确保临时目录存在
            try:
                source.reply(f"使用临时目录: {temp_dir_path}")
                temp_dir = Path(temp_dir_path)
            except Exception as e:
                source.reply(f"创建临时目录失败: {e}")
                return False
            
            # 下载插件
            temp_file_path = temp_dir / release.file_name
            source.reply(f"正在下载 {plugin_id}@{release.version} 到 {temp_file_path}")
            
            # 获取MCDR配置用于下载设置
            mcdr_config = self.server.get_mcdr_config()
            
            # 设置更长的下载超时时间，确保下载能完成
            download_timeout = mcdr_config.get('plugin_download_timeout', 60)
            
            # 创建下载器
            downloader = ReleaseDownloader(self.server)
            
            # 直接同步执行下载，不使用线程，避免线程同步问题
            source.reply(f"开始下载 {plugin_id}@{release.version}，请稍候...")
            
            try:
                response = requests.get(release.browser_download_url, timeout=download_timeout)
                if response.status_code == 200:
                    with open(str(temp_file_path), 'wb') as f:
                        f.write(response.content)
                    source.reply(f"下载完成！")
                    downloaded_file = str(temp_file_path)
                else:
                    source.reply(f"下载失败: HTTP {response.status_code}")
                    return False
            except Exception as e:
                source.reply(f"下载失败: {e}")
                return False
            
            # 检查依赖并安装
            missing_deps, outdated_deps = self.check_plugin_dependencies(source, plugin_id, cata_meta, downloaded_file)
            all_deps_ok = True
            
            # 处理缺失的依赖
            if missing_deps:
                source.reply(f"插件 {plugin_id} 依赖于以下插件: {', '.join(missing_deps)}")
                source.reply("正在安装依赖插件...")
                
                # 同步安装依赖，不使用线程
                failed_deps = []
                
                for dep_id in missing_deps:
                    try:
                        # 跳过 python 和 mcdreforged
                        if dep_id.lower() in ('python', 'mcdreforged'):
                            source.reply(RText(f"忽略依赖: {dep_id} (非插件依赖)", color=RColor.gray))
                            continue
                        
                        source.reply(RText(f"⏳ 开始安装依赖: {dep_id}", color=RColor.yellow))
                        success = self.install_plugin(source, dep_id)
                        if success:
                            source.reply(RText(f"✓ 依赖 {dep_id} 安装成功", color=RColor.green))
                        else:
                            source.reply(RText(f"⚠ 依赖 {dep_id} 安装失败", color=RColor.red))
                            failed_deps.append(dep_id)
                            all_deps_ok = False
                    except Exception as e:
                        failed_deps.append(dep_id)
                        all_deps_ok = False
                        source.reply(RText(f"⚠ 依赖 {dep_id} 安装出错: {e}", color=RColor.red))
                
                # 检查依赖安装结果
                if failed_deps:
                    source.reply(RText("⚠ 注意: 以下依赖安装失败，主插件可能无法正常工作:", color=RColor.red))
                    for dep_id in failed_deps:
                        source.reply(RText(f"  - {dep_id}", color=RColor.red))
                    source.reply(RText("提示: 使用 !!pim_helper install <插件ID> 重新安装失败的依赖", color=RColor.aqua))
                    all_deps_ok = False
            
            # 处理需要升级的依赖
            if outdated_deps:
                source.reply(f"插件 {plugin_id} 需要更新以下依赖版本:")
                
                # 依次处理每个需要更新的依赖
                for dep_id, version_req in outdated_deps.items():
                    source.reply(f"- {dep_id} 需要 {version_req}")
                    
                    # 先卸载旧版本
                    source.reply(RText(f"正在卸载旧版本依赖 {dep_id}...", color=RColor.aqua))
                    self.server.unload_plugin(dep_id)
                    time.sleep(1)  # 给一点时间让卸载完成
                    
                    # 删除旧文件
                    self.remove_old_plugin(source, dep_id)
                    
                    # 安装新版本
                    source.reply(RText(f"正在安装新版本依赖 {dep_id}...", color=RColor.aqua))
                    success = self.install_plugin(source, dep_id)
                    if not success:
                        source.reply(RText(f"⚠ 依赖 {dep_id} 更新失败", color=RColor.red))
                        all_deps_ok = False
                    else:
                        source.reply(RText(f"✓ 依赖 {dep_id} 更新成功", color=RColor.green))
            
            # 删除旧版本插件 - 修改为标记删除而不是立即删除
            self.remove_old_plugin(source, plugin_id)
                    
            # 获取安装目录
            plugin_directories = self.get_plugin_directories()
            
            if not plugin_directories:
                # 如果插件目录列表为空，尝试从配置获取
                mcdr_config = self.server.get_mcdr_config()
                if 'plugin_directories' in mcdr_config and mcdr_config['plugin_directories']:
                    plugin_directories = mcdr_config['plugin_directories']
                else:
                    # 最后的备选方案，尝试获取默认插件目录
                    default_plugin_dir = os.path.join(os.getcwd(), 'plugins')
                    if os.path.isdir(default_plugin_dir):
                        plugin_directories = [default_plugin_dir]
                    else:
                        source.reply("无法确定插件安装目录")
                        return False
            
            target_dir = plugin_directories[0]
            source.reply(f"将安装到目录: {target_dir}")
            
            # 确保目标目录存在
            try:
                os.makedirs(target_dir, exist_ok=True)
            except Exception as e:
                source.reply(RText(f"创建目标目录失败: {e}", color=RColor.red))
                return False
                
            # 下载成功后移动到插件目录
            target_path = Path(target_dir) / release.file_name
            source.reply(f"正在安装插件到 {target_path}")
            import shutil
            
            try:
                # 确保目标文件不存在
                if os.path.exists(str(target_path)):
                    os.remove(str(target_path))
                
                # 复制而不是移动，避免文件锁定问题
                shutil.copy2(str(temp_file_path), str(target_path))
            except Exception as e:
                source.reply(f"复制文件失败: {e}")
                return False
            
            # 同步执行Python依赖安装，不使用线程
            python_deps_success = True
            try:
                source.reply(RText("检查Python依赖...", color=RColor.aqua))
                python_deps_success = self._install_dependencies(source, str(target_path))
                if not python_deps_success:
                    source.reply(RText("Python依赖安装失败，但将继续尝试加载插件", color=RColor.yellow))
            except Exception as e:
                source.reply(RText(f"Python依赖安装失败: {e}", color=RColor.red))
                source.reply("将继续尝试加载插件...")
            
            # 再次检查插件是否有未安装的MCDR插件依赖
            missing_mcdr_deps = []
            
            try:
                import zipfile
                import json
                
                with zipfile.ZipFile(str(target_path), 'r') as zip_ref:
                    # 查找mcdr_plugin.json
                    mcdr_plugin_json = None
                    for file_path in zip_ref.namelist():
                        if file_path.endswith('mcdr_plugin.json') or file_path == 'mcdr_plugin.json' or file_path.endswith('mcdreforged.plugin.json'):
                            mcdr_plugin_json = file_path
                            break
                    
                    if mcdr_plugin_json:
                        # 读取元数据
                        with zip_ref.open(mcdr_plugin_json) as f:
                            meta = json.loads(f.read().decode('utf-8'))
                            
                            # 检查是否还有未安装的依赖
                            if 'dependencies' in meta:
                                # 获取已安装的插件
                                installed_plugins = {}
                                for pid in self.server.get_plugin_list():
                                    instance = self.server.get_plugin_instance(pid)
                                    if instance:
                                        # installed_plugins[pid] = str(instance.get_version()) # Removed
                                        metadata = self.server.get_plugin_metadata(pid)
                                        version = str(metadata.version) if metadata else 'unknown'
                                        installed_plugins[pid] = version
                                
                                for dep_id, version_req in meta['dependencies'].items():
                                    # 跳过MCDR本身和Python版本要求
                                    if dep_id.lower() == 'mcdreforged' or dep_id.lower() == 'python':
                                        continue
                                    
                                    # 检查依赖是否已安装
                                    if dep_id not in installed_plugins:
                                        missing_mcdr_deps.append(dep_id)
                
                if missing_mcdr_deps:
                    # 有未安装的依赖，提示用户
                    source.reply(RText(f"⚠ 警告：插件 {plugin_id} 还有以下未安装的依赖:", color=RColor.yellow))
                    for dep_id in missing_mcdr_deps:
                        source.reply(RText(f"  - {dep_id}", color=RColor.yellow))
                    source.reply(RText("插件可能无法正常工作。建议先安装这些依赖插件。", color=RColor.yellow))
                    source.reply(RText("提示: 使用 !!pim_helper install <插件ID> 安装缺失的依赖", color=RColor.aqua))
                    all_deps_ok = False
            except Exception as e:
                source.reply(f"检查插件依赖时出错: {e}")
            
            # 加载插件
            source.reply(f"正在加载插件 {plugin_id}...")
            # load_plugin是加载插件的核心函数
            load_result = self.server.load_plugin(str(target_path))
            
            if load_result:
                source.reply(RText(f"✓ 插件 {plugin_id}@{release.version} 安装并加载成功", color=RColor.green))
                # 安装成功后删除待删除的旧版本文件
                source.reply(RText("正在清理旧版本文件...", color=RColor.aqua))
                self._delete_pending_files(source, plugin_id)
            else:
                source.reply(RText(f"⚠ 插件安装完成，但加载失败，请检查日志", color=RColor.red))
                # 检查是否因为前置插件加载失败
                self._check_load_failure(source, str(target_path))
                if not all_deps_ok:
                    source.reply(RText("可能原因: 插件依赖未满足。请尝试安装上面列出的缺失依赖或更新版本不匹配的依赖。", color=RColor.yellow))
            
            return load_result
            
        except Exception as e:
            source.reply(f"安装插件时发生错误: {e}")
            self.logger.exception(f"安装插件 {plugin_id} 时出错")
            return False
        finally:
            # 清理临时文件
            if temp_dir is not None and os.path.exists(str(temp_dir)):
                try:
                    # 清理下载的临时文件而不是目录本身
                    if os.path.exists(str(temp_file_path)):
                        try:
                            os.remove(str(temp_file_path))
                        except PermissionError:
                            source.reply("无法删除临时文件，可能仍被占用")
                        except Exception as e:
                            self.logger.warning(f"清理临时文件失败: {e}")
                except Exception as e:
                    self.logger.warning(f"清理临时文件失败: {e}")

    def _check_load_failure(self, source, plugin_path: str) -> None:
        """
        分析插件加载失败的原因，检查是否是前置插件的问题并尝试修复
        """
        try:
            import zipfile
            import json
            import re
            import time
            import os
            import sys
            import subprocess
            from pathlib import Path
            
            # 直接尝试从输出中解析错误信息
            error_message = source.get_server().last_output
            if not error_message:
                source.reply("无法获取错误信息")
                return
                
            # 尝试从插件路径和名称中提取插件ID
            plugin_id = None
            try:
                with zipfile.ZipFile(plugin_path, 'r') as zip_ref:
                    meta_file = None
                    for f in zip_ref.namelist():
                        if f.endswith('mcdr_plugin.json') or f == 'mcdr_plugin.json' or f.endswith('mcdreforged.plugin.json'):
                            meta_file = f
                            break
                            
                    if meta_file:
                        with zip_ref.open(meta_file) as f:
                            meta = json.loads(f.read().decode('utf-8'))
                            plugin_id = meta.get('id')
            except Exception:
                # 如果无法从zip中获取ID，尝试从文件名提取
                try:
                    file_name = os.path.basename(plugin_path)
                    if '-v' in file_name:
                        plugin_id = file_name.split('-v')[0]
                except Exception:
                    pass
            
            # 没有获取到ID，直接返回
            if not plugin_id:
                source.reply("无法确定插件ID")
                return
                
            # 定义错误模式
            error_patterns = [
                (r'卸载插件 (\w+)@([\d\.]+)，原因: 依赖项 (\w+)@([\d\.]+) 不满足版本约束 ([\>\<\=\d\.]+)', 'version_mismatch'),
                (r'卸载插件 (\w+)@([\d\.]+)，原因: 缺少依赖项: (\w+)', 'missing_dependency'),
                (r'插件 (\w+)@([\d\.]+) \([^)]+\) 拥有与已存在插件 (\w+)@([\d\.]+) \([^)]+\) 相同的 id，已移除', 'duplicate_id'),
                # 添加新的模式：检测缺少pip包的错误
                (r'ModuleNotFoundError: No module named \'([^\']+)\'', 'missing_pip_package'),
                (r'ImportError: No module named ([^\'"\s]+)', 'missing_pip_package'),
                (r'ImportError: cannot import name \'([^\']+)\'', 'import_error')
            ]
            
            # 查找匹配的错误模式
            for pattern, error_type in error_patterns:
                match = re.search(pattern, error_message)
                if match:
                    if error_type == 'version_mismatch':
                        plugin_name = match.group(1)
                        plugin_version = match.group(2)
                        dep_name = match.group(3)
                        dep_version = match.group(4)
                        version_req = match.group(5)
                        
                        source.reply(RText(f"📋 插件 {plugin_name} 加载失败: 依赖版本不匹配", color=RColor.yellow))
                        source.reply(RText(f"依赖 {dep_name}@{dep_version} 不满足版本要求 {version_req}", color=RColor.red))
                        
                        # 卸载旧版本依赖
                        source.reply(RText(f"正在卸载旧版本 {dep_name}...", color=RColor.aqua))
                        self.server.unload_plugin(dep_name)
                        time.sleep(1)  # 给一点时间让卸载完成
                        
                        # 尝试安装新版本依赖
                        source.reply(RText(f"📥 正在安装更新的依赖 {dep_name}...", color=RColor.aqua))
                        if self.install_plugin(source, dep_name):
                            source.reply(RText(f"✓ 依赖 {dep_name} 更新成功", color=RColor.green))
                            # 重新加载主插件
                            source.reply(RText(f"正在重新加载主插件 {plugin_name}...", color=RColor.aqua))
                            if self.server.load_plugin(str(plugin_path)):
                                source.reply(RText(f"✓ 插件 {plugin_name} 加载成功!", color=RColor.green))
                            else:
                                source.reply(RText(f"⚠ 插件 {plugin_name} 仍然无法加载，可能存在其他问题", color=RColor.red))
                        else:
                            source.reply(RText(f"⚠ 依赖 {dep_name} 更新失败", color=RColor.red))
                        return
                        
                    elif error_type == 'missing_dependency':
                        plugin_name = match.group(1)
                        plugin_version = match.group(2)
                        dep_name = match.group(3)
                        
                        source.reply(RText(f"📋 插件 {plugin_name} 加载失败: 缺少依赖", color=RColor.yellow))
                        source.reply(RText(f"缺少依赖: {dep_name}", color=RColor.red))
                        
                        # 尝试安装缺失的依赖
                        source.reply(RText(f"📥 正在安装依赖 {dep_name}...", color=RColor.aqua))
                        if self.install_plugin(source, dep_name):
                            source.reply(RText(f"✓ 依赖 {dep_name} 安装成功", color=RColor.green))
                            # 重新加载主插件
                            source.reply(RText(f"正在重新加载主插件 {plugin_name}...", color=RColor.aqua))
                            if self.server.load_plugin(str(plugin_path)):
                                source.reply(RText(f"✓ 插件 {plugin_name} 加载成功!", color=RColor.green))
                            else:
                                source.reply(RText(f"⚠ 插件 {plugin_name} 仍然无法加载，可能存在其他问题", color=RColor.red))
                        else:
                            source.reply(RText(f"⚠ 依赖 {dep_name} 安装失败", color=RColor.red))
                        return
                        
                    elif error_type == 'duplicate_id':
                        plugin_name = match.group(1)
                        plugin_version = match.group(2)
                        existing_name = match.group(3)
                        existing_version = match.group(4)
                        
                        # 这是尝试加载新版本插件，但老版本仍然存在的情况
                        source.reply(RText(f"📋 插件加载失败: ID冲突", color=RColor.yellow))
                        source.reply(RText(f"新版本 {plugin_name}@{plugin_version} 与已存在的 {existing_name}@{existing_version} 冲突", color=RColor.red))
                        
                        # 卸载旧版本
                        source.reply(RText(f"正在卸载旧版本 {existing_name}@{existing_version}...", color=RColor.aqua))
                        self.server.unload_plugin(existing_name)
                        time.sleep(1)  # 给一点时间让卸载完成
                        
                        # 检查并删除旧版本文件
                        source.reply(RText(f"正在查找并删除旧版本插件文件...", color=RColor.aqua))
                        self.remove_old_plugin(source, existing_name)
                        
                        # 重新加载新版本
                        source.reply(RText(f"正在加载新版本 {plugin_name}@{plugin_version}...", color=RColor.aqua))
                        if self.server.load_plugin(str(plugin_path)):
                            source.reply(RText(f"✓ 插件 {plugin_name}@{plugin_version} 加载成功!", color=RColor.green))
                        else:
                            source.reply(RText(f"⚠ 插件 {plugin_name}@{plugin_version} 无法加载，可能存在其他问题", color=RColor.red))
                        return
                        
                    elif error_type == 'missing_pip_package':
                        # 处理缺少pip包的错误
                        package_name = match.group(1)
                        
                        source.reply(RText(f"📋 插件 {plugin_id} 加载失败: 缺少Python包", color=RColor.yellow))
                        source.reply(RText(f"缺少Python包: {package_name}", color=RColor.red))
                        
                        # 尝试使用pip安装缺失的包
                        source.reply(RText(f"📥 正在尝试安装缺失的Python包: {package_name}...", color=RColor.aqua))
                        
                        # 执行pip安装
                        try:
                            # 构建pip命令
                            pip_cmd = [sys.executable, "-m", "pip", "install", "--upgrade", package_name]
                            
                            # 检查是否有pip额外参数
                            mcdr_config = self.server.get_mcdr_config()
                            pip_extra_args = mcdr_config.get('plugin_pip_install_extra_args', '')
                            if pip_extra_args:
                                pip_cmd.extend(pip_extra_args.split())
                                
                            source.reply(f"执行命令: {' '.join(pip_cmd)}")
                            
                            # 执行安装
                            result = subprocess.run(
                                pip_cmd,
                                stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE,
                                text=True,
                                check=True
                            )
                            
                            # 输出安装日志摘要
                            if result.stdout:
                                lines = result.stdout.splitlines()
                                if len(lines) > 5:
                                    source.reply("安装输出 (部分):")
                                    for line in lines[-5:]:
                                        source.reply(f"> {line}")
                                else:
                                    source.reply("安装输出:")
                                    for line in lines:
                                        source.reply(f"> {line}")
                            
                            # 刷新模块缓存
                            import importlib
                            importlib.invalidate_caches()
                            
                            source.reply(RText(f"✓ Python包 {package_name} 安装成功", color=RColor.green))
                            
                            # 重新加载插件
                            source.reply(RText(f"正在重新加载插件 {plugin_id}...", color=RColor.aqua))
                            if self.server.load_plugin(str(plugin_path)):
                                source.reply(RText(f"✓ 插件 {plugin_id} 加载成功!", color=RColor.green))
                                return
                            else:
                                # 如果仍然加载失败，递归调用此方法以处理可能的其他错误
                                source.reply(RText(f"⚠ 插件仍然无法加载，检查是否还有其他问题", color=RColor.yellow))
                                self._check_load_failure(source, plugin_path)
                                return
                                
                        except subprocess.CalledProcessError as e:
                            source.reply(RText(f"⚠ 安装Python包 {package_name} 失败!", color=RColor.red))
                            
                            # 输出错误信息
                            if e.stderr:
                                error_lines = e.stderr.splitlines()
                                source.reply("错误信息:")
                                for line in error_lines[-5:]:  # 只显示最后5行错误
                                    source.reply(RText(f"> {line}", color=RColor.red))
                                    
                            # 可能需要尝试其他类似的包名
                            alternate_names = []
                            if '.' in package_name:
                                # 尝试获取顶级包名
                                top_package = package_name.split('.')[0]
                                alternate_names.append(top_package)
                            
                            # 尝试使用小写名
                            if package_name != package_name.lower():
                                alternate_names.append(package_name.lower())
                            
                            # 尝试常见的误写修正
                            common_mistakes = {
                                "PIL": "pillow",
                                "yaml": "pyyaml",
                                "bs4": "beautifulsoup4",
                                "cv2": "opencv-python",
                                "sklearn": "scikit-learn",
                                "wx": "wxpython",
                                "tk": "tkinter",
                                "tkinter": "python-tk",
                                "colorama": "colorama"
                            }
                            
                            if package_name in common_mistakes:
                                alternate_names.append(common_mistakes[package_name])
                            
                            # 尝试安装备选包名
                            for alt_name in alternate_names:
                                source.reply(RText(f"尝试安装备选包名: {alt_name}", color=RColor.yellow))
                                try:
                                    alt_pip_cmd = [sys.executable, "-m", "pip", "install", "--upgrade", alt_name]
                                    if pip_extra_args:
                                        alt_pip_cmd.extend(pip_extra_args.split())
                                        
                                    alt_result = subprocess.run(
                                        alt_pip_cmd,
                                        stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE,
                                        text=True,
                                        check=True
                                    )
                                    
                                    # 刷新模块缓存
                                    import importlib
                                    importlib.invalidate_caches()
                                    
                                    source.reply(RText(f"✓ 备选Python包 {alt_name} 安装成功", color=RColor.green))
                                    
                                    # 重新加载插件
                                    source.reply(RText(f"正在重新加载插件 {plugin_id}...", color=RColor.aqua))
                                    if self.server.load_plugin(str(plugin_path)):
                                        source.reply(RText(f"✓ 插件 {plugin_id} 加载成功!", color=RColor.green))
                                        return
                                except subprocess.CalledProcessError:
                                    continue
                            
                            source.reply(RText(f"⚠ 所有尝试都失败了，插件 {plugin_id} 无法加载", color=RColor.red))
                        return
                        
                    elif error_type == 'import_error':
                        # 处理导入错误
                        import_name = match.group(1)
                        source.reply(RText(f"📋 插件 {plugin_id} 加载失败: 导入错误", color=RColor.yellow))
                        source.reply(RText(f"无法导入: {import_name}", color=RColor.red))
                        source.reply(RText(f"这可能是由于Python包版本不兼容或包不完整导致的", color=RColor.yellow))
                        return
                
            # 检查是否存在requirements.txt，如果存在，尝试重新安装所有依赖
            try:
                with zipfile.ZipFile(plugin_path, 'r') as zip_ref:
                    has_requirements = any(f == 'requirements.txt' for f in zip_ref.namelist())
                    
                    if has_requirements:
                        source.reply(RText(f"检测到requirements.txt文件，尝试重新安装所有依赖", color=RColor.yellow))
                        
                        # 在临时目录中提取requirements.txt
                        import tempfile
                        with tempfile.TemporaryDirectory() as temp_dir:
                            # 提取requirements.txt到临时目录
                            zip_ref.extract('requirements.txt', temp_dir)
                            req_path = os.path.join(temp_dir, 'requirements.txt')
                            
                            # 读取requirements.txt内容
                            with open(req_path, 'r') as f:
                                requirements = [line.strip() for line in f if line.strip() and not line.startswith('#')]
                            
                            if requirements:
                                source.reply(f"找到依赖项: {', '.join(requirements)}")
                                
                                # 安装所有依赖
                                try:
                                    pip_cmd = [sys.executable, "-m", "pip", "install", "--upgrade"]
                                    
                                    # 检查是否有pip额外参数
                                    mcdr_config = self.server.get_mcdr_config()
                                    pip_extra_args = mcdr_config.get('plugin_pip_install_extra_args', '')
                                    if pip_extra_args:
                                        pip_cmd.extend(pip_extra_args.split())
                                        
                                    pip_cmd.extend(requirements)
                                    
                                    source.reply(f"执行命令: {' '.join(pip_cmd)}")
                                    
                                    result = subprocess.run(
                                        pip_cmd,
                                        stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE,
                                        text=True,
                                        check=True
                                    )
                                    
                                    # 刷新模块缓存
                                    import importlib
                                    importlib.invalidate_caches()
                                    
                                    source.reply(RText(f"✓ 依赖项安装成功", color=RColor.green))
                                    
                                    # 重新加载插件
                                    source.reply(RText(f"正在重新加载插件 {plugin_id}...", color=RColor.aqua))
                                    if self.server.load_plugin(str(plugin_path)):
                                        source.reply(RText(f"✓ 插件 {plugin_id} 加载成功!", color=RColor.green))
                                        return
                                    
                                    source.reply(RText(f"⚠ 安装依赖后插件仍然无法加载", color=RColor.red))
                                    
                                except subprocess.CalledProcessError as e:
                                    source.reply(RText(f"⚠ 安装依赖项失败!", color=RColor.red))
                                    # 输出错误信息
                                    if e.stderr:
                                        error_lines = e.stderr.splitlines()
                                        source.reply("错误信息:")
                                        for line in error_lines[-5:]:
                                            source.reply(RText(f"> {line}", color=RColor.red))
            except Exception as e:
                source.reply(RText(f"检查requirements.txt时出错: {e}", color=RColor.red))
            
            source.reply(RText("未能识别具体错误原因，请查看服务器日志获取更多信息", color=RColor.yellow))
            
        except Exception as e:
            source.reply(f"分析加载失败原因时出错: {e}")
            self.logger.exception("分析加载失败原因时出错")
        
    def find_dependent_plugins(self, source, plugin_id: str) -> List[str]:
        """查找依赖于指定插件的其他插件"""
        dependent_plugins = []
        
        try:
            # 获取已加载的插件
            loaded_plugin_ids = self.server.get_plugin_list()
            loaded_plugins = []
            for pid in loaded_plugin_ids:
                 instance = self.server.get_plugin_instance(pid)
                 if instance:
                     loaded_plugins.append(instance)

            for plugin in loaded_plugins:
                try:
                    plugin_dependencies = {}
                    
                    # 获取插件的mcdr_plugin.json声明的依赖
                    plugin_path = getattr(plugin, 'file_path', None)
                    if not plugin_path or not os.path.exists(plugin_path):
                        continue
                        
                    # 检查是否为插件包
                    import zipfile
                    import json
                    
                    if not zipfile.is_zipfile(plugin_path):
                        continue
                        
                    with zipfile.ZipFile(plugin_path, 'r') as zip_ref:
                        # 查找mcdr_plugin.json
                        mcdr_plugin_json = None
                        for file_path in zip_ref.namelist():
                            if file_path.endswith('mcdr_plugin.json') or file_path == 'mcdr_plugin.json' or file_path.endswith('mcdreforged.plugin.json'):
                                mcdr_plugin_json = file_path
                                break
                                
                        if not mcdr_plugin_json:
                            continue
                            
                        # 读取元数据中的依赖
                        with zip_ref.open(mcdr_plugin_json) as f:
                            meta = json.loads(f.read().decode('utf-8'))
                            if 'dependencies' in meta and meta['dependencies']:
                                plugin_dependencies = meta['dependencies']
                            
                    # 检查依赖
                    if plugin_id in plugin_dependencies:
                        dependent_plugins.append(plugin.get_id())
                        
                except Exception as e:
                    self.logger.debug(f"检查插件 {plugin.get_id()} 的依赖时出错: {e}")
                    continue
                    
            # 同样检查未加载插件的依赖
            local_plugins = self.get_local_plugins()
            for file_path in local_plugins['unloaded']:
                try:
                    detected_id = self.detect_unloaded_plugin_id(file_path)
                    if not detected_id or detected_id == plugin_id:
                        continue
                        
                    import zipfile
                    import json
                    
                    if not zipfile.is_zipfile(file_path):
                        continue
                        
                    with zipfile.ZipFile(file_path, 'r') as zip_ref:
                        # 查找mcdr_plugin.json
                        mcdr_plugin_json = None
                        for zip_path in zip_ref.namelist():
                            if zip_path.endswith('mcdr_plugin.json') or zip_path == 'mcdr_plugin.json' or zip_path.endswith('mcdreforged.plugin.json'):
                                mcdr_plugin_json = zip_path
                                break
                                
                        if not mcdr_plugin_json:
                            continue
                            
                        # 读取元数据中的依赖
                        with zip_ref.open(mcdr_plugin_json) as f:
                            meta = json.loads(f.read().decode('utf-8'))
                            if 'dependencies' in meta and meta['dependencies']:
                                if plugin_id in meta['dependencies']:
                                    dependent_plugins.append(detected_id)
                except Exception as e:
                    self.logger.debug(f"检查未加载插件 {file_path} 的依赖时出错: {e}")
                    continue
            
            return dependent_plugins
            
        except Exception as e:
            source.reply(f"查找依赖插件时出错: {e}")
            self.logger.exception(f"查找依赖于插件 {plugin_id} 的其他插件时出错")
            return []

    def get_temp_dir(self) -> str:
        """获取临时目录路径"""
        # 获取MCDR根目录
        mcdr_root = os.getcwd()
        
        # 尝试获取宿主插件的ID，如果是被其他插件内嵌的情况
        host_plugin_id = None
        
        try:
            if self.server.get_plugin_instance("guguwebui"): # Use public API
                host_plugin_id = "guguwebui"
        except:
            pass
        
        # 确定使用哪个插件ID作为目录名
        plugin_id = host_plugin_id or "pim_helper"
        
        # 创建固定的临时目录
        temp_dir_path = os.path.join(mcdr_root, "config", plugin_id, "temp")
        # 确保临时目录存在
        os.makedirs(temp_dir_path, exist_ok=True)
        return temp_dir_path

    def get_plugin_versions(self, plugin_id: str) -> List[Dict[str, Any]]:
        """
        获取指定插件的所有可用版本
        
        Args:
            plugin_id: 插件ID
            
        Returns:
            包含版本信息的列表，每个版本包含版本号、发布日期、下载次数等信息
        """
        try:
            # 使用全局元数据注册表
            global_registry = get_global_registry()
            
            # 查找插件数据
            plugin_data = global_registry.get_plugin_data(plugin_id)
            if not plugin_data or not plugin_data.releases:
                return []
            
            # 获取当前已安装版本（如果有）
            installed_version = None
            if self.server:
                installed_plugin = self.server.get_plugin_instance(plugin_id)
                if installed_plugin:
                    metadata = self.server.get_plugin_metadata(plugin_id)
                    installed_version = str(metadata.version) if metadata else 'unknown'
            
            # 收集所有版本信息
            versions = []
            for release in plugin_data.releases:
                version = release.tag_name.lstrip('v') if release.tag_name else ""
                if not version:
                    continue
                
                version_info = {
                    'version': version,
                    'release_date': release.created_at,
                    'download_count': release.download_count,
                    'download_url': release.browser_download_url,
                    'description': release.description,
                    'prerelease': release.prerelease,
                    'installed': version == installed_version
                }
                versions.append(version_info)
            
            # 按发布日期排序（最新的在前）
            versions.sort(key=lambda x: x.get('release_date', ''), reverse=True)
            
            return versions
            
        except Exception as e:
            self.logger.error(f"获取插件 {plugin_id} 版本信息失败: {e}")
            return []

    def get_plugin_dir(self) -> str:
        """获取插件目录"""
        # 获取MCDR配置中的插件目录列表
        plugin_directories = self.get_plugin_directories()
        
        # 使用第一个目录
        if plugin_directories:
            return plugin_directories[0]
        
        # 兜底：使用当前工作目录下的plugins文件夹
        return os.path.join(os.getcwd(), 'plugins')
        
    def get_plugin_directories(self) -> List[str]:
        """获取插件目录列表"""
        # 尝试从MCDR配置获取插件目录列表
        mcdr_config = self.server.get_mcdr_config()
        plugin_directories = []
        
        if 'plugin_directories' in mcdr_config and mcdr_config['plugin_directories']:
            plugin_directories = mcdr_config['plugin_directories']
        else:
            # 兜底：使用当前工作目录下的plugins文件夹
            default_plugin_dir = os.path.join(os.getcwd(), 'plugins')
            if os.path.isdir(default_plugin_dir):
                plugin_directories = [default_plugin_dir]
                
        return plugin_directories

    def uninstall_plugin(self, source, plugin_id: str, skip_dependents_check: bool = False) -> bool:
        """
        完全卸载插件并删除本地文件
        skip_dependents_check: 是否跳过检查依赖该插件的其他插件（用于避免循环调用）
        """
        try:
            source.reply(RText(f"开始卸载插件: {plugin_id}", color=RColor.yellow))
            
            # 首先检查是否有其他插件依赖于此插件
            if not skip_dependents_check:
                dependent_plugins = self.find_dependent_plugins(source, plugin_id)
                if dependent_plugins:
                    source.reply(RText(f"警告: 以下插件依赖于 {plugin_id}:", color=RColor.red))
                    for dep_id in dependent_plugins:
                        source.reply(RText(f"  - {dep_id}", color=RColor.red))
                    
                    # 提示用户是否继续卸载
                    source.reply(RTextList(
                        RText("如果卸载此插件，依赖它的插件可能无法正常工作。", color=RColor.yellow),
                        RText(" [一并卸载所有]", color=RColor.red)
                            .h("点击卸载此插件及所有依赖它的插件")
                            .c(RAction.run_command, f"!!pim_helper uninstall_with_dependents {plugin_id}")
                    ))
                    source.reply(RTextList(
                        RText(" [仅卸载此插件]", color=RColor.yellow)
                            .h("点击仅卸载此插件")
                            .c(RAction.run_command, f"!!pim_helper uninstall_force {plugin_id}")
                    ))
                    return False
            
            removed_files = []
            plugin_found = False
            
            # 检查插件是否已加载
            plugin = self.server.get_plugin_instance(plugin_id)
            if plugin is not None:
                plugin_found = True
                # 获取插件文件路径
                plugin_path = getattr(plugin, 'file_path', None)
                if plugin_path:
                    source.reply(RText(f"已找到已加载的插件: {plugin_id} ({plugin_path})", color=RColor.aqua))
                
                # 卸载插件
                source.reply(RText(f"正在卸载插件: {plugin_id}", color=RColor.aqua))
                self.server.unload_plugin(plugin_id)
                time.sleep(1)  # 给一点时间让卸载完成
                
                # 删除文件
                if plugin_path and os.path.exists(plugin_path):
                    try:
                        source.reply(RText(f"正在删除文件: {plugin_path}", color=RColor.aqua))
                        os.remove(plugin_path)
                        removed_files.append(plugin_path)
                    except Exception as e:
                        source.reply(RText(f"⚠ 删除文件失败: {e}", color=RColor.red))
                        # 尝试强制删除
                        if self.force_delete_file(plugin_path):
                            source.reply(RText(f"✓ 强制删除成功: {plugin_path}", color=RColor.green))
                            removed_files.append(plugin_path)
                        else:
                            source.reply(RText(f"⚠ 强制删除失败，请手动删除", color=RColor.red))
            
            # 查找未加载的插件文件
            source.reply(RText(f"正在搜索未加载的插件文件: {plugin_id}", color=RColor.aqua))
            
            # 扫描所有本地插件文件
            local_plugins = self.get_local_plugins()
            unloaded_plugin_files = []
            
            # 检查未加载的插件
            for file_path in local_plugins['unloaded']:
                detected_id = self.detect_unloaded_plugin_id(file_path)
                if detected_id == plugin_id:
                    plugin_found = True
                    unloaded_plugin_files.append(file_path)
                    source.reply(RText(f"找到未加载的插件文件: {file_path}", color=RColor.aqua))
            
            # 检查禁用的插件
            if 'disabled' in local_plugins:
                for file_path in local_plugins['disabled']:
                    detected_id = self.detect_unloaded_plugin_id(file_path)
                    if detected_id == plugin_id:
                        plugin_found = True
                        unloaded_plugin_files.append(file_path)
                        source.reply(RText(f"找到禁用的插件文件: {file_path}", color=RColor.aqua))
                    
            # 如果找到未加载的插件文件
            if unloaded_plugin_files:
                source.reply(RText(f"找到 {len(unloaded_plugin_files)} 个未加载/禁用的插件文件", color=RColor.aqua))
                for file_path in unloaded_plugin_files:
                    try:
                        source.reply(RText(f"正在删除文件: {file_path}", color=RColor.aqua))
                        os.remove(file_path)
                        removed_files.append(file_path)
                    except Exception as e:
                        source.reply(RText(f"⚠ 删除文件失败: {e}", color=RColor.red))
                        # 尝试强制删除
                        if self.force_delete_file(file_path):
                            source.reply(RText(f"✓ 强制删除成功: {file_path}", color=RColor.green))
                            removed_files.append(file_path)
                        else:
                            source.reply(RText(f"⚠ 强制删除失败，请手动删除", color=RColor.red))
            
            # 如果没有找到任何插件（既没有加载也没有未加载），尝试通过插件ID匹配所有可能的文件
            if not plugin_found:
                source.reply(RText(f"未找到已加载或未加载的插件 {plugin_id}，尝试查找所有可能的文件...", color=RColor.yellow))
                
                # 获取所有插件目录
                plugin_dirs = self.get_plugin_directories()
                possible_files = []
                
                # 遍历所有插件目录，查找可能与插件ID相关的文件
                for plugin_dir in plugin_dirs:
                    if os.path.exists(plugin_dir) and os.path.isdir(plugin_dir):
                        for file_name in os.listdir(plugin_dir):
                            file_path = os.path.join(plugin_dir, file_name)
                            # 检查文件名是否包含插件ID
                            if plugin_id.lower() in file_name.lower() and os.path.isfile(file_path):
                                possible_files.append(file_path)
                                source.reply(RText(f"找到可能的插件文件: {file_path}", color=RColor.aqua))
                                
                            # 如果是zip文件，检查其内容
                            if os.path.isfile(file_path) and (file_path.endswith('.zip') or file_path.endswith('.mcdr')):
                                try:
                                    import zipfile
                                    import json
                                    
                                    with zipfile.ZipFile(file_path, 'r') as zip_ref:
                                        # 查找mcdr_plugin.json
                                        for zip_path in zip_ref.namelist():
                                            if zip_path.endswith('mcdr_plugin.json') or zip_path == 'mcdr_plugin.json' or zip_path.endswith('mcdreforged.plugin.json'):
                                                try:
                                                    with zip_ref.open(zip_path) as f:
                                                        meta = json.loads(f.read().decode('utf-8'))
                                                        if 'id' in meta and meta['id'] == plugin_id:
                                                            possible_files.append(file_path)
                                                            source.reply(RText(f"找到可能的插件文件: {file_path}", color=RColor.aqua))
                                                            break
                                                except:
                                                    pass
                                except:
                                    pass
                
                # 删除找到的可能文件
                if possible_files:
                    source.reply(RText(f"找到 {len(possible_files)} 个可能的插件文件", color=RColor.aqua))
                    for file_path in possible_files:
                        try:
                            source.reply(RText(f"正在删除文件: {file_path}", color=RColor.aqua))
                            os.remove(file_path)
                            removed_files.append(file_path)
                        except Exception as e:
                            source.reply(RText(f"⚠ 删除文件失败: {e}", color=RColor.red))
                            # 尝试强制删除
                            if self.force_delete_file(file_path):
                                source.reply(RText(f"✓ 强制删除成功: {file_path}", color=RColor.green))
                                removed_files.append(file_path)
                            else:
                                source.reply(RText(f"⚠ 强制删除失败，请手动删除", color=RColor.red))
            
            # 显示结果
            if removed_files:
                source.reply(RText(f"✓ 已成功删除以下文件:", color=RColor.green))
                for file_path in removed_files:
                    source.reply(RText(f"  - {file_path}", color=RColor.green))
                source.reply(RText(f"插件 {plugin_id} 已完全卸载", color=RColor.green))
                return True
            else:
                # 未找到任何文件
                source.reply(RText(f"⚠ 未找到插件 {plugin_id} 的任何文件", color=RColor.red))
                return False
                
        except Exception as e:
            source.reply(RText(f"卸载插件时发生错误: {e}", color=RColor.red))
            self.logger.exception(f"卸载插件 {plugin_id} 时出错")
            return False
            
    def uninstall_with_dependents(self, source, plugin_id: str) -> bool:
        """卸载插件及其所有依赖它的插件"""
        try:
            dependent_plugins = self.find_dependent_plugins(source, plugin_id)
            
            if dependent_plugins:
                source.reply(RText(f"将卸载 {plugin_id} 及以下依赖它的插件:", color=RColor.yellow))
                for dep_id in dependent_plugins:
                    source.reply(RText(f"  - {dep_id}", color=RColor.yellow))
                
                # 先卸载依赖该插件的插件（避免检查循环）
                for dep_id in dependent_plugins:
                    source.reply(RText(f"正在卸载依赖 {plugin_id} 的插件: {dep_id}", color=RColor.aqua))
                    self.uninstall_plugin(source, dep_id, skip_dependents_check=True)
            
            # 最后卸载主插件
            return self.uninstall_plugin(source, plugin_id, skip_dependents_check=True)
        
        except Exception as e:
            source.reply(RText(f"批量卸载插件时发生错误: {e}", color=RColor.red))
            self.logger.exception(f"批量卸载插件 {plugin_id} 及其依赖时出错")
            return False
    
    def uninstall_force(self, source, plugin_id: str) -> bool:
        """强制卸载插件，忽略依赖检查"""
        return self.uninstall_plugin(source, plugin_id, skip_dependents_check=True)

    def find_dependent_plugins(self, source, plugin_id: str) -> List[str]:
        """查找依赖于指定插件的其他插件"""
        dependent_plugins = []
        
        try:
            # 获取已加载的插件
            loaded_plugin_ids = self.server.get_plugin_list()
            loaded_plugins = []
            for pid in loaded_plugin_ids:
                 instance = self.server.get_plugin_instance(pid)
                 if instance:
                     loaded_plugins.append(instance)

            for plugin in loaded_plugins:
                try:
                    plugin_dependencies = {}
                    
                    # 获取插件的mcdr_plugin.json声明的依赖
                    plugin_path = getattr(plugin, 'file_path', None)
                    if not plugin_path or not os.path.exists(plugin_path):
                        continue
                        
                    # 检查是否为插件包
                    import zipfile
                    import json
                    
                    if not zipfile.is_zipfile(plugin_path):
                        continue
                        
                    with zipfile.ZipFile(plugin_path, 'r') as zip_ref:
                        # 查找mcdr_plugin.json
                        mcdr_plugin_json = None
                        for file_path in zip_ref.namelist():
                            if file_path.endswith('mcdr_plugin.json') or file_path == 'mcdr_plugin.json' or file_path.endswith('mcdreforged.plugin.json'):
                                mcdr_plugin_json = file_path
                                break
                                
                        if not mcdr_plugin_json:
                            continue
                            
                        # 读取元数据中的依赖
                        with zip_ref.open(mcdr_plugin_json) as f:
                            meta = json.loads(f.read().decode('utf-8'))
                            if 'dependencies' in meta and meta['dependencies']:
                                plugin_dependencies = meta['dependencies']
                            
                    # 检查依赖
                    if plugin_id in plugin_dependencies:
                        dependent_plugins.append(plugin.get_id())
                        
                except Exception as e:
                    self.logger.debug(f"检查插件 {plugin.get_id()} 的依赖时出错: {e}")
                    continue
                    
            # 同样检查未加载插件的依赖
            local_plugins = self.get_local_plugins()
            for file_path in local_plugins['unloaded']:
                try:
                    detected_id = self.detect_unloaded_plugin_id(file_path)
                    if not detected_id or detected_id == plugin_id:
                        continue
                        
                    import zipfile
                    import json
                    
                    if not zipfile.is_zipfile(file_path):
                        continue
                        
                    with zipfile.ZipFile(file_path, 'r') as zip_ref:
                        # 查找mcdr_plugin.json
                        mcdr_plugin_json = None
                        for zip_path in zip_ref.namelist():
                            if zip_path.endswith('mcdr_plugin.json') or zip_path == 'mcdr_plugin.json' or zip_path.endswith('mcdreforged.plugin.json'):
                                mcdr_plugin_json = zip_path
                                break
                                
                        if not mcdr_plugin_json:
                            continue
                            
                        # 读取元数据中的依赖
                        with zip_ref.open(mcdr_plugin_json) as f:
                            meta = json.loads(f.read().decode('utf-8'))
                            if 'dependencies' in meta and meta['dependencies']:
                                if plugin_id in meta['dependencies']:
                                    dependent_plugins.append(detected_id)
                except Exception as e:
                    self.logger.debug(f"检查未加载插件 {file_path} 的依赖时出错: {e}")
                    continue
            
            return dependent_plugins
            
        except Exception as e:
            source.reply(f"查找依赖插件时出错: {e}")
            self.logger.exception(f"查找依赖于插件 {plugin_id} 的其他插件时出错")
            return []

    def _install_dependencies(self, source, plugin_path: str) -> bool:
        """安装插件依赖"""
        try:
            # 检查插件文件是否存在
            if not os.path.exists(plugin_path):
                source.reply(f"插件文件不存在: {plugin_path}")
                return False
                
            import zipfile
            import tempfile
            import subprocess
            import importlib
            import pkg_resources
            from pathlib import Path
            
            # 获取MCDR根目录
            mcdr_root = os.getcwd()
            
            # 创建固定的临时目录
            temp_dir_path = self.get_temp_dir()
            
            # 确保临时目录存在
            try:
                os.makedirs(temp_dir_path, exist_ok=True)
            except Exception as e:
                source.reply(f"创建临时目录失败: {e}")
                return False
            
            # 在固定临时目录中创建临时子目录
            with tempfile.TemporaryDirectory(dir=temp_dir_path) as temp_dir:
                # 解压插件文件
                source.reply("检查插件依赖...")
                
                # 检查是否为有效的zip文件
                if not zipfile.is_zipfile(plugin_path):
                    source.reply("插件文件不是有效的zip格式")
                    return False
                
                # 解压插件
                with zipfile.ZipFile(plugin_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)
                
                # 查找requirements.txt
                requirements_path = Path(temp_dir) / "requirements.txt"
                
                if not requirements_path.exists():
                    source.reply("未找到依赖文件requirements.txt，跳过依赖安装")
                    return True
                
                # 读取依赖列表
                with open(requirements_path, 'r') as f:
                    requirements = [line.strip() for line in f if line.strip() and not line.startswith('#')]
                
                if not requirements:
                    source.reply("没有需要安装的依赖")
                    return True
            
                
                # 获取已安装的包
                installed_packages = {pkg.key: pkg.version for pkg in pkg_resources.working_set}
                
                # 过滤出已安装的依赖
                installed_deps = []
                needed_deps = []
                
                for req in requirements:
                    # 提取包名（忽略版本要求）
                    package_name = req.split('==')[0].split('>=')[0].split('<=')[0].split('>')[0].split('<')[0].strip().lower()
                    
                    # 检查依赖是否已安装
                    if package_name in installed_packages:
                        installed_deps.append(req)
                    else:
                        needed_deps.append(req)
                
                # 显示要安装的依赖
                if installed_deps:
                    source.reply(f"已安装的依赖 ({len(installed_deps)}):")
                    for req in installed_deps:
                        source.reply(RText(f"✓ {req}", color=RColor.green))
                
                if not needed_deps:
                    source.reply(RText("所有依赖已安装，无需操作", color=RColor.green))
                    return True
                    
                source.reply(f"需要安装的依赖 ({len(needed_deps)}):")
                for req in needed_deps:
                    source.reply(f"- {req}")
                
                # 安装依赖
                source.reply("正在安装依赖，这可能需要一些时间...")
                
                # 构建pip命令
                pip_cmd = [sys.executable, "-m", "pip", "install", "--upgrade"]
                
                # 检查是否有pip额外参数
                mcdr_config = self.server.get_mcdr_config()
                pip_extra_args = mcdr_config.get('plugin_pip_install_extra_args', '')
                if pip_extra_args:
                    pip_cmd.extend(pip_extra_args.split())
                
                # 添加依赖项
                pip_cmd.extend(needed_deps)
                
                # 记录命令
                cmd_str = ' '.join(pip_cmd)
                source.reply(f"执行命令: {cmd_str}")
                self.logger.info(f"执行依赖安装命令: {cmd_str}")
                
                # 执行安装
                try:
                    result = subprocess.run(
                        pip_cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        check=True
                    )
                    
                    # 输出安装日志
                    if result.stdout:
                        log_lines = result.stdout.splitlines()
                        if len(log_lines) > 5:
                            # 如果输出太长，只显示最后几行
                            source.reply("安装输出 (部分):")
                            for line in log_lines[-5:]:
                                source.reply(f"> {line}")
                        else:
                            source.reply("安装输出:")
                            for line in log_lines:
                                source.reply(f"> {line}")
                    
                    # 刷新已安装包列表
                    import importlib
                    importlib.invalidate_caches()
                    
                    # 重新加载pkg_resources
                    importlib.reload(pkg_resources)
                    installed_packages = {pkg.key: pkg.version for pkg in pkg_resources.working_set}
                    
                    # 验证依赖安装是否成功
                    failed_deps = []
                    for req in needed_deps:
                        package_name = req.split('==')[0].split('>=')[0].split('<=')[0].split('>')[0].split('<')[0].strip().lower()
                        if package_name not in installed_packages:
                            failed_deps.append(req)
                    
                    if failed_deps:
                        source.reply(RText(f"⚠ 部分依赖安装可能失败: {', '.join(failed_deps)}", color=RColor.yellow))
                        source.reply("将继续尝试加载插件...")
                        return True  # 仍然继续尝试加载插件
                    
                    source.reply(RText(f"✓ 所有依赖安装成功", color=RColor.green))
                    return True
                    
                except subprocess.CalledProcessError as e:
                    source.reply(RText(f"⚠ 依赖安装失败!", color=RColor.red))
                    
                    # 输出错误信息
                    if e.stderr:
                        error_lines = e.stderr.splitlines()
                        source.reply("错误信息:")
                        for line in error_lines[-10:]:  # 只显示最后10行错误
                            source.reply(RText(f"> {line}", color=RColor.red))
                    
                    self.logger.error(f"依赖安装失败: {e.stderr}")
                    source.reply("将继续尝试加载插件...")
                    return True  # 仍然继续尝试加载插件
        except Exception as e:
            source.reply(f"安装依赖时出错: {e}")
            self.logger.exception("安装依赖时出错")
            source.reply("将继续尝试加载插件...")
            return True  # 继续尝试加载插件

# 插件实例
pim_helper: Optional[PIMHelper] = None

class PluginInstaller:
    """
    插件安装器，用于异步安装和卸载插件，并管理任务状态
    """
    # 任务计数器，用于生成唯一任务ID
    _task_counter = 0
    # 共享的任务字典，所有实例共享
    _all_tasks = {}
    # 类级别的锁，确保线程安全
    _global_lock = threading.Lock()
    
    def __init__(self, server: PluginServerInterface):
        self.server = server
        self.logger = server.logger
        self.install_tasks = PluginInstaller._all_tasks  # 使用类共享的任务字典
        self._lock = PluginInstaller._global_lock  # 使用类共享的锁
        
    def get_plugin_versions(self, plugin_id: str) -> List[Dict[str, Any]]:
        """
        获取指定插件的所有可用版本
        
        Args:
            plugin_id: 插件ID
            
        Returns:
            包含版本信息的列表，每个版本包含版本号、发布日期、下载次数等信息
        """
        try:
            # 获取 PIMHelper 实例
            global pim_helper
            if pim_helper is None:
                pim_helper = PIMHelper(self.server)
                
            # 调用 PIMHelper 的 get_plugin_versions 方法
            return pim_helper.get_plugin_versions(plugin_id)
        except Exception as e:
            self.logger.error(f"获取插件 {plugin_id} 版本信息失败: {e}")
            return []
        
    def install_plugin(self, plugin_id: str, version: str = None) -> str:
        """
        异步安装插件
        
        Args:
            plugin_id: 插件ID
            version: 可选的指定版本号
            
        Returns:
            任务ID
        """
        with self._lock:
            PluginInstaller._task_counter += 1
            task_id = f"install_{PluginInstaller._task_counter}"
            
            self.install_tasks[task_id] = {
                'plugin_id': plugin_id,
                'version': version,  # 记录指定的版本号
                'action': 'install',
                'status': 'running',
                'progress': 0.0,
                'message': f"初始化安装 {plugin_id}" + (f" v{version}" if version else ""),
                'start_time': time.time(),
                'end_time': None,
                'access_time': time.time()  # 添加访问时间戳
            }
            
            # 保存到日志，便于调试
            version_info = f" v{version}" if version else ""
            self.logger.info(f"创建安装任务 {task_id} 用于插件 {plugin_id}{version_info}")
            
        # 创建线程运行安装
        thread = threading.Thread(
            target=self._install_plugin_thread,
            args=(task_id, plugin_id, version),
            daemon=True
        )
        thread.start()
        
        return task_id
        
    def uninstall_plugin(self, plugin_id: str) -> str:
        """
        异步卸载插件
        
        Args:
            plugin_id: 插件ID
            
        Returns:
            任务ID
        """
        with self._lock:
            PluginInstaller._task_counter += 1
            task_id = f"uninstall_{PluginInstaller._task_counter}"
            
            self.install_tasks[task_id] = {
                'plugin_id': plugin_id,
                'action': 'uninstall',
                'status': 'running',
                'progress': 0.0,
                'message': f"初始化卸载 {plugin_id}",
                'start_time': time.time(),
                'end_time': None,
                'access_time': time.time()  # 添加访问时间戳
            }
            
            # 保存到日志，便于调试
            self.logger.info(f"创建卸载任务 {task_id} 用于插件 {plugin_id}")
            
        # 创建线程运行卸载
        thread = threading.Thread(
            target=self._uninstall_plugin_thread,
            args=(task_id, plugin_id),
            daemon=True
        )
        thread.start()
        
        return task_id
        
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        获取任务状态
        
        Args:
            task_id: 任务ID
            
        Returns:
            任务状态信息
        """
        with self._lock:
            # 清理超过30分钟的已完成任务
            current_time = time.time()
            tasks_to_remove = []
            
            for tid, task_info in self.install_tasks.items():
                # 检查是否是已完成或失败的任务
                if task_info.get('status') in ['completed', 'failed'] and task_info.get('end_time'):
                    # 检查任务结束时间或最后访问时间是否超过30分钟
                    last_access = task_info.get('access_time', task_info['end_time'])
                    if current_time - last_access > 1800:  # 30分钟 = 1800秒
                        tasks_to_remove.append(tid)
            
            # 删除超时任务
            for tid in tasks_to_remove:
                self.logger.debug(f"删除过期任务记录: {tid}")
                del self.install_tasks[tid]
            
            # 检查请求的任务是否存在
            if task_id not in self.install_tasks:
                return {
                    'status': 'not_found',
                    'message': f"任务 {task_id} 不存在"
                }
            
            # 更新访问时间
            self.install_tasks[task_id]['access_time'] = current_time
            
            # 确保all_messages字段始终存在
            if 'all_messages' not in self.install_tasks[task_id]:
                self.install_tasks[task_id]['all_messages'] = []
            
            return self.install_tasks[task_id].copy()
            
    def get_all_tasks(self) -> Dict[str, Dict[str, Any]]:
        """
        获取所有任务
        
        Returns:
            所有任务的状态信息
        """
        with self._lock:
            # 确保每个任务都有all_messages字段
            for task_id, task_info in self.install_tasks.items():
                if 'all_messages' not in task_info:
                    task_info['all_messages'] = []
                    
            return {task_id: task_info.copy() for task_id, task_info in self.install_tasks.items()}
            
    def _create_command_source(self, task_id: str) -> 'CustomCommandSource': # type: ignore
        """
        创建自定义的命令源，用于捕获安装/卸载过程中的输出
        
        Args:
            task_id: 任务ID
            
        Returns:
            自定义命令源对象
        """
        class CustomCommandSource:
            def __init__(self, installer, task_id):
                self.installer = installer
                self.task_id = task_id
                self.messages = []
                self.error_messages = []
                self.is_console = True  # 控制台源
                
            def reply(self, text):
                # 记录消息
                message = str(text)
                self.messages.append(message)
                
                # 检查是否为错误消息
                is_error = False
                if "⚠" in message or "错误" in message or "失败" in message or "error" in message.lower():
                    is_error = True
                    self.error_messages.append(message)
                
                # 获取任务信息
                task_info = self.installer.install_tasks.get(self.task_id)
                if not task_info:
                    return
                
                # 更新任务状态
                with self.installer._lock:
                    # 更新最新消息
                    task_info['message'] = message
                    
                    # 确保 all_messages 字段存在并更新
                    if 'all_messages' not in task_info:
                        task_info['all_messages'] = []
                    # 避免重复消息
                    if message not in task_info['all_messages']:
                        task_info['all_messages'].append(message)
                    
                    # 根据操作类型和消息内容更新进度
                    if task_info['action'] == 'install':
                        # 安装进度更新
                        if "开始安装" in message:
                            task_info['progress'] = 0.1
                        elif "检查依赖" in message:
                            task_info['progress'] = 0.2
                        elif "正在下载" in message:
                            task_info['progress'] = 0.3
                        elif "下载完成" in message:
                            task_info['progress'] = 0.6
                        elif "正在安装依赖" in message:
                            task_info['progress'] = 0.7
                        elif "正在加载插件" in message:
                            task_info['progress'] = 0.9
                        elif "✓ 插件" in message and "安装并加载成功" in message:
                            task_info['progress'] = 1.0
                            task_info['status'] = 'completed'
                            task_info['end_time'] = time.time()
                    else:
                        # 卸载进度更新
                        if "开始卸载" in message:
                            task_info['progress'] = 0.1
                        elif "正在卸载" in message:
                            task_info['progress'] = 0.3
                        elif "正在删除文件" in message:
                            task_info['progress'] = 0.6
                        elif "✓ 已成功删除" in message:
                            task_info['progress'] = 0.9
                        elif "✓ 插件" in message and "已完全卸载" in message:
                            task_info['progress'] = 1.0
                            task_info['status'] = 'completed'
                            task_info['end_time'] = time.time()
                    
                    # 处理错误状态
                    if is_error:
                        # 检查是否包含失败标记
                        if ("⚠ 插件" in message and "安装失败" in message) or \
                           ("⚠ 卸载插件时发生错误" in message):
                            task_info['status'] = 'failed'
                            task_info['end_time'] = time.time()
                        
                        # 记录所有错误信息
                        if 'error_messages' not in task_info:
                            task_info['error_messages'] = []
                        task_info['error_messages'].append(message)
                        
                        # 记录到日志
                        self.installer.logger.warning(
                            f"{task_info['action']}插件 {task_info['plugin_id']} 时出现问题: {message}"
                        )
            
            def get_server(self):
                return self.installer.server
                
            def get_permission_level(self):
                """获取权限等级，控制台为最高权限"""
                return 4  # 最高权限级别
                
            def get_preference(self):
                return self.installer.server.get_preference()
                
            def has_permission(self, level):
                """权限检查，控制台具有所有权限"""
                return True
                
        return CustomCommandSource(self, task_id)
        
    def _install_plugin_thread(self, task_id: str, plugin_id: str, version: str = None):
        """安装插件的线程函数"""
        try:
            # 创建自定义的 CommandSource 来捕获输出
            source = self._create_command_source(task_id)
            
            # 更新初始消息
            version_info = f" v{version}" if version else ""
            with self._lock:
                if task_id in self.install_tasks:
                    self.install_tasks[task_id]['message'] = f"开始安装插件 {plugin_id}{version_info}"
                    # 设置详细信息记录
                    self.install_tasks[task_id]['error_messages'] = []
                    self.install_tasks[task_id]['all_messages'] = []
            
            # 记录详细日志
            self.logger.info(f"开始异步安装插件 {plugin_id}{version_info} (任务ID: {task_id})")
            
            # 创建任务日志记录器
            class TaskLogger:
                def __init__(self, task):
                    self.task = task
                    self.messages = []
                
                def reply(self, message):
                    # 将消息添加到本地消息列表
                    message_str = str(message)
                    self.messages.append(message_str)
                    
                    # 确保 'logs' 字段存在并更新
                    self.task['logs'] = self.messages
                    
                    # 确保 'all_messages' 字段存在并更新
                    if 'all_messages' not in self.task:
                        self.task['all_messages'] = []
                    
                    # 只有当消息不在 all_messages 中时才添加，避免重复
                    if message_str not in self.task['all_messages']:
                        self.task['all_messages'].append(message_str)
            
            # 创建本地的PIMHelper实例
            local_pim_helper = PIMHelper(self.server)
            
            # 记录日志，同时更新任务进度
            source.reply(f"开始安装插件 {plugin_id}{version_info}")
            
            # 如果指定了版本，使用新的实现
            if version:
                # 创建任务记录器
                task_logger = TaskLogger(self.install_tasks.get(task_id, {}))
                
                # 以下使用新的实现，直接从元数据获取特定版本并安装
                start_time = time.time()
                
                # 获取元数据
                meta = local_pim_helper.get_cata_meta(task_logger)
                if not meta:
                    source.reply(f"获取插件元数据失败")
                    with self._lock:
                        if task_id in self.install_tasks:
                            self.install_tasks[task_id]['status'] = 'failed'
                            self.install_tasks[task_id]['message'] = "获取插件元数据失败"
                            self.install_tasks[task_id]['end_time'] = time.time()
                            self.install_tasks[task_id]['all_messages'] = source.messages
                    return
                
                # 获取插件数据
                plugin_data = meta.get_plugin_data(plugin_id)
                if not plugin_data:
                    source.reply(f"未找到插件 '{plugin_id}'")
                    with self._lock:
                        if task_id in self.install_tasks:
                            self.install_tasks[task_id]['status'] = 'failed'
                            self.install_tasks[task_id]['message'] = f"未找到插件 '{plugin_id}'"
                            self.install_tasks[task_id]['end_time'] = time.time()
                            self.install_tasks[task_id]['all_messages'] = source.messages
                    return
                
                # 寻找指定版本
                target_release = None
                for release in plugin_data.releases:
                    # 标准化版本号（去掉 'v' 前缀）
                    release_version = release.tag_name.lstrip('v') if release.tag_name else ""
                    version_to_match = version.lstrip('v')
                    
                    # 精确匹配
                    if release_version == version_to_match:
                        target_release = release
                        break
                
                # 如果没找到精确匹配，尝试前缀匹配
                if not target_release:
                    for release in plugin_data.releases:
                        release_version = release.tag_name.lstrip('v') if release.tag_name else ""
                        version_to_match = version.lstrip('v')
                        
                        if release_version.startswith(version_to_match):
                            target_release = release
                            break
                
                # 如果仍未找到，使用最新版本
                if not target_release:
                    source.reply(f"未找到版本 '{version}'，将使用最新版本")
                    target_release = plugin_data.get_latest_release()
                    
                    if not target_release:
                        source.reply(f"插件 '{plugin_id}' 没有可用的发布版本")
                        with self._lock:
                            if task_id in self.install_tasks:
                                self.install_tasks[task_id]['status'] = 'failed'
                                self.install_tasks[task_id]['message'] = f"插件 '{plugin_id}' 没有可用的发布版本"
                                self.install_tasks[task_id]['end_time'] = time.time()
                                self.install_tasks[task_id]['all_messages'] = source.messages
                        return
                
                # 先卸载现有版本（如果有）
                installed_plugin = self.server.get_plugin_instance(plugin_id)
                
                if installed_plugin is not None:
                    metadata = self.server.get_plugin_metadata(plugin_id)
                    current_version = str(metadata.version) if metadata else 'unknown'
                    source.reply(f"已安装版本: {current_version}, 将切换到: {target_release.tag_name}")
                    
                    # 卸载现有版本
                    source.reply(f"正在卸载当前版本...")
                    self.server.unload_plugin(plugin_id)
                    local_pim_helper.remove_old_plugin(source, plugin_id)
                
                # 更新进度到50%
                with self._lock:
                    if task_id in self.install_tasks:
                        self.install_tasks[task_id]['progress'] = 0.5
                        self.install_tasks[task_id]['message'] = f"正在下载插件 {plugin_id} {target_release.tag_name}..."
                        if 'all_messages' not in self.install_tasks[task_id]:
                            self.install_tasks[task_id]['all_messages'] = []
                        self.install_tasks[task_id]['all_messages'].append(f"正在下载插件 {plugin_id} {target_release.tag_name}...")
                
                # 下载插件
                source.reply(f"正在下载插件 {plugin_id} {target_release.tag_name}...")
                downloader = ReleaseDownloader(self.server)
                
                # 准备目标路径
                plugin_dir = local_pim_helper.get_plugin_dir()
                target_path = os.path.join(plugin_dir, target_release.file_name or f"{plugin_id}.mcdr")
                
                # 下载插件
                download_success = downloader.download(target_release.browser_download_url, target_path)
                
                if not download_success:
                    source.reply(f"下载插件 {plugin_id} 失败")
                    with self._lock:
                        if task_id in self.install_tasks:
                            self.install_tasks[task_id]['status'] = 'failed'
                            self.install_tasks[task_id]['message'] = f"下载插件 {plugin_id} 失败"
                            self.install_tasks[task_id]['end_time'] = time.time()
                            self.install_tasks[task_id]['all_messages'] = source.messages
                    return
                
                # 更新进度到80%
                with self._lock:
                    if task_id in self.install_tasks:
                        self.install_tasks[task_id]['progress'] = 0.8
                        self.install_tasks[task_id]['message'] = f"正在加载插件 {plugin_id}..."
                        if 'all_messages' not in self.install_tasks[task_id]:
                            self.install_tasks[task_id]['all_messages'] = []
                        self.install_tasks[task_id]['all_messages'].append(f"正在加载插件 {plugin_id}...")
                
                # 加载插件
                source.reply(f"正在加载插件 {plugin_id}...")
                try:
                    self.server.load_plugin(target_path)
                    source.reply(f"✓ 插件 {plugin_id} {target_release.tag_name} 已成功安装并加载")
                    
                    end_time = time.time()
                    with self._lock:
                        if task_id in self.install_tasks:
                            self.install_tasks[task_id]['status'] = 'completed'
                            self.install_tasks[task_id]['progress'] = 1.0
                            self.install_tasks[task_id]['message'] = f"插件 {plugin_id} {target_release.tag_name} 安装成功"
                            self.install_tasks[task_id]['end_time'] = end_time
                            # 确保记录所有消息
                            self.install_tasks[task_id]['all_messages'] = source.messages
                            
                    self.logger.info(f"插件 {plugin_id} {target_release.tag_name} 安装成功，耗时 {end_time - start_time:.2f} 秒")
                except Exception as e:
                    source.reply(f"加载插件失败: {e}")
                    # 检查是否是由于缺少pip包导致的加载失败
                    source.reply(f"正在检查加载失败原因并尝试修复...")
                    
                    # 创建PIMHelper实例用于检查加载失败原因
                    helper = PIMHelper(self.server)
                    helper._check_load_failure(source, target_path)
                    
                    # 再次检查插件是否已成功加载
                    if self.server.get_plugin_instance(plugin_id) is not None:
                        source.reply(f"✓ 插件 {plugin_id} {target_release.tag_name} 修复后成功加载")
                        end_time = time.time()
                        with self._lock:
                            if task_id in self.install_tasks:
                                self.install_tasks[task_id]['status'] = 'completed'
                                self.install_tasks[task_id]['progress'] = 1.0
                                self.install_tasks[task_id]['message'] = f"插件 {plugin_id} {target_release.tag_name} 修复后安装成功"
                                self.install_tasks[task_id]['end_time'] = end_time
                                # 确保记录所有消息
                                self.install_tasks[task_id]['all_messages'] = source.messages
                        
                        self.logger.info(f"插件 {plugin_id} {target_release.tag_name} 修复后安装成功，耗时 {end_time - start_time:.2f} 秒")
                    else:
                        with self._lock:
                            if task_id in self.install_tasks:
                                self.install_tasks[task_id]['status'] = 'failed'
                                self.install_tasks[task_id]['message'] = f"加载插件 {plugin_id} 失败: {e}"
                                self.install_tasks[task_id]['end_time'] = time.time()
                                # 确保记录所有消息
                                self.install_tasks[task_id]['all_messages'] = source.messages
                return
            
            # 如果没有指定版本，使用原有的实现
            start_time = time.time()
            result = local_pim_helper.install_plugin(source, plugin_id)
            end_time = time.time()
            
            # 更新任务状态
            with self._lock:
                if task_id in self.install_tasks:
                    # 记录所有消息
                    self.install_tasks[task_id]['all_messages'] = source.messages
                    
                    if result:
                        self.install_tasks[task_id]['status'] = 'completed'
                        self.install_tasks[task_id]['progress'] = 1.0
                        self.install_tasks[task_id]['message'] = f"插件 {plugin_id} 安装成功"
                        self.logger.info(f"插件 {plugin_id} 安装成功，耗时 {end_time - start_time:.2f} 秒")
                    else:
                        # 尝试处理失败原因，特别是检测缺少的pip包并安装
                        last_failed_plugin_path = None
                        
                        # 尝试查找插件的文件路径
                        try:
                            # 获取插件目录
                            plugin_directories = local_pim_helper.get_plugin_directories()
                            target_dir = plugin_directories[0] if plugin_directories else None
                            
                            if target_dir:
                                # 查找与插件ID匹配的文件
                                for file_name in os.listdir(target_dir):
                                    if file_name.startswith(f"{plugin_id}-") or file_name == f"{plugin_id}.mcdr" or \
                                    file_name.startswith(f"{plugin_id}."):
                                        last_failed_plugin_path = os.path.join(target_dir, file_name)
                                        break
                        except Exception as e:
                            self.logger.debug(f"搜索失败插件路径时出错: {e}")
                        
                        # 如果找到了插件路径，尝试检查失败原因
                        if last_failed_plugin_path and os.path.exists(last_failed_plugin_path):
                            source.reply(f"正在检查插件加载失败原因并尝试修复...")
                            # 创建PIMHelper实例用于检查加载失败原因
                            helper = PIMHelper(self.server)
                            helper._check_load_failure(source, last_failed_plugin_path)
                            
                            # 再次检查插件是否已成功加载
                            if self.server.get_plugin_instance(plugin_id) is not None:
                                source.reply(f"✓ 插件 {plugin_id} 修复后成功加载")
                                with self._lock:
                                    if task_id in self.install_tasks:
                                        self.install_tasks[task_id]['status'] = 'completed'
                                        self.install_tasks[task_id]['progress'] = 1.0
                                        self.install_tasks[task_id]['message'] = f"插件 {plugin_id} 修复后安装成功"
                                        self.logger.info(f"插件 {plugin_id} 修复后安装成功，耗时 {time.time() - start_time:.2f} 秒")
                                        return
                        
                        # 如果修复尝试失败或无法找到插件路径，标记为失败
                        self.install_tasks[task_id]['status'] = 'failed'
                        error_msg = f"插件 {plugin_id} 安装失败"
                        if source.error_messages:
                            error_detail = "，".join(source.error_messages[-3:])  # 最近的3条错误信息
                            error_msg = f"{error_msg}，原因: {error_detail}"
                        self.install_tasks[task_id]['message'] = error_msg
                        self.logger.warning(f"插件 {plugin_id} 安装失败，耗时 {end_time - start_time:.2f} 秒")
                        
                    self.install_tasks[task_id]['end_time'] = time.time()
        except Exception as e:
            self.logger.exception(f"安装插件 {plugin_id} 时出错")
            with self._lock:
                if task_id in self.install_tasks:
                    error_msg = str(e)
                    self.install_tasks[task_id]['status'] = 'failed'
                    self.install_tasks[task_id]['message'] = f"安装出错: {error_msg}"
                    if 'error_messages' not in self.install_tasks[task_id]:
                        self.install_tasks[task_id]['error_messages'] = []
                    self.install_tasks[task_id]['error_messages'].append(error_msg)
                    # 确保all_messages存在，即使出错
                    if 'all_messages' not in self.install_tasks[task_id]:
                        self.install_tasks[task_id]['all_messages'] = [f"安装出错: {error_msg}"]
                    else:
                        self.install_tasks[task_id]['all_messages'].append(f"安装出错: {error_msg}")
                    self.install_tasks[task_id]['end_time'] = time.time()
                    
    def _uninstall_plugin_thread(self, task_id: str, plugin_id: str):
        """卸载插件的线程函数"""
        try:
            # 创建自定义的 CommandSource 来捕获输出
            source = self._create_command_source(task_id)
            
            # 更新初始消息
            with self._lock:
                if task_id in self.install_tasks:
                    self.install_tasks[task_id]['message'] = f"开始卸载插件 {plugin_id}"
                    # 设置详细信息记录
                    self.install_tasks[task_id]['error_messages'] = []
                    self.install_tasks[task_id]['all_messages'] = []
            
            # 记录详细日志
            self.logger.info(f"开始异步卸载插件 {plugin_id} (任务ID: {task_id})")
            
            # 创建本地的PIMHelper实例
            local_pim_helper = PIMHelper(self.server)
            
            # 调用 PIMHelper 卸载插件
            start_time = time.time()
            result = local_pim_helper.uninstall_with_dependents(source, plugin_id)
            end_time = time.time()
            
            # 更新任务状态
            with self._lock:
                if task_id in self.install_tasks:
                    # 记录所有消息
                    self.install_tasks[task_id]['all_messages'] = source.messages
                    
                    if result:
                        self.install_tasks[task_id]['status'] = 'completed'
                        self.install_tasks[task_id]['progress'] = 1.0
                        self.install_tasks[task_id]['message'] = f"插件 {plugin_id} 卸载成功"
                        self.logger.info(f"插件 {plugin_id} 卸载成功，耗时 {end_time - start_time:.2f} 秒")
                    else:
                        self.install_tasks[task_id]['status'] = 'failed'
                        error_msg = f"插件 {plugin_id} 卸载失败"
                        if source.error_messages:
                            error_detail = "，".join(source.error_messages[-3:])  # 最近的3条错误信息
                            error_msg = f"{error_msg}，原因: {error_detail}"
                        self.install_tasks[task_id]['message'] = error_msg
                        self.logger.warning(f"插件 {plugin_id} 卸载失败，耗时 {end_time - start_time:.2f} 秒")
                        
                    self.install_tasks[task_id]['end_time'] = time.time()
        except Exception as e:
            self.logger.exception(f"卸载插件 {plugin_id} 时出错")
            with self._lock:
                if task_id in self.install_tasks:
                    error_msg = str(e)
                    self.install_tasks[task_id]['status'] = 'failed'
                    self.install_tasks[task_id]['message'] = f"卸载出错: {error_msg}"
                    if 'error_messages' not in self.install_tasks[task_id]:
                        self.install_tasks[task_id]['error_messages'] = []
                    self.install_tasks[task_id]['error_messages'].append(error_msg)
                    # 确保all_messages存在，即使出错
                    if 'all_messages' not in self.install_tasks[task_id]:
                        self.install_tasks[task_id]['all_messages'] = [f"卸载出错: {error_msg}"]
                    else:
                        self.install_tasks[task_id]['all_messages'].append(f"卸载出错: {error_msg}")
                    self.install_tasks[task_id]['end_time'] = time.time()

def on_load(server: PluginServerInterface, prev_module):
    global pim_helper, plugin_installer, PENDING_DELETE_FILES, _global_registry
    # 重置待删除文件列表
    PENDING_DELETE_FILES = {}
    # 重置全局注册表
    _global_registry = None
    
    server.logger.info('PIM辅助工具正在加载...')
    
    # 确保插件有正确的元数据
    plugin_file = __file__  # 获取当前脚本文件路径
    plugin_dir = os.path.dirname(os.path.abspath(plugin_file))
    server.logger.info(f'插件文件路径: {plugin_file}')
    server.logger.info(f'插件目录: {plugin_dir}')
    
    # 根据插件文件位置确定元数据文件路径
    if plugin_dir.endswith('/test') or plugin_dir.endswith('\\test'):
        # 如果是在test目录下，往上一级找到plugins目录
        metadata_file = os.path.join(os.path.dirname(plugin_dir), 'mcdr_plugin.json')
    else:
        # 直接在插件所在目录
        metadata_file = os.path.join(plugin_dir, 'mcdr_plugin.json')
    
    # 只在文件不存在时创建
    if not os.path.exists(metadata_file):
        try:
            server.logger.info(f'正在创建插件元数据文件: {metadata_file}')
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(PLUGIN_METADATA, f, ensure_ascii=False, indent=4)
        except Exception as e:
            server.logger.warning(f'创建元数据文件失败: {e}')
    
    # 创建固定的临时目录
    try:
        mcdr_root = os.getcwd()
        
        # 尝试确定宿主插件ID
        host_plugin_id = None
        try:
            # 如果当前运行的是WebUI插件
            if server.get_plugin_instance("guguwebui"):
                host_plugin_id = "guguwebui"
        except:
            pass
        
        # 使用确定的插件ID或默认值
        plugin_id = host_plugin_id or "pim_helper"
        
        temp_dir_path = os.path.join(mcdr_root, "config", plugin_id, "temp")
        os.makedirs(temp_dir_path, exist_ok=True)
        server.logger.info(f'创建临时目录: {temp_dir_path}')
    except Exception as e:
        server.logger.warning(f'创建临时目录失败: {e}')
    
    # 尝试初始化 PIM 助手
    try:
        pim_helper = PIMHelper(server)
        plugin_installer = PluginInstaller(server)
        
        # 注册命令
        server.register_command(
            Literal('!!pim_helper').
            runs(lambda src: show_help(src)).
            then(
                Literal('list').
                runs(lambda src: pim_helper.list_plugins(src)).
                then(
                    QuotableText('keyword').
                    runs(lambda src, ctx: pim_helper.list_plugins(src, ctx['keyword']))
                )
            ).
            then(
                Literal('install').
                then(
                    QuotableText('plugin_id').
                    runs(lambda src, ctx: pim_helper.install_plugin(src, ctx['plugin_id']))
                )
            ).
            then(
                Literal('uninstall').
                then(
                    QuotableText('plugin_id').
                    runs(lambda src, ctx: pim_helper.uninstall_plugin(src, ctx['plugin_id']))
                )
            ).
            then(
                # 添加新命令：强制卸载插件
                Literal('uninstall_force').
                then(
                    QuotableText('plugin_id').
                    runs(lambda src, ctx: pim_helper.uninstall_force(src, ctx['plugin_id']))
                )
            ).
            then(
                # 添加新命令：卸载插件及其依赖项
                Literal('uninstall_with_dependents').
                then(
                    QuotableText('plugin_id').
                    runs(lambda src, ctx: pim_helper.uninstall_with_dependents(src, ctx['plugin_id']))
                )
            ).
            then(
                # 添加新命令：异步安装插件
                Literal('install_async').
                then(
                    QuotableText('plugin_id').
                    runs(lambda src, ctx: install_plugin_async(src, ctx['plugin_id']))
                )
            ).
            then(
                # 添加新命令：异步卸载插件
                Literal('uninstall_async').
                then(
                    QuotableText('plugin_id').
                    runs(lambda src, ctx: uninstall_plugin_async(src, ctx['plugin_id']))
                )
            ).
            then(
                # 添加新命令：查询任务状态
                Literal('task_status').
                then(
                    QuotableText('task_id').
                    runs(lambda src, ctx: show_task_status(src, ctx['task_id']))
                )
            ).
            then(
                # 添加新命令：查询所有任务
                Literal('task_list').
                runs(lambda src: show_all_tasks(src))
            ).
            then(
                # 添加新命令：查看任务日志
                Literal('task_log').
                then(
                    QuotableText('task_id').
                    runs(lambda src, ctx: show_task_log(src, ctx['task_id']))
                )
            )
        )
        
        # 注册帮助信息
        server.register_help_message('!!pim_helper', '使用内部函数管理MCDR插件的辅助工具')
        server.logger.info('PIM辅助工具初始化成功')
    except Exception as e:
        server.logger.error(f'PIM辅助工具加载失败: {e}')
        server.logger.exception('详细错误信息:')

def on_unload(server: PluginServerInterface):
    global pim_helper, plugin_installer, PENDING_DELETE_FILES, _global_registry
    # 重置待删除文件列表
    PENDING_DELETE_FILES = {}
    pim_helper = None
    plugin_installer = None
    _global_registry = None
    server.logger.info('PIM辅助工具已卸载')

def show_help(source):
    help_msg = '''------ PIM辅助工具 ------
!!pim_helper list [关键词] - 列出插件
!!pim_helper install <插件ID> - 安装/更新插件
!!pim_helper uninstall <插件ID> - 卸载插件
!!pim_helper uninstall_force <插件ID> - 强制卸载插件(忽略依赖检查)
!!pim_helper uninstall_with_dependents <插件ID> - 卸载插件及所有依赖它的插件
!!pim_helper install_async <插件ID> - 异步安装插件(返回任务ID)
!!pim_helper uninstall_async <插件ID> - 异步卸载插件(返回任务ID)
!!pim_helper task_status <任务ID> - 查询任务状态
!!pim_helper task_list - 查询所有任务
!!pim_helper task_log <任务ID> - 查看任务的完整日志
-------------------------'''
    source.reply(help_msg)

def install_plugin_async(source, plugin_id: str):
    """异步安装插件"""
    if plugin_installer is None:
        source.reply('PIM辅助工具未初始化')
        return
        
    task_id = plugin_installer.install_plugin(plugin_id)
    source.reply(f'已开始异步安装插件 {plugin_id}，任务ID: {task_id}')
    source.reply(f'使用 !!pim_helper task_status {task_id} 查询进度')

def uninstall_plugin_async(source, plugin_id: str):
    """异步卸载插件"""
    if plugin_installer is None:
        source.reply('PIM辅助工具未初始化')
        return
        
    task_id = plugin_installer.uninstall_plugin(plugin_id)
    source.reply(f'已开始异步卸载插件 {plugin_id}，任务ID: {task_id}')
    source.reply(f'使用 !!pim_helper task_status {task_id} 查询进度')

def show_task_status(source, task_id: str):
    """显示任务状态"""
    if plugin_installer is None:
        source.reply('PIM辅助工具未初始化')
        return
        
    task_info = plugin_installer.get_task_status(task_id)
    
    if task_info['status'] == 'not_found':
        source.reply(f'任务 {task_id} 不存在')
        return
        
    # 计算运行时间
    if task_info['end_time'] is not None:
        duration = task_info['end_time'] - task_info['start_time']
        duration_str = f"{duration:.1f}秒"
    else:
        duration = time.time() - task_info['start_time']
        duration_str = f"{duration:.1f}秒(运行中)"
        
    # 创建状态颜色
    status_text = task_info['status']
    if status_text == 'completed':
        status_display = RText('已完成', color=RColor.green)
    elif status_text == 'failed':
        status_display = RText('失败', color=RColor.red)
    elif status_text == 'running':
        status_display = RText('运行中', color=RColor.yellow)
    else:
        status_display = RText(status_text, color=RColor.gray)
    
    # 创建进度条
    progress = task_info['progress']
    progress_bar = create_progress_bar(progress)
    
    # 显示任务基本信息
    source.reply(RTextList(
        RText('任务ID: ', color=RColor.gold), 
        RText(task_id, color=RColor.white)
    ))
    source.reply(RTextList(
        RText('插件: ', color=RColor.gold), 
        RText(task_info['plugin_id'], color=RColor.white)
    ))
    source.reply(RTextList(
        RText('操作: ', color=RColor.gold), 
        RText('安装' if task_info['action'] == 'install' else '卸载', color=RColor.white)
    ))
    source.reply(RTextList(
        RText('状态: ', color=RColor.gold), 
        status_display
    ))
    source.reply(RTextList(
        RText('进度: ', color=RColor.gold), 
        progress_bar,
        RText(f" {progress*100:.1f}%", color=RColor.white)
    ))
    source.reply(RTextList(
        RText('运行时间: ', color=RColor.gold), 
        RText(duration_str, color=RColor.white)
    ))
    source.reply(RTextList(
        RText('消息: ', color=RColor.gold), 
        RText(task_info['message'], color=RColor.white)
    ))
    
    # 如果有错误信息，显示错误详情
    if task_info.get('status') == 'failed' and task_info.get('error_messages'):
        source.reply(RText('详细错误信息:', color=RColor.red))
        # 最多显示最近的3条错误消息
        error_msgs = task_info['error_messages'][-3:]
        for i, msg in enumerate(error_msgs):
            source.reply(RText(f"{i+1}. {msg}", color=RColor.red))
            
    # 添加查看完整日志的选项
    if task_info.get('all_messages') and len(task_info.get('all_messages', [])) > 0:
        log_msg = RText('点击查看完整日志 »', color=RColor.aqua)
        log_msg.h('点击查看任务的完整日志记录')
        log_msg.c(RAction.run_command, f'!!pim_helper task_log {task_id}')
        source.reply(log_msg)

def create_progress_bar(progress, length=20):
    """创建进度条"""
    filled_length = int(length * progress)
    empty_length = length - filled_length
    
    # 根据进度选择颜色
    if progress >= 1.0:
        bar_color = RColor.green
    elif progress > 0.7:
        bar_color = RColor.yellow
    elif progress > 0.4:
        bar_color = RColor.gold
    else:
        bar_color = RColor.red
        
    # 创建进度条
    bar = RTextList(
        RText('[', color=RColor.gray),
        RText('■' * filled_length, color=bar_color),
        RText('□' * empty_length, color=RColor.gray),
        RText(']', color=RColor.gray)
    )
    return bar

def show_all_tasks(source):
    """显示所有任务"""
    if plugin_installer is None:
        source.reply('PIM辅助工具未初始化')
        return
        
    tasks = plugin_installer.get_all_tasks()
    
    if not tasks:
        source.reply('没有正在运行的任务')
        return
        
    source.reply(RText(f'共有 {len(tasks)} 个任务:', color=RColor.gold))
    
    # 对任务按开始时间排序
    sorted_tasks = sorted(
        tasks.items(), 
        key=lambda x: x[1].get('start_time', 0), 
        reverse=True  # 最新的任务排在前面
    )
    
    for task_id, task_info in sorted_tasks:
        # 计算运行时间
        if task_info['end_time'] is not None:
            duration = task_info['end_time'] - task_info['start_time']
            duration_str = f"{duration:.1f}秒"
        else:
            duration = time.time() - task_info['start_time']
            duration_str = f"{duration:.1f}秒(运行中)"
            
        # 创建状态显示
        status = task_info['status']
        if status == 'completed':
            status_text = RText('已完成', color=RColor.green)
        elif status == 'failed':
            status_text = RText('失败', color=RColor.red)
        elif status == 'running':
            status_text = RText('运行中', color=RColor.yellow)
        else:
            status_text = RText(status, color=RColor.gray)
            
        # 创建进度条
        progress_bar = create_progress_bar(task_info['progress'], length=10)
        
        # 使用RTextList创建漂亮的输出
        task_header = RTextList(
            RText(f"任务 ", color=RColor.white),
            RText(task_id, color=RColor.aqua).c(RAction.run_command, f'!!pim_helper task_status {task_id}').h('点击查看详情'),
            RText(": ", color=RColor.white),
            RText(task_info['plugin_id'], color=RColor.green),
            RText(f" ({task_info['action']})", color=RColor.gray)
        )
        source.reply(task_header)
        
        task_details = RTextList(
            RText("  状态: ", color=RColor.gray),
            status_text,
            RText("  进度: ", color=RColor.gray),
            progress_bar,
            RText(f" {task_info['progress']*100:.0f}%", color=RColor.white),
            RText("  时间: ", color=RColor.gray),
            RText(duration_str, color=RColor.white)
        )
        source.reply(task_details)
        
        # 简短显示最后一条消息
        last_message = task_info['message']
        if len(last_message) > 60:  # 如果消息太长，截断它
            last_message = last_message[:57] + "..."
            
        source.reply(RTextList(
            RText("  消息: ", color=RColor.gray),
            RText(last_message, color=RColor.white)
        ))
        
        # 添加操作按钮
        buttons = RTextList(
            RText("[详情]", color=RColor.aqua).c(RAction.run_command, f'!!pim_helper task_status {task_id}').h('查看任务详情'),
            RText(" ", color=RColor.white),
            RText("[日志]", color=RColor.yellow).c(RAction.run_command, f'!!pim_helper task_log {task_id}').h('查看完整日志')
        )
        source.reply(buttons)
        
        # 任务之间添加分隔符
        source.reply(RText("---", color=RColor.dark_gray))

def show_task_log(source, task_id: str):
    """显示任务的完整日志"""
    if plugin_installer is None:
        source.reply('PIM辅助工具未初始化')
        return
        
    task_info = plugin_installer.get_task_status(task_id)
    
    if task_info['status'] == 'not_found':
        source.reply(f'任务 {task_id} 不存在')
        return
        
    # 检查是否有日志
    if not task_info.get('all_messages'):
        source.reply(f'任务 {task_id} 没有日志记录')
        return
        
    # 显示任务基本信息
    source.reply(RText(f'===== 任务 {task_id} ({task_info["plugin_id"]}) 的完整日志 =====', color=RColor.gold))
    
    # 显示所有消息
    for i, msg in enumerate(task_info['all_messages']):
        # 根据消息类型设置颜色
        color = RColor.white
        if "✓" in msg:
            color = RColor.green
        elif "⚠" in msg or "错误" in msg or "失败" in msg:
            color = RColor.red
        elif "正在" in msg or "..." in msg:
            color = RColor.yellow
            
        source.reply(RText(f"{i+1}. {msg}", color=color))
        
    source.reply(RText('========================================', color=RColor.gold))
    
    # 添加返回按钮
    back_btn = RText('« 返回任务状态', color=RColor.aqua)
    back_btn.h('点击返回任务状态页面')
    back_btn.c(RAction.run_command, f'!!pim_helper task_status {task_id}')
    source.reply(back_btn)

# 在文件最底部添加
# 导出的类和函数，供其他模块导入
__all__ = ['PluginInstaller', 'get_installer', 'create_installer', 'get_global_registry']

def get_installer() -> Optional[PluginInstaller]:
    """
    获取 PluginInstaller 实例
    
    Returns:
        PluginInstaller 实例，如果插件未初始化则返回 None
    """
    return plugin_installer

# 在文件底部添加
def create_installer(server: PluginServerInterface) -> PluginInstaller:
    """
    创建一个新的 PluginInstaller 实例
    
    Args:
        server: MCDR 服务器接口
        
    Returns:
        新创建的 PluginInstaller 实例
    """
    return PluginInstaller(server)

# 更新 __all__ 列表
__all__ = ['PluginInstaller', 'get_installer', 'create_installer', 'get_global_registry']

