
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
    "allow_temp_password": True
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
    config_data: dict