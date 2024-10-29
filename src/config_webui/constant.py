from typing import Optional
from pydantic import BaseModel

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
    port: Optional[str] 
    superaccount: Optional[str]