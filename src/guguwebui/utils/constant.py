import ruamel.yaml
from pathlib import Path

from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional

from .table import table

ALGORITHM = "HS256"
SECRET_KEY = "guguwebui" 
STATIC_PATH = "./guguwebui_static"
USER_DB_PATH = Path(STATIC_PATH) / "db.json"
PATH_DB_PATH = Path("./config") / "guguwebui" / "config_path.json"

CSS_FILE = Path(STATIC_PATH) / "custom" / "overall.css"
JS_FILE = Path(STATIC_PATH) / "custom" / "overall.js"

# SERVER_PATH 读config.yml的 working_directory值
CONFIG_FILE_PATH = Path("./config.yml")
yaml = ruamel.yaml.YAML()
with open(CONFIG_FILE_PATH, "r", encoding='utf-8') as config_file:
    config = yaml.load(config_file)
SERVER_PATH = Path(config.get('working_directory', 'server'))

SERVER_PROPERTIES_PATH =  SERVER_PATH / "server.properties"

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# token: {token : {expire_time, user_name}}
# user : {username: password}
# temp : {temppassword: expire_time}
DEFALUT_DB = {
    "token" : {},
    "user": {},
    "temp": {}
}
DEFALUT_CONFIG = {
    "host": "127.0.0.1",
    "port": 8000,
    "super_admin_account": 123456789123456789,
    "disable_other_admin": False,
    "allow_temp_password": True,
    "deepseek_api_key": "",  # DeepSeek API密钥
    "deepseek_model": "deepseek-chat",  # DeepSeek 使用的模型
    "mcdr_plugins_url": "https://api.mcdreforged.com/catalogue/everything_slim.json.xz",  # MCDR插件目录URL
    "repositories": []  # 多仓库配置列表
}

user_db = table(USER_DB_PATH, default_content=DEFALUT_DB)

class LoginData(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    token: Optional[str] = None
    remember: Optional[bool] = False

class saveconfig(BaseModel):
    action: str
    host: Optional[str] = None
    port: Optional[str] = None
    superaccount: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    deepseek_model: Optional[str] = None
    mcdr_plugins_url: Optional[str] = None
    repositories: Optional[list] = None

class toggleconfig(BaseModel):
    plugin_id: str
    status: bool

class SaveContent(BaseModel):
    action: str
    content: str

class plugin_info(BaseModel):
    plugin_id: str

class config_data(BaseModel):
    file_path:str
    config_data:dict

class server_control(BaseModel):
    action:str

class DeepseekQuery(BaseModel):
    query: str
    system_prompt: Optional[str] = None
    model: Optional[str] = None