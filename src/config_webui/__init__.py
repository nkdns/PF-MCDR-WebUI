import asyncio
import threading

from mcdreforged.api.types import PluginServerInterface

from .web_server import start_fastapi
#============================================================#

fastapi_task = None
fastapi_stop_event = threading.Event()

def start_fastapi_in_thread(server, fastapi_stop_event):
    global fastapi_task
    # Create and set a new event loop for this thread
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        fastapi_task = loop.run_until_complete(start_fastapi(server, fastapi_stop_event))
    finally:
        loop.close()

def on_load(server: PluginServerInterface, old):
    global fastapi_task
    server.logger.info("FastAPI Plugin loaded. Starting FastAPI server...")

    fastapi_stop_event.clear()
    thread = threading.Thread(target=start_fastapi_in_thread, args=(server, fastapi_stop_event))
    thread.start()

def on_unload(server: PluginServerInterface):
    global fastapi_task

    fastapi_stop_event.set()

    if fastapi_task:
        fastapi_task.cancel()
        try:
            asyncio.get_event_loop().run_until_complete(fastapi_task)
        except asyncio.CancelledError:
            server.logger.info("FastAPI server task canceled successfully.")
        fastapi_task = None

    server.logger.info("FastAPI Plugin unloaded.")