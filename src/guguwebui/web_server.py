import datetime
import javaproperties
import secrets
import aiohttp

from pathlib import Path

from fastapi import Depends, FastAPI, Form, Request, status, HTTPException
from fastapi.responses import (
    HTMLResponse,
    RedirectResponse,
    JSONResponse,
    PlainTextResponse,
)
from fastapi.templating import Jinja2Templates
from ruamel.yaml.comments import CommentedSeq
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware

from .utils.log_watcher import LogWatcher

from .utils.constant import *
from .utils.server_util import *
from .utils.table import yaml
from .utils.utils import *

app = FastAPI()

# template engine -> jinja2
templates = Jinja2Templates(directory=f"{STATIC_PATH}/templates")

# ============================================================#

# redirect to login
@app.get("/", response_class=RedirectResponse)
def read_root():
    return RedirectResponse(url="/login")


# login page
@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    # token is valid
    token = request.cookies.get("token")
    server:PluginServerInterface = app.state.server_interface
    server_config = server.load_config_simple("config.json", DEFALUT_CONFIG)

    disable_other_admin = server_config.get("disable_other_admin", False)
    super_admin_account = server_config.get("super_admin_account")

    def login_admin_check(account, disable_other_admin, super_admin_account):
        if disable_other_admin and account != super_admin_account:
            return False
        return True

    if (
        token
        and user_db["token"].get(token)
        and user_db["token"][token]["expire_time"]
        > str(datetime.datetime.now(datetime.timezone.utc))
        and login_admin_check(user_db["token"][token]["user_name"], disable_other_admin, super_admin_account)
    ):
        request.session["logged_in"] = True
        request.session["token"] = token
        request.session["username"] = user_db["token"][token]["user_name"]
        return RedirectResponse(url="/index", status_code=status.HTTP_302_FOUND)

    # no token / expired token
    response = templates.TemplateResponse("login.html", {"request": request})
    if token:
        if token in user_db["token"]:
            del user_db["token"][token]
            user_db.save()
        response.delete_cookie("token")
    return response


# login request
@app.post("/login")
async def login(
    request: Request,
    account: str = Form(""),
    password: str = Form(""),
    temp_code: str = Form(""),
    remember: bool = Form(False),
):
    response = templates.TemplateResponse(
        "login.html", {"request": request, "error": "未知错误。"}
    )
    now = datetime.datetime.now(datetime.timezone.utc)
    server:PluginServerInterface = app.state.server_interface
    server_config = server.load_config_simple("config.json", DEFALUT_CONFIG)

    # check account & password
    if account and password:
        # check if super admin & only_super_admin
        disable_other_admin = server_config.get("disable_other_admin", False)
        super_admin_account = str(server_config.get("super_admin_account"))
        if disable_other_admin and account != super_admin_account:
            return templates.TemplateResponse(
                "login.html", {"request": request, "error": "只有超级管理才能登录。"}
            )

        if account in user_db["user"] and verify_password(
            password, user_db["user"][account]
        ):
            # token Generation
            token = secrets.token_hex(16)
            expiry = now + (
                    datetime.timedelta(days=365)
                    if remember
                    else datetime.timedelta(days=1)
                )
            max_age = datetime.timedelta(days=365) if remember else datetime.timedelta(days=1)
            max_age = max_age.total_seconds()

            response = RedirectResponse(url="/index", status_code=status.HTTP_302_FOUND)
            response.set_cookie("token", token, expires=expiry, path="/", httponly=True, max_age=max_age)

            # save token & username session
            request.session["logged_in"] = True
            request.session["token"] = token
            request.session["username"] = account

            user_db["token"][token] = {"user_name": account, "expire_time": str(expiry)}
            user_db.save()

        else:
            return templates.TemplateResponse(
                "login.html", {"request": request, "error": "账号或密码错误。"}
            )

    # temp password
    elif temp_code:
        # disallow temp_password check
        allow_temp_password = server_config.get('allow_temp_password', True)
        if not allow_temp_password:
            return templates.TemplateResponse(
                "login.html", {"request": request, "error": "已禁止临时登录码登录。"}
            )

        if temp_code in user_db["temp"] and user_db["temp"][temp_code] > str(now):
            # token Generation
            token = secrets.token_hex(16)
            expiry = now + datetime.timedelta(hours=2)  # 临时码有效期为2小时
            max_age = datetime.timedelta(hours=2)
            max_age = max_age.total_seconds()

            response = RedirectResponse(url="/index", status_code=status.HTTP_302_FOUND)
            response.set_cookie("token", token, expires=expiry, path="/", httponly=True, max_age=max_age)

            # save token & username in session
            request.session["logged_in"] = True
            request.session["token"] = token
            request.session["username"] = "tempuser"

            user_db["token"][token] = {"user_name": "tempuser", "expire_time": str(expiry)}
            user_db.save()

        else:
            if temp_code in user_db["temp"]:  # delete expired token
                del user_db["temp"][temp_code]
                user_db.save()
            # Inavalid temp password
            return templates.TemplateResponse(
                "login.html", {"request": request, "error": "临时登录码无效。"}
            )

    else:
        # 如果未提供完整的登录信息
        return templates.TemplateResponse(
            "login.html", {"request": request, "error": "请填写完整的登录信息。"}
        )

    return response


# logout Endpoint
@app.get("/logout", response_class=RedirectResponse)
def logout(request: Request):
    request.session["logged_in"] = False
    request.session.clear()  # clear session data
    response = RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    response.delete_cookie("token", path="/")  # delete token cookie
    return response

app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)
# ============================================================#
# Pages
@app.get("/index", response_class=HTMLResponse)
async def read_index(request: Request, token_valid: bool = Depends(verify_token)):
    if not request.session.get("logged_in"):
        return RedirectResponse(url="/login")
    return templates.TemplateResponse(
        "index.html", {"request": request, "index_path": "/index"}
    )


@app.get("/home", response_class=HTMLResponse)
async def read_home(request: Request, token_valid: bool = Depends(verify_token)):
    if not request.session.get("logged_in"):
        return RedirectResponse(url="/login")
    return templates.TemplateResponse(
        "home.html", {"request": request, "message": "欢迎进入后台主页！", "index_path": "/index"}
    )


async def render_template_if_logged_in(request: Request, template_name: str):
    if not request.session.get("logged_in"):
        return RedirectResponse(url="/login")
    return templates.TemplateResponse(template_name, {"request": request, "index_path": "/index"})

@app.get("/gugubot", response_class=HTMLResponse)
async def gugubot(request: Request, token_valid: bool = Depends(verify_token)):
    try:
        return await render_template_if_logged_in(request, "gugubot.html")
    except Exception:
        return templates.TemplateResponse("404.html", {"request": request}, status_code=404)


@app.get("/cq", response_class=HTMLResponse)
async def cq(request: Request, token_valid: bool = Depends(verify_token)):
    try:
        return await render_template_if_logged_in(request, "cq.html")
    except Exception:
        return templates.TemplateResponse("404.html", {"request": request}, status_code=404)


@app.get("/mc", response_class=HTMLResponse)
async def mc(request: Request, token_valid: bool = Depends(verify_token)):
    try:
        return await render_template_if_logged_in(request, "mc.html")
    except Exception:
        return templates.TemplateResponse("404.html", {"request": request}, status_code=404)


@app.get("/mcdr", response_class=HTMLResponse)
async def mcdr(request: Request, token_valid: bool = Depends(verify_token)):
    try:
        return await render_template_if_logged_in(request, "mcdr.html")
    except Exception:
        return templates.TemplateResponse("404.html", {"request": request}, status_code=404)


@app.get("/plugins", response_class=HTMLResponse)
async def plugins(request: Request, token_valid: bool = Depends(verify_token)):
    try:
        return await render_template_if_logged_in(request, "plugins.html")
    except Exception:
        return templates.TemplateResponse("404.html", {"request": request}, status_code=404)


@app.get("/online-plugins", response_class=HTMLResponse)
async def online_plugins(request: Request, token_valid: bool = Depends(verify_token)):
    try:
        return await render_template_if_logged_in(request, "online-plugins.html")
    except Exception:
        return templates.TemplateResponse("404.html", {"request": request}, status_code=404)


@app.get("/fabric", response_class=HTMLResponse)
async def fabric(request: Request, token_valid: bool = Depends(verify_token)):
    try:
        return await render_template_if_logged_in(request, "fabric.html")
    except Exception:
        return templates.TemplateResponse("404.html", {"request": request}, status_code=404)


@app.get("/settings", response_class=HTMLResponse)
async def settings(request: Request, token_valid: bool = Depends(verify_token)):
    try:
        return await render_template_if_logged_in(request, "settings.html")
    except Exception:
        return templates.TemplateResponse("404.html", {"request": request}, status_code=404)


@app.get("/about", response_class=HTMLResponse)
async def about(request: Request, token_valid: bool = Depends(verify_token)):
    try:
        return await render_template_if_logged_in(request, "about.html")
    except Exception:
        return templates.TemplateResponse("404.html", {"request": request}, status_code=404)

# 404 page
@app.exception_handler(404)
async def custom_404_handler(request: Request, exc: StarletteHTTPException):
    return templates.TemplateResponse("404.html", {"request": request}, status_code=404)
# ============================================================#

@app.get("/api/checkLogin")
async def check_login_status(request: Request):
    if request.session.get("logged_in"):
        username = request.session.get("username", "tempuser")
        return JSONResponse({"status": "success", "username": username})
    return JSONResponse({"status": "error", "message": "User not logged in"})


# Return gugu plugins' metadata
@app.get("/api/gugubot_plugins")
async def get_gugubot_plugins(request: Request):
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    return JSONResponse(
        content={
            "gugubot_plugins": get_gugubot_plugins_info(app.state.server_interface)
        }
    )


# Return plugins' metadata
@app.get("/api/plugins")
async def get_plugins(request: Request, detail: bool = False):
    plugins = get_plugins_info(app.state.server_interface, detail)
    if not request.session.get("logged_in"):
        # 未登录时仅返回guguwebui插件信息
        guguwebui_plugin = next((p for p in plugins if p["id"] == "guguwebui"), None)
        if guguwebui_plugin:
            return JSONResponse(
                content={"plugins": [guguwebui_plugin]}
            )
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    return JSONResponse(
        content={"plugins": plugins}
    )

# 请求 https://looseprince.github.io/Plugin-Catalogue/plugins.json 返回json，免登录
@app.get("/api/online-plugins")
async def get_online_plugins(request: Request):
    url = "https://looseprince.github.io/Plugin-Catalogue/plugins.json"
    try:
        response = requests.get(url, timeout=10)  # 增加超时时间设置
        if response.status_code == 200:
            plugins_data = response.json()
            return plugins_data
        else:
            return {}
    except requests.RequestException as e:
        return {}


# Install plugin
@app.post("/api/install_plugin")
async def install_plugin(request: Request, plugin_info:plugin_info):
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    plugin_id = plugin_info.plugin_id
    if plugin_id == "guguwebui":
        return JSONResponse({"status": "error", "message": "无法处理自身"})
    server:PluginServerInterface = app.state.server_interface

    # server.execute_command(f"!!MCDR plugin install -y {plugin_id}")
    # return JSONResponse({"status": "success"})
    # 开始监听并匹配日志
    log_watcher = LogWatcher()
    # 设置需要监控的模式
    patterns = [
        "已安装的插件已满足所述需求，无需安装任何插件",
        "插件安装完成",
        "Nothing needs to be installed",
        "Installation done"
    ]

    # 开始监控
    log_watcher.start_watch(patterns)

    # 模拟服务器指令
    await asyncio.sleep(2)
    server.execute_command(f"!!MCDR plugin install -y {plugin_id}")

    # 获取匹配结果
    result = log_watcher.get_result(timeout=10, match_all=False)

    # 根据匹配结果进行响应
    if (result.get("已安装的插件已满足所述需求，无需安装任何插件", True) or result.get("Nothing needs to be installed", True)):
        return JSONResponse({"status": "success", "message": "已安装的插件已满足所述需求，无需安装任何插件"})
    elif (result.get("插件安装完成", True) or result.get("Installation done", True)):
        return JSONResponse({"status": "success"})
    else:
        return JSONResponse({"status": "error", "message": "安装失败"})


# Loading/Unloading pluging
@app.post("/api/toggle_plugin")
async def toggle_plugin(request: Request, request_body:toggleconfig):
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    server:PluginServerInterface = app.state.server_interface
    plugin_id = request_body.plugin_id
    target_status = request_body.status

    # reload only for guguwebui
    if plugin_id == "guguwebui":
        server.reload_plugin(plugin_id)
    # loading
    elif target_status == True:
        _, unloaded_plugin_metadata, unloaded_plugin, disabled_plugin = (
            load_plugin_info(server)
        )
        plugin_path = unloaded_plugin_metadata.get(plugin_id, {}).get("path")
        # plugin not found
        if not plugin_path:
            return JSONResponse(
                {"status": "error", "message": "Plugin not found"}, status_code=404
            )
        # enable the plugin before load it
        if plugin_path in disabled_plugin:
            server.enable_plugin(plugin_path)
        server.load_plugin(plugin_path)
    # unload
    elif target_status == False:
        server.unload_plugin(plugin_id)
    return JSONResponse({"status": "success"})


# Reload Plugin
@app.post("/api/reload_plugin")
async def reload_plugin(request: Request, plugin_info:plugin_info):
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    plugin_id = plugin_info.plugin_id
    if plugin_id == "guguwebui":
        return JSONResponse({"status": "error", "message": "无法处理自身"})
    server:PluginServerInterface = app.state.server_interface

    server_response = server.reload_plugin(plugin_id)

    if server_response: # sucess
        return JSONResponse({"status": "success"})

    return JSONResponse({"status": "error", "message": f"Reload {plugin_id} failed"}, status_code=500)   


# Update plugin
@app.post("/api/update_plugin")
async def update_plugin(request: Request, plugin_info:plugin_info):
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    plugin_id = plugin_info.plugin_id
    if plugin_id == "guguwebui":
        return JSONResponse({"status": "error", "message": "无法处理自身"})
    server:PluginServerInterface = app.state.server_interface

    # 开始监听并匹配日志
    log_watcher = LogWatcher()
    # 设置需要监控的模式
    patterns = [
        "已安装的插件已满足所述需求，无需安装任何插件",
        "插件安装完成",
        "Nothing needs to be installed",
        "Installation done"
    ]

    # 开始监控
    log_watcher.start_watch(patterns)

    # 模拟服务器指令
    await asyncio.sleep(2)
    server.execute_command(f"!!MCDR plugin install -U {plugin_id}")
    await asyncio.sleep(2)
    server.execute_command("!!MCDR confirm")

    # 获取匹配结果
    result = log_watcher.get_result(timeout=10, match_all=False)

    # 根据匹配结果进行响应
    if (result.get("已安装的插件已满足所述需求，无需安装任何插件", True) or result.get("Nothing needs to be installed", True)):
        return JSONResponse({"status": "error", "message": "已安装的插件不满足要求，无法更新"})
    elif (result.get("插件安装完成", True) or result.get("Installation done", True)):
        return JSONResponse({"status": "success"})
    else:
        return JSONResponse({"status": "error", "message": "更新失败"})


# List all config files for a plugin
@app.get("/api/list_config_files")
async def list_config_files(request: Request, plugin_id:str):
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    config_path_list:list[str] = find_plugin_config_paths(plugin_id)
    return JSONResponse({"files": config_path_list})


@app.get("/api/get_web_config")
async def get_web_config(request: Request):
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    server = app.state.server_interface
    config = server.load_config_simple("config.json", DEFALUT_CONFIG)
    return JSONResponse(
        {   
            "host": config["host"],
            "port": config["port"],
            "super_admin_account": config["super_admin_account"],
            "disable_admin_login_web": config["disable_other_admin"],
            "enable_temp_login_password": config["allow_temp_password"],
            "deepseek_api_key": config.get("deepseek_api_key", ""),
            "deepseek_model": config.get("deepseek_model", "deepseek-chat"),
        }
    )


@app.post("/api/save_web_config")
async def save_web_config(request: Request, config: saveconfig):
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    web_config = app.state.server_interface.load_config_simple(
        "config.json", DEFALUT_CONFIG
    )
    # change port & account
    if config.action == "config":
        if config.host:
            web_config["host"] = config.host
        if config.port:
            web_config["port"] = int(config.port)
        if config.superaccount:
            web_config["super_admin_account"] = int(config.superaccount)
        # 更新DeepSeek配置
        if config.deepseek_api_key is not None:
            web_config["deepseek_api_key"] = config.deepseek_api_key
        if config.deepseek_model is not None:
            web_config["deepseek_model"] = config.deepseek_model
        
        response = {"status": "success"}
    # disable_admin_login_web & enable_temp_login_password
    elif config.action in ["disable_admin_login_web", "enable_temp_login_password"]:
        config_map = {
            "disable_admin_login_web": "disable_other_admin",
            "enable_temp_login_password": "allow_temp_password",
        }
        web_config[config_map[config.action]] = not web_config[
            config_map[config.action]
        ]
        response = {
            "status": "success",
            "message": web_config[config_map[config.action]],
        }

    try:
        app.state.server_interface.save_config_simple(web_config)
        return JSONResponse(response)
    except Exception as e:
        return JSONResponse({"status": "fail", "message": str(e)}, status_code=500)


# Load config data & Load config translation
@app.get("/api/load_config")
async def load_config(request: Request, path:str, translation:bool = False, type:str = "auto"):
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    path:Path = Path(path)
    server:PluginServerInterface = app.state.server_interface
    MCDR_language:str = server.get_mcdr_language()

    # 提取 config/chat_with_deepseek 目录
    config_dir = path.parent
    main_json_path = config_dir / "main.json"

    if type == "auto":
        # 读取 main.json
        main_config = {}
        if main_json_path.exists():
            try:
                with open(main_json_path, "r", encoding="UTF-8") as f:
                    main_config = json.load(f)
            except Exception:
                pass  # 解析失败则保持 main_config 为空字典

        # 获取 config.json 的值（可能指向 HTML 文件）
        config_value = main_config.get(path.name)  # 这里 path.name 应该是 "config.json"
        if config_value:
            html_path = config_dir / config_value  # 构造 HTML 文件路径
            if html_path.exists() and html_path.suffix == ".html":
                try:
                    with open(html_path, "r", encoding="UTF-8") as f:
                        return JSONResponse({"status": "success", "type": "html", "content": f.read()})
                except Exception:
                    return JSONResponse(
                        {"status": "error", "message": "Failed to read HTML file"},
                        status_code=500,
                    )

    # Translation for xxx.json -> xxx_lang.json
    if translation:
        if path.suffix in [".json", ".properties"]:
            path = path.with_stem(f"{path.stem}_lang")
        if path.suffix == ".properties":
            path = path.with_suffix(f".json")
        
    if not path.exists(): # file not exists
        return JSONResponse({}, status_code=200)  

    try:
        with open(path, "r", encoding="UTF-8") as f:
            if path.suffix == ".json":
                config = json.load(f)
            elif path.suffix in [".yml", ".yaml"]:
                config = yaml.load(f)
            elif path.suffix == ".properties":
                config = javaproperties.load(f)
                # convert string "true" "false" to True False
                config = {k:v if v not in ["true", "false"] else 
                          True if v == "true" else False 
                          for k,v in config.items()}
    except json.JSONDecodeError:
        if path.suffix == ".json":
            config = {}
    except UnicodeDecodeError:
        # Handle encoding errors
        with open(path, "r", encoding="UTF-8", errors="replace") as f:
            if path.suffix == ".json":
                config = json.load(f)

    if translation:
        # Get corresponding language
        if path.suffix in [".json", ".properties"]:
            config = config.get(MCDR_language) or config.get("en_us") or {}
        # Translation for yaml -> comment in yaml file
        elif translation and path.suffix in [".yml", ".yaml"]:
            config = get_comment(config)

    return JSONResponse(config)


# Helper function for save_config
# ensure consistent data type
def consistent_type_update(original, updates):
    for key, value in updates.items():
        # setting to None
        if key in original and original[key] is None and \
            (not value or (isinstance(value,list) and not any(value))):
            continue
        # dict -> recurssive update
        elif isinstance(value, dict) and key in original:
            consistent_type_update(original[key], value)
        # get previous type 
        elif isinstance(value, list) and key in original:
            # save old comment
            original_ca = original[key].ca.items if isinstance(original[key], CommentedSeq) else None

            targe_type = list( # search the first type in the original list
                {type(item) for item in original[key] if item}
            ) if original[key] else None

            temp_list = [
                (targe_type[0](item) if targe_type else item) if item else None
                for item in value
            ]

            if original_ca: # save comment to last attribute
                original[key] = CommentedSeq(temp_list)
                original[key].ca.items[len(original[key])-1] = original_ca[max(original_ca)]
            else:
                original[key] = temp_list

        # Force type convertion
        elif key in original and original[key]:
            original_type = type(original[key])
            original[key] = original_type(value)  
        # new attributes
        else:
            original[key] = value


# /api/save_config {plugin_id, file_name, config_data}
@app.post("/api/save_config")
async def save_config(request: Request, config_data: config_data):
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    
    config_path = Path(config_data.file_path)
    if config_path == Path("config\\guguwebui\\config.json"):
        return JSONResponse({"status": "error", "message": "无法在此处修改guguwebui配置文件"})

    plugin_config = config_data.config_data

    if not config_path.exists():
        return JSONResponse({"status": "fail", "message": "plugin config not found"})

    try:
        # load original config data
        with open(config_path, "r", encoding="UTF-8") as f:
            if config_path.suffix == ".json":
                data = json.load(f)
            elif config_path.suffix in [".yml", ".yaml"]:
                data = yaml.load(f)
            elif config_path.suffix == ".properties":
                data = javaproperties.load(f)
                # convert back the True False to "true" "false"
                plugin_config = {k: v if not isinstance(v, bool) else 
                                 "true" if v else "false" 
                                 for k, v in plugin_config.items()}
    except Exception as e:
        print(f"Error loading config file: {e}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

    # ensure type will not change
    try:
        consistent_type_update(data, plugin_config)
    except Exception as e:
        print(f"Error updating config data: {e}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

    try:
        # save config data
        with open(config_path, "w", encoding="UTF-8") as f:
            if config_path.suffix == ".json":
                json.dump(data, f, ensure_ascii=False, indent=4)
            elif config_path.suffix in [".yml", ".yaml"]:
                yaml.dump(data, f)
            elif config_path.suffix == ".properties":
                javaproperties.dump(data, f)
        return JSONResponse({"status": "success", "message": "配置文件保存成功"})
    except Exception as e:
        print(f"Error saving config file: {e}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


# load overall.js / overall.css
@app.get("/api/load_file", response_class=PlainTextResponse)
async def load_file(request: Request, file: str):
    if not request.session.get("logged_in"):
        return JSONResponse({"status": "error", "message": "User not logged in"}, status_code=401)
    file_path = CSS_FILE if file == "css" else JS_FILE
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            return file.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"{file} file not found")


# save overall.js / overall.css
@app.post("/api/save_file")
async def save_css(request: Request, data: SaveContent):
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    file_path = CSS_FILE if data.action == "css" else JS_FILE
    with open(file_path, "w", encoding="utf-8") as file:
        file.write(data.content)
    return {"status": "success", "message": f"{data.action} saved successfully"}


# load config file
@app.get("/api/load_config_file", response_class=PlainTextResponse)
async def load_config_file(request: Request, path: str):
    if not request.session.get("logged_in"):
        return JSONResponse({"status": "error", "message": "User not logged in"}, status_code=401)
    try:
        with open(path, "r", encoding="utf-8") as file:
            return file.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"{file} file not found")

# save config file
@app.post("/api/save_config_file")
async def save_config_file(request: Request, data: SaveContent):
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    path = data.action
    if path == "config\\guguwebui\\config.json":
        return JSONResponse({"status": "error", "message": "无法在此处修改guguwebui配置文件"})
    with open(path, "w", encoding="utf-8") as file:
        file.write(data.content)
    return {"status": "success", "message": f"{data.action} saved successfully"}

# read MC server status
@app.get("/api/get_server_status")
async def get_server_status(request: Request):
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    server:PluginServerInterface = app.state.server_interface

    server_status = "online" if server.is_server_running() or server.is_server_startup() else "offline"
    server_message = get_java_server_info()

    server_version = server_message.get("server_version", "")
    version_string = f"Version: {server_version}" if server_version else ""
    player_count = server_message.get("server_player_count")
    max_player = server_message.get("server_maxinum_player_count")
    player_string = f"{player_count}/{max_player}" if player_count and max_player else ""

    result = {
        "status": server_status,
        "version": version_string, 
        "players": player_string, 
    }

    return JSONResponse(result)

# 控制Minecraft服务器
@app.post("/api/control_server")
async def control_server(request: Request, control_info: server_control):
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    
    server:PluginServerInterface = app.state.server_interface
    action = control_info.action
    
    allowed_actions = ["start", "stop", "restart"]
    if action not in allowed_actions:
        return JSONResponse(
            {"status": "error", "message": f"无效的操作: {action}，允许的操作: {', '.join(allowed_actions)}"}, 
            status_code=400
        )
    
    try:
        # 发送命令到MCDR
        server.execute_command(f"!!MCDR server {action}")
        
        # 根据操作返回对应的消息
        messages = {
            "start": "服务器启动命令已发送",
            "stop": "服务器停止命令已发送",
            "restart": "服务器重启命令已发送"
        }
        
        return JSONResponse({
            "status": "success",
            "message": messages[action]
        })
    except Exception as e:
        return JSONResponse(
            {"status": "error", "message": f"执行命令出错: {str(e)}"}, 
            status_code=500
        )

# 获取服务器日志
@app.get("/api/server_logs")
async def get_server_logs(request: Request, start_line: int = 0, max_lines: int = 100, log_type: str = "mcdr", merged: bool = False):
    """
    获取服务器日志
    
    Args:
        start_line: 开始行号（0为文件开始）
        max_lines: 最大返回行数（防止返回过多数据）
        log_type: 日志类型，支持 'mcdr'（MCDR日志）、'minecraft'（Minecraft服务器日志）和'merged'（合并日志）
        merged: 是否合并MCDR和Minecraft日志
    """
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    
    try:
        # 限制最大返回行数，防止过多数据导致性能问题
        if max_lines > 500:
            max_lines = 500
        
        # 获取日志文件路径
        mcdr_log_path = "logs/MCDR.log"
        mc_log_path = get_minecraft_log_path(app.state.server_interface)
        
        # 处理合并日志请求
        if merged:
            log_watcher = LogWatcher()
            result = log_watcher.get_merged_logs(mcdr_log_path, mc_log_path, max_lines)
            
            # 格式化合并日志内容
            formatted_logs = []
            for i, log in enumerate(result["logs"]):
                formatted_logs.append({
                    "line_number": i,
                    "content": log["content"],
                    "source": log["source"]
                })
            
            return JSONResponse({
                "status": "success",
                "logs": formatted_logs,
                "total_lines": result["total_lines"],
                "current_start": result["start_line"],
                "current_end": result["end_line"],
                "log_type": "merged"
            })
        
        # 处理单一类型日志请求
        if log_type == "minecraft":
            log_file_path = mc_log_path
        else:
            log_file_path = mcdr_log_path
        
        log_watcher = LogWatcher(log_file_path=log_file_path)
        
        # 如果请求特定行号之后的日志
        if start_line > 0:
            result = log_watcher.get_logs_after_line(start_line, max_lines)
        else:
            # 否则获取最新的日志
            result = log_watcher.get_latest_logs(max_lines)
        
        # 格式化日志内容，去除行尾换行符，添加行号
        formatted_logs = []
        for i, line in enumerate(result["logs"]):
            line_number = result["start_line"] + i
            formatted_logs.append({
                "line_number": line_number,
                "content": line.rstrip("\n"),
                "source": log_type
            })
        
        return JSONResponse({
            "status": "success",
            "logs": formatted_logs,
            "total_lines": result["total_lines"],
            "current_start": result["start_line"],
            "current_end": result["end_line"],
            "log_type": log_type
        })
    except Exception as e:
        return JSONResponse(
            {"status": "error", "message": f"获取日志出错: {str(e)}"}, 
            status_code=500
        )

# 获取最新的日志更新
@app.get("/api/new_logs")
async def get_new_logs(request: Request, last_line: int = 0, log_type: str = "mcdr"):
    """
    获取最新的日志更新，用于增量更新日志
    
    Args:
        last_line: 客户端已有的最后一行行号
        log_type: 日志类型，支持 'mcdr'（MCDR日志）和 'minecraft'（Minecraft服务器日志）
    """
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    
    try:
        # 根据日志类型选择不同的日志文件
        if log_type == "minecraft":
            # 获取基于MCDR配置的Minecraft日志路径，传递服务器接口
            log_file_path = get_minecraft_log_path(app.state.server_interface)
        else:
            log_file_path = "logs/MCDR.log"  # 默认MCDR日志
            
        log_watcher = LogWatcher(log_file_path=log_file_path)
        
        # 先获取总行数，以确定是否有新日志
        total_info = log_watcher.get_logs_after_line(0, 1)
        total_lines = total_info["total_lines"]
        
        # 没有新日志
        if last_line >= total_lines:
            return JSONResponse({
                "status": "success",
                "logs": [],
                "total_lines": total_lines,
                "has_new": False
            })
        
        # 有新日志，获取新的日志行
        max_new_lines = 200  # 限制一次获取的最大新日志行数
        result = log_watcher.get_logs_after_line(last_line, min(total_lines - last_line, max_new_lines))
        
        # 格式化日志内容
        formatted_logs = []
        for i, line in enumerate(result["logs"]):
            line_number = last_line + i
            formatted_logs.append({
                "line_number": line_number,
                "content": line.rstrip("\n")
            })
        
        return JSONResponse({
            "status": "success",
            "logs": formatted_logs,
            "total_lines": total_lines,
            "has_new": True
        })
    except Exception as e:
        return JSONResponse(
            {"status": "error", "message": f"获取日志更新出错: {str(e)}"}, 
            status_code=500
        )

@app.get("/terminal")
async def terminal_page(request: Request):
    """提供终端日志页面
    
    Args:
        request: FastAPI请求对象
    
    Returns:
        TemplateResponse: 终端日志页面
    """
    # 检查是否已登录
    username = request.session.get("username")
    if not username:
        return RedirectResponse(url="/login?redirect=/terminal")
    
    return templates.TemplateResponse("terminal.html", {"request": request})

@app.post("/api/send_command")
async def send_command(request: Request):
    """
    发送命令到MCDR终端
    """
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )
    
    try:
        # 获取请求体中的命令
        data = await request.json()
        command = data.get("command", "").strip()
        
        if not command:
            return JSONResponse(
                {"status": "error", "message": "Command cannot be empty"}, 
                status_code=400
            )
        
        # 获取MCDR服务器接口
        server:PluginServerInterface = app.state.server_interface
        
        # 输出到MCDR的日志
        server.logger.info(f"发送命令: {command}")
        
        # 处理以/开头的命令，尝试通过RCON发送
        if command.startswith("/"):
            # 去掉开头的/，因为RCON不需要
            mc_command = command[1:]
            
            # 检查RCON是否已连接
            if hasattr(server, "is_rcon_running") and server.is_rcon_running():
                try:
                    # 通过RCON发送命令并获取反馈
                    feedback = server.rcon_query(mc_command)
                    server.logger.info(f"RCON反馈: {feedback}")
                    return JSONResponse({
                        "status": "success",
                        "message": f"Command sent via RCON: {command}",
                        "feedback": feedback
                    })
                except Exception as e:
                    server.logger.error(f"RCON执行命令出错: {str(e)}")
                    # RCON执行失败，回退到普通方式执行
                    server.execute_command(command)
                    return JSONResponse({
                        "status": "success",
                        "message": f"Command sent (RCON failed): {command}",
                        "error": str(e)
                    })
            else:
                server.logger.info("RCON未启用，使用普通方式发送命令")
        
        # 普通方式执行命令
        server.execute_command(command)
        
        return JSONResponse({
            "status": "success",
            "message": f"Command sent: {command}"
        })
    except Exception as e:
        return JSONResponse(
            {"status": "error", "message": f"Error sending command: {str(e)}"}, 
            status_code=500
        )

@app.post("/api/deepseek")
async def query_deepseek(request: Request, query_data: DeepseekQuery):
    """
    向DeepSeek API发送问题并获取回答
    
    Args:
        request: FastAPI请求对象
        query_data: 查询数据，包含问题内容
    
    Returns:
        JSONResponse: AI回答内容
    """
    # 检查是否已登录
    if not request.session.get("logged_in"):
        return JSONResponse(
            {"status": "error", "message": "用户未登录"}, status_code=401
        )
    
    try:
        # 加载配置
        server = app.state.server_interface
        config = server.load_config_simple("config.json", DEFALUT_CONFIG)
        
        # 获取API密钥
        api_key = config.get("deepseek_api_key", "")
        if not api_key:
            return JSONResponse(
                {"status": "error", "message": "未配置DeepSeek API密钥"}, 
                status_code=400
            )
        
        # 获取模型配置
        model = query_data.model or config.get("deepseek_model", "deepseek-chat")
        
        # 检查查询内容
        query = query_data.query.strip()
        if not query:
            return JSONResponse(
                {"status": "error", "message": "查询内容不能为空"}, 
                status_code=400
            )
        
        # 准备API请求
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        # 构建消息
        messages = []
        
        # 添加系统指令（如果有）
        if query_data.system_prompt:
            messages.append({
                "role": "system",
                "content": query_data.system_prompt
            })
        
        # 添加用户问题
        messages.append({
            "role": "user",
            "content": query
        })
        
        # 准备请求数据
        json_data = {
            "model": model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 4000
        }
        
        # 发送请求到DeepSeek API
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.deepseek.com/chat/completions", 
                headers=headers, 
                json=json_data
            ) as response:
                # 解析响应
                result = await response.json()
                
                if response.status != 200:
                    error_msg = result.get("error", {}).get("message", "未知错误")
                    return JSONResponse(
                        {"status": "error", "message": f"API错误: {error_msg}"}, 
                        status_code=response.status
                    )
                
                # 从响应中提取AI回答
                answer = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                
                return JSONResponse({
                    "status": "success",
                    "answer": answer,
                    "model": model
                })
                
    except Exception as e:
        server = app.state.server_interface
        server.logger.error(f"DeepSeek API请求失败: {str(e)}")
        return JSONResponse(
            {"status": "error", "message": f"请求失败: {str(e)}"}, 
            status_code=500
        )
