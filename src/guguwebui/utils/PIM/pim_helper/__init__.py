import os
import json
import hashlib
from mcdreforged.api.all import PluginServerInterface, Literal, QuotableText
from .PIM import (
    PIMHelper, PluginInstaller, PENDING_DELETE_FILES,
    pim_helper, plugin_installer, _global_registry,
    show_help, install_plugin_async, uninstall_plugin_async,
    show_task_status, show_all_tasks, show_task_log, clean_cache,
    get_installer, create_installer, initialize_pim
)


def on_load(server: PluginServerInterface, prev_module):
    global pim_helper, plugin_installer, PENDING_DELETE_FILES, _global_registry
    # 重置待删除文件列表
    PENDING_DELETE_FILES = {}
    # 重置全局注册表
    _global_registry = None

    server.logger.info('PIM辅助工具正在加载...')

    # 尝试初始化 PIM 助手
    try:
        pim_helper = PIMHelper(server)
        plugin_installer = PluginInstaller(server)

        # 初始化时创建并记录缓存目录
        try:
            cache_dir = pim_helper.get_temp_dir()
            server.logger.info(f'缓存目录: {cache_dir}')

            # 清理旧的缓存文件
            def clean_cache_files():
                try:
                    # 清理所有.xz压缩文件，解压后已不需要
                    xz_files = [f for f in os.listdir(cache_dir) if f.endswith('.xz')]
                    for xz_file in xz_files:
                        try:
                            xz_path = os.path.join(cache_dir, xz_file)
                            os.remove(xz_path)
                            server.logger.debug(f'已删除多余的压缩文件: {xz_path}')
                        except Exception as e:
                            server.logger.warning(f'删除压缩文件失败: {xz_file}, 错误: {e}')

                    # 获取官方仓库URL，用于判断
                    server_config = server.load_config_simple("config.json", {"mcdr_plugins_url": "https://api.mcdreforged.com/catalogue/everything_slim.json.xz"}, echo_in_console=False)
                    official_url = server_config.get("mcdr_plugins_url", "https://api.mcdreforged.com/catalogue/everything_slim.json.xz")
                    official_url_hash = hashlib.md5(official_url.encode()).hexdigest()

                    # 检查是否有重复缓存的官方仓库文件 (带有repo_前缀但实际是官方仓库的文件)
                    official_repo_files = [f for f in os.listdir(cache_dir) if f.startswith(f'repo_{official_url_hash}')]
                    for repo_file in official_repo_files:
                        try:
                            repo_path = os.path.join(cache_dir, repo_file)
                            os.remove(repo_path)
                            server.logger.debug(f'已删除重复的官方仓库缓存: {repo_path}')
                        except Exception as e:
                            server.logger.warning(f'删除重复缓存失败: {repo_file}, 错误: {e}')

                    server.logger.debug('缓存清理完成')
                except Exception as e:
                    server.logger.warning(f'清理缓存文件时出错: {e}')

            # 执行清理
            clean_cache_files()

        except Exception as e:
            server.logger.warning(f'获取缓存目录失败: {e}')

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
            ).
            then(
                # 添加新命令：清理缓存
                Literal('clean_cache').
                runs(lambda src: clean_cache(src))
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


# 导出所有需要的函数和类，供其他模块使用
__all__ = [
    'PIMHelper',
    'PluginInstaller',
    'get_installer',
    'create_installer',
    'initialize_pim'
]
