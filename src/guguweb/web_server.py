
import datetime
import secrets

from fastapi import Depends, FastAPI, Form, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse, PlainTextResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from passlib.context import CryptContext
from starlette.middleware.sessions import SessionMiddleware

from .constant import *
from .server_util import *

app = FastAPI()

# 模板引擎配置
templates = Jinja2Templates(directory=f"{STATIC_PATH}/templates")

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
    response =  templates.TemplateResponse("login.html", {"request": request, "error": "未知错误。"})

    # 检查账号密码登录
    if account and password:
        if account == admin_account and verify_password(password, admin_password_hash):
            # 生成一个 token
            token = secrets.token_hex(16)
            expiry = str(datetime.datetime.now(datetime.timezone.utc) + (datetime.timedelta(days=365) if remember else datetime.timedelta(days=1)))
            
            response = RedirectResponse(url="/index", status_code=status.HTTP_302_FOUND)
            response.set_cookie("token", token, expires=expiry, path="/", secure=False)

            # 保存 token 和过期时间到 session
            request.session["logged_in"] = True
            request.session["token"] = token
            request.session["username"] = account
            request.session["token_expiry"] = expiry

        else:
            return templates.TemplateResponse("login.html", {"request": request, "error": "账号或密码错误。"})

    # 检查临时登录码
    elif temp_code:
        if temp_code == valid_temp_code:
            # 生成一个 token
            token = secrets.token_hex(16)
            expiry = str(datetime.datetime.now(datetime.timezone.utc) + (datetime.timedelta(days=365) if remember else datetime.timedelta(hours=2)))  # 临时码有效期为2小时
            
            response = RedirectResponse(url="/index", status_code=status.HTTP_302_FOUND)
            response.set_cookie("token", token, expires=expiry, path="/")

            # 保存 token 和过期时间到 session
            request.session["logged_in"] = True
            request.session["token"] = token
            request.session["username"] = admin_account
            request.session["token_expiry"] = expiry

        else:
            # 临时码无效
            return templates.TemplateResponse("login.html", {"request": request, "error": "临时登录码无效。"})

    else:
        # 如果未提供完整的登录信息
        return templates.TemplateResponse("login.html", {"request": request, "error": "请填写完整的登录信息。"})
    
    return response

@app.middleware("http")
async def check_token_expiry(request: Request, call_next):
    # 获取当前 session 中的 token 和到期时间
    token_expiry_str = request.session.get("token_expiry")
    if token_expiry_str:
        token_expiry = datetime.datetime.fromisoformat(token_expiry_str)
        if datetime.datetime.now(datetime.timezone.utc) > token_expiry:
            # 如果 token 已过期，清除 session 并重定向到登录页面
            request.session.clear()
            response = RedirectResponse(url="/login")
            response.delete_cookie("token", path="/")
            return response

    # 如果 token 未过期，继续处理请求
    response = await call_next(request)
    return response

# 注销
@app.get("/logout")
async def logout(request: Request):
    request.session.clear()  # 清除所有会话数据
    response = RedirectResponse(url="/login")
    response.delete_cookie("token", path="/")  # 删除 token cookie
    return response

app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)
#============================================================#
# 后台页面

@app.get("/index", response_class=HTMLResponse)
async def read_index(request: Request, token_valid: bool = Depends(verify_token)):
    if not request.session.get("logged_in"):
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("index.html", {"request": request, "index_path": "/index"})

@app.get("/home", response_class=HTMLResponse)
async def read_home(request: Request, token_valid: bool = Depends(verify_token)):
    if not request.session.get("logged_in"):
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("home.html", {"request": request, "message": "欢迎进入后台主页！"})

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

#============================================================#

@app.get("/api/checkLogin")
async def check_login_status(request: Request, token_valid: bool = Depends(verify_token)):
    if request.session.get("logged_in"):
        # If logged in, return success and user info
        username = request.session.get("username", "tempuser")  # Replace with actual username retrieval
        return JSONResponse({"status": "success", "username": username})
    else:
        return JSONResponse({"status": "error", "message": "User not logged in"}, status_code=401) # If not logged in, return an error response

@app.get("/api/gugubot_plugins")
async def get_gugubot_plugins(token_valid: bool = Depends(verify_token)):
    return JSONResponse(content={"gugubot_plugins": get_gugubot_plugins_info(app.state.server_interface)})

@app.get("/api/plugins")
async def get_plugins(token_valid: bool = Depends(verify_token)):
    return JSONResponse(content={"plugins": get_plugins_info(app.state.server_interface)})

@app.post("/api/toggle_plugin")
async def toggle_plugin(request_body: toggleconfig, token_valid: bool = Depends(verify_token)):
    server = app.state.server_interface
    plugin_id = request_body.plugin_id
    target_status = request_body.status

    # 仅重载
    if plugin_id == "guguweb":
        server.reload_plugin(plugin_id)
    # 加载
    elif target_status == True: 
        _, unloaded_plugin_metadata, unloaded_plugin, disabled_plugin = load_plugin_info(server)
        plugin_path = unloaded_plugin_metadata.get(plugin_id,{}).get("path")
        # 未找到 
        if not plugin_path:
            return
        # 取消禁用
        if plugin_path in disabled_plugin:
            server.enable_plugin(plugin_path)
        server.load_plugin(plugin_path)
    # 卸载插件
    elif target_status == False:
        server.unload_plugin(plugin_id)

@app.get("/api/get_web_config")
async def give_web_config(token_valid: bool = Depends(verify_token)):
    server = app.state.server_interface
    config = server.load_config_simple("config.json", DEFALUT_CONFIG)
    return JSONResponse({
        "port": config['port'], 
        "super_admin_account": config["super_admin_account"],
        "disable_admin_login_web": config["disable_other_admin"],
        "enable_temp_login_password": config["allow_temp_password"]
    })

@app.post("/api/save_web_config")
async def save_web_config(config: saveconfig, token_valid: bool = Depends(verify_token)):
    web_config = app.state.server_interface.load_config_simple("config.json", DEFALUT_CONFIG)
    # change port & account
    if config.action == "config" and config.port:
        web_config['port'] = int(config.port)
        web_config['super_admin_account'] = int(config.superaccount) if config.superaccount else web_config['super_admin_account']
        response = {"status": "success"}
    # disable_admin_login_web & enable_temp_login_password
    elif config.action in ["disable_admin_login_web", "enable_temp_login_password"]:
        config_map = {"disable_admin_login_web": "disable_other_admin", "enable_temp_login_password":"allow_temp_password"}
        web_config[config_map[config.action]] = not web_config[config_map[config.action]]
        response = {"status": "success", "message": web_config[config_map[config.action]]}

    try:
        app.state.server_interface.save_config_simple(web_config)
        return JSONResponse(response)
    except Exception as e:
        return JSONResponse({"status": "fail", "message": e})


# 加载内容
@app.get("/api/load_file", response_class=PlainTextResponse)
async def load_file(file:str, token_valid: bool = Depends(verify_token)):
    file_path = CSS_FILE if file == "css" else JS_FILE
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            return file.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"{file} file not found")

# 保存内容
@app.post("/api/save_file")
async def save_css(data: SaveContent):
    file_path = CSS_FILE if data.action == "css" else JS_FILE
    with open(file_path, "w", encoding="utf-8") as file:
        file.write(data.content)
    return {"status": "success", "message": f"{data.action} saved successfully"}

