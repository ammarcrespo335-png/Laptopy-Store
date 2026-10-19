/**
 * Laptopy hero laptop: a procedural 3D laptop rendered with three.js (WebGL).
 *
 * Everything is modelled in code (no downloaded model): rounded aluminium body, keyboard with real key layout,
 * speaker grills, trackpad, hinge, lid with a glass-covered screen. Realism comes from studio image-based
 * lighting (RoomEnvironment), physically based materials, a soft contact shadow and light that spills from the
 * screen onto the keyboard.
 *
 * Timeline (seconds):
 *   0.0  scene fades in, laptop closed
 *   0.8  lid starts to open (3.8s, eased)       4.6 fully open (+ a tiny natural settle)
 *   3.5  screen switches on, light spills on the keys
 *   4.6  logo appears   5.2 store name appears   6.5 idle: slow camera drift + pointer parallax
 *
 * Build:  npm run build:scene   ->  public/vendor/laptop-scene.js  (one minified file, committed)
 */
import {
  ACESFilmicToneMapping, AdditiveBlending, CanvasTexture, CircleGeometry, CylinderGeometry, DirectionalLight, DoubleSide,
  Group, InstancedMesh, MathUtils, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Object3D,
  PerspectiveCamera, PlaneGeometry, PMREMGenerator, PointLight, Scene, Shape, ShapeGeometry, SRGBColorSpace, Vector3,
  WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------------------------------------------------------------- dimensions (1 unit ~ 2.3 cm)
const W = 13.2; // body width
const D = 9.2; // body depth
const BASE_H = 0.5; // body height
const LID_T = 0.24; // lid thickness
const LID_D = D - 0.12; // lid depth
const PIVOT_Y = BASE_H + 0.1; // hinge height (lid sits just above the keys when closed)
const PIVOT_Z = -D / 2 + 0.06;
const OPEN_DEG = 106;

// ---------------------------------------------------------------- timeline
const T = { fade: 0.9, open0: 0.8, openLen: 3.8, screen0: 3.5, screenLen: 1.1, logo0: 4.6, name0: 5.2, idle: 6.5 };

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (t, start, len) => clamp01((t - start) / len);

// ---------------------------------------------------------------- helpers
function roundedRect(w, h, r) {
  const s = new Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Flat rounded rectangle whose UVs cover 0..1 (so a texture maps onto it exactly). */
function roundedPlane(w, h, r) {
  const g = new ShapeGeometry(roundedRect(w, h, r), 8);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return g;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function canvasTexture(canvas, renderer) {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

/** The Laptopy mark (white circle + laptop), drawn with the 2D canvas. `s` = diameter. */
function drawMark(ctx, cx, cy, s, { dark = false } = {}) {
  const k = s / 100;
  ctx.save();
  ctx.translate(cx - s / 2, cy - s / 2);
  ctx.scale(k, k);
  ctx.fillStyle = dark ? '#0b1730' : '#ffffff';
  ctx.beginPath(); ctx.arc(50, 50, 50, 0, Math.PI * 2); ctx.fill();
  const rr = (x, y, w, h, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
  rr(26, 22, 48, 34, 5, dark ? '#ffffff' : '#0b1730');
  rr(31, 27, 38, 24, 2.5, dark ? '#8fb4ff' : '#1c3566');
  ctx.fillStyle = dark ? '#ffffff' : '#0b1730';
  ctx.beginPath(); ctx.moveTo(16, 62); ctx.lineTo(84, 62); ctx.lineTo(78, 70); ctx.lineTo(22, 70); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- screen content
const SCREEN_W = W - 0.56;
const SCREEN_H = LID_D - 0.85;
const SCREEN_PX = 1800;
const SCREEN_PY = Math.round(SCREEN_PX * (SCREEN_H / SCREEN_W));

function drawScreen(ctx, { on, logo, name, storeName }) {
  const w = SCREEN_PX, h = SCREEN_PY;
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  if (on <= 0.001) return;

  ctx.globalAlpha = on;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0d1c3d'); bg.addColorStop(1, '#050a16');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, w * 0.55);
  glow.addColorStop(0, `rgba(79,140,255,${0.42 * (0.5 + 0.5 * logo)})`); glow.addColorStop(1, 'rgba(79,140,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

  if (logo > 0) {
    const s = h * 0.27 * (0.8 + 0.2 * easeOut(logo));
    ctx.globalAlpha = on * easeOut(logo);
    ctx.shadowColor = 'rgba(79,140,255,0.75)'; ctx.shadowBlur = s * 0.35;
    drawMark(ctx, w / 2, h * 0.4 + (1 - easeOut(logo)) * h * 0.02, s);
    ctx.shadowBlur = 0;
  }
  if (name > 0) {
    const a = easeOut(name);
    ctx.globalAlpha = on * a;
    const fs = h * 0.15;
    ctx.font = `700 ${fs}px Sora, 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(-0.045 * fs + (1 - a) * fs * 0.12).toFixed(2)}px`;
    const g = ctx.createLinearGradient(0, h * 0.64, 0, h * 0.78);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#a9c2f5');
    ctx.fillStyle = g;
    ctx.fillText(storeName, w / 2, h * 0.72 + (1 - a) * h * 0.02);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- the model
const KEY_ROWS = [
  { h: 0.62, keys: Array(15).fill(1) },
  { h: 1, keys: [...Array(13).fill(1), 2] },
  { h: 1, keys: [1.5, ...Array(12).fill(1), 1.5] },
  { h: 1, keys: [1.75, ...Array(11).fill(1), 2.25] },
  { h: 1, keys: [2.25, ...Array(10).fill(1), 2.75] },
  { h: 1, keys: [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25] },
];

function buildLaptop(renderer, storeName) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const root = new Group();

  // ----- materials
  const aluminium = track(new MeshPhysicalMaterial({ color: 0xaab2c0, metalness: 1, roughness: 0.4, clearcoat: 0.12, clearcoatRoughness: 0.45, envMapIntensity: 1.0 }));
  const keyMat = track(new MeshStandardMaterial({ color: 0x080a0f, roughness: 0.62, metalness: 0.1, envMapIntensity: 0.3 }));
  const wellMat = track(new MeshStandardMaterial({ color: 0x06080c, roughness: 0.85, metalness: 0 }));
  const bezelMat = track(new MeshStandardMaterial({ color: 0x04060a, roughness: 0.35, metalness: 0.2 }));
  const padMat = track(new MeshPhysicalMaterial({ color: 0x9ea7b6, metalness: 1, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 1.0 }));
  const grooveMat = track(new MeshStandardMaterial({ color: 0x6c7484, metalness: 0.9, roughness: 0.55 }));
  const hingeMat = track(new MeshStandardMaterial({ color: 0x15181f, metalness: 0.9, roughness: 0.4 }));
  const glassMat = track(new MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, depthWrite: false }));

  // ----- body
  const body = new Mesh(track(new RoundedBoxGeometry(W, BASE_H, D, 6, 0.15)), aluminium);
  body.position.y = BASE_H / 2;
  root.add(body);

  // keyboard well + keys
  const wellW = W - 1.2, wellD = 4.95, wellZ = -D / 2 + 0.55 + wellD / 2;
  const topY = BASE_H + 0.004;
  const well = new Mesh(track(new RoundedBoxGeometry(wellW, 0.02, wellD, 3, 0.01)), wellMat);
  well.position.set(0, topY, wellZ);
  root.add(well);

  const glowMat = track(new MeshBasicMaterial({ color: 0x9cc2ff, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
  const glowPlane = new Mesh(track(new PlaneGeometry(wellW - 0.2, wellD - 0.2)), glowMat);
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.set(0, topY + 0.013, wellZ);
  root.add(glowPlane);

  const pitch = (wellW - 0.5) / 15;
  const rowsH = KEY_ROWS.reduce((s, r) => s + r.h, 0) * pitch;
  let zCursor = wellZ - rowsH / 2;
  const KEY_H = 0.075, GAP = 0.1;
  const byWidth = new Map();
  for (const row of KEY_ROWS) {
    const rowH = row.h * pitch;
    let x = -wellW / 2 + 0.25;
    for (const u of row.keys) {
      const list = byWidth.get(`${u}|${row.h}`) ?? { u, h: row.h, spots: [] };
      list.spots.push([x + (u * pitch) / 2, zCursor + rowH / 2]);
      byWidth.set(`${u}|${row.h}`, list);
      x += u * pitch;
    }
    zCursor += rowH;
  }
  const dummy = new Object3D();
  for (const { u, h, spots } of byWidth.values()) {
    const geo = track(new RoundedBoxGeometry(u * pitch - GAP, KEY_H, h * pitch - GAP, 2, 0.05));
    const mesh = new InstancedMesh(geo, keyMat, spots.length);
    spots.forEach(([x, z], i) => {
      dummy.position.set(x, topY + 0.01 + KEY_H / 2, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    root.add(mesh);
  }

  // trackpad
  const padW = 5.9, padD = 3.3, padZ = D / 2 - 0.5 - padD / 2;
  const groove = new Mesh(track(new RoundedBoxGeometry(padW + 0.1, 0.012, padD + 0.1, 3, 0.16)), grooveMat);
  groove.position.set(0, BASE_H + 0.002, padZ);
  root.add(groove);
  const pad = new Mesh(track(new RoundedBoxGeometry(padW, 0.02, padD, 3, 0.15)), padMat);
  pad.position.set(0, BASE_H + 0.006, padZ);
  root.add(pad);

  // speaker grills (two columns of tiny holes on each side of the keys)
  const holeGeo = track(new CylinderGeometry(0.034, 0.034, 0.02, 10));
  const holes = new InstancedMesh(holeGeo, wellMat, 4 * 26);
  let hi = 0;
  for (const side of [-1, 1]) {
    for (const col of [0, 1]) {
      for (let i = 0; i < 26; i++) {
        dummy.position.set(side * (wellW / 2 + 0.3 + col * 0.13), BASE_H + 0.002, wellZ - wellD / 2 + 0.1 + i * 0.18);
        dummy.updateMatrix();
        holes.setMatrixAt(hi++, dummy.matrix);
      }
    }
  }
  root.add(holes);

  // hinge
  const hinge = new Mesh(track(new CylinderGeometry(0.17, 0.17, W - 2.6, 24)), hingeMat);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, PIVOT_Y - 0.04, PIVOT_Z + 0.02);
  root.add(hinge);

  // ----- lid (rotates around the hinge)
  const lid = new Group();
  lid.position.set(0, PIVOT_Y, PIVOT_Z);
  root.add(lid);

  const slab = new Mesh(track(new RoundedBoxGeometry(W, LID_T, LID_D, 6, 0.12)), aluminium);
  slab.position.set(0, LID_T / 2, LID_D / 2);
  lid.add(slab);

  const bezel = new Mesh(track(roundedPlane(W - 0.2, LID_D - 0.2, 0.22)), bezelMat);
  bezel.rotation.x = Math.PI / 2;
  bezel.position.set(0, -0.003, LID_D / 2);
  lid.add(bezel);

  const screenCanvas = makeCanvas(SCREEN_PX, SCREEN_PY);
  const screenCtx = screenCanvas.getContext('2d');
  const screenTex = canvasTexture(screenCanvas, renderer);
  track(screenTex);
  const screenMat = track(new MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  const screen = new Mesh(track(roundedPlane(SCREEN_W, SCREEN_H, 0.16)), screenMat);
  screen.rotation.x = Math.PI / 2;
  screen.position.set(0, -0.007, 0.55 + SCREEN_H / 2);
  lid.add(screen);

  const glass = new Mesh(track(roundedPlane(W - 0.2, LID_D - 0.2, 0.22)), glassMat);
  glass.rotation.x = Math.PI / 2;
  glass.position.set(0, -0.011, LID_D / 2);
  lid.add(glass);

  // a soft diagonal reflection that slowly drifts across the glass
  const sheenCanvas = makeCanvas(256, 64);
  const shc = sheenCanvas.getContext('2d');
  const sh = shc.createLinearGradient(0, 0, 256, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.9)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  shc.fillStyle = sh; shc.fillRect(0, 0, 256, 64);
  const sheenTex = track(new CanvasTexture(sheenCanvas));
  const sheenMat = track(new MeshBasicMaterial({ map: sheenTex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
  const sheen = new Mesh(track(new PlaneGeometry(3.2, LID_D)), sheenMat);
  sheen.rotation.x = Math.PI / 2;
  sheen.rotation.y = 0.5; // diagonal
  sheen.position.set(0, -0.0125, LID_D / 2);
  lid.add(sheen);

  const cam = new Mesh(track(new CircleGeometry(0.05, 20)), track(new MeshStandardMaterial({ color: 0x151b28, metalness: 0.8, roughness: 0.25 })));
  cam.rotation.x = Math.PI / 2;
  cam.position.set(0, -0.0085, LID_D - 0.17);
  lid.add(cam);

  // backlit logo on the lid's cover
  const logoCanvas = makeCanvas(512, 512);
  drawMark(logoCanvas.getContext('2d'), 256, 256, 500, { dark: true });
  const logoTex = canvasTexture(logoCanvas, renderer);
  track(logoTex);
  const logoMat = track(new MeshStandardMaterial({ map: logoTex, transparent: true, metalness: 0.6, roughness: 0.22, emissive: 0x9fbfff, emissiveMap: logoTex, emissiveIntensity: 0, envMapIntensity: 1.2 }));
  const logo = new Mesh(track(new PlaneGeometry(2.3, 2.3)), logoMat);
  logo.rotation.x = -Math.PI / 2;
  logo.position.set(0, LID_T + 0.003, LID_D / 2);
  lid.add(logo);

  // light that spills from the screen onto the keyboard
  const spill = new PointLight(0x7aa7ff, 0, 40, 1.6);
  spill.position.set(0, -1.6, LID_D * 0.62);
  lid.add(spill);

  // soft contact shadow on the ground
  const shadowCanvas = makeCanvas(256, 256);
  const sctx = shadowCanvas.getContext('2d');
  const sg = sctx.createRadialGradient(128, 128, 8, 128, 128, 126);
  sg.addColorStop(0, 'rgba(0,0,0,1)'); sg.addColorStop(0.5, 'rgba(0,0,0,0.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = sg; sctx.fillRect(0, 0, 256, 256);
  const shadowTex = track(new CanvasTexture(shadowCanvas));
  const shadowMat = track(new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }));
  const shadow = new Mesh(track(new PlaneGeometry(1, 1)), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.01;
  root.add(shadow);

  // ----- animation state
  let lastKey = '';
  const drawn = { on: -1, logo: -1, name: -1 };

  function pose(t) {
    const open = easeInOut(seg(t, T.open0, T.openLen));
    const settle = t > T.open0 + T.openLen ? Math.sin((t - T.open0 - T.openLen) * 7) * Math.exp(-(t - T.open0 - T.openLen) * 3.2) * 0.012 : 0;
    const angle = MathUtils.degToRad(OPEN_DEG) * (open + settle);
    lid.rotation.x = -angle;

    // screen: a short flicker, then steady
    const sRaw = easeOut(seg(t, T.screen0, T.screenLen));
    const flicker = t > T.screen0 && t < T.screen0 + 0.5 ? 1 - 0.35 * Math.max(0, Math.sin((t - T.screen0) * 38)) : 1;
    const on = sRaw * flicker * (open > 0.55 ? 1 : 0);
    const logoP = seg(t, T.logo0, 1.2);
    const nameP = seg(t, T.name0, 1.1);
    const q = (v) => Math.round(v * 200) / 200;
    if (q(on) !== drawn.on || q(logoP) !== drawn.logo || q(nameP) !== drawn.name) {
      Object.assign(drawn, { on: q(on), logo: q(logoP), name: q(nameP) });
      drawScreen(screenCtx, { on, logo: logoP, name: nameP, storeName });
      screenTex.needsUpdate = true;
    }
    spill.intensity = 20 * on * (0.6 + 0.4 * open);
    glowMat.opacity = 0.2 * on * easeOut(seg(t, T.screen0 + 0.6, 1.6));
    logoMat.emissiveIntensity = 1.4 * on;

    // shadow grows as the lid opens
    shadow.scale.set(W * 1.7, D * (1.75 + 0.45 * open), 1);
    shadow.position.z = -0.25 - 0.55 * open;
    shadowMat.opacity = 0.8 + 0.2 * open;

    const sweep = (((t - T.idle) % 11) + 11) % 11 / 11; // 0..1 every 11 seconds
    sheen.position.x = -W * 0.7 + sweep * W * 1.4;
    sheenMat.opacity = t > T.idle ? 0.06 * on * Math.sin(sweep * Math.PI) : 0;
    lastKey = String(angle);
    return { open, on };
  }

  return { root, pose, lid, dispose: () => disposables.forEach((d) => d.dispose?.()) };
}

// ---------------------------------------------------------------- scene, camera and loop
export async function mountLaptop(canvas, { storeName = 'Laptopy', reducedMotion = false, time = null, onSlow = null } = {}) {
  const frozenRender = time !== null && time !== ''; // a fixed moment is requested (screenshots, poster)
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: frozenRender });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.8;

  const key = new DirectionalLight(0xffffff, 0.9);
  key.position.set(-9, 15, 11);
  scene.add(key);
  const rim = new DirectionalLight(0x6f9dff, 2.4);
  rim.position.set(11, 7, -12);
  scene.add(rim);
  const fill = new DirectionalLight(0xbcd0ff, 0.3);
  fill.position.set(10, 4, 12);
  scene.add(fill);

  try { await document.fonts?.load(`700 64px Sora`); } catch { /* the fallback font is fine */ }

  const laptop = buildLaptop(renderer, storeName);
  scene.add(laptop.root);

  const camera = new PerspectiveCamera(26, 1, 5, 120);
  const target = new Vector3(0, 3.4, 0.2);
  const look = new Vector3();
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

  const onPointer = (e) => {
    pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  function frame(t) {
    const { open } = laptop.pose(t);

    // camera: starts above and a little further away, settles into a 3/4 view, then drifts very slowly
    const arrive = easeOut(seg(t, 0.4, 5.5));
    const drift = t > T.idle ? Math.sin((t - T.idle) * 0.32) : 0;
    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;
    const az = MathUtils.degToRad(-33 + 9 * arrive + 5 * drift + pointer.sx * 4);
    const el = MathUtils.degToRad(27 - 5 * arrive + 1.2 * drift - pointer.sy * 2.5);
    const aspect = camera.aspect;
    const vf = MathUtils.degToRad(camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    const radius = 8.2 / Math.sin(Math.min(vf, hf) / 2) * (1.06 - 0.06 * arrive);
    camera.position.set(
      target.x + radius * Math.cos(el) * Math.sin(az),
      target.y + radius * Math.sin(el),
      target.z + radius * Math.cos(el) * Math.cos(az),
    );
    look.copy(target).y += 0.25 * open;
    camera.lookAt(look);
    renderer.render(scene, camera);
  }

  const resize = () => {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!running) frame(frozen ?? T.idle + 2);
  };

  let dprCap = 2;
  const frozen = time !== null && time !== '' && !Number.isNaN(Number(time)) ? Number(time) : reducedMotion ? T.idle + 2 : null;
  let running = false;
  let raf = 0;
  let paused = false;
  let t0 = performance.now();
  let pausedAt = 0;

  // Slow device protection (no graphics acceleration): first lower the resolution, then give up and let the page
  // show the still picture instead of a stuttering animation.
  let windowStart = performance.now();
  let windowFrames = 0;
  let slowWindows = 0;
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    frame((now - t0) / 1000);
    windowFrames += 1;
    if (now - windowStart >= 2000) {
      const average = (now - windowStart) / windowFrames;
      windowStart = now;
      windowFrames = 0;
      slowWindows = average > 45 ? slowWindows + 1 : 0;
      if (slowWindows === 1) { dprCap = 1; resize(); }
      else if (slowWindows >= 2) { cancelAnimationFrame(raf); onSlow?.(); }
    }
  };

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  if (frozen !== null) {
    frame(frozen);
  } else {
    running = true;
    raf = requestAnimationFrame(tick);
  }

  return {
    pause() {
      if (!running || paused) return;
      paused = true;
      pausedAt = performance.now();
      cancelAnimationFrame(raf);
    },
    resume() {
      if (!running || !paused) return;
      paused = false;
      t0 += performance.now() - pausedAt; // the timeline continues where it stopped
      windowStart = performance.now();
      windowFrames = 0;
      raf = requestAnimationFrame(tick);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      laptop.dispose();
      env.dispose?.();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
}
