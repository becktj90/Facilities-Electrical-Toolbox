(function () {
  'use strict';

  const CW = 420;
  const CH = 640;
  const BASE_FPS = 60;
  const STORAGE_KEY = 'newGlennRunnerSettingsV2';
  const DEFAULT_SETTINGS = {
    sound: true,
    music: true,
    reducedMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    reducedFlashes: false,
    haptics: true,
    muted: false,
    hiScore: 0,
    missionCount: 0,
    bestFlight: null,
    patches: []
  };
  const BLOCK_LABELS = [
    ['DO NOT MOVE', 'BLOCK 7-B', 'STILL HERE'],
    ['PROPERTY OF GSE', 'LAST INSPECTED: NEVER', 'STILL HERE'],
    ['BLOCK-7B', 'DO NOT MOVE', 'PROPERTY OF GSE'],
    ['STILL HERE SINCE 2019', 'BLOCK 7-B', 'DO NOT MOVE']
  ];
  const LOADING_TIPS = [
    'New Glenn is 7 m wide. Yes, that wide.',
    'BE-4 burns liquid methane and LOX. Cleaner than kerosene.',
    'BE-3U burns hydrogen. The plume is nearly invisible in daylight.',
    'The rocket is named for John Glenn — first American in orbit, 1962.',
    "It's 9 miles from the factory to the pad. Driving to work, basically.",
    'Gradatim ferociter — step by step, ferociously.'
  ];
  const RADIO = {
    PAD: 'Pad systems nominal.',
    ASCENT: 'You are go for launch.',
    MAX_Q: 'Throttling up. Hold tight.',
    COAST: 'Gradatim ferociter. MECO confirmed.',
    STAGE_SEP: 'Booster\'s coming home. Don\'t blink.',
    UPPER_ASCENT: 'Welcome to space. Population: you.',
    ORBIT_INSERT: 'Payload deploy is waiting on your right hand.',
    PAYLOAD_DEPLOY: 'Payload deployed. Coffee earned.',
    BOOSTER_WIN: 'Sea state nominal. Book the celebration.'
  };
  const PAYLOADS = ['Blue Ring Pathfinder', 'Twin Probes', 'BlueBird Satellite'];
  const PHASES = {
    PAD: { label: 'PAD OPS', start: 0, end: 8 },
    ASCENT: { label: 'ASCENT', start: 8, end: 20 },
    MAX_Q: { label: 'MAX-Q', start: 20, end: 26 },
    COAST: { label: 'MECO APPROACH', start: 26, end: 30 },
    STAGE_SEP: { label: 'STAGE SEPARATION', start: 30, end: 34 },
    UPPER_ASCENT: { label: 'UPPER ASCENT', start: 34, end: 50 },
    BOOSTER_LANDING: { label: 'BOOSTER RECOVERY', start: 34, end: 48 },
    ORBIT_INSERT: { label: 'ORBIT INSERT', start: 50, end: 56 },
    PAYLOAD_DEPLOY: { label: 'PAYLOAD DEPLOY', start: 56, end: 60 },
    EXTENDED: { label: 'EXTENDED MISSION', start: 60, end: Infinity }
  };
  const MAIN_TIMELINE = [
    { t: 0, actual: -30, altitude: 0, velocity: 0, q: 0 },
    { t: 8, actual: 0, altitude: 0, velocity: 0, q: 0.4 },
    { t: 20, actual: 95, altitude: 13000, velocity: 1180, q: 28 },
    { t: 26, actual: 105, altitude: 26000, velocity: 1500, q: 23 },
    { t: 30, actual: 185, altitude: 75000, velocity: 2700, q: 5 },
    { t: 34, actual: 197, altitude: 85000, velocity: 2150, q: 1.2 },
    { t: 36, actual: 230, altitude: 110000, velocity: 3200, q: 0.2 },
    { t: 50, actual: 549, altitude: 170000, velocity: 6300, q: 0 },
    { t: 56, actual: 780, altitude: 200000, velocity: 7800, q: 0 },
    { t: 60, actual: 820, altitude: 212000, velocity: 7700, q: 0 }
  ];
  const BOOSTER_TIMELINE = [
    { t: 34, altitude: 80000, velocity: -900 },
    { t: 40, altitude: 50000, velocity: -1150 },
    { t: 46, altitude: 5000, velocity: -290 },
    { t: 48, altitude: 0, velocity: -16 }
  ];
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

  const Settings = {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      } catch (err) {
        return { ...DEFAULT_SETTINGS };
      }
    },
    save(settings) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  };

  const Audio = (() => {
    let ctx = null;
    let master = null;
    let rumble = null;
    let rumbleNoise = null;
    let rumbleTone = null;
    let musicTimer = null;
    let musicMode = 'idle';

    const patterns = {
      idle: [[196, 0.36, 'sawtooth'], [220, 0.42, 'sawtooth'], [null, 0.28], [174.61, 0.52, 'triangle']],
      pad: [[110, 0.2, 'triangle'], [146.83, 0.2, 'triangle'], [196, 0.3, 'square'], [null, 0.2]],
      ascent: [[220, 0.12, 'square'], [261.63, 0.12, 'square'], [329.63, 0.18, 'triangle'], [392, 0.32, 'triangle'], [349.23, 0.12, 'square'], [293.66, 0.18, 'triangle']],
      maxq: [[98, 0.16, 'sawtooth'], [110, 0.16, 'square'], [null, 0.1], [123.47, 0.16, 'square']],
      triumph: [[261.63, 0.14, 'triangle'], [329.63, 0.14, 'triangle'], [392, 0.14, 'triangle'], [523.25, 0.34, 'sawtooth']],
      orbital: [[261.63, 0.3, 'sine'], [392, 0.36, 'triangle'], [null, 0.16], [523.25, 0.46, 'sine']],
      gameover: [[196, 0.2, 'triangle'], [164.81, 0.25, 'triangle'], [130.81, 0.4, 'triangle']]
    };

    function ensure(settings) {
      if (settings && settings.muted) return false;
      if (ctx) return true;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.18;
        master.connect(ctx.destination);
      } catch (err) {
        ctx = null;
        return false;
      }
      return true;
    }

    function now() {
      return ctx ? ctx.currentTime : 0;
    }

    function resume(settings) {
      if (!ensure(settings)) return;
      if (ctx.state === 'suspended') ctx.resume();
    }

    function stopMusic() {
      if (musicTimer) {
        clearTimeout(musicTimer);
        musicTimer = null;
      }
    }

    function tone(freq, duration, type, gain, slideTo) {
      if (!ctx || !master || !freq) return;
      const t = now();
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + duration);
      env.gain.setValueAtTime(Math.max(0.0001, gain || 0.08), t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.04, duration));
      osc.connect(env);
      env.connect(master);
      osc.start(t);
      osc.stop(t + duration + 0.04);
    }

    function noise(duration, gain, lowpassFreq) {
      if (!ctx || !master) return;
      const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.85;
      const src = ctx.createBufferSource();
      const env = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpassFreq || 850;
      src.buffer = buffer;
      env.gain.setValueAtTime(Math.max(0.0001, gain || 0.05), now());
      env.gain.exponentialRampToValueAtTime(0.0001, now() + Math.max(0.04, duration));
      src.connect(lp);
      lp.connect(env);
      env.connect(master);
      src.start();
      src.stop(now() + duration + 0.02);
    }

    function setMute(settings) {
      if (!ensure(settings) || !master) return;
      master.gain.cancelScheduledValues(now());
      master.gain.setTargetAtTime(settings.muted ? 0.0001 : 0.18, now(), 0.03);
      if (settings.muted) stopRumble();
    }

    function setMood(mode, settings) {
      if (!settings.music || settings.muted) {
        stopMusic();
        return;
      }
      resume(settings);
      if (!ctx || musicMode === mode && musicTimer) return;
      stopMusic();
      musicMode = mode;
      let index = 0;
      const pattern = patterns[mode] || patterns.idle;
      const loop = () => {
        if (!ctx || settings.muted || !settings.music) return;
        const [freq, dur, type] = pattern[index % pattern.length];
        index += 1;
        if (freq) tone(freq, dur, type || 'triangle', mode === 'maxq' ? 0.035 : 0.045);
        musicTimer = setTimeout(loop, dur * 1000);
      };
      loop();
    }

    function ensureRumble() {
      if (!ctx || rumble) return;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 95;
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      const sine = ctx.createOscillator();
      sine.type = 'sine';
      sine.frequency.value = 30;
      noiseSource.connect(lp);
      lp.connect(gain);
      sine.connect(gain);
      gain.connect(master);
      noiseSource.start();
      sine.start();
      rumble = gain;
      rumbleNoise = noiseSource;
      rumbleTone = sine;
    }

    function updateRumble(level, settings) {
      if (!settings.sound || settings.muted) {
        stopRumble();
        return;
      }
      resume(settings);
      ensureRumble();
      if (!rumble) return;
      rumble.gain.setTargetAtTime(Math.max(0.0001, level * 0.12), now(), 0.06);
    }

    function stopRumble() {
      if (!rumble) return;
      rumble.gain.setTargetAtTime(0.0001, now(), 0.04);
    }

    function play(name, settings) {
      if (!settings.sound || settings.muted) return;
      resume(settings);
      switch (name) {
        case 'boost': tone(420, 0.08, 'square', 0.05, 620); break;
        case 'whoosh': noise(0.11, 0.03, 1800); break;
        case 'meco': tone(92, 0.2, 'triangle', 0.055, 48); noise(0.16, 0.025, 220); break;
        case 'stage_sep': tone(180, 0.12, 'triangle', 0.045, 110); break;
        case 'landing_touchdown': tone(120, 0.09, 'triangle', 0.05, 80); noise(0.22, 0.018, 900); break;
        case 'rud': tone(180, 0.32, 'sawtooth', 0.07, 44); noise(0.28, 0.05, 1000); break;
        case 'ui_click': tone(720, 0.045, 'square', 0.03, 540); break;
        case 'countdown_beep': tone(320, 0.08, 'sine', 0.03); break;
        case 'liftoff_horn': tone(220, 0.35, 'triangle', 0.06, 620); break;
        case 'tortoise': tone(80, 0.11, 'sawtooth', 0.04, 74); break;
        case 'success': tone(392, 0.12, 'triangle', 0.04); tone(523.25, 0.22, 'triangle', 0.03); break;
      }
    }

    return { ensure, resume, play, setMood, updateRumble, stopRumble, stopMusic, setMute };
  })();

  const Particles = (() => {
    const pool = Array.from({ length: 420 }, () => ({ active: false }));

    function spawn(opts) {
      const slot = pool.find(p => !p.active);
      if (!slot) return;
      Object.assign(slot, {
        active: true,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 1,
        decay: 0.02,
        size: 3,
        grow: 0,
        alpha: 1,
        color: '255,255,255',
        kind: 'smoke',
        section: 'main'
      }, opts);
    }

    function burst(count, builder) {
      for (let i = 0; i < count; i++) spawn(builder(i));
    }

    function update(dt) {
      const step = dt * BASE_FPS;
      for (const p of pool) {
        if (!p.active) continue;
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.size += p.grow * step;
        p.life -= p.decay * step;
        if (p.life <= 0 || p.size <= 0) p.active = false;
      }
    }

    function draw(ctx, section) {
      let additive = false;
      for (const p of pool) {
        if (!p.active || (section && p.section !== section)) continue;
        const alpha = Math.max(0, p.life * p.alpha);
        if (!additive && (p.kind === 'fire' || p.kind === 'plasma' || p.kind === 'flash')) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          additive = true;
        }
        ctx.fillStyle = `rgba(${p.color},${alpha})`;
        ctx.beginPath();
        if (p.kind === 'streak') {
          ctx.fillRect(p.x, p.y, p.size * 2.6, 1.2);
        } else {
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (additive) ctx.restore();
    }

    function clear() {
      for (const p of pool) p.active = false;
    }

    return { spawn, burst, update, draw, clear };
  })();

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function approach(v, target, amt) { return v + clamp(target - v, -amt, amt); }
  function rand(min, max) { return Math.random() * (max - min) + min; }
  function pad(n) { return String(Math.floor(Math.abs(n))).padStart(2, '0'); }
  function formatMissionTime(sec) {
    const sign = sec < 0 ? 'T-' : 'T+';
    const abs = Math.abs(sec);
    return `${sign}${pad(abs / 60)}:${pad(abs % 60)}`;
  }

  function timelineValue(list, key, t) {
    if (t <= list[0].t) return list[0][key];
    for (let i = 1; i < list.length; i++) {
      if (t <= list[i].t) {
        const a = list[i - 1];
        const b = list[i];
        const u = (t - a.t) / Math.max(0.0001, b.t - a.t);
        return lerp(a[key], b[key], u);
      }
    }
    return list[list.length - 1][key];
  }

  function phaseForTime(time) {
    if (time < PHASES.PAD.end) return 'PAD';
    if (time < PHASES.ASCENT.end) return 'ASCENT';
    if (time < PHASES.MAX_Q.end) return 'MAX_Q';
    if (time < PHASES.COAST.end) return 'COAST';
    if (time < PHASES.STAGE_SEP.end) return 'STAGE_SEP';
    if (time < PHASES.UPPER_ASCENT.end) return 'UPPER_ASCENT';
    if (time < PHASES.ORBIT_INSERT.end) return 'ORBIT_INSERT';
    if (time < PHASES.PAYLOAD_DEPLOY.end) return 'PAYLOAD_DEPLOY';
    return 'EXTENDED';
  }

  function altitudeGradient(altitude) {
    const km = altitude / 1000;
    const stops = [
      { km: 0, top: '#1a3a5c', bottom: '#0a1218' },
      { km: 10, top: '#0e2747', bottom: '#040810' },
      { km: 30, top: '#06183a', bottom: '#020610' },
      { km: 60, top: '#02091e', bottom: '#000204' },
      { km: 100, top: '#000000', bottom: '#000000' }
    ];
    for (let i = 1; i < stops.length; i++) {
      if (km <= stops[i].km) {
        const a = stops[i - 1];
        const b = stops[i];
        const t = (km - a.km) / Math.max(0.001, b.km - a.km);
        return {
          top: mixColor(a.top, b.top, t),
          bottom: mixColor(a.bottom, b.bottom, t)
        };
      }
    }
    return { top: '#000000', bottom: '#000000' };
  }

  function mixColor(a, b, t) {
    const pa = a.match(/[\da-f]{2}/gi).map(v => parseInt(v, 16));
    const pb = b.match(/[\da-f]{2}/gi).map(v => parseInt(v, 16));
    return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
  }

  function createStars(count, speedMin, speedMax) {
    return Array.from({ length: count }, () => ({
      x: Math.random() * CW,
      y: Math.random() * CH,
      r: rand(0.4, 1.6),
      speed: rand(speedMin, speedMax),
      alpha: rand(0.18, 1)
    }));
  }

  function createClouds() {
    return Array.from({ length: 14 }, () => ({
      x: rand(-40, CW + 40),
      y: rand(-20, CH + 20),
      w: rand(55, 120),
      h: rand(18, 42),
      speed: rand(0.2, 1.1),
      drift: rand(-0.12, 0.12),
      alpha: rand(0.08, 0.18)
    }));
  }

  function createState() {
    const settings = Settings.load();
    return {
      canvas: null,
      ctx: null,
      wrapper: null,
      status: 'READY',
      lastTs: 0,
      canvasScale: 1,
      settings,
      stars: { deep: createStars(90, 0.05, 0.2), mid: createStars(45, 0.12, 0.45) },
      clouds: createClouds(),
      shake: { intensity: 0, duration: 0 },
      input: { left: false, right: false, pointerX: CW / 2, boostHeld: false, boostPressed: false, konami: [], pointerDown: false },
      ui: {
        settingsOpen: false,
        radio: 'Gradatim ferociter.',
        radioTimer: 2,
        countdownStarted: false,
        countdown: 10,
        countdownMark: 10,
        systems: [],
        tip: LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)],
        tortoiseMoved: 0,
        lastPhase: 'READY',
        flash: 0,
        missionPatch: null,
        summaryButtons: [],
        overlayMessage: '',
        overlayTimer: 0
      },
      session: {
        missionNo: settings.missionCount + 1,
        missionName: `NG-${settings.missionCount + 1}`,
        totalElapsed: 0,
        phaseElapsed: 0,
        phase: 'PAD',
        ascentGrace: 2.5,
        score: 0,
        boosterRecovered: false,
        boosterLost: false,
        payloadDeployed: false,
        orbitStatus: 'pending',
        phaseRatings: {},
        maxAltitude: 0,
        maxVelocity: 0,
        maxQ: 0,
        structuralStress: 0,
        recentSteerSign: 0,
        lastSteerChange: -10,
        summaryReady: false
      },
      telemetry: { altitude: 0, velocity: 0, q: 0, actualTime: -30, lng: 100, lox: 100, tPlus: 'T-00:30' },
      rocket: { x: CW / 2, y: CH - 154, vx: 0, vy: 0, tilt: 0, burn: 0, plume: 'be4', fairingGone: false, explosion: 0 },
      upper: { x: CW / 2, y: 142, vx: 0, vy: 0, throttle: 0.45, targetBand: 0.5, targetLock: 0, deployAngle: 0, released: false },
      booster: { x: CW / 2, y: 130, vx: 0, vy: 4.2, burn: 0, alive: true, reentryBurnDone: false, landingBurnDone: false, decalVisible: false, touchdown: false, touchdownVy: 0 },
      obstacles: [],
      upperHazards: [],
      effects: { fairingSplit: 0, stageSepPuff: 0, splitView: false, rudTimer: 0, quickMessage: '' },
      easter: { binLabels: BLOCK_LABELS[Math.floor(Math.random() * BLOCK_LABELS.length)], bezosMode: false },
      buttons: { mute: null, pause: null }
    };
  }

  const state = createState();

  function saveSettings() {
    Settings.save(state.settings);
  }

  function addShake(amount, duration) {
    if (state.settings.reducedMotion) return;
    state.shake.intensity = Math.max(state.shake.intensity, amount);
    state.shake.duration = Math.max(state.shake.duration, duration);
  }

  function vibrate(pattern) {
    if (!state.settings.haptics || !('vibrate' in navigator)) return;
    navigator.vibrate(pattern);
  }

  function setRadio(message, duration) {
    state.ui.radio = message;
    state.ui.radioTimer = duration || 2.5;
  }

  function updateButtons() {
    const mute = document.getElementById('arcade-mute-btn');
    const pause = document.getElementById('arcade-pause-btn');
    if (mute) mute.textContent = state.settings.muted ? '🔇' : '🔊';
    if (pause) pause.textContent = state.status === 'PAUSED' || state.status === 'PAUSED_AUTO' ? '▶' : '⏸';
  }

  function resizeCanvas() {
    if (!state.canvas || !state.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = state.canvas.clientWidth || CW;
    const cssH = cssW * (CH / CW);
    state.canvas.width = Math.round(cssW * dpr);
    state.canvas.height = Math.round(cssH * dpr);
    state.canvas.style.height = cssH + 'px';
    state.canvasScale = dpr * (cssW / CW);
    state.ctx.setTransform(state.canvasScale, 0, 0, state.canvasScale, 0, 0);
  }

  function isSectionActive() {
    const sec = document.getElementById('sec-arcade');
    return !!(sec && sec.classList.contains('active'));
  }

  function resetMissionRecord() {
    state.settings.hiScore = 0;
    state.settings.bestFlight = null;
    state.settings.patches = [];
    saveSettings();
    updateRecordDisplay();
  }

  function updateRecordDisplay() {
    const el = document.getElementById('arcade-hi-score');
    if (!el) return;
    if (!state.settings.bestFlight) {
      el.textContent = 'NO MISSIONS FLOWN';
      return;
    }
    const best = state.settings.bestFlight;
    el.textContent = `${best.name} | ${best.medal} | Booster ${best.booster ? '✅' : '❌'} | Payload ${best.payload ? '✅' : '❌'}`;
  }

  function freshSystems() {
    const labels = ['LOX LOAD', 'LNG LOAD', 'FTS ARMED', 'TVC NOMINAL'];
    return labels.map((label, i) => ({ label, ok: false, x: 46 + (i % 2) * 164, y: 314 + Math.floor(i / 2) * 52, w: 148, h: 36 }));
  }

  function resetSession() {
    Particles.clear();
    state.status = 'READY';
    state.lastTs = 0;
    state.ui.settingsOpen = false;
    state.ui.radio = 'Gradatim ferociter.';
    state.ui.radioTimer = 3;
    state.ui.countdownStarted = false;
    state.ui.countdown = 10;
    state.ui.countdownMark = 10;
    state.ui.systems = freshSystems();
    state.ui.tip = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
    state.ui.tortoiseMoved = 0;
    state.ui.flash = 0;
    state.ui.missionPatch = null;
    state.ui.summaryButtons = [];
    state.ui.overlayMessage = '';
    state.ui.overlayTimer = 0;
    state.session = {
      missionNo: state.settings.missionCount + 1,
      missionName: `NG-${state.settings.missionCount + 1}`,
      totalElapsed: 0,
      phaseElapsed: 0,
      phase: 'PAD',
      ascentGrace: 2.5,
      score: 0,
      boosterRecovered: false,
      boosterLost: false,
      payloadDeployed: false,
      orbitStatus: 'pending',
      phaseRatings: {},
      maxAltitude: 0,
      maxVelocity: 0,
      maxQ: 0,
      structuralStress: 0,
      recentSteerSign: 0,
      lastSteerChange: -10,
      summaryReady: false
    };
    state.telemetry = { altitude: 0, velocity: 0, q: 0, actualTime: -30, lng: 100, lox: 100, tPlus: 'T-00:30' };
    state.rocket = { x: CW / 2, y: CH - 154, vx: 0, vy: 0, tilt: 0, burn: 0, plume: 'be4', fairingGone: false, explosion: 0 };
    state.upper = { x: CW / 2, y: 142, vx: 0, vy: 0, throttle: 0.45, targetBand: 0.5, targetLock: 0, deployAngle: 0, released: false };
    state.booster = { x: CW / 2, y: 130, vx: 0, vy: 4.2, burn: 0, alive: true, reentryBurnDone: false, landingBurnDone: false, decalVisible: false, touchdown: false, touchdownVy: 0 };
    state.obstacles = [];
    state.upperHazards = [];
    state.effects = { fairingSplit: 0, stageSepPuff: 0, splitView: false, rudTimer: 0, quickMessage: '' };
    state.easther = state.easther;
    state.effects.quickMessage = '';
    state.effects.splitView = false;
    Audio.stopMusic();
    Audio.stopRumble();
    updateButtons();
  }

  function missionMedal(score) {
    if (score >= 22) return 'GOLD';
    if (score >= 15) return 'SILVER';
    return 'BRONZE';
  }

  function ratePhase(name, value) {
    if (state.session.phaseRatings[name]) return;
    state.session.phaseRatings[name] = value;
    state.session.score += value === 'GOLD' ? 3 : value === 'SILVER' ? 2 : 1;
  }

  function updateTelemetry() {
    const t = clamp(state.session.totalElapsed, 0, 60);
    const baseAlt = timelineValue(MAIN_TIMELINE, 'altitude', t);
    const baseVel = timelineValue(MAIN_TIMELINE, 'velocity', t);
    const baseQ = timelineValue(MAIN_TIMELINE, 'q', t);
    const actual = timelineValue(MAIN_TIMELINE, 'actual', t);
    const rocketBonus = clamp((CH * 0.66 - state.rocket.y) * 55, -1200, 9000);
    const orbitAdjust = (state.session.phase === 'ORBIT_INSERT' ? (state.upper.targetLock - 1.2) * 220 : 0);
    state.telemetry.altitude = Math.max(0, baseAlt + rocketBonus + orbitAdjust * 30);
    state.telemetry.velocity = Math.max(0, baseVel + clamp(-state.rocket.vy * 55, -200, 800) + orbitAdjust * 12);
    state.telemetry.q = Math.max(0, baseQ + (state.session.phase === 'MAX_Q' ? state.session.structuralStress * 2.5 : 0));
    state.telemetry.actualTime = actual;
    state.telemetry.tPlus = formatMissionTime(actual);
    state.telemetry.lng = clamp(100 - (state.session.totalElapsed / 60) * 72 - state.upper.targetLock * 4, 3, 100);
    state.telemetry.lox = clamp(100 - (state.session.totalElapsed / 60) * 82 - state.upper.targetLock * 5, 2, 100);
    state.session.maxAltitude = Math.max(state.session.maxAltitude, state.telemetry.altitude);
    state.session.maxVelocity = Math.max(state.session.maxVelocity, state.telemetry.velocity);
    state.session.maxQ = Math.max(state.session.maxQ, state.telemetry.q);
  }

  function startPadOps() {
    resetSession();
    state.status = 'RUNNING';
    state.session.phase = 'PAD';
    state.ui.radio = 'Range is green. Fuel farm says hi.';
    Audio.setMood('pad', state.settings);
    Audio.play('ui_click', state.settings);
  }

  function pauseGame(auto) {
    if (state.status === 'READY' || state.status === 'SUMMARY' || state.status === 'GAMEOVER') return;
    if (state.status === 'RUD') return;
    state.status = auto ? 'PAUSED_AUTO' : 'PAUSED';
    Audio.stopRumble();
    updateButtons();
  }

  function resumeGame() {
    if (state.status !== 'PAUSED' && state.status !== 'PAUSED_AUTO') return;
    state.status = 'RUNNING';
    state.lastTs = 0;
    updateButtons();
  }

  function togglePause() {
    if (state.status === 'PAUSED' || state.status === 'PAUSED_AUTO') resumeGame();
    else pauseGame(false);
  }

  function toggleMute() {
    state.settings.muted = !state.settings.muted;
    saveSettings();
    Audio.setMute(state.settings);
    updateButtons();
  }

  function showOverlayMessage(msg, time) {
    state.ui.overlayMessage = msg;
    state.ui.overlayTimer = time || 2;
  }

  function spawnExhaust(kind, x, y, strength, section) {
    const count = state.settings.reducedMotion ? 3 : 10;
    Particles.burst(count, () => ({
      kind: 'fire',
      section: section || 'main',
      x: x + rand(-5, 5),
      y: y + rand(-2, 8),
      vx: rand(-0.4, 0.4),
      vy: rand(1.2, 3.4) * strength,
      life: 0.8,
      decay: rand(0.045, 0.08),
      size: rand(1.5, kind === 'be3u' ? 3.6 : 4.4),
      grow: rand(0.02, 0.08),
      alpha: 0.9,
      color: kind === 'be3u' ? (Math.random() < 0.5 ? '170,255,255' : '220,255,255') : (Math.random() < 0.5 ? '255,176,60' : '255,110,20')
    }));
    if (!state.settings.reducedMotion) {
      Particles.burst(Math.max(2, Math.round(count / 2)), () => ({
        kind: kind === 'plasma' ? 'plasma' : 'smoke',
        section: section || 'main',
        x: x + rand(-14, 14),
        y: y + rand(-2, 10),
        vx: rand(-0.5, 0.5),
        vy: rand(0.9, 2.4) * strength,
        life: 0.9,
        decay: rand(0.025, 0.055),
        size: rand(2.5, 8),
        grow: rand(0.05, 0.14),
        alpha: kind === 'be3u' ? 0.45 : 0.3,
        color: kind === 'be3u' ? '140,235,255' : '150,160,170'
      }));
    }
  }

  function spawnExplosion(x, y, section) {
    Particles.burst(state.settings.reducedMotion ? 28 : 80, () => ({
      kind: Math.random() < 0.65 ? 'fire' : 'flash',
      section: section || 'main',
      x,
      y,
      vx: rand(-4.4, 4.4),
      vy: rand(-4.4, 4.4),
      life: rand(0.5, 1),
      decay: rand(0.02, 0.06),
      size: rand(2, 6),
      grow: rand(-0.01, 0.06),
      alpha: 0.95,
      color: Math.random() < 0.35 ? '255,255,255' : (Math.random() < 0.5 ? '255,190,80' : '255,80,30')
    }));
  }

  function spawnAtmosphericObstacle() {
    const types = state.session.phase === 'ASCENT' ? ['bird', 'bird', 'drone', 'balloon'] : ['drone', 'balloon'];
    const type = types[Math.floor(Math.random() * types.length)];
    state.obstacles.push({
      type,
      x: rand(42, CW - 42),
      y: -30,
      w: type === 'balloon' ? 24 : type === 'drone' ? 30 : 22,
      h: type === 'balloon' ? 36 : type === 'drone' ? 18 : 16,
      vx: rand(-0.8, 0.8),
      vy: rand(2.4, 3.9),
      whooshed: false
    });
  }

  function spawnUpperHazard() {
    const names = ['debris', 'sat', 'micro'];
    const type = names[Math.floor(Math.random() * names.length)];
    state.upperHazards.push({
      type,
      x: rand(26, CW - 26),
      y: -18,
      w: type === 'sat' ? 34 : 18,
      h: type === 'sat' ? 18 : 10,
      vx: rand(-1.3, 1.3),
      vy: rand(1.4, 2.2)
    });
  }

  function playerInputAxis() {
    let axis = 0;
    if (state.input.left) axis -= 1;
    if (state.input.right) axis += 1;
    axis += clamp((state.input.pointerX - state.rocket.x) / 110, -1, 1) * (state.input.pointerDown ? 0.85 : 0);
    return clamp(axis, -1, 1);
  }

  function applyRocketControl(dt, lowGravity) {
    const step = dt * BASE_FPS;
    const axis = playerInputAxis();
    state.rocket.vx += axis * 0.22 * step;
    state.rocket.vx *= 0.88;
    state.rocket.vx = clamp(state.rocket.vx, -4.2, 4.2);
    state.rocket.x = clamp(state.rocket.x + state.rocket.vx * step, 28, CW - 28);
    const gravity = lowGravity ? 0.05 : 0.18;
    state.rocket.vy += gravity * step;
    state.rocket.vy *= lowGravity ? 0.992 : 0.986;
    if (state.input.boostHeld) {
      state.rocket.vy = Math.max(lowGravity ? -3.2 : -5.8, state.rocket.vy - (lowGravity ? 0.18 : 0.24) * step);
      state.rocket.burn = Math.max(state.rocket.burn, 0.08);
      spawnExhaust(lowGravity ? 'be3u' : 'be4', state.rocket.x, state.rocket.y + 28, lowGravity ? 0.7 : 1.1, state.effects.splitView ? 'upper' : 'main');
    }
    state.rocket.y = clamp(state.rocket.y + state.rocket.vy * step, lowGravity ? 40 : 74, lowGravity ? 250 : CH - 88);
    state.rocket.tilt = clamp(state.rocket.vx * 0.1, -0.34, 0.34);
    if (state.rocket.burn > 0) state.rocket.burn = Math.max(0, state.rocket.burn - dt);
  }

  function updateSky(dt, speed) {
    const step = dt * BASE_FPS;
    for (const star of state.stars.deep) {
      star.y += star.speed * speed * step;
      if (star.y > CH + 2) { star.y = -2; star.x = Math.random() * CW; }
    }
    for (const star of state.stars.mid) {
      star.y += star.speed * speed * 1.4 * step;
      if (star.y > CH + 2) { star.y = -2; star.x = Math.random() * CW; }
    }
    for (const cloud of state.clouds) {
      cloud.y += cloud.speed * speed * step;
      cloud.x += cloud.drift * step;
      if (cloud.y - cloud.h > CH) {
        cloud.y = -cloud.h;
        cloud.x = rand(-30, CW + 30);
      }
      if (cloud.x > CW + 40) cloud.x = -40;
      if (cloud.x < -40) cloud.x = CW + 40;
    }
  }

  function nearCollision(rectA, rectB) {
    return !(rectA.x + rectA.w < rectB.x || rectB.x + rectB.w < rectA.x || rectA.y + rectA.h < rectB.y || rectB.y + rectB.h < rectA.y);
  }

  function triggerRud(messageKey) {
    if (state.status === 'RUD' || state.status === 'GAMEOVER') return;
    state.status = 'RUD';
    state.effects.rudTimer = 1.5;
    state.effects.quickMessage = messageKey;
    state.ui.flash = state.settings.reducedFlashes ? 0 : 0.8;
    spawnExplosion(state.effects.splitView ? state.upper.x : state.rocket.x, state.effects.splitView ? state.upper.y : state.rocket.y, state.effects.splitView ? 'upper' : 'main');
    addShake(9, 0.5);
    vibrate([40]);
    Audio.play('rud', state.settings);
    Audio.setMood('gameover', state.settings);
    Audio.stopRumble();
  }

  function finishGameOver() {
    state.status = 'GAMEOVER';
    updateBestFlight(false);
  }

  function updateBestFlight(success) {
    const medal = missionMedal(state.session.score);
    const record = {
      name: state.session.missionName,
      medal,
      booster: state.session.boosterRecovered,
      payload: success && state.session.payloadDeployed,
      score: state.session.score
    };
    if (!state.settings.bestFlight || record.score >= (state.settings.bestFlight.score || 0)) {
      state.settings.bestFlight = record;
      state.settings.hiScore = record.score;
      saveSettings();
      updateRecordDisplay();
    }
  }

  function startSummary() {
    state.status = 'SUMMARY';
    state.settings.missionCount += 1;
    state.ui.missionPatch = createPatch();
    state.settings.patches = [state.ui.missionPatch, ...(state.settings.patches || [])].slice(0, 8);
    saveSettings();
    updateBestFlight(true);
    Audio.play('success', state.settings);
    Audio.setMood('orbital', state.settings);
  }

  function createPatch() {
    return {
      mission: state.session.missionName,
      payload: state.session.payloadDeployed ? PAYLOADS[state.session.missionNo % PAYLOADS.length] : 'TEST ARTICLE',
      date: new Date().toISOString().slice(0, 10),
      hue: (state.session.missionNo * 47) % 360
    };
  }

  function currentPhaseLabel() {
    if (state.session.phase === 'UPPER_ASCENT' && state.session.totalElapsed < PHASES.BOOSTER_LANDING.end && !state.session.boosterLost) return 'UPPER ASCENT / BOOSTER RECOVERY';
    return (PHASES[state.session.phase] || PHASES.PAD).label;
  }

  function transitionPhase(nextPhase) {
    if (state.session.phase === nextPhase) return;
    if (state.session.phase === 'PAD') {
      ratePhase('PAD', state.ui.systems.every(s => s.ok) ? 'GOLD' : 'SILVER');
      Audio.play('liftoff_horn', state.settings);
      addShake(6, 2);
    }
    if (state.session.phase === 'ASCENT') ratePhase('ASCENT', state.obstacles.length === 0 ? 'GOLD' : 'SILVER');
    if (state.session.phase === 'MAX_Q') ratePhase('MAX_Q', state.session.structuralStress < 0.3 ? 'GOLD' : state.session.structuralStress < 0.65 ? 'SILVER' : 'BRONZE');
    if (state.session.phase === 'STAGE_SEP') ratePhase('STAGE_SEP', 'GOLD');
    if (state.session.phase === 'UPPER_ASCENT') ratePhase('UPPER_ASCENT', state.upperHazards.length < 2 ? 'GOLD' : 'SILVER');
    state.session.phase = nextPhase;
    state.session.phaseElapsed = 0;
    switch (nextPhase) {
      case 'ASCENT':
        setRadio(RADIO.ASCENT, 2.2);
        Audio.setMood('ascent', state.settings);
        break;
      case 'MAX_Q':
        setRadio(RADIO.MAX_Q, 2.6);
        Audio.setMood('maxq', state.settings);
        break;
      case 'COAST':
        setRadio('Gradatim ferociter. MECO confirmed.', 2.5);
        break;
      case 'STAGE_SEP':
        Audio.play('meco', state.settings);
        Audio.play('stage_sep', state.settings);
        setRadio(RADIO.STAGE_SEP, 2.5);
        state.effects.stageSepPuff = 1;
        addShake(3, 0.3);
        break;
      case 'UPPER_ASCENT':
        state.effects.splitView = true;
        state.booster.decalVisible = true;
        setRadio(RADIO.UPPER_ASCENT, 2.4);
        Audio.setMood('triumph', state.settings);
        break;
      case 'ORBIT_INSERT':
        ratePhase('BOOSTER_LANDING', state.session.boosterRecovered ? 'GOLD' : state.session.boosterLost ? 'BRONZE' : 'SILVER');
        setRadio('SECO guidance is live. Hit the target band.', 2.7);
        Audio.setMood('orbital', state.settings);
        break;
      case 'PAYLOAD_DEPLOY':
        ratePhase('ORBIT_INSERT', state.session.orbitStatus === 'nominal' ? 'GOLD' : state.session.orbitStatus === 'low' ? 'SILVER' : 'BRONZE');
        setRadio(RADIO.PAYLOAD_DEPLOY, 2.5);
        break;
    }
  }

  function updateMission(dt) {
    state.session.phaseElapsed += dt;
    if (state.ui.radioTimer > 0) state.ui.radioTimer -= dt;
    if (state.ui.overlayTimer > 0) state.ui.overlayTimer -= dt;
    if (state.ui.flash > 0) state.ui.flash = Math.max(0, state.ui.flash - dt * 1.8);
    if (state.shake.duration > 0) {
      state.shake.duration = Math.max(0, state.shake.duration - dt);
      if (state.shake.duration === 0) state.shake.intensity = 0;
    }

    if (state.status === 'RUD') {
      state.effects.rudTimer -= dt;
      Particles.update(dt);
      if (state.effects.rudTimer <= 0) finishGameOver();
      return;
    }

    if (state.session.phase === 'PAD') updatePad(dt);
    else if (state.session.phase === 'ASCENT') updateAscent(dt);
    else if (state.session.phase === 'MAX_Q') updateMaxQ(dt);
    else if (state.session.phase === 'COAST') updateCoast(dt);
    else if (state.session.phase === 'STAGE_SEP') updateStageSep(dt);
    else if (state.session.phase === 'UPPER_ASCENT') updateSplitPhase(dt);
    else if (state.session.phase === 'ORBIT_INSERT') updateOrbitInsert(dt);
    else if (state.session.phase === 'PAYLOAD_DEPLOY') updatePayload(dt);
    else if (state.session.phase === 'EXTENDED') updateExtended(dt);

    updateTelemetry();
    Particles.update(dt);
  }

  function updatePad(dt) {
    updateSky(dt, 0.14);
    state.rocket.y = CH - 154 + Math.sin((performance.now() || 0) / 160) * 0.9;
    state.rocket.x = CW / 2;
    if (Math.random() < 0.4) spawnExhaust('be4', state.rocket.x, state.rocket.y + 34, 0.45, 'main');
    const allGreen = state.ui.systems.every(s => s.ok);
    if (state.ui.countdownStarted) {
      state.session.totalElapsed = clamp(state.session.totalElapsed + dt, 0, PHASES.PAD.end);
      Audio.updateRumble(0.3 + (10 - state.ui.countdown) * 0.04, state.settings);
      state.ui.countdown -= dt * 2;
      const nextMark = Math.max(0, Math.ceil(state.ui.countdown));
      if (nextMark < state.ui.countdownMark) {
        state.ui.countdownMark = nextMark;
        Audio.play('countdown_beep', state.settings);
      }
      if (state.ui.countdown <= 0) {
        state.session.totalElapsed = PHASES.PAD.end;
        transitionPhase('ASCENT');
      }
      addShake(1.1, 0.12);
    } else {
      state.session.totalElapsed = 0;
      Audio.updateRumble(0.05, state.settings);
      if (allGreen) state.ui.radio = 'BOOST arms ignition. You are go for launch.';
    }
  }

  function updateAscent(dt) {
    const step = dt * BASE_FPS;
    state.session.totalElapsed += dt;
    updateSky(dt, 0.6);
    applyRocketControl(dt, false);
    if (state.input.boostHeld) {
      addShake(1.2, 0.1);
      Audio.updateRumble(0.55, state.settings);
    } else {
      Audio.updateRumble(0.35, state.settings);
    }
    if (Math.random() < 0.06 * step / 3) spawnAtmosphericObstacle();
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const o = state.obstacles[i];
      o.y += o.vy * step;
      o.x += o.vx * step;
      if (o.y > CH + 30) state.obstacles.splice(i, 1);
      const dist = Math.abs(o.x - state.rocket.x) + Math.abs(o.y - state.rocket.y);
      if (!o.whooshed && dist < 90) {
        o.whooshed = true;
        Audio.play('whoosh', state.settings);
      }
      if (nearCollision({ x: state.rocket.x - 11, y: state.rocket.y - 26, w: 22, h: 52 }, { x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h })) {
        triggerRud('ascent');
        return;
      }
    }
    if (state.session.totalElapsed >= PHASES.ASCENT.end) transitionPhase('MAX_Q');
  }

  function updateMaxQ(dt) {
    state.session.totalElapsed += dt;
    updateSky(dt, 0.75);
    applyRocketControl(dt, false);
    Audio.updateRumble(0.58, state.settings);
    const axis = playerInputAxis();
    const sign = axis > 0.2 ? 1 : axis < -0.2 ? -1 : 0;
    if (sign && state.session.recentSteerSign && sign !== state.session.recentSteerSign) {
      state.session.structuralStress += 0.16 + Math.abs(state.rocket.vx) * 0.03;
      state.session.lastSteerChange = state.session.totalElapsed;
      addShake(1.4, 0.15);
    } else {
      state.session.structuralStress = Math.max(0, state.session.structuralStress - dt * 0.08);
    }
    state.session.recentSteerSign = sign || state.session.recentSteerSign;
    if (state.session.structuralStress >= 1) {
      triggerRud('maxq');
      return;
    }
    if (state.session.totalElapsed >= PHASES.MAX_Q.end) transitionPhase('COAST');
  }

  function updateCoast(dt) {
    state.session.totalElapsed += dt;
    updateSky(dt, 0.48);
    applyRocketControl(dt, true);
    Audio.updateRumble(0.24, state.settings);
    if (state.session.totalElapsed >= PHASES.COAST.end) transitionPhase('STAGE_SEP');
  }

  function updateStageSep(dt) {
    state.session.totalElapsed += dt;
    updateSky(dt, 0.2);
    state.effects.stageSepPuff = Math.max(0, state.effects.stageSepPuff - dt * 0.8);
    if (state.effects.stageSepPuff > 0.4) {
      Particles.burst(5, () => ({
        kind: 'smoke', section: 'main', x: CW / 2 + rand(-12, 12), y: CH * 0.34 + rand(-6, 6), vx: rand(-0.6, 0.6), vy: rand(-0.2, 0.4), life: 0.8, decay: 0.04, size: rand(2, 5), grow: 0.03, alpha: 0.36, color: '220,228,235'
      }));
    }
    Audio.updateRumble(0.15, state.settings);
    if (state.session.totalElapsed >= PHASES.STAGE_SEP.end) transitionPhase('UPPER_ASCENT');
  }

  function updateBooster(dt) {
    if (!state.booster.alive || state.booster.touchdown) return;
    const step = dt * BASE_FPS;
    const splitT = state.session.totalElapsed;
    const desiredAlt = timelineValue(BOOSTER_TIMELINE, 'altitude', clamp(splitT, 34, 48));
    const desiredVy = timelineValue(BOOSTER_TIMELINE, 'velocity', clamp(splitT, 34, 48));
    state.booster.vy = approach(state.booster.vy, desiredVy / 60, 0.06 * step);
    if (state.booster.burn > 0) {
      state.booster.burn = Math.max(0, state.booster.burn - dt);
      state.booster.vy -= 0.26 * step;
      spawnExhaust('be4', state.booster.x, state.booster.y + 26, 0.7, 'booster');
      if (splitT > 39 && splitT < 45) {
        Particles.burst(3, () => ({ kind: 'plasma', section: 'booster', x: state.booster.x + rand(-10, 10), y: state.booster.y + rand(-16, 16), vx: rand(-0.4, 0.4), vy: rand(-0.4, 0.4), life: 0.45, decay: 0.04, size: rand(3, 7), grow: 0.02, alpha: 0.55, color: '255,120,40' }));
      }
    }
    const steer = clamp((state.input.right ? 1 : 0) - (state.input.left ? 1 : 0), -1, 1);
    state.booster.vx = approach(state.booster.vx, steer * 2.2, 0.09 * step);
    state.booster.x = clamp(state.booster.x + state.booster.vx * step, 46, CW - 46);
    state.booster.y = lerp(46, 245, 1 - clamp(desiredAlt / 80000, 0, 1));
    if (!state.booster.reentryBurnDone && splitT >= 40.2 && splitT <= 42.8 && state.input.boostPressed) {
      state.booster.reentryBurnDone = true;
      state.booster.burn = 1.6;
      showOverlayMessage('REENTRY BURN COMMANDED', 1.2);
      Audio.play('boost', state.settings);
      addShake(2, 0.35);
    }
    if (!state.booster.landingBurnDone && splitT >= 45.5 && splitT <= 47.5 && state.input.boostPressed) {
      state.booster.landingBurnDone = true;
      state.booster.burn = 2.1;
      showOverlayMessage('LANDING BURN GO', 1.4);
      Audio.play('boost', state.settings);
    }
    if (splitT >= 48 && !state.booster.touchdown) {
      state.booster.touchdown = true;
      state.booster.touchdownVy = Math.abs(state.booster.vy * 60);
      const centered = Math.abs(state.booster.x - CW / 2) <= 10;
      const soft = state.booster.touchdownVy < 32;
      if (centered && soft && state.booster.reentryBurnDone && state.booster.landingBurnDone) {
        state.session.boosterRecovered = true;
        Audio.play('landing_touchdown', state.settings);
        setRadio(RADIO.BOOSTER_WIN, 2.5);
        addShake(4.5, 0.5);
        vibrate([40]);
      } else {
        state.session.boosterLost = true;
        showOverlayMessage('Booster lost during reentry.', 1.6);
      }
    }
  }

  function updateSplitPhase(dt) {
    state.session.totalElapsed += dt;
    state.effects.splitView = true;
    updateSky(dt, 0.18);
    applyRocketControl(dt, true);
    state.upper.x = state.rocket.x;
    state.upper.y = clamp(state.upper.y + state.rocket.vy * 0.45, 78, 210);
    state.upper.targetBand = 0.5 + Math.sin(state.session.totalElapsed * 1.6) * 0.18;
    Audio.updateRumble(state.booster.burn > 0 ? 0.42 : 0.16, state.settings);
    if (!state.rocket.fairingGone && state.session.totalElapsed >= 36) {
      state.rocket.fairingGone = true;
      state.effects.fairingSplit = 1.6;
      showOverlayMessage('FAIRING JETTISON — PAYLOAD EXPOSED', 1.8);
      addShake(2.2, 0.3);
    }
    if (Math.random() < 0.04) spawnUpperHazard();
    for (let i = state.upperHazards.length - 1; i >= 0; i--) {
      const h = state.upperHazards[i];
      h.x += h.vx;
      h.y += h.vy;
      if (h.y > 325 || h.x < -40 || h.x > CW + 40) state.upperHazards.splice(i, 1);
      if (nearCollision({ x: state.upper.x - 10, y: state.upper.y - 24, w: 20, h: 48 }, { x: h.x - h.w / 2, y: h.y - h.h / 2, w: h.w, h: h.h })) {
        triggerRud('orbit');
        return;
      }
    }
    updateBooster(dt);
    if (state.session.totalElapsed >= PHASES.UPPER_ASCENT.end) transitionPhase('ORBIT_INSERT');
  }

  function updateOrbitInsert(dt) {
    state.session.totalElapsed += dt;
    updateSky(dt, 0.08);
    state.upper.targetBand = 0.5 + Math.sin(state.session.phaseElapsed * 2.2) * 0.22;
    if (state.input.boostHeld) state.upper.throttle = clamp(state.upper.throttle + dt * 0.75, 0, 1);
    else state.upper.throttle = clamp(state.upper.throttle - dt * 0.38, 0, 1);
    const error = Math.abs(state.upper.throttle - state.upper.targetBand);
    if (error < 0.08) state.upper.targetLock += dt * 1.35;
    else state.upper.targetLock = Math.max(0, state.upper.targetLock - dt * 0.55);
    spawnExhaust('be3u', state.upper.x, state.upper.y + 24, 0.65 + state.upper.throttle * 0.5, 'upper');
    if (state.session.phaseElapsed >= 5.8) {
      if (state.upper.targetLock >= 3.2) state.session.orbitStatus = 'nominal';
      else if (state.upper.throttle < state.upper.targetBand - 0.12) state.session.orbitStatus = 'low';
      else {
        state.session.orbitStatus = 'depleted';
        triggerRud('offorbit');
        return;
      }
      transitionPhase('PAYLOAD_DEPLOY');
    }
  }

  function updatePayload(dt) {
    state.session.totalElapsed += dt;
    updateSky(dt, 0.03);
    const steer = (state.input.right ? 1 : 0) - (state.input.left ? 1 : 0);
    state.upper.deployAngle = clamp(state.upper.deployAngle + steer * dt * 1.8, -1.4, 1.4);
    if (state.input.boostPressed && !state.upper.released) {
      state.upper.released = true;
      const onTarget = Math.abs(state.upper.deployAngle) < 0.2;
      state.session.payloadDeployed = onTarget;
      ratePhase('PAYLOAD_DEPLOY', onTarget ? 'GOLD' : 'SILVER');
      startSummary();
    }
    if (state.session.phaseElapsed > 4 && !state.upper.released) {
      state.session.payloadDeployed = false;
      ratePhase('PAYLOAD_DEPLOY', 'BRONZE');
      startSummary();
    }
  }

  function updateExtended(dt) {
    state.session.totalElapsed += dt;
    updateSky(dt, 0.22);
    applyRocketControl(dt, true);
    if (Math.random() < 0.05) spawnUpperHazard();
    for (let i = state.upperHazards.length - 1; i >= 0; i--) {
      const h = state.upperHazards[i];
      h.y += h.vy * 1.2;
      if (nearCollision({ x: state.rocket.x - 10, y: state.rocket.y - 24, w: 20, h: 48 }, { x: h.x - h.w / 2, y: h.y - h.h / 2, w: h.w, h: h.h })) {
        triggerRud('orbit');
        return;
      }
      if (h.y > CH + 20) {
        state.session.score += 1;
        state.upperHazards.splice(i, 1);
      }
    }
  }

  function drawBackground(ctx, altitude, panel) {
    const grad = altitudeGradient(altitude);
    const bg = ctx.createLinearGradient(0, panel ? panel.y : 0, 0, panel ? panel.y + panel.h : CH);
    bg.addColorStop(0, grad.top);
    bg.addColorStop(1, grad.bottom);
    if (panel) ctx.fillRect(0, panel.y, CW, panel.h);
    else {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, CH);
    }
    if (panel) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, panel.y, CW, panel.h);
      ctx.clip();
      ctx.fillStyle = bg;
      ctx.fillRect(0, panel.y, CW, panel.h);
      drawStarLayers(ctx, altitude, panel.y, panel.h);
      if (altitude > 100000) drawEarthHorizon(ctx, panel.y + panel.h - 10, panel.h * 0.75);
      ctx.restore();
    } else {
      drawStarLayers(ctx, altitude, 0, CH);
      if (altitude > 100000) drawEarthHorizon(ctx, CH - 12, 280);
      if (altitude < 40000) drawCloudLayers(ctx, altitude);
    }
  }

  function drawStarLayers(ctx, altitude, y0, h) {
    const visible = clamp((altitude - 15000) / 85000, 0, 1);
    for (const star of state.stars.deep) {
      if (star.y < y0 - 4 || star.y > y0 + h + 4) continue;
      ctx.fillStyle = `rgba(180,225,255,${(0.1 + star.alpha * visible).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const star of state.stars.mid) {
      if (star.y < y0 - 4 || star.y > y0 + h + 4) continue;
      ctx.fillStyle = `rgba(120,190,255,${(0.05 + star.alpha * visible * 0.8).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEarthHorizon(ctx, y, radius) {
    ctx.save();
    ctx.translate(CW / 2, y + radius);
    ctx.fillStyle = '#07131f';
    ctx.beginPath();
    ctx.arc(0, 0, radius, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,220,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(180,255,255,0.35)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 1, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawCloudLayers(ctx, altitude) {
    const fade = clamp(1 - altitude / 18000, 0, 1);
    for (const cloud of state.clouds) {
      ctx.fillStyle = `rgba(225,238,245,${cloud.alpha * fade})`;
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.w * 0.42, cloud.h * 0.55, 0, 0, Math.PI * 2);
      ctx.ellipse(cloud.x + cloud.w * 0.2, cloud.y + 2, cloud.w * 0.28, cloud.h * 0.48, 0, 0, Math.PI * 2);
      ctx.ellipse(cloud.x - cloud.w * 0.24, cloud.y + 4, cloud.w * 0.24, cloud.h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLaunchPad(ctx) {
    const baseY = CH - 54;
    ctx.fillStyle = '#11191d';
    ctx.fillRect(0, baseY, CW, 90);
    ctx.fillStyle = '#2d3a43';
    ctx.fillRect(CW / 2 - 118, baseY - 14, 236, 14);
    ctx.fillStyle = '#41525d';
    ctx.fillRect(CW / 2 - 22, baseY - 196, 44, 182);
    ctx.fillStyle = '#647884';
    ctx.fillRect(CW / 2 + 52, baseY - 214, 12, 200);
    ctx.fillRect(CW / 2 + 40, baseY - 214, 36, 10);
    ctx.fillStyle = '#54656f';
    for (let i = 0; i < 12; i++) ctx.fillRect(CW / 2 + 52, baseY - 200 + i * 15, 12, 3);

    const labels = state.easther ? state.easther.binLabels : state.easter.binLabels;
    const stacks = [28, 48, 68, CW - 42, CW - 62, CW - 82];
    stacks.forEach((x, i) => {
      ctx.fillStyle = '#80878d';
      ctx.fillRect(x, baseY - 18 - (i % 2) * 4, 16, 10);
      ctx.strokeStyle = '#c2c7cb';
      ctx.strokeRect(x, baseY - 18 - (i % 2) * 4, 16, 10);
      ctx.fillStyle = '#0b1216';
      ctx.font = '5px "Share Tech Mono", monospace';
      ctx.fillText(labels[i % labels.length], x - 8, baseY - 22 - (i % 2) * 4);
    });

    ctx.fillStyle = '#7ea36f';
    ctx.beginPath();
    ctx.ellipse(CW / 2 - 124 + state.ui.tortoiseMoved, baseY - 6, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(CW / 2 - 132 + state.ui.tortoiseMoved, baseY - 5, 4, 3);
    ctx.fillRect(CW / 2 - 120 + state.ui.tortoiseMoved, baseY - 5, 4, 3);
    ctx.fillStyle = '#b8d6a7';
    ctx.fillText('Gradatim, my friend.', CW / 2 - 160, baseY - 26);

    if (state.ui.countdownStarted) {
      const t = state.ui.countdown;
      if (t < 8.5 && t > 8) {
        ctx.fillStyle = '#9ab2bf';
        ctx.fillRect(CW / 2 - 166 + (8.5 - t) * 80, baseY - 10, 14, 6);
        ctx.fillRect(CW / 2 - 162 + (8.5 - t) * 80, baseY - 15, 6, 5);
      }
      if (t < 15 && t > 5) {
        ctx.strokeStyle = '#ffcf5d';
        ctx.beginPath();
        ctx.moveTo(CW / 2 + 126, baseY - 12);
        ctx.lineTo(CW / 2 + 126, baseY - 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(CW / 2 + 126, baseY - 18, 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffcf5d';
        ctx.fillText('Last person leaving the pad.', CW / 2 + 70, baseY - 30);
      }
    }
  }

  function drawObstacle(ctx, o) {
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.type === 'bird') {
      ctx.strokeStyle = '#f0f3f8';
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.quadraticCurveTo(-2, -7, 3, 0); ctx.quadraticCurveTo(8, -7, 12, 0); ctx.stroke();
      ctx.fillStyle = '#ff6';
      ctx.font = '7px "Share Tech Mono", monospace';
      ctx.fillText('I ♥ FL', -10, -10);
    } else if (o.type === 'drone') {
      ctx.fillStyle = '#8ca0ad';
      ctx.fillRect(-12, -4, 24, 8);
      ctx.fillRect(-18, -1, 36, 2);
      ctx.beginPath(); ctx.arc(-16, -6, 3, 0, Math.PI * 2); ctx.arc(16, -6, 3, 0, Math.PI * 2); ctx.strokeStyle = '#cdd8df'; ctx.stroke();
    } else {
      ctx.strokeStyle = '#f7e4a8';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 12); ctx.stroke();
      ctx.fillStyle = '#ff9';
      ctx.beginPath(); ctx.arc(0, -20, 11, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawUpperHazard(ctx, h) {
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.strokeStyle = '#b8dbff';
    ctx.fillStyle = 'rgba(170,205,235,0.25)';
    if (h.type === 'sat') {
      ctx.fillRect(-8, -5, 16, 10);
      ctx.strokeRect(-8, -5, 16, 10);
      ctx.fillRect(-22, -3, 10, 6);
      ctx.fillRect(12, -3, 10, 6);
      ctx.fillStyle = '#ffcf5d';
      ctx.font = '5px "Share Tech Mono", monospace';
      ctx.fillText(Math.random() < 0.5 ? 'KEPLER (ret.)' : 'OUT OF SERVICE 1998', -26, -9);
    } else if (h.type === 'micro') {
      ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(8, 0); ctx.lineTo(-8, 6); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawRocket(ctx, x, y, tilt, mode, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    if (state.easter.bezosMode) {
      ctx.fillStyle = '#111';
      ctx.fillRect(-8, -24, 16, 5);
      ctx.fillRect(-11, -22, 6, 3);
      ctx.fillRect(5, -22, 6, 3);
    }
    ctx.fillStyle = '#f6faff';
    ctx.fillRect(-10, -14, 20, 40);
    ctx.fillStyle = '#0f1720';
    ctx.fillRect(-10, 16, 20, 10);
    ctx.fillStyle = '#3b79aa';
    ctx.fillRect(-9, -10, 18, 2);
    ctx.fillRect(-9, -5, 18, 2);
    if (!opts.fairingGone) {
      ctx.fillStyle = '#f9fdff';
      ctx.fillRect(-8, -27, 16, 13);
      ctx.beginPath(); ctx.moveTo(-8, -27); ctx.lineTo(0, -40); ctx.lineTo(8, -27); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#11171f';
    ctx.fillRect(-10, 26, 20, 6);
    ctx.fillStyle = '#657585';
    [[-7, 34], [0, 34], [7, 34], [-3, 37], [3, 37], [-10, 37], [10, 37]].forEach(p => {
      ctx.beginPath(); ctx.ellipse(p[0], p[1], 2.2, 1.4, 0, 0, Math.PI * 2); ctx.fill();
    });
    if (mode === 'booster') {
      ctx.fillStyle = '#66c9ff';
      ctx.font = 'bold 6px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Never Tell Me The Odds', 0, 4);
    }
    ctx.restore();
  }

  function drawFairingSplit(ctx) {
    if (state.effects.fairingSplit <= 0) return;
    const spread = (1.6 - state.effects.fairingSplit) * 22;
    ctx.save();
    ctx.translate(state.upper.x, state.upper.y - 24);
    ctx.fillStyle = '#f4f9ff';
    ctx.save(); ctx.translate(-spread, spread * 0.4); ctx.rotate(-0.3 - spread * 0.01); ctx.fillRect(-7, -16, 6, 22); ctx.restore();
    ctx.save(); ctx.translate(spread, spread * 0.4); ctx.rotate(0.3 + spread * 0.01); ctx.fillRect(1, -16, 6, 22); ctx.restore();
    ctx.restore();
    state.effects.fairingSplit = Math.max(0, state.effects.fairingSplit - 1 / BASE_FPS);
  }

  function drawVaporCone(ctx) {
    if (state.session.phase !== 'MAX_Q' || state.telemetry.q < 24) return;
    ctx.save();
    ctx.translate(state.rocket.x, state.rocket.y - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-34, 16);
    ctx.lineTo(34, 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawJacklyn(ctx, y0) {
    ctx.save();
    ctx.translate(CW / 2, y0 + 234);
    ctx.fillStyle = '#0e151d';
    ctx.fillRect(-76, 8, 152, 18);
    ctx.fillStyle = '#2a3540';
    ctx.fillRect(-62, -2, 124, 14);
    ctx.strokeStyle = '#ffcf5d';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-18, 4); ctx.lineTo(0, -10); ctx.lineTo(18, 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-18, -10); ctx.lineTo(0, 4); ctx.lineTo(18, -10); ctx.stroke();
    ctx.fillStyle = '#ffcf5d';
    ctx.font = '8px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('JACKLYN', 0, -16);
    ctx.restore();
  }

  function drawHud(ctx) {
    ctx.save();
    ctx.fillStyle = '#ffb300';
    ctx.font = 'bold 12px "Share Tech Mono", monospace';
    ctx.fillText(`${currentPhaseLabel()}  │  ${state.session.missionName}`, 10, 20);
    ctx.fillStyle = '#8ce0ff';
    ctx.fillText(state.telemetry.tPlus, CW - 112, 20);
    ctx.fillStyle = '#33ff33';
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillText(`ALT ${(state.telemetry.altitude / 1000).toFixed(1)} km`, 10, 40);
    ctx.fillText(`VEL ${Math.round(state.telemetry.velocity)} m/s`, 10, 54);
    ctx.fillText(`Q ${state.telemetry.q.toFixed(1)} kPa`, 10, 68);
    ctx.fillText(`LNG ${state.telemetry.lng.toFixed(1)}%`, 170, 40);
    ctx.fillText(`LOX ${state.telemetry.lox.toFixed(1)}%`, 170, 54);
    ctx.fillText(`MAX-Q STRESS ${(state.session.structuralStress * 100).toFixed(0)}%`, 170, 68);
    ctx.fillStyle = '#ffcf5d';
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillText(state.ui.radio, 10, 88);
    if (state.ui.overlayTimer > 0) {
      ctx.fillStyle = '#ffcf5d';
      ctx.fillRect(36, CH - 54, CW - 72, 22);
      ctx.fillStyle = '#041014';
      ctx.textAlign = 'center';
      ctx.fillText(state.ui.overlayMessage, CW / 2, CH - 39);
    }
    if (state.session.phase === 'MAX_Q') {
      ctx.strokeStyle = '#ff5d5d';
      ctx.strokeRect(171, 78, 120, 10);
      ctx.fillStyle = '#ff5d5d';
      ctx.fillRect(171, 78, 120 * clamp(state.session.structuralStress, 0, 1), 10);
      ctx.fillStyle = '#ff9d5d';
      ctx.fillText('THROTTLE BUCKET — RIDE IT OUT', 170, 102);
    }
    if (state.session.phase === 'ORBIT_INSERT') {
      ctx.strokeStyle = '#8ce0ff';
      ctx.strokeRect(CW - 36, 112, 14, 120);
      const targetY = 112 + (1 - state.upper.targetBand) * 120;
      ctx.fillStyle = 'rgba(140,224,255,0.25)';
      ctx.fillRect(CW - 36, targetY - 7, 14, 14);
      ctx.fillStyle = '#ffcf5d';
      ctx.fillRect(CW - 35, 112 + (1 - state.upper.throttle) * 120, 12, 6);
    }
    ctx.restore();
  }

  function drawSplitView(ctx) {
    const top = { y: 0, h: 316 };
    const bottom = { y: 324, h: CH - 324 };
    drawBackground(ctx, state.telemetry.altitude, top);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, CW, 316); ctx.clip();
    Particles.draw(ctx, 'upper');
    state.upperHazards.forEach(h => drawUpperHazard(ctx, h));
    drawRocket(ctx, state.upper.x, state.upper.y, state.rocket.tilt * 0.45, 'upper', { fairingGone: state.rocket.fairingGone });
    drawFairingSplit(ctx);
    ctx.fillStyle = '#ffcf5d';
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillText('UPPER STAGE — BE-3U', 12, 302);
    ctx.restore();

    const boosterAlt = timelineValue(BOOSTER_TIMELINE, 'altitude', clamp(state.session.totalElapsed, 34, 48));
    drawBackground(ctx, boosterAlt, bottom);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 324, CW, CH - 324); ctx.clip();
    ctx.fillStyle = 'rgba(20,70,110,0.45)';
    ctx.fillRect(0, 522, CW, CH - 522);
    drawJacklyn(ctx, 324);
    Particles.draw(ctx, 'booster');
    if (state.booster.alive) drawRocket(ctx, state.booster.x, 324 + state.booster.y, clamp(state.booster.vx * 0.04, -0.2, 0.2), 'booster', { fairingGone: true });
    ctx.fillStyle = '#ffcf5d';
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillText('BOOSTER — NEVER TELL ME THE ODDS', 12, 624);
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 316, CW, 8);
  }

  function drawReady(ctx) {
    drawBackground(ctx, 0);
    drawLaunchPad(ctx);
    drawRocket(ctx, CW / 2, CH - 154, 0, 'main', { fairingGone: false });
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#33ff33';
    ctx.textAlign = 'center';
    ctx.font = '36px "VT323", monospace';
    ctx.fillText('NEW GLENN RUNNER v2', CW / 2, 124);
    ctx.font = '12px "Share Tech Mono", monospace';
    ctx.fillStyle = '#8ce0ff';
    ctx.fillText('FIRST NEWLY-BUILT ORBITAL PAD SINCE THE 1960s', CW / 2, 154);
    ctx.fillText('LC-36 | Gradatim Ferociter', CW / 2, 174);
    ctx.fillStyle = '#ffcf5d';
    ctx.fillText(state.ui.tip, CW / 2, 202);
    ctx.strokeStyle = '#ffcf5d';
    ctx.strokeRect(86, 254, CW - 172, 42);
    ctx.font = 'bold 16px "Share Tech Mono", monospace';
    ctx.fillText('TAP OR PRESS SPACE TO BEGIN PAD OPS', CW / 2, 281);
    ctx.fillStyle = '#33ff33';
    ctx.font = '11px "Share Tech Mono", monospace';
    ctx.fillText('Tap systems green, survive Max-Q, recover the booster, hit orbit, deploy payload.', CW / 2, 336);
    ctx.fillText('Konami code unlocks Bezos Mode. That is the entire joke.', CW / 2, 356);
    if (state.settings.bestFlight) ctx.fillText(`Mission Record: ${state.settings.bestFlight.name} | ${state.settings.bestFlight.medal}`, CW / 2, 386);
    ctx.fillText('P pause | M mute | Settings in pause menu', CW / 2, 408);
  }

  function drawPadOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(18, 236, CW - 36, 214);
    ctx.strokeStyle = '#33ff33';
    ctx.strokeRect(18, 236, CW - 36, 214);
    ctx.fillStyle = '#33ff33';
    ctx.font = '18px "VT323", monospace';
    ctx.fillText('GO / NO-GO POLL', 34, 260);
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillText('Tap each system to confirm green. Then hit BOOST for T-10 ignition.', 34, 278);
    state.ui.systems.forEach(sys => {
      ctx.strokeStyle = sys.ok ? '#33ff33' : '#56666f';
      ctx.strokeRect(sys.x, sys.y, sys.w, sys.h);
      ctx.fillStyle = sys.ok ? '#33ff33' : '#8aa2b0';
      ctx.fillText(`${sys.label} ${sys.ok ? '✅' : '—'}`, sys.x + 10, sys.y + 22);
    });
    ctx.fillStyle = state.ui.systems.every(s => s.ok) ? '#ffcf5d' : '#8aa2b0';
    ctx.fillText(state.ui.countdownStarted ? `IGNITION STARTED — T-${Math.max(0, Math.ceil(state.ui.countdown))}` : 'BOOST = ARM IGNITION', 34, 428);
    ctx.restore();
  }

  function drawStageSepCard(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(40, 228, CW - 80, 84);
    ctx.strokeStyle = '#ffcf5d';
    ctx.strokeRect(40, 228, CW - 80, 84);
    ctx.fillStyle = '#ffcf5d';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px "Share Tech Mono", monospace';
    ctx.fillText('STAGE SEPARATION CONFIRMED', CW / 2, 262);
    ctx.font = '12px "Share Tech Mono", monospace';
    ctx.fillText('Gradatim Ferociter', CW / 2, 286);
    ctx.restore();
  }

  function drawSettings(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(44, 140, CW - 88, 270);
    ctx.strokeStyle = '#33ff33';
    ctx.strokeRect(44, 140, CW - 88, 270);
    ctx.fillStyle = '#33ff33';
    ctx.font = '18px "VT323", monospace';
    ctx.fillText('SETTINGS', 66, 170);
    const rows = [
      ['Sound', state.settings.sound],
      ['Music', state.settings.music],
      ['Reduced motion', state.settings.reducedMotion],
      ['Reduced flashes', state.settings.reducedFlashes],
      ['Haptics', state.settings.haptics]
    ];
    state.ui.settingRows = rows.map((row, idx) => ({ x: 66, y: 194 + idx * 34, w: 288, h: 24, key: row[0] }));
    rows.forEach((row, idx) => {
      const y = 212 + idx * 34;
      ctx.fillStyle = '#8ce0ff';
      ctx.font = '11px "Share Tech Mono", monospace';
      ctx.fillText(row[0], 70, y);
      ctx.fillStyle = row[1] ? '#33ff33' : '#ff5d5d';
      ctx.fillText(row[1] ? 'ON' : 'OFF', 290, y);
    });
    ctx.fillStyle = '#ffcf5d';
    ctx.fillText('Tap a row to toggle. RESET RECORD is in the side panel.', 70, 372);
    ctx.restore();
  }

  function drawGameOver(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#ff5d5d';
    ctx.textAlign = 'center';
    ctx.font = '34px "VT323", monospace';
    ctx.fillText('ANOMALY DETECTED', CW / 2, 212);
    ctx.font = '11px "Share Tech Mono", monospace';
    const map = {
      ascent: 'VEHICLE LOST DURING ASCENT — Investigation board convened.',
      maxq: 'STRUCTURAL FAILURE AT MAX-Q — She wasn\'t ready for that maneuver.',
      orbit: 'VEHICLE LOST IN UPPER ASCENT — Orbital debris won that round.',
      offorbit: 'PROPELLANT DEPLETED — Payload in off-nominal orbit. (Welcome to the NG-3 club.)'
    };
    ctx.fillText(map[state.effects.quickMessage] || 'VEHICLE LOST.', CW / 2, 244);
    ctx.fillStyle = '#33ff33';
    ctx.fillText(`Mission ${state.session.missionName} | ALT ${(state.session.maxAltitude / 1000).toFixed(1)} km | Booster ${state.session.boosterRecovered ? '✅' : '❌'}`, CW / 2, 278);
    ctx.fillStyle = '#ffcf5d';
    ctx.fillText('Tap canvas / BOOST / SPACE to fly again.', CW / 2, 312);
  }

  function drawSummary(ctx) {
    drawBackground(ctx, state.session.maxAltitude || 200000);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(30, 58, CW - 60, CH - 116);
    ctx.strokeStyle = '#33ff33';
    ctx.strokeRect(30, 58, CW - 60, CH - 116);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#33ff33';
    ctx.font = '28px "VT323", monospace';
    ctx.fillText(state.session.missionName, CW / 2, 96);
    ctx.font = '12px "Share Tech Mono", monospace';
    ctx.fillText(`Overall Medal: ${missionMedal(state.session.score)} | Gradatim ferociter.`, CW / 2, 120);
    drawPatch(ctx, state.ui.missionPatch, CW / 2, 182);
    ctx.fillStyle = '#8ce0ff';
    ctx.textAlign = 'left';
    ctx.fillText(`Time to orbit: ${formatMissionTime(780)}`, 60, 262);
    ctx.fillText(`Max altitude: ${(state.session.maxAltitude / 1000).toFixed(1)} km`, 60, 282);
    ctx.fillText(`Max velocity: ${Math.round(state.session.maxVelocity)} m/s`, 60, 302);
    ctx.fillText(`Booster recovered: ${state.session.boosterRecovered ? '✅' : '❌'}`, 60, 322);
    ctx.fillText(`Payload deployed: ${state.session.payloadDeployed ? '✅' : '❌'}`, 60, 342);
    const rows = ['PAD', 'ASCENT', 'MAX_Q', 'STAGE_SEP', 'BOOSTER_LANDING', 'UPPER_ASCENT', 'ORBIT_INSERT', 'PAYLOAD_DEPLOY'];
    rows.forEach((row, idx) => ctx.fillText(`${row.replace('_', ' ')}: ${state.session.phaseRatings[row] || '—'}`, 60, 370 + idx * 18));
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcf5d';
    state.ui.summaryButtons = [
      { key: 'share', x: 60, y: 544, w: 90, h: 28, label: 'Share' },
      { key: 'replay', x: 166, y: 544, w: 90, h: 28, label: 'Replay' },
      { key: 'extended', x: 272, y: 544, w: 90, h: 28, label: 'Extended' }
    ];
    state.ui.summaryButtons.forEach(btn => {
      ctx.strokeStyle = '#ffcf5d';
      ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + 18);
    });
  }

  function drawPatch(ctx, patch, cx, cy) {
    if (!patch) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = `hsl(${patch.hue}, 60%, 18%)`;
    ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffcf5d';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#8ce0ff';
    ctx.font = 'bold 18px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(patch.mission, 0, -8);
    ctx.font = '9px "Share Tech Mono", monospace';
    ctx.fillText(patch.date, 0, 12);
    ctx.fillText(patch.payload.toUpperCase(), 0, 30);
    ctx.restore();
  }

  function drawPause(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#ffcf5d';
    ctx.textAlign = 'center';
    ctx.font = '28px "VT323", monospace';
    ctx.fillText('PAUSED — tap to resume', CW / 2, CH / 2 - 18);
    ctx.font = '11px "Share Tech Mono", monospace';
    ctx.fillText('P toggles pause. M toggles mute.', CW / 2, CH / 2 + 10);
  }

  function draw() {
    const ctx = state.ctx;
    if (!ctx) return;
    ctx.setTransform(state.canvasScale, 0, 0, state.canvasScale, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    ctx.save();
    if (state.shake.duration > 0) ctx.translate((Math.random() - 0.5) * state.shake.intensity, (Math.random() - 0.5) * state.shake.intensity);

    if (state.status === 'READY') {
      drawReady(ctx);
    } else if (state.status === 'SUMMARY') {
      drawSummary(ctx);
    } else {
      if (state.effects.splitView && state.session.phase !== 'ORBIT_INSERT' && state.session.phase !== 'PAYLOAD_DEPLOY') {
        drawSplitView(ctx);
      } else {
        drawBackground(ctx, state.telemetry.altitude || 0);
        if (state.telemetry.altitude < 100000) drawLaunchPad(ctx);
        Particles.draw(ctx, 'main');
        state.obstacles.forEach(o => drawObstacle(ctx, o));
        drawVaporCone(ctx);
        if (state.status !== 'RUD') drawRocket(ctx, state.rocket.x, state.rocket.y, state.rocket.tilt, 'main', { fairingGone: state.rocket.fairingGone });
        if (state.session.phase === 'STAGE_SEP') {
          drawRocket(ctx, CW / 2, CH * 0.30, 0, 'upper', { fairingGone: false });
          drawRocket(ctx, CW / 2, CH * 0.30 + (state.session.phaseElapsed * 46), 0.05, 'booster', { fairingGone: true });
          drawStageSepCard(ctx);
        }
        if (state.session.phase === 'ORBIT_INSERT' || state.session.phase === 'PAYLOAD_DEPLOY') {
          Particles.draw(ctx, 'upper');
          drawRocket(ctx, state.upper.x, state.upper.y, state.upper.deployAngle * 0.3, 'upper', { fairingGone: true });
        }
      }
      drawHud(ctx);
      if (state.session.phase === 'PAD') drawPadOverlay(ctx);
    }

    if (state.ui.settingsOpen) drawSettings(ctx);
    if (state.status === 'PAUSED' || state.status === 'PAUSED_AUTO') drawPause(ctx);
    if (state.status === 'GAMEOVER') drawGameOver(ctx);
    if (state.status === 'RUD' && !state.settings.reducedFlashes) {
      ctx.fillStyle = `rgba(255,255,255,${state.ui.flash})`;
      ctx.fillRect(0, 0, CW, CH);
    }
    if (state.session.phase === 'MAX_Q' && !state.settings.reducedFlashes) {
      const edge = Math.min(0.4, state.session.structuralStress * 0.35 + 0.06);
      const grad = ctx.createLinearGradient(0, 0, 0, CH);
      grad.addColorStop(0, `rgba(255,60,60,${edge})`);
      grad.addColorStop(0.18, 'rgba(255,60,60,0)');
      grad.addColorStop(0.82, 'rgba(255,60,60,0)');
      grad.addColorStop(1, `rgba(255,60,60,${edge})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CW, CH);
    }
    ctx.restore();
  }

  function handleSummaryButton(key) {
    if (key === 'replay') {
      resetSession();
      startPadOps();
    } else if (key === 'extended') {
      state.status = 'RUNNING';
      state.effects.splitView = false;
      state.session.phase = 'EXTENDED';
      state.session.phaseElapsed = 0;
      state.upperHazards = [];
      state.obstacles = [];
      state.rocket.y = CH * 0.58;
      Audio.setMood('orbital', state.settings);
    } else if (key === 'share') {
      const text = `🚀 ${state.session.missionName} | ALT ${Math.round(state.session.maxAltitude / 1000)} km | T+13:00 | Booster ${state.session.boosterRecovered ? '✅' : '❌'} | Payload ${state.session.payloadDeployed ? '✅' : '❌'} | Gradatim ferociter.`;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
      showOverlayMessage('Mission summary copied to clipboard.', 1.5);
    }
  }

  function mapPointer(clientX, clientY) {
    const rect = state.canvas.getBoundingClientRect();
    return {
      x: clamp((clientX - rect.left) * (CW / rect.width), 0, CW),
      y: clamp((clientY - rect.top) * (CH / rect.height), 0, CH)
    };
  }

  function toggleSettingByRow(y) {
    if (!state.ui.settingRows) return false;
    for (const row of state.ui.settingRows) {
      if (y >= row.y && y <= row.y + row.h) {
        if (row.key === 'Sound') state.settings.sound = !state.settings.sound;
        if (row.key === 'Music') state.settings.music = !state.settings.music;
        if (row.key === 'Reduced motion') state.settings.reducedMotion = !state.settings.reducedMotion;
        if (row.key === 'Reduced flashes') state.settings.reducedFlashes = !state.settings.reducedFlashes;
        if (row.key === 'Haptics') state.settings.haptics = !state.settings.haptics;
        saveSettings();
        Audio.setMute(state.settings);
        Audio.setMood(state.session.phase === 'MAX_Q' ? 'maxq' : state.status === 'READY' ? 'idle' : 'ascent', state.settings);
        return true;
      }
    }
    return false;
  }

  function handleTap(x, y) {
    state.input.pointerX = x;
    if (state.ui.settingsOpen && toggleSettingByRow(y)) {
      Audio.play('ui_click', state.settings);
      return;
    }
    if (state.status === 'SUMMARY') {
      for (const btn of state.ui.summaryButtons) {
        if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          Audio.play('ui_click', state.settings);
          handleSummaryButton(btn.key);
          return;
        }
      }
    }
    if (state.status === 'READY') {
      startPadOps();
      return;
    }
    if (state.status === 'GAMEOVER') {
      resetSession();
      startPadOps();
      return;
    }
    if (state.status === 'PAUSED' || state.status === 'PAUSED_AUTO') {
      resumeGame();
      return;
    }
    if (state.session.phase === 'PAD') {
      const tortoiseBox = { x: CW / 2 - 142, y: CH - 72, w: 52, h: 24 };
      if (x >= tortoiseBox.x && x <= tortoiseBox.x + tortoiseBox.w && y >= tortoiseBox.y && y <= tortoiseBox.y + tortoiseBox.h) {
        state.ui.tortoiseMoved += 1;
        Audio.play('tortoise', state.settings);
        return;
      }
      for (const sys of state.ui.systems) {
        if (x >= sys.x && x <= sys.x + sys.w && y >= sys.y && y <= sys.y + sys.h) {
          sys.ok = true;
          Audio.play('ui_click', state.settings);
          return;
        }
      }
      if (state.ui.systems.every(s => s.ok) && !state.ui.countdownStarted) {
        state.ui.countdownStarted = true;
        state.ui.countdown = 10;
        state.ui.countdownMark = 10;
        Audio.play('ui_click', state.settings);
        return;
      }
    }
  }

  function setBoostHeld(value) {
    if (value && !state.input.boostHeld) {
      state.input.boostPressed = true;
      Audio.play('boost', state.settings);
    }
    state.input.boostHeld = value;
  }

  function bindTouchButtons() {
    const map = [
      ['atb-left', () => state.input.left = true, () => state.input.left = false],
      ['atb-right', () => state.input.right = true, () => state.input.right = false],
      ['atb-boost', () => {
        if (state.status === 'READY') startPadOps();
        else if (state.status === 'GAMEOVER') { resetSession(); startPadOps(); }
        else if (state.status === 'SUMMARY') handleSummaryButton('replay');
        setBoostHeld(true);
      }, () => setBoostHeld(false)]
    ];
    map.forEach(([id, down, up]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const onDown = (e) => { e.preventDefault(); down(); };
      const onUp = (e) => { e.preventDefault(); up(); };
      el.addEventListener('touchstart', onDown, { passive: false });
      el.addEventListener('touchend', onUp, { passive: false });
      el.addEventListener('mousedown', onDown);
      el.addEventListener('mouseup', onUp);
      el.addEventListener('mouseleave', onUp);
    });
  }

  function init() {
    state.canvas = document.getElementById('arcadeCanvas');
    state.wrapper = document.getElementById('arcade-fs-wrapper');
    if (!state.canvas) return;
    state.ctx = state.canvas.getContext('2d');
    state.ui.systems = freshSystems();
    updateRecordDisplay();
    updateButtons();
    resizeCanvas();
    resetSession();
    Audio.setMute(state.settings);
    Audio.setMood('idle', state.settings);

    state.canvas.addEventListener('mousedown', (e) => {
      const p = mapPointer(e.clientX, e.clientY);
      state.input.pointerDown = true;
      handleTap(p.x, p.y);
      setBoostHeld(true);
    });
    state.canvas.addEventListener('mouseup', () => { state.input.pointerDown = false; setBoostHeld(false); });
    state.canvas.addEventListener('mouseleave', () => { state.input.pointerDown = false; setBoostHeld(false); });
    state.canvas.addEventListener('mousemove', (e) => {
      const p = mapPointer(e.clientX, e.clientY);
      state.input.pointerX = p.x;
    });
    state.canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      if (!t) return;
      e.preventDefault();
      const p = mapPointer(t.clientX, t.clientY);
      state.input.pointerDown = true;
      handleTap(p.x, p.y);
      setBoostHeld(true);
    }, { passive: false });
    state.canvas.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (!t) return;
      e.preventDefault();
      const p = mapPointer(t.clientX, t.clientY);
      state.input.pointerX = p.x;
    }, { passive: false });
    state.canvas.addEventListener('touchend', (e) => { e.preventDefault(); state.input.pointerDown = false; setBoostHeld(false); }, { passive: false });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') state.input.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') state.input.right = true;
      if (e.code === 'Space') {
        e.preventDefault();
        if (state.status === 'READY') startPadOps();
        else if (state.status === 'GAMEOVER') { resetSession(); startPadOps(); }
        else if (state.status === 'SUMMARY') handleSummaryButton('replay');
        setBoostHeld(true);
      }
      if (e.code === 'KeyP') togglePause();
      if (e.code === 'KeyM') toggleMute();
      if (e.code === 'Escape' && state.ui.settingsOpen) state.ui.settingsOpen = false;
      if (e.code === 'KeyO') state.ui.settingsOpen = !state.ui.settingsOpen;
      state.input.konami.push(e.code);
      if (state.input.konami.length > KONAMI.length) state.input.konami.shift();
      if (KONAMI.every((code, idx) => state.input.konami[idx] === code)) {
        state.easter.bezosMode = !state.easter.bezosMode;
        showOverlayMessage('BEZOS MODE UNLOCKED', 1.6);
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') state.input.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') state.input.right = false;
      if (e.code === 'Space') setBoostHeld(false);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseGame(true);
      else if (state.status === 'PAUSED_AUTO') resumeGame();
    });
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('.nav-btn');
      if (!nav) return;
      setTimeout(() => {
        if (!isSectionActive()) pauseGame(true);
        else if (state.status === 'PAUSED_AUTO' && !document.hidden) resumeGame();
      }, 0);
    });
    bindTouchButtons();
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('fullscreenchange', resizeCanvas);
    document.addEventListener('webkitfullscreenchange', resizeCanvas);
    requestAnimationFrame(loop);
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!state.canvas || !state.ctx) return;
    if (!isSectionActive()) {
      pauseGame(true);
      state.lastTs = ts;
      return;
    }
    const dt = state.lastTs ? Math.min(1 / 30, (ts - state.lastTs) / 1000) : 1 / 60;
    state.lastTs = ts;
    if (state.status === 'PAUSED' || state.status === 'PAUSED_AUTO') {
      draw();
      state.input.boostPressed = false;
      return;
    }
    if (state.status === 'READY' || state.status === 'RUNNING' || state.status === 'RUD' || state.status === 'SUMMARY' || state.status === 'GAMEOVER') {
      if (state.status === 'RUNNING' || state.status === 'RUD') updateMission(dt);
      draw();
    }
    state.input.boostPressed = false;
  }

  window.arcadeReset = resetMissionRecord;
  window.arcadeFullscreen = function () {
    const wrapper = state.wrapper || document.getElementById('arcade-fs-wrapper');
    if (!wrapper) return;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fs) {
      const req = wrapper.requestFullscreen || wrapper.webkitRequestFullscreen;
      if (req) req.call(wrapper);
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    }
  };
  window.arcadeToggleMute = toggleMute;
  window.arcadeTogglePause = togglePause;
  document.addEventListener('DOMContentLoaded', init);
}());
