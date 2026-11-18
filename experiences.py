"""Optional HTTPS development tunnel."""
import re
import shutil
import subprocess
import threading


def start_tunnel(port, on_ready):
    binary=shutil.which("cloudflared")
    if not binary:raise RuntimeError("cloudflared is not installed. Install it from https://developers.cloudflare.com/tunnel/downloads/ then restart with --tunnel.")
    process=subprocess.Popen([binary,"tunnel","--url",f"http://127.0.0.1:{port}","--http-host-header",f"127.0.0.1:{port}","--no-autoupdate"],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
    def read():
        found=False
        for line in process.stdout:
            match=re.search(r"https://[a-z0-9-]+\.trycloudflare\.com",line)
            if match and match.group(0)!="https://api.trycloudflare.com" and not found:found=True;on_ready(match.group(0))
        if not found:print("HTTPS tunnel did not start. Check cloudflared and your internet connection; local control is still available.",flush=True)
    threading.Thread(target=read,daemon=True).start()
    return process
