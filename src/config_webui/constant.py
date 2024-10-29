
from mcdreforged.api.all import Serializable

class CONFIG(Serializable):
    port: int = 8000
    super_admin_account: int = 123456789123456789
    disable_other_admin: bool = False
    allow_temp_password: bool = True