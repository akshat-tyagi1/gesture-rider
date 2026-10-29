/**
 * sprites.js — Gritty urban roadside scenery and traffic sprite renderer
 *
 * Designed for Gesture Rider's pseudo-3D canvas engine.
 * Pure canvas shapes only (no external images, no shadowBlur except tiny tail lights).
 * Palette: near-black/charcoal, asphalt grey, dirty off-white, yellow accents, muted dark red/blue.
 *
 * Exported API:
 *   Sprites.drawScenery(ctx, type, x, y, scale)
 *   Sprites.drawCar(ctx, type, x, y, scale)
 */
(function (global) {
  'use strict';

  // Core gritty urban palette
  const PALETTE = Object.freeze({
    // Near-black and charcoals
    CHARCOAL_DARK:   '#121417',
    CHARCOAL_MID:    '#1a1d24',
    CHARCOAL_LIGHT:  '#262933',
    CHARCOAL_BORDER: '#0d0f12',

    // Asphalt greys
    ASPHALT_DARK:    '#333740',
    ASPHALT_MID:     '#444955',
    ASPHALT_LIGHT:   '#5c6270',

    // Dirty off-white
    OFFWHITE_DIRTY:  '#b8b5ab',
    OFFWHITE_LIGHT:  '#dedad0',

    // Yellow accents (gritty street markings, lit windows, billboard borders, reflectors)
    YELLOW_MAIN:     '#f5b700',
    YELLOW_AMBER:    '#d49200',
    YELLOW_PALE:     '#ffea78',
    YELLOW_CONE:     'rgba(245, 183, 0, 0.08)',

    // Vehicle colors (muted dark red, muted dark blue, gritty taxi yellow, industrial slate)
    CAR_RED:         '#7a2222',
    CAR_RED_DARK:    '#4e1414',
    CAR_BLUE:        '#22334a',
    CAR_BLUE_DARK:   '#142030',
    CAR_TAXI:        '#d69615',
    CAR_TAXI_DARK:   '#946607',
    CAR_VAN:         '#2c3440',
    CAR_VAN_DARK:    '#1c222b',
    CAR_TRUCK:       '#30353e',
    CAR_TRUCK_DARK:  '#20242b',

    // Rear window & glass
    WINDOW_DARK:     '#0a0c0f',
    WINDOW_LIT:      '#f5b700',

    // Lights
    TAILLIGHT_RED:   '#ff2222',
    BEACON_RED:      '#ff3333'
  });

  const SCENERY_TYPES = Object.freeze([
    'building-a',
    'building-b',
    'building-c',
    'streetlight',
    'billboard',
    'concrete-barrier'
  ]);

  const CAR_TYPES = Object.freeze([
    'sedan',
    'taxi',
    'van',
    'truck'
  ]);

  /**
   * Helper: batch window rectangles into current path
   */
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

  // -------------------------------------------------------------
  // Scenery Renderers
  // -------------------------------------------------------------

  /**
   * building-a: Standard mid-rise dark concrete block with lit yellow windows
   */
  function drawBuildingA(ctx, x, y, scale) {
    const w = scale * 1.1;
    const h = scale * 2.8;
    const bx = x - w / 2;
    const by = y - h;

    // Call 1: Main concrete facade
    ctx.fillStyle = PALETTE.CHARCOAL_MID;
    ctx.fillRect(bx, by, w, h);

    // Call 2: Left architectural shadow column
    ctx.fillStyle = PALETTE.CHARCOAL_DARK;
    ctx.fillRect(bx, by, w * 0.28, h);

    // Call 3: Rooftop cornice / parapet cap
    const capH = Math.max(2, h * 0.035);
    ctx.fillStyle = PALETTE.CHARCOAL_LIGHT;
    ctx.fillRect(bx - w * 0.02, by, w * 1.04, capH);

    // Call 4: Ground dirty splash / base footing
    const footH = Math.max(3, h * 0.06);
    ctx.fillStyle = PALETTE.ASPHALT_DARK;
    ctx.fillRect(bx, y - footH, w, footH);

    // Windows (only draw if scale is large enough to render)
    if (scale >= 12) {
      const cols = 3;
      const rows = 6;
      const marginX = w * 0.12;
      const marginTop = h * 0.10;
      const gridW = w - marginX * 2;
      const gridH = h - marginTop - footH - h * 0.05;
      const winW = gridW / (cols * 1.6);
      const gapX = (gridW - winW * cols) / (cols - 1);
      const winH = gridH / (rows * 1.6);
      const gapY = (gridH - winH * rows) / (rows - 1);

      // Lit windows predicate (deterministic pattern)
      const isLit = (c, r) => (r === 1 && c === 2) || (r === 3 && c === 0) || (r === 4 && c === 1);

      // Call 5: Dark unlit windows (single batch path)
      ctx.fillStyle = PALETTE.WINDOW_DARK;
      ctx.beginPath();
      addWindowRects(ctx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY, (c, r) => !isLit(c, r));
      ctx.fill();

      // Call 6: Lit yellow windows (single batch path)
      ctx.fillStyle = PALETTE.YELLOW_MAIN;
      ctx.beginPath();
      addWindowRects(ctx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY, isLit);
      ctx.fill();
    }
  }

  /**
   * building-b: Broad low-rise concrete block with rooftop utility box and horizontal spandrel
   */
  function drawBuildingB(ctx, x, y, scale) {
    const w = scale * 1.6;
    const h = scale * 2.1;
    const bx = x - w / 2;
    const by = y - h;

    // Call 1: Rooftop utility / HVAC penthouse
    const utW = w * 0.35, utH = h * 0.14;
    ctx.fillStyle = PALETTE.CHARCOAL_DARK;
    ctx.fillRect(x - utW * 0.5, by - utH, utW, utH);

    // Call 2: Main brutalist concrete mass
    ctx.fillStyle = PALETTE.CHARCOAL_LIGHT;
    ctx.fillRect(bx, by, w, h);

    // Call 3: Recessed center facade bay
    ctx.fillStyle = PALETTE.CHARCOAL_MID;
    ctx.fillRect(bx + w * 0.15, by + h * 0.08, w * 0.7, h * 0.92);

    // Call 4: Dirty off-white horizontal spandrel band
    const bandH = Math.max(2, h * 0.04);
    ctx.fillStyle = PALETTE.OFFWHITE_DIRTY;
    ctx.fillRect(bx, by + h * 0.48, w, bandH);

    // Call 5: Ground foundation base
    const baseH = Math.max(3, h * 0.06);
    ctx.fillStyle = PALETTE.ASPHALT_DARK;
    ctx.fillRect(bx, y - baseH, w, baseH);

    // Windows
    if (scale >= 12) {
      const cols = 4;
      const rows = 4;
      const marginX = w * 0.20;
      const marginTop = h * 0.14;
      const gridW = w - marginX * 2;
      const gridH = h - marginTop - baseH - h * 0.06;
      const winW = gridW / (cols * 1.5);
      const gapX = (gridW - winW * cols) / (cols - 1);
      const winH = gridH / (rows * 1.6);
      const gapY = (gridH - winH * rows) / (rows - 1);

      // Lit windows (deterministic)
      const isLit = (c, r) => (r === 0 && c === 1) || (r === 2 && c === 3) || (r === 3 && c === 0);

      // Call 6: Unlit windows
      ctx.fillStyle = PALETTE.WINDOW_DARK;
      ctx.beginPath();
      addWindowRects(ctx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY, (c, r) => !isLit(c, r));
      ctx.fill();

      // Call 7: Lit yellow windows
      ctx.fillStyle = PALETTE.YELLOW_MAIN;
      ctx.beginPath();
      addWindowRects(ctx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY, isLit);
      ctx.fill();
    }
  }

  /**
   * building-c: Tall slender high-rise monolith with antenna mast & beacon
   */
  function drawBuildingC(ctx, x, y, scale) {
    const w = scale * 0.85;
    const h = scale * 3.8;
    const bx = x - w / 2;
    const by = y - h;

    // Call 1: Rooftop antenna mast
    const mastH = scale * 0.45;
    ctx.strokeStyle = PALETTE.CHARCOAL_LIGHT;
    ctx.lineWidth = Math.max(1, scale * 0.02);
    ctx.beginPath();
    ctx.moveTo(x, by);
    ctx.lineTo(x, by - mastH);
    ctx.stroke();

    // Call 2: Red beacon light on mast tip
    ctx.fillStyle = PALETTE.BEACON_RED;
    const dotR = Math.max(1.5, scale * 0.02);
    ctx.fillRect(x - dotR, by - mastH - dotR, dotR * 2, dotR * 2);

    // Call 3: Main tower shaft
    ctx.fillStyle = PALETTE.CHARCOAL_MID;
    ctx.fillRect(bx, by, w, h);

    // Call 4: Right-side shadow facade
    ctx.fillStyle = PALETTE.CHARCOAL_DARK;
    ctx.fillRect(bx + w * 0.5, by, w * 0.5, h);

    // Call 5: Stepped rooftop crown
    ctx.fillStyle = PALETTE.CHARCOAL_LIGHT;
    ctx.fillRect(bx + w * 0.15, by - Math.max(2, h * 0.02), w * 0.7, Math.max(3, h * 0.025));

    // Windows
    if (scale >= 12) {
      const cols = 2;
      const rows = 8;
      const marginX = w * 0.18;
      const marginTop = h * 0.08;
      const gridW = w - marginX * 2;
      const gridH = h - marginTop - h * 0.08;
      const winW = gridW / (cols * 1.5);
      const gapX = (gridW - winW * cols) / (cols - 1);
      const winH = gridH / (rows * 1.6);
      const gapY = (gridH - winH * rows) / (rows - 1);

      const isLit = (c, r) => (r === 2 && c === 0) || (r === 5 && c === 1) || (r === 6 && c === 0);

      // Call 6: Dark windows
      ctx.fillStyle = PALETTE.WINDOW_DARK;
      ctx.beginPath();
      addWindowRects(ctx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY, (c, r) => !isLit(c, r));
      ctx.fill();

      // Call 7: Lit yellow windows
      ctx.fillStyle = PALETTE.YELLOW_MAIN;
      ctx.beginPath();
      addWindowRects(ctx, cols, rows, bx + marginX, by + marginTop, winW, winH, gapX, gapY, isLit);
      ctx.fill();
    }
  }

  /**
   * streetlight: Roadside highway mast with curved arm, luminaire, and pale light cast
   */
  function drawStreetlight(ctx, x, y, scale) {
    const h = scale * 1.9;
    const armW = scale * 0.35;
    const poleW = Math.max(1.5, scale * 0.035);

    // Call 1: Concrete base footing
    const footW = Math.max(4, scale * 0.1);
    const footH = Math.max(3, scale * 0.06);
    ctx.fillStyle = PALETTE.ASPHALT_DARK;
    ctx.fillRect(x - footW * 0.5, y - footH, footW, footH);

    // Call 2: Steel pole and curved outreach arm
    ctx.strokeStyle = PALETTE.CHARCOAL_LIGHT;
    ctx.lineWidth = poleW;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - footH);
    ctx.lineTo(x, y - h * 0.85);
    ctx.quadraticCurveTo(x, y - h, x + armW, y - h);
    ctx.stroke();

    // Luminaire position at arm end
    const lampX = x + armW;
    const lampY = y - h;
    const headW = Math.max(4, scale * 0.14);
    const headH = Math.max(2, scale * 0.045);

    // Call 3: Dark lamp fixture housing
    ctx.fillStyle = PALETTE.CHARCOAL_DARK;
    ctx.fillRect(lampX - headW * 0.3, lampY - headH * 0.5, headW, headH);

    // Call 4: Glowing lamp lens (pale yellow)
    ctx.fillStyle = PALETTE.YELLOW_PALE;
    const lensW = headW * 0.85;
    const lensH = Math.max(1.5, headH * 0.45);
    ctx.fillRect(lampX - headW * 0.25, lampY + headH * 0.4, lensW, lensH);

    // Call 5: Soft ambient yellow cone cast on ground (no shadowBlur, pure translucent fill)
    ctx.fillStyle = PALETTE.YELLOW_CONE;
    ctx.beginPath();
    ctx.moveTo(lampX + headW * 0.15, lampY + headH);
    ctx.lineTo(lampX - scale * 0.22, y);
    ctx.lineTo(lampX + scale * 0.35, y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * billboard: Blank dark panel with a yellow edge on steel trestle posts
   */
  function drawBillboard(ctx, x, y, scale) {
    const h = scale * 1.5;
    const bw = scale * 1.2;
    const bh = scale * 0.65;
    const by = y - h;
    const postW = Math.max(2, scale * 0.04);
    const postX1 = x - bw * 0.3;
    const postX2 = x + bw * 0.3 - postW;

    // Call 1: Steel support posts (both posts in one batch path)
    ctx.fillStyle = PALETTE.CHARCOAL_MID;
    ctx.beginPath();
    ctx.rect(postX1, by + bh, postW, h - bh);
    ctx.rect(postX2, by + bh, postW, h - bh);
    ctx.fill();

    // Call 2: Support truss cross-brace
    ctx.strokeStyle = PALETTE.CHARCOAL_DARK;
    ctx.lineWidth = Math.max(1, scale * 0.02);
    ctx.beginPath();
    ctx.moveTo(postX1, by + bh);
    ctx.lineTo(postX2 + postW, y);
    ctx.moveTo(postX2 + postW, by + bh);
    ctx.lineTo(postX1, y);
    ctx.stroke();

    // Call 3: Yellow outer edge/border of the billboard panel
    ctx.fillStyle = PALETTE.YELLOW_MAIN;
    ctx.fillRect(x - bw * 0.5, by, bw, bh);

    // Call 4: Blank dark panel interior (near-black/charcoal face)
    const borderThick = Math.max(1.5, scale * 0.025);
    ctx.fillStyle = PALETTE.CHARCOAL_DARK;
    ctx.fillRect(
      x - bw * 0.5 + borderThick,
      by + borderThick,
      bw - borderThick * 2,
      bh - borderThick * 2
    );

    // Call 5: Service catwalk at bottom of billboard panel
    const walkH = Math.max(2, scale * 0.035);
    ctx.fillStyle = PALETTE.ASPHALT_DARK;
    ctx.fillRect(x - bw * 0.54, by + bh, bw * 1.08, walkH);
  }

  /**
   * concrete-barrier: Heavy Jersey/K-rail concrete barrier with yellow hazard reflector
   */
  function drawConcreteBarrier(ctx, x, y, scale) {
    const w = scale * 0.75;
    const h = scale * 0.35;

    // Call 1: Ground contact shadow
    const shadH = Math.max(2, scale * 0.03);
    ctx.fillStyle = 'rgba(15, 16, 19, 0.4)';
    ctx.fillRect(x - w * 0.52, y - shadH * 0.5, w * 1.04, shadH);

    // Call 2: Main concrete barrier profile (sloped Jersey barrier shape)
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

    // Call 3: Top beveled cap highlight (lighter asphalt grey)
    const topH = Math.max(1.5, h * 0.18);
    ctx.fillStyle = PALETTE.ASPHALT_LIGHT;
    ctx.fillRect(x - w * 0.38, y - h, w * 0.76, topH);

    // Call 4: Vertical expansion joints between concrete blocks
    ctx.strokeStyle = PALETTE.CHARCOAL_DARK;
    ctx.lineWidth = Math.max(1, scale * 0.015);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.16, y - h);
    ctx.lineTo(x - w * 0.16, y);
    ctx.moveTo(x + w * 0.16, y - h);
    ctx.lineTo(x + w * 0.16, y);
    ctx.stroke();

    // Call 5: Yellow center hazard reflector tab
    const rw = Math.max(3, w * 0.14);
    const rh = Math.max(2, h * 0.24);
    ctx.fillStyle = PALETTE.YELLOW_MAIN;
    ctx.fillRect(x - rw * 0.5, y - h * 0.70, rw, rh);

    // Call 6: Reflector border/grime
    ctx.strokeStyle = PALETTE.CHARCOAL_DARK;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - rw * 0.5, y - h * 0.70, rw, rh);
  }

  // -------------------------------------------------------------
  // Car Renderers (Rear View)
  // -------------------------------------------------------------

  /**
   * Helper: batch draw dual tires and undercarriage shadow in a single call
   */
  function drawTiresAndShadow(ctx, leftX, rightX, tireW, tireH, underX, underY, underW, underH) {
    ctx.fillStyle = PALETTE.CHARCOAL_DARK;
    ctx.beginPath();
    ctx.rect(leftX, underY - (tireH - underH), tireW, tireH);
    ctx.rect(rightX, underY - (tireH - underH), tireW, tireH);
    ctx.rect(underX, underY, underW, underH);
    ctx.fill();
  }

  /**
   * Helper: draw tail lights with subtle shadowBlur and immediate reset
   * Both lights batched into a single fill call!
   */
  function drawTailLights(ctx, leftX, rightX, y, width, height, blur) {
    ctx.shadowBlur = blur;
    ctx.shadowColor = PALETTE.TAILLIGHT_RED;
    ctx.fillStyle = PALETTE.TAILLIGHT_RED;
    ctx.beginPath();
    ctx.rect(leftX, y, width, height);
    ctx.rect(rightX, y, width, height);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /**
   * sedan: Muted dark red passenger car, sleek cabin, dark rear window, two tail lights
   */
  function drawSedan(ctx, x, y, scale) {
    const w = scale * 0.5;
    const h = scale * 0.38;

    // Call 1: Undercarriage shadow & dual tires (batched into 1 fill)
    drawTiresAndShadow(
      ctx,
      x - w * 0.48,
      x + w * 0.30,
      w * 0.18,
      h * 0.25,
      x - w * 0.38,
      y - h * 0.16,
      w * 0.76,
      h * 0.16
    );

    // Call 2: Dark rear bumper / diffuser
    ctx.fillStyle = PALETTE.CHARCOAL_MID;
    ctx.fillRect(x - w * 0.48, y - h * 0.34, w * 0.96, h * 0.20);

    // Call 3: Dirty off-white license plate
    const plateW = w * 0.22, plateH = Math.max(1.5, h * 0.10);
    ctx.fillStyle = PALETTE.OFFWHITE_DIRTY;
    ctx.fillRect(x - plateW * 0.5, y - h * 0.28, plateW, plateH);

    // Call 4: Main rear body (muted dark red)
    ctx.fillStyle = PALETTE.CAR_RED;
    ctx.fillRect(x - w * 0.50, y - h * 0.65, w, h * 0.38);

    // Call 5: Cabin greenhouse / pillars (tapers toward roof)
    ctx.fillStyle = PALETTE.CAR_RED_DARK;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.44, y - h * 0.64);
    ctx.lineTo(x - w * 0.35, y - h);
    ctx.lineTo(x + w * 0.35, y - h);
    ctx.lineTo(x + w * 0.44, y - h * 0.64);
    ctx.closePath();
    ctx.fill();

    // Call 6: Dark tinted rear window
    ctx.fillStyle = PALETTE.WINDOW_DARK;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.38, y - h * 0.65);
    ctx.lineTo(x - w * 0.30, y - h * 0.94);
    ctx.lineTo(x + w * 0.30, y - h * 0.94);
    ctx.lineTo(x + w * 0.38, y - h * 0.65);
    ctx.closePath();
    ctx.fill();

    // Call 7: Two red tail lights with tiny shadowBlur (batched into 1 fill)
    const tlw = Math.max(2, w * 0.16);
    const tlh = Math.max(2, h * 0.14);
    const blur = Math.min(6, Math.max(2, scale * 0.07));
    drawTailLights(
      ctx,
      x - w * 0.48,
      x + w * 0.48 - tlw,
      y - h * 0.62,
      tlw,
      tlh,
      blur
    );
  }

  /**
   * taxi: Gritty yellow cab with illuminated roof sign, dark rear window, two tail lights
   */
  function drawTaxi(ctx, x, y, scale) {
    const w = scale * 0.5;
    const h = scale * 0.38;

    // Call 1: Undercarriage shadow & dual tires
    drawTiresAndShadow(
      ctx,
      x - w * 0.48,
      x + w * 0.30,
      w * 0.18,
      h * 0.25,
      x - w * 0.38,
      y - h * 0.16,
      w * 0.76,
      h * 0.16
    );

    // Call 2: Dark rear bumper / diffuser
    ctx.fillStyle = PALETTE.CHARCOAL_MID;
    ctx.fillRect(x - w * 0.48, y - h * 0.34, w * 0.96, h * 0.20);

    // Call 3: Dirty yellow license plate
    const plateW = w * 0.22, plateH = Math.max(1.5, h * 0.10);
    ctx.fillStyle = PALETTE.YELLOW_AMBER;
    ctx.fillRect(x - plateW * 0.5, y - h * 0.28, plateW, plateH);

    // Call 4: Main taxi body (gritty yellow)
    ctx.fillStyle = PALETTE.CAR_TAXI;
    ctx.fillRect(x - w * 0.50, y - h * 0.65, w, h * 0.38);

    // Call 5: Cabin greenhouse & roof pillars
    ctx.fillStyle = PALETTE.CAR_TAXI_DARK;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.44, y - h * 0.64);
    ctx.lineTo(x - w * 0.35, y - h);
    ctx.lineTo(x + w * 0.35, y - h);
    ctx.lineTo(x + w * 0.44, y - h * 0.64);
    ctx.closePath();
    ctx.fill();

    // Call 6: Dark tinted rear window
    ctx.fillStyle = PALETTE.WINDOW_DARK;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.38, y - h * 0.65);
    ctx.lineTo(x - w * 0.30, y - h * 0.94);
    ctx.lineTo(x + w * 0.30, y - h * 0.94);
    ctx.lineTo(x + w * 0.38, y - h * 0.65);
    ctx.closePath();
    ctx.fill();

    // Call 7: Taxi roof sign box bracket / rim
    const signW = Math.max(6, w * 0.30);
    const signH = Math.max(3, h * 0.18);
    const signY = y - h - signH;
    ctx.fillStyle = PALETTE.CHARCOAL_DARK;
    ctx.fillRect(x - signW * 0.5 - 1, signY - 1, signW + 2, signH + 2);

    // Call 8: Taxi sign face (illuminated)
    ctx.fillStyle = PALETTE.YELLOW_PALE;
    ctx.fillRect(x - signW * 0.5, signY, signW, signH);

    // Call 9: Two red tail lights with tiny shadowBlur
    const tlw = Math.max(2, w * 0.16);
    const tlh = Math.max(2, h * 0.14);
    const blur = Math.min(6, Math.max(2, scale * 0.07));
    drawTailLights(
      ctx,
      x - w * 0.48,
      x + w * 0.48 - tlw,
      y - h * 0.62,
      tlw,
      tlh,
      blur
    );
  }

  /**
   * van: Tall boxy cargo/passenger van with split rear door seam and high tail lights
   */
  function drawVan(ctx, x, y, scale) {
    const w = scale * 0.52;
    const h = scale * 0.48;

    // Call 1: Undercarriage shadow & dual heavy tires
    drawTiresAndShadow(
      ctx,
      x - w * 0.48,
      x + w * 0.30,
      w * 0.18,
      h * 0.22,
      x - w * 0.38,
      y - h * 0.15,
      w * 0.76,
      h * 0.15
    );

    // Call 2: Dark heavy rear bumper
    ctx.fillStyle = PALETTE.CHARCOAL_MID;
    ctx.fillRect(x - w * 0.49, y - h * 0.30, w * 0.98, h * 0.16);

    // Call 3: License plate
    const plateW = w * 0.20, plateH = Math.max(1.5, h * 0.08);
    ctx.fillStyle = PALETTE.OFFWHITE_DIRTY;
    ctx.fillRect(x - plateW - w * 0.04, y - h * 0.25, plateW, plateH);

    // Call 4: Main van body (muted dark slate/blue)
    ctx.fillStyle = PALETTE.CAR_VAN;
    ctx.fillRect(x - w * 0.48, y - h, w * 0.96, h * 0.74);

    // Call 5: Split rear doors center seam
    ctx.strokeStyle = PALETTE.CHARCOAL_DARK;
    ctx.lineWidth = Math.max(1, scale * 0.015);
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x, y - h * 0.26);
    ctx.stroke();

    // Call 6: Twin dark rear windows (left & right split doors, batched in 1 fill)
    const winW = w * 0.34;
    const winH = h * 0.28;
    const winY = y - h * 0.92;
    ctx.fillStyle = PALETTE.WINDOW_DARK;
    ctx.beginPath();
    ctx.rect(x - w * 0.40, winY, winW, winH);
    ctx.rect(x + w * 0.06, winY, winW, winH);
    ctx.fill();

    // Call 7: Vertical pillar tail lights with tiny shadowBlur
    const tlw = Math.max(2, w * 0.09);
    const tlh = Math.max(4, h * 0.32);
    const blur = Math.min(6, Math.max(2, scale * 0.07));
    drawTailLights(
      ctx,
      x - w * 0.47,
      x + w * 0.47 - tlw,
      y - h * 0.68,
      tlw,
      tlh,
      blur
    );
  }

  /**
   * truck: Large heavy industrial box lorry with mudflaps, dark rear window, bumper tail lights
   */
  function drawTruck(ctx, x, y, scale) {
    const w = scale * 0.56;
    const h = scale * 0.62;

    // Call 1: Ground shadow, heavy mudflaps & underride bar (batched into 1 fill)
    ctx.fillStyle = PALETTE.CHARCOAL_DARK;
    ctx.beginPath();
    ctx.rect(x - w * 0.48, y - h * 0.22, w * 0.20, h * 0.22);
    ctx.rect(x + w * 0.28, y - h * 0.22, w * 0.20, h * 0.22);
    ctx.rect(x - w * 0.44, y - h * 0.14, w * 0.88, Math.max(2, h * 0.06));
    ctx.fill();

    // Call 2: Main cargo container box (dark charcoal/slate)
    ctx.fillStyle = PALETTE.CAR_TRUCK;
    ctx.fillRect(x - w * 0.50, y - h, w, h * 0.82);

    // Call 3: Inner door frame / roll-up door recess
    ctx.fillStyle = PALETTE.CAR_TRUCK_DARK;
    ctx.fillRect(x - w * 0.44, y - h * 0.94, w * 0.88, h * 0.72);

    // Call 4: Dark rear cab/transom window
    ctx.fillStyle = PALETTE.WINDOW_DARK;
    ctx.fillRect(x - w * 0.34, y - h * 0.88, w * 0.68, h * 0.20);

    // Call 5: Vertical locking bar down center
    ctx.strokeStyle = PALETTE.ASPHALT_LIGHT;
    ctx.lineWidth = Math.max(1, scale * 0.02);
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.92);
    ctx.lineTo(x, y - h * 0.24);
    ctx.stroke();

    // Call 6: Yellow hazard reflective strip on lower bumper
    const stripH = Math.max(1.5, h * 0.05);
    ctx.fillStyle = PALETTE.YELLOW_MAIN;
    ctx.fillRect(x - w * 0.44, y - h * 0.23, w * 0.88, stripH);

    // Call 7: Heavy tail light clusters on bumper with tiny shadowBlur
    const tlw = Math.max(3, w * 0.16);
    const tlh = Math.max(2, h * 0.10);
    const blur = Math.min(6, Math.max(2, scale * 0.07));
    drawTailLights(
      ctx,
      x - w * 0.44,
      x + w * 0.44 - tlw,
      y - h * 0.21,
      tlw,
      tlh,
      blur
    );
  }

  // -------------------------------------------------------------
  // Public Global Sprites Object
  // -------------------------------------------------------------

  const Sprites = {
    PALETTE,
    SCENERY_TYPES,
    CAR_TYPES,

    /**
     * drawScenery: Draws roadside urban scenery with canvas shapes only.
     *
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
     * @param {string} type - 'building-a' | 'building-b' | 'building-c' | 'streetlight' | 'billboard' | 'concrete-barrier'
     * @param {number} x - Bottom-centre ground X coordinate
     * @param {number} y - Bottom-centre ground Y coordinate
     * @param {number} scale - Road half-width in pixels at this depth
     */
    drawScenery(ctx, type, x, y, scale) {
      if (!ctx) return;

      // Robust argument normalization: handle (ctx, x, y, scale, type) if passed
      if (typeof type === 'number' && typeof arguments[4] === 'string') {
        const actualType = arguments[4];
        const actualScale = y;
        y = x;
        x = type;
        scale = actualScale;
        type = actualType;
      }

      if (!scale || scale <= 0) return;

      switch (type) {
        case 'building-a':
          drawBuildingA(ctx, x, y, scale);
          break;
        case 'building-b':
          drawBuildingB(ctx, x, y, scale);
          break;
        case 'building-c':
          drawBuildingC(ctx, x, y, scale);
          break;
        case 'streetlight':
          drawStreetlight(ctx, x, y, scale);
          break;
        case 'billboard':
          drawBillboard(ctx, x, y, scale);
          break;
        case 'concrete-barrier':
        case 'barrier': // compatibility fallback
          drawConcreteBarrier(ctx, x, y, scale);
          break;
        default:
          // Fallback to building-a
          drawBuildingA(ctx, x, y, scale);
          break;
      }
    },

    /**
     * drawCar: Draws rear view of vehicle with canvas shapes only.
     *
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
     * @param {string|object} type - 'sedan' | 'taxi' | 'van' | 'truck' (or car object with .type)
     * @param {number} x - Bottom-centre ground X coordinate
     * @param {number} y - Bottom-centre ground Y coordinate
     * @param {number} scale - Road half-width in pixels at this depth
     */
    drawCar(ctx, type, x, y, scale) {
      if (!ctx) return;

      // Robust argument normalization: handle (ctx, x, y, scale, car/type) if passed
      if (typeof type === 'number' && (typeof arguments[4] === 'string' || typeof arguments[4] === 'object')) {
        const actualCar = arguments[4];
        const actualScale = y;
        y = x;
        x = type;
        scale = actualScale;
        type = actualCar;
      }

      if (!scale || scale <= 0) return;

      const carType = (typeof type === 'object' && type !== null) ? type.type : type;

      switch (carType) {
        case 'sedan':
        case 'car': // compatibility fallback
          drawSedan(ctx, x, y, scale);
          break;
        case 'taxi':
          drawTaxi(ctx, x, y, scale);
          break;
        case 'van':
          drawVan(ctx, x, y, scale);
          break;
        case 'truck':
          drawTruck(ctx, x, y, scale);
          break;
        default:
          // Fallback to sedan
          drawSedan(ctx, x, y, scale);
          break;
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Sprites;
  }
  global.Sprites = Sprites;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
