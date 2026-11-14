# Graduation Cap · Phone Controller

A local Python-to-USB bridge for Jason’s 24×24 Arduino Due cap. It serves a phone interface for 25 automatic animations, touch drawing, pond ripples, five playable games, tilt-controlled sand, a multi-touch plasma globe, camera rasterization and shared two-player tug of war.

**Phone → bridge on the computer → USB → Due.** Keep the computer awake and the bridge running.

## Updating to this release

Upload `firmware/gradCap2026/gradCap2026.ino` again, replace the bridge folder, restart the bridge, and open its new full Phone link. This release uses **CAP/7** and requires the included firmware. Older firmware is rejected with an update message.

Manual Pac-Man control has been removed. The automatic Pac-Man animation remains in both playlists. All display and input coordinates now follow the frame already used by Platformer, Underwater and drawing. Extra turns in touch input and camera frames were removed. Drawing’s pixel output is unchanged.

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

## One orientation for the whole cap

Platformer, Underwater and the drawing canvas define the reference: x=0 is reference-left, y=0 is reference-top, and y=23 is reference-bottom. Every animation and interaction uses the same final hardware mapping. Plasma contacts, pond touches, video pixels and gravity vectors are supplied directly in this frame, without an extra 180-degree turn. Breakout’s older inverted row coordinates are normalized before display so its paddle stays at the reference bottom. Game controls use this common frame too. The drawing output you already tested is preserved.

## Sand

Click Start / reset sand. The Due simulates 140 grains with collisions and piling against the matrix edges. Click Enable tilt on the HTTPS phone page and allow motion access. Tilt changes the gravity direction; Calibrate level sets your current angle as neutral. Invert tilt flips both axes if your phone/viewing position needs it. Portrait and landscape orientation are accounted for.

Manual gravity sliders work without sensor permission. Only the page that explicitly enables tilt or moves a gravity slider owns gravity control. Other open pages are observers and do not send a default force. Enabling tilt or moving a slider on another page transfers control; the previous owner stops sending when its token is rejected. If the phone stops sending gravity for two seconds, the grains settle toward screen-down. Reset sand restarts the grains. Tilt now prefers the iPhone’s `devicemotion` gravity readings and falls back to `deviceorientation` when needed. Both permission requests are initiated during your Enable tilt tap, before any network request. Open the HTTPS link directly in Safari, allow Motion & Orientation, then tip the phone. Flat, neutral input can produce zero in-plane gravity; calibrate only when you want the current holding angle to be neutral.

The **Sensors / cap gravity** line distinguishes real sensor readings from permission alone and shows the last acknowledged gravity vector. If permission is allowed but no reading arrives for five seconds, the page says so. A successful vector acknowledgment verifies the phone → bridge → Due path. The Due also reports its actual applied vector, shown separately in the indicator. If Auto receives unhelpful readings on your phone, select Gravity sensor or Orientation angles using Tilt source. Use Invert tilt if your viewing orientation needs both axes reversed. Manual slider directions are refreshed continuously rather than expiring after two seconds. No physical sensor is added to the cap.

## Plasma globe

Start plasma, then hold up to five fingers on its touch surface. The Due draws branching tendrils from the center to your contact positions and links adjacent contacts together. Releasing fingers removes those targets. With no fingers, ambient tendrils rotate around the globe. Lost touch feeds expire after 1.5 seconds so contacts do not remain stuck.

## Live video rasterization

Open the HTTPS link, click Start camera and allow the camera. The app uses the rear camera where available, crops a central square, downsamples it to 24×24 RGB and sends those pixels to the cap. Mirror is optional. A tiny raster preview sits alongside the local camera preview.

Default target is **2 frames per second**; the selector allows 1–3. Actual rate depends on USB transfer and network latency. This is a small lo-fi live raster, not full-rate video. Only one frame is sent at a time, so old frames do not build up. Only one phone owns the camera stream at a time.

The raster preview includes the active filters. Choose **Natural**, **Low light**, **Bright / high contrast**, **Grayscale**, **Silhouette**, or **Edges**. Auto exposure estimates useful dark/light bounds per frame. Brightness, contrast and gamma sliders let you tune difficult lighting; lower gamma lifts shadows. Presets reset those sliders to useful defaults, and all filtering runs on the phone before the RGB raster is sent.

Stop camera releases the camera and turns that stream off. Selecting another cap mode or hiding the page also stops the local camera. The bridge turns stale VIDEO mode off after six seconds without frames. No microphone is requested and no video is recorded.

## Two-player tug of war

1. Two visitors open the **same full Phone link** in separate phones/browsers.
2. Click Open tug of war. One visitor joins red; the other joins blue. Others can spectate.
3. Either seated player clicks Start / rematch. A shared three-second countdown begins.
4. Tap the large button rapidly. Gain a 40-tap advantage to win early, or lead when the 20-second round ends. Equal scores finish in a draw.

The bridge owns the clock, score and seats. One browser identity can occupy only one seat, occupied seats cannot be claimed by another visitor, and tap batches use monotonically increasing sequence IDs to reject replay. The server caps accepted input at roughly 12 taps/second per player with a small burst allowance. Both visitors poll the same game state; the cap displays its rope and winner’s color.

Leave seat frees your spot. A player who disappears for more than 15 seconds during a round forfeits; inactive seats expire after 30 seconds outside an active round. Changing the cap away from tug of war cancels an unfinished round. Sessions reset if the bridge restarts.

## Touch pond and drawing

- **Start touch pond:** tap/drag to create up to eight overlapping blue-green rings. The preview and actual LED origin both use the drawing/platformer reference frame. The ordinary Pond Ripples animation in the playlists stays automatic.
- **Draw on your cap:** draw on the 24×24 canvas, choose a color, or erase. Click Show drawing to enter drawing mode. With Live checked, new strokes update the cap. Drawings save locally in that browser when a stroke finishes. If a transfer fails, Show drawing resends the full canvas.

### Turn a drawing into tilt particles

Draw colored pixels with some black/empty space, then tap **Turn drawing into tilt particles**. The phone requests sensor permission during that tap, sends the latest full drawing, and converts each colored pixel into a moving grain on the Due. Colors are retained, particles collide/pile, and black or erased pixels are empty. A completely filled canvas has no room to flow.

The same tilt, calibration, inversion and manual gravity controls work for sand and drawing particles. If motion permission is unavailable, the drawing can still become particles using the manual sliders; the page explains how to enable tilt. **Show drawing on cap** restores the original saved sketch. **Clear** exits particle mode and clears the drawing.

Preview feedback is immediate. A confirmation message means the Due acknowledged the request; its next frame displays the result.

## Playable games and playlists

Choose games under Your turn for manual control. The corresponding animation buttons still run their automatic versions.

- Pong: slider controls the red paddle against the blue computer paddle in the common cap frame.
- Breakout: slider controls the bottom paddle in the common cap frame.
- Snake: arrows/swipes use the common cap frame.
- Platformer: automatic runner with a manual Jump button.
- Space Invaders: ship slider and Fire button; automatic aiming/dodging/firing are disabled in manual mode.

Pac-Man is automatic only. Spiral and Fractal are separate entries in the 25-animation playlist. Demo plays each for 20 seconds. Ceremony shuffles without repeats until every animation has played, for three minutes each except the four-minute loading scene. LEDs off stops the active mode while keeping USB control available.

## Connection recovery

The connection section keeps Bridge link or pairing key, Update and Retry available after errors. Paste the fresh full link after restarting the bridge. A bare key updates the current bridge; a full HTTP or HTTPS link navigates to that bridge.

| Symptom | Check |
| --- | --- |
| No serial ports | Data cable, USB reconnection, correct port in Arduino IDE, refresh port list. |
| Port cannot open | Close Serial Monitor/Plotter and other apps using it. Check serial-device permissions on Linux. |
| Cap does not acknowledge | Upload the included CAP/7 firmware and match Programming vs Native USB. |
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

## Protocol CAP/7

ASCII, newline-terminated at 115200 baud. Request IDs are positive decimal numbers up to nine digits. `ACK id message` confirms acceptance; `ERR id reason` rejects it. `STATE mode animationId` precedes status/transition acknowledgments. `PING id` replies `PONG CAP/7`; STATUS also reports current state.

- PLAY id animationId; MODE id DEMO or CEREMONY; OFF id.
- GAME id gameId (3, 6, 13, 14, 16); INPUT id P0..P23 / UP / DOWN / LEFT / RIGHT / JUMP / FIRE, as applicable.
- DRAW id; PIX id x,y,rrggbb; ROW id row,144HexCharacters; SHOW id; CLEAR id. VIDEO mode also accepts pixel/row/show commands. The bridge sends 24 rows and SHOW per video frame.
- TOUCH id; WAVE id x,y. WAVE uses the same logical frame as drawing, with no extra turn.
- SAND id; GRAV id x,y (each -100..100). GRAV also controls drawing-particle mode.
- MELT id converts the staged drawing to PARTICLES mode, preserving occupied pixels’ colors. HTTP `/api/draw/particles` stages the full drawing before MELT.
- PLASM id; BOLTS id x,y;x,y (up to five points), or BOLTS id - to release all touches.
- VIDEO id selects frame-driven video mode. HTTP owner checks apply to camera requests.
- TUG id; ROPE id score,phase (-40..40; 0 waiting, 1 countdown, 2 playing, 3 red win, 4 blue win, 5 draw). The bridge computes the score and round state.

Sand, plasma, video and tug are interactive modes, not extra automatic playlist entries. There remain 25 animations.

### Gravity control ownership and diagnosis

`POST /api/tilt/claim` with a browser identity and `kind` (`sensor` or `manual`) transfers gravity control to that page and returns an owner token. Each `/api/sand/gravity` call includes that token. An old token, missing token or expired lease is rejected; merely viewing a page never changes gravity. Active control renews its eight-second lease. The firmware still falls back to reference-down if updates stop for two seconds.

The firmware emits `GRAVITY x y` before each gravity acknowledgment and in particle-mode status. The bridge exposes `device_gravity` and controller kind in status, letting you distinguish permission granted, sensor samples arriving, commands acknowledged, and force actually applied. The sand simulation now weights both axes, so a small sideways force can move a pile even when downward force is larger.


### iPhone raw sensor diagnosis

This update changes the controller only; no new firmware upload is required if CAP/7 is already installed. Replace the bridge folder, restart the secure launcher, and open its new HTTPS Phone link directly in Safari.

Open **Raw iPhone readings** and tap **Test phone sensors**. Motion and orientation event counts and raw values remain visible even without a connected cap. Permission being granted is shown separately from actual readings. The **standalone sensor test** link runs the same capture without the controller or serial connection; it also lets you request Motion only or Orientation only. If values never arrive, tap **Copy report** and send that report for diagnosis. It contains no pairing key.

Sensor listeners attach before permission is requested and remain active across animation changes. Valid x/y gravity readings are accepted even if z is absent. Raw null readings are counted and shown rather than silently discarded. To move sand or drawn particles, start that mode and tap Enable tilt; the raw test alone does not take control of the cap.


If the secure phone page reports an unrecognized address, close the old bridge window, restart `start-secure-windows.bat`, and use the newly printed complete SECURE PHONE link. Quick-tunnel links change after restarting. This version pins cloudflared's local Host header and accepts the registered HTTPS address with or without its default :443 port. Pairing keys remain required for commands.


### Sand tilt control

Start / reset sand now requests phone access and enables tilt forwarding in one tap. The default source is Orientation angles, using beta/gamma directly. The separate raw sensor tests only inspect the phone and do not control the cap. If you move a manual slider, it takes over; tap Enable tilt / take control to return to phone input. The diagnostic line shows calculated x/y, the acknowledged command, and the Due's reported gravity. Source changes while tilt is active reconnect that source immediately.


Tilt NaN fix: renamed the orientation event handler so it cannot overwrite the browser's legacy window.orientation angle. Screen rotation now accepts only finite numeric angles and preserves portrait angle zero. This fixes calculated NaN forces that the bridge correctly rejected as out of range. Controller update only; no firmware upload required.
