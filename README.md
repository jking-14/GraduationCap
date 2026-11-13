# Graduation Cap · Phone Controller

A local Python-to-USB bridge for Jason’s 24×24 Arduino Due cap. It serves a phone interface for 25 automatic animations, touch drawing, pond ripples, five playable games, tilt-controlled sand, a multi-touch plasma globe, camera rasterization and shared two-player tug of war.

**Phone → bridge on the computer → USB → Due.** Keep the computer awake and the bridge running.

## Updating to this release

Upload `firmware/gradCap2026/gradCap2026.ino` again, replace the bridge folder, restart the bridge, and open its new full Phone link. This release uses **CAP/5** and requires the included firmware. Older firmware is rejected with an update message.

Manual Pac-Man control has been removed. The automatic Pac-Man animation remains in both playlists. The pond’s input/output relationship has been rotated 180° from the previous release. Pong and Snake keep their most recently requested control inversions.

## 1. Upload the firmware

1. Open `firmware/gradCap2026/gradCap2026.ino` in Arduino IDE.
2. Select **Arduino SAM Boards → Arduino Due (Programming Port)** and install **FastLED 3.7.5**.
3. Connect the Due’s **Programming USB connector** with a data cable, select its serial port, and upload.
4. Close Arduino Serial Monitor and Serial Plotter before starting the bridge. Stop the bridge or use Disconnect USB before uploading again.

The existing LED pins, brightness and current limit are preserved. Without a computer the cap starts in Demo mode. For the Native USB connector, change `#define CAP_SERIAL Serial` to `#define CAP_SERIAL SerialUSB` and use the corresponding board/port in Arduino IDE. Programming USB is the default to try first.

## 2. Start the bridge

Install Python 3.10 or newer from python.org. The first run needs internet to install the pinned pySerial dependency.

### Local Wi-Fi controls

On Windows, double-click **start-windows.bat**. On macOS/Linux, run:

```sh
sh start-macos-linux.sh
```

The bridge prints a Computer link and Phone links. Open the Computer link, choose the Due’s USB port and click Connect cap. On your iPhone, open the full Phone link on the same Wi-Fi. A link includes a private session key after `#key=`. Use the computer’s Wi-Fi address, not `localhost` or `127.0.0.1`, on the phone.

### Secure iPhone link for tilt and camera

Camera access and iPhone motion permission require a secure HTTPS page. The local HTTP page still supports drawing, games, plasma, ripples and manual sand gravity.

1. Install **cloudflared** using [Cloudflare’s official installation instructions](https://developers.cloudflare.com/tunnel/downloads/).
2. Windows: double-click **start-secure-windows.bat**. macOS/Linux: run `sh start-macos-linux.sh --tunnel`.
3. Wait for **SECURE PHONE: https://…trycloudflare.com/#key=…** in the terminal. Open that complete link in Safari.
4. Connect the Due from this page or from the local computer page. Allow Camera or Motion & Orientation when you press their buttons.

The optional tunnel exposes this running bridge through a temporary HTTPS address. Anyone you give the full pairing link can control the cap. HTTP commands remain protected by the session key and origin checks. Camera raster pixels and control messages traverse the tunnel; the full camera video and microphone audio are not uploaded or recorded by this app. Stopping the bridge stops its tunnel. You need internet for the tunnel; ordinary local controls work on your Wi-Fi without it.

No tunnel is opened unless you explicitly use the secure launcher or `--tunnel`. A missing/failed cloudflared installation leaves the local bridge available and prints an error. A GitHub Pages page alone cannot run this USB bridge or replace the HTTPS tunnel.

### Manual launch

Windows PowerShell:

```powershell
py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe bridge.py --tunnel
```

macOS/Linux:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python bridge.py --tunnel
```

Omit `--tunnel` for local-only operation. Optional arguments: `--port 8766` if the default port is busy, or `--serial COM5` (use your actual serial device) to connect automatically.

## Sand

Click Start / reset sand. The Due simulates 140 grains with collisions and piling against the matrix edges. Click Enable tilt on the HTTPS phone page and allow motion access. Tilt changes the gravity direction; Calibrate level sets your current angle as neutral. Invert tilt flips both axes if your phone/viewing position needs it. Portrait and landscape orientation are accounted for.

Manual gravity sliders work without sensor permission. If the phone stops sending gravity for two seconds, the grains settle toward screen-down. Reset sand restarts the grains. Device orientation uses iPhone sensor-fused tilt data; no physical sensor is added to the cap.

## Plasma globe

Start plasma, then hold up to five fingers on its touch surface. The Due draws branching tendrils from the center to your contact positions and links adjacent contacts together. Releasing fingers removes those targets. With no fingers, ambient tendrils rotate around the globe. Lost touch feeds expire after 1.5 seconds so contacts do not remain stuck.

## Live video rasterization

Open the HTTPS link, click Start camera and allow the camera. The app uses the rear camera where available, crops a central square, downsamples it to 24×24 RGB and sends those pixels to the cap. Mirror is optional. A tiny raster preview sits alongside the local camera preview.

Default target is **2 frames per second**; the selector allows 1–3. Actual rate depends on USB transfer and network latency. This is a small lo-fi live raster, not full-rate video. Only one frame is sent at a time, so old frames do not build up. Only one phone owns the camera stream at a time.

Stop camera releases the camera and turns that stream off. Selecting another cap mode or hiding the page also stops the local camera. The bridge turns stale VIDEO mode off after six seconds without frames. No microphone is requested and no video is recorded.

## Two-player tug of war

1. Two visitors open the **same full Phone link** in separate phones/browsers.
2. Click Open tug of war. One visitor joins red; the other joins blue. Others can spectate.
3. Either seated player clicks Start / rematch. A shared three-second countdown begins.
4. Tap the large button rapidly. Gain a 40-tap advantage to win early, or lead when the 20-second round ends. Equal scores finish in a draw.

The bridge owns the clock, score and seats. One browser identity can occupy only one seat, occupied seats cannot be claimed by another visitor, and tap batches use monotonically increasing sequence IDs to reject replay. The server caps accepted input at roughly 12 taps/second per player with a small burst allowance. Both visitors poll the same game state; the cap displays its rope and winner’s color.

Leave seat frees your spot. A player who disappears for more than 15 seconds during a round forfeits; inactive seats expire after 30 seconds outside an active round. Changing the cap away from tug of war cancels an unfinished round. Sessions reset if the bridge restarts.

## Touch pond and drawing

- **Start touch pond:** tap/drag to create up to eight overlapping blue-green rings. The cap output and preview are now rotated 180° relative to the touch input, as requested. The ordinary Pond Ripples animation in the playlists stays automatic.
- **Draw on your cap:** draw on the 24×24 canvas, choose a color, or erase. Click Show drawing to enter drawing mode. With Live checked, new strokes update the cap. Drawings save locally in that browser when a stroke finishes. If a transfer fails, Show drawing resends the full canvas.

Preview feedback is immediate. A confirmation message means the Due acknowledged the request; its next frame displays the result.

## Playable games and playlists

Choose games under Your turn for manual control. The corresponding animation buttons still run their automatic versions.

- Pong: slider controls the red paddle against the blue computer paddle; current horizontal inversion preserved.
- Breakout: slider controls the paddle; earlier inversion preserved.
- Snake: arrows/swipes, with the current horizontal and vertical inversions preserved.
- Platformer: automatic runner with a manual Jump button.
- Space Invaders: ship slider and Fire button; automatic aiming/dodging/firing are disabled in manual mode.

Pac-Man is automatic only. Spiral and Fractal are separate entries in the 25-animation playlist. Demo plays each for 20 seconds. Ceremony shuffles without repeats until every animation has played, for three minutes each except the four-minute loading scene. LEDs off stops the active mode while keeping USB control available.

## Connection recovery

The connection section keeps Bridge link or pairing key, Update and Retry available after errors. Paste the fresh full link after restarting the bridge. A bare key updates the current bridge; a full HTTP or HTTPS link navigates to that bridge.

| Symptom | Check |
| --- | --- |
| No serial ports | Data cable, USB reconnection, correct port in Arduino IDE, refresh port list. |
| Port cannot open | Close Serial Monitor/Plotter and other apps using it. Check serial-device permissions on Linux. |
| Cap does not acknowledge | Upload the included CAP/5 firmware and match Programming vs Native USB. |
| Phone cannot open local link | Same Wi-Fi, actual Wi-Fi IPv4 address, private-network firewall permission for Python, no guest-network client isolation/VPN conflict. |
| Camera/tilt unavailable | Use SECURE PHONE HTTPS link in Safari; allow the website’s camera/motion permission. Sliders remain available for sand. |
| Secure link never appears | Install cloudflared, check internet, and use the secure launcher or --tunnel. The computer window must stay open. |
| Pattern/JSON error | Open the running bridge’s printed link, not index.html as a local file or a GitHub Pages copy. Update with its fresh full link. |
| Claimed player not yours | Join the other open seat or wait for the inactive seat to expire. Use separate phones/browser identities for two players. |

## GitHub and development

This folder can be uploaded as a repository. `.gitignore` excludes virtual environments and Python caches. Session pairing/player keys are generated at runtime; no fixed credentials are included. The computer still runs bridge.py after you move the source to GitHub.

Useful files: `bridge.py` (HTTP/serial), `experiences.py` (shared game and tunnel), `web/` (no build step), `firmware/gradCap2026/gradCap2026.ino` (full sketch), and `tests/`.

```sh
python3 -m unittest discover -s tests -p 'test_*.py' -v
node --check web/app.js
node --check web/effects.js
node tests/ui_recovery.cjs
g++ -std=c++11 -O1 -g -Wall -Wextra -fsanitize=address,undefined -fno-omit-frame-pointer -I tests tests/firmware_control.cpp -o /tmp/cap-firmware-test
ASAN_OPTIONS=detect_leaks=0 /tmp/cap-firmware-test
```

Checks use simulated USB and host FastLED/serial stand-ins. They cover bridge routing, seats/timing/replay, frame ownership, UI recovery and feature requests, drawing/coordinate bounds, grain conservation, plasma targets, and interruption of all playlist scenes. They do not verify physical USB/LED timing, an Arduino Due build/upload, actual Safari sensor/camera permission, or a real external HTTPS tunnel. Browser rendering is unverified because Chromium startup is blocked in this workspace.

## Protocol CAP/5

ASCII, newline-terminated at 115200 baud. Request IDs are positive decimal numbers up to nine digits. `ACK id message` confirms acceptance; `ERR id reason` rejects it. `STATE mode animationId` precedes status/transition acknowledgments. `PING id` replies `PONG CAP/5`; STATUS also reports current state.

- PLAY id animationId; MODE id DEMO or CEREMONY; OFF id.
- GAME id gameId (3, 6, 13, 14, 16); INPUT id P0..P23 / UP / DOWN / LEFT / RIGHT / JUMP / FIRE, as applicable.
- DRAW id; PIX id x,y,rrggbb; ROW id row,144HexCharacters; SHOW id; CLEAR id. VIDEO mode also accepts pixel/row/show commands. The bridge sends 24 rows and SHOW per video frame.
- TOUCH id; WAVE id x,y. WAVE now uses raw touch coordinates through the scene’s 180-degree turn.
- SAND id; GRAV id x,y (each -100..100).
- PLASM id; BOLTS id x,y;x,y (up to five points), or BOLTS id - to release all touches.
- VIDEO id selects frame-driven video mode. HTTP owner checks apply to camera requests.
- TUG id; ROPE id score,phase (-40..40; 0 waiting, 1 countdown, 2 playing, 3 red win, 4 blue win, 5 draw). The bridge computes the score and round state.

Sand, plasma, video and tug are interactive modes, not extra automatic playlist entries. There remain 25 animations.
