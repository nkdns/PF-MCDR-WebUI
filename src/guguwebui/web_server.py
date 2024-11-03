import datetime
import secrets

from fastapi import Depends, FastAPI, Form, Request, status, HTTPException
from fastapi.responses import (
    HTMLResponse,
    RedirectResponse,
    JSONResponse,
    PlainTextResponse,
)
from fastapi.templating import Jinja2Templates
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware

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
        "home.html", {"request": request, "message": "欢迎进入后台主页！"}
    )


async def render_template_if_logged_in(request: Request, template_name: str):
    if not request.session.get("logged_in"):
        return RedirectResponse(url="/login")
    return templates.TemplateResponse(template_name, {"request": request})


@app.get("/gugubot", response_class=HTMLResponse)
async def gugubot(request: Request, token_valid: bool = Depends(verify_token)):
    return await render_template_if_logged_in(request, "gugubot.html")


@app.get("/cq", response_class=HTMLResponse)
async def cq(request: Request, token_valid: bool = Depends(verify_token)):
    return await render_template_if_logged_in(request, "cq.html")


@app.get("/mc", response_class=HTMLResponse)
async def mc(request: Request, token_valid: bool = Depends(verify_token)):
    return await render_template_if_logged_in(request, "mc.html")


@app.get("/mcdr", response_class=HTMLResponse)
async def mcdr(request: Request, token_valid: bool = Depends(verify_token)):
    return await render_template_if_logged_in(request, "mcdr.html")


@app.get("/plugins", response_class=HTMLResponse)
async def plugins(request: Request, token_valid: bool = Depends(verify_token)):
    return await render_template_if_logged_in(request, "plugins.html")


@app.get("/fabric", response_class=HTMLResponse)
async def fabric(request: Request, token_valid: bool = Depends(verify_token)):
    return await render_template_if_logged_in(request, "fabric.html")


@app.get("/about", response_class=HTMLResponse)
async def about(request: Request, token_valid: bool = Depends(verify_token)):
    return await render_template_if_logged_in(request, "about.html")

# 404 page
@app.exception_handler(404)
async def custom_404_handler(request: Request, exc: StarletteHTTPException):
    return templates.TemplateResponse("404.html", {"request": request}, status_code=404)
# ============================================================#

@app.get("/api/checkLogin")
async def check_login_status(
    request: Request, token_valid: bool = Depends(verify_token)
):
    if request.session.get("logged_in"):
        # If logged in, return success and user info
        username = request.session.get(
            "username", "tempuser"
        )  # Replace with actual username retrieval
        return JSONResponse({"status": "success", "username": username})
    else:
        return JSONResponse(
            {"status": "error", "message": "User not logged in"}, status_code=401
        )  # If not logged in, return an error response


# Return gugu plugins' metadata
@app.get("/api/gugubot_plugins")
async def get_gugubot_plugins(token_valid: bool = Depends(verify_token)):
    return JSONResponse(
        content={
            "gugubot_plugins": get_gugubot_plugins_info(app.state.server_interface)
        }
    )


# Return plugins' metadata
@app.get("/api/plugins")
async def get_plugins(detail: bool = False, token_valid: bool = Depends(verify_token)):
    return JSONResponse(
        content={"plugins": get_plugins_info(app.state.server_interface, detail)}
    )


# Install plugin
@app.post("/api/install_plugin")
async def install_plugin(
    plugin_info:plugin_info, token_valid:bool = Depends(verify_token)
):
    plugin_id = plugin_info.plugin_id
    server:PluginServerInterface = app.state.server_interface

    server.execute_command(f"!!MCDR plugin install -y {plugin_id}")


# Loading/Unloading pluging
@app.post("/api/toggle_plugin")
async def toggle_plugin(
    request_body:toggleconfig, token_valid:bool = Depends(verify_token)
):
    server:PluginServerInterface = app.state.server_interface
    plugin_id = request_body.plugin_id
    target_status = request_body.status
    print(plugin_id)
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
            return
        # enable the plugin before load it
        if plugin_path in disabled_plugin:
            server.enable_plugin(plugin_path)
        server.load_plugin(plugin_path)
    # unload
    elif target_status == False:
        server.unload_plugin(plugin_id)


# Reload Plugin
@app.post("/api/reload_plugin")
async def reload_plugin(
    plugin_info:plugin_info, token_valid:bool = Depends(verify_token)
):
    plugin_id = plugin_info.plugin_id
    server:PluginServerInterface = app.state.server_interface

    server_response = server.reload_plugin(plugin_id)

    if server_response: # sucess
        return JSONResponse({"status": "success"})

    return JSONResponse({"status": "error", "message": f"Reload {plugin_id} failed"})   


# Update plugin
@app.post("/api/update_plugin")
async def update_plugin(
    plugin_info:plugin_info, token_valid:bool = Depends(verify_token)
):
    plugin_id = plugin_info.plugin_id
    server:PluginServerInterface = app.state.server_interface

    command = f"!!MCDR plugin install --upgrade {plugin_id}"
    server.execute_command(command) # No function return

    await asyncio.wait(5) # wait of updating process
    return JSONResponse({"status": "success"})


# List all config files for a plugin
@app.get("/api/list_config_files")
async def list_config_files(
    plugin_id:str, token_valid:bool = Depends(verify_token)
):
    config_path_list:list[str] = find_plugin_config_paths(plugin_id)
    return JSONResponse({"files": config_path_list})


@app.get("/api/get_web_config")
async def get_web_config(token_valid: bool = Depends(verify_token)):
    server = app.state.server_interface
    config = server.load_config_simple("config.json", DEFALUT_CONFIG)
    return JSONResponse(
        {
            "port": config["port"],
            "super_admin_account": config["super_admin_account"],
            "disable_admin_login_web": config["disable_other_admin"],
            "enable_temp_login_password": config["allow_temp_password"],
        }
    )


@app.post("/api/save_web_config")
async def save_web_config(
    config: saveconfig, token_valid: bool = Depends(verify_token)
):
    web_config = app.state.server_interface.load_config_simple(
        "config.json", DEFALUT_CONFIG
    )
    # change port & account
    if config.action == "config" and config.port:
        web_config["port"] = int(config.port)
        web_config["super_admin_account"] = (
            int(config.superaccount)
            if config.superaccount
            else web_config["super_admin_account"]
        )
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
        return JSONResponse({"status": "fail", "message": e})


# Load config data & Load config translation
@app.get("/api/load_config")
async def load_config(
    path:str, translation:bool = False, token_valid:bool = Depends(verify_token)
):
    path:Path = Path(path)
    server:PluginServerInterface = app.state.server_interface
    MCDR_language:str = server.get_mcdr_language()

    # Translation for xxx.json -> xxx_lang.json
    if translation and path.suffix == ".json":
        path = path.with_stem(f"{path.stem}_lang")
        
    if not path.exists(): # file not exists
        return JSONResponse({})  

    with open(path, "r", encoding="UTF-8") as f:
        if path.suffix == ".json":
            config = json.load(f)
        elif path.suffix in [".yml", ".yaml"]:
            config = yaml.load(f)

    if translation:
        # Get corresponding language
        if path.suffix == ".json":
            config = config.get(MCDR_language) or config.get("en_us") or {}
        # Translation for yaml -> comment in yaml file
        elif translation and path.suffix in [".yml", ".yaml"]:
            config = get_comment(config)

    return JSONResponse(config)


# Helper function for save_config
# ensure consistent data type
def consistent_type_update(original, updates):
    for key, value in updates.items():
        # dict -> recurssive update
        if isinstance(value, dict) and key in original:
            consistent_type_update(original[key], value)
        # get previous type 
        elif isinstance(value, list) and key in original:
            targe_type = list( # search the first type in the original list
                {type(item) for item in original[key] if item}
            )
            original[key] = [
                (targe_type[0](item) if targe_type else item) if item else None
                for item in value
            ]
        # Force type convertion
        elif key in original:
            original_type = type(original[key])
            original[key] = original_type(value)  
        # new attributes
        else:
            original[key] = value


# /api/save_config {plugin_id, file_name, config_data}
@app.post("/api/save_config")
async def save_config(
    config_data: config_data, token_valid: bool = Depends(verify_token)
):
    config_path = Path(config_data.file_path)
    plugin_config = config_data.config_data

    if not config_path.exists():
        return JSONResponse({"status": "fail", "message": "plugin config not found"})

    # load original config data
    with open(config_path, "r", encoding="UTF-8") as f:
        if config_path.suffix == ".json":
            data = json.load(f)
        elif config_path.suffix in [".yml", ".yaml"]:
            data = yaml.load(f)

    # ensure type will not change
    consistent_type_update(data, plugin_config)

    with open(config_path, "w", encoding="UTF-8") as f:
        if config_path.suffix == ".json":
            json.dump(data, f, ensure_ascii=False)
        elif config_path.suffix in [".yml", ".yaml"]:
            yaml.dump(data, f)


# load overall.js / overall.css
@app.get("/api/load_file", response_class=PlainTextResponse)
async def load_file(file: str, token_valid: bool = Depends(verify_token)):
    file_path = CSS_FILE if file == "css" else JS_FILE
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            return file.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"{file} file not found")


# save overall.js / overall.css
@app.post("/api/save_file")
async def save_css(data: SaveContent, token_valid: bool = Depends(verify_token)):
    file_path = CSS_FILE if data.action == "css" else JS_FILE
    with open(file_path, "w", encoding="utf-8") as file:
        file.write(data.content)
    return {"status": "success", "message": f"{data.action} saved successfully"}


# load config file
@app.get("/api/load_config_file", response_class=PlainTextResponse)
async def load_config_file(path: str, token_valid: bool = Depends(verify_token)):
    try:
        with open(path, "r", encoding="utf-8") as file:
            return file.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"{file} file not found")

# save config file
@app.post("/api/save_config_file")
async def save_config_file(data: SaveContent, token_valid: bool = Depends(verify_token)):
    path = data.action
    with open(path, "w", encoding="utf-8") as file:
        file.write(data.content)
    return {"status": "success", "message": f"{data.action} saved successfully"}
