import socket

from fastapi import FastAPI, Form, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

from passlib.context import CryptContext
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import RedirectResponse
from typing import Optional
from pydantic import BaseModel

from .constant import *
from .server_util import *

app = FastAPI()
app.mount("/src", StaticFiles(directory="./plugins/config_webui/config_webui/src"), name="static")
app.mount("/js", StaticFiles(directory="./plugins/config_webui/config_webui/js"), name="static")
app.mount("/css", StaticFiles(directory="./plugins/config_webui/config_webui/css"), name="static")
app.add_middleware(SessionMiddleware, secret_key="your_secret_key")

# 模板引擎配置
templates = Jinja2Templates(directory="./plugins/config_webui/config_webui/templates")

# 加密密码的上下文
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# 模拟的管理员账户数据（在实际应用中应从数据库获取）
admin_account = "admin"
admin_password_hash = pwd_context.hash("password")  # 使用加密密码
valid_temp_code = "valid_temp_code"  # 示例临时登录码

# 验证密码
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

#============================================================#

# 首页重定向到登录页
@app.get("/", response_class=RedirectResponse)
def read_root():
    return RedirectResponse(url="/login")

# 登录页面
@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

# 处理登录请求
@app.post("/login")
async def login(
    request: Request,
    account: str = Form(""),
    password: str = Form(""),
    temp_code: str = Form(""),
    remember: bool = Form(False),
):
    # 检查账号密码登录
    if account and password:
        if account == admin_account and verify_password(password, admin_password_hash):
            request.session["logged_in"] = True
            return RedirectResponse(url="/index", status_code=status.HTTP_302_FOUND)
        else:
            return templates.TemplateResponse("login.html", {"request": request, "error": "账号或密码错误。"})

    # 检查临时登录码
    elif temp_code:
        if temp_code == valid_temp_code:
            request.session["logged_in"] = True
            return RedirectResponse(url="/index", status_code=status.HTTP_302_FOUND)
        else:
            return templates.TemplateResponse("login.html", {"request": request, "error": "临时登录码无效。"})

    return templates.TemplateResponse("login.html", {"request": request, "error": "请填写完整的登录信息。"})

# 注销
@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)

#============================================================#
# 后台页面
@app.get("/home", response_class=HTMLResponse)
async def dashboard(request: Request):
    if not request.session.get("logged_in"):
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("home.html", {"request": request, "message": "欢迎进入后台主页！"})

@app.get("/index", response_class=HTMLResponse)
async def read_index(request: Request):
    if not request.session.get("logged_in"):
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("index.html", {"request": request, "index_path": "/index"})

@app.get("/home", response_class=HTMLResponse)
async def read_home(request: Request):
    if not request.session.get("logged_in"):
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("home.html", {"request": request})

@app.get("/gugubot", response_class=HTMLResponse)
async def read_home(request: Request):
    if not request.session.get("logged_in"):
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("gugubot.html", {"request": request})

@app.get("/about", response_class=HTMLResponse)
async def read_home(request: Request):
    if not request.session.get("logged_in"):
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("about.html", {"request": request})

#============================================================#

@app.get("/api/gugubot_plugins")
async def get_gugubot_plugins():
    return JSONResponse(content={"gugubot_plugins": gugubot_plugins(app.state.server_interface)})

@app.get("/api/plugins")
async def get_plugins():
    return JSONResponse(content={"plugins": plugins(app.state.server_interface)})

@app.get("/api/checkLogin")
async def check_login_status(request: Request):
    if request.session.get("logged_in"):
        # If logged in, return success and user info
        username = request.session.get("username", "tempuser")  # Replace with actual username retrieval
        return JSONResponse({"status": "success", "username": username})
    else:
        return JSONResponse({"status": "error", "message": "User not logged in"}, status_code=401) # If not logged in, return an error response

@app.get("/api/toggle_plugin")
async def toggle_plugin(plugin_id:str, status:bool):
    reload_only_plugins = ["gugubot", "cq_qq_api"]

    server = app.state.server_interface
    respond_status = None

    if plugin_id in reload_only_plugins:
        respond_status = server.reload_plugin(plugin_id)
    elif status == True: # # -> disabled it
        respond_status = server.disable_plugin(plugin_id)
    elif status == False:
        respond_status = server.enable_plugin(plugin_id)
        if not respond_status:
            respond_status = server.load_plugin(plugin_id)

    if respond_status:
        return JSONResponse(
            {"status": "success"}
        )
    return JSONResponse(
        {"status": "failed", "message": f"{status} failed" if respond_status is not None else "plugin not found"},
        status_code=500,
    )

@app.get("/api/get_web_config")
async def give_web_config():
    server = app.state.server_interface
    config = server.load_config_simple("config.json", DEFALUT_CONFIG)
    return JSONResponse(config)

@app.post("/api/save_web_config")
async def save_web_config(config: saveconfig):
    web_config = app.state.server_interface.load_config_simple("config.json", DEFALUT_CONFIG)
    if config.action == "config" and config.port:
        web_config['port'] = int(config.port)
        web_config['super_admin_account'] = int(config.superaccount) if config.superaccount else web_config['super_admin_account']
    elif config.action == "disable_admin_login_web":
        web_config['disable_other_admin'] = not web_config['disable_other_admin']
    elif config.action == "enable_temp_login_password":
        web_config['allow_temp_password'] = not web_config['allow_temp_password']

    try:
        app.state.server_interface.save_config_simple(web_config)
        return JSONResponse({"status": "success"})
    except Exception as e:
        return JSONResponse({"status": "fail", "message": e})
