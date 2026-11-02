/**
 * sprites.js — Neon cyberpunk roadside scenery and traffic sprite renderer
 *
 * Designed for Gesture Rider's pseudo-3D canvas engine.
 * Pure canvas shapes only (no external images). shadowBlur only on tail lights and coins.
 * Palette: THEME.md neon — dark towers, orange/cyan lit windows, cyan rim lights,
 *          neon magenta/cyan palms, glowing red tail lights, gold coins.
 *
 * Performance: buildings, palm and car variants rendered once into offscreen canvas
 * (seeded, deterministic) and composited with drawImage at the requested scale.
 * Each logical draw path stays under ~15 canvas operations.
 *
 * Exported API (all existing signatures preserved):
 *   Sprites.drawScenery(ctx, type, x, y, scale, label?)
 *   Sprites.drawCar(ctx, type, x, y, scale, colorKey?)
 *   Sprites.drawCoin(ctx, x, y, r, phase)
 *   Sprites.drawBarrier(ctx, x, y, scale)
 *   Sprites.drawCone(ctx, x, y, scale)
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------
  // THEME Palette (THEME.md sections 0, 1, 4, 5, 8)
  // ---------------------------------------------------------------
  const PALETTE = Object.freeze({
    // Backgrounds / structure
    CHARCOAL_DARK:    '#0d0f14',
    CHARCOAL_MID:     '#141820',
    CHARCOAL_LIGHT:   '#1e2330',
    ASPHALT:          '#1a1d27',
    ASPHALT_MID:      '#2a2e3a',
    ASPHALT_LIGHT:    '#3a3f50',

    // Neon accents
    CYAN:             '#00f5ff',
    CYAN_DIM:         '#00a8b0',
    CYAN_GLOW:        'rgba(0, 245, 255, 0.18)',
    ORANGE:           '#ff7c00',
    ORANGE_DIM:       '#b05500',
    MAGENTA:          '#ff2eb8',
    MAGENTA_DIM:      '#9e1070',
    GOLD:             '#ffd040',
    GOLD_DIM:         '#c09000',
    GOLD_GLOW:        'rgba(255, 208, 64, 0.30)',

    // Billboard label
    PINK_LABEL:       '#ff4db8',

    // Vehicle body colours keyed by colorKey
    CAR_PURPLE:       '#3a1a5e',
    CAR_PURPLE_DARK:  '#220e3a',
    CAR_BLUE:         '#0e2a4a',
    CAR_BLUE_DARK:    '#071622',
    CAR_RED:          '#5e1010',
    CAR_RED_DARK:     '#3a0808',
    CAR_TEAL:         '#0a3a3a',
    CAR_TEAL_DARK:    '#062222',

    // Rear window / glass
    WINDOW_DARK:      '#050709',

    // Tail lights
    TAILLIGHT_RED:    '#ff1a1a',
    TAILLIGHT_GLOW:   'rgba(255, 26, 26, 0.6)',

    // Hazard / cone stripes
    HAZARD_ORANGE:    '#ff6a00',
    HAZARD_DARK:      '#1a1a1a',

    // Misc
    OFFWHITE:         '#c8c4ba',
    GREY_LOW:         '#3c404a',
    GREY_MID:         '#555a66',
  });

  // ---------------------------------------------------------------
  // Type registries (kept as arrays for backwards compat)
  // ---------------------------------------------------------------
  const SCENERY_TYPES = Object.freeze([
    'building-a', 'building-b', 'building-c',
    'streetlight', 'billboard', 'concrete-barrier',
    'palm', 'rock', 'light-post'
  ]);

  const CAR_TYPES = Object.freeze(['sedan', 'coupe', 'van', 'truck']);

  // ---------------------------------------------------------------
  // Seeded pseudo-random (deterministic / no Math.random)
  // ---------------------------------------------------------------
  function seededRng(seed) {
    let s = seed | 0;
    return function () {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------
  // Offscreen cache: key → { canvas, w, h }
  // ---------------------------------------------------------------
  const _cache = Object.create(null);

  /**
   * Get or create a cached offscreen canvas for a given key.
   * `drawFn(ctx, cw, ch)` draws into the canonical 256-px canvas.
   * Returns the OffscreenCanvas or HTMLCanvasElement.
   */
  function getOrCreate(key, cw, ch, drawFn) {
    if (_cache[key]) return _cache[key];
    let oc;
    if (typeof OffscreenCanvas !== 'undefined') {
      oc = new OffscreenCanvas(cw, ch);
    } else {
      oc = document.createElement('canvas');
      oc.width = cw;
      oc.height = ch;
    }
    const octx = oc.getContext('2d');
    drawFn(octx, cw, ch);
    _cache[key] = oc;
    return oc;
  }

  // ---------------------------------------------------------------
  // Helper: batch window rects into current path (preserved API)
  // ---------------------------------------------------------------
  function addWindowRects(ctx, cols, rows, startX, startY, winW, winH, gapX, gapY, predicate) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!predicate || predicate(c, r)) {
          ctx.rect(
            Math.round(startX + c * (winW + gapX)),
            Math.round(startY + r * (winH + gapY)),
            Math.max(1, Math.round(winW)),
            Math.max(1, Math.round(winH))
          );
        }
      }
    }
  }

  // ---------------------------------------------------------------
  // Offscreen builders — drawn into a fixed 256×512 canvas
  // ---------------------------------------------------------------

  /** Dark tower with orange + cyan lit windows and cyan rim light */
  function buildBuildingA(octx, cw, ch) {
    const x = cw / 2, y = ch;
    const w = cw * 0.82, h = ch * 0.88;
    const bx = x - w / 2, by = y - h;

    // 1: Main tower body
    octx.fillStyle = PALETTE.CHARCOAL_MID;
    octx.fillRect(bx, by, w, h);

    // 2: Left shadow column
    octx.fillStyle = PALETTE.CHARCOAL_DARK;
    octx.fillRect(bx, by, w * 0.28, h);

    // 3: Rooftop cap
    octx.fillStyle = PALETTE.CHARCOAL_LIGHT;
    octx.fillRect(bx - w * 0.02, by, w * 1.04, Math.max(2, h * 0.035));

    // 4: Cyan rim light on right edge
    octx.fillStyle = PALETTE.CYAN;
    octx.fillRect(bx + w - 3, by, 3, h);

    // 5: Ground footing
    octx.fillStyle = PALETTE.ASPHALT_MID;
    const footH = Math.max(4, h * 0.06);
    octx.fillRect(bx, y - footH, w, footH);

    // Windows
    const cols = 3, rows = 6;
    const marginX = w * 0.12, marginTop = h * 0.10;
    const gridW = w - marginX * 2;
    const gridH = h - marginTop - footH - h * 0.05;
    const winW = gridW / (cols * 1.6);
    const gapX = (gridW - winW * cols) / Math.max(1, cols - 1);
    const winH = gridH / (rows * 1.6);
    const gapY = (gridH - winH * rows) / Math.max(1, rows - 1);
    const isCyan  = (c, r) => (r === 1 && c === 2) || (r === 4 && c === 1);
    const isOrange = (c, r) => (r === 3 && c === 0) || (r === 5 && c === 2);

    // 6: Dark unlit windows
    octx.fillStyle = PALETTE.WINDOW_DARK;
    octx.beginPath();
    addWindowRects(octx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY,
      (c, r) => !isCyan(c, r) && !isOrange(c, r));
    octx.fill();

    // 7: Cyan lit windows
    octx.fillStyle = PALETTE.CYAN;
    octx.beginPath();
    addWindowRects(octx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY, isCyan);
    octx.fill();

    // 8: Orange lit windows
    octx.fillStyle = PALETTE.ORANGE;
    octx.beginPath();
    addWindowRects(octx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY, isOrange);
    octx.fill();
  }

  /** Broad low-rise with cyan spandrel band and orange/cyan windows */
  function buildBuildingB(octx, cw, ch) {
    const x = cw / 2, y = ch;
    const w = cw * 0.92, h = ch * 0.72;
    const bx = x - w / 2, by = y - h;

    // 1: Rooftop HVAC box
    const utW = w * 0.3, utH = h * 0.13;
    octx.fillStyle = PALETTE.CHARCOAL_DARK;
    octx.fillRect(x - utW * 0.5, by - utH, utW, utH);

    // 2: Main brutalist mass
    octx.fillStyle = PALETTE.CHARCOAL_LIGHT;
    octx.fillRect(bx, by, w, h);

    // 3: Recessed center bay
    octx.fillStyle = PALETTE.CHARCOAL_MID;
    octx.fillRect(bx + w * 0.14, by + h * 0.08, w * 0.72, h * 0.92);

    // 4: Cyan horizontal spandrel band
    octx.fillStyle = PALETTE.CYAN_DIM;
    octx.fillRect(bx, by + h * 0.48, w, Math.max(2, h * 0.035));

    // 5: Cyan rim light on left edge
    octx.fillStyle = PALETTE.CYAN;
    octx.fillRect(bx, by, 3, h);

    // 6: Base footing
    const baseH = Math.max(3, h * 0.06);
    octx.fillStyle = PALETTE.ASPHALT_MID;
    octx.fillRect(bx, y - baseH, w, baseH);

    // Windows
    const cols = 4, rows = 4;
    const marginX = w * 0.20, marginTop = h * 0.14;
    const gridW = w - marginX * 2;
    const gridH = h - marginTop - baseH - h * 0.06;
    const winW = gridW / (cols * 1.5);
    const gapX = (gridW - winW * cols) / Math.max(1, cols - 1);
    const winH = gridH / (rows * 1.6);
    const gapY = (gridH - winH * rows) / Math.max(1, rows - 1);
    const isCyan   = (c, r) => (r === 0 && c === 1) || (r === 2 && c === 3);
    const isOrange = (c, r) => (r === 3 && c === 0) || (r === 1 && c === 2);

    // 7: Dark windows
    octx.fillStyle = PALETTE.WINDOW_DARK;
    octx.beginPath();
    addWindowRects(octx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY,
      (c, r) => !isCyan(c, r) && !isOrange(c, r));
    octx.fill();

    // 8: Cyan windows
    octx.fillStyle = PALETTE.CYAN;
    octx.beginPath();
    addWindowRects(octx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY, isCyan);
    octx.fill();

    // 9: Orange windows
    octx.fillStyle = PALETTE.ORANGE;
    octx.beginPath();
    addWindowRects(octx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY, isOrange);
    octx.fill();
  }

  /** Tall slender high-rise with cyan beacon and rim */
  function buildBuildingC(octx, cw, ch) {
    const x = cw / 2, y = ch;
    const w = cw * 0.56, h = ch * 0.96;
    const bx = x - w / 2, by = y - h;

    // 1: Antenna mast
    const mastH = ch * 0.06;
    octx.strokeStyle = PALETTE.CYAN_DIM;
    octx.lineWidth = 2;
    octx.beginPath();
    octx.moveTo(x, by);
    octx.lineTo(x, by - mastH);
    octx.stroke();

    // 2: Cyan beacon
    octx.fillStyle = PALETTE.CYAN;
    const dotR = 3;
    octx.fillRect(x - dotR, by - mastH - dotR, dotR * 2, dotR * 2);

    // 3: Main tower shaft
    octx.fillStyle = PALETTE.CHARCOAL_MID;
    octx.fillRect(bx, by, w, h);

    // 4: Right shadow facade
    octx.fillStyle = PALETTE.CHARCOAL_DARK;
    octx.fillRect(bx + w * 0.5, by, w * 0.5, h);

    // 5: Cyan rim light on left edge
    octx.fillStyle = PALETTE.CYAN;
    octx.fillRect(bx, by, 2, h);

    // 6: Stepped rooftop crown
    octx.fillStyle = PALETTE.CHARCOAL_LIGHT;
    octx.fillRect(bx + w * 0.15, by - 3, w * 0.7, Math.max(3, h * 0.025));

    // Windows
    const cols = 2, rows = 8;
    const marginX = w * 0.18, marginTop = h * 0.08;
    const gridW = w - marginX * 2;
    const gridH = h - marginTop - h * 0.08;
    const winW = gridW / (cols * 1.5);
    const gapX = (gridW - winW * cols) / Math.max(1, cols - 1);
    const winH = gridH / (rows * 1.6);
    const gapY = (gridH - winH * rows) / Math.max(1, rows - 1);
    const isCyan   = (c, r) => (r === 2 && c === 0) || (r === 6 && c === 1);
    const isOrange = (c, r) => (r === 5 && c === 1) || (r === 7 && c === 0);

    // 7: Dark windows
    octx.fillStyle = PALETTE.WINDOW_DARK;
    octx.beginPath();
    addWindowRects(octx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY,
      (c, r) => !isCyan(c, r) && !isOrange(c, r));
    octx.fill();

    // 8: Cyan windows
    octx.fillStyle = PALETTE.CYAN;
    octx.beginPath();
    addWindowRects(octx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY, isCyan);
    octx.fill();

    // 9: Orange windows
    octx.fillStyle = PALETTE.ORANGE;
    octx.beginPath();
    addWindowRects(octx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY, isOrange);
    octx.fill();
  }

  /** Palm tree — neon magenta trunk, cyan/magenta fronds */
  function buildPalm(octx, cw, ch) {
    const x = cw * 0.5, y = ch;
    const trunkH = ch * 0.70;
    const trunkW = cw * 0.10;

    // 1: Trunk (dark purple-grey with magenta edge highlight)
    octx.fillStyle = '#1a0a14';
    octx.beginPath();
    octx.moveTo(x - trunkW * 0.5, y);
    octx.lineTo(x - trunkW * 0.3, y - trunkH);
    octx.lineTo(x + trunkW * 0.3, y - trunkH);
    octx.lineTo(x + trunkW * 0.5, y);
    octx.closePath();
    octx.fill();

    // 2: Magenta trunk rim
    octx.strokeStyle = PALETTE.MAGENTA;
    octx.lineWidth = 1.5;
    octx.beginPath();
    octx.moveTo(x - trunkW * 0.5, y);
    octx.lineTo(x - trunkW * 0.3, y - trunkH);
    octx.stroke();

    // Frond crown base
    const cx2 = x - trunkW * 0.02;
    const cy = y - trunkH;
    const fronds = [
      [-0.85, -0.52], [-0.50, -0.85], [-0.10, -0.95],
      [0.30, -0.85],  [0.65, -0.55],  [0.80, -0.15],
      [-0.80, -0.15]
    ];

    // 3: Cyan fronds (batch)
    octx.strokeStyle = PALETTE.CYAN;
    octx.lineWidth = Math.max(1.5, cw * 0.025);
    octx.lineCap = 'round';
    octx.beginPath();
    fronds.slice(0, 4).forEach(([dx, dy]) => {
      octx.moveTo(cx2, cy);
      octx.quadraticCurveTo(
        cx2 + dx * cw * 0.30, cy + dy * ch * 0.18,
        cx2 + dx * cw * 0.44, cy + dy * ch * 0.30
      );
    });
    octx.stroke();

    // 4: Magenta fronds (batch)
    octx.strokeStyle = PALETTE.MAGENTA;
    octx.lineWidth = Math.max(1.5, cw * 0.020);
    octx.beginPath();
    fronds.slice(4).forEach(([dx, dy]) => {
      octx.moveTo(cx2, cy);
      octx.quadraticCurveTo(
        cx2 + dx * cw * 0.28, cy + dy * ch * 0.15,
        cx2 + dx * cw * 0.40, cy + dy * ch * 0.26
      );
    });
    octx.stroke();
  }

  /** Car body builder for the offscreen cache */
  function buildCarVariant(type, colorKey, octx, cw, ch) {
    // Colour selection from colorKey
    const bodyColors = {
      purple: [PALETTE.CAR_PURPLE, PALETTE.CAR_PURPLE_DARK],
      blue:   [PALETTE.CAR_BLUE,   PALETTE.CAR_BLUE_DARK],
      red:    [PALETTE.CAR_RED,    PALETTE.CAR_RED_DARK],
      teal:   [PALETTE.CAR_TEAL,   PALETTE.CAR_TEAL_DARK],
    };
    const defaults = {
      sedan: ['purple', 'blue'],
      coupe: ['teal', 'red'],
      van:   ['blue', 'purple'],
      truck: ['red', 'teal'],
    };
    const key = colorKey || defaults[type][0];
    const [body, bodyDark] = bodyColors[key] || bodyColors.purple;

    const x = cw / 2, y = ch;

    if (type === 'sedan' || type === 'coupe') {
      const w = cw * 0.82, h = ch * 0.55;
      const isSleek = (type === 'coupe');
      const roofW   = isSleek ? 0.55 : 0.70;
      const roofH   = isSleek ? 1.15 : 1.00;

      // 1: Tires + undercarriage (batch)
      octx.fillStyle = PALETTE.CHARCOAL_DARK;
      octx.beginPath();
      const tw = w * 0.18, th = h * 0.25;
      octx.rect(x - w * 0.48, y - th, tw, th);
      octx.rect(x + w * 0.30, y - th, tw, th);
      octx.rect(x - w * 0.38, y - h * 0.16, w * 0.76, h * 0.16);
      octx.fill();

      // 2: Rear bumper
      octx.fillStyle = PALETTE.CHARCOAL_LIGHT;
      octx.fillRect(x - w * 0.48, y - h * 0.34, w * 0.96, h * 0.20);

      // 3: Blank dark plate
      const pw = w * 0.22, ph = Math.max(2, h * 0.10);
      octx.fillStyle = PALETTE.ASPHALT_LIGHT;
      octx.fillRect(x - pw * 0.5, y - h * 0.28, pw, ph);

      // 4: Main body
      octx.fillStyle = body;
      octx.fillRect(x - w * 0.50, y - h * 0.65, w, h * 0.38);

      // 5: Cabin greenhouse
      octx.fillStyle = bodyDark;
      octx.beginPath();
      octx.moveTo(x - w * (isSleek ? 0.42 : 0.44), y - h * 0.64);
      octx.lineTo(x - w * roofW * 0.50, y - h * roofH);
      octx.lineTo(x + w * roofW * 0.50, y - h * roofH);
      octx.lineTo(x + w * (isSleek ? 0.42 : 0.44), y - h * 0.64);
      octx.closePath();
      octx.fill();

      // 6: Dark rear window
      octx.fillStyle = PALETTE.WINDOW_DARK;
      octx.beginPath();
      octx.moveTo(x - w * 0.38, y - h * 0.65);
      octx.lineTo(x - w * roofW * 0.44, y - h * (roofH - 0.06));
      octx.lineTo(x + w * roofW * 0.44, y - h * (roofH - 0.06));
      octx.lineTo(x + w * 0.38, y - h * 0.65);
      octx.closePath();
      octx.fill();

      // 7: Tail lights (stored as two cyan-rimmed red rects — no shadowBlur in offscreen)
      const tlw = Math.max(2, w * 0.16), tlh = Math.max(2, h * 0.14);
      octx.fillStyle = PALETTE.TAILLIGHT_RED;
      octx.beginPath();
      octx.rect(x - w * 0.48, y - h * 0.62, tlw, tlh);
      octx.rect(x + w * 0.48 - tlw, y - h * 0.62, tlw, tlh);
      octx.fill();

    } else if (type === 'van') {
      const w = cw * 0.84, h = ch * 0.68;

      // 1: Tires + undercarriage
      octx.fillStyle = PALETTE.CHARCOAL_DARK;
      octx.beginPath();
      const tw = w * 0.18, th = h * 0.22;
      octx.rect(x - w * 0.48, y - th, tw, th);
      octx.rect(x + w * 0.30, y - th, tw, th);
      octx.rect(x - w * 0.38, y - h * 0.15, w * 0.76, h * 0.15);
      octx.fill();

      // 2: Rear bumper
      octx.fillStyle = PALETTE.CHARCOAL_LIGHT;
      octx.fillRect(x - w * 0.49, y - h * 0.30, w * 0.98, h * 0.16);

      // 3: Blank plate
      const pw = w * 0.20, ph = Math.max(2, h * 0.08);
      octx.fillStyle = PALETTE.ASPHALT_LIGHT;
      octx.fillRect(x - pw - w * 0.04, y - h * 0.25, pw, ph);

      // 4: Main van body
      octx.fillStyle = body;
      octx.fillRect(x - w * 0.48, y - h, w * 0.96, h * 0.74);

      // 5: Door seam
      octx.strokeStyle = PALETTE.CHARCOAL_DARK;
      octx.lineWidth = 2;
      octx.beginPath();
      octx.moveTo(x, y - h);
      octx.lineTo(x, y - h * 0.26);
      octx.stroke();

      // 6: Twin rear windows (batched)
      const winW = w * 0.34, winH = h * 0.28;
      octx.fillStyle = PALETTE.WINDOW_DARK;
      octx.beginPath();
      octx.rect(x - w * 0.40, y - h * 0.92, winW, winH);
      octx.rect(x + w * 0.06, y - h * 0.92, winW, winH);
      octx.fill();

      // 7: Tail lights
      const tlw = Math.max(2, w * 0.09), tlh = Math.max(3, h * 0.32);
      octx.fillStyle = PALETTE.TAILLIGHT_RED;
      octx.beginPath();
      octx.rect(x - w * 0.47, y - h * 0.68, tlw, tlh);
      octx.rect(x + w * 0.47 - tlw, y - h * 0.68, tlw, tlh);
      octx.fill();

    } else { // truck
      const w = cw * 0.88, h = ch * 0.86;

      // 1: Mudflaps + underride bar (batch)
      octx.fillStyle = PALETTE.CHARCOAL_DARK;
      octx.beginPath();
      octx.rect(x - w * 0.48, y - h * 0.22, w * 0.20, h * 0.22);
      octx.rect(x + w * 0.28, y - h * 0.22, w * 0.20, h * 0.22);
      octx.rect(x - w * 0.44, y - h * 0.14, w * 0.88, Math.max(2, h * 0.06));
      octx.fill();

      // 2: Cargo box
      octx.fillStyle = body;
      octx.fillRect(x - w * 0.50, y - h, w, h * 0.82);

      // 3: Roll-up door recess
      octx.fillStyle = bodyDark;
      octx.fillRect(x - w * 0.44, y - h * 0.94, w * 0.88, h * 0.72);

      // 4: Dark cab window
      octx.fillStyle = PALETTE.WINDOW_DARK;
      octx.fillRect(x - w * 0.34, y - h * 0.88, w * 0.68, h * 0.20);

      // 5: Locking bar
      octx.strokeStyle = PALETTE.ASPHALT_LIGHT;
      octx.lineWidth = 2;
      octx.beginPath();
      octx.moveTo(x, y - h * 0.92);
      octx.lineTo(x, y - h * 0.24);
      octx.stroke();

      // 6: Cyan hazard strip (replacing old yellow)
      octx.fillStyle = PALETTE.CYAN_DIM;
      octx.fillRect(x - w * 0.44, y - h * 0.23, w * 0.88, Math.max(2, h * 0.04));

      // 7: Tail lights
      const tlw = Math.max(3, w * 0.16), tlh = Math.max(2, h * 0.10);
      octx.fillStyle = PALETTE.TAILLIGHT_RED;
      octx.beginPath();
      octx.rect(x - w * 0.44, y - h * 0.21, tlw, tlh);
      octx.rect(x + w * 0.44 - tlw, y - h * 0.21, tlw, tlh);
      octx.fill();
    }
  }

  // ---------------------------------------------------------------
  // Canonical offscreen sizes (fixed; scaled by drawImage)
  // ---------------------------------------------------------------
  const BLDG_W = 192, BLDG_H = 384;   // buildings
  const PALM_W = 128, PALM_H = 256;   // palm
  const CAR_W  = 160, CAR_H  = 128;   // car variants

  // ---------------------------------------------------------------
  // Direct-draw (no cache) scenery helpers
  // ---------------------------------------------------------------

  function drawStreetlight(ctx, x, y, scale) {
    const h = scale * 1.9;
    const armW = scale * 0.35;
    const poleW = Math.max(1.5, scale * 0.03);

    // 1: Concrete base
    ctx.fillStyle = PALETTE.ASPHALT_MID;
    const footW = Math.max(4, scale * 0.10), footH = Math.max(3, scale * 0.06);
    ctx.fillRect(x - footW * 0.5, y - footH, footW, footH);

    // 2: Pole + curved arm (cyan)
    ctx.strokeStyle = PALETTE.CYAN_DIM;
    ctx.lineWidth = poleW;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - footH);
    ctx.lineTo(x, y - h * 0.85);
    ctx.quadraticCurveTo(x, y - h, x + armW, y - h);
    ctx.stroke();

    const lampX = x + armW;
    const lampY = y - h;
    const headW = Math.max(4, scale * 0.14);
    const headH = Math.max(2, scale * 0.045);

    // 3: Lamp housing
    ctx.fillStyle = PALETTE.CHARCOAL_DARK;
    ctx.fillRect(lampX - headW * 0.3, lampY - headH * 0.5, headW, headH);

    // 4: Cyan lamp head (lens)
    ctx.fillStyle = PALETTE.CYAN;
    ctx.fillRect(lampX - headW * 0.25, lampY + headH * 0.4, headW * 0.85, Math.max(1.5, headH * 0.5));

    // 5: Ambient cyan cone (no shadowBlur)
    ctx.fillStyle = PALETTE.CYAN_GLOW;
    ctx.beginPath();
    ctx.moveTo(lampX + headW * 0.1, lampY + headH);
    ctx.lineTo(lampX - scale * 0.22, y);
    ctx.lineTo(lampX + scale * 0.35, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawBillboard(ctx, x, y, scale, label) {
    const lbl = typeof label === 'string' ? label : 'RIDE';
    const h = scale * 1.5;
    const bw = scale * 1.2;
    const bh = scale * 0.65;
    const by = y - h;
    const postW = Math.max(2, scale * 0.04);
    const postX1 = x - bw * 0.3;
    const postX2 = x + bw * 0.3 - postW;

    // 1: Posts (batch)
    ctx.fillStyle = PALETTE.ASPHALT_MID;
    ctx.beginPath();
    ctx.rect(postX1, by + bh, postW, h - bh);
    ctx.rect(postX2, by + bh, postW, h - bh);
    ctx.fill();

    // 2: Cross-brace
    ctx.strokeStyle = PALETTE.CHARCOAL_DARK;
    ctx.lineWidth = Math.max(1, scale * 0.02);
    ctx.beginPath();
    ctx.moveTo(postX1, by + bh);
    ctx.lineTo(postX2 + postW, y);
    ctx.moveTo(postX2 + postW, by + bh);
    ctx.lineTo(postX1, y);
    ctx.stroke();

    // 3: Cyan outer border
    ctx.fillStyle = PALETTE.CYAN;
    ctx.fillRect(x - bw * 0.5, by, bw, bh);

    // 4: Dark panel interior
    const bt = Math.max(1.5, scale * 0.025);
    ctx.fillStyle = PALETTE.CHARCOAL_DARK;
    ctx.fillRect(x - bw * 0.5 + bt, by + bt, bw - bt * 2, bh - bt * 2);

    // 5: Pink label text (textContent-safe: set via fillText with literal value)
    if (scale >= 18) {
      const fontSize = Math.max(6, bh * 0.38);
      ctx.fillStyle = PALETTE.PINK_LABEL;
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(lbl).slice(0, 12), x, by + bh * 0.5);
    }
  }

  function drawConcreteBarrier(ctx, x, y, scale) {
    const w = scale * 0.75, h = scale * 0.35;

    // 1: Ground shadow
    ctx.fillStyle = 'rgba(10, 12, 16, 0.4)';
    ctx.fillRect(x - w * 0.52, y - Math.max(2, scale * 0.03) * 0.5, w * 1.04, Math.max(2, scale * 0.03));

    // 2: Jersey barrier profile
    ctx.fillStyle = PALETTE.ASPHALT_MID;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.50, y);
    ctx.lineTo(x - w * 0.44, y - h * 0.40);
    ctx.lineTo(x - w * 0.38, y - h);
    ctx.lineTo(x + w * 0.38, y - h);
    ctx.lineTo(x + w * 0.44, y - h * 0.40);
    ctx.lineTo(x + w * 0.50, y);
    ctx.closePath();
    ctx.fill();

    // 3: Top cap highlight
    ctx.fillStyle = PALETTE.ASPHALT_LIGHT;
    ctx.fillRect(x - w * 0.38, y - h, w * 0.76, Math.max(1.5, h * 0.18));

    // 4: Expansion joints
    ctx.strokeStyle = PALETTE.CHARCOAL_DARK;
    ctx.lineWidth = Math.max(1, scale * 0.015);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.16, y - h); ctx.lineTo(x - w * 0.16, y);
    ctx.moveTo(x + w * 0.16, y - h); ctx.lineTo(x + w * 0.16, y);
    ctx.stroke();

    // 5: Cyan center reflector tab (replaces old yellow)
    const rw = Math.max(3, w * 0.14), rh = Math.max(2, h * 0.24);
    ctx.fillStyle = PALETTE.CYAN;
    ctx.fillRect(x - rw * 0.5, y - h * 0.70, rw, rh);
  }

  function drawRock(ctx, x, y, scale) {
    const w = scale * 0.55, h = scale * 0.22;

    // 1: Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.52, h * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2: Main low-poly rock mass
    ctx.fillStyle = PALETTE.GREY_MID;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.50, y);
    ctx.lineTo(x - w * 0.38, y - h * 0.65);
    ctx.lineTo(x - w * 0.12, y - h);
    ctx.lineTo(x + w * 0.18, y - h * 0.88);
    ctx.lineTo(x + w * 0.50, y - h * 0.42);
    ctx.lineTo(x + w * 0.50, y);
    ctx.closePath();
    ctx.fill();

    // 3: Highlight facet
    ctx.fillStyle = PALETTE.GREY_LOW;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.12, y - h);
    ctx.lineTo(x + w * 0.18, y - h * 0.88);
    ctx.lineTo(x + w * 0.10, y - h * 0.60);
    ctx.lineTo(x - w * 0.08, y - h * 0.70);
    ctx.closePath();
    ctx.fill();
  }

  function drawLightPost(ctx, x, y, scale) {
    const h = scale * 1.5;
    const poleW = Math.max(1, scale * 0.025);
    const headR = Math.max(2, scale * 0.06);

    // 1: Thin cyan pole
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = poleW;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.stroke();

    // 2: Cyan lamp head (circle via rect approximation)
    ctx.fillStyle = PALETTE.CYAN;
    ctx.fillRect(x - headR, y - h - headR, headR * 2, headR * 2);

    // 3: Dim glow (translucent)
    if (scale >= 15) {
      ctx.fillStyle = PALETTE.CYAN_GLOW;
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x - scale * 0.12, y - h * 0.60);
      ctx.lineTo(x + scale * 0.12, y - h * 0.60);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------
  // Tail-light draw with shadowBlur (live canvas only)
  // ---------------------------------------------------------------
  function drawTailLightsLive(ctx, leftX, rightX, ty, width, height, blur) {
    ctx.shadowBlur = blur;
    ctx.shadowColor = PALETTE.TAILLIGHT_RED;
    ctx.fillStyle = PALETTE.TAILLIGHT_RED;
    ctx.beginPath();
    ctx.rect(leftX, ty, width, height);
    ctx.rect(rightX, ty, width, height);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ---------------------------------------------------------------
  // Scenery dispatcher
  // ---------------------------------------------------------------
  function drawScenery(ctx, type, x, y, scale, label) {
    if (!ctx || !scale || scale <= 0) return;

    switch (type) {
      case 'building-a': {
        const oc = getOrCreate('bldg-a', BLDG_W, BLDG_H, buildBuildingA);
        // The offscreen was drawn with bottom at ch, so dstY = y - scale*2.8*(BLDG_H/256)
        // We map: scale → output height
        const dstH = scale * 2.80;
        const dstW = scale * 1.10;
        ctx.drawImage(oc, x - dstW / 2, y - dstH, dstW, dstH);
        break;
      }
      case 'building-b': {
        const oc = getOrCreate('bldg-b', BLDG_W, BLDG_H, buildBuildingB);
        const dstH = scale * 2.10;
        const dstW = scale * 1.60;
        ctx.drawImage(oc, x - dstW / 2, y - dstH, dstW, dstH);
        break;
      }
      case 'building-c': {
        const oc = getOrCreate('bldg-c', BLDG_W, BLDG_H, buildBuildingC);
        const dstH = scale * 3.80;
        const dstW = scale * 0.85;
        ctx.drawImage(oc, x - dstW / 2, y - dstH, dstW, dstH);
        break;
      }
      case 'streetlight':
        drawStreetlight(ctx, x, y, scale);
        break;
      case 'billboard':
        drawBillboard(ctx, x, y, scale, label);
        break;
      case 'concrete-barrier':
      case 'barrier':
        drawConcreteBarrier(ctx, x, y, scale);
        break;
      case 'palm': {
        const oc = getOrCreate('palm', PALM_W, PALM_H, buildPalm);
        const dstH = scale * 2.20;
        const dstW = scale * 0.80;
        ctx.drawImage(oc, x - dstW / 2, y - dstH, dstW, dstH);
        break;
      }
      case 'rock':
        drawRock(ctx, x, y, scale);
        break;
      case 'light-post':
        drawLightPost(ctx, x, y, scale);
        break;
      default:
        // Fallback: building-a
        drawScenery(ctx, 'building-a', x, y, scale, label);
    }
  }

  // ---------------------------------------------------------------
  // Car dispatcher (colorKey-aware, offscreen cached)
  // ---------------------------------------------------------------
  function drawCar(ctx, type, x, y, scale, colorKey) {
    if (!ctx || !scale || scale <= 0) return;

    const carType = (typeof type === 'object' && type !== null) ? type.type : type;

    // Normalise type to new API (taxi → coupe for backwards compat)
    const resolvedType = (carType === 'taxi' || carType === 'car') ? 'sedan' : carType;
    if (!['sedan', 'coupe', 'van', 'truck'].includes(resolvedType)) {
      drawCar(ctx, 'sedan', x, y, scale, colorKey);
      return;
    }

    // Determine final color key
    const defaultKeys = { sedan: 'purple', coupe: 'teal', van: 'blue', truck: 'red' };
    const key = colorKey || defaultKeys[resolvedType] || 'purple';
    const cacheKey = `car-${resolvedType}-${key}`;

    const oc = getOrCreate(cacheKey, CAR_W, CAR_H, (octx, cw, ch) => {
      buildCarVariant(resolvedType, key, octx, cw, ch);
    });

    // Scale: car body width ≈ scale * 0.5
    const dstW = scale * 0.62;
    const dstH = scale * 0.50;
    // Composit body
    ctx.drawImage(oc, x - dstW / 2, y - dstH, dstW, dstH);

    // Overlay live tail lights with shadowBlur (not in offscreen)
    const tlw = Math.max(2, dstW * 0.13);
    const tlh = Math.max(2, dstH * 0.16);
    const blur = Math.min(6, Math.max(2, scale * 0.07));
    const tlY = y - dstH * 0.62;
    drawTailLightsLive(ctx, x - dstW * 0.49, x + dstW * 0.49 - tlw, tlY, tlw, tlh, blur);
  }

  // ---------------------------------------------------------------
  // NEW: drawCoin
  // ---------------------------------------------------------------
  /**
   * drawCoin — gold glossy coin with "$" label, width oscillates with phase.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - centre X
   * @param {number} y - centre Y
   * @param {number} r - base radius
   * @param {number} phase - 0..1 oscillation (0 = head-on, 0.5 = edge-on)
   */
  function drawCoin(ctx, x, y, r, phase) {
    const p = phase !== undefined ? Math.max(0, Math.min(1, phase)) : 0;
    // Horizontal radius oscillates: r at phase=0, r*0.12 at phase=0.5
    const rx = r * (0.12 + 0.88 * Math.abs(Math.cos(p * Math.PI)));
    const ry = r;

    // 1: Small glow
    ctx.shadowBlur = Math.max(4, r * 0.7);
    ctx.shadowColor = PALETTE.GOLD_GLOW;
    ctx.fillStyle = PALETTE.GOLD_DIM;
    ctx.beginPath();
    ctx.ellipse(x, y, rx + 2, ry + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 2: Coin body
    ctx.fillStyle = PALETTE.GOLD;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3: Glossy highlight
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.beginPath();
    ctx.ellipse(x, y - ry * 0.20, rx * 0.55, ry * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4: "$" label (only when face-on enough)
    if (rx > r * 0.35 && r >= 6) {
      ctx.fillStyle = PALETTE.GOLD_DIM;
      ctx.font = `bold ${Math.max(6, r * 0.75)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', x, y + ry * 0.06);
    }
  }

  // ---------------------------------------------------------------
  // NEW: drawBarrier (neon hazard stripes)
  // ---------------------------------------------------------------
  /**
   * drawBarrier — construction barrier with neon orange/dark hazard stripes
   */
  function drawBarrier(ctx, x, y, scale) {
    const w = scale * 0.45;
    const h = scale * 0.70;
    const bx = x - w / 2;
    const by = y - h;
    const stripes = 5;

    // 1: Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(bx - 2, y - 3, w + 4, 4);

    // 2: Dark base stripe (whole rect first)
    ctx.fillStyle = PALETTE.HAZARD_DARK;
    ctx.fillRect(bx, by, w, h);

    // 3: Hazard orange stripes (batch)
    ctx.fillStyle = PALETTE.HAZARD_ORANGE;
    ctx.beginPath();
    for (let i = 0; i < stripes; i++) {
      if (i % 2 === 0) {
        const sy = by + (h / stripes) * i;
        const sh = h / stripes;
        ctx.rect(bx, sy, w, sh);
      }
    }
    ctx.fill();

    // 4: Narrow top cap
    ctx.fillStyle = PALETTE.CHARCOAL_LIGHT;
    ctx.fillRect(bx - w * 0.06, by - Math.max(2, h * 0.04), w * 1.12, Math.max(2, h * 0.04));

    // 5: Cyan rim light
    ctx.fillStyle = PALETTE.CYAN;
    ctx.fillRect(bx, by, 2, h);
  }

  // ---------------------------------------------------------------
  // NEW: drawCone (traffic cone with neon hazard stripes)
  // ---------------------------------------------------------------
  /**
   * drawCone — traffic cone with orange/dark neon hazard bands
   */
  function drawCone(ctx, x, y, scale) {
    const w = scale * 0.30;
    const h = scale * 0.50;

    // 1: Base shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.55, Math.max(2, h * 0.07), 0, 0, Math.PI * 2);
    ctx.fill();

    // 2: Base plate
    ctx.fillStyle = PALETTE.HAZARD_DARK;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.52, y);
    ctx.lineTo(x + w * 0.52, y);
    ctx.lineTo(x + w * 0.28, y - h * 0.16);
    ctx.lineTo(x - w * 0.28, y - h * 0.16);
    ctx.closePath();
    ctx.fill();

    // 3: Cone body (full orange)
    ctx.fillStyle = PALETTE.HAZARD_ORANGE;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.28, y - h * 0.16);
    ctx.lineTo(x - w * 0.04, y - h);
    ctx.lineTo(x + w * 0.04, y - h);
    ctx.lineTo(x + w * 0.28, y - h * 0.16);
    ctx.closePath();
    ctx.fill();

    // 4: White/cyan hazard band
    ctx.fillStyle = PALETTE.CYAN;
    const bandY = y - h * 0.42;
    const bandH = Math.max(1.5, h * 0.10);
    const bandFraction = 0.55;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.28 * bandFraction, bandY);
    ctx.lineTo(x - w * 0.04,                bandY - bandH * 0.2);
    ctx.lineTo(x + w * 0.04,                bandY - bandH * 0.2);
    ctx.lineTo(x + w * 0.28 * bandFraction, bandY);
    ctx.lineTo(x + w * 0.28 * bandFraction, bandY + bandH);
    ctx.lineTo(x - w * 0.28 * bandFraction, bandY + bandH);
    ctx.closePath();
    ctx.fill();

    // 5: Dark band below cyan
    ctx.fillStyle = PALETTE.HAZARD_DARK;
    const band2Y = bandY + bandH;
    const band2H = Math.max(1, h * 0.06);
    ctx.fillRect(x - w * 0.20, band2Y, w * 0.40, band2H);
  }

  // ---------------------------------------------------------------
  // Public Global Sprites Object
  // ---------------------------------------------------------------
  const Sprites = {
    PALETTE,
    SCENERY_TYPES,
    CAR_TYPES,

    /**
     * drawScenery: Draws roadside neon scenery with canvas shapes / cached offscreen.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} type - 'building-a' | 'building-b' | 'building-c' | 'streetlight' |
     *                        'billboard' | 'concrete-barrier' | 'palm' | 'rock' | 'light-post'
     * @param {number} x - Bottom-centre ground X
     * @param {number} y - Bottom-centre ground Y
     * @param {number} scale - Road half-width in pixels at this depth
     * @param {string} [label] - Billboard label text (default "RIDE"); shown in pink
     */
    drawScenery(ctx, type, x, y, scale, label) {
      if (!ctx) return;

      // Backwards-compat: handle (ctx, x, y, scale, type) arg order
      if (typeof type === 'number' && typeof arguments[4] === 'string') {
        const actualType  = arguments[4];
        const actualScale = y;
        y = x; x = type; scale = actualScale; type = actualType;
      }

      if (!scale || scale <= 0) return;
      drawScenery(ctx, type, x, y, scale, label);
    },

    /**
     * drawCar: Draws rear-view vehicle, glowing red tail lights, dark rear window.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {string|object} type - 'sedan' | 'coupe' | 'van' | 'truck' (or car object with .type)
     *                               'taxi' and 'car' map to 'sedan' for backwards compat.
     * @param {number} x - Bottom-centre ground X
     * @param {number} y - Bottom-centre ground Y
     * @param {number} scale - Road half-width in pixels at this depth
     * @param {string} [colorKey] - 'purple' | 'blue' | 'red' | 'teal'
     */
    drawCar(ctx, type, x, y, scale, colorKey) {
      if (!ctx) return;

      // Backwards-compat arg order: (ctx, x, y, scale, car/type)
      if (typeof type === 'number' && (typeof arguments[4] === 'string' || typeof arguments[4] === 'object')) {
        const actualCar   = arguments[4];
        const actualScale = y;
        y = x; x = type; scale = actualScale; type = actualCar;
      }

      if (!scale || scale <= 0) return;
      drawCar(ctx, type, x, y, scale, colorKey);
    },

    /**
     * drawCoin: Gold glossy "$" coin, width oscillates with phase.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x - centre X
     * @param {number} y - centre Y
     * @param {number} r - base radius
     * @param {number} phase - 0..1 oscillation phase
     */
    drawCoin,

    /**
     * drawBarrier: Construction barrier with neon orange/dark hazard stripes + cyan rim.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x - Bottom-centre X
     * @param {number} y - Ground Y
     * @param {number} scale
     */
    drawBarrier,

    /**
     * drawCone: Traffic cone with orange/cyan neon hazard bands.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x - Bottom-centre X
     * @param {number} y - Ground Y
     * @param {number} scale
     */
    drawCone,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Sprites;
  }
  global.Sprites = Sprites;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
