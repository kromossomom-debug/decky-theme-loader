import asyncio
import os
import sys
import http.server
import json
import threading
import urllib.request
import aiohttp

# Usage: python3 scripts/install_decky.py [path/to/theme-loader.zip]
ZIP_PATH = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "theme-loader.zip"))

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        return ZIP_PATH
    def log_message(self, format, *args):
        pass

def run_server():
    server = http.server.HTTPServer(("127.0.0.1", 8998), Handler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server

async def install():
    token = urllib.request.urlopen("http://127.0.0.1:1337/auth/token").read().decode()
    async with aiohttp.ClientSession() as session:
        async with session.ws_connect(f"ws://127.0.0.1:1337/ws?auth={token}") as ws:
            req_id_future = asyncio.get_event_loop().create_future()
            done_future = asyncio.get_event_loop().create_future()

            async def reader():
                while True:
                    raw = await ws.receive()
                    # The socket closes when the script finishes; stop quietly
                    if raw.type != aiohttp.WSMsgType.TEXT:
                        break
                    msg = json.loads(raw.data)
                    evt = msg.get("event")
                    if evt == "loader/add_plugin_install_prompt":
                        req_id = msg["args"][2]
                        if not req_id_future.done():
                            req_id_future.set_result(req_id)
                    elif evt == "loader/plugin_download_finish":
                        if not done_future.done():
                            done_future.set_result(True)
                    elif evt == "loader/import_plugin":
                        print("Decky imported:", msg["args"])
                    if msg.get("type") == -1:
                        print("Error:", msg)
                        break

            task = asyncio.create_task(reader())
            print("Requesting plugin installation to Decky Loader...")
            await ws.send_json({
                "type": 0,
                "route": "utilities/install_plugin",
                "args": ["http://127.0.0.1:8998/theme-loader.zip", "theme-loader"],
                "id": 600,
            })

            req_id = await asyncio.wait_for(req_id_future, timeout=8)
            print("Confirming installation (request_id:", req_id, ")...")
            await ws.send_json({
                "type": 0,
                "route": "utilities/confirm_plugin_install",
                "args": [req_id],
                "id": 601,
            })

            await asyncio.wait_for(done_future, timeout=15)
            print("Successfully installed and loaded in Decky Loader!")
            await asyncio.sleep(1)

if __name__ == "__main__":
    server = run_server()
    asyncio.run(install())
    server.shutdown()
