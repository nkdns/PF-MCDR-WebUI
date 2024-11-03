import asyncio
import uvicorn
import threading

from fastapi import Request, status
from fastapi.responses import RedirectResponse

from .constant import *

# uvicorn server with start and stop function
# Github: https://github.com/zauberzeug/nicegui/issues/1956
class ThreadedUvicorn:
    def __init__(self, config: uvicorn.Config):
        self.server = uvicorn.Server(config)
        self.thread = threading.Thread(daemon=True, target=self.server.run)

    def start(self):
        self.thread.start()
        asyncio.run(self.wait_for_started())

    async def wait_for_started(self):
        while not self.server.started:
            await asyncio.sleep(0.1)

    def stop(self):
        if self.thread.is_alive():
            self.server.should_exit = True
            while self.thread.is_alive():
                continue

# token verification
def verify_token(request: Request):
    token = request.cookies.get("token")  # get token from cookie
    
    if not token: # token not exists
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)

    if token not in user_db['token']: # check token in user_db
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)

    return True
