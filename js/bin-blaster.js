(function () {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────────────────
  const CW = 420, CH = 640, BASE_FPS = 60;
  const STORAGE_KEY = 'binBlasterStateV1';

  const BLOCK_W = 32, BLOCK_H = 32, ROW_H = 28;
  const COLS_EVEN = 11, COLS_ODD = 10;
  const GRID_LEFT = Math.floor((CW - COLS_EVEN * BLOCK_W) / 2); // 34
  const GRID_TOP = 16;
  const GRID_ZONE_BOTTOM = 440;
  const LAUNCHER_X = 210, LAUNCHER_Y = 510;
  const LAUNCH_SPEED = 460;
  const MAX_AIM_DEG = 75;
  const MAX_AIM_RAD = MAX_AIM_DEG * Math.PI / 180;
  const MAX_ROWS = 13;
  const VOICE_POOL = 8;
  const MAX_PARTICLES = 300;

  // ─── Block types ──────────────────────────────────────────────────────────────
  const TYPES = {
    GRAY:        { color: '#9aa5ad', label: 'CONCRETE',       special: false },
    RED:         { color: '#c83a3a', label: 'HAZ TAG',         special: false },
    YELLOW:      { color: '#d4a936', label: 'LIFT POINT',      special: false },
    GREEN:       { color: '#3aa055', label: 'INSPECTED',       special: false },
    BLUE:        { color: '#3a78c8', label: 'GSE PROP',        special: false },
    DO_NOT_MOVE: { color: '#1a1a1a', label: 'DO NOT MOVE',     special: true,  indestructible: true },
    HEAVY:       { color: '#6a6a6a', label: 'TARE: 8,800 LB',  special: true,  maxHp: 2 },
    LOX:         { color: '#dff0f8', label: 'LOX',             special: true,  chain: true },
    STEVES:      { color: '#2a2a2a', label: "STEVE'S",         special: true,  immune: true },
    RAINBOW:     { color: '#ff88cc', label: 'WILDCARD',        special: true,  wild: true },
  };
  const STD = ['GRAY', 'RED', 'YELLOW', 'GREEN', 'BLUE'];

  const INITIALS_DELAY_MS = 3500; // ms to show win/loss screen before prompting initials
  const ROW_FILL_DENSITY = 0.78;  // fraction of cells populated when a new row drops

  const BLOCK_LABELS = [
    'BLOCK 7-B', '4,400 LB', 'STILL HERE', 'JIM SAYS LEAVE IT', 'SEE FRANK',
    'PROPERTY GSE', 'LAST INS: NEVER', 'MOVE LATER', 'FRANK KNOWS', 'CALL BOB',
    'TEMP STORAGE', 'NOT MY PROB', 'ASK STEVE', 'NO REALLY', '2019 LEFTOVER',
  ];

  // ─── Missions ─────────────────────────────────────────────────────────────────
  const MISSIONS = [
    { id: 0, name: 'NG-1 (Blue Ring)',   sub: 'Tutorial',           colors: 3, dropInterval: 15, timeLimit: 240,      specials: [],                                            startRows: 4, patch: '🔵' },
    { id: 1, name: 'NG-2 (ESCAPADE)',    sub: 'Intro: Do Not Move', colors: 4, dropInterval: 12, timeLimit: 210,      specials: ['DO_NOT_MOVE'],                               startRows: 5, patch: '🛰️' },
    { id: 2, name: 'NG-3 (BlueBird-7)', sub: 'Intro: Heavy Block',  colors: 5, dropInterval: 10, timeLimit: 180,      specials: ['DO_NOT_MOVE', 'HEAVY'],                      startRows: 6, patch: '🐦' },
    { id: 3, name: 'NG-7 (Fictional)',  sub: 'Intro: LOX Tank',     colors: 5, dropInterval: 9,  timeLimit: 180,      specials: ['DO_NOT_MOVE', 'HEAVY', 'LOX'],               startRows: 7, patch: '💧' },
    { id: 4, name: 'NG-X (Lunar)',      sub: 'All Blocks',           colors: 5, dropInterval: 8,  timeLimit: 150,      specials: ['DO_NOT_MOVE', 'HEAVY', 'LOX', 'RAINBOW'],    startRows: 8, patch: '🌙' },
    { id: 5, name: 'Pad Walkdown',      sub: 'Target Order',         colors: 5, dropInterval: 9,  timeLimit: 180,      specials: ['DO_NOT_MOVE', 'HEAVY', 'LOX', 'RAINBOW'],    startRows: 7, patch: '🚶' },
    { id: 6, name: 'Hurricane Recovery',sub: 'Falling Debris',       colors: 5, dropInterval: 7,  timeLimit: 150,      specials: ['DO_NOT_MOVE', 'HEAVY', 'LOX', 'RAINBOW'],    startRows: 6, patch: '🌀' },
    { id: 7, name: 'Endless',           sub: 'Survival Mode',        colors: 5, dropInterval: 12, timeLimit: Infinity, specials: ['DO_NOT_MOVE', 'HEAVY', 'LOX', 'RAINBOW'],    startRows: 5, patch: '♾️' },
  ];

  // ─── Power-ups ────────────────────────────────────────────────────────────────
  const PUPS = {
    CRANE:      { name: 'Crane',          icon: '🏗',  desc: '3-wide blaster', auto: true },
    PAD_COFFEE: { name: 'Pad Rat Coffee', icon: '☕', desc: '50% slow 5s',    auto: false, dur: 5 },
    LASER:      { name: 'Laser Level',    icon: '📏', desc: 'Full trajectory', auto: false, dur: 8 },
    CAT988:     { name: 'CAT 988',        icon: '🚜', desc: 'Clear bottom row',auto: false },
    FOD:        { name: 'FOD Sweep',      icon: '🧹', desc: '3×3 clear',      auto: true },
    SCRUB:      { name: 'Mission Scrub',  icon: '⏱',  desc: '+30 seconds',    auto: false, rare: true },
  };

  // ─── State ────────────────────────────────────────────────────────────────────
  let S = {
    screen: 'mission_select',
    mission: 0,
    score: 0,
    combo: 0,
    timer: 240,
    dropTimer: 0,
    powerupsUsed: false,
    grid: [],
    proj: null,
    launcher: { current: 'GRAY', currentHue: null, next: 'GRAY', nextHue: null, angle: 0 },
    powerTray: [],
    activePup: null,
    falling: [],
    winAnim: 0,
    rocket: { y: CH + 60, vy: -180 },
    hiScores: {},
    stars: {},
    unlocked: { 0: true },
    initialsEntry: { score: 0, missionId: 0, chars: ['A', 'A', 'A'], cursor: 0 },
    canvas: null,
    ctx: null,
    wrapper: null,
    lastTs: 0,
    paused: false,
    muted: false,
    stevesQuipTimer: 10,
    debrisTimer: 5,
    targetColors: [],
    padWalkIdx: 0,
    endlessDropAccel: 0,
    hoveredMission: -1,
  };

  // ─── Audio ────────────────────────────────────────────────────────────────────
  const Audio = (() => {
    let actx = null;
    let master = null;
    let voices = [];
    let musicTimer = null;
    let musicMode = '';
    let musicIdx = 0;

    const musicPatterns = {
      idle:    [[196, 0.36, 'sawtooth'], [220, 0.42, 'sawtooth'], [null, 0.28], [174.61, 0.52, 'triangle']],
      playing: [[110, 0.2, 'triangle'], [146.83, 0.2, 'triangle'], [196, 0.3, 'square'], [null, 0.2]],
      urgent:  [[98, 0.12, 'square'], [110, 0.12, 'square'], [null, 0.08], [123.47, 0.12, 'square']],
      win:     [[261.63, 0.14, 'triangle'], [329.63, 0.14, 'triangle'], [392, 0.14, 'triangle'], [523.25, 0.34, 'sawtooth']],
      loss:    [[196, 0.2, 'triangle'], [164.81, 0.25, 'triangle'], [130.81, 0.4, 'triangle']],
    };

    function ensure() {
      if (S.muted) return false;
      if (actx) return true;
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        master = actx.createGain();
        master.gain.value = 0.18;
        master.connect(actx.destination);
        voices = Array.from({ length: VOICE_POOL }, () => {
          const gain = actx.createGain();
          gain.gain.value = 0.0001;
          gain.connect(master);
          return { gain, releaseAt: 0 };
        });
      } catch (e) {
        actx = null;
        return false;
      }
      return true;
    }

    function nowT() { return actx ? actx.currentTime : 0; }

    function resume() {
      if (!ensure()) return;
      if (actx.state === 'suspended') actx.resume();
    }

    function getVoice(t) {
      let oldest = voices[0];
      for (const v of voices) {
        if (v.releaseAt < t) return v;
        if (v.releaseAt < oldest.releaseAt) oldest = v;
      }
      return oldest;
    }

    function tone(freq, dur, type, gain, slideTo) {
      if (!actx || !master || !freq) return;
      const t = nowT();
      const v = getVoice(t);
      const osc = actx.createOscillator();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(Math.max(0.0001, gain || 0.08), t);
      v.gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.04, dur));
      osc.connect(v.gain);
      osc.start(t);
      osc.stop(t + dur + 0.04);
      v.releaseAt = t + dur;
    }

    function noise(dur, gain, lowpassFreq) {
      if (!actx || !master) return;
      const n = Math.max(1, Math.floor(actx.sampleRate * dur));
      const buf = actx.createBuffer(1, n, actx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.85;
      const src = actx.createBufferSource();
      const env = actx.createGain();
      const lp = actx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpassFreq || 850;
      src.buffer = buf;
      const t = nowT();
      env.gain.setValueAtTime(Math.max(0.0001, gain || 0.05), t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.04, dur));
      src.connect(lp);
      lp.connect(env);
      env.connect(master);
      src.start();
      src.stop(t + dur + 0.02);
    }

    function stopMusic() {
      if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
    }

    function setMood(mode) {
      if (S.muted) { stopMusic(); return; }
      resume();
      if (!actx || (musicMode === mode && musicTimer)) return;
      stopMusic();
      musicMode = mode;
      musicIdx = 0;
      const pattern = musicPatterns[mode] || musicPatterns.idle;
      const step = () => {
        if (!actx || S.muted || musicMode !== mode) return;
        const [freq, dur, type] = pattern[musicIdx % pattern.length];
        musicIdx++;
        if (freq) tone(freq, dur, type || 'triangle', 0.04);
        musicTimer = setTimeout(step, dur * 1000);
      };
      step();
    }

    function SFX(name) {
      if (!ensure()) return;
      resume();
      switch (name) {
        case 'fire':      tone(280, 0.06, 'square', 0.04, 580); break;
        case 'land':      noise(0.08, 0.04, 900); tone(90, 0.1, 'sine', 0.03, 60); break;
        case 'match3':    tone(523, 0.1, 'triangle', 0.05); setTimeout(() => tone(659, 0.15, 'triangle', 0.04), 60); break;
        case 'match4':    tone(523, 0.1, 'triangle', 0.05); setTimeout(() => tone(659, 0.12, 'triangle', 0.04), 50); setTimeout(() => tone(784, 0.2, 'triangle', 0.05), 100); break;
        case 'cascade':   tone(880, 0.08, 'triangle', 0.04); setTimeout(() => tone(1047, 0.12, 'triangle', 0.04), 80); break;
        case 'pup_earn':  tone(880, 0.06, 'square', 0.04); setTimeout(() => tone(1047, 0.12, 'triangle', 0.05), 70); break;
        case 'pup_use':   noise(0.14, 0.04, 2000); break;
        case 'lox_chain': noise(0.3, 0.07, 300); setTimeout(() => tone(440, 0.2, 'triangle', 0.06), 100); break;
        case 'heavy_hit': noise(0.12, 0.06, 400); tone(80, 0.15, 'sawtooth', 0.04, 40); break;
        case 'warning':   tone(440, 0.1, 'square', 0.04); break;
        case 'scrub':     tone(311, 0.3, 'sawtooth', 0.04, 196); setTimeout(() => tone(196, 0.4, 'sawtooth', 0.04, 123), 200); break;
        case 'launch':    tone(261, 0.1, 'triangle', 0.05); setTimeout(() => tone(329, 0.1, 'triangle', 0.05), 100); setTimeout(() => tone(392, 0.1, 'triangle', 0.05), 200); setTimeout(() => tone(523, 0.3, 'sawtooth', 0.05), 300); break;
        case 'steves':    tone(220, 0.2, 'triangle', 0.04, 180); break;
        case 'wall':      tone(320, 0.03, 'square', 0.02); break;
        case 'swap':      tone(660, 0.04, 'square', 0.03); break;
        case 'drop_row':  noise(0.1, 0.03, 600); tone(130, 0.15, 'sine', 0.03, 100); break;
      }
    }

    return { ensure, resume, tone, noise, setMood, SFX, stopMusic };
  })();

  // ─── Particles ────────────────────────────────────────────────────────────────
  const pPool = Array.from({ length: MAX_PARTICLES }, () => ({ active: false }));

  function spawnParticle(opts) {
    for (let i = 0; i < pPool.length; i++) {
      if (!pPool[i].active) {
        Object.assign(pPool[i], {
          active: true, x: 0, y: 0, vx: 0, vy: 0,
          life: 1, decay: 0.025, size: 3, grow: 0, alpha: 1, color: '255,255,255',
        }, opts);
        return;
      }
    }
  }

  function spawnBurst(cx, cy, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i / count) + Math.random() * 0.5;
      const s = speed * (0.5 + Math.random() * 0.8);
      spawnParticle({
        x: cx, y: cy,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        color, size: 2 + Math.random() * 3,
        decay: 0.02 + Math.random() * 0.03, grow: -0.06,
      });
    }
  }

  function updateParticles(dt) {
    for (const p of pPool) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size = Math.max(0, p.size + p.grow * dt * BASE_FPS);
      p.life -= p.decay * dt * BASE_FPS;
      if (p.life <= 0 || p.size <= 0) p.active = false;
    }
  }

  function drawParticles(ctx) {
    for (const p of pPool) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * p.alpha));
      ctx.fillStyle = `rgb(${p.color})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function clearParticles() {
    for (const p of pPool) p.active = false;
  }

  // ─── Utilities ────────────────────────────────────────────────────────────────
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function randInt(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[randInt(arr.length)]; }

  function hexToRGB(hex) {
    const h = hex.replace('#', '');
    return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
  }

  function shuffled(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ─── Grid helpers ─────────────────────────────────────────────────────────────
  function cellX(col, row) {
    return GRID_LEFT + col * BLOCK_W + (row % 2 === 1 ? BLOCK_W / 2 : 0) + BLOCK_W / 2;
  }
  function cellY(row) {
    return GRID_TOP + row * ROW_H + BLOCK_H / 2;
  }
  function maxCol(row) {
    return row % 2 === 0 ? COLS_EVEN : COLS_ODD;
  }

  function getCell(r, c) {
    if (!S.grid[r]) return undefined;
    return S.grid[r][c];
  }
  function setCell(r, c, val) {
    if (!S.grid[r]) S.grid[r] = [];
    S.grid[r][c] = val;
  }

  function nearestCell(px, py) {
    let best = null, bestDist = Infinity;
    const rowMin = Math.max(0, Math.floor((py - GRID_TOP - BLOCK_H) / ROW_H));
    const rowMax = Math.min(MAX_ROWS - 1, Math.ceil((py - GRID_TOP + BLOCK_H) / ROW_H));
    for (let r = rowMin; r <= rowMax; r++) {
      const cols = maxCol(r);
      for (let c = 0; c < cols; c++) {
        const d = Math.hypot(px - cellX(c, r), py - cellY(r));
        if (d < bestDist) { bestDist = d; best = { row: r, col: c }; }
      }
    }
    return best;
  }

  // Hex neighbors — even/odd row offset grid
  function neighbors(row, col) {
    const pairs = row % 2 === 0
      ? [[-1, col - 1], [-1, col], [+1, col - 1], [+1, col], [0, col - 1], [0, col + 1]]
      : [[-1, col],     [-1, col + 1], [+1, col], [+1, col + 1], [0, col - 1], [0, col + 1]];
    return pairs
      .map(([dr, c]) => ({ row: row + dr, col: c }))
      .filter(({ row: r, col: c }) => r >= 0 && r < MAX_ROWS && c >= 0 && c < maxCol(r));
  }

  // ─── Grid initialization ──────────────────────────────────────────────────────
  function missionColors(mDef) {
    return STD.slice(0, mDef.colors);
  }

  function randomBlockType(mDef) {
    const colors = missionColors(mDef);
    if (mDef.specials.length > 0 && Math.random() < 0.08) {
      return pick(mDef.specials);
    }
    return pick(colors);
  }

  function makeBlock(typeKey, rainbowHue) {
    const def = TYPES[typeKey] || TYPES.GRAY;
    const isRainbow = typeKey === 'RAINBOW';
    return {
      type: typeKey,
      hp: def.maxHp || 1,
      label: pick(BLOCK_LABELS),
      cracked: false,
      flashTimer: 0,
      rainbowHue: isRainbow ? ((rainbowHue === null || rainbowHue === undefined) ? rand(0, 360) : rainbowHue) : null,
    };
  }

  function initGrid(mDef) {
    S.grid = [];
    for (let r = 0; r < MAX_ROWS; r++) {
      S.grid[r] = [];
      for (let c = 0; c < maxCol(r); c++) {
        S.grid[r][c] = null;
      }
    }
    for (let r = 0; r < mDef.startRows; r++) {
      const cols = maxCol(r);
      for (let c = 0; c < cols; c++) {
        S.grid[r][c] = makeBlock(randomBlockType(mDef));
      }
    }
    // Place STEVES once in row 1-3
    const sRow = 1 + randInt(Math.min(3, Math.max(1, mDef.startRows - 1)));
    S.grid[sRow][randInt(maxCol(sRow))] = makeBlock('STEVES');

    const colors = missionColors(mDef);
    S.launcher.current = pick(colors);
    S.launcher.currentHue = null;
    S.launcher.next = pick(colors);
    S.launcher.nextHue = null;
    S.launcher.angle = 0;
  }

  function randomNextBlock(mDef) {
    const colors = missionColors(mDef);
    if (mDef.specials.includes('RAINBOW') && Math.random() < 0.04) return 'RAINBOW';
    return pick(colors);
  }

  // ─── Match / cascade ──────────────────────────────────────────────────────────
  function findGroup(row, col) {
    const target = getCell(row, col);
    if (!target) return [];
    const def = TYPES[target.type];
    if (def && (def.immune || def.indestructible)) return [];

    const targetType = target.type;
    const visited = new Set();
    const queue = [{ row, col }];
    const group = [];

    while (queue.length) {
      const { row: r, col: c } = queue.shift();
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const cell = getCell(r, c);
      if (!cell) continue;
      const cellDef = TYPES[cell.type];
      if (cellDef && (cellDef.immune || cellDef.indestructible)) continue;

      const isWild = (cellDef && cellDef.wild) || (TYPES[targetType] && TYPES[targetType].wild);
      const isMatch = cell.type === targetType || cell.type === 'RAINBOW' || isWild;
      if (!isMatch) continue;

      group.push({ row: r, col: c });
      for (const nb of neighbors(r, c)) {
        if (!visited.has(`${nb.row},${nb.col}`)) queue.push(nb);
      }
    }
    return group;
  }

  function findDisconnected() {
    const reachable = new Set();
    const queue = [];
    for (let c = 0; c < maxCol(0); c++) {
      if (getCell(0, c)) {
        const key = `0,${c}`;
        reachable.add(key);
        queue.push({ row: 0, col: c });
      }
    }
    while (queue.length) {
      const { row: r, col: c } = queue.shift();
      for (const nb of neighbors(r, c)) {
        const k = `${nb.row},${nb.col}`;
        if (!reachable.has(k) && getCell(nb.row, nb.col)) {
          reachable.add(k);
          queue.push(nb);
        }
      }
    }
    const disc = [];
    for (let r = 1; r < MAX_ROWS; r++) {
      for (let c = 0; c < maxCol(r); c++) {
        const cell = getCell(r, c);
        if (cell && !reachable.has(`${r},${c}`) && cell.type !== 'STEVES') {
          disc.push({ row: r, col: c });
        }
      }
    }
    return disc;
  }

  function calcScore(matchSize, cascade) {
    const perBlock = matchSize >= 6 ? 300 : matchSize >= 5 ? 200 : matchSize >= 4 ? 150 : 100;
    return Math.round(perBlock * matchSize * Math.pow(1.5, cascade));
  }

  let _resolveDepth = 0;

  function resolveMatches(landedRow, landedCol, cascade) {
    cascade = cascade || 0;
    if (_resolveDepth > 8) return;
    _resolveDepth++;

    const group = findGroup(landedRow, landedCol);

    if (group.length >= 3) {
      S.score += calcScore(group.length, cascade);
      S.combo++;

      const toClear = [];
      const heavyDamaged = [];

      for (const { row: r, col: c } of group) {
        const cell = getCell(r, c);
        if (!cell) continue;
        if (cell.type === 'HEAVY' && cell.hp > 1) {
          cell.hp--;
          cell.cracked = true;
          cell.flashTimer = 0.3;
          heavyDamaged.push({ row: r, col: c });
          Audio.SFX('heavy_hit');
        } else {
          toClear.push({ row: r, col: c });
        }
      }

      // LOX chain expansion
      const loxExtra = [];
      const loxExtraSet = new Set(toClear.map(x => `${x.row},${x.col}`));
      for (const { row: r, col: c } of toClear) {
        const cell = getCell(r, c);
        if (!cell || cell.type !== 'LOX') continue;
        for (let dr = -3; dr <= 3; dr++) {
          for (let dc = -3; dc <= 3; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= MAX_ROWS || nc < 0 || nc >= maxCol(nr)) continue;
            const nb = getCell(nr, nc);
            if (!nb) continue;
            const nbDef = TYPES[nb.type];
            if (nbDef && (nbDef.indestructible || nbDef.immune)) continue;
            const key = `${nr},${nc}`;
            if (!loxExtraSet.has(key)) {
              loxExtra.push({ row: nr, col: nc });
              loxExtraSet.add(key);
            }
          }
        }
      }
      if (loxExtra.length) Audio.SFX('lox_chain');

      const allClear = [...toClear, ...loxExtra];
      for (const { row: r, col: c } of allClear) {
        const cell = getCell(r, c);
        if (!cell) continue;
        const def = TYPES[cell.type];
        if (def && (def.indestructible || def.immune)) continue;
        spawnBurst(cellX(c, r), cellY(r), hexToRGB(def ? def.color : '#aaa'), 8, 80);
        S.grid[r][c] = null;
      }

      if (group.length >= 4) Audio.SFX('match4');
      else Audio.SFX('match3');
      if (cascade > 0) Audio.SFX('cascade');

      // Drop disconnected blocks
      const disc = findDisconnected();
      for (const { row: r, col: c } of disc) {
        const cell = getCell(r, c);
        if (!cell) continue;
        const def = TYPES[cell.type];
        S.falling.push({
          block: { ...cell },
          x: cellX(c, r), y: cellY(r),
          vx: rand(-40, 40), vy: rand(-30, 10),
          rot: 0, rotV: rand(-3, 3), alpha: 1,
        });
        S.grid[r][c] = null;
        spawnBurst(cellX(c, r), cellY(r), def ? hexToRGB(def.color) : '180,180,180', 4, 50);
      }

      // Power-up drop chance
      if (Math.random() < 0.12 && S.powerTray.length < 3) {
        S.powerTray.push(pick(Object.keys(PUPS)));
        Audio.SFX('pup_earn');
      }

      // Mission 5 progress check
      if (S.mission === 5) checkPadWalkdown();

      // Cascade: check new groups formed by neighbors of cleared cells
      if (cascade < 5) {
        const checked = new Set();
        for (const { row: r, col: c } of allClear) {
          for (const nb of neighbors(r, c)) {
            const k = `${nb.row},${nb.col}`;
            if (!checked.has(k) && getCell(nb.row, nb.col)) {
              checked.add(k);
              resolveMatches(nb.row, nb.col, cascade + 1);
            }
          }
        }
      }

      checkWinCondition();
    } else {
      if (cascade === 0) S.combo = 0;
    }

    _resolveDepth--;
  }

  // ─── Win / loss ───────────────────────────────────────────────────────────────
  function checkWinCondition() {
    const mDef = MISSIONS[S.mission];
    if (mDef.timeLimit === Infinity) return;

    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < maxCol(r); c++) {
        const cell = getCell(r, c);
        if (!cell) continue;
        const def = TYPES[cell.type];
        if (!def) continue;
        if (!def.special) return; // still has clearable blocks
      }
    }
    triggerWin();
  }

  function triggerWin() {
    S.screen = 'win';
    S.winAnim = 0;
    S.rocket = { y: CH + 60, vy: -180 };
    Audio.setMood('win');
    Audio.SFX('launch');

    const mDef = MISSIONS[S.mission];
    const timeRatio = S.timer / mDef.timeLimit;
    let stars = 1;
    if (timeRatio >= 0.25) stars = 2;
    if (timeRatio >= 0.50 && !S.powerupsUsed) stars = 3;
    S.stars[S.mission] = Math.max(S.stars[S.mission] || 0, stars);

    if (S.mission + 1 < MISSIONS.length) S.unlocked[S.mission + 1] = true;
    checkHiScore(S.score, S.mission);
    saveState();
    updateHiScoreDisplay();
  }

  function triggerLoss() {
    if (S.screen === 'loss') return;
    S.screen = 'loss';
    Audio.setMood('loss');
    Audio.SFX('scrub');
    checkHiScore(S.score, S.mission);
    saveState();
  }

  function checkHiScore(score, missionId) {
    const key = String(missionId);
    if (!S.hiScores[key]) S.hiScores[key] = [];
    const list = S.hiScores[key];
    if (list.length < 10 || score > (list[list.length - 1] || { score: 0 }).score) {
      S.initialsEntry = { score, missionId, chars: ['A', 'A', 'A'], cursor: 0, entryId: null };
      // Capture screen state now to avoid acting on a later screen transition
      const screenAtCheck = S.screen;
      setTimeout(() => {
        if (S.screen === screenAtCheck) S.screen = 'initials';
      }, INITIALS_DELAY_MS);
    }
  }

  function confirmInitials() {
    const { score, missionId, chars } = S.initialsEntry;
    const name = chars.join('');
    const key = String(missionId);
    if (!S.hiScores[key]) S.hiScores[key] = [];
    const entryId = Date.now() + Math.random();
    S.initialsEntry.entryId = entryId;
    S.hiScores[key].push({ name, score, id: entryId });
    S.hiScores[key].sort((a, b) => b.score - a.score);
    if (S.hiScores[key].length > 10) S.hiScores[key].length = 10;
    saveState();
    S.screen = 'leaderboard';
  }

  // ─── Row drop ─────────────────────────────────────────────────────────────────
  function dropRow(mDef) {
    // Shift all rows down by 1
    for (let r = MAX_ROWS - 1; r > 0; r--) {
      S.grid[r] = S.grid[r - 1] ? [...S.grid[r - 1]] : [];
    }
    // New row at top
    S.grid[0] = [];
    const cols = maxCol(0);
    const colors = missionColors(mDef);
    for (let c = 0; c < cols; c++) {
      S.grid[0][c] = Math.random() < ROW_FILL_DENSITY ? makeBlock(randomBlockType(mDef)) : null;
    }
    Audio.SFX('drop_row');

    // Game over check: any block at or below grid zone
    for (let r = 0; r < MAX_ROWS; r++) {
      if (cellY(r) + BLOCK_H / 2 > GRID_ZONE_BOTTOM) {
        for (let c = 0; c < maxCol(r); c++) {
          if (getCell(r, c)) { triggerLoss(); return; }
        }
      }
    }
  }

  // ─── Projectile ───────────────────────────────────────────────────────────────
  function fireBlock() {
    if (S.proj) return;
    const mDef = MISSIONS[S.mission];
    const vx = Math.sin(S.launcher.angle) * LAUNCH_SPEED;
    const vy = -Math.cos(S.launcher.angle) * LAUNCH_SPEED;
    S.proj = {
      x: LAUNCHER_X, y: LAUNCHER_Y - 16,
      vx, vy,
      type: S.launcher.current,
      rainbowHue: S.launcher.currentHue,
      hp: TYPES[S.launcher.current] ? (TYPES[S.launcher.current].maxHp || 1) : 1,
    };
    S.launcher.current = S.launcher.next;
    S.launcher.currentHue = S.launcher.nextHue;
    S.launcher.next = randomNextBlock(mDef);
    S.launcher.nextHue = S.launcher.next === 'RAINBOW' ? rand(0, 360) : null;
    Audio.SFX('fire');
  }

  function updateProj(dt) {
    if (!S.proj) return;
    const speedMul = (S.activePup && S.activePup.key === 'PAD_COFFEE') ? 0.5 : 1.0;
    S.proj.x += S.proj.vx * dt * speedMul;
    S.proj.y += S.proj.vy * dt * speedMul;

    const margin = BLOCK_W / 2;
    if (S.proj.x < margin) {
      S.proj.x = margin; S.proj.vx = Math.abs(S.proj.vx); Audio.SFX('wall');
    }
    if (S.proj.x > CW - margin) {
      S.proj.x = CW - margin; S.proj.vx = -Math.abs(S.proj.vx); Audio.SFX('wall');
    }
    // Stuck at top
    if (S.proj.y < GRID_TOP + BLOCK_H / 2) {
      landProjectile(S.proj, -1, -1); return;
    }
    // Check collision with grid blocks
    for (let r = 0; r < MAX_ROWS; r++) {
      const cy = cellY(r);
      if (Math.abs(cy - S.proj.y) > BLOCK_H * 1.5) continue;
      for (let c = 0; c < maxCol(r); c++) {
        if (!getCell(r, c)) continue;
        if (Math.hypot(cellX(c, r) - S.proj.x, cy - S.proj.y) < BLOCK_W * 0.82) {
          landProjectile(S.proj, r, c); return;
        }
      }
    }
    // Off screen below
    if (S.proj.y > GRID_ZONE_BOTTOM + 40) S.proj = null;
  }

  function landProjectile(proj, hitRow, hitCol) {
    const snapX = proj.x, snapY = proj.y;
    let target = null;

    if (hitRow >= 0) {
      const nbs = neighbors(hitRow, hitCol);
      let best = null, bestDist = Infinity;
      for (const { row: r, col: c } of nbs) {
        if (getCell(r, c) != null) continue;
        const d = Math.hypot(cellX(c, r) - snapX, cellY(r) - snapY);
        if (d < bestDist) { bestDist = d; best = { row: r, col: c }; }
      }
      // Also try the hit cell itself if empty (shouldn't happen, but fallback)
      if (!best && !getCell(hitRow, hitCol)) best = { row: hitRow, col: hitCol };
      target = best;
    }

    if (!target) {
      // Snap to closest empty cell overall
      let best = null, bestDist = Infinity;
      for (let r = 0; r < MAX_ROWS; r++) {
        for (let c = 0; c < maxCol(r); c++) {
          if (getCell(r, c) != null) continue;
          const d = Math.hypot(cellX(c, r) - snapX, cellY(r) - snapY);
          if (d < bestDist && d < BLOCK_W * 2) { bestDist = d; best = { row: r, col: c }; }
        }
      }
      target = best;
    }

    S.proj = null;
    if (!target) return;

    const { row: tr, col: tc } = target;
    if (cellY(tr) + BLOCK_H / 2 >= GRID_ZONE_BOTTOM) { triggerLoss(); return; }

    const def = TYPES[proj.type];
    setCell(tr, tc, makeBlock(proj.type, proj.rainbowHue));
    Audio.SFX('land');

    // Indestructible blocks placed but don't trigger matches
    if (def && def.indestructible) return;

    _resolveDepth = 0;
    resolveMatches(tr, tc, 0);
  }

  // ─── Power-up activation ──────────────────────────────────────────────────────
  function activatePowerup(idx) {
    if (idx < 0 || idx >= S.powerTray.length) return;
    const key = S.powerTray[idx];
    const pDef = PUPS[key];
    if (!pDef) return;
    S.powerTray.splice(idx, 1);
    S.powerupsUsed = true;
    Audio.SFX('pup_use');

    switch (key) {
      case 'CRANE':
        S.activePup = { key, timer: 0 };
        break;
      case 'PAD_COFFEE':
        S.activePup = { key, timer: pDef.dur };
        break;
      case 'LASER':
        S.activePup = { key, timer: pDef.dur };
        break;
      case 'CAT988':
        // Clear the bottom-most occupied row
        for (let r = MAX_ROWS - 1; r >= 0; r--) {
          let hasBlock = false;
          for (let c = 0; c < maxCol(r); c++) {
            if (getCell(r, c)) { hasBlock = true; break; }
          }
          if (hasBlock) {
            for (let c = 0; c < maxCol(r); c++) {
              const cell = getCell(r, c);
              if (!cell) continue;
              const cdef = TYPES[cell.type];
              if (cdef && (cdef.indestructible || cdef.immune)) continue;
              spawnBurst(cellX(c, r), cellY(r), hexToRGB(cdef ? cdef.color : '#aaa'), 8, 80);
              S.grid[r][c] = null;
            }
            break;
          }
        }
        checkWinCondition();
        break;
      case 'FOD': {
        // 3×3 clear around center of the grid
        const targetRow = Math.floor(MAX_ROWS / 3);
        const targetCol = Math.floor(maxCol(targetRow) / 2);
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const r2 = targetRow + dr, c2 = targetCol + dc;
            if (r2 < 0 || r2 >= MAX_ROWS || c2 < 0 || c2 >= maxCol(r2)) continue;
            const cell2 = getCell(r2, c2);
            if (!cell2) continue;
            const cdef = TYPES[cell2.type];
            if (cdef && (cdef.indestructible || cdef.immune)) continue;
            spawnBurst(cellX(c2, r2), cellY(r2), hexToRGB(cdef ? cdef.color : '#aaa'), 8, 80);
            S.grid[r2][c2] = null;
          }
        }
        checkWinCondition();
        break;
      }
      case 'SCRUB':
        S.timer = Math.min(S.timer + 30, MISSIONS[S.mission].timeLimit === Infinity ? 9999 : MISSIONS[S.mission].timeLimit);
        break;
    }
  }

  function swapBlock() {
    const tmp = S.launcher.current;
    const tmpHue = S.launcher.currentHue;
    S.launcher.current = S.launcher.next;
    S.launcher.currentHue = S.launcher.nextHue;
    S.launcher.next = tmp;
    S.launcher.nextHue = tmpHue;
    Audio.SFX('swap');
  }

  // ─── Mission 5: Pad Walkdown ──────────────────────────────────────────────────
  function checkPadWalkdown() {
    if (S.mission !== 5 || !S.targetColors.length) return;
    const target = S.targetColors[S.padWalkIdx];
    if (!target) return;
    let found = false;
    for (let r = 0; r < MAX_ROWS && !found; r++) {
      for (let c = 0; c < maxCol(r) && !found; c++) {
        const cell = getCell(r, c);
        if (cell && cell.type === target) found = true;
      }
    }
    if (!found && S.padWalkIdx < S.targetColors.length - 1) S.padWalkIdx++;
  }

  // ─── Update ───────────────────────────────────────────────────────────────────
  function update(dt) {
    const mDef = MISSIONS[S.mission];

    // Timer countdown
    if (mDef.timeLimit !== Infinity) {
      S.timer -= dt;
      if (S.timer <= 0) { S.timer = 0; triggerLoss(); return; }
      if (S.timer <= 60) {
        Audio.setMood('urgent');
        if (S.timer <= 30 && Math.floor(S.timer + dt) !== Math.floor(S.timer)) Audio.SFX('warning');
      }
    }

    // Auto drop row
    let dropInterval = mDef.dropInterval;
    if (mDef.id === 7) dropInterval = Math.max(4, 12 - S.endlessDropAccel * 0.5);
    S.dropTimer -= dt;
    if (S.dropTimer <= 0) {
      S.dropTimer = dropInterval;
      dropRow(mDef);
      if (mDef.id === 7) S.endlessDropAccel++;
    }

    updateProj(dt);

    // Active timed powerup countdown
    if (S.activePup && PUPS[S.activePup.key] && PUPS[S.activePup.key].dur) {
      S.activePup.timer -= dt;
      if (S.activePup.timer <= 0) S.activePup = null;
    }

    // Falling block physics
    for (let i = S.falling.length - 1; i >= 0; i--) {
      const f = S.falling[i];
      f.vy += 320 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.rotV * dt;
      f.alpha -= dt * 1.5;
      if (f.alpha <= 0 || f.y > CH + 60) S.falling.splice(i, 1);
    }

    updateParticles(dt);

    // Steve's quip periodic SFX
    S.stevesQuipTimer -= dt;
    if (S.stevesQuipTimer <= 0) {
      S.stevesQuipTimer = rand(10, 22);
      outer: for (let r = 0; r < MAX_ROWS; r++) {
        for (let c = 0; c < maxCol(r); c++) {
          const cell = getCell(r, c);
          if (cell && cell.type === 'STEVES') { Audio.SFX('steves'); break outer; }
        }
      }
    }

    // Mission 6: Hurricane debris
    if (mDef.id === 6) {
      S.debrisTimer -= dt;
      if (S.debrisTimer <= 0) {
        S.debrisTimer = 5;
        const count = 2 + randInt(2);
        for (let i = 0; i < count; i++) {
          const c = randInt(maxCol(0));
          if (!getCell(0, c)) S.grid[0][c] = makeBlock(pick(missionColors(mDef)));
        }
      }
    }
  }

  // ─── Aim helpers ──────────────────────────────────────────────────────────────
  function updateAim(px, py) {
    const dx = px - LAUNCHER_X;
    const dy = py - LAUNCHER_Y;
    if (Math.abs(dy) < 4 && Math.abs(dx) < 4) return;
    S.launcher.angle = clamp(Math.atan2(dx, -dy), -MAX_AIM_RAD, MAX_AIM_RAD);
  }

  // ─── Drawing helpers ──────────────────────────────────────────────────────────
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawButton(ctx, x, y, w, h, label, borderColor, bg) {
    ctx.fillStyle = bg || 'rgba(20,24,30,0.9)';
    roundRect(ctx, x, y, w, h, 5);
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 5);
    ctx.stroke();
    ctx.fillStyle = borderColor;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }

  // ─── Block drawing ────────────────────────────────────────────────────────────
  function drawBlock(ctx, x, y, typeKey, hp, cracked, label, flashT, scale, rainbowHue) {
    scale = scale || 1;
    const w = BLOCK_W * scale, h = BLOCK_H * scale;
    const def = TYPES[typeKey] || TYPES.GRAY;
    const color = typeKey === 'RAINBOW'
      ? `hsl(${(rainbowHue === null || rainbowHue === undefined) ? (Date.now() / 60) % 360 : rainbowHue},100%,65%)`
      : def.color;

    ctx.save();
    ctx.translate(x, y);

    if (flashT > 0) {
      ctx.globalAlpha = 0.55 + Math.abs(Math.sin(flashT * 25)) * 0.45;
    }

    // Drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4 * scale;
    ctx.shadowOffsetY = 2 * scale;

    // Main fill
    roundRect(ctx, -w / 2, -h / 2, w, h, 4 * scale);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Special block styles
    if (typeKey === 'DO_NOT_MOVE') {
      ctx.save();
      roundRect(ctx, -w / 2, -h / 2, w, h, 4 * scale);
      ctx.clip();
      ctx.strokeStyle = '#f5c800';
      ctx.lineWidth = 5 * scale;
      for (let i = -w; i < w * 2; i += 10 * scale) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + i, -h / 2);
        ctx.lineTo(-w / 2 + i + h, h / 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (typeKey === 'LOX') {
      ctx.strokeStyle = '#6bb8e0';
      ctx.lineWidth = 2 * scale;
      roundRect(ctx, -w / 2 + 2 * scale, -h / 2 + 2 * scale, w - 4 * scale, h - 4 * scale, 3 * scale);
      ctx.stroke();
      // Cylindrical reflection
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-w / 2 + 4 * scale, -h / 2 + 3 * scale, 5 * scale, h - 6 * scale);
    }

    if (typeKey === 'HEAVY') {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2 * scale;
      roundRect(ctx, -w / 2, -h / 2, w, h, 4 * scale);
      ctx.stroke();
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1 * scale;
      roundRect(ctx, -w / 2 + 3 * scale, -h / 2 + 3 * scale, w - 6 * scale, h - 6 * scale, 2 * scale);
      ctx.stroke();
      if (cracked || hp < 2) {
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1.5 * scale;
        ctx.beginPath();
        ctx.moveTo(-4 * scale, -h / 2 + 4 * scale);
        ctx.lineTo(0, 0);
        ctx.lineTo(5 * scale, h / 2 - 4 * scale);
        ctx.stroke();
      }
    }

    if (typeKey === 'STEVES') {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      for (let i = -h / 2 + 6 * scale; i < h / 2; i += 6 * scale) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 2 * scale, i);
        ctx.lineTo(w / 2 - 2 * scale, i);
        ctx.stroke();
      }
    }

    // Top edge highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, -w / 2 + 2 * scale, -h / 2 + 2 * scale, w - 4 * scale, 5 * scale, 2 * scale);
    ctx.fill();

    // Bottom shadow strip
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    roundRect(ctx, -w / 2 + 2 * scale, h / 2 - 6 * scale, w - 4 * scale, 4 * scale, 2 * scale);
    ctx.fill();

    // Outline
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, -w / 2, -h / 2, w, h, 4 * scale);
    ctx.stroke();

    // Stenciled label
    const lbl = label || def.label;
    ctx.save();
    roundRect(ctx, -w / 2 + 2 * scale, -h / 2 + 2 * scale, w - 4 * scale, h - 4 * scale, 2 * scale);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = `bold ${Math.round(6 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.rotate(Math.sin(lbl.length * 0.3) * 0.04);
    const words = lbl.split(' ');
    if (words.length >= 3) {
      const half = Math.ceil(words.length / 2);
      ctx.fillText(words.slice(0, half).join(' '), 0, -4 * scale);
      ctx.fillText(words.slice(half).join(' '), 0, 4 * scale);
    } else if (words.length === 2) {
      ctx.fillText(words[0], 0, -4 * scale);
      ctx.fillText(words[1], 0, 4 * scale);
    } else {
      ctx.fillText(lbl, 0, 0);
    }
    ctx.restore();

    ctx.restore();
  }

  // ─── Background ───────────────────────────────────────────────────────────────
  function drawBackground(ctx) {
    const bg = ctx.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, '#1a1e22');
    bg.addColorStop(1, '#0d1014');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CW, CH);

    // Pad grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < CW; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CH); ctx.stroke();
    }
    for (let gy = 0; gy < CH; gy += 40) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CW, gy); ctx.stroke();
    }

    // Lightning tower silhouettes
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#8899aa';
    ctx.fillRect(18, 0, 8, 85);
    ctx.fillRect(10, 0, 24, 6);
    ctx.fillRect(CW - 26, 0, 8, 85);
    ctx.fillRect(CW - 34, 0, 24, 6);
    ctx.globalAlpha = 1;

    // Floodlight cones
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.03;
    const lgL = ctx.createRadialGradient(22, 0, 0, 22, 0, 210);
    lgL.addColorStop(0, 'rgba(255,255,180,1)');
    lgL.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lgL;
    ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-20, 240); ctx.lineTo(120, 240); ctx.closePath();
    ctx.fill();
    const lgR = ctx.createRadialGradient(CW - 22, 0, 0, CW - 22, 0, 210);
    lgR.addColorStop(0, 'rgba(255,255,180,1)');
    lgR.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lgR;
    ctx.beginPath(); ctx.moveTo(CW - 22, 0); ctx.lineTo(CW + 20, 240); ctx.lineTo(CW - 120, 240); ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Launch clearance line
    ctx.strokeStyle = 'rgba(0,255,136,0.30)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath(); ctx.moveTo(0, GRID_ZONE_BOTTOM); ctx.lineTo(CW, GRID_ZONE_BOTTOM); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(0,255,136,0.40)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('LAUNCH CLEARANCE LINE', CW - 8, GRID_ZONE_BOTTOM - 4);
    ctx.textAlign = 'left';
  }

  // ─── Launcher ─────────────────────────────────────────────────────────────────
  function drawLauncher(ctx) {
    const lx = LAUNCHER_X, ly = LAUNCHER_Y;

    // Pad surface
    ctx.fillStyle = '#222830';
    ctx.fillRect(0, ly - 28, CW, CH - (ly - 28));
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, ly - 28); ctx.lineTo(CW, ly - 28); ctx.stroke();

    // Cradle base
    ctx.fillStyle = '#3a4050';
    roundRect(ctx, lx - 22, ly - 12, 44, 20, 4);
    ctx.fill();
    ctx.strokeStyle = '#55606a';
    ctx.lineWidth = 1.5;
    roundRect(ctx, lx - 22, ly - 12, 44, 20, 4);
    ctx.stroke();

    // Hydraulic arms
    ctx.strokeStyle = '#5a6070';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(lx - 14, ly - 12); ctx.lineTo(lx - 9, ly - 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx + 14, ly - 12); ctx.lineTo(lx + 9, ly - 30); ctx.stroke();

    // Aim indicator
    const aimLen = 30;
    ctx.strokeStyle = 'rgba(255,255,80,0.32)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(lx, ly - 16);
    ctx.lineTo(lx + Math.sin(S.launcher.angle) * aimLen, (ly - 16) - Math.cos(S.launcher.angle) * aimLen);
    ctx.stroke();
    ctx.setLineDash([]);

    // Current block in cradle
    drawBlock(ctx, lx, ly - 16, S.launcher.current, 1, false, null, 0, 1, S.launcher.currentHue);

    // Next block preview
    const nx = lx + 68, ny = ly - 4;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    roundRect(ctx, nx - 20, ny - 24, 40, 42, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', nx, ny - 28);
    drawBlock(ctx, nx, ny - 4, S.launcher.next, 1, false, null, 0, 0.72, S.launcher.nextHue);

    // Swap hint
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = '7px monospace';
    ctx.fillText('[S]', nx, ny + 22);
    ctx.textAlign = 'left';
  }

  // ─── Trajectory ───────────────────────────────────────────────────────────────
  function drawTrajectory(ctx) {
    const full = S.activePup && S.activePup.key === 'LASER';
    const maxBounces = full ? 5 : 2;
    let x = LAUNCHER_X, y = LAUNCHER_Y - 16;
    let vx = Math.sin(S.launcher.angle);
    let vy = -Math.cos(S.launcher.angle);
    const margin = BLOCK_W / 2;

    ctx.strokeStyle = full ? 'rgba(160,255,160,0.55)' : 'rgba(0,255,100,0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(x, y);

    let bounces = 0;
    const step = 5;
    for (let i = 0; i < 600; i++) {
      x += vx * step;
      y += vy * step;
      if (x < margin) { x = margin; vx = Math.abs(vx); bounces++; }
      if (x > CW - margin) { x = CW - margin; vx = -Math.abs(vx); bounces++; }
      if (bounces > maxBounces) break;
      if (y < GRID_TOP) break;
      if (y > GRID_ZONE_BOTTOM) break;
      let hit = false;
      for (let r = 0; r < MAX_ROWS && !hit; r++) {
        if (Math.abs(cellY(r) - y) > BLOCK_H) continue;
        for (let c = 0; c < maxCol(r) && !hit; c++) {
          if (!getCell(r, c)) continue;
          if (Math.hypot(cellX(c, r) - x, cellY(r) - y) < BLOCK_W * 0.8) hit = true;
        }
      }
      if (hit) break;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ─── HUD ──────────────────────────────────────────────────────────────────────
  function drawHUD(ctx) {
    const mDef = MISSIONS[S.mission];

    ctx.fillStyle = 'rgba(18,22,28,0.94)';
    ctx.fillRect(0, 540, CW, 100);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 540); ctx.lineTo(CW, 540); ctx.stroke();

    // Score
    ctx.fillStyle = '#d4a936';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(String(S.score).padStart(8, '0'), 8, 562);

    // Mission name
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '9px monospace';
    ctx.fillText(mDef.name, 8, 577);

    // Combo
    if (S.combo >= 2) {
      ctx.fillStyle = '#ff8833';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`×${S.combo} COMBO`, 8, 591);
    }

    // Timer
    const tSec = Math.max(0, Math.ceil(S.timer));
    const mins = Math.floor(tSec / 60);
    const secs = tSec % 60;
    const tStr = mDef.timeLimit === Infinity ? '∞' : `T-${mins}:${String(secs).padStart(2, '0')}`;
    ctx.fillStyle = S.timer < 60 ? '#ff4444' : '#33ff33';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(tStr, CW - 8, 562);

    // Active pup indicator
    if (S.activePup) {
      const pd = PUPS[S.activePup.key];
      if (pd && pd.dur) {
        ctx.fillStyle = '#33ff88';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${pd.icon} ${pd.name} ${Math.ceil(S.activePup.timer)}s`, CW - 8, 578);
      }
    }

    // Power-up tray
    const pupBaseY = 600;
    for (let i = 0; i < 3; i++) {
      const bx = 8 + i * 46;
      ctx.fillStyle = S.powerTray[i] ? 'rgba(50,60,80,0.85)' : 'rgba(30,34,42,0.6)';
      roundRect(ctx, bx, pupBaseY - 14, 40, 30, 4);
      ctx.fill();
      ctx.strokeStyle = S.powerTray[i] ? 'rgba(100,150,220,0.6)' : 'rgba(80,80,80,0.4)';
      ctx.lineWidth = 1;
      roundRect(ctx, bx, pupBaseY - 14, 40, 30, 4);
      ctx.stroke();
      if (S.powerTray[i]) {
        const pd = PUPS[S.powerTray[i]];
        ctx.font = '15px serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(pd.icon, bx + 20, pupBaseY + 3);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '7px monospace';
        ctx.fillText(`[${i + 1}]`, bx + 20, pupBaseY + 14);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`[${i + 1}]`, bx + 20, pupBaseY + 5);
      }
    }

    // Mission 5 target
    if (S.mission === 5 && S.targetColors.length > 0) {
      const tc = S.targetColors[S.padWalkIdx];
      if (tc && TYPES[tc]) {
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '8px monospace';
        ctx.fillText('TARGET:', CW - 42, 592);
        ctx.fillStyle = TYPES[tc].color;
        ctx.beginPath(); ctx.arc(CW - 22, 588, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    ctx.textAlign = 'left';
  }

  // ─── Grid draw ────────────────────────────────────────────────────────────────
  function drawGrid(ctx) {
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < maxCol(r); c++) {
        const cell = getCell(r, c);
        if (!cell) continue;
        if (cell.flashTimer > 0) cell.flashTimer = Math.max(0, cell.flashTimer - 0.016);
        drawBlock(ctx, cellX(c, r), cellY(r), cell.type, cell.hp, cell.cracked, cell.label, cell.flashTimer, 1, cell.rainbowHue);
      }
    }
  }

  function drawFalling(ctx) {
    for (const f of S.falling) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.alpha);
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      drawBlock(ctx, 0, 0, f.block.type, f.block.hp, f.block.cracked, f.block.label, 0, 0.82, f.block.rainbowHue);
      ctx.restore();
    }
  }

  function drawProjectile(ctx) {
    if (!S.proj) return;
    drawBlock(ctx, S.proj.x, S.proj.y, S.proj.type, S.proj.hp, false, null, 0, 1, S.proj.rainbowHue);
  }

  // ─── Mission select ───────────────────────────────────────────────────────────
  function drawMissionSelect(ctx) {
    drawBackground(ctx);

    ctx.fillStyle = '#d4a936';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🧱 BIN BLOCK BLASTER', CW / 2, 44);

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px monospace';
    ctx.fillText('Clear the pad before launch', CW / 2, 60);

    const cardW = 90, cardH = 68;
    const gap = 7;
    const totalW = 4 * cardW + 3 * gap;
    const startX = (CW - totalW) / 2;
    const startY = 78;

    MISSIONS.forEach((m, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const cx = startX + col * (cardW + gap);
      const cy = startY + row * (cardH + gap);
      const locked = !S.unlocked[m.id];
      const stars = S.stars[m.id] || 0;
      const hovered = S.hoveredMission === i && !locked;

      ctx.fillStyle = locked
        ? 'rgba(26,30,36,0.7)'
        : (hovered ? 'rgba(60,72,96,0.95)' : 'rgba(38,44,56,0.88)');
      roundRect(ctx, cx, cy, cardW, cardH, 6);
      ctx.fill();
      ctx.strokeStyle = locked ? 'rgba(70,70,70,0.5)' : (hovered ? 'rgba(140,180,255,0.7)' : 'rgba(90,110,160,0.45)');
      ctx.lineWidth = 1.5;
      roundRect(ctx, cx, cy, cardW, cardH, 6);
      ctx.stroke();

      if (locked) ctx.globalAlpha = 0.38;

      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(m.patch, cx + cardW / 2, cy + 22);

      const shortName = m.name.length > 14 ? m.name.slice(0, 13) + '…' : m.name;
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = '#cce4ff';
      ctx.fillText(shortName, cx + cardW / 2, cy + 36);

      ctx.font = '6px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.fillText(m.sub, cx + cardW / 2, cy + 47);

      ctx.font = '10px serif';
      ctx.fillStyle = '#d4a936';
      ctx.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars), cx + cardW / 2, cy + 60);

      if (locked) {
        ctx.globalAlpha = 1;
        ctx.font = '16px serif';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText('🔒', cx + cardW / 2, cy + cardH / 2 + 4);
      }
      ctx.globalAlpha = 1;
    });

    // Rank panel
    const totalStars = Object.values(S.stars).reduce((a, b) => a + b, 0);
    const rank = totalStars >= 19 ? 'Pad Lead' : totalStars >= 13 ? 'Senior Pad Rat' : totalStars >= 6 ? 'Pad Tech' : 'Rookie';
    ctx.fillStyle = 'rgba(36,42,54,0.88)';
    roundRect(ctx, 10, CH - 82, CW - 20, 42, 6);
    ctx.fill();
    ctx.fillStyle = '#d4a936';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`⭐ ${totalStars} STARS — ${rank.toUpperCase()}`, CW / 2, CH - 58);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '8px monospace';
    ctx.fillText('Click a mission to play · [M] mute', CW / 2, CH - 44);
    ctx.textAlign = 'left';
  }

  // ─── Win cinematic ────────────────────────────────────────────────────────────
  function drawWin(ctx) {
    const t = S.winAnim;
    drawBackground(ctx);

    if (t < 1) {
      // Flash white
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - t * 2.2)})`;
      ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 30px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('RANGE GREEN', CW / 2, CH / 2);
      ctx.textAlign = 'left';
      return;
    }

    // Engine glow
    const ry = S.rocket.y;
    if (ry < CH + 60) {
      const grad = ctx.createRadialGradient(CW / 2, ry + 52, 0, CW / 2, ry + 52, 56);
      grad.addColorStop(0, 'rgba(255,160,40,0.75)');
      grad.addColorStop(0.45, 'rgba(255,80,20,0.35)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CW, CH);

      if (Math.random() < 0.45) {
        spawnParticle({
          x: CW / 2 + rand(-14, 14), y: ry + 52,
          vx: rand(-18, 18), vy: rand(12, 46),
          color: '165,160,148', size: rand(4, 11), decay: 0.007,
        });
      }
    }

    // Rocket sprite
    ctx.save();
    ctx.translate(CW / 2, ry);
    ctx.fillStyle = '#e0e8f0'; ctx.fillRect(-14, -44, 28, 64);
    ctx.beginPath(); ctx.moveTo(-14, -44); ctx.lineTo(0, -76); ctx.lineTo(14, -44); ctx.closePath();
    ctx.fillStyle = '#b8c4cc'; ctx.fill();
    ctx.fillStyle = '#3a78c8'; ctx.fillRect(-14, -14, 28, 9);
    ctx.fillStyle = '#888';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.ellipse(i * 5, 22, 3, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = -2; i <= 2; i++) {
      const fg = ctx.createLinearGradient(i * 5, 22, i * 5, 50);
      fg.addColorStop(0, 'rgba(255,210,80,0.9)');
      fg.addColorStop(1, 'rgba(255,70,10,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(i * 5 - 3, 22);
      ctx.lineTo(i * 5, 50 + rand(0, 8));
      ctx.lineTo(i * 5 + 3, 22);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    drawParticles(ctx);

    ctx.fillStyle = '#33ff88';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RANGE GREEN', CW / 2, 58);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '11px monospace';
    ctx.fillText('Range green. Lift off!', CW / 2, 78);

    const stars = S.stars[S.mission] || 0;
    ctx.font = '26px serif';
    ctx.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars), CW / 2, 112);
    ctx.fillStyle = '#d4a936';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`SCORE: ${String(S.score).padStart(8, '0')}`, CW / 2, 134);

    if (t > 3) {
      const nextId = S.mission + 1;
      const hasNext = nextId < MISSIONS.length && S.unlocked[nextId];
      const retryWidth = 100;
      if (hasNext) drawButton(ctx, CW / 2 - 74, CH - 82, 140, 32, 'NEXT MISSION', '#33ff88', '#001800');
      drawButton(ctx, hasNext ? CW / 2 + 74 : CW / 2 - 50, CH - 82, retryWidth, 32, 'RETRY', '#d4a936', '#181200');
      drawButton(ctx, CW / 2 - 74, CH - 46, 250, 28, 'MISSION SELECT', 'rgba(200,220,255,0.5)', '#101418');
    }
    ctx.textAlign = 'left';
  }

  // ─── Loss screen ──────────────────────────────────────────────────────────────
  function drawLoss(ctx) {
    drawBackground(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, CW, CH);

    ctx.fillStyle = '#ff3c3c';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LAUNCH SCRUBBED', CW / 2, CH / 2 - 62);

    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '11px monospace';
    ctx.fillText('Pad clearance not achieved.', CW / 2, CH / 2 - 32);
    ctx.fillText('Range officer not amused.', CW / 2, CH / 2 - 16);

    ctx.fillStyle = '#d4a936';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`SCORE: ${String(S.score).padStart(8, '0')}`, CW / 2, CH / 2 + 16);

    drawButton(ctx, CW / 2 - 82, CH / 2 + 56, 150, 36, 'RETRY', '#ff4444', '#220000');
    drawButton(ctx, CW / 2 + 76, CH / 2 + 56, 156, 36, 'MISSION SELECT', 'rgba(200,220,255,0.45)', '#101418');
    ctx.textAlign = 'left';
  }

  // ─── Initials entry ───────────────────────────────────────────────────────────
  function drawInitialsEntry(ctx) {
    drawBackground(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, CW, CH);

    ctx.fillStyle = '#33ff88';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NEW HIGH SCORE!', CW / 2, 118);

    ctx.fillStyle = '#d4a936';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(String(S.initialsEntry.score).padStart(8, '0'), CW / 2, 148);

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px monospace';
    ctx.fillText('ENTER INITIALS', CW / 2, 184);

    const { chars, cursor } = S.initialsEntry;
    for (let i = 0; i < 3; i++) {
      const bx = CW / 2 - 60 + i * 50;
      const by = 208;
      const sel = i === cursor;
      ctx.fillStyle = sel ? 'rgba(0,180,80,0.18)' : 'rgba(36,44,58,0.85)';
      roundRect(ctx, bx - 18, by, 36, 44, 4);
      ctx.fill();
      ctx.strokeStyle = sel ? '#33ff88' : 'rgba(90,110,160,0.55)';
      ctx.lineWidth = 2;
      roundRect(ctx, bx - 18, by, 36, 44, 4);
      ctx.stroke();
      ctx.fillStyle = sel ? '#33ff88' : '#fff';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(chars[i], bx, by + 32);
      if (sel) {
        ctx.fillStyle = '#33ff88';
        ctx.font = '15px monospace';
        ctx.fillText('▲', bx, by - 6);
        ctx.fillText('▼', bx, by + 56);
      }
    }
    ctx.textAlign = 'center';
    drawButton(ctx, CW / 2 - 52, 290, 104, 32, 'CONFIRM', '#33ff88', '#001800');

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px monospace';
    ctx.fillText('← → cursor  ↑ ↓ change letter', CW / 2, 342);
    ctx.textAlign = 'left';
  }

  // ─── Leaderboard ──────────────────────────────────────────────────────────────
  function drawLeaderboard(ctx) {
    drawBackground(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.76)';
    ctx.fillRect(0, 0, CW, CH);

    const mDef = MISSIONS[S.mission];
    ctx.fillStyle = '#d4a936';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`🏆 ${mDef.name}`, CW / 2, 50);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px monospace';
    ctx.fillText('LEADERBOARD', CW / 2, 68);

    const list = S.hiScores[String(S.mission)] || [];
    for (let i = 0; i < Math.min(10, list.length); i++) {
      const entry = list[i];
      const y = 94 + i * 28;
      const isNew = S.initialsEntry.entryId != null && entry.id === S.initialsEntry.entryId;
      ctx.fillStyle = isNew ? 'rgba(0,180,80,0.14)' : (i % 2 === 0 ? 'rgba(38,44,58,0.55)' : 'rgba(28,34,46,0.55)');
      ctx.fillRect(28, y - 16, CW - 56, 24);
      ctx.fillStyle = isNew ? '#33ff88' : (i === 0 ? '#d4a936' : 'rgba(255,255,255,0.68)');
      ctx.font = `${isNew ? 'bold ' : ''}12px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}. ${entry.name}`, 38, y);
      ctx.textAlign = 'right';
      ctx.fillText(String(entry.score).padStart(8, '0'), CW - 38, y);
    }
    if (!list.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No scores yet', CW / 2, CH / 2);
    }
    drawButton(ctx, CW / 2 - 62, CH - 72, 124, 32, 'CONTINUE', '#33ff88', '#001800');
    ctx.textAlign = 'left';
  }

  // ─── Main draw ────────────────────────────────────────────────────────────────
  function draw() {
    const ctx = S.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, CW, CH);

    switch (S.screen) {
      case 'mission_select':
        drawMissionSelect(ctx);
        break;
      case 'playing':
        drawBackground(ctx);
        drawGrid(ctx);
        drawTrajectory(ctx);
        drawProjectile(ctx);
        drawFalling(ctx);
        drawParticles(ctx);
        drawLauncher(ctx);
        drawHUD(ctx);
        if (S.paused) {
          ctx.fillStyle = 'rgba(0,0,0,0.62)';
          ctx.fillRect(0, 0, CW, CH);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 26px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('PAUSED', CW / 2, CH / 2 - 16);
          drawButton(ctx, CW / 2 - 52, CH / 2 + 6, 104, 30, 'RESUME', '#33ff88', '#001800');
          ctx.textAlign = 'left';
        }
        break;
      case 'win':
        drawWin(ctx);
        drawParticles(ctx);
        break;
      case 'loss':
        drawLoss(ctx);
        break;
      case 'initials':
        drawInitialsEntry(ctx);
        break;
      case 'leaderboard':
        drawLeaderboard(ctx);
        break;
    }
  }

  // ─── RAF loop ─────────────────────────────────────────────────────────────────
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!S.canvas || !S.ctx) return;
    if (!isSectionActive() || document.hidden) { S.lastTs = ts; return; }

    const dt = S.lastTs ? Math.min(1 / 20, (ts - S.lastTs) / 1000) : 1 / 60;
    S.lastTs = ts;
    resizeCanvas();

    if (!S.paused && S.screen === 'playing') update(dt);
    if (S.screen === 'win') {
      S.winAnim += dt;
      S.rocket.y += S.rocket.vy * dt;
      updateParticles(dt);
    }

    draw();
  }

  function isSectionActive() {
    const sec = document.getElementById('sec-bin-blaster');
    return !!(sec && sec.classList.contains('active'));
  }

  function resizeCanvas() {
    const canvas = S.canvas;
    if (!canvas || !S.ctx) return;
    const wrapper = S.wrapper || canvas.parentElement;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    const isFullscreen = !!(wrapper && fs === wrapper);
    const dpr = window.devicePixelRatio || 1;
    const maxW = isFullscreen
      ? Math.max(1, window.innerWidth - 24)
      : Math.max(1, Math.min((wrapper && wrapper.clientWidth) || canvas.clientWidth || CW, CW));
    const maxH = isFullscreen ? Math.max(1, window.innerHeight - 24) : Infinity;
    const cssW = Math.max(1, Math.min(maxW, maxH * (CW / CH)));
    const cssH = cssW * (CH / CW);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    const scaleX = canvas.width / CW;
    const scaleY = canvas.height / CH;
    S.ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  }

  // ─── Input ────────────────────────────────────────────────────────────────────
  function canvasCoords(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  function handleClick(px, py) {
    Audio.resume();

    if (S.screen === 'mission_select') {
      const cardW = 90, cardH = 68, gap = 7;
      const totalW = 4 * cardW + 3 * gap;
      const startX = (CW - totalW) / 2;
      const startY = 78;
      for (let i = 0; i < MISSIONS.length; i++) {
        const col = i % 4, row = Math.floor(i / 4);
        const cx = startX + col * (cardW + gap);
        const cy = startY + row * (cardH + gap);
        if (px >= cx && px < cx + cardW && py >= cy && py < cy + cardH) {
          if (S.unlocked[MISSIONS[i].id]) startMission(i);
          return;
        }
      }
      return;
    }

    if (S.screen === 'playing') {
      if (S.paused) {
        // Resume button: CW/2-52, CH/2+6, 104, 30
        if (px >= CW / 2 - 52 && px < CW / 2 + 52 && py >= CH / 2 + 6 && py < CH / 2 + 36) {
          S.paused = false;
        }
        return;
      }
      // Power tray clicks
      const pupBaseY = 600;
      for (let i = 0; i < 3; i++) {
        const bx = 8 + i * 46;
        if (px >= bx && px < bx + 40 && py >= pupBaseY - 14 && py < pupBaseY + 16 && S.powerTray[i]) {
          activatePowerup(i); return;
        }
      }
      // Swap area (next block preview)
      const nx = LAUNCHER_X + 68;
      if (px >= nx - 22 && px < nx + 22 && py >= LAUNCHER_Y - 28 && py < LAUNCHER_Y + 20) {
        swapBlock();
        return;
      }
      updateAim(px, py);
      fireBlock();
      return;
    }

    if (S.screen === 'win') {
      if (S.winAnim > 3) {
        const nextId = S.mission + 1;
        const hasNext = nextId < MISSIONS.length && S.unlocked[nextId];
        // Next mission button
        if (hasNext && px >= CW / 2 - 74 && px < CW / 2 + 66 && py >= CH - 82 && py < CH - 50) {
          startMission(nextId); return;
        }
        // Retry
        const retryX = hasNext ? CW / 2 + 74 : CW / 2 - 50;
        if (px >= retryX && px < retryX + 100 && py >= CH - 82 && py < CH - 50) {
          startMission(S.mission); return;
        }
        // Mission select
        if (py >= CH - 46 && py < CH - 18) { S.screen = 'mission_select'; return; }
      }
      return;
    }

    if (S.screen === 'loss') {
      // Retry: CW/2-82, CH/2+56, 150, 36
      if (px >= CW / 2 - 82 && px < CW / 2 + 68 && py >= CH / 2 + 56 && py < CH / 2 + 92) {
        startMission(S.mission); return;
      }
      // Mission select: CW/2+76
      if (px >= CW / 2 + 76 && py >= CH / 2 + 56 && py < CH / 2 + 92) {
        S.screen = 'mission_select'; return;
      }
      return;
    }

    if (S.screen === 'initials') {
      const { chars } = S.initialsEntry;
      for (let i = 0; i < 3; i++) {
        const bx = CW / 2 - 60 + i * 50;
        // Up arrow
        if (px >= bx - 14 && px < bx + 14 && py >= 196 && py < 214) {
          S.initialsEntry.cursor = i;
          chars[i] = String.fromCharCode(((chars[i].charCodeAt(0) - 65 + 1) % 26) + 65);
          return;
        }
        // Down arrow
        if (px >= bx - 14 && px < bx + 14 && py >= 256 && py < 274) {
          S.initialsEntry.cursor = i;
          chars[i] = String.fromCharCode(((chars[i].charCodeAt(0) - 65 + 25) % 26) + 65);
          return;
        }
        // Letter box select
        if (px >= bx - 18 && px < bx + 18 && py >= 208 && py < 252) {
          S.initialsEntry.cursor = i; return;
        }
      }
      // Confirm button: CW/2-52, 290, 104, 32
      if (px >= CW / 2 - 52 && px < CW / 2 + 52 && py >= 290 && py < 322) {
        confirmInitials();
      }
      return;
    }

    if (S.screen === 'leaderboard') {
      if (px >= CW / 2 - 62 && px < CW / 2 + 62 && py >= CH - 72 && py < CH - 40) {
        S.screen = 'mission_select';
      }
    }
  }

  function handleMouseMove(px, py) {
    if (S.screen === 'mission_select') {
      const cardW = 90, cardH = 68, gap = 7;
      const totalW = 4 * cardW + 3 * gap;
      const startX = (CW - totalW) / 2;
      const startY = 78;
      S.hoveredMission = -1;
      for (let i = 0; i < MISSIONS.length; i++) {
        const col = i % 4, row = Math.floor(i / 4);
        const cx = startX + col * (cardW + gap);
        const cy = startY + row * (cardH + gap);
        if (px >= cx && px < cx + cardW && py >= cy && py < cy + cardH) {
          S.hoveredMission = i; return;
        }
      }
    } else if (S.screen === 'playing' && !S.paused) {
      updateAim(px, py);
    }
  }

  function bindInput() {
    const canvas = S.canvas;

    canvas.addEventListener('mousemove', e => {
      const { x, y } = canvasCoords(e, canvas);
      handleMouseMove(x, y);
    });

    canvas.addEventListener('click', e => {
      const { x, y } = canvasCoords(e, canvas);
      handleClick(x, y);
    });

    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      Audio.resume();
      const { x, y } = canvasCoords(e, canvas);
      handleMouseMove(x, y);
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const { x, y } = canvasCoords(e, canvas);
      handleMouseMove(x, y);
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const t = e.changedTouches[0];
      const x = (t.clientX - rect.left) * (CW / rect.width);
      const y = (t.clientY - rect.top) * (CH / rect.height);
      handleClick(x, y);
    }, { passive: false });

    document.addEventListener('keydown', e => {
      if (!isSectionActive()) return;

      if (S.screen === 'playing') {
        switch (e.code) {
          case 'ArrowLeft':
            S.launcher.angle = clamp(S.launcher.angle - 2 * Math.PI / 180, -MAX_AIM_RAD, MAX_AIM_RAD);
            break;
          case 'ArrowRight':
            S.launcher.angle = clamp(S.launcher.angle + 2 * Math.PI / 180, -MAX_AIM_RAD, MAX_AIM_RAD);
            break;
          case 'ArrowUp':
          case 'Space':
            e.preventDefault();
            if (!S.paused) fireBlock();
            break;
          case 'KeyS':
            swapBlock();
            break;
          case 'Digit1': activatePowerup(0); break;
          case 'Digit2': activatePowerup(1); break;
          case 'Digit3': activatePowerup(2); break;
          case 'KeyP':
            S.paused = !S.paused;
            break;
          case 'KeyM':
            S.muted = !S.muted;
            if (S.muted) Audio.stopMusic();
            else Audio.setMood('playing');
            saveState();
            break;
        }
        return;
      }

      if (S.screen === 'mission_select' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        startMission(firstUnlockedMission());
        return;
      }

      if (S.screen === 'initials') {
        const { chars, cursor } = S.initialsEntry;
        switch (e.code) {
          case 'ArrowLeft':  S.initialsEntry.cursor = Math.max(0, cursor - 1); break;
          case 'ArrowRight': S.initialsEntry.cursor = Math.min(2, cursor + 1); break;
          case 'ArrowUp':    chars[cursor] = String.fromCharCode(((chars[cursor].charCodeAt(0) - 65 + 1) % 26) + 65); break;
          case 'ArrowDown':  chars[cursor] = String.fromCharCode(((chars[cursor].charCodeAt(0) - 65 + 25) % 26) + 65); break;
          case 'Enter':
          case 'Space':
            e.preventDefault();
            confirmInitials();
            break;
        }
        return;
      }

      if (S.screen === 'win' || S.screen === 'loss' || S.screen === 'leaderboard') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          S.screen = 'mission_select';
        }
      }
    });

    document.addEventListener('click', ev => {
      const btn = ev.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'binBlasterReset') resetAll();
      if (btn.dataset.action === 'binBlasterStart') {
        if (S.screen === 'mission_select') startMission(firstUnlockedMission());
        else if (S.screen === 'playing' && S.paused) S.paused = false;
        else if (S.screen !== 'playing') startMission(S.mission);
      }
      if (btn.dataset.action === 'binBlasterFullscreen') toggleFullscreen();
      if (btn.dataset.action === 'binBlasterMute') {
        S.muted = !S.muted;
        if (S.muted) Audio.stopMusic();
        else if (S.screen === 'playing') Audio.setMood('playing');
        saveState();
      }
    });

    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('fullscreenchange', resizeCanvas);
    document.addEventListener('webkitfullscreenchange', resizeCanvas);
  }

  // ─── Start mission ────────────────────────────────────────────────────────────
  function firstUnlockedMission() {
    const missionIndex = MISSIONS.findIndex(mission => !!S.unlocked[mission.id]);
    return missionIndex >= 0 ? missionIndex : 0;
  }

  function startMission(id) {
    const mDef = MISSIONS[id];
    S.mission = id;
    S.score = 0;
    S.combo = 0;
    S.timer = mDef.timeLimit === Infinity ? 9999 : mDef.timeLimit;
    S.dropTimer = mDef.dropInterval;
    S.powerupsUsed = false;
    S.powerTray = [];
    S.activePup = null;
    S.falling = [];
    S.proj = null;
    S.winAnim = 0;
    S.rocket = { y: CH + 60, vy: -180 };
    S.stevesQuipTimer = rand(8, 20);
    S.debrisTimer = 5;
    S.endlessDropAccel = 0;
    S.padWalkIdx = 0;
    S.targetColors = mDef.id === 5 ? shuffled(STD.slice(0, mDef.colors)) : [];
    clearParticles();
    initGrid(mDef);
    S.screen = 'playing';
    Audio.setMood('playing');
  }

  // ─── Persistence ──────────────────────────────────────────────────────────────
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      S.hiScores = saved.hiScores || {};
      S.stars = saved.stars || {};
      S.unlocked = Object.assign({ 0: true }, saved.unlocked || {});
      S.muted = saved.muted || false;
      updateHiScoreDisplay();
    } catch (e) { /* ignore */ }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        hiScores: S.hiScores,
        stars: S.stars,
        unlocked: S.unlocked,
        muted: S.muted,
      }));
    } catch (e) { /* ignore */ }
  }

  function updateHiScoreDisplay() {
    const el = document.getElementById('binblaster-hi-score');
    if (!el) return;
    const totalStars = Object.values(S.stars).reduce((a, b) => a + b, 0);
    const rank = totalStars >= 19 ? 'Pad Lead'
      : totalStars >= 13 ? 'Senior Pad Rat'
      : totalStars >= 6  ? 'Pad Tech'
      : 'Rookie';
    el.textContent = `⭐ ${totalStars} stars — ${rank}`;
    el.style.fontFamily = 'var(--font-mono, monospace)';
    el.style.color = 'var(--amber, #d4a936)';
  }

  function resetAll() {
    S.hiScores = {};
    S.stars = {};
    S.unlocked = { 0: true };
    S.screen = 'mission_select';
    saveState();
    updateHiScoreDisplay();
  }

  function toggleFullscreen() {
    const wrapper = S.wrapper || document.getElementById('binblaster-fs-wrapper');
    if (!wrapper) return;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fs) {
      const req = wrapper.requestFullscreen || wrapper.webkitRequestFullscreen;
      if (req) req.call(wrapper);
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    S.canvas = document.getElementById('binBlasterCanvas');
    if (!S.canvas) return;
    S.ctx = S.canvas.getContext('2d');
    S.wrapper = document.getElementById('binblaster-fs-wrapper');
    loadState();
    resizeCanvas();
    bindInput();
    requestAnimationFrame(loop);
  }

  document.addEventListener('DOMContentLoaded', init);

}());
