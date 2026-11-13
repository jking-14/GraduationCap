#!/usr/bin/env python3
"""Local phone -> HTTP -> USB serial controller for the graduation cap."""
import argparse
import hmac
import json
import secrets
import re
import socket
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ANIMATIONS = ["Matrix Rain", "Tron", "Pond Ripples", "Breakout", "Rotating Cube",
    "Loading Bar", "Pong", "DVD", "Starfield", "Lava Lamp", "Sine Waves", "Tetris",
    "Pac-Man", "Snake", "Space Invaders", "Fireworks", "Platformer", "Game of Life",
    "Rain and Lightning", "Growing Plant", "Beach", "Moonlit Campfire", "Underwater", "Spiral / Fractal"]
WEB = Path(__file__).resolve().parent / "web"


def serial_support():
    try:
        import serial
        from serial.tools import list_ports
    except ImportError as exc:
        raise RuntimeError("Install dependencies: python -m pip install -r requirements.txt") from exc
    return serial, list_ports


class CapBridge:
    def __init__(self, serial_factory=None, port_provider=None):
        self.factory = serial_factory
        self.port_provider = port_provider
        self.lock = threading.RLock()
        self.command_lock = threading.Lock()
        self.lifecycle = threading.Lock()
        self.activity_lock = threading.RLock()
        self.serial = None
        self.generation = 0
        self.pending = {}
        self.sequence = secrets.randbelow(1000000) + 1
        self.port = None
        self.ready = False
        self.last_seen = 0
        self.mode = None
        self.animation = -1
        self.last_ack = None
        self.error = None

    def ports(self):
        provider = self.port_provider or serial_support()[1].comports
        return [{"device": p.device, "description": p.description} for p in provider()]

    def status(self):
        with self.lock:
            return {"connected": self.ready and time.monotonic()-self.last_seen < 9,
                "port_open": self.serial is not None, "port": self.port,
                "mode": self.mode, "animation": self.animation,
                "animation_name": ANIMATIONS[self.animation] if 0 <= self.animation < len(ANIMATIONS) else None,
                "last_ack": self.last_ack, "error": self.error}

    def _disconnect(self):
        with self.lock:
            old = self.serial
            self.serial = None
            self.generation += 1
            self.ready = False
            self.port = None
            self.mode = None
            self.animation = -1
            self.last_ack = None
            self.last_seen = 0
            for event, reply in self.pending.values():
                reply.extend([False, "USB disconnected"])
                event.set()
            self.pending.clear()
        if old:
            try:
                old.close()
            except OSError:
                pass

    def disconnect(self):
        with self.lifecycle:
            self._disconnect()

    def connect(self, port):
        with self.lifecycle:
            self._disconnect()
            factory = self.factory or serial_support()[0].Serial
            # Avoid pySerial URL handlers: only enumerated physical USB ports.
            if port not in {p["device"] for p in self.ports()}:
                raise ValueError("Select a serial port from the current port list.")
            try:
                device = factory(port=port, baudrate=115200, timeout=0.1, write_timeout=1)
                with self.lock:
                    self.serial, self.port, self.error = device, port, None
                    generation = self.generation
                threading.Thread(target=self._read, args=(device, generation), daemon=True).start()
                # Opening Due Programming port can reset it; retry the harmless handshake.
                deadline = time.monotonic() + 10
                last_error = None
                while time.monotonic() < deadline:
                    try:
                        response = self.command("PING", timeout=0.8, require_ready=False)
                        if response != "PONG CAP/2":
                            raise RuntimeError("Different firmware: upload the included gradCap2026 sketch.")
                        with self.lock:
                            self.ready = True
                        threading.Thread(target=self._heartbeat, args=(generation,), daemon=True).start()
                        return self.status()
                    except TimeoutError as exc:
                        last_error = exc
                raise RuntimeError("USB opened, but the cap did not reply. Upload the included firmware, use the Programming USB port, and close Arduino Serial Monitor.") from last_error
            except Exception as exc:
                self._disconnect()
                with self.lock:
                    self.error = str(exc)
                raise

    def _read(self, device, generation):
        buffer = b""
        try:
            while True:
                with self.lock:
                    if generation != self.generation or device is not self.serial:
                        return
                chunk = device.read(min(256, max(1, getattr(device, "in_waiting", 0))))
                if not chunk:
                    continue
                buffer += chunk
                while b"\n" in buffer:
                    raw, buffer = buffer.split(b"\n", 1)
                    if len(raw) <= 256:
                        self._line(raw.decode("ascii", "replace").strip(), generation)
                if len(buffer) > 512:
                    buffer = b""
        except (OSError, ValueError) as exc:
            self._fail(generation, "USB read failed: " + str(exc))

    def _line(self, line, generation):
        with self.lock:
            if generation != self.generation:
                return
            parts = line.split()
            if len(parts) == 3 and parts[0] == "STATE" and parts[1] in {"MANUAL", "DEMO", "CEREMONY", "OFF", "DRAW", "GAME"}:
                try:
                    animation = int(parts[2])
                except ValueError:
                    return
                if -1 <= animation < len(ANIMATIONS):
                    self.mode, self.animation = parts[1], animation
            elif len(parts) >= 3 and parts[0] in {"ACK", "ERR"}:
                try:
                    request = int(parts[1])
                except ValueError:
                    return
                pending = self.pending.get(request)
                if pending:
                    event, reply = pending
                    self.last_seen = time.monotonic()
                    message = " ".join(parts[2:])
                    reply.extend([parts[0] == "ACK", message])
                    if parts[0] == "ACK":
                        self.last_ack = {"request": request, "message": message, "time": time.time()}
                    event.set()

    def _fail(self, generation, message):
        with self.lock:
            if generation != self.generation:
                return
            self.error = message
            self._disconnect()

    def command(self, verb, argument=None, timeout=3, require_ready=True):
        if verb not in {"PING", "STATUS", "PLAY", "MODE", "OFF", "DRAW", "PIX", "ROW", "SHOW", "CLEAR", "GAME", "INPUT"}:
            raise ValueError("Unknown command")
        with self.command_lock:
            with self.lock:
                if self.serial is None or (require_ready and not self.ready):
                    raise RuntimeError("Connect to the cap first.")
                self.sequence = self.sequence % 999999998 + 1
                request = self.sequence
                event, reply = threading.Event(), []
                self.pending[request] = (event, reply)
                device = self.serial
                generation = self.generation
            line = f"{verb} {request}" + (f" {argument}" if argument is not None else "") + "\n"
            try:
                payload = line.encode("ascii")
                if device.write(payload) != len(payload):
                    raise OSError("Incomplete USB write")
                if not event.wait(timeout):
                    raise TimeoutError("No cap acknowledgment. The command may have reached it; check the cap before retrying.")
                if not reply[0]:
                    raise RuntimeError("Cap rejected command: " + reply[1])
                return reply[1]
            except TimeoutError:
                raise
            except OSError as exc:
                self._fail(generation, str(exc))
                raise RuntimeError("USB write failed: " + str(exc)) from exc
            finally:
                with self.lock:
                    self.pending.pop(request, None)

    def _heartbeat(self, generation):
        while True:
            time.sleep(2)
            with self.lock:
                if generation != self.generation or not self.ready:
                    return
            try:
                if self.command("PING") != "PONG CAP/2":
                    raise RuntimeError("Unexpected firmware response")
            except (RuntimeError, TimeoutError) as exc:
                self._fail(generation, str(exc))
                return


def local_addresses():
    addresses = {"127.0.0.1"}
    try:
        addresses.update(socket.gethostbyname_ex(socket.gethostname())[2])
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("192.0.2.1", 80))  # Routing lookup only; sends no data.
            addresses.add(probe.getsockname()[0])
    except OSError:
        pass
    return addresses


class BridgeServer(ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, address, bridge, token):
        self.bridge, self.token = bridge, token
        self.allowed_hosts = local_addresses() | {"localhost", address[0]}
        super().__init__(address, Handler)


class Handler(BaseHTTPRequestHandler):
    server_version = "CapBridge/1"
    def log_message(self, fmt, *args):
        pass  # Pairing keys and request bodies are never logged.

    def send(self, status, data, content_type="application/json"):
        body = json.dumps(data).encode() if content_type == "application/json" else data
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def allowed(self):
        host = self.headers.get("Host", "")
        try:
            parsed = urllib.parse.urlsplit("http://" + host)
            if parsed.hostname not in self.server.allowed_hosts or parsed.port != self.server.server_port:
                return False
        except ValueError:
            return False
        origin = self.headers.get("Origin")
        if origin and origin != "http://" + host:
            return False
        return True

    def authenticated(self):
        return hmac.compare_digest(self.headers.get("X-Cap-Key", "").encode(), self.server.token.encode())

    def do_GET(self):
        if not self.allowed():
            self.send(403, {"error": "Open the local address printed by the bridge."}); return
        path = urllib.parse.urlsplit(self.path).path
        if path == "/":
            self.send(200, (WEB / "index.html").read_bytes(), "text/html; charset=utf-8"); return
        if path in {"/app.js", "/creative.js", "/style.css"}:
            self.send(200, (WEB / path[1:]).read_bytes(), "text/javascript; charset=utf-8" if path.endswith("js") else "text/css; charset=utf-8"); return
        if not self.authenticated():
            self.send(401, {"error": "Pair this phone using the complete link printed by the bridge."}); return
        try:
            if path == "/api/status":
                self.send(200, self.server.bridge.status())
            elif path == "/api/animations":
                self.send(200, [{"id": i, "name": n} for i, n in enumerate(ANIMATIONS)])
            elif path == "/api/info":
                addresses = sorted(self.server.allowed_hosts - {"0.0.0.0", "127.0.0.1", "localhost"})
                self.send(200, {"phone_url": f"http://{addresses[0]}:{self.server.server_port}/#key={self.server.token}" if addresses else None})
            elif path == "/api/ports":
                self.send(200, self.server.bridge.ports())
            else:
                self.send(404, {"error": "Not found"})
        except RuntimeError as exc:
            self.send(503, {"error": str(exc)})

    def do_POST(self):
        with self.server.bridge.activity_lock:
            self.handle_post()

    def handle_post(self):
        if not self.allowed():
            self.send(403, {"error": "Cross-origin commands are disabled. Open the local bridge page."}); return
        if not self.authenticated():
            self.send(401, {"error": "Pair this phone using the complete link printed by the bridge."}); return
        try:
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                raise ValueError("Expected JSON")
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 8192:
                raise ValueError("Invalid request size")
            self.connection.settimeout(5)
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError("Expected an object")
            path = urllib.parse.urlsplit(self.path).path
            bridge = self.server.bridge
            if path == "/api/connect":
                port = data.get("port")
                if not isinstance(port, str):
                    raise ValueError("Select a serial port")
                self.send(200, bridge.connect(port)); return
            if path == "/api/disconnect":
                bridge.disconnect(); self.send(200, bridge.status()); return
            if path == "/api/play":
                animation = data.get("id")
                if type(animation) is not int or not 0 <= animation < len(ANIMATIONS):
                    raise ValueError("Invalid animation")
                reply = bridge.command("PLAY", animation)
            elif path == "/api/game":
                game = data.get("id")
                if type(game) is not int or game not in {3, 6, 13}:
                    raise ValueError("Playable games: Pong, Breakout, Snake")
                reply = bridge.command("GAME", game)
            elif path == "/api/input":
                if "paddle" in data and "direction" not in data:
                    position = data["paddle"]
                    if type(position) is not int or not 0 <= position <= 23:
                        raise ValueError("Paddle must be between 0 and 23")
                    reply = bridge.command("INPUT", f"P{position}")
                elif "direction" in data and "paddle" not in data:
                    direction = data["direction"]
                    if not isinstance(direction,str) or direction not in {"UP","DOWN","LEFT","RIGHT"}:
                        raise ValueError("Invalid direction")
                    reply = bridge.command("INPUT", direction)
                else:
                    raise ValueError("Send a paddle position or a direction")
            elif path == "/api/draw/start":
                reply = bridge.command("DRAW")
            elif path == "/api/draw/clear":
                if bridge.status()["mode"] != "DRAW":
                    bridge.command("DRAW")
                reply = bridge.command("CLEAR")
            elif path == "/api/draw/frame":
                pixels = data.get("pixels")
                if not isinstance(pixels,str) or not re.fullmatch(r"[0-9a-fA-F]{3456}",pixels):
                    raise ValueError("A drawing needs exactly 576 RGB pixels")
                if bridge.status()["mode"] != "DRAW":
                    bridge.command("DRAW")
                for row in range(24):
                    bridge.command("ROW",f"{row},{pixels[row*144:(row+1)*144]}")
                reply = bridge.command("SHOW")
            elif path == "/api/draw/stroke":
                pixels = data.get("pixels")
                if not isinstance(pixels,list) or not 1 <= len(pixels) <= 32:
                    raise ValueError("Send between 1 and 32 pixels")
                commands=[]
                for pixel in pixels:
                    if not isinstance(pixel,dict):
                        raise ValueError("Invalid pixel")
                    x,y,color=pixel.get("x"),pixel.get("y"),pixel.get("color")
                    if type(x) is not int or type(y) is not int or not 0 <= x < 24 or not 0 <= y < 24 or not isinstance(color,str) or not re.fullmatch(r"[0-9a-fA-F]{6}",color):
                        raise ValueError("Invalid pixel coordinate or color")
                    commands.append(f"{x},{y},{color}")
                for pixel in commands:
                    bridge.command("PIX",pixel)
                reply = bridge.command("SHOW")
            elif path == "/api/mode":
                mode = data.get("mode")
                if not isinstance(mode, str) or mode not in {"DEMO", "CEREMONY"}:
                    raise ValueError("Invalid mode")
                reply = bridge.command("MODE", mode)
            elif path == "/api/off":
                reply = bridge.command("OFF")
            elif path == "/api/ping":
                reply = bridge.command("PING")
            else:
                self.send(404, {"error": "Not found"}); return
            # Ask for state after an applied command; this orders state before HTTP reply.
            if path not in {"/api/input", "/api/draw/stroke"}:
                bridge.command("STATUS")
            self.send(200, {"ack": reply, "state": bridge.status()})
        except (ValueError, json.JSONDecodeError) as exc:
            self.send(400, {"error": str(exc)})
        except TimeoutError as exc:
            self.send(504, {"error": str(exc)})
        except (RuntimeError, OSError) as exc:
            self.send(503, {"error": str(exc)})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--serial", help="Optional initial USB port, e.g. COM5 or /dev/cu.usbmodem...")
    args = parser.parse_args()
    try:
        serial_support()
    except RuntimeError as exc:
        parser.exit(1, str(exc) + "\n")
    bridge = CapBridge()
    token = secrets.token_urlsafe(24)
    try:
        server = BridgeServer((args.host, args.port), bridge, token)
    except OSError as exc:
        parser.exit(1, f"Cannot start bridge: {exc}. Try --port 8766.\n")
    print("\nGraduation Cap controller — keep this window open.\n")
    print(f"  Computer: http://127.0.0.1:{server.server_port}/#key={token}")
    for address in sorted(server.allowed_hosts - {"0.0.0.0", "localhost", "127.0.0.1"}):
        print(f"  Phone:    http://{address}:{server.server_port}/#key={token}")
    print("\nOpen the full link on your computer or iPhone (same Wi-Fi).")
    print("Use the Due Programming USB port. Close Arduino Serial Monitor.\n")
    if args.serial:
        try:
            bridge.connect(args.serial)
        except (RuntimeError, OSError, ValueError) as exc:
            print("Initial connection failed:", exc)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping bridge. The cap keeps its current mode.")
    finally:
        bridge.disconnect()
        server.server_close()


if __name__ == "__main__":
    main()
