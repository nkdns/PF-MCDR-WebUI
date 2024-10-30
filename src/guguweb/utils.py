import os

from pathlib import Path

def __copyFile(server, path, target_path): 
    if "custom" in Path(target_path).parts and os.path.exists(target_path):
        return
    target_path = Path(target_path)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    with server.open_bundled_file(path) as file_handler: # 从包内解包文件
        message = file_handler.read()
    with open(target_path, 'wb') as f:                   # 复制文件
        f.write(message)
        
def amount_static_files(server):
    __copyFile(server, 'guguweb/css/about.css', './guguweb_static/css/about.css')
    __copyFile(server, 'guguweb/css/home.css', './guguweb_static/css/home.css')
    __copyFile(server, 'guguweb/css/index.css', './guguweb_static/css/index.css')
    __copyFile(server, 'guguweb/css/login.css', './guguweb_static/css/login.css')
    __copyFile(server, 'guguweb/custom/overall.css', './guguweb_static/custom/overall.css')
    __copyFile(server, 'guguweb/custom/overall.js', './guguweb_static/custom/overall.js')
    __copyFile(server, 'guguweb/js/home.js', './guguweb_static/js/home.js')
    __copyFile(server, 'guguweb/js/index.js', './guguweb_static/js/index.js')
    __copyFile(server, 'guguweb/js/login.js', './guguweb_static/js/login.js')
    __copyFile(server, 'guguweb/js/plugins.js', './guguweb_static/js/plugins.js')
    __copyFile(server, 'guguweb/src/bg.png', './guguweb_static/src/bg.png')
    __copyFile(server, 'guguweb/src/checkbox_select.png', './guguweb_static/src/checkbox_select.png')
    __copyFile(server, 'guguweb/src/default_avatar.jpg', './guguweb_static/src/default_avatar.jpg')
    __copyFile(server, 'guguweb/templates/404.html', './guguweb_static/templates/404.html')
    __copyFile(server, 'guguweb/templates/about.html', './guguweb_static/templates/about.html')
    __copyFile(server, 'guguweb/templates/cq.html', './guguweb_static/templates/cq.html')
    __copyFile(server, 'guguweb/templates/fabric.html', './guguweb_static/templates/fabric.html')
    __copyFile(server, 'guguweb/templates/gugubot.html', './guguweb_static/templates/gugubot.html')
    __copyFile(server, 'guguweb/templates/home.html', './guguweb_static/templates/home.html')
    __copyFile(server, 'guguweb/templates/index.html', './guguweb_static/templates/index.html')
    __copyFile(server, 'guguweb/templates/login.html', './guguweb_static/templates/login.html')
    __copyFile(server, 'guguweb/templates/mc.html', './guguweb_static/templates/mc.html')
    __copyFile(server, 'guguweb/templates/mcdr.html', './guguweb_static/templates/mcdr.html')
    __copyFile(server, 'guguweb/templates/plugins.html', './guguweb_static/templates/plugins.html')



# def generate_copy_instructions(source_dir, target_base_dir):
#     instructions = []
#     source_dir = Path(source_dir)
#     for name in os.listdir(source_dir):
#         if not os.path.isdir(name):
#             continue
#         for file_name in os.listdir(source_dir / name):
#             instructions.append(
#                 f"__copyFile(server, 'guguweb/{name}/{file_name}', '{target_base_dir}/{name}/{file_name}')"
#             )

#     return instructions

# for i in generate_copy_instructions("./", "./guguweb_static"):
#     print(i)