
from pathlib import Path
from pydantic import BaseModel
from typing import Optional

ALGORITHM = "HS256"
SECRET_KEY = "guguweb" 
STATIC_PATH = "./guguweb_static"

CSS_FILE = Path(STATIC_PATH) / "custom" / "overall.css"
JS_FILE = Path(STATIC_PATH) / "custom" / "overall.js"

DEFALUT_CONFIG = {
    "port": 8000,
    "super_admin_account": 123456789123456789,
    "disable_other_admin": False,
    "allow_temp_password": True
}

class LoginData(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    token: Optional[str] = None
    remember: Optional[bool] = False

class saveconfig(BaseModel):
    action: str
    port: Optional[str] = None
    superaccount: Optional[str] = None

class toggleconfig(BaseModel):
    plugin_id: str
    status: bool

class SaveContent(BaseModel):
    action: str
    content: str