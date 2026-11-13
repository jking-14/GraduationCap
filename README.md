# Graduation Cap · Local Phone Controller

A small local bridge for Jason’s 24×24 Arduino Due cap. Choose any of the 24 animations from an iPhone while the Due is connected to a computer by USB.

The connection is:

**iPhone Safari → local Wi-Fi → Python bridge on your computer → USB → Due**

The computer hosts the page and forwards commands. The Due confirms commands after applying them. Nothing needs to be deployed online for this version.

## 1. Upload the included firmware

1. Open `firmware/gradCap2026/gradCap2026.ino` in Arduino IDE.
2. Install/select **Arduino SAM Boards → Arduino Due (Programming Port)** and **FastLED 3.7.5**, the library used by this sketch.
3. Plug the cable into the Due’s **Programming USB port**, choose its COM/serial port, and upload. Use a USB data cable.
4. **Close Arduino Serial Monitor and Serial Plotter** before connecting the bridge. Stop the bridge or use Disconnect USB before uploading again.

The firmware contains all current animations. It starts in Demo mode and runs without a computer. Serial control uses **115200 baud**. The existing LED pins, brightness and current settings are preserved.

For the Due’s Native USB connector instead, change `#define CAP_SERIAL Serial` near the top to `#define CAP_SERIAL SerialUSB` and select the Native USB board/port in Arduino IDE. The Programming port is the default setup and is the one to try first.

## 2. Start the bridge on the computer

Install **Python 3.10 or newer** from python.org. On Windows, the Python launcher (`py`) must be installed. The first start needs internet to install pySerial.

### Windows

Double-click **`start-windows.bat`** inside this folder. It creates a local virtual environment, installs pySerial, and starts the bridge. Leave the window open.

Or run manually in PowerShell:

```powershell
py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe bridge.py
```

### macOS / Linux

Open Terminal in this folder:

```sh
sh start-macos-linux.sh
```

Or run manually:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python bridge.py
```

If the port is in use, add `--port 8766`. To connect a known USB port automatically, add `--serial COM5` on Windows or the appropriate `/dev/cu.usbmodem...` / `/dev/ttyACM...` port on macOS/Linux. These arguments work with `bridge.py`; the macOS/Linux launcher also forwards arguments.

## 3. Open the selector on your iPhone

1. Put the computer and iPhone on the **same Wi-Fi network**.
2. Open the complete **Computer** link printed by the bridge in the computer’s browser.
3. Select the Due’s USB port and click **Connect cap**. Wait for **Cap connected**.
4. Click **Copy phone pairing link**, send it to yourself, and open it in Safari. You can also use the full **Phone** link printed in the terminal. It includes a private pairing key after `#key=`.
5. Tap **Test connection**. Success means a request traveled from the phone through the computer to the Due, and its reply came back.
6. Choose an animation. The page displays confirmation only when the Due acknowledges the command.

Use the computer’s Wi-Fi IP address from the **Phone** link. `localhost` or `127.0.0.1` on the iPhone refers to the phone itself.

## Controls

- **Scene buttons:** switch immediately and repeat that scene until you choose something else.
- **Demo:** all scenes in order, 20 seconds each.
- **Ceremony:** shuffled without repeats until every scene has played; 3 minutes each, except the 4-minute loading scene.
- **Turn LEDs off:** stops playback and clears the LEDs; USB control remains active.
- **Disconnect USB:** releases the computer’s serial port; it does not turn the cap off. The cap continues its current playback mode. Reconnecting can reset the board depending on the USB port/driver, returning it to Demo.

There is one shared cap state. Selections from the phone and computer control the same device. A heartbeat checks the Due roughly every two seconds. Unplugging or losing its replies changes the connection status. There is no automatic retry of a scene command whose acknowledgment is missing.

## If something does not connect

| Symptom | What to check |
| --- | --- |
| No USB ports listed | Use a data cable, reconnect the Due, refresh the list, and verify it appears in Arduino IDE. |
| USB port cannot open | Close Serial Monitor/Plotter and any other app using the port. Select the correct port. On Linux, check your user’s serial-device permissions. |
| USB opens but the cap never replies | Upload the included updated firmware. Check Programming vs Native USB and `CAP_SERIAL`. The previous sketch does not implement this command protocol. |
| Computer page works, iPhone page does not | Use the Phone IP link, not localhost. Allow Python through Windows Firewall for your private network if prompted. Guest/campus Wi-Fi may isolate devices. VPNs or multiple network adapters can make the printed IP unsuitable; use the computer’s actual Wi-Fi IPv4 address. |
| Pairing fails after restart | Open the newly printed full link. Every bridge restart generates a fresh pairing key. |
| Status says connected but selection fails | Read the error, check the cap, then use Test connection. A timeout is not displayed as a successful selection. |

Keep the computer awake and the bridge window running. This is a local development server for your trusted Wi-Fi, with a per-session pairing key. Do not forward its port to the public internet.

## Moving this project to GitHub

Upload this folder as a repository. `.gitignore` excludes the virtual environment and Python caches. No credentials or fixed pairing keys are included; they are generated at startup.

**GitHub hosts the source, while the computer still runs `bridge.py`.** GitHub Pages alone cannot run the Python bridge or reach your computer’s USB port. Serve the included `web/` files through this local bridge for the first test. A GitHub Pages front end with a remote relay/tunnel would be a separate extension; this version intentionally accepts commands from its own local page only.

## Files

- `bridge.py`: HTTP server, USB reader, request/acknowledgment tracking, heartbeat and pairing checks.
- `web/`: phone interface; no frameworks, build step, remote fonts or CDN dependencies.
- `firmware/gradCap2026/gradCap2026.ino`: full updated sketch; open this in Arduino IDE.
- `requirements.txt`: pinned pySerial dependency.
- `tests/`: host firmware simulation and Python integration checks.

## Development checks

The Python checks do not need pySerial or hardware; they use an injected simulated USB device:

```sh
python3 -m unittest discover -s tests -p 'test_*.py' -v
node --check web/app.js
```

Firmware command handling and animation interruption can be exercised with a host C++ compiler:

```sh
g++ -std=c++11 -O1 -g -Wall -Wextra -fsanitize=address,undefined -fno-omit-frame-pointer -I tests tests/firmware_control.cpp -o /tmp/cap-firmware-test
ASAN_OPTIONS=detect_leaks=0 /tmp/cap-firmware-test
```

The host FastLED/serial stand-ins test logic and bounds, not Arduino USB drivers or LED timing. An optional `tests/browser_flow.cjs` checks the interface with Playwright against a test server and simulated USB port (`TEST_USB`); it requires a separately installed Playwright browser/runtime. It is not a production launch command.

**Validation for this release:** Python protocol/HTTP tests and the host firmware interruption tests passed. JavaScript syntax was checked. A real Arduino Due build/upload and physical iPhone→USB connection have not been performed here. Automated Chromium rendering was blocked by this workspace’s browser process restrictions.

## USB protocol (v1)

ASCII, newline-terminated, 115200 baud. Request IDs are positive decimal numbers up to nine digits. Use the IDs in `/api/animations` (0–23), not display order.

```text
PING 1
STATE DEMO 0
ACK 1 PONG CAP/1

PLAY 2 19
STATE MANUAL 19
ACK 2 PLAY

MODE 3 CEREMONY
STATE CEREMONY -1
ACK 3 MODE

OFF 4
STATE OFF -1
ACK 4 OFF
```

`STATUS requestId` also returns current state and `ACK requestId STATUS CAP/1`. `PLAY`, `MODE` and `OFF` are acknowledged after the main loop applies them, while `PING` tests the round trip. A `STATE` line is also emitted when a scene starts. Invalid commands return `ERR requestId reason`.

The firmware reads serial during every frame/pause and exits the active scene for a queued selection. One pending selection is accepted at a time; excessive/malformed input is bounded and rejected.
