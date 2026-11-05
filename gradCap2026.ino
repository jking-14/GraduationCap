//using FastLED v.3.7.5

#include <FastLED.h>
#include <math.h>
//GREEN, RED, BLUE
#define blue CRGB(0, 0, 255)
#define tronBlue CRGB(226, 10, 255)
#define tronRed CRGB(65, 255, 13)
#define tronYellow CRGB(157, 247, 30)
#define red CRGB(0, 255, 0)
#define green CRGB(255, 0, 0)
#define white CRGB(255, 255, 255)
#define off CRGB(0, 0, 0)
#define pink CRGB(96, 255, 208)
#define brown CRGB(30, 255, 0)
#define yellow CRGB(255, 255, 0)
uint8_t grid[24][24]; // Occupancy / brick IDs; largest ID is 18.

#define pin_left 2
#define pin_mid 3
#define pin_right 4
#define num_leds 576
#define len 24

CRGB leds[num_leds];
// Reverse every scene except Breakout. Set false here if a different turn is desired.
const bool REVERSE_SCENES = true;
bool rotateScene180 = REVERSE_SCENES;
// Match the red/green compensation used in the original color presets.
// Set false if a hardware color test shows ordinary RGB ordering.
const bool SWAP_RED_GREEN = true;
CRGB panelColor(CRGB color) {
  if (SWAP_RED_GREEN) {
    const uint8_t channel = color.r;
    color.r = color.g;
    color.g = channel;
  }
  return color;
}
// Public entry points keep their original names. Speeds are frame delays in ms.
// loadingBar() lasts four minutes in ceremony mode.
// The shuffled playlist gives each scene a timed slot; animations still block.
const uint32_t MAX_GAME_MS = 240000UL;
const uint8_t CAP_BRIGHTNESS = 6;
const uint16_t CAP_CURRENT_MA = 500;

// Playlist settings. Each scene repeats its rounds until its slot expires.
const uint32_t ANIMATION_MS = 180000UL; // Three minutes per scene.
const uint32_t DEMO_MS = 20000UL;      // Twenty seconds per scene, in enum order.
const uint32_t LOADING_MS = 240000UL;   // Four minutes for the loading joke.
const uint8_t PONG_PADDLE_HALF = 4;     // Nine pixels.
const uint8_t BREAKOUT_PADDLE_HALF = 4; // Nine pixels.
const uint8_t PONG_WIN_SCORE = 5;
const uint32_t SCORE_HOLD_MS = 1500UL;

bool animationBudgetActive = false;
uint32_t animationStarted = 0;
uint32_t animationDuration = 0;
bool animationTimeLeft() {
  return !animationBudgetActive || millis() - animationStarted < animationDuration;
}
void scenePause(uint32_t durationMs) {
  const uint32_t started = millis();
  while (millis() - started < durationMs && animationTimeLeft()) delay(10);
}

enum AnimationId : uint8_t {
  ANIM_MATRIX, ANIM_TRON, ANIM_RIPPLE, ANIM_BREAKOUT, ANIM_CUBE,
  ANIM_LOADING, ANIM_PONG, ANIM_DVD,
  ANIM_STARFIELD, ANIM_LAVA, ANIM_WAVES,
  ANIM_TETRIS, ANIM_PACMAN, ANIM_SNAKE, ANIM_INVADERS,
  ANIM_FIREWORKS, ANIM_PLATFORMER, ANIM_LIFE, ANIM_RAIN,
  ANIM_PLANT, ANIM_BEACH, ANIM_MOON_CAMP, ANIM_UNDERWATER, ANIM_CITY, ANIMATION_COUNT
};
enum PlaybackMode : uint8_t { DEMO_MODE, CEREMONY_MODE };
void runMode(PlaybackMode mode);
void tetris(uint32_t durationMs);
void pacman(uint32_t durationMs);
void snake(uint32_t durationMs);
void spaceInvaders(uint32_t durationMs);
void fireworks(uint32_t durationMs);
void platformer(uint32_t durationMs);
void gameOfLife(uint32_t durationMs);
void rain(uint32_t durationMs);
void growingPlant(uint32_t durationMs);
void beachWaves(uint32_t durationMs);
void moonCamp(uint32_t durationMs);
void underwater(uint32_t durationMs);
void nightCity(uint32_t durationMs);
void diagonalScene(CRGB *source);
void naturePixel(int x, int y, CRGB color);
void drawPongBall(int row, int col);
void drawTinyDigit(uint8_t digit, int x0, int y0, CRGB color);
void drawLoadingFrame(uint8_t percent, uint8_t tick);
AnimationId nextAnimation();
void randAnimation();
void playAnimation(AnimationId choice, uint32_t durationMs);
void dvdAnimation(int speed);
void starfield(uint32_t durationMs);
void lavaLamp(uint32_t durationMs);
void sineWaves(uint32_t durationMs);
void pong(int speed);
void drawScoreDigit(uint8_t score, int scale, CRGB color);
void showPointScore(uint8_t score, CRGB color);
void drawPongPaddle(int center, int col, CRGB color);
void fadeScene();

// A shuffle bag covers every animation once, with no repeat at bag boundaries.
AnimationId nextAnimation() {
  static uint8_t bag[ANIMATION_COUNT];
  static uint8_t next = ANIMATION_COUNT;
  static uint8_t previous = ANIMATION_COUNT;
  if (next == ANIMATION_COUNT) {
    for (uint8_t i = 0; i < ANIMATION_COUNT; ++i) bag[i] = i;
    for (int i = ANIMATION_COUNT - 1; i > 0; --i) {
      const int j = random(i + 1);
      const uint8_t temp = bag[i]; bag[i] = bag[j]; bag[j] = temp;
    }
    if (bag[0] == previous) {
      const uint8_t temp = bag[0]; bag[0] = bag[1]; bag[1] = temp;
    }
    next = 0;
  }
  previous = bag[next++];
  return static_cast<AnimationId>(previous);
}


int id(int rowId, int colId);
bool outOfBounds(int row, int col);
void clearMatrix();
void resetGrid();
void showMatrix();
void loadingBar(uint32_t durationMs = 240000UL);
void matrixAnimation(int speed);
void tron(int speed);
void ripple(int speed);
void breakOut(int speed);
void drawRotatingCube(float xDegree, float yDegree, float zDegree);
void updateDvd(int row, int col, int length, int width, CRGB color);
CRGB randColor();
CRGB randColorPreset();
void setPixel(int x, int y);
void setPixel(int x, int y, int brightness);
void setPixel(int x, int y, CHSV color);
int hitBrick(int ballRow, int ballCol);
int hitBrickSide(int ballRow, int ballCol);
void clearBrick(int brickID);
bool hitPlayer(int ballRow, int ballCol, int playerPos);
int updatePlayerPos(int ballRow, int playerPos);
bool hitWall(int ballRow);
bool hitGoal(int ballCol);
bool hitPaddle(int ballRow, int ballCol, int paddle1Row, int paddle2Row);
int updatePaddlePos(int ballRow, int paddlePos);

uint8_t gridAt(int row, int col) {
  return outOfBounds(row, col) ? 0 : grid[row][col];
}

void setup() {
  Serial.begin(9600);
  analogReadResolution(12);
  // Leave A0 unconnected if using it as a source of seed variation.
  randomSeed(analogRead(A0) ^ micros());
  FastLED.addLeds<WS2812B, pin_left, RGB>(leds, 192);
  FastLED.addLeds<WS2812B, pin_mid, RGB>(leds, 192, 192);
  FastLED.addLeds<WS2812B, pin_right, RGB>(leds, 384, 192);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, CAP_CURRENT_MA);
  FastLED.setBrightness(CAP_BRIGHTNESS);
  FastLED.clear();
  FastLED.show();
}

void loop() {
  runMode(DEMO_MODE); // Change to CEREMONY_MODE for the shuffled, long playlist.
  // To inspect one scene repeatedly instead, replace the line above with:
  // playAnimation(ANIM_TETRIS, DEMO_MS);
}

void runMode(PlaybackMode mode) {
  if (mode == CEREMONY_MODE) {
    randAnimation();
  } else {
    static uint8_t next = 0;
    playAnimation(static_cast<AnimationId>(next), DEMO_MS);
    next = (next + 1) % ANIMATION_COUNT;
  }
}

void rotateCube(float x, float y, float z, float step) {

  if (step < 1.0f) return;
  float xDegree = x / step;
  float yDegree = y / step;
  float zDegree = z / step;
  for (int i = 0; i < (int)step && animationTimeLeft(); i++) {
    drawRotatingCube(xDegree, yDegree, zDegree);
    delay(30);
  }
}



void randAnimation() {
  const AnimationId choice = nextAnimation();
  playAnimation(choice, choice == ANIM_LOADING ? LOADING_MS : ANIMATION_MS);
}

void playAnimation(AnimationId choice, uint32_t durationMs) {
  rotateScene180 = REVERSE_SCENES && choice != ANIM_BREAKOUT;
  clearMatrix();
  resetGrid();
  animationStarted = millis();
  animationDuration = durationMs;
  animationBudgetActive = true;
  while (animationTimeLeft()) {
    switch (choice) {
      case ANIM_MATRIX: matrixAnimation(100); break;
      case ANIM_TRON: tron(70); break;
      case ANIM_RIPPLE: ripple(75); break;
      case ANIM_BREAKOUT: breakOut(70); break;
      case ANIM_CUBE: drawRotatingCube(0.018f, 0.026f, 0.009f); delay(30); break;
      case ANIM_LOADING: loadingBar(durationMs); break;
      case ANIM_PONG: pong(85); break;
      case ANIM_DVD: dvdAnimation(120); break;
      case ANIM_STARFIELD: starfield(durationMs); break;
      case ANIM_LAVA: lavaLamp(durationMs); break;
      case ANIM_WAVES: sineWaves(durationMs); break;
      case ANIM_TETRIS: tetris(durationMs); break;
      case ANIM_PACMAN: pacman(durationMs); break;
      case ANIM_SNAKE: snake(durationMs); break;
      case ANIM_INVADERS: spaceInvaders(durationMs); break;
      case ANIM_FIREWORKS: fireworks(durationMs); break;
      case ANIM_PLATFORMER: platformer(durationMs); break;
      case ANIM_LIFE: gameOfLife(durationMs); break;
      case ANIM_RAIN: rain(durationMs); break;
      case ANIM_PLANT: growingPlant(durationMs); break;
      case ANIM_BEACH: beachWaves(durationMs); break;
      case ANIM_MOON_CAMP: moonCamp(durationMs); break;
      case ANIM_UNDERWATER: underwater(durationMs); break;
      case ANIM_CITY: nightCity(durationMs); break;
      default: animationBudgetActive = false; return;
    }
  }
  animationBudgetActive = false;
  fadeScene();
}

void loadingBar(uint32_t durationMs) {
  const uint32_t start = millis();
  const uint32_t earlyMs = durationMs / 4;
  int displayed = -1;
  uint32_t lastFrame = start - 150UL;
  uint8_t tick = 0;
  while (true) {
    const uint32_t elapsed = millis() - start;
    const bool finished = elapsed >= durationMs || !animationTimeLeft();
    // The joke stays: approach 90% quickly, then crawl to 100%.
    const uint8_t percent = finished ? 100 : (earlyMs && elapsed < earlyMs ?
      (uint64_t(elapsed) * 90) / earlyMs :
      90 + (uint64_t(elapsed - earlyMs) * 10) / (durationMs - earlyMs));
    if (percent != displayed || millis() - lastFrame >= 150UL) {
      drawLoadingFrame(percent, tick++);
      FastLED.show();
      lastFrame = millis();
      displayed = percent;
    }
    if (finished) break;
    delay(15);
  }
}

void drawLoadingFrame(uint8_t percent, uint8_t tick) {
  clearMatrix();
  if (percent > 100) percent = 100;
  const CRGB border = panelColor(CRGB(16, 35, 50));
  const CRGB fill = panelColor(CRGB(25, 170, 220));
  const CRGB label = panelColor(CRGB(100, 155, 175));
  // Compact, centered 20x4 outline with an 18x2 interior.
  for (int x = 2; x <= 21; ++x) {
    leds[id(x, 10)] = border;
    leds[id(x, 13)] = border;
  }
  leds[id(2, 11)] = border; leds[id(2, 12)] = border;
  leds[id(21, 11)] = border; leds[id(21, 12)] = border;
  const int filled = percent * 18 / 100;
  for (int x = 0; x < filled; ++x) {
    leds[id(3 + x, 11)] = fill;
    leds[id(3 + x, 12)] = fill;
  }
  // A centered percentage beneath the bar, using legible 3x5 digits.
  const int digits = percent == 100 ? 3 : (percent >= 10 ? 2 : 1);
  const int width = digits * 4 - 1 + 1 + 5;
  const int x0 = (len - width) / 2;
  if (digits == 3) drawTinyDigit(1, x0, 16, label);
  if (digits >= 2) drawTinyDigit((percent / 10) % 10, x0 + (digits == 3 ? 4 : 0), 16, label);
  drawTinyDigit(percent % 10, x0 + (digits - 1) * 4, 16, label);
  const int px = x0 + digits * 4;
  const uint8_t pct[5] = {25,26,4,11,19};
  for (int y = 0; y < 5; ++y) for (int x = 0; x < 5; ++x) {
    if (pct[y] & (1 << (4 - x))) leds[id(px + x, 16 + y)] = label;
  }
  // Small rotating activity ring above it. At completion it becomes a check.
  if (percent == 100) {
    leds[id(10, 6)] = fill; leds[id(11, 7)] = fill;
    leds[id(12, 6)] = fill; leds[id(13, 5)] = fill;
  } else {
    const int8_t dx[8] = {0,1,2,2,2,1,0,0};
    const int8_t dy[8] = {0,0,0,1,2,2,2,1};
    for (int i = 0; i < 8; ++i) {
      CRGB c = fill;
      c.nscale8_video(i == (tick % 8) ? 230 : 30);
      leds[id(10 + dx[i], 5 + dy[i])] = c;
    }
  }
}

void randUpdateGrid() {
  for (int i = 0; i < 24; i++) {
    for (int j = 0; j < 24; j++) {
      if (grid[i][j] == 1) {
        leds[id(i, j)] = randColor();
      }
    }
  }
}

void setPixel(int x, int y) {
  if (!outOfBounds(x, y)) leds[id(x, y)] = blue;
}

void setPixel(int x, int y, int brightness) {
  //leds[id(x, y)] = depthColor(x, y, brightness);
  if (!outOfBounds(x, y)) leds[id(x, y)] = CRGB(0, 0, constrain(brightness, 0, 255));
}

void setPixel(int x, int y, CHSV color) {
  if (!outOfBounds(x, y)) leds[id(x, y)] = panelColor(CRGB(color));
}

CRGB depthColor(int x, int y, int z) {
  return CRGB(constrain(z - x - y, 0, 255), 60, constrain(z - y, 0, 255));
}

void showMatrix() {
  delay(10);
  FastLED.show();
}

void clearMatrix() {
  FastLED.clear();
}

struct Point3D {
  int32_t x;
  int32_t y;
  int32_t z;
};

struct ProjectedPoint {
  int16_t x;
  int16_t y;
  int16_t z;
};

ProjectedPoint projectPoint(Point3D p);
void drawDepthLine(ProjectedPoint p1, ProjectedPoint p2);
uint8_t depthBrightness(int32_t z);
CHSV getRainbowColor(Point3D p);

const int32_t SCALE = 1000;
const int32_t CUBE_SIZE = 6000; // Half-side in fixed-point units.
const int32_t DEPTH_EXTENT = 10393; // ceil(sqrt(3) * CUBE_SIZE) for all rotations.

CHSV getRainbowColor(Point3D p) {
  // Here x/y are projected pixel coordinates; z remains fixed-point depth.
  const uint8_t hue = map(constrain(p.x + p.y, 0L, 46L), 0, 46, 0, 255);
  return CHSV(hue, 255, 255);
}

uint8_t depthBrightness(int32_t z) {
  // Clamp before narrowing to avoid wrapping negative / >255 values.
  const long brightness = map(z, -DEPTH_EXTENT, DEPTH_EXTENT, 255, 70);
  return constrain(brightness, 70L, 255L);
}

Point3D cube[8] = {
  { -CUBE_SIZE, -CUBE_SIZE, -CUBE_SIZE },
  { CUBE_SIZE, -CUBE_SIZE, -CUBE_SIZE },
  { CUBE_SIZE, CUBE_SIZE, -CUBE_SIZE },
  { -CUBE_SIZE, CUBE_SIZE, -CUBE_SIZE },

  { -CUBE_SIZE, -CUBE_SIZE, CUBE_SIZE },
  { CUBE_SIZE, -CUBE_SIZE, CUBE_SIZE },
  { CUBE_SIZE, CUBE_SIZE, CUBE_SIZE },
  { -CUBE_SIZE, CUBE_SIZE, CUBE_SIZE }
};

const uint8_t edges[12][2] = {
  { 0, 1 }, { 1, 2 }, { 2, 3 }, { 3, 0 }, { 4, 5 }, { 5, 6 }, { 6, 7 }, { 7, 4 }, { 0, 4 }, { 1, 5 }, { 2, 6 }, { 3, 7 }
};

void drawDepthLine(ProjectedPoint p1, ProjectedPoint p2) {
  int x0 = p1.x;
  int y0 = p1.y;
  int x1 = p2.x;
  int y1 = p2.y;

  int dx = abs(x1 - x0);
  int sx = x0 < x1 ? 1 : -1;

  int dy = -abs(y1 - y0);
  int sy = y0 < y1 ? 1 : -1;

  int err = dx + dy;

  int steps = dx > -dy ? dx : -dy;

  int step = 0;

  while (true) {
    // Interpolate Z along the line
    int32_t z;

    if (steps == 0) {
      z = p1.z;
    } else {
      z = p1.z + ((p2.z - p1.z) * step) / steps;
    }

    uint8_t brightness =
      depthBrightness(z);

    if (x0 >= 0 && x0 < 24 && y0 >= 0 && y0 < 24) {
      Point3D point = { x0, y0, z };
      CHSV color = getRainbowColor(point);
      CRGB rgb = color;
      rgb.nscale8_video(brightness);
      leds[id(x0, y0)] |= panelColor(rgb); // Brighter channel wins at crossings.
    }

    if (x0 == x1 && y0 == y1)
      break;

    int e2 = 2 * err;

    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }

    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }

    step++;
  }
}

ProjectedPoint projectPoint(Point3D p) {
  ProjectedPoint result;

  const int32_t cameraDistance = 24000;

  int32_t factor =
    (cameraDistance * SCALE) / (cameraDistance + p.z);

  result.x =
    ((p.x * factor) / SCALE) / SCALE + 12;

  result.y =
    ((p.y * factor) / SCALE) / SCALE + 12;

  result.z = p.z;

  return result;
}

void drawRotatingCube(float xDegree, float yDegree, float zDegree) {
  static float angleX = 0;
  static float angleY = 0;
  static float angleZ = 0;

  Point3D rotated[8];
  ProjectedPoint projected[8];

  float sx = sinf(angleX);
  float cx = cosf(angleX);

  float sy = sinf(angleY);
  float cy = cosf(angleY);

  float sz = sinf(angleZ);
  float cz = cosf(angleZ);

  clearMatrix();

  for (int i = 0; i < 8; i++) {
    float x = cube[i].x;
    float y = cube[i].y;
    float z = cube[i].z;

    // Z rotation
    float tx = x * cz - y * sz;
    float ty = x * sz + y * cz;

    x = tx;
    y = ty;

    // Y rotation
    tx = x * cy + z * sy;

    float tz =
      -x * sy + z * cy;

    x = tx;
    z = tz;

    // X rotation
    ty = y * cx - z * sx;

    tz = y * sx + z * cx;

    y = ty;
    z = tz;

    rotated[i].x = (int32_t)x;
    rotated[i].y = (int32_t)y;
    rotated[i].z = (int32_t)z;

    projected[i] =
      projectPoint(rotated[i]);
  }

  for (int e = 0; e < 12; e++) {
    ProjectedPoint p1 =
      projected[edges[e][0]];

    ProjectedPoint p2 =
      projected[edges[e][1]];

    drawDepthLine(
      p1,
      p2);
  }

  showMatrix();

  angleX += xDegree;
  angleY += yDegree;
  angleZ += zDegree;
  // Bound angles for long runtimes; arguments are radians per frame.
  angleX = fmodf(angleX, 6.283185307f);
  angleY = fmodf(angleY, 6.283185307f);
  angleZ = fmodf(angleZ, 6.283185307f);
}

void dvdAnimation(int speed) {
  const int logoWidth = 11, logoHeight = 8;
  int row = random(len - logoWidth + 1), col = random(len - logoHeight + 1);
  int dr = 1, dc = 1;
  CRGB color = randColorPreset();
  for (int frame = 0; frame < 500 && animationTimeLeft(); ++frame) {
    clearMatrix();
    // D V D lettering over a tiny disc, rather than a filled rectangle.
    const uint8_t letters[3][5] = {{6,5,5,5,6}, {5,5,5,5,2}, {6,5,5,5,6}};
    for (int letter = 0; letter < 3; ++letter) for (int y = 0; y < 5; ++y) {
      for (int x = 0; x < 3; ++x) {
        if (letters[letter][y] & (1 << (2 - x))) leds[id(row + letter * 4 + x, col + y)] = color;
      }
    }
    for (int x = 1; x < logoWidth - 1; ++x) leds[id(row + x, col + 6)] = color;
    for (int x = 2; x < logoWidth - 2; ++x) leds[id(row + x, col + 7)] = color;
    leds[id(row + 5, col + 6)] = off;
    FastLED.show();
    delay(speed);
    bool bounced = false;
    if (row + dr < 0 || row + dr > len - logoWidth) { dr = -dr; bounced = true; }
    if (col + dc < 0 || col + dc > len - logoHeight) { dc = -dc; bounced = true; }
    if (bounced) color = randColorPreset();
    row += dr;
    col += dc;
  }
}

void updateDvd(int row, int col, int length, int width, CRGB color) {
  for (int i = col; i < col + length; i++) {
    for (int j = row; j < row + width; j++) {
      if (!outOfBounds(j, i)) {
        leds[id(j, i)] = color;
      }
    }
  }
}

void breakOut(int speed) {
  const bool savedOrientation = rotateScene180;
  rotateScene180 = false;
  int ballRow = 11;
  int ballCol = 1;
  int playerRow = 11;
  int brickWidth = 4;
  int brickHeight = 2;
  int brickRows = brickHeight * 3;
  int topRowOffset = 2;
  const int totalBricks = (brickRows / brickHeight) * (len / brickWidth);
  int numBricks = totalBricks;
  int lives = 3;
  CRGB bricks[19] = {}; // 3 rows * 6 bricks, plus the empty ID.
  resetGrid();
  clearMatrix();
  int brickID = 0;
  for (int i = 23; i > 23 - brickRows && animationTimeLeft(); i -= brickHeight) {
    for (int j = 0; j < len; j += brickWidth) {
      brickID++;
      CRGB color = randColorPreset();
      for (int k = 0; k < brickWidth && animationTimeLeft(); k++) {
        for (int l = 0; l < brickHeight && animationTimeLeft(); l++) {
          grid[j + k][i - topRowOffset + l] = brickID;
          leds[id(j + k, i - topRowOffset + l)] = color;
          bricks[brickID] = color;
          delay(2);
          FastLED.show();
        }
      }
    }
  }
  const uint32_t start = millis();
  while (lives > 0 && numBricks > 0 && millis() - start < MAX_GAME_MS && animationTimeLeft()) {
    bool leftRight = false;       //true/false = left/right
    bool upDown = false;          //true/false = up/down
    while (ballCol != 0 && numBricks > 0 && millis() - start < MAX_GAME_MS && animationTimeLeft()) {        // update ball
      if (upDown && leftRight) {  //up and left
        ballRow--;
        ballCol--;
      } else if (upDown && !leftRight) {  //up and right
        ballRow--;
        ballCol++;
      } else if (!upDown && leftRight) {  //down and left
        ballRow++;
        ballCol--;
      } else if (!upDown && !leftRight) {  //down and right
        ballRow++;
        ballCol++;
      }
      if (hitWall(ballRow)) {
        upDown = !upDown;
      }
      if (hitPlayer(ballRow, ballCol, playerRow) && ballCol == 1) {
        leftRight = !leftRight;
      } else if (ballCol == 23) {
        leftRight = !leftRight;
      }
      if (hitBrick(ballRow, ballCol) != 0) {
        clearBrick(hitBrick(ballRow, ballCol));
        leftRight = !leftRight;
        numBricks--;
      }
      if (hitBrickSide(ballRow, ballCol) != 0) {
        clearBrick(hitBrickSide(ballRow, ballCol));
        upDown = !upDown;
        numBricks--;
      }
      playerRow = updatePlayerPos(ballRow, playerRow);
      delay(speed);
      FastLED.clear();
      for (int i = 0; i < len; i++) {
        for (int j = 0; j < len; j++) {
          if (grid[i][j] != 0) {
            leds[id(i, j)] = bricks[grid[i][j]];
          }
        }
      }
      leds[id(ballRow, ballCol)] = white;
      for (int offset = -BREAKOUT_PADDLE_HALF; offset <= BREAKOUT_PADDLE_HALF; ++offset)
        leds[id(playerRow + offset,0)] = red;
      delay(1);
      FastLED.show();
    }
    lives--;
    ballRow = 11;
    ballCol = 1;
  }
  resetGrid();
  rotateScene180 = savedOrientation;
}

int hitBrick(int ballRow, int ballCol) {
  if (gridAt(ballRow, ballCol + 1) != 0) {
    return gridAt(ballRow, ballCol + 1);
  } else if (gridAt(ballRow, ballCol - 1) != 0) {
    return gridAt(ballRow, ballCol - 1);
  } else {
    return 0;
  }
}

int hitBrickSide(int ballRow, int ballCol) {
  if (gridAt(ballRow - 1, ballCol) != 0) {
    return gridAt(ballRow - 1, ballCol);
  } else if (gridAt(ballRow + 1, ballCol) != 0) {
    return gridAt(ballRow + 1, ballCol);
  } else {
    return 0;
  }
}

void clearBrick(int brickID) {
  for (int i = 0; i < len; i++) {
    for (int j = 0; j < len; j++) {
      if (grid[i][j] == brickID) {
        grid[i][j] = 0;
      }
    }
  }
}

bool hitPlayer(int ballRow, int ballCol, int playerPos) {
  return ballCol == 1 && abs(ballRow - playerPos) <= BREAKOUT_PADDLE_HALF;
}

int updatePlayerPos(int ballRow, int playerPos) {
  if (random(10) < 9) {
    if (ballRow < playerPos) --playerPos;
    else if (ballRow > playerPos) ++playerPos;
  }
  return constrain(playerPos,BREAKOUT_PADDLE_HALF,len - 1 - BREAKOUT_PADDLE_HALF);
}

struct matrixLine {
  int row, col, length;
  bool alive;
  void init() {
    alive = true;
    leds[id(row, col)] = white;
  }
  void update() {
    if (col - length >= len) {
      alive = false;
    }
    if (alive) {
      if (!outOfBounds(row, col)) {
        leds[id(row, col)] = white;
      }
      for (int i = col - 1; i > col - length; i--) {
        if (!outOfBounds(row, i)) {
          leds[id(row, i)] = panelColor(CRGB(0,255 / (col - i),0));
        }
      }
      if (!outOfBounds(row, col - length - 1)) {
        leds[id(row, col - length - 1)] = off;
      }
      col++;
    }
  }
};

void matrixAnimation(int speed) {
  resetGrid();
  clearMatrix();
  // A line lives at most 37 frames; forty slots support one birth per frame.
  matrixLine lines[40] = {};
  for (int frame = 0; frame < 400 && animationTimeLeft(); ++frame) {
    if (frame < 250) {
      matrixLine &line = lines[frame % 40];
      line.row = random(len);
      line.col = 0;
      line.length = random(8) + 6;
      line.init();
    }
    bool anyAlive = false;
    for (int i = 0; i < 40; ++i) {
      lines[i].update();
      anyAlive = anyAlive || lines[i].alive;
    }
    FastLED.show();
    delay(speed);
    if (frame >= 250 && !anyAlive) break;
  }
  FastLED.clear();
}

CRGB randColorPreset() {
  int selection = random(8);
  switch (selection) {
    case 0: return blue;
    case 1: return red;
    case 2: return green;
    case 3: return pink;
    case 4: return brown;
    case 5: return tronYellow;
    case 6: return yellow;
    case 7: return tronBlue;
    default: return white;
  }
}

CRGB randColor() {
  int redRand = random(256);
  int blueRand = random(256);
  int greenRand = random(256);
  return CRGB(redRand, greenRand, blueRand);
}

struct drop {
  CRGB color;
  int row;
  int col;
  int rad;
  int maxSize;
  int num;
  bool alive;
  drop() : color(0, 0, 0), row(0), col(0), rad(0), maxSize(0), num(0), alive(false) {}
  void born() {
    grid[row][col] = num;
    rad = 0;
    alive = true;
  }
  void update() {
    if (!alive) {
      return;
    }
    rad++;
    for (int i = 0; i < len; i++) {
      for (int j = 0; j < len; j++) {
        if (grid[i][j] == num) {
          grid[i][j] = 0;
          leds[id(i, j)] = off;
        }
      }
    }
    for (int i = 0; i < len; i++) {
      for (int j = 0; j < len; j++) {
        const int distance2 = (i - row) * (i - row) + (j - col) * (j - col);
        if (distance2 >= rad * rad && distance2 < (rad + 1) * (rad + 1)) {
          grid[i][j] = num;
          leds[id(i, j)] = color;
        }
      }
    }
  }
  void die() {
    alive = false;
    for (int i = 0; i < len; i++) {
      for (int j = 0; j < len; j++) {
        if (grid[i][j] == num) {
          grid[i][j] = 0;
          leds[id(i, j)] = off;
        }
      }
    }
  }
};

void ripple(int speed) {
  // Four expanding annular waves over a dim blue-green pond surface.
  int cx[4] = {}, cy[4] = {}, radius[4] = {-1,-1,-1,-1};
  for (int frame = 0; frame < 240 && animationTimeLeft(); ++frame) {
    if (frame % 18 == 0) {
      const int slot = (frame / 18) % 4;
      cx[slot] = random(3,21); cy[slot] = random(3,21); radius[slot] = 0;
    }
    for (int x = 0; x < len; ++x) for (int y = 0; y < len; ++y) {
      CRGB color = panelColor(CRGB(0,12 + y / 4,22 + y / 3));
      for (int i = 0; i < 4; ++i) if (radius[i] >= 0 && radius[i] <= 72) {
        const int dx = x - cx[i], dy = y - cy[i];
        const int distance2 = (dx * dx + dy * dy) * 16;
        const int inner = radius[i] > 2 ? radius[i] - 2 : 0, outer = radius[i] + 2;
        if (distance2 >= inner * inner && distance2 <= outer * outer) {
          const uint8_t light = (72 - radius[i]) * 185 / 72;
          const uint8_t mix = 100 + sin8(frame + i * 60) / 3;
          color |= panelColor(CRGB(0,uint16_t(light) * mix / 255,light));
        }
      }
      leds[id(x,y)] = color;
    }
    for (int i = 0; i < 4; ++i) if (radius[i] >= 0 && ++radius[i] > 72) radius[i] = -1;
    FastLED.show(); scenePause(speed);
  }
}

struct tronPlayer {
  CRGB color;
  int direction;
  int num;
  int row;
  int col;
  bool alive = true;
  void update() {
    if (!alive) {
      return;
    }
    if (colision()) {
      alive = false;
      for (int i = 0; i < len; i++) {
        for (int j = 0; j < len; j++) {
          if (grid[i][j] == num) {
            grid[i][j] = 0;
            leds[id(i, j)] = off;
          }
        }
      }
      return;
    }
    if (willColide(direction)) {
      int newDir = 0;
      if (!willColide(rightTurn(direction)) && !willColide(leftTurn(direction))) {
        int randomDir = random(2);
        switch (randomDir) {
          case 0:
            newDir = leftTurn(direction);
            break;
          case 1:
            newDir = rightTurn(direction);
            break;
        }
      } else if (!willColide(leftTurn(direction))) {
        newDir = leftTurn(direction);
      } else if (!willColide(rightTurn(direction))) {
        newDir = rightTurn(direction);
      }
      // With no open turn, stay still; the next update retires this trail.
      if (willColide(newDir)) { grid[row][col] = num; return; }
      direction = newDir;
    } else if (random(100) > 92) {
      int newDir = 0;
      if (!willColide(rightTurn(direction)) && !willColide(leftTurn(direction))) {
        int randomDir = random(2);
        switch (randomDir) {
          case 0:
            newDir = leftTurn(direction);
            break;
          case 1:
            newDir = rightTurn(direction);
            break;
        }
      } else if (!willColide(leftTurn(direction))) {
        newDir = leftTurn(direction);
      } else if (!willColide(rightTurn(direction))) {
        newDir = rightTurn(direction);
      } else {
        newDir = direction;
      }
      direction = newDir;
    }
    leds[id(row, col)] = color;
    grid[row][col] = num;
    switch (direction) {
      case 0:
        col++;
        break;
      case 1:
        row++;
        break;
      case 2:
        col--;
        break;
      case 3:
        row--;
        break;
    }
    if (!outOfBounds(row, col)) leds[id(row, col)] = white;
  }
  bool colision() {
    return outOfBounds(row, col) || grid[row][col] > 0;
  }
  bool willColide(int dir) {
    int r = row, c = col;
    switch (dir) {
      case 0: ++c; break;
      case 1: ++r; break;
      case 2: --c; break;
      case 3: --r; break;
      default: return true;
    }
    return outOfBounds(r, c) || grid[r][c] > 0;
  }
  int rightTurn(int dir) {
    if (dir == 0) {
      return 3;
    } else {
      return (dir - 1);
    }
  }
  int leftTurn(int dir) {
    if (dir == 3) {
      return 0;
    } else {
      return (dir + 1);
    }
  }
};

void tron(int speed) {
  int playersAlive = 3;
  tronPlayer redPlayer;
  redPlayer.color = tronRed;
  redPlayer.num = 1;
  redPlayer.direction = random(4);
  redPlayer.row = random(24);
  redPlayer.col = random(24);
  tronPlayer bluePlayer;
  bluePlayer.color = tronBlue;
  bluePlayer.num = 2;
  bluePlayer.direction = random(4);
  bluePlayer.row = random(24);
  bluePlayer.col = random(24);
  tronPlayer greenPlayer;
  greenPlayer.color = tronYellow;
  greenPlayer.num = 3;
  greenPlayer.direction = random(4);
  greenPlayer.row = random(24);
  greenPlayer.col = random(24);
  resetGrid();
  clearMatrix();
  const uint32_t start = millis();
  while (playersAlive > 1 && millis() - start < MAX_GAME_MS && animationTimeLeft()) {
    redPlayer.update();
    bluePlayer.update();
    greenPlayer.update();
    delay(speed);
    FastLED.show();
    playersAlive = 0;
    if (redPlayer.alive) {
      playersAlive += 1;
    }
    if (bluePlayer.alive) {
      playersAlive += 1;
    }
    if (greenPlayer.alive) {
      playersAlive += 1;
    }
  }
  for (int i = 0; i < 20 && animationTimeLeft(); i++) {
    if (redPlayer.alive || bluePlayer.alive || greenPlayer.alive) {
      redPlayer.update();
      bluePlayer.update();
      greenPlayer.update();
      delay(speed * 2);
      FastLED.show();
    }
  }
  delay(1);
  FastLED.clear();
}



void resetGrid() {
  for (int i = 0; i < len; i++) {
    for (int j = 0; j < len; j++) {
      grid[i][j] = 0;
    }
  }
}

bool outOfBounds(int row, int col) {
  return (row < 0 || row > 23 || col < 0 || col > 23);
}

bool hitWall(int ballRow) {
  return (ballRow == 0 || ballRow == 23);
}

bool hitGoal(int ballCol) {
  return (ballCol == 0 || ballCol == len - 2);
}

bool hitPaddle(int ballRow, int ballCol, int paddle1Row, int paddle2Row) {
  // A 2x2 ball overlaps a paddle if either of its two rows reaches it.
  return (ballCol == 1 && ballRow + 1 >= paddle1Row - PONG_PADDLE_HALF &&
          ballRow <= paddle1Row + PONG_PADDLE_HALF) ||
         (ballCol == len - 3 && ballRow + 1 >= paddle2Row - PONG_PADDLE_HALF &&
          ballRow <= paddle2Row + PONG_PADDLE_HALF);
}

int updatePaddlePos(int ballRow, int paddlePos) {
  if (random(10) < 8) {
    if (ballRow < paddlePos) --paddlePos;
    else if (ballRow > paddlePos) ++paddlePos;
  }
  return constrain(paddlePos, PONG_PADDLE_HALF, len - 1 - PONG_PADDLE_HALF);
}

void pong(int speed) {
  uint8_t player1Score = 0, player2Score = 0;
  const uint32_t start = millis();
  while (player1Score < PONG_WIN_SCORE && player2Score < PONG_WIN_SCORE &&
         millis() - start < MAX_GAME_MS && animationTimeLeft()) {
    int ballRow = random(10, 14), ballCol = len / 2;
    int paddle1Row = len / 2, paddle2Row = len / 2;
    int dr = random(2) ? 1 : -1, dc = random(2) ? 1 : -1;
    while (!hitGoal(ballCol) && millis() - start < MAX_GAME_MS && animationTimeLeft()) {
      ballRow += dr;
      ballCol += dc;
      if (ballRow == 0 || ballRow == len - 2) dr = -dr;
      if (hitPaddle(ballRow, ballCol, paddle1Row, paddle2Row)) dc = -dc;
      paddle1Row = updatePaddlePos(ballRow, paddle1Row);
      paddle2Row = updatePaddlePos(ballRow, paddle2Row);
      clearMatrix();
      drawPongPaddle(paddle1Row, 0, red);
      drawPongPaddle(paddle2Row, len - 1, blue);
      drawPongBall(ballRow, ballCol);
      FastLED.show();
      delay(speed);
    }
    if (ballCol == 0) showPointScore(++player2Score, blue);
    else if (ballCol == len - 2) showPointScore(++player1Score, red);
    else break; // An expired rally is not a point or a win.
  }
  // The final point is already shown as the winning player's large number.
}

void drawPongPaddle(int center, int col, CRGB color) {
  for (int offset = -PONG_PADDLE_HALF; offset <= PONG_PADDLE_HALF; ++offset) {
    if (!outOfBounds(center + offset, col)) leds[id(center + offset, col)] = color;
  }
}

// Small 3x5 numerals, magnified up to 3x for a centered 9x15 scoreboard.
const uint8_t SCORE_DIGITS[10][5] = {
  {7,5,5,5,7}, {2,6,2,2,7}, {7,1,7,4,7}, {7,1,7,1,7}, {5,5,7,1,1},
  {7,4,7,1,7}, {7,4,7,5,7}, {7,1,1,1,1}, {7,5,7,5,7}, {7,5,7,1,7}
};

void drawScoreDigit(uint8_t score, int scale, CRGB color) {
  score %= 10;
  scale = constrain(scale, 1, 3);
  const int x0 = (len - 3 * scale) / 2, y0 = (len - 5 * scale) / 2;
  clearMatrix();
  for (int y = 0; y < 5; ++y) {
    for (int x = 0; x < 3; ++x) {
      if (SCORE_DIGITS[score][y] & (1 << (2 - x))) {
        for (int dy = 0; dy < scale; ++dy) for (int dx = 0; dx < scale; ++dx) {
          leds[id(x0 + x * scale + dx, y0 + y * scale + dy)] = color;
        }
      }
    }
  }
}

void showPointScore(uint8_t score, CRGB color) {
  for (int scale = 1; scale <= 3 && animationTimeLeft(); ++scale) {
    drawScoreDigit(score, scale, color);
    FastLED.show();
    scenePause(140);
  }
  scenePause(SCORE_HOLD_MS);
  if (animationTimeLeft()) {
    for (int frame = 0; frame < 12 && animationTimeLeft(); ++frame) {
      for (int i = 0; i < num_leds; ++i) leds[i].nscale8(210);
      FastLED.show();
      scenePause(35);
    }
  }
}

int id(int rowId, int colId) {
  if (outOfBounds(rowId, colId)) return -1;
  if (rotateScene180) { rowId = len - 1 - rowId; colId = len - 1 - colId; }
  const int panel = colId / 8;
  const int localCol = colId % 8;
  return panel * 192 + rowId * 8 + ((rowId & 1) ? 7 - localCol : localCol);
}


void fadeScene() {
  for (int frame = 0; frame < 16; ++frame) {
    for (int i = 0; i < num_leds; ++i) leds[i].nscale8(200);
    FastLED.show();
    delay(30);
  }
  FastLED.clear();
  FastLED.show();
  delay(250);
}

void starfield(uint32_t durationMs) {
  // Project a small, fixed pool of stars toward the viewer.
  const int count = 28;
  int16_t x[count], y[count], z[count];
  for (int i = 0; i < count; ++i) {
    x[i] = random(-170, 171); y[i] = random(-170, 171); z[i] = random(160, 1025);
  }
  const uint32_t start = millis();
  while (millis() - start < durationMs && animationTimeLeft()) {
    clearMatrix();
    for (int i = 0; i < count; ++i) {
      z[i] -= 8;
      int px = 12 + x[i] * 64 / z[i], py = 12 + y[i] * 64 / z[i];
      if (z[i] < 100 || outOfBounds(px, py)) {
        x[i] = random(-170, 171); y[i] = random(-170, 171); z[i] = 1024;
        px = 12 + x[i] * 64 / z[i]; py = 12 + y[i] * 64 / z[i];
      }
      const uint8_t light = map(z[i], 100, 1024, 240, 45);
      leds[id(px, py)] |= panelColor(CRGB(light, light, qadd8(light, 15)));
    }
    FastLED.show();
    delay(35);
  }
}

void lavaLamp(uint32_t durationMs) {
  const uint32_t start = millis();
  uint16_t frame = 0;
  while (millis() - start < durationMs && animationTimeLeft()) {
    int bx[4], by[4];
    for (int i = 0; i < 4; ++i) {
      bx[i] = 4 + sin8(frame * 2 / 5 + i * 67) * 15 / 255;
      by[i] = 3 + sin8(frame * 3 / 10 + i * 93) * 17 / 255;
    }
    for (int x = 0; x < len; ++x) for (int y = 0; y < len; ++y) {
      int energy = 0;
      for (int i = 0; i < 4; ++i) {
        const int dx = x - bx[i], dy = y - by[i];
        energy += 900 / (dx * dx + dy * dy + 8);
      }
      const uint8_t value = constrain((energy - 20) * 3, 0, 200);
      leds[id(x, y)] = panelColor(CRGB(CHSV(frame / 8 + energy / 5 + x * 2 - y, 230, value)));
    }
    ++frame;
    FastLED.show();
    delay(45);
  }
}

void sineWaves(uint32_t durationMs) {
  const uint32_t start = millis();
  uint8_t phase = 0;
  while (millis() - start < durationMs && animationTimeLeft()) {
    for (int i = 0; i < num_leds; ++i) leds[i].nscale8(180);
    for (int x = 0; x < len; ++x) {
      const int y1 = 3 + sin8(x * 9 + phase) * 17 / 255;
      const int y2 = 3 + sin8(x * 9 - phase + 128) * 17 / 255;
      const CRGB c1 = panelColor(CRGB(CHSV(x * 8 + phase / 2, 255, 180)));
      const CRGB c2 = panelColor(CRGB(CHSV(x * 8 + phase / 2 + 96, 255, 140)));
      for (int dy = -1; dy <= 1; ++dy) {
        CRGB a = c1, b = c2;
        if (dy) { a.nscale8_video(145); b.nscale8_video(145); }
        if (!outOfBounds(x,y1 + dy)) leds[id(x,y1 + dy)] |= a;
        if (!outOfBounds(x,y2 + dy)) leds[id(x,y2 + dy)] |= b;
      }
    }
    ++phase;
    FastLED.show();
    delay(55);
  }
}

// ---------- Retro autoplay scenes ----------
// These are self-contained visual game simulations, with no external input.

void drawTinyDigit(uint8_t digit, int x0, int y0, CRGB color) {
  for (int y = 0; y < 5; ++y) for (int x = 0; x < 3; ++x) {
    if ((SCORE_DIGITS[digit % 10][y] & (1 << (2 - x))) && !outOfBounds(x0 + x, y0 + y))
      leds[id(x0 + x, y0 + y)] = color;
  }
}

const uint16_t TETROMINOES[7] = {0x00F0, 0x0660, 0x0270, 0x0360, 0x0630, 0x0170, 0x0470};

void tetrominoCells(uint8_t type, uint8_t rotation, int8_t dx[4], int8_t dy[4]) {
  int n = 0, minX = 4, minY = 4;
  for (int y = 0; y < 4; ++y) for (int x = 0; x < 4; ++x) {
    if (TETROMINOES[type % 7] & (1U << (y * 4 + x))) {
      int px = x, py = y;
      for (int r = 0; r < (rotation % 4); ++r) {
        const int oldX = px; px = 3 - py; py = oldX;
      }
      dx[n] = px; dy[n] = py; ++n;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
    }
  }
  for (int i = 0; i < 4; ++i) { dx[i] -= minX; dy[i] -= minY; }
}

bool tetrisFits(const uint8_t board[10][10], uint8_t type, uint8_t rotation, int x, int y) {
  int8_t dx[4], dy[4]; tetrominoCells(type, rotation, dx, dy);
  for (int i = 0; i < 4; ++i) {
    const int px = x + dx[i], py = y + dy[i];
    if (px < 0 || px >= 10 || py >= 10) return false;
    if (py >= 0 && board[py][px]) return false;
  }
  return true;
}

int tetrisPlacementScore(const uint8_t board[10][10], uint8_t type, uint8_t rotation, int x, int y) {
  uint8_t trial[10][10];
  for (int py = 0; py < 10; ++py) for (int px = 0; px < 10; ++px) trial[py][px] = board[py][px];
  int8_t dx[4], dy[4]; tetrominoCells(type, rotation, dx, dy);
  for (int i = 0; i < 4; ++i) {
    if (y + dy[i] < 0) return 30000;
    trial[y + dy[i]][x + dx[i]] = type + 1;
  }
  int lines = 0;
  for (int py = 9; py >= 0; --py) {
    bool full = true;
    for (int px = 0; px < 10; ++px) full = full && trial[py][px];
    if (full) {
      ++lines;
      for (int row = py; row > 0; --row) for (int px = 0; px < 10; ++px) trial[row][px] = trial[row - 1][px];
      for (int px = 0; px < 10; ++px) trial[0][px] = 0;
      ++py;
    }
  }
  int heights[10] = {}, totalHeight = 0, holes = 0, bumpiness = 0;
  for (int px = 0; px < 10; ++px) {
    bool occupied = false;
    for (int py = 0; py < 10; ++py) {
      if (trial[py][px]) {
        if (!occupied) heights[px] = 10 - py;
        occupied = true;
      } else if (occupied) ++holes;
    }
    totalHeight += heights[px];
    if (px) bumpiness += abs(heights[px] - heights[px - 1]);
  }
  return totalHeight * 4 + holes * 28 + bumpiness * 3 - lines * 100;
}

CRGB tetrisColor(uint8_t type) {
  const CRGB colors[7] = {
    CRGB(15,180,220), CRGB(220,190,10), CRGB(160,30,210), CRGB(40,200,35),
    CRGB(220,30,20), CRGB(30,70,220), CRGB(230,100,10)
  };
  return panelColor(colors[type % 7]);
}

void tetrisCell(int x, int y, CRGB color) {
  if (x < 0 || x >= 10 || y < 0 || y >= 10) return;
  for (int dy = 0; dy < 2; ++dy) for (int dx = 0; dx < 2; ++dx)
    leds[id(2 + x * 2 + dx, 2 + y * 2 + dy)] = color;
}

void drawTetris(const uint8_t board[10][10], uint8_t type, uint8_t rotation, int x, int y, bool falling) {
  clearMatrix();
  const CRGB wall = panelColor(CRGB(15,25,35));
  for (int n = 1; n <= 22; ++n) {
    leds[id(1,n)] = wall; leds[id(22,n)] = wall;
    leds[id(n,1)] = wall; leds[id(n,22)] = wall;
  }
  for (int py = 0; py < 10; ++py) for (int px = 0; px < 10; ++px)
    if (board[py][px]) tetrisCell(px, py, tetrisColor(board[py][px] - 1));
  if (falling) {
    int8_t dx[4], dy[4]; tetrominoCells(type, rotation, dx, dy);
    for (int i = 0; i < 4; ++i) tetrisCell(x + dx[i], y + dy[i], tetrisColor(type));
  }
}

void tetris(uint32_t durationMs) {
  uint8_t board[10][10] = {};
  uint8_t bag[7]; int next = 7;
  const uint32_t start = millis();
  while (millis() - start < durationMs && animationTimeLeft()) {
    if (next == 7) {
      for (int i = 0; i < 7; ++i) bag[i] = i;
      for (int i = 6; i > 0; --i) { const int j = random(i + 1); const uint8_t temp = bag[i]; bag[i] = bag[j]; bag[j] = temp; }
      next = 0;
    }
    const uint8_t type = bag[next++];
    int best = 30000, bestX = 0, bestY = -1, bestR = 0;
    for (int r = 0; r < 4; ++r) for (int x = 0; x < 10; ++x) {
      if (!tetrisFits(board, type, r, x, -4)) continue;
      int y = -4;
      while (tetrisFits(board, type, r, x, y + 1)) ++y;
      const int score = tetrisPlacementScore(board, type, r, x, y);
      if (score < best) { best = score; bestX = x; bestY = y; bestR = r; }
    }
    if (bestY < 0) {
      scenePause(600);
      for (int py = 0; py < 10; ++py) for (int px = 0; px < 10; ++px) board[py][px] = 0;
      continue;
    }
    int fallingRotation = bestR;
    const int alternateRotation = (bestR + 1) % 4;
    if (random(100) < 65 && bestY >= 1 && tetrisFits(board,type,alternateRotation,bestX,-3)) fallingRotation = alternateRotation;
    const int turnAt = bestY > 3 ? 2 : 0;
    for (int y = -3; y <= bestY && animationTimeLeft() && millis() - start < durationMs; ++y) {
      if (y >= turnAt || !tetrisFits(board,type,fallingRotation,bestX,y)) fallingRotation = bestR;
      drawTetris(board, type, fallingRotation, bestX, y, true);
      FastLED.show(); scenePause(110);
    }
    if (!animationTimeLeft() || millis() - start >= durationMs) break;
    int8_t dx[4], dy[4]; tetrominoCells(type, bestR, dx, dy);
    for (int i = 0; i < 4; ++i) board[bestY + dy[i]][bestX + dx[i]] = type + 1;
    for (int y = 9; y >= 0 && animationTimeLeft(); --y) {
      bool full = true; for (int x = 0; x < 10; ++x) full = full && board[y][x];
      if (!full) continue;
      drawTetris(board, 0, 0, 0, 0, false);
      for (int x = 0; x < 10; ++x) tetrisCell(x, y, panelColor(CRGB(120,120,120)));
      FastLED.show(); scenePause(280);
      for (int row = y; row > 0; --row) for (int x = 0; x < 10; ++x) board[row][x] = board[row - 1][x];
      for (int x = 0; x < 10; ++x) board[0][x] = 0;
      ++y;
    }
    drawTetris(board, 0, 0, 0, 0, false);
    FastLED.show(); scenePause(180);
  }
}

// Full-width 24x24 maze: six rooms per axis, one-pixel walls, two-pixel doors.
// Bits N,E,S,W describe each room; outer walls are never removed.
uint8_t pacWalls[36];
const int8_t GAME_DX[4] = {1,0,-1,0}, GAME_DY[4] = {0,1,0,-1};
const uint8_t PAC_DIR_BIT[4] = {2,4,8,1};

bool pacWall(int x, int y) { return x < 0 || x >= 6 || y < 0 || y >= 6; }
bool pacCanMove(int x, int y, int direction) {
  return !pacWall(x,y) && !pacWall(x + GAME_DX[direction],y + GAME_DY[direction]) &&
         !(pacWalls[y * 6 + x] & PAC_DIR_BIT[direction]);
}

void createPacMaze() {
  bool visited[36] = {}; uint8_t stack[36]; int depth = 1;
  for (int i = 0; i < 36; ++i) pacWalls[i] = 15;
  stack[0] = 0; visited[0] = true;
  while (depth) {
    const int cell = stack[depth - 1], x = cell % 6, y = cell / 6;
    uint8_t choices[4]; int count = 0;
    for (int d = 0; d < 4; ++d) {
      const int nx = x + GAME_DX[d], ny = y + GAME_DY[d];
      if (!pacWall(nx,ny) && !visited[ny * 6 + nx]) choices[count++] = d;
    }
    if (!count) { --depth; continue; }
    const int d = choices[random(count)], next = (y + GAME_DY[d]) * 6 + x + GAME_DX[d];
    pacWalls[cell] &= ~PAC_DIR_BIT[d]; pacWalls[next] &= ~PAC_DIR_BIT[(d + 2) % 4];
    visited[next] = true; stack[depth++] = next;
  }
  // Add loops so the chase has alternate routes instead of only dead ends.
  for (int i = 0; i < 12; ++i) {
    const int x = random(6), y = random(6), d = random(4);
    if (pacWall(x + GAME_DX[d],y + GAME_DY[d])) continue;
    const int next = (y + GAME_DY[d]) * 6 + x + GAME_DX[d];
    pacWalls[y * 6 + x] &= ~PAC_DIR_BIT[d]; pacWalls[next] &= ~PAC_DIR_BIT[(d + 2) % 4];
  }
}

void pacDistances(int x, int y, uint8_t distance[36]) {
  for (int i = 0; i < 36; ++i) distance[i] = 255;
  if (pacWall(x,y)) return;
  uint8_t queue[36]; int head = 0, tail = 0;
  queue[tail++] = y * 6 + x; distance[y * 6 + x] = 0;
  while (head < tail) {
    const int cell = queue[head++], cx = cell % 6, cy = cell / 6;
    for (int d = 0; d < 4; ++d) {
      if (!pacCanMove(cx,cy,d)) continue;
      const int next = (cy + GAME_DY[d]) * 6 + cx + GAME_DX[d];
      if (distance[next] != 255) continue;
      distance[next] = distance[cell] + 1; queue[tail++] = next;
    }
  }
}

void drawPacSprite(int x, int y, int direction, bool mouth) {
  const CRGB color = panelColor(CRGB(235,205,0));
  for (int dy = 0; dy < 2; ++dy) for (int dx = 0; dx < 2; ++dx) {
    const bool cut = direction == 0 ? dx == 1 && dy == 0 :
      direction == 1 ? dx == 1 && dy == 1 : direction == 2 ? dx == 0 && dy == 1 : dx == 0 && dy == 0;
    if (!(mouth && cut) && !outOfBounds(x + dx,y + dy)) leds[id(x + dx,y + dy)] = color;
  }
}

void drawPacGhost(int x, int y, int index, bool powered) {
  const CRGB colors[3] = {CRGB(210,20,25), CRGB(210,60,140), CRGB(20,160,210)};
  const CRGB color = powered ? panelColor(CRGB(25,45,160)) : panelColor(colors[index]);
  for (int dy = 0; dy < 2; ++dy) for (int dx = 0; dx < 2; ++dx)
    if (!outOfBounds(x + dx,y + dy)) leds[id(x + dx,y + dy)] = color;
  if (!outOfBounds(x,y)) leds[id(x,y)] = panelColor(CRGB(170,170,180));
}

void drawPacMaze(const bool pellets[36]) {
  clearMatrix();
  const CRGB wall = panelColor(CRGB(0,15,85)), dot = panelColor(CRGB(100,95,50));
  // Drawing every room's boundaries preserves all four outer matrix edges.
  for (int cy = 0; cy < 6; ++cy) for (int cx = 0; cx < 6; ++cx) {
    const int x0 = cx * 4, y0 = cy * 4;
    const int x1 = cx == 5 ? 23 : x0 + 4, y1 = cy == 5 ? 23 : y0 + 4;
    for (int x = x0; x <= x1; ++x) { leds[id(x,y0)] = wall; leds[id(x,y1)] = wall; }
    for (int y = y0; y <= y1; ++y) { leds[id(x0,y)] = wall; leds[id(x1,y)] = wall; }
  }
  for (int cy = 0; cy < 6; ++cy) for (int cx = 0; cx < 6; ++cx) {
    // Shared doors are erased once, after all wall segments have been drawn.
    if (pacCanMove(cx,cy,0)) for (int n = 1; n <= 2; ++n) leds[id(cx * 4 + 4,cy * 4 + n)] = off;
    if (pacCanMove(cx,cy,1)) for (int n = 1; n <= 2; ++n) leds[id(cx * 4 + n,cy * 4 + 4)] = off;
    if (pellets[cy * 6 + cx]) {
      leds[id(1 + cx * 4,1 + cy * 4)] = dot;
      if ((cx == 0 && cy == 0) || (cx == 5 && cy == 5)) leds[id(2 + cx * 4,1 + cy * 4)] = dot;
    }
  }
}

void pacman(uint32_t durationMs) {
  const uint32_t start = millis();
  while (millis() - start < durationMs && animationTimeLeft()) {
    createPacMaze();
    bool pellets[36]; for (int i = 0; i < 36; ++i) pellets[i] = true;
    int remaining = 35, px = 0, py = 3, gx[3] = {5,5,3}, gy[3] = {0,5,3};
    pellets[py * 6 + px] = false;
    uint32_t poweredAt = 0; bool power = false, caught = false;
    int turn = 0, previousDir = 0;
    while (remaining > 0 && !caught && millis() - start < durationMs && animationTimeLeft()) {
      if (power && millis() - poweredAt >= 6000UL) power = false;
      int chosen = -1, best = 30000;
      for (int d = 0; d < 4; ++d) {
        if (!pacCanMove(px,py,d)) continue;
        const int nx = px + GAME_DX[d], ny = py + GAME_DY[d];
        uint8_t distances[36]; pacDistances(nx,ny,distances);
        int nearest = 255;
        for (int i = 0; i < 36; ++i) if (pellets[i] && distances[i] < nearest) nearest = distances[i];
        int cost = nearest * 6 + (d == ((previousDir + 2) % 4) ? 1 : 0);
        if (!power) for (int g = 0; g < 3; ++g) {
          const int distance = distances[gy[g] * 6 + gx[g]];
          if (distance == 0) cost += 80; else if (distance == 1) cost += 10;
        }
        if (cost < best) { best = cost; chosen = d; }
      }
      if (chosen < 0) break;
      for (int step = 1; step <= 4 && animationTimeLeft(); ++step) {
        drawPacMaze(pellets);
        for (int g = 0; g < 3; ++g) drawPacGhost(1 + gx[g] * 4,1 + gy[g] * 4,g,power);
        drawPacSprite(1 + px * 4 + GAME_DX[chosen] * step,1 + py * 4 + GAME_DY[chosen] * step,chosen,(turn + step) % 2);
        FastLED.show(); scenePause(50);
      }
      px += GAME_DX[chosen]; py += GAME_DY[chosen]; previousDir = chosen;
      if (pellets[py * 6 + px]) {
        pellets[py * 6 + px] = false; --remaining;
        if ((px == 0 && py == 0) || (px == 5 && py == 5)) { power = true; poweredAt = millis(); }
      }
      for (int g = 0; g < 3; ++g) if (gx[g] == px && gy[g] == py) {
        if (power) { gx[g] = 5; gy[g] = g == 1 ? 5 : 0; } else caught = true;
      }
      if ((++turn % 3) == 0) {
        uint8_t distances[36]; pacDistances(px,py,distances);
        for (int g = 0; g < 3; ++g) {
          int chosenGhost = -1, value = power ? -1 : 30000;
          for (int d = 0; d < 4; ++d) {
            if (!pacCanMove(gx[g],gy[g],d)) continue;
            const int dist = distances[(gy[g] + GAME_DY[d]) * 6 + gx[g] + GAME_DX[d]];
            if ((power && dist > value) || (!power && dist < value)) { value = dist; chosenGhost = d; }
          }
          if (chosenGhost >= 0) { gx[g] += GAME_DX[chosenGhost]; gy[g] += GAME_DY[chosenGhost]; }
          if (gx[g] == px && gy[g] == py) {
            if (power) { gx[g] = 5; gy[g] = g == 1 ? 5 : 0; } else caught = true;
          }
        }
      }
      scenePause(60);
    }
    if (!animationTimeLeft() || millis() - start >= durationMs) break;
    scenePause(650);
  }
}

bool snakeOccupied(const uint8_t body[144], int length, int cell, bool includeTail) {
  for (int i = 0; i < length - (includeTail ? 0 : 1); ++i) if (body[i] == cell) return true;
  return false;
}

void snake(uint32_t durationMs) {
  const uint32_t start = millis();
  while (millis() - start < durationMs && animationTimeLeft()) {
    uint8_t body[144]; int length = 4, food = 0;
    for (int i = 0; i < length; ++i) body[i] = 6 * 12 + 6 - i;
    do { food = random(144); } while (snakeOccupied(body,length,food,true));
    bool alive = true;
    while (alive && length < 140 && millis() - start < durationMs && animationTimeLeft()) {
      // Breadth-first search chooses a route to food, allowing the tail to vacate.
      int16_t parent[144]; for (int i = 0; i < 144; ++i) parent[i] = -1;
      uint8_t queue[144]; int head = 0, tail = 0;
      queue[tail++] = body[0]; parent[body[0]] = body[0];
      while (head < tail && parent[food] == -1) {
        const int cell = queue[head++], cx = cell % 12, cy = cell / 12;
        for (int d = 0; d < 4; ++d) {
          const int nx = cx + GAME_DX[d], ny = cy + GAME_DY[d];
          if (nx < 0 || nx >= 12 || ny < 0 || ny >= 12) continue;
          const int next = ny * 12 + nx;
          if (parent[next] != -1 || snakeOccupied(body,length,next,false)) continue;
          parent[next] = cell; queue[tail++] = next;
        }
      }
      int next = -1;
      if (parent[food] != -1) {
        next = food;
        while (parent[next] != body[0]) next = parent[next];
      } else {
        // When food is temporarily unreachable, take a legal escape step.
        for (int d = 0; d < 4; ++d) {
          const int nx = body[0] % 12 + GAME_DX[d], ny = body[0] / 12 + GAME_DY[d];
          if (nx >= 0 && nx < 12 && ny >= 0 && ny < 12 && !snakeOccupied(body,length,ny * 12 + nx,false)) {
            next = ny * 12 + nx; break;
          }
        }
      }
      if (next < 0) { alive = false; break; }
      if (next == food) ++length;
      for (int i = length - 1; i > 0; --i) body[i] = body[i - 1];
      body[0] = next;
      if (next == food) do { food = random(144); } while (snakeOccupied(body,length,food,true));
      clearMatrix();
      for (int i = length - 1; i >= 0; --i) {
        const CRGB color = panelColor(i == 0 ? CRGB(130,220,20) : CRGB(10,100,35));
        const int x = body[i] % 12 * 2, y = body[i] / 12 * 2;
        for (int dy = 0; dy < 2; ++dy) for (int dx = 0; dx < 2; ++dx) leds[id(x + dx,y + dy)] = color;
      }
      const int fx = food % 12 * 2, fy = food / 12 * 2;
      for (int dy = 0; dy < 2; ++dy) for (int dx = 0; dx < 2; ++dx) leds[id(fx + dx,fy + dy)] = panelColor(CRGB(220,35,20));
      FastLED.show(); scenePause(130);
    }
    scenePause(650);
  }
}

void drawInvader(int x, int y, bool pose, CRGB color) {
  const uint8_t spriteA[3] = {5,7,5}, spriteB[3] = {2,7,5};
  for (int dy = 0; dy < 3; ++dy) for (int dx = 0; dx < 3; ++dx) {
    if (((pose ? spriteA[dy] : spriteB[dy]) & (1 << (2 - dx))) && !outOfBounds(x + dx,y + dy)) leds[id(x + dx,y + dy)] = color;
  }
}

void spaceInvaders(uint32_t durationMs) {
  const uint32_t start = millis();
  while (millis() - start < durationMs && animationTimeLeft()) {
    bool aliens[12]; for (int i = 0; i < 12; ++i) aliens[i] = true;
    int remaining = 12, originX = 2, originY = 2, direction = 1, ship = 12;
    int shotX[3] = {}, shotY[3] = {-1,-1,-1}, enemyX = 0, enemyY = -1;
    uint32_t frame = 0; bool lost = false;
    while (remaining && !lost && millis() - start < durationMs && animationTimeLeft()) {
      if (frame % 5 == 0) {
        if (originX + direction < 0 || originX + direction > 9) { direction = -direction; ++originY; }
        originX += direction;
      }
      int target = -1;
      for (int row = 2; row >= 0 && target < 0; --row) for (int col = 0; col < 4; ++col) {
        if (aliens[row * 4 + col] && (target < 0 || abs(originX + col * 4 + 1 - ship) < abs(originX + (target % 4) * 4 + 1 - ship))) target = row * 4 + col;
      }
      if (target >= 0) {
        const int targetX = originX + (target % 4) * 4 + 1;
        if (ship < targetX) ++ship; else if (ship > targetX) --ship;
      }
      if (enemyY > 16 && abs(enemyX - ship) <= 1) ship += ship < 12 ? 2 : -2;
      ship = constrain(ship,1,22);
      if (frame % 7 == 0) for (int b = 0; b < 3; ++b) if (shotY[b] < 0) { shotX[b] = ship; shotY[b] = 20; break; }
      if (frame % 25 == 0 && enemyY < 0 && target >= 0) { enemyX = originX + (target % 4) * 4 + 1; enemyY = originY + (target / 4) * 4 + 3; }
      for (int b = 0; b < 3; ++b) if (shotY[b] >= 0) {
        --shotY[b];
        for (int i = 0; i < 12 && shotY[b] >= 0; ++i) if (aliens[i]) {
          const int x = originX + (i % 4) * 4, y = originY + (i / 4) * 4;
          if (shotX[b] >= x && shotX[b] < x + 3 && shotY[b] >= y && shotY[b] < y + 3) { aliens[i] = false; --remaining; shotY[b] = -1; }
        }
      }
      if (enemyY >= 0 && (frame % 2 == 0)) ++enemyY;
      if (enemyY >= 21) { if (abs(enemyX - ship) <= 1) lost = true; enemyY = -1; }
      for (int i = 0; i < 12; ++i) if (aliens[i] && originY + (i / 4) * 4 + 2 >= 20) lost = true;
      clearMatrix();
      for (int i = 0; i < 12; ++i) if (aliens[i]) drawInvader(originX + (i % 4) * 4,originY + (i / 4) * 4,(frame / 5) % 2,panelColor(CRGB(50,160,70)));
      leds[id(ship,21)] = panelColor(CRGB(150,175,220));
      for (int x = ship - 1; x <= ship + 1; ++x) leds[id(x,22)] = panelColor(CRGB(70,110,200));
      for (int b = 0; b < 3; ++b) if (shotY[b] >= 0) leds[id(shotX[b],shotY[b])] = panelColor(CRGB(190,190,70));
      if (enemyY >= 0 && enemyY < len) leds[id(enemyX,enemyY)] = panelColor(CRGB(220,60,25));
      FastLED.show(); scenePause(60); ++frame;
    }
    scenePause(650);
  }
}


void drawPongBall(int row, int col) {
  for (int dy = 0; dy < 2; ++dy) for (int dx = 0; dx < 2; ++dx)
    if (!outOfBounds(row + dy,col + dx)) leds[id(row + dy,col + dx)] = white;
}

void fireworks(uint32_t durationMs) {
  struct Spark {
    int32_t x,y; int16_t vx,vy; uint8_t life,ttl; CRGB color;
    Spark() : x(0),y(0),vx(0),vy(0),life(0),ttl(0),color(0,0,0) {}
  };
  struct Rocket {
    int x,y,target,wait,origin,drift; bool active;
    Rocket() : x(12),y(23),target(8),wait(0),origin(12),drift(1),active(false) {}
  };
  // Each rocket owns a separate particle bank so bursts cannot erase each other.
  Spark sparks[3][28]; Rocket rockets[3];
  CRGB source[576] = {};
  for (int i = 0; i < 3; ++i) rockets[i].wait = i * 4;
  const uint32_t start = millis(); int burst = 0;
  clearMatrix();
  while (millis() - start < durationMs && animationTimeLeft()) {
    for (int i = 0; i < num_leds; ++i) { leds[i]=source[i]; leds[i].nscale8(165); }
    for (int bank = 0; bank < 3; ++bank) {
      int alive = 0;
      for (int i = 0; i < 28; ++i) if (sparks[bank][i].life) {
        Spark &s = sparks[bank][i];
        s.x += s.vx; s.y += s.vy; s.vy += 8; s.vx = s.vx * 246 / 256;
        s.life = qsub8(s.life,2); // Faster fading in flight.
        if (s.x < 0) { s.x = 0; s.vx = abs(s.vx) / 2; }
        if (s.x > 23 * 256) { s.x = 23 * 256; s.vx = -abs(s.vx) / 2; }
        if (s.y >= 23 * 256) {
          s.y = 23 * 256; s.vy = 0; s.vx = s.vx * 160 / 256;
          s.life = qsub8(s.life,7); // Ground embers extinguish promptly.
        }
        if (!s.life) continue;
        ++alive;
        const int x = s.x / 256, y = s.y / 256;
        if (s.x >= 0 && s.y >= 0 && !outOfBounds(x,y)) {
          CRGB c = s.color; c.nscale8_video(uint16_t(s.life) * 255 / s.ttl);
          leds[id(x,y)] |= c;
        }
      }
      Rocket &r = rockets[bank];
      if (!r.active && !alive && --r.wait <= 0) {
        r.active = true; r.origin = random(7,17); r.x=r.origin; r.drift=random(2)?1:-1; r.y = 23; r.target = random(5,14);
      }
      if (!r.active) continue;
      leds[id(r.x,r.y)] = panelColor(CRGB(150,150,110));
      if (r.y < 23) leds[id(r.x,r.y + 1)] |= panelColor(CRGB(55,30,10));
      --r.y;
      const int flight=23-r.y;
      r.x=constrain(r.origin+r.drift*(flight*flight/80),1,22);
      if (r.y > r.target) continue;
      r.active = false; r.wait = random(2,9);
      const int radius = random(3,11), count = random(18,29);
      const uint8_t hue = random(256);
      for (int i = 0; i < count; ++i) {
        Spark &s = sparks[bank][i];
        const float angle = 6.283185307f * i / count;
        const int speed = radius * random(5,9);
        s.x = r.x * 256; s.y = r.target * 256;
        s.vx = cosf(angle) * speed; s.vy = sinf(angle) * speed - 12;
        s.life = s.ttl = random(100,131);
        s.color = panelColor(CRGB(CHSV((burst % 3 == 0) ? random(256) : hue + random(-10,11),230,210)));
      }
      for (int i = count; i < 28; ++i) sparks[bank][i].life = 0;
      ++burst;
    }
    diagonalScene(source);
    FastLED.show(); scenePause(45);
  }
}

int platformFloor(int worldX) {
  const int tile = worldX % 36;
  if (tile >= 14 && tile <= 18) return 24; // Gap, below the visible screen.
  if (tile >= 25 && tile <= 28) return 17; // Raised platform.
  return 20;
}

void drawPlatformHero(int x, int foot) {
  // Three-wide sprite: cap, face, shirt, and alternating blue feet.
  const CRGB hat = panelColor(CRGB(210,30,20)), skin = panelColor(CRGB(170,105,45));
  for (int dx = -1; dx <= 1; ++dx) {
    if (!outOfBounds(x + dx,foot - 3)) leds[id(x + dx,foot - 3)] = hat;
    if (!outOfBounds(x + dx,foot - 1)) leds[id(x + dx,foot - 1)] = hat;
  }
  if (!outOfBounds(x,foot - 2)) leds[id(x,foot - 2)] = skin;
  if (!outOfBounds(x + 1,foot - 2)) leds[id(x + 1,foot - 2)] = panelColor(CRGB(50,40,20));
  if (!outOfBounds(x - 1,foot)) leds[id(x - 1,foot)] = panelColor(CRGB(20,50,170));
  if (!outOfBounds(x + 1,foot)) leds[id(x + 1,foot)] = panelColor(CRGB(20,50,170));
}

bool platformAdvance(int world, int32_t &foot, int &velocity) {
  const int heroWorld = world + 6, floor = platformFloor(heroWorld);
  if (!velocity && foot / 256 == floor - 1) {
    bool jump = false;
    for (int ahead = 1; ahead <= 5; ++ahead) {
      const bool enemyAhead = (heroWorld + ahead) % 48 == 32;
      if (platformFloor(heroWorld + ahead) == 24 || platformFloor(heroWorld + ahead) < floor ||
          (enemyAhead && foot >= 18 * 256)) jump = true;
    }
    if (jump) velocity = -320;
  }
  const int32_t oldFoot = foot;
  if (velocity || foot / 256 != floor - 1) { foot += velocity; velocity += 32; }
  if (velocity > 0 && floor < 24 && oldFoot <= (floor - 1) * 256 && foot >= (floor - 1) * 256) {
    foot = (floor - 1) * 256; velocity = 0;
  }
  return foot < 25 * 256 && !(heroWorld % 48 == 32 && foot >= 18 * 256);
}

void platformer(uint32_t durationMs) {
  const uint32_t start = millis();
  int world = 0; int32_t foot = 19 * 256; int velocity = 0;
  while (millis() - start < durationMs && animationTimeLeft()) {
    if (!platformAdvance(world,foot,velocity)) {
      scenePause(450); world = 0; foot = 19 * 256; velocity = 0;
      continue;
    }
    clearMatrix();
    // Parallax clouds and a dim mountain silhouette behind the terrain.
    for (int x = 0; x < len; ++x) {
      const int hill = 14 - abs(((x + world / 3) % 16) - 8) / 2;
      for (int y = hill; y < 20; ++y) leds[id(x,y)] = panelColor(CRGB(3,8,18));
      const int ground = platformFloor(world + x);
      if (ground < 24) {
        for (int y = ground; y < 24; ++y) leds[id(x,y)] = panelColor(CRGB(45,22,5));
        leds[id(x,ground)] = panelColor(CRGB(30,85,15));
      }
      if (world + x > world + 6 && ((world + x) % 36 == 22 || (world + x) % 36 == 30)) {
        leds[id(x,11)] = panelColor(CRGB(170,125,0));
        leds[id(x,12)] = panelColor(CRGB(170,125,0));
      }
      if ((world + x) % 48 == 32 && ground < 24) {
        leds[id(x,ground - 1)] = panelColor(CRGB(110,30,100));
        leds[id(x,ground - 2)] = panelColor(CRGB(110,30,100));
      }
    }
    const int cloudX = (36 - (world / 4) % 36);
    for (int x = cloudX - 5; x <= cloudX; ++x) if (!outOfBounds(x,3)) leds[id(x,3)] = panelColor(CRGB(30,40,45));
    drawPlatformHero(6,foot / 256);
    FastLED.show(); scenePause(95); ++world;
    if (world > 30000) world -= 144; // Preserve both terrain periods and integer range.
  }
}

void lifeSeed(uint8_t cells[24][24]) {
  for (int x = 0; x < len; ++x) for (int y = 0; y < len; ++y) cells[x][y] = random(100) < 23;
}

int lifeStep(const uint8_t cells[24][24], uint8_t next[24][24]) {
  int population = 0;
  for (int x = 0; x < len; ++x) for (int y = 0; y < len; ++y) {
    int neighbors = 0;
    for (int dx = -1; dx <= 1; ++dx) for (int dy = -1; dy <= 1; ++dy) {
      if ((dx || dy) && !outOfBounds(x + dx,y + dy)) neighbors += cells[x + dx][y + dy] != 0;
    }
    next[x][y] = neighbors == 3 || (cells[x][y] && neighbors == 2);
    population += next[x][y];
  }
  return population;
}

uint32_t lifeHash(const uint8_t cells[24][24]) {
  uint32_t hash = 2166136261UL;
  for (int x = 0; x < len; ++x) for (int y = 0; y < len; ++y) { hash ^= cells[x][y]; hash *= 16777619UL; }
  return hash;
}

void gameOfLife(uint32_t durationMs) {
  uint8_t cells[24][24], next[24][24]; lifeSeed(cells);
  const uint32_t start = millis();
  uint32_t last = 0, previous = 0; int stale = 0, generation = 0;
  while (millis() - start < durationMs && animationTimeLeft()) {
    const int population = lifeStep(cells,next);
    const uint32_t hash = lifeHash(next);
    stale = (hash == last || hash == previous || !population) ? stale + 1 : 0;
    previous = last; last = hash;
    for (int x = 0; x < len; ++x) for (int y = 0; y < len; ++y) {
      const CRGB color = next[x][y] ? (cells[x][y] ? CRGB(12,80,35) : CRGB(50,180,75)) :
        (cells[x][y] ? CRGB(3,15,6) : CRGB(0,0,0));
      leds[id(x,y)] = panelColor(color); cells[x][y] = next[x][y];
    }
    FastLED.show(); scenePause(170);
    // Let still lifes and oscillators be seen, then introduce a fresh colony.
    if (stale >= 12 || ++generation >= 160) {
      lifeSeed(cells); stale = 0; generation = 0; previous = last = 0;
    }
  }
}









void rain(uint32_t durationMs) {
  int dropX[24], dropY[24]; uint8_t splash[24] = {};
  for (int i = 0; i < 24; ++i) { dropX[i] = random(24); dropY[i] = random(-24,4); }
  int boltX[18]; int lightning = 0, untilLightning = random(100,241);
  const uint32_t start = millis(); uint16_t frame = 0;
  while (millis() - start < durationMs && animationTimeLeft()) {
    clearMatrix();
    // A softly changing cloud bank fills the top edge.
    for (int x = 0; x < len; ++x) {
      const int bottom = 2 + sin8(x * 21 + frame / 4) * 2 / 255;
      for (int y = 0; y <= bottom; ++y) {
        const uint8_t light = 24 + sin8(x * 13 + y * 19 + frame / 6) / 8 + lightning * 2;
        leds[id(x,y)] = panelColor(CRGB(light / 2,light * 3 / 4,light));
      }
    }
    for (int i = 0; i < 24; ++i) {
      if (++dropY[i] >= len) {
        splash[dropX[i]] = 5; dropX[i] = random(len); dropY[i] = random(-12,3);
      }
      for (int trail = 0; trail < 2; ++trail) {
        const int y = dropY[i] - trail;
        if (y >= 4 && y < len) leds[id(dropX[i],y)] |= panelColor(CRGB(5,trail ? 25 : 55,trail ? 60 : 120));
      }
    }
    for (int x = 0; x < len; ++x) if (splash[x]) {
      for (int dx = -1; dx <= 1; ++dx) if (!outOfBounds(x + dx,23))
        leds[id(x + dx,23)] |= panelColor(CRGB(0,splash[x] * 8,splash[x] * 16));
      --splash[x];
    }
    if (!lightning && --untilLightning <= 0) {
      int x = random(5,19);
      for (int y = 0; y < 18; ++y) { x = constrain(x + random(-1,2),1,22); boltX[y] = x; }
      lightning = 12; untilLightning = random(100,241);
    }
    if (lightning) {
      for (int y = 0; y < 18; ++y) {
        const uint8_t light = lightning * 12;
        leds[id(boltX[y],y + 3)] = panelColor(CRGB(light,light,light));
      }
      --lightning; // One fading strike, without repeated full-screen flashing.
    }
    ++frame; FastLED.show(); scenePause(45);
  }
}


// Nature scenes use logical colors and the same orientation as the playlist.
void naturePixel(int x, int y, CRGB color) {
  if (!outOfBounds(x,y)) leds[id(x,y)] = panelColor(color);
}

// Rounded pixel clusters are shared by fruit and beach tree canopies.
void natureCircle(int cx, int cy, int radius, CRGB color) {
  for(int dx=-radius;dx<=radius;++dx) for(int dy=-radius;dy<=radius;++dy)
    if(dx*dx+dy*dy<=radius*radius+1) naturePixel(cx+dx,cy+dy,color);
}

void growingPlant(uint32_t durationMs) {
  const uint32_t start=millis();
  const CRGB fruitColors[3]={CRGB(190,8,3),CRGB(210,75,0),CRGB(190,155,0)};
  CRGB fruit=fruitColors[random(3)];
  uint32_t previousCycle=0;
  while(millis()-start<durationMs && animationTimeLeft()) {
    const uint32_t elapsed=(millis()-start)*(durationMs<=DEMO_MS ? 2UL : 1UL);
    const uint32_t cycle=elapsed/40000UL, age=elapsed%40000UL;
    if(cycle!=previousCycle) {fruit=fruitColors[random(3)];previousCycle=cycle;}
    const int grown=constrain(int(age/900),0,23);
    clearMatrix();
    // Root at the same logical bottom-right corner as the diagonal fire.
    for(int n=0;n<=grown;++n) naturePixel(23-n,23-n,CRGB(10,95,25));
    for(int branch=0;branch<10;++branch) {
      const int n=3+branch*2, side=branch%2 ? 1 : -1;
      const int size=2+(5-abs(branch-4))/2+(branch%3==0 ? 1:0);
      const int reach=constrain((int(age)-n*900)/270,0,size);
      for(int k=1;k<=reach;++k) {
        const int bend=(k*k)/(size+2);
        const int x=23-n+side*k-bend, y=23-n-side*k-bend;
        naturePixel(x,y,CRGB(8,70,20));
        // Different oval leaf sizes grow from curved side branches.
        if(k>=2 && (k%2==0||k==size)) {
          const int r=(n>=7 && n<=17 && k<size)?2:1;
          for(int dx=-r;dx<=r;++dx) for(int dy=-r;dy<=r;++dy)
            if(dx*dx+dy*dy<=r*r && dx*side+dy*side>=-r)
              naturePixel(x+dx+side,y+dy-1,
                (dx+dy+branch)%3==0 ? CRGB(20,115,28):CRGB(10,85,24));
        }
      }
    }
    if(age>=26000UL) {
      const int count=constrain(int((age-26000UL)/700)+1,0,6);
      for(int i=0;i<count;++i) {
        const int n=5+i*3,side=i%2 ? -1 : 1;
        natureCircle(23-n+side*2,23-n-side*2,1,fruit);
      }
    }
    FastLED.show();scenePause(90);
  }
}

void beachWaves(uint32_t durationMs) {
  const uint32_t start=millis();
  const int trees[3][2]={{5,22},{13,23},{21,22}};
  while(millis()-start<durationMs && animationTimeLeft()) {
    const uint32_t age=millis()-start;
    const float tide=sinf((age%14000UL)*6.2831853f/14000.0f);
    for(int x=0;x<24;++x) for(int y=0;y<24;++y) {
      // Inverse rotation by 30 degrees: sample all pixels, with no corner holes.
      const float u=11.5f+(x-11.5f)*0.8660254f+(y-11.5f)*0.5f;
      const float v=11.5f-(x-11.5f)*0.5f+(y-11.5f)*0.8660254f;
      const float curve=sinf(u*0.23f+(age%30000UL)*0.00015f)*1.2f;
      const float depth=14.0f+tide*3.0f+curve-v;
      CRGB c;
      if(depth<0) c=v<19 ? CRGB(75,62,35):CRGB(115,88,42);
      else {
        const int d=constrain(int(depth*5),0,70);c=CRGB(0,100-d,135-d);
        if(depth<1)c=CRGB(135,185,180);
        int band=int(v*256+float(age%3300UL)*256/550+curve*256)%1536;
        if(band<0)band+=1536;
        if(depth>2 && band<170 && sin8(int(u*23)+age/90)>65)c=CRGB(45,130,150);
      }
      for(int t=0;t<3;++t) {
        const float dx=u-trees[t][0],dy=v-trees[t][1];
        if(dx*dx+dy*dy<=5.0f)c=CRGB(8,85,22);
        if(dx*dx+dy*dy<=1.5f)c=CRGB(20,120,32);
      }
      naturePixel(x,y,c);
    }
    FastLED.show();scenePause(80);
  }
}

void moonCamp(uint32_t durationMs) {
  const uint8_t stars[12][2] = {{1,2},{7,1},{12,4},{22,2},{3,7},{9,8},
    {19,7},{23,11},{1,13},{7,12},{16,11},{21,14}};
  CRGB source[576];
  const uint32_t start = millis();
  while (millis() - start < durationMs && animationTimeLeft()) {
    const uint32_t age = millis()-start;
    for (int x=0;x<24;++x) for(int y=0;y<24;++y)
      naturePixel(x,y,y<19 ? CRGB(0,1,6) : CRGB(5,8,4));
    for(int i=0;i<12;++i) {
      const uint8_t glow=30+sin8(age/35+i*41)/3;
      naturePixel(stars[i][0],stars[i][1],CRGB(glow,glow,glow));
    }
    // Sphere illumination gives a continuous waxing/waning lunar cycle.
    const float phase=(age%90000UL)*6.2831853f/90000.0f;
    for(int dx=-3;dx<=3;++dx) for(int dy=-3;dy<=3;++dy) {
      const int rr=dx*dx+dy*dy;
      if(rr>10) continue;
      const float z=sqrtf(10.5f-rr);
      const bool lit=dx*sinf(phase)-z*cosf(phase)>0;
      naturePixel(12+dx,6+dy,lit ? CRGB(135,140,115) : CRGB(9,13,20));
    }
    const int treeX[4]={2,6,19,22};
    for(int t=0;t<4;++t) {
      const int top=14+t%3;
      for(int y=top;y<=22;++y) {
        const int width=(y-top)/3;
        for(int dx=-width;dx<=width;++dx)
          naturePixel(treeX[t]+dx,y,CRGB(1,12+(y-top)/2,3));
      }
    }
    for(int x=8;x<=15;++x) naturePixel(x,22,CRGB(55,24,5));
    naturePixel(9,23,CRGB(25,10,2)); naturePixel(14,23,CRGB(25,10,2));
    // Small anchored flames leave the night sky unobstructed.
    for(int x=9;x<=14;++x) {
      const int height=2+sin8(age/45+x*57)*4/255;
      for(int k=0;k<height;++k) {
        const int lean = k>=3 ? int(sin8(age/70)/86)-1 : 0;
        naturePixel(x+lean,21-k,CRGB(180,constrain(100-k*19,15,100),k==0?5:0));
      }
    }
    diagonalScene(source);
    FastLED.show(); scenePause(90);
  }
}

void underwater(uint32_t durationMs) {
  const uint32_t start=millis();
  while(millis()-start<durationMs && animationTimeLeft()) {
    const uint32_t age=millis()-start;
    for(int x=0;x<24;++x) for(int y=0;y<24;++y)
      naturePixel(x,y,y==23 ? CRGB(35,32,15) : CRGB(0,0,0));
    const int stems[4]={2,7,17,21};
    for(int i=0;i<4;++i) for(int y=23;y>=12+i%3;--y) {
      const int sway=int(sin8(age/90+y*13+i*39)/86)-1;
      const int x=stems[i]+sway;
      naturePixel(x,y,CRGB(0,75,25));
      if(y%3==0) naturePixel(x+(y%2?1:-1),y,CRGB(10,100,35));
    }
    // Two staggered bubble columns rise from the seabed.
    for(int column=0;column<2;++column) for(int b=0;b<4;++b) {
      const int y=22-int((age/230+b*6+column*3)%24);
      const int x=(column?19:5)+int(sin8(age/120+b*60)/128);
      naturePixel(x,y,CRGB(50,105,135));
    }
    // Every fish occupies exactly two rows by three columns, including tail.
    for(int fish=0;fish<4;++fish) {
      const bool right=fish%2==0;
      const int travel=int((age/(fish<2?180:240)+fish*7)%30)-3;
      const int left=right?travel:21-travel;
      const int y=4+fish*4+int(sin8(age/150+fish*61)/128);
      const CRGB c=fish%2 ? CRGB(75,155,210) : CRGB(210,80,8);
      for(int dx=0;dx<3;++dx) for(int dy=0;dy<2;++dy) naturePixel(left+dx,y+dy,c);
      naturePixel(left+(right?2:0),y,CRGB(4,12,20));
    }
    FastLED.show(); scenePause(80);
  }
}


// The same corner-to-corner 45-degree mapping used by the former fire scene.
// Keep an unrotated buffer for fireworks trails, then inverse sample the output.
void diagonalScene(CRGB *source) {
  for(int i=0;i<num_leds;++i) source[i]=leds[i];
  for(int x=0;x<24;++x) for(int y=0;y<24;++y) {
    const int sx=(x-y+23)/2, sy=(x+y)/2;
    leds[id(x,y)]=source[id(sx,sy)];
  }
}

void nightCity(uint32_t durationMs) {
  const uint32_t start=millis();
  // Only illuminated windows and moving lights define the black skyline.
  const uint8_t buildings[5][3]={{0,4,14},{5,5,6},{11,3,11},{15,4,3},{20,4,13}};
  while(millis()-start<durationMs && animationTimeLeft()) {
    const uint32_t age=millis()-start;
    clearMatrix();
    // Dim sweeping searchlights above two rooftops.
    for(int beam=0;beam<2;++beam) {
      const int base=beam?21:2, top=beam?12:13;
      const int lean=int(sin8(age/100+beam*100)/21)-6;
      for(int y=0;y<top;++y) {
        const int x=base+lean*(top-y)/top;
        naturePixel(x,y,CRGB(6,9,12));
        if(y<5)naturePixel(x+1,y,CRGB(3,5,7));
      }
    }
    for(int b=0;b<5;++b) {
      const int left=buildings[b][0],width=buildings[b][1],top=buildings[b][2];
      for(int x=left;x<left+width;++x) for(int y=top;y<24;++y) {
        // Unlit silhouettes mask the beams, without drawing building surfaces.
        naturePixel(x,y,CRGB(0,0,0));
        const int pattern=(x*17+y*31+b*13)%7;
        if((x-left)%2==0 && (y-top)%3==0 && pattern!=0 && pattern!=3) {
          const bool cool=b==3||pattern==2;
          naturePixel(x,y,cool ? CRGB(38,58,75):CRGB(75,55,22));
        }
      }
    }
    // A lit elevator travels up the taller skyscraper, pauses, then returns.
    const int lift=int((age/450)%36);
    const int floor=lift<18?lift:35-lift;
    naturePixel(17,22-floor,CRGB(110,100,65));
    if((age/1100)%2==0)naturePixel(17,2,CRGB(40,0,0));
    // Plane passes occasionally with two flashing red navigation lights.
    const uint32_t flight=age%24000UL;
    if(flight<9000UL && (flight/350)%3==0) {
      const int x=int(flight/350)-2;
      naturePixel(x,1,CRGB(120,0,0));
      naturePixel(x-2,2,CRGB(55,0,0));
    }
    FastLED.show();scenePause(90);
  }
}
