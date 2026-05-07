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
    difficulty: 'CADET',
    engineerPanel: false,
    hiScore: 0,
    leaderboard: [],
    missionCount: 0,
    bestFlight: null,
    achievements: [],
    patches: []
  };
  const BLOCK_LABELS = [
    ['DO NOT MOVE', 'BLOCK 7-B', 'STILL HERE', 'PROPERTY OF GSE', 'LAST INSPECTED: NEVER'],
    ['BLOCK 12-A', 'JIM SAYS LEAVE IT', 'NOT MY BLOCK', 'PAD RAT RESERVED', 'OK FOR LIFT'],
    ['STRUCTURAL', 'DO NOT PAINT', 'WAS HERE FIRST', 'CONCRETE: YES', 'TOO HEAVY'],
    ['IF MOVED, REPLACE', 'TARE: 4,400 LB', 'HOLDS DOWN PAPERWORK', 'SEE FRANK', 'STILL HERE SINCE 2019'],
    ['CALL BEFORE MOVING', 'HEAVIER THAN IT LOOKS', 'PROP OF FACILITIES', 'BLOCK ZULU', 'TBD']
  ];
  const LOADING_TIPS = [
    'New Glenn is 7 m wide. Yes, that wide.',
    'BE-4 burns liquid methane and LOX. Cleaner than kerosene.',
    'BE-3U burns hydrogen. The plume is nearly invisible in daylight.',
    'The rocket is named for John Glenn — first American in orbit, 1962.',
    "It's 9 miles from the factory to the pad. Driving to work, basically.",
    'Gradatim ferociter — step by step, ferociously.',
    'BE-4 thrust: 640,000 lbf at sea level. New Glenn has seven of them.',
    'BE-3U vacuum thrust: 200,000 lbf each. Two of them on upper stage.',
    'New Glenn payload: 13 t to GTO, 45 t to LEO.',
    'NG-1 reached orbit on first try, January 16, 2025.',
    'NG-2 landed the booster on Jacklyn — reusable orbital rocket history.',
    'The fairing volume is twice that of a 5-meter class fairing.',
    'LC-36 lightning towers are 600 feet tall.',
    'Booster lands ~620 miles (1,000 km) downrange in the Atlantic.',
    'It took 10+ years from program announcement to first orbital flight.',
    'BE-4 burns methane — cleaner than kerosene and easier to reuse.'
  ];
  const DIFFICULTY = {
    KID: { spawnMul: 0.25, hitboxScale: 0.45, graceFrames: 180, qStressGain: 0.04, qStressDecay: 0.20, landingTolerance: 28, secoBand: 280, allowFail: false },
    CADET: { spawnMul: 0.20, hitboxScale: 0.40, graceFrames: 180, qStressGain: 0.03, qStressDecay: 0.30, landingTolerance: 32, secoBand: 320, allowFail: true },
    PAD_RAT: { spawnMul: 1.0, hitboxScale: 0.7, graceFrames: 60, qStressGain: 0.16, qStressDecay: 0.08, landingTolerance: 10, secoBand: 100, allowFail: true }
  };
  const MISSION_CAPTIONS = {
    PAD: 'Pad ops complete. Countdown at T-3 and all systems are green.',
    ASCENT: 'Liftoff! Enjoy the climb — vehicle is flying nominally.',
    MAX_Q: 'Throttling down — vehicle handling Max-Q nicely.',
    SUPERSONIC: 'Passing through supersonic climb toward MECO.',
    STAGE_SEP: 'MECO. Sep clean.',
    KARMAN: 'Crossing 100 km — welcome to space.',
    BOOSTER_RTLS: 'Booster recovery ops in progress.',
    ORBIT_INSERT: 'SECO target is generous — guide velocity into the green.',
    PAYLOAD_DEPLOY: 'Payload deployed. Mission accomplished.'
  };
  const RADIO = {
    PAD: 'Pad systems nominal.',
    ASCENT: 'You are go for launch.',
    MAX_Q: 'Going through Max-Q. Holding.',
    SUPERSONIC: 'Tower clear. Roll program.',
    STAGE_SEP: 'MECO confirmed. Stage sep nominal. Booster heading home.',
    KARMAN: 'S-band lock. Telemetry green.',
    BOOSTER_RTLS: 'GS-1 on the deck. Pad rats earned their pay.',
    ORBIT_INSERT: 'SECO guidance is live. Enjoy the easy green band.',
    PAYLOAD_DEPLOY: 'Payload deployed. Mission accomplished.',
    BOOSTER_WIN: 'Landed on Jacklyn. Sea state nominal. Coffee earned.'
  };
  const LEVEL_ORDER = ['PAD', 'ASCENT', 'MAX_Q', 'SUPERSONIC', 'STAGE_SEP', 'KARMAN', 'BOOSTER_RTLS', 'ORBIT_INSERT', 'PAYLOAD_DEPLOY'];
  const LEVEL_TARGETS = {
    PAD: 800,
    ASCENT: 1300,
    MAX_Q: 1700,
    SUPERSONIC: 2200,
    STAGE_SEP: 2800,
    KARMAN: 3400,
    BOOSTER_RTLS: 4000,
    ORBIT_INSERT: 4700,
    PAYLOAD_DEPLOY: 5200
  };
  const PAYLOADS = ['Blue Ring Pathfinder', 'Twin Probes', 'BlueBird Satellite'];
  const PHASES = {
    PAD:            { label: 'LEVEL 1: PAD OPS',          start: 0,    end: 30  },
    ASCENT:         { label: 'LEVEL 2: LIFTOFF & ASCENT', start: 30,   end: 115 },
    MAX_Q:          { label: 'LEVEL 3: MAX-Q',            start: 115,  end: 130 },
    SUPERSONIC:     { label: 'LEVEL 4: SUPERSONIC',       start: 130,  end: 215 },
    STAGE_SEP:      { label: 'LEVEL 5: STAGE SEP',        start: 215,  end: 240 },
    KARMAN:         { label: 'LEVEL 6: KARMAN LINE',      start: 240,  end: 290 },
    BOOSTER_RTLS:   { label: 'LEVEL 7: BOOSTER RTLS',     start: 290,  end: 410 },
    ORBIT_INSERT:   { label: 'LEVEL 8: ORBIT INSERT',     start: 410,  end: 470 },
    PAYLOAD_DEPLOY: { label: 'LEVEL 9: PAYLOAD DEPLOY',   start: 470,  end: 500 },
    EXTENDED:       { label: 'EXTENDED MISSION',          start: 500,  end: Infinity }
  };
  const MAIN_TIMELINE = [
    { t: 0, actual: -30, altitude: 0, velocity: 0, q: 0 },
    { t: 30, actual: 0, altitude: 0, velocity: 0, q: 0.4 },
    { t: 55, actual: 25, altitude: 3000, velocity: 260, q: 9 },
    { t: 90, actual: 60, altitude: 8000, velocity: 730, q: 19 },
    { t: 115, actual: 85, altitude: 13000, velocity: 1090, q: 30 },
    { t: 130, actual: 100, altitude: 16000, velocity: 1320, q: 26 },
    { t: 180, actual: 150, altitude: 50000, velocity: 2300, q: 8 },
    { t: 215, actual: 185, altitude: 75000, velocity: 2700, q: 3 },
    { t: 219, actual: 189, altitude: 79000, velocity: 2450, q: 2.2 },
    { t: 250, actual: 235, altitude: 100000, velocity: 3200, q: 0.4 },
    { t: 290, actual: 300, altitude: 135000, velocity: 4300, q: 0 },
    { t: 410, actual: 549, altitude: 175000, velocity: 6250, q: 0 },
    { t: 470, actual: 780, altitude: 205000, velocity: 7800, q: 0 },
    { t: 500, actual: 820, altitude: 212000, velocity: 7720, q: 0 }
  ];
  const BOOSTER_TIMELINE = [
    { t: 240, altitude: 80000, velocity: -900 },
    { t: 350, altitude: 50000, velocity: -1150 },
    { t: 398, altitude: 5000, velocity: -290 },
    { t: 410, altitude: 0, velocity: -16 }
  ];
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  const PAD_POLL_FLIP_SEC = 0.5;
  const PAD_SKY_ALTITUDE_THRESHOLD = 18000;
  const OBSTACLE_WARNING_TIME = 1.5;
  const MAX_PARTICLES = 600;
  const VOICE_POOL_SIZE = 8;
  const PAD_SPRITE_H = 480;
  const ROCKET_SPRITE_W = 56;
  const ROCKET_SPRITE_H = 180;

  let skySprite = null;
  let lastSkyKey = -1;
  let padSprite = null;
  let rocketSpriteFairing = null;
  let rocketSpriteBare = null;
  let starSpriteDeep = null;
  let starSpriteMid = null;

  function makeOffscreenCanvas(width, height) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
    const cv = document.createElement('canvas');
    cv.width = width;
    cv.height = height;
    return cv;
  }

  const Settings = {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        if (merged.difficulty === 'ENGINEER') merged.difficulty = 'PAD_RAT';
        if (!DIFFICULTY[merged.difficulty]) merged.difficulty = 'CADET';
        if (!Array.isArray(merged.leaderboard)) merged.leaderboard = [];
        if (!Array.isArray(merged.achievements)) merged.achievements = [];
        return merged;
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
    let voices = [];

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
        voices = Array.from({ length: VOICE_POOL_SIZE }, () => {
          const gain = ctx.createGain();
          gain.gain.value = 0.0001;
          gain.connect(master);
          return { gain, releaseAt: 0 };
        });
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
      const voice = getVoice(t);
      const osc = ctx.createOscillator();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + duration);
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setValueAtTime(Math.max(0.0001, gain || 0.08), t);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.04, duration));
      osc.connect(voice.gain);
      osc.start(t);
      osc.stop(t + duration + 0.04);
      voice.releaseAt = t + duration;
    }

    function getVoice(time) {
      let oldest = voices[0];
      for (const voice of voices) {
        if (voice.releaseAt < time) return voice;
        if (voice.releaseAt < oldest.releaseAt) oldest = voice;
      }
      return oldest;
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
        case 'boop': tone(520, 0.06, 'sine', 0.02); tone(680, 0.08, 'triangle', 0.018); break;
        case 'level_start': tone(261.63, 0.08, 'triangle', 0.03); tone(329.63, 0.08, 'triangle', 0.03); tone(392, 0.08, 'triangle', 0.03); tone(523.25, 0.14, 'triangle', 0.04); break;
        case 'level_clear': tone(523.25, 0.1, 'triangle', 0.04); tone(392, 0.12, 'triangle', 0.04); tone(329.63, 0.14, 'triangle', 0.03); break;
        case 'star': tone(440, 0.08, 'sine', 0.03); tone(659.25, 0.12, 'triangle', 0.028); break;
      }
    }

    return { ensure, resume, play, setMood, updateRumble, stopRumble, stopMusic, setMute };
  })();

  const Particles = (() => {
    const pool = Array.from({ length: MAX_PARTICLES }, () => ({ active: false }));

    function spawn(opts) {
      let slot = null;
      for (let i = 0; i < pool.length; i++) {
        if (!pool[i].active) {
          slot = pool[i];
          break;
        }
      }
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
      for (const p of pool) {
        if (!p.active || (section && p.section !== section)) continue;
        if (p.kind === 'fire' || p.kind === 'plasma' || p.kind === 'flash') continue;
        const alpha = Math.max(0, p.life * p.alpha);
        ctx.fillStyle = `rgba(${p.color},${alpha})`;
        if (p.kind === 'streak') {
          ctx.fillRect(p.x, p.y, p.size * 2.6, 1.2);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of pool) {
        if (!p.active || (section && p.section !== section)) continue;
        if (p.kind !== 'fire' && p.kind !== 'plasma' && p.kind !== 'flash') continue;
        const alpha = Math.max(0, p.life * p.alpha);
        ctx.fillStyle = `rgba(${p.color},${alpha})`;
        if (p.kind === 'streak') {
          ctx.fillRect(p.x, p.y, p.size * 2.6, 1.2);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
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
    if (time < PHASES.SUPERSONIC.end) return 'SUPERSONIC';
    if (time < PHASES.STAGE_SEP.end) return 'STAGE_SEP';
    if (time < PHASES.KARMAN.end) return 'KARMAN';
    if (time < PHASES.BOOSTER_RTLS.end) return 'BOOSTER_RTLS';
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

  function ensureSkySprite(altitude) {
    const key = Math.floor(Math.max(0, altitude) / 1000);
    if (!skySprite) skySprite = makeOffscreenCanvas(CW, CH);
    if (key === lastSkyKey) return;
    lastSkyKey = key;
    const g = skySprite.getContext('2d');
    const grad = altitudeGradient(altitude);
    const fill = g.createLinearGradient(0, 0, 0, CH);
    fill.addColorStop(0, grad.top);
    fill.addColorStop(1, grad.bottom);
    g.fillStyle = fill;
    g.fillRect(0, 0, CW, CH);
  }

  function buildStarSprites() {
    const make = (r, color) => {
      const size = Math.ceil(r * 2) + 4;
      const cv = makeOffscreenCanvas(size, size);
      const g = cv.getContext('2d');
      g.fillStyle = color;
      g.beginPath();
      g.arc(size / 2, size / 2, r, 0, Math.PI * 2);
      g.fill();
      return cv;
    };
    starSpriteDeep = make(1.6, 'rgba(180,225,255,1)');
    starSpriteMid = make(1.2, 'rgba(120,190,255,1)');
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
        padPollTimer: 0,
        tutorialTimer: 0,
        tutorialSeen: false,
        phaseCaption: '',
        phaseCaptionTimer: 0,
        levelIntroTimer: 0,
        levelClearTimer: 0,
        levelClearPhase: '',
        pendingPhase: null,
        levelStarsPopup: 0,
        scorePops: [],
        canSkipCinematic: false,
        continueCountdown: 9,
        continueTimer: 0,
        initials: 'AAA',
        initialsIndex: 0,
        enteringInitials: false,
        karmanBannerTimer: 0,
        difficultyButtons: [],
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
        phaseGrace: 0,
        phase: 'PAD',
        failedPhase: null,
        continuesUsed: 0,
        startsByPhase: { PAD: PHASES.PAD.start },
        levelStars: {},
        totalStars: 0,
        perfectFlight: false,
        milestones: {},
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
        ascentObstacleTarget: 5,
        ascentObstacleCount: 0,
        nextAscentSpawnAt: 3,
        upperObstacleTarget: 2,
        upperObstacleCount: 0,
        nextUpperSpawnAt: 1.5,
        obstacleStreak: 0,
        summaryReady: false
      },
      world: { scrollY: 0, cameraVy: 0, padGone: false },
      telemetry: { altitude: 0, velocity: 0, q: 0, actualTime: -30, lng: 100, lox: 100, tPlus: 'T-00:30' },
      rocket: { x: CW / 2, y: CH * 0.55, vx: 0, vy: 0, tilt: 0, burn: 0, plume: 'be4', fairingGone: false, explosion: 0 },
      upper: { x: CW / 2, y: 142, vx: 0, vy: 0, throttle: 0.45, targetBand: 0.5, targetLock: 0, deployAngle: 0, released: false },
      booster: { x: CW / 2, y: 130, vx: 0, vy: 4.2, burn: 0, alive: true, reentryBurnDone: false, landingBurnDone: false, decalVisible: false, touchdown: false, touchdownVy: 0 },
      obstacles: [],
      upperHazards: [],
      effects: { fairingSplit: 0, stageSepPuff: 0, splitView: false, rudTimer: 0, quickMessage: '', delugeTimer: 0, liftoffShake: 0, shockRing: 0 },
      easter: {
        binLabels: BLOCK_LABELS[Math.floor(Math.random() * BLOCK_LABELS.length)],
        bezosMode: false,
        van: { parked: true, x: 20, y: CH - 82, beeped: false, messageShown: false }
      },
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
    if (state.settings.difficulty === 'KID') {
      const kidMap = {
        'Booster lost during reentry.': 'Whoops! Booster did a splashy practice run!',
        'SECO guidance is live. Hit the target band.': 'Nice and easy now — you got this!',
        'Range safety triggered — let’s try again!': 'Whoops! Try again!'
      };
      state.ui.radio = kidMap[message] || message;
    } else {
      state.ui.radio = message;
    }
    state.ui.radioTimer = duration || 2.5;
  }

  function currentDifficulty() {
    return DIFFICULTY[state.settings.difficulty] || DIFFICULTY.CADET;
  }

  function showPhaseCaption(phase) {
    if (state.settings.difficulty === 'PAD_RAT') return;
    const message = MISSION_CAPTIONS[phase];
    if (!message) return;
    state.ui.phaseCaption = message;
    state.ui.phaseCaptionTimer = 4;
  }

  function rocketHitboxFor(x, y, upper) {
    const hb = currentDifficulty().hitboxScale;
    if (upper) return { x: x - 10 * hb, y: y - 24 * hb, w: 20 * hb, h: 48 * hb };
    return { x: x - 11 * hb, y: y - 26 * hb, w: 22 * hb, h: 52 * hb };
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
    const labels = ['LOX LOAD', 'LNG LOAD', 'FTS ARMED', 'TVC NOMINAL', 'RANGE GREEN'];
    return labels.map((label, i) => ({ label, ok: false, x: 46 + (i % 2) * 164, y: 300 + Math.floor(i / 2) * 52, w: 148, h: 36 }));
  }

  function resetSession() {
    Particles.clear();
    state.status = 'READY';
    state.lastTs = 0;
    state.ui.settingsOpen = false;
    state.ui.radio = 'Gradatim ferociter.';
    state.ui.radioTimer = 3;
    state.ui.countdownStarted = false;
    state.ui.countdown = 3;
    state.ui.countdownMark = 3;
    state.ui.systems = freshSystems();
    state.ui.tip = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
    state.ui.padPollTimer = 0;
    state.ui.tutorialTimer = 0;
    state.ui.tutorialSeen = false;
    state.ui.phaseCaption = '';
    state.ui.phaseCaptionTimer = 0;
    state.ui.levelIntroTimer = 1.5;
    state.ui.levelClearTimer = 0;
    state.ui.levelClearPhase = '';
    state.ui.pendingPhase = null;
    state.ui.levelStarsPopup = 0;
    state.ui.scorePops = [];
    state.ui.canSkipCinematic = true;
    state.ui.continueCountdown = 9;
    state.ui.continueTimer = 0;
    state.ui.initials = 'AAA';
    state.ui.initialsIndex = 0;
    state.ui.enteringInitials = false;
    state.ui.karmanBannerTimer = 0;
    state.ui.difficultyButtons = [];
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
      phaseGrace: 0,
      phase: 'PAD',
      failedPhase: null,
      continuesUsed: 0,
      startsByPhase: { PAD: PHASES.PAD.start },
      levelStars: {},
      totalStars: 0,
      perfectFlight: false,
      milestones: {},
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
      ascentObstacleTarget: 5,
      ascentObstacleCount: 0,
      nextAscentSpawnAt: 3,
      upperObstacleTarget: 2,
      upperObstacleCount: 0,
      nextUpperSpawnAt: 1.5,
      obstacleStreak: 0,
      summaryReady: false
    };
    state.world = { scrollY: 0, cameraVy: 0, padGone: false };
    state.telemetry = { altitude: 0, velocity: 0, q: 0, actualTime: -30, lng: 100, lox: 100, tPlus: 'T-00:30' };
    state.rocket = { x: CW / 2, y: CH * 0.55, vx: 0, vy: 0, tilt: 0, burn: 0, plume: 'be4', fairingGone: false, explosion: 0 };
    state.upper = { x: CW / 2, y: 142, vx: 0, vy: 0, throttle: 0.45, targetBand: 0.5, targetLock: 0, deployAngle: 0, released: false };
    state.booster = { x: CW / 2, y: 130, vx: 0, vy: 4.2, burn: 0, alive: true, reentryBurnDone: false, landingBurnDone: false, decalVisible: false, touchdown: false, touchdownVy: 0 };
    state.obstacles = [];
    state.upperHazards = [];
    state.effects = { fairingSplit: 0, stageSepPuff: 0, splitView: false, rudTimer: 0, quickMessage: '', delugeTimer: 0, liftoffShake: 0, shockRing: 0 };
    state.easter.binLabels = BLOCK_LABELS[Math.floor(Math.random() * BLOCK_LABELS.length)];
    state.easter.van = { parked: true, x: 20, y: CH - 82, beeped: false, messageShown: false };
    Audio.setMood('idle', state.settings);
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

  function arcadeScore() {
    return Math.round(state.session.score * 250 + state.session.obstacleStreak * 40 + (state.session.boosterRecovered ? 500 : 0) + (state.session.payloadDeployed ? 500 : 0));
  }

  function starsForPhase(phase) {
    const target = LEVEL_TARGETS[phase] || 1000;
    const s = arcadeScore();
    if (s >= target * 1.3) return 3;
    if (s >= target) return 2;
    if (s >= target * 0.7) return 1;
    return 0;
  }

  function saveLeaderboardEntry(initials, success) {
    const rank = state.session.perfectFlight ? 'PERFECT FLIGHT' : missionMedal(state.session.score);
    const entry = {
      initials: (initials || 'AAA').slice(0, 3).toUpperCase(),
      mission: state.session.missionName,
      score: arcadeScore(),
      rank,
      success: !!success,
      date: new Date().toISOString().slice(0, 10)
    };
    const next = [entry, ...(state.settings.leaderboard || [])]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 10);
    state.settings.leaderboard = next;
    saveSettings();
  }

  function restartFromFailedLevel() {
    const phase = state.session.failedPhase || 'PAD';
    state.status = 'RUNNING';
    state.effects.quickMessage = '';
    state.session.phase = phase;
    state.session.phaseElapsed = 0;
    state.session.phaseGrace = currentDifficulty().graceFrames / BASE_FPS;
    state.session.totalElapsed = PHASES[phase] ? PHASES[phase].start : 0;
    state.rocket.x = CW / 2;
    state.rocket.y = CH * 0.55;
    state.rocket.vx = 0;
    state.rocket.vy = 0;
    state.obstacles = [];
    state.upperHazards = [];
    state.ui.continueTimer = 0;
    state.ui.continueCountdown = 9;
    state.ui.enteringInitials = false;
  }

  function ratePhase(name, value) {
    if (state.session.phaseRatings[name]) return;
    state.session.phaseRatings[name] = value;
    state.session.score += value === 'GOLD' ? 3 : value === 'SILVER' ? 2 : 1;
  }

  function updateTelemetry() {
    const t = clamp(state.session.totalElapsed, 0, PHASES.PAYLOAD_DEPLOY.end);
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
    state.telemetry.lng = clamp(100 - (state.session.totalElapsed / PHASES.PAYLOAD_DEPLOY.end) * 72 - state.upper.targetLock * 4, 3, 100);
    state.telemetry.lox = clamp(100 - (state.session.totalElapsed / PHASES.PAYLOAD_DEPLOY.end) * 82 - state.upper.targetLock * 5, 2, 100);
    const alt = Math.max(0, state.telemetry.altitude);
    const velocity = Math.max(0, state.telemetry.velocity);
    const temp = Math.max(216.65, 288.15 - 0.0065 * alt);
    const rho = 1.225 * Math.exp(-alt / 8500);
    const speedOfSound = Math.sqrt(1.4 * 287.05 * temp);
    const mach = speedOfSound > 0 ? velocity / speedOfSound : 0;
    const qPa = 0.5 * rho * velocity * velocity;
    const thrustN = 7 * 640000 * 4.44822;
    const dryMass = 220000;
    const propMass = ((state.telemetry.lox + state.telemetry.lng) / 200) * 1150000;
    const mass = dryMass + propMass;
    const twr = (mass > 0 ? thrustN / (mass * 9.80665) : 0);
    const g0Isp = state.session.totalElapsed < PHASES.STAGE_SEP.end ? 310 : 445;
    const deltaV = g0Isp * 9.80665 * Math.log(Math.max(1.001, mass / Math.max(dryMass, dryMass + propMass * 0.25)));
    state.telemetry.engineering = {
      density: rho,
      mach,
      qKpa: qPa / 1000,
      twr,
      deltaV
    };
    state.session.maxAltitude = Math.max(state.session.maxAltitude, state.telemetry.altitude);
    state.session.maxVelocity = Math.max(state.session.maxVelocity, state.telemetry.velocity);
    state.session.maxQ = Math.max(state.session.maxQ, state.telemetry.q);
  }

  function startPadOps() {
    resetSession();
    state.status = 'RUNNING';
    state.session.phase = 'PAD';
    if (state.settings.difficulty === 'PAD_RAT') state.settings.engineerPanel = true;
    state.ui.padPollTimer = 0;
    state.ui.radio = 'Range is green. Fuel farm says hi.';
    showPhaseCaption('PAD');
    Audio.play('level_start', state.settings);
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

  function phaseCompleteToast(name) {
    showOverlayMessage(`+ ${name.replace(/_/g, ' ')} COMPLETE`, 1.5);
    Audio.play('success', state.settings);
    if (!state.settings.reducedMotion) {
      Particles.burst(28, () => ({
        kind: 'flash',
        section: state.effects.splitView ? 'upper' : 'main',
        x: rand(80, CW - 80),
        y: rand(90, CH - 140),
        vx: rand(-0.7, 0.7),
        vy: rand(-0.6, 0.6),
        life: 0.7,
        decay: 0.05,
        size: rand(1.5, 3.2),
        grow: 0.02,
        alpha: 0.6,
        color: '150,255,200'
      }));
    }
  }

  function updateWorldScroll(dt) {
    let target = 0;
    if (state.session.phase === 'PAD') target = 0;
    else if (state.session.phase === 'ASCENT') target = 3.5;
    else if (state.session.phase === 'MAX_Q') target = 5.5;
    else if (state.session.phase === 'SUPERSONIC') target = 4.2;
    else if (state.session.phase === 'STAGE_SEP') target = 2.5;
    else if (state.session.phase === 'KARMAN') target = 2.2;
    else if (state.session.phase === 'BOOSTER_RTLS') target = 2.0;
    else target = 2.0;
    state.world.cameraVy += (target - state.world.cameraVy) * 0.04 * dt * BASE_FPS;
    state.world.scrollY += state.world.cameraVy * dt * BASE_FPS;
    state.world.padGone = state.world.scrollY > CH + 180;
  }

  function padPollDurationSeconds() {
    return state.ui.systems.length * PAD_POLL_FLIP_SEC;
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
    const alt = state.telemetry.altitude;
    let types;
    if (alt < 2000) types = ['bird', 'bird', 'bird'];
    else if (alt < 15000) types = ['balloon', 'balloon', 'bird'];
    else if (alt >= 30000 && alt <= 50000) types = ['ice', 'ice', 'balloon'];
    else if (alt >= 100000) types = ['debris', 'debris', 'ice'];
    else types = ['balloon', 'ice'];
    const type = types[Math.floor(Math.random() * types.length)];
    let x = rand(42, CW - 42);
    for (let i = 0; i < 8; i++) {
      const blocked = state.obstacles.some(o => o.y > -20 && o.y < CH + 20 && Math.abs(o.x - x) < 60);
      if (!blocked) break;
      x = rand(42, CW - 42);
    }
    state.obstacles.push({
      type,
      x,
      y: -30,
      w: type === 'balloon' ? 20 : type === 'ice' ? 28 : type === 'debris' ? 18 : 20,
      h: type === 'balloon' ? 28 : type === 'ice' ? 14 : type === 'debris' ? 12 : 14,
      vx: rand(-0.8, 0.8),
      vy: rand(1.0, 1.5),
      whooshed: false
    });
  }

  function spawnUpperHazard() {
    const names = state.telemetry.altitude >= 100000 ? ['debris', 'sat', 'micro'] : ['sat', 'micro'];
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
    const dx = state.input.pointerX - state.rocket.x;
    const pointerAxis = Math.abs(dx) <= 12 ? 0 : clamp(dx / 110, -1, 1);
    axis += pointerAxis * (state.input.pointerDown ? 0.85 : 0);
    return clamp(axis, -1, 1);
  }

  function applyRocketControl(dt, lowGravity) {
    const step = dt * BASE_FPS;
    const axis = playerInputAxis();
    state.rocket.vx += axis * 0.22 * step;
    state.rocket.vx *= 0.88;
    state.rocket.vx = clamp(state.rocket.vx, -4.2, 4.2);
    state.rocket.x = clamp(state.rocket.x + state.rocket.vx * step, 28, CW - 28);
    const gravity = lowGravity ? 0.03 : 0.08;
    state.rocket.vy += gravity * step;
    state.rocket.vy *= lowGravity ? 0.96 : 0.94;
    if (state.input.boostHeld) {
      state.rocket.vy = Math.max(lowGravity ? -1.8 : -2.8, state.rocket.vy - (lowGravity ? 0.12 : 0.2) * step);
      state.rocket.burn = Math.max(state.rocket.burn, 0.08);
      spawnExhaust(lowGravity ? 'be3u' : 'be4', state.rocket.x, state.rocket.y + 28, lowGravity ? 0.7 : 1.1, state.effects.splitView ? 'upper' : 'main');
    }
    const anchorY = CH * 0.55 + (lowGravity ? -8 : 0);
    const bob = clamp(state.rocket.vy * 1.2, -7, 7);
    state.rocket.y = approach(state.rocket.y, anchorY + bob, 0.9 * step);
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
    state.session.failedPhase = state.session.phase;
    if (state.settings.difficulty === 'KID') {
      Particles.burst(40, () => ({
        kind: 'flash',
        section: state.effects.splitView ? 'upper' : 'main',
        x: state.effects.splitView ? state.upper.x : state.rocket.x,
        y: state.effects.splitView ? state.upper.y : state.rocket.y,
        vx: rand(-2.4, 2.4),
        vy: rand(-2.4, 2.4),
        life: 0.8,
        decay: 0.05,
        size: rand(2, 5),
        grow: 0.03,
        alpha: 0.8,
        color: Math.random() < 0.33 ? '255,100,180' : Math.random() < 0.5 ? '120,255,140' : '255,220,90'
      }));
      showOverlayMessage('Whoops! Try again!', 2);
      Audio.play('boop', state.settings);
      state.rocket.x = CW / 2;
      state.rocket.y = CH * 0.55;
      state.rocket.vx = 0;
      state.rocket.vy = -1;
      state.session.phaseGrace = Math.max(state.session.phaseGrace, 3);
      return;
    }
    if (state.settings.difficulty === 'CADET') {
      Particles.burst(28, () => ({
        kind: 'smoke',
        section: state.effects.splitView ? 'upper' : 'main',
        x: state.effects.splitView ? state.upper.x : state.rocket.x,
        y: state.effects.splitView ? state.upper.y : state.rocket.y,
        vx: rand(-1.2, 1.2),
        vy: rand(-0.6, 0.9),
        life: 0.7,
        decay: 0.05,
        size: rand(2, 6),
        grow: 0.05,
        alpha: 0.5,
        color: '210,245,255'
      }));
      state.rocket.x = CW / 2;
      state.rocket.y = CH * 0.55;
      state.rocket.vx = 0;
      state.rocket.vy = -1.2;
      state.session.phaseGrace = Math.max(state.session.phaseGrace, 3);
      showOverlayMessage('Range safety triggered — let’s try again!', 2.1);
      Audio.play('boop', state.settings);
      return;
    }
    if (!currentDifficulty().allowFail) {
      Particles.burst(24, () => ({
        kind: 'smoke',
        section: state.effects.splitView ? 'upper' : 'main',
        x: state.effects.splitView ? state.upper.x : state.rocket.x,
        y: state.effects.splitView ? state.upper.y : state.rocket.y,
        vx: rand(-1.2, 1.2),
        vy: rand(-0.6, 0.9),
        life: 0.7,
        decay: 0.05,
        size: rand(2, 6),
        grow: 0.05,
        alpha: 0.5,
        color: '210,245,255'
      }));
      state.rocket.x = CW / 2;
      state.rocket.y = CH * 0.55;
      state.rocket.vx = 0;
      state.rocket.vy = -1.2;
      state.session.phaseGrace = Math.max(state.session.phaseGrace, 1);
      showOverlayMessage('Whoops! Try again — the rocket is fine.', 1.8);
      Audio.play('boop', state.settings);
      return;
    }
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
    if (state.session.continuesUsed < 3) {
      state.status = 'CONTINUE';
      state.ui.continueTimer = 9;
      state.ui.continueCountdown = 9;
    } else {
      state.status = 'GAMEOVER';
      state.ui.enteringInitials = true;
      updateBestFlight(false);
    }
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
    phaseCompleteToast('PAYLOAD_DEPLOY');
    state.status = 'SUMMARY';
    state.session.totalStars = LEVEL_ORDER.reduce((sum, key) => sum + (state.session.levelStars[key] || 0), 0);
    state.session.perfectFlight = LEVEL_ORDER.every((key) => (state.session.levelStars[key] || 0) === 3);
    if (state.settings.difficulty === 'PAD_RAT' && !state.settings.achievements.includes('Pad Rat Certified')) {
      state.settings.achievements.push('Pad Rat Certified');
    }
    state.settings.missionCount += 1;
    state.ui.missionPatch = createPatch();
    state.settings.patches = [state.ui.missionPatch, ...(state.settings.patches || [])].slice(0, 8);
    saveSettings();
    saveLeaderboardEntry('CPU', true);
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
    if (state.session.phase === 'KARMAN' || state.session.phase === 'BOOSTER_RTLS') return 'KARMAN / BOOSTER RECOVERY';
    return (PHASES[state.session.phase] || PHASES.PAD).label;
  }

  function transitionPhase(nextPhase) {
    if (state.session.phase === nextPhase) return;
    const previousPhase = state.session.phase;
    if (state.session.phase === 'PAD') {
      ratePhase('PAD', state.ui.systems.every(s => s.ok) ? 'GOLD' : 'SILVER');
      Audio.play('liftoff_horn', state.settings);
      addShake(6, 2);
    }
    if (state.session.phase === 'ASCENT') ratePhase('ASCENT', state.obstacles.length === 0 ? 'GOLD' : 'SILVER');
    if (state.session.phase === 'MAX_Q') ratePhase('MAX_Q', state.session.structuralStress < 0.3 ? 'GOLD' : state.session.structuralStress < 0.65 ? 'SILVER' : 'BRONZE');
    if (state.session.phase === 'SUPERSONIC') ratePhase('SUPERSONIC', state.session.obstacleStreak > 6 ? 'GOLD' : 'SILVER');
    if (state.session.phase === 'STAGE_SEP') ratePhase('STAGE_SEP', 'GOLD');
    if (state.session.phase === 'KARMAN') ratePhase('KARMAN', state.upperHazards.length < 2 ? 'GOLD' : 'SILVER');
    if (state.session.phase === 'BOOSTER_RTLS') ratePhase('BOOSTER_RTLS', state.session.boosterRecovered ? 'GOLD' : state.session.boosterLost ? 'BRONZE' : 'SILVER');
    state.session.levelStars[previousPhase] = starsForPhase(previousPhase);
    for (let i = 0; i < (state.session.levelStars[previousPhase] || 0); i++) Audio.play('star', state.settings);
    Audio.play('level_clear', state.settings);
    state.ui.levelStarsPopup = 1.2;
    state.ui.levelClearPhase = previousPhase;
    state.ui.levelClearTimer = 3;
    state.ui.scorePops = [
      { label: 'TIME', value: `${formatMissionTime(Math.max(0, state.telemetry.actualTime || 0)).replace('T+', '')}` },
      { label: 'SCORE', value: arcadeScore().toLocaleString() },
      { label: 'TARGET', value: (LEVEL_TARGETS[previousPhase] || 0).toLocaleString() },
      { label: 'STARS', value: '★'.repeat(state.session.levelStars[previousPhase] || 0) || '—' }
    ];
    phaseCompleteToast(previousPhase);
    state.session.phase = nextPhase;
    state.session.startsByPhase[nextPhase] = PHASES[nextPhase] ? PHASES[nextPhase].start : state.session.totalElapsed;
    state.session.phaseElapsed = 0;
    state.session.phaseGrace = currentDifficulty().graceFrames / BASE_FPS;
    state.ui.levelIntroTimer = 1.5;
    Audio.play('level_start', state.settings);
    showPhaseCaption(nextPhase);
    switch (nextPhase) {
      case 'ASCENT':
        setRadio(RADIO.ASCENT, 2.2);
        state.ui.tutorialTimer = state.ui.tutorialSeen ? 0 : 2;
        state.effects.liftoffShake = 2;
        state.effects.delugeTimer = Math.max(state.effects.delugeTimer, 3);
        state.effects.shockRing = 1;
        state.session.ascentObstacleTarget = Math.floor(rand(4, 7));
        state.session.ascentObstacleCount = 0;
        state.session.nextAscentSpawnAt = 3;
        state.session.obstacleStreak = 0;
        Audio.setMood('ascent', state.settings);
        break;
      case 'MAX_Q':
        setRadio(RADIO.MAX_Q, 2.6);
        Audio.setMood('maxq', state.settings);
        break;
      case 'SUPERSONIC':
        setRadio(RADIO.SUPERSONIC, 2.5);
        break;
      case 'STAGE_SEP':
        Audio.play('meco', state.settings);
        Audio.play('stage_sep', state.settings);
        setRadio(RADIO.STAGE_SEP, 2.5);
        state.effects.stageSepPuff = 1;
        addShake(3, 0.3);
        break;
      case 'KARMAN':
        state.effects.splitView = true;
        state.booster.decalVisible = true;
        setRadio(RADIO.KARMAN, 2.4);
        state.session.upperObstacleTarget = Math.floor(rand(1, 4));
        state.session.upperObstacleCount = 0;
        state.session.nextUpperSpawnAt = 1;
        state.ui.karmanBannerTimer = 4;
        Audio.setMood('triumph', state.settings);
        break;
      case 'BOOSTER_RTLS':
        state.effects.splitView = true;
        setRadio('Booster RTLS timeline compressed; real T+ markers preserved.', 2.8);
        break;
      case 'ORBIT_INSERT':
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
    updateWorldScroll(dt);
    state.session.phaseElapsed += dt;
    if (state.ui.radioTimer > 0) state.ui.radioTimer -= dt;
    if (state.ui.overlayTimer > 0) state.ui.overlayTimer -= dt;
    if (state.ui.phaseCaptionTimer > 0) state.ui.phaseCaptionTimer -= dt;
    if (state.ui.levelIntroTimer > 0) state.ui.levelIntroTimer = Math.max(0, state.ui.levelIntroTimer - dt);
    if (state.ui.levelClearTimer > 0) state.ui.levelClearTimer = Math.max(0, state.ui.levelClearTimer - dt);
    if (state.ui.levelStarsPopup > 0) state.ui.levelStarsPopup = Math.max(0, state.ui.levelStarsPopup - dt);
    if (state.ui.karmanBannerTimer > 0) state.ui.karmanBannerTimer = Math.max(0, state.ui.karmanBannerTimer - dt);
    if (state.ui.flash > 0) state.ui.flash = Math.max(0, state.ui.flash - dt * 1.8);
    if (state.session.phaseGrace > 0) state.session.phaseGrace = Math.max(0, state.session.phaseGrace - dt);
    if (state.effects.delugeTimer > 0) state.effects.delugeTimer = Math.max(0, state.effects.delugeTimer - dt);
    if (state.effects.shockRing > 0) state.effects.shockRing = Math.max(0, state.effects.shockRing - dt * 1.6);
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
    else if (state.session.phase === 'SUPERSONIC') updateCoast(dt);
    else if (state.session.phase === 'STAGE_SEP') updateStageSep(dt);
    else if (state.session.phase === 'KARMAN' || state.session.phase === 'BOOSTER_RTLS') updateSplitPhase(dt);
    else if (state.session.phase === 'ORBIT_INSERT') updateOrbitInsert(dt);
    else if (state.session.phase === 'PAYLOAD_DEPLOY') updatePayload(dt);
    else if (state.session.phase === 'EXTENDED') updateExtended(dt);

    updateTelemetry();
    milestone('cloud-3km', state.telemetry.actualTime >= 25, 'T+0:25 · Cumulus layer at ~3 km');
    milestone('8km', state.telemetry.actualTime >= 60, 'T+1:00 · Passing 8 km, vapor cone forming');
    milestone('maxq', state.telemetry.actualTime >= 85 && state.telemetry.actualTime <= 100, 'T+1:25-1:40 · Max-Q');
    milestone('50km', state.telemetry.actualTime >= 150, 'T+2:30 · Passing 50 km');
    milestone('meco', state.telemetry.actualTime >= 185, 'T+3:05 · MECO');
    milestone('karman', state.telemetry.actualTime >= 235 && state.telemetry.actualTime <= 240, 'T+3:55 · Karman crossing');
    milestone('reentry-burn', state.telemetry.actualTime >= 408, 'T+6:48 equivalent · Reentry burn window');
    milestone('touchdown', state.telemetry.actualTime >= 549, 'T+9:09 equivalent · Booster touchdown');
    milestone('seco', state.telemetry.actualTime >= 780, 'T+13:00 · SECO');
    Particles.update(dt);
  }

  function updateContinue(dt) {
    if (state.status !== 'CONTINUE') return;
    state.ui.continueTimer = Math.max(0, state.ui.continueTimer - dt);
    const next = Math.ceil(state.ui.continueTimer);
    if (next < state.ui.continueCountdown) {
      state.ui.continueCountdown = next;
      Audio.play('countdown_beep', state.settings);
    }
    if (state.ui.continueTimer <= 0) {
      state.status = 'GAMEOVER';
      state.ui.enteringInitials = true;
      updateBestFlight(false);
      saveLeaderboardEntry(state.ui.initials, false);
    }
  }

  function milestone(id, condition, message) {
    if (state.session.milestones[id]) return;
    if (!condition) return;
    state.session.milestones[id] = true;
    showOverlayMessage(message, 2.4);
  }

  function updatePad(dt) {
    updateSky(dt, 0.18 + state.world.cameraVy * 0.2);
    state.rocket.y = CH - 104 + Math.sin((performance.now() || 0) / 160) * 0.9;
    state.rocket.x = CW / 2;
    if (Math.random() < 0.4) spawnExhaust('be4', state.rocket.x, state.rocket.y + 34, 0.45, 'main');
    state.ui.padPollTimer += dt;
    const flipsDone = Math.floor(state.ui.padPollTimer / PAD_POLL_FLIP_SEC);
    state.ui.systems.forEach((s, i) => {
      const shouldGo = i < flipsDone;
      if (shouldGo && !s.ok) Audio.play('ui_click', state.settings);
      s.ok = shouldGo || s.ok;
    });
    const allGreen = state.ui.systems.every(s => s.ok);
    if (allGreen && !state.ui.countdownStarted) {
      state.ui.countdownStarted = true;
      state.ui.countdown = 3;
      state.ui.countdownMark = 3;
      Audio.play('success', state.settings);
    }
    if (state.ui.countdownStarted) {
      state.session.totalElapsed = clamp(state.session.totalElapsed + dt, 0, PHASES.PAD.end);
      Audio.updateRumble(0.3 + (3 - state.ui.countdown) * 0.1, state.settings);
      if (state.ui.countdown <= 3 && state.effects.delugeTimer <= 0) state.effects.delugeTimer = Math.max(state.effects.delugeTimer, state.ui.countdown + 3);
      state.ui.countdown -= dt;
      const nextMark = Math.max(0, Math.ceil(state.ui.countdown));
      if (nextMark < state.ui.countdownMark) {
        state.ui.countdownMark = nextMark;
        Audio.play('countdown_beep', state.settings);
      }
      if (state.ui.countdown <= 0) {
        state.session.totalElapsed = PHASES.PAD.end;
        state.rocket.y = CH * 0.55;
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
    const mode = currentDifficulty();
    state.session.totalElapsed += dt;
    updateSky(dt, 0.25 + state.world.cameraVy * 0.55);
    applyRocketControl(dt, false);
    if (state.ui.tutorialTimer > 0) {
      state.ui.tutorialTimer = Math.max(0, state.ui.tutorialTimer - dt);
      if (state.input.boostHeld || state.input.left || state.input.right || (state.input.pointerDown && Math.abs(state.input.pointerX - state.rocket.x) > 12)) {
        state.ui.tutorialTimer = 0;
        state.ui.tutorialSeen = true;
      }
    }
    if (state.input.boostHeld) {
      addShake(1.2, 0.1);
      Audio.updateRumble(0.55, state.settings);
    } else {
      Audio.updateRumble(0.35, state.settings);
    }
    if (state.session.phaseElapsed > 3 && state.ui.tutorialTimer <= 0) {
      if (state.session.ascentObstacleCount < state.session.ascentObstacleTarget && state.session.phaseElapsed >= state.session.nextAscentSpawnAt) {
        spawnAtmosphericObstacle();
        state.session.ascentObstacleCount += 1;
        state.session.nextAscentSpawnAt += (rand(1.8, 3.2) * 5) / Math.max(0.4, mode.spawnMul + 0.2);
      }
    }
    if (state.effects.liftoffShake > 0) {
      state.effects.liftoffShake = Math.max(0, state.effects.liftoffShake - dt);
      addShake(3.2, 0.08);
    }
    if (state.effects.delugeTimer > 0 && Math.random() < 0.9) {
      Particles.burst(5, () => ({
        kind: 'smoke',
        section: 'main',
        x: CW / 2 + rand(-30, 30),
        y: CH - 58 + rand(-8, 5),
        vx: rand(-2.5, 2.5),
        vy: rand(-2.4, -0.5),
        life: 0.7,
        decay: rand(0.05, 0.08),
        size: rand(2, 5),
        grow: 0.04,
        alpha: 0.5,
        color: '235,245,255'
      }));
    }
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const o = state.obstacles[i];
      o.y += (o.vy + state.world.cameraVy) * step;
      o.x += o.vx * step;
      if (o.y > CH + 30) {
        state.obstacles.splice(i, 1);
        state.session.obstacleStreak += 1;
        if (state.session.obstacleStreak > 0 && state.session.obstacleStreak % 5 === 0) {
          showOverlayMessage(`STREAK x${state.session.obstacleStreak}`, 1.2);
          Audio.play('boop', state.settings);
          Particles.burst(18, () => ({
            kind: 'flash',
            section: 'main',
            x: rand(60, CW - 60),
            y: rand(120, CH - 140),
            vx: rand(-0.8, 0.8),
            vy: rand(-0.8, 0.8),
            life: 0.6,
            decay: 0.06,
            size: rand(1.4, 2.8),
            grow: 0.02,
            alpha: 0.55,
            color: '255,225,120'
          }));
        }
        continue;
      }
      const dist = Math.abs(o.x - state.rocket.x) + Math.abs(o.y - state.rocket.y);
      if (!o.whooshed && dist < 90) {
        o.whooshed = true;
        Audio.play('whoosh', state.settings);
      }
      if (state.session.phaseGrace <= 0 && nearCollision(rocketHitboxFor(state.rocket.x, state.rocket.y, false), { x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h })) {
        triggerRud('ascent');
        return;
      }
    }
    if (state.session.totalElapsed >= PHASES.ASCENT.end) transitionPhase('MAX_Q');
  }

  function updateMaxQ(dt) {
    const mode = currentDifficulty();
    state.session.totalElapsed += dt;
    updateSky(dt, 0.3 + state.world.cameraVy * 0.6);
    applyRocketControl(dt, false);
    Audio.updateRumble(0.58, state.settings);
    const axis = playerInputAxis();
    const sign = axis > 0.2 ? 1 : axis < -0.2 ? -1 : 0;
    if (state.session.phaseGrace <= 0 && sign && state.session.recentSteerSign && sign !== state.session.recentSteerSign) {
      state.session.structuralStress += mode.qStressGain + Math.abs(state.rocket.vx) * 0.02;
      state.session.lastSteerChange = state.session.totalElapsed;
      addShake(1.4, 0.15);
    }
    state.session.structuralStress = Math.max(0, state.session.structuralStress - dt * mode.qStressDecay);
    if (state.settings.difficulty === 'CADET') state.session.structuralStress = Math.min(state.session.structuralStress, 0.45);
    state.session.recentSteerSign = sign || state.session.recentSteerSign;
    if (state.session.phaseElapsed > 2.5 && Math.random() < 0.018 * Math.max(0.2, mode.spawnMul)) spawnAtmosphericObstacle();
    if (state.settings.difficulty !== 'CADET' && state.session.structuralStress >= 1) {
      triggerRud('maxq');
      return;
    }
    if (state.session.totalElapsed >= PHASES.MAX_Q.end) transitionPhase('SUPERSONIC');
  }

  function updateCoast(dt) {
    const mode = currentDifficulty();
    state.session.totalElapsed += dt;
    updateSky(dt, 0.24 + state.world.cameraVy * 0.5);
    applyRocketControl(dt, false);
    Audio.updateRumble(0.35, state.settings);
    if (Math.random() < 0.013 * Math.max(0.2, mode.spawnMul)) spawnAtmosphericObstacle();
    if (state.session.totalElapsed >= PHASES.SUPERSONIC.end) transitionPhase('STAGE_SEP');
  }

  function updateStageSep(dt) {
    state.session.totalElapsed += dt;
    updateSky(dt, 0.18 + state.world.cameraVy * 0.3);
    state.effects.stageSepPuff = Math.max(0, state.effects.stageSepPuff - dt * 0.8);
    if (state.effects.stageSepPuff > 0.4) {
      Particles.burst(5, () => ({
        kind: 'smoke', section: 'main', x: CW / 2 + rand(-12, 12), y: CH * 0.34 + rand(-6, 6), vx: rand(-0.6, 0.6), vy: rand(-0.2, 0.4), life: 0.8, decay: 0.04, size: rand(2, 5), grow: 0.03, alpha: 0.36, color: '220,228,235'
      }));
    }
    Audio.updateRumble(0.15, state.settings);
    if (state.session.totalElapsed >= PHASES.STAGE_SEP.end) transitionPhase('KARMAN');
  }

  function updateBooster(dt) {
    if (!state.booster.alive || state.booster.touchdown) return;
    const step = dt * BASE_FPS;
    const splitT = state.session.totalElapsed;
    const isCadet = state.settings.difficulty === 'CADET';
    const desiredAlt = timelineValue(BOOSTER_TIMELINE, 'altitude', clamp(splitT, PHASES.KARMAN.start, PHASES.BOOSTER_RTLS.end));
    const desiredVy = timelineValue(BOOSTER_TIMELINE, 'velocity', clamp(splitT, PHASES.KARMAN.start, PHASES.BOOSTER_RTLS.end));
    state.booster.vy = approach(state.booster.vy, desiredVy / 60, 0.06 * step);
    if (state.booster.burn > 0) {
      state.booster.burn = Math.max(0, state.booster.burn - dt);
      state.booster.vy -= 0.26 * step;
      spawnExhaust('be4', state.booster.x, state.booster.y + 26, 0.7, 'booster');
      if (splitT > 330 && splitT < 380) {
        Particles.burst(3, () => ({ kind: 'plasma', section: 'booster', x: state.booster.x + rand(-10, 10), y: state.booster.y + rand(-16, 16), vx: rand(-0.4, 0.4), vy: rand(-0.4, 0.4), life: 0.45, decay: 0.04, size: rand(3, 7), grow: 0.02, alpha: 0.55, color: '255,120,40' }));
      }
    }
    const steer = clamp((state.input.right ? 1 : 0) - (state.input.left ? 1 : 0), -1, 1);
    state.booster.vx = approach(state.booster.vx, steer * 2.2, 0.09 * step);
    state.booster.x = clamp(state.booster.x + state.booster.vx * step, 46, CW - 46);
    state.booster.y = lerp(46, 245, 1 - clamp(desiredAlt / 80000, 0, 1));
    if (!state.booster.reentryBurnDone && splitT >= 344 && splitT <= 364 && (state.input.boostPressed || (isCadet && splitT >= 356))) {
      state.booster.reentryBurnDone = true;
      state.booster.burn = 1.6;
      showOverlayMessage('REENTRY BURN COMMANDED (T+6:48 EQUIVALENT)', 1.6);
      Audio.play('boost', state.settings);
      addShake(2, 0.35);
    }
    if (!state.booster.landingBurnDone && splitT >= 394 && splitT <= 408 && (state.input.boostPressed || (isCadet && splitT >= 402))) {
      state.booster.landingBurnDone = true;
      state.booster.burn = 2.1;
      showOverlayMessage('LANDING BURN GO', 1.4);
      Audio.play('boost', state.settings);
    }
    if (splitT >= PHASES.BOOSTER_RTLS.end && !state.booster.touchdown) {
      state.booster.touchdown = true;
      state.booster.touchdownVy = Math.abs(state.booster.vy * 60);
      const tol = currentDifficulty().landingTolerance;
      const centered = Math.abs(state.booster.x - CW / 2) <= tol;
      const soft = state.booster.touchdownVy < (tol * 2.4);
      if (isCadet || (centered && soft && state.booster.reentryBurnDone && state.booster.landingBurnDone)) {
        state.session.boosterRecovered = true;
        Audio.play('landing_touchdown', state.settings);
        setRadio(RADIO.BOOSTER_WIN, 2.5);
        showOverlayMessage('Landed on Jacklyn (T+9:09 equivalent).', 3);
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
    updateSky(dt, 0.14 + state.world.cameraVy * 0.28);
    if (state.effects.fairingSplit > 0) state.effects.fairingSplit = Math.max(0, state.effects.fairingSplit - dt);
    applyRocketControl(dt, true);
    state.upper.x = state.rocket.x;
    state.upper.y = clamp(state.upper.y + state.rocket.vy * 0.45, 78, 210);
    state.upper.targetBand = 0.5 + Math.sin(state.session.totalElapsed * 1.6) * 0.18;
    Audio.updateRumble(state.booster.burn > 0 ? 0.42 : 0.16, state.settings);
    if (!state.rocket.fairingGone && state.session.totalElapsed >= 255) {
      state.rocket.fairingGone = true;
      state.effects.fairingSplit = 2.0;
      showOverlayMessage('FAIRING JETTISON — PAYLOAD EXPOSED', 1.8);
      addShake(2.2, 0.3);
    }
    if (state.session.upperObstacleCount < state.session.upperObstacleTarget && state.session.phaseElapsed >= state.session.nextUpperSpawnAt) {
      spawnUpperHazard();
      state.session.upperObstacleCount += 1;
      state.session.nextUpperSpawnAt += rand(3.2, 5.5);
    }
    for (let i = state.upperHazards.length - 1; i >= 0; i--) {
      const h = state.upperHazards[i];
      h.x += h.vx;
      h.y += h.vy;
      if (h.y > 325 || h.x < -40 || h.x > CW + 40) state.upperHazards.splice(i, 1);
      if (state.session.phaseGrace <= 0 && nearCollision(rocketHitboxFor(state.upper.x, state.upper.y, true), { x: h.x - h.w / 2, y: h.y - h.h / 2, w: h.w, h: h.h })) {
        triggerRud('orbit');
        return;
      }
    }
    updateBooster(dt);
    if (state.session.totalElapsed >= PHASES.KARMAN.end && state.session.phase === 'KARMAN') transitionPhase('BOOSTER_RTLS');
    if (state.session.totalElapsed >= PHASES.BOOSTER_RTLS.end && state.session.phase === 'BOOSTER_RTLS') transitionPhase('ORBIT_INSERT');
  }

  function updateOrbitInsert(dt) {
    const mode = currentDifficulty();
    state.session.totalElapsed += dt;
    updateSky(dt, 0.1 + state.world.cameraVy * 0.2);
    state.upper.targetBand = 0.5 + Math.sin(state.session.phaseElapsed * 2.2) * 0.22;
    if (state.input.boostHeld) state.upper.throttle = clamp(state.upper.throttle + dt * 0.75, 0, 1);
    else state.upper.throttle = clamp(state.upper.throttle - dt * 0.38, 0, 1);
    const error = Math.abs(state.upper.throttle - state.upper.targetBand);
    if (error < 0.08) state.upper.targetLock += dt * 1.35;
    else state.upper.targetLock = Math.max(0, state.upper.targetLock - dt * 0.55);
    spawnExhaust('be3u', state.upper.x, state.upper.y + 24, 0.65 + state.upper.throttle * 0.5, 'upper');
    if (state.session.phaseElapsed >= (PHASES.ORBIT_INSERT.end - PHASES.ORBIT_INSERT.start - 1.5)) {
      const error = Math.abs(state.telemetry.velocity - 7800);
      if (error <= mode.secoBand) state.session.orbitStatus = 'nominal';
      else if (state.telemetry.velocity < 7800) state.session.orbitStatus = 'low';
      else {
        state.session.orbitStatus = 'depleted';
        if (mode.allowFail && state.settings.difficulty !== 'CADET') {
          triggerRud('offorbit');
          return;
        }
      }
      transitionPhase('PAYLOAD_DEPLOY');
    }
  }

  function updatePayload(dt) {
    state.session.totalElapsed += dt;
    updateSky(dt, 0.08 + state.world.cameraVy * 0.18);
    state.upper.deployAngle = approach(state.upper.deployAngle, 0.55, dt * 1.5);
    if (state.input.boostPressed && !state.upper.released) {
      state.upper.released = true;
      state.session.payloadDeployed = true;
      ratePhase('PAYLOAD_DEPLOY', 'GOLD');
      startSummary();
    }
    if (state.session.phaseElapsed > 24 && !state.upper.released) {
      state.upper.released = true;
      state.session.payloadDeployed = true;
      ratePhase('PAYLOAD_DEPLOY', 'SILVER');
      startSummary();
    }
  }

  function updateExtended(dt) {
    state.session.totalElapsed += dt;
    updateSky(dt, 0.12 + state.world.cameraVy * 0.35);
    applyRocketControl(dt, true);
    if (Math.random() < 0.05) spawnUpperHazard();
    for (let i = state.upperHazards.length - 1; i >= 0; i--) {
      const h = state.upperHazards[i];
      h.y += h.vy * 1.2;
      if (state.session.phaseGrace <= 0 && nearCollision(rocketHitboxFor(state.rocket.x, state.rocket.y, true), { x: h.x - h.w / 2, y: h.y - h.h / 2, w: h.w, h: h.h })) {
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
    const isPadSky = altitude < PAD_SKY_ALTITUDE_THRESHOLD && !state.world.padGone;
    ensureSkySprite(altitude);
    if (!panel) {
      if (isPadSky) {
        const bg = ctx.createLinearGradient(0, 0, 0, CH);
        bg.addColorStop(0, '#1a1a3a');
        bg.addColorStop(0.62, '#5a3565');
        bg.addColorStop(1, '#d4807a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CW, CH);
      } else {
        ctx.drawImage(skySprite, 0, 0);
      }
    }
    if (panel) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, panel.y, CW, panel.h);
      ctx.clip();
      if (isPadSky) {
        const bg = ctx.createLinearGradient(0, panel.y, 0, panel.y + panel.h);
        bg.addColorStop(0, '#1a1a3a');
        bg.addColorStop(0.62, '#5a3565');
        bg.addColorStop(1, '#d4807a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, panel.y, CW, panel.h);
      } else {
        ctx.drawImage(skySprite, 0, 0);
      }
      drawStarLayers(ctx, altitude, panel.y, panel.h);
      if (altitude > 100000) drawEarthHorizon(ctx, panel.y + panel.h - 10, panel.h * 0.75);
      ctx.restore();
    } else {
      drawStarLayers(ctx, altitude, 0, CH);
      if (altitude > 100000) drawEarthHorizon(ctx, CH - 12, 280);
      if (altitude < 40000) drawCloudLayers(ctx, altitude);
      if (isPadSky) {
        ctx.fillStyle = 'rgba(10,14,20,0.8)';
        ctx.fillRect(0, CH - 80, CW, 2);
      }
    }
  }

  function drawStarLayers(ctx, altitude, y0, h) {
    const visible = clamp((altitude - 15000) / 85000, 0, 1);
    const early = altitude < 15000 ? 0.18 : 0;
    if (!starSpriteDeep || !starSpriteMid) return;
    for (const star of state.stars.deep) {
      if (star.y < y0 - 4 || star.y > y0 + h + 4) continue;
      ctx.globalAlpha = clamp(0.1 + star.alpha * (visible + early), 0, 1);
      ctx.drawImage(starSpriteDeep, star.x - 2, star.y - 2, star.r * 2.4, star.r * 2.4);
    }
    for (const star of state.stars.mid) {
      if (star.y < y0 - 4 || star.y > y0 + h + 4) continue;
      ctx.globalAlpha = clamp(0.05 + star.alpha * (visible + early) * 0.8, 0, 1);
      ctx.drawImage(starSpriteMid, star.x - 2, star.y - 2, star.r * 2, star.r * 2);
    }
    ctx.globalAlpha = 1;
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

  function drawPadStatic(ctx, groundY) {
    const leftTowerX = 60;
    const rightTowerX = CW - 60;
    const towerTopY = groundY - 380;
    ctx.fillStyle = '#1d2328';
    ctx.fillRect(0, groundY, CW, 90);
    ctx.fillStyle = '#2f3a42';
    ctx.fillRect(0, groundY + 20, CW, 16);

    const mastXs = [100, 150, CW - 150, CW - 100];
    mastXs.forEach((x) => {
      const topY = groundY - 80;
      ctx.strokeStyle = '#d5dce2';
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x, topY);
      ctx.stroke();
      ctx.fillStyle = '#f8fcff';
      for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * 5 - 2, topY - 3, 4, 3);
    });

    [leftTowerX, rightTowerX].forEach((x) => {
      ctx.strokeStyle = '#edf4fa';
      ctx.beginPath();
      ctx.moveTo(x - 16, groundY);
      ctx.lineTo(x - 6, towerTopY);
      ctx.moveTo(x, groundY);
      ctx.lineTo(x, towerTopY);
      ctx.moveTo(x + 16, groundY);
      ctx.lineTo(x + 6, towerTopY);
      ctx.stroke();
      for (let y = groundY - 18; y > towerTopY + 10; y -= 18) {
        ctx.beginPath();
        ctx.moveTo(x - 12, y);
        ctx.lineTo(x + 12, y - 12);
        ctx.moveTo(x + 12, y);
        ctx.lineTo(x - 12, y - 12);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(x, towerTopY);
      ctx.lineTo(x, towerTopY - 40);
      ctx.stroke();
    });

    ctx.strokeStyle = '#dce6ef';
    ctx.fillStyle = 'rgba(180,196,210,0.18)';
    ctx.fillRect(rightTowerX - 28, groundY - 150, 20, 150);
    ctx.beginPath();
    ctx.moveTo(rightTowerX - 28, groundY);
    ctx.lineTo(rightTowerX - 28, groundY - 150);
    ctx.moveTo(rightTowerX - 8, groundY);
    ctx.lineTo(rightTowerX - 8, groundY - 150);
    ctx.stroke();
    [groundY - 34, groundY - 68, groundY - 102, groundY - 136].forEach((y) => {
      ctx.fillStyle = '#9aa7b2';
      ctx.fillRect(rightTowerX - 46, y, 38, 4);
    });

    ctx.strokeStyle = 'rgba(225,238,247,0.9)';
    ctx.beginPath();
    ctx.moveTo(leftTowerX, towerTopY - 42);
    ctx.quadraticCurveTo(CW / 2, towerTopY - 2, rightTowerX, towerTopY - 42);
    ctx.stroke();

    ctx.fillStyle = '#9aa5ad';
    ctx.fillRect(CW / 2 - 110, groundY - 16, 220, 16);
    ctx.fillStyle = '#7e8891';
    ctx.fillRect(CW / 2 - 80, groundY - 30, 160, 14);
    ctx.fillStyle = '#6f7880';
    ctx.fillRect(CW / 2 - 55, groundY - 40, 110, 10);
    ctx.fillStyle = '#0a0d12';
    ctx.beginPath();
    ctx.moveTo(CW / 2 - 25, groundY - 2);
    ctx.lineTo(CW / 2, groundY - 32);
    ctx.lineTo(CW / 2 + 25, groundY - 2);
    ctx.closePath();
    ctx.fill();

    const stacks = binBlockPositions(groundY);
    stacks.forEach(({ x, y }) => {
      ctx.fillStyle = '#80878d';
      ctx.fillRect(x, y, 18, 11);
      ctx.strokeStyle = '#c2c7cb';
      ctx.strokeRect(x, y, 18, 11);
    });
  }

  function binBlockPositions(groundY) {
    const leftCluster = [
      { x: 74, y: groundY - 20 }, { x: 94, y: groundY - 20 }, { x: 114, y: groundY - 20 },
      { x: 84, y: groundY - 31 }, { x: 104, y: groundY - 31 }, { x: 126, y: groundY - 20 }
    ];
    const rightCluster = [
      { x: 286, y: groundY - 20 }, { x: 306, y: groundY - 20 }, { x: 326, y: groundY - 20 },
      { x: 296, y: groundY - 31 }, { x: 316, y: groundY - 31 }, { x: 338, y: groundY - 20 }
    ];
    const foreground = [
      { x: 30, y: groundY - 10 }, { x: 70, y: groundY - 10 }, { x: 110, y: groundY - 10 },
      { x: 300, y: groundY - 10 }, { x: 340, y: groundY - 10 }
    ];
    return [...leftCluster, ...rightCluster, ...foreground];
  }

  function drawFloodlightCones(ctx, groundY, nowMs) {
    const pulse = 0.06 + (Math.sin(nowMs / 280) * 0.02);
    [100, 150, CW - 150, CW - 100].forEach((x) => {
      const topY = groundY - 80;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(230,245,255,${pulse.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x - 32, groundY + 36);
      ctx.lineTo(x + 32, groundY + 36);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  function drawTowerLights(ctx, groundY, nowMs) {
    const towerTopY = groundY - 380;
    const blink = Math.floor(nowMs / 500) % 2 === 0;
    [60, CW - 60].forEach((x) => {
      ctx.fillStyle = blink ? '#ff4d4d' : '#5a1a1a';
      ctx.beginPath();
      ctx.arc(x, towerTopY - 42, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawBinBlockLabels(ctx, groundY) {
    const labels = state.easter.binLabels;
    const stacks = binBlockPositions(groundY);
    ctx.fillStyle = '#0b1216';
    ctx.font = '5px "Share Tech Mono", monospace';
    stacks.forEach(({ x, y }, i) => {
      ctx.fillText(labels[i % labels.length], x - 7, y - 2);
    });
    ctx.fillStyle = '#7ea36f';
    ctx.beginPath();
    ctx.ellipse(CW / 2 - 134 + state.ui.tortoiseMoved, groundY - 6, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(CW / 2 - 142 + state.ui.tortoiseMoved, groundY - 5, 4, 3);
    ctx.fillRect(CW / 2 - 130 + state.ui.tortoiseMoved, groundY - 5, 4, 3);
  }

  function drawWhiteVan(ctx, groundY) {
    if (state.session.phase !== 'PAD') return;
    const t = state.telemetry.actualTime || -30;
    if (t >= -15 && t <= -5) {
      const u = (t + 15) / 10;
      state.easter.van.x = lerp(20, CW + 40, u);
      if (!state.easter.van.beeped && t >= -15) {
        setRadio('Last vehicle off the pad.', 2.4);
        state.easter.van.beeped = true;
      }
      if (t >= -5) state.easter.van.parked = false;
    }
    if (!state.easter.van.parked && state.easter.van.x > CW + 44) return;
    const x = state.easter.van.x;
    const y = groundY - 52;
    state.easter.van.y = y;
    ctx.save();
    ctx.fillStyle = '#f7f9fb';
    ctx.fillRect(x - 24, y - 10, 42, 20);
    ctx.fillRect(x + 10, y - 8, 16, 18);
    ctx.fillStyle = '#e2e9ef';
    ctx.fillRect(x - 16, y - 6, 12, 8);
    ctx.fillStyle = '#232a33';
    ctx.beginPath(); ctx.arc(x - 10, y + 11, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 14, y + 11, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawWaterDeluge(groundY) {
    const tPlus = state.telemetry.actualTime || -30;
    const delugeBoost = clamp(1 - Math.abs(tPlus) / 3, 0, 1);
    if (state.effects.delugeTimer <= 0 && delugeBoost <= 0) return;
    const mistAlpha = 0.3 + delugeBoost * 0.2;
    Particles.burst(6, () => ({
      kind: 'plasma',
      section: 'main',
      x: CW / 2 + rand(-34, 34),
      y: groundY - 16 + rand(-8, 8),
      vx: rand(-1.8, 1.8),
      vy: rand(-2.6, -0.8),
      life: 0.75,
      decay: 0.06,
      size: rand(5, 10),
      grow: 0.04,
      alpha: mistAlpha,
      color: '240,250,255'
    }));
  }

  function drawFlameTrenchFire(groundY) {
    if (state.session.phase !== 'ASCENT') return;
    const flame = clamp(1 - state.session.phaseElapsed / 3, 0, 1);
    if (flame <= 0) return;
    Particles.burst(4, () => ({
      kind: 'fire',
      section: 'main',
      x: CW / 2 + rand(-24, 24),
      y: groundY - 12 + rand(-3, 4),
      vx: rand(-0.9, 0.9),
      vy: rand(-2.2, -0.8),
      life: 0.5 + flame * 0.3,
      decay: 0.08,
      size: rand(3, 8),
      grow: 0.05,
      alpha: 0.6,
      color: Math.random() < 0.5 ? '255,176,60' : '255,110,20'
    }));
  }

  function buildPadSprite() {
    const cv = makeOffscreenCanvas(CW, PAD_SPRITE_H);
    const g = cv.getContext('2d');
    drawPadStatic(g, PAD_SPRITE_H - 30);
    padSprite = cv;
  }

  function drawLaunchPad(ctx) {
    const groundY = CH - 30 + state.world.scrollY;
    if (groundY > CH + 220) return;
    const nowMs = performance.now() || 0;
    const dy = state.world.scrollY + (CH - 30 - (PAD_SPRITE_H - 30));
    ctx.drawImage(padSprite, 0, dy);
    drawFloodlightCones(ctx, groundY, nowMs);
    drawTowerLights(ctx, groundY, nowMs);
    drawBinBlockLabels(ctx, groundY);
    drawWhiteVan(ctx, groundY);
    drawWaterDeluge(groundY);
    drawFlameTrenchFire(groundY);
  }

  function drawObstacle(ctx, o) {
    if (state.settings.difficulty !== 'PAD_RAT') {
      const closingRate = Math.max(0.001, (o.vy + state.world.cameraVy) * BASE_FPS);
      const closing = state.rocket.y > o.y ? (state.rocket.y - o.y) / closingRate : 9;
      if (closing <= OBSTACLE_WARNING_TIME && Math.abs(o.x - state.rocket.x) < Math.max(24, o.w * 0.9)) {
        ctx.fillStyle = 'rgba(255,220,90,0.8)';
        ctx.beginPath();
        ctx.moveTo(o.x, 8);
        ctx.lineTo(o.x - 8, 18);
        ctx.lineTo(o.x + 8, 18);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.type === 'bird') {
      ctx.strokeStyle = '#f0f3f8';
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.quadraticCurveTo(-2, -7, 3, 0); ctx.quadraticCurveTo(8, -7, 12, 0); ctx.stroke();
      ctx.fillStyle = '#ff6';
      ctx.font = '7px "Share Tech Mono", monospace';
      ctx.fillText('I ♥ FL', -10, -10);
    } else if (o.type === 'ice') {
      ctx.fillStyle = 'rgba(190,230,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-5, -8);
      ctx.lineTo(10, -6);
      ctx.lineTo(14, 5);
      ctx.lineTo(-3, 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#cde9ff';
      ctx.stroke();
    } else if (o.type === 'debris') {
      ctx.fillStyle = '#99a8b7';
      ctx.fillRect(-8, -5, 16, 10);
      ctx.strokeStyle = '#d6e3ef';
      ctx.strokeRect(-8, -5, 16, 10);
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

  function drawRocketShape(ctx, mode, opts) {
    opts = opts || {};
    if (state.easter.bezosMode && mode !== 'cache') {
      ctx.fillStyle = '#111';
      ctx.fillRect(-8, -24, 16, 5);
      ctx.fillRect(-11, -22, 6, 3);
      ctx.fillRect(5, -22, 6, 3);
    }
    const rocketBodyGrad = ctx.createLinearGradient(-9, -72, 9, 28);
    rocketBodyGrad.addColorStop(0, '#d9b188');
    rocketBodyGrad.addColorStop(0.32, '#c89968');
    rocketBodyGrad.addColorStop(1, '#b48358');
    ctx.fillStyle = rocketBodyGrad;
    ctx.fillRect(-9, -62, 18, 75);
    ctx.fillStyle = 'rgba(255,240,220,0.18)';
    ctx.fillRect(-8, -62, 4, 75);
    ctx.strokeStyle = 'rgba(70,54,40,0.4)';
    for (let sy = -52; sy <= 8; sy += 25) {
      ctx.beginPath();
      ctx.moveTo(-9, sy);
      ctx.lineTo(9, sy);
      ctx.stroke();
    }
    ctx.fillStyle = '#1a1f26';
    ctx.fillRect(-9, 13, 18, 8);
    ctx.fillStyle = '#33261d';
    ctx.fillRect(-8, -62, 16, 1);
    ctx.fillStyle = '#1d2632';
    ctx.font = 'bold 5px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NG-7', 0, -66);
    ctx.save();
    ctx.translate(0, -38);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('BLUE ORIGIN', 0, 0);
    ctx.restore();
    ctx.textAlign = 'left';
    if (!opts.fairingGone) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-9, -98, 18, 36);
      ctx.beginPath(); ctx.moveTo(-9, -98); ctx.lineTo(0, -116); ctx.lineTo(9, -98); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#1a1f26';
    ctx.fillRect(-10, 21, 20, 14);
    ctx.fillStyle = '#0c1118';
    [[0, 30], [-6, 31], [6, 31], [-10, 34], [-3, 34], [3, 34], [10, 34]].forEach(p => {
      ctx.beginPath(); ctx.ellipse(p[0], p[1], 2.4, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    });
    if (mode === 'booster') {
      ctx.fillStyle = '#66c9ff';
      ctx.font = 'bold 6px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Never Tell Me The Odds', 0, 4);
    }
    if (state.settings.difficulty === 'KID' && mode === 'main') {
      ctx.fillStyle = '#2c2c2c';
      ctx.beginPath(); ctx.arc(-3, -40, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3, -40, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2c2c2c';
      ctx.beginPath(); ctx.arc(0, -36, 3.2, 0.2, Math.PI - 0.2); ctx.stroke();
    }
  }

  function buildRocketSprites() {
    const make = (fairing) => {
      const cv = makeOffscreenCanvas(ROCKET_SPRITE_W, ROCKET_SPRITE_H);
      const g = cv.getContext('2d');
      g.translate(ROCKET_SPRITE_W / 2, 118);
      drawRocketShape(g, 'cache', { fairingGone: !fairing });
      return cv;
    };
    rocketSpriteFairing = make(true);
    rocketSpriteBare = make(false);
  }

  function drawRocket(ctx, x, y, tilt, mode, opts) {
    opts = opts || {};
    const shouldUseCache = !state.easter.bezosMode && mode !== 'booster';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    if (shouldUseCache) {
      const sprite = opts.fairingGone ? rocketSpriteBare : rocketSpriteFairing;
      ctx.drawImage(sprite, -ROCKET_SPRITE_W / 2, -118);
    } else {
      drawRocketShape(ctx, mode, opts);
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
    const padRatHud = state.settings.difficulty === 'PAD_RAT';
    ctx.save();
    ctx.fillStyle = '#8ce0ff';
    ctx.font = padRatHud ? 'bold 15px "Share Tech Mono", monospace' : 'bold 18px "Share Tech Mono", monospace';
    ctx.fillText(state.telemetry.tPlus, 10, 22);
    ctx.fillStyle = '#ffb300';
    ctx.font = padRatHud ? 'bold 10px "Share Tech Mono", monospace' : 'bold 11px "Share Tech Mono", monospace';
    ctx.fillText(`${currentPhaseLabel()}  │  ${state.session.missionName}`, 10, 38);
    const phaseOrder = ['PAD', 'ASCENT', 'MAX_Q', 'SUPERSONIC', 'STAGE_SEP', 'KARMAN', 'BOOSTER_RTLS', 'ORBIT_INSERT', 'PAYLOAD_DEPLOY'];
    const activeIdx = phaseOrder.indexOf(state.session.phase);
    phaseOrder.forEach((p, i) => {
      ctx.fillStyle = i <= activeIdx ? '#33ff33' : 'rgba(120,140,150,0.6)';
      ctx.beginPath();
      ctx.arc(230 + i * 20, 16, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#33ff33';
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillText(`ALT ${(state.telemetry.altitude / 1000).toFixed(1)} km`, 10, 54);
    ctx.fillText(`VEL ${Math.round(state.telemetry.velocity)} m/s`, 10, 68);
    ctx.fillText(`Q ${state.telemetry.q.toFixed(1)} kPa`, 10, 82);
    ctx.fillText(`LNG ${state.telemetry.lng.toFixed(1)}%`, 170, 54);
    ctx.fillText(`LOX ${state.telemetry.lox.toFixed(1)}%`, 170, 68);
    ctx.fillText(`STRESS ${(state.session.structuralStress * 100).toFixed(0)}%`, 170, 82);
    ctx.fillStyle = '#ffcf5d';
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillText(state.ui.radio, 10, 102);
    if (state.ui.overlayTimer > 0) {
      ctx.fillStyle = '#ffcf5d';
      ctx.fillRect(36, CH - 54, CW - 72, 22);
      ctx.fillStyle = '#041014';
      ctx.textAlign = 'center';
      ctx.fillText(state.ui.overlayMessage, CW / 2, CH - 39);
    }
    if (state.session.phase === 'MAX_Q') {
      ctx.strokeStyle = '#ff5d5d';
      ctx.strokeRect(171, 90, 120, 10);
      ctx.fillStyle = '#ff5d5d';
      ctx.fillRect(171, 90, 120 * clamp(state.session.structuralStress, 0, 1), 10);
      ctx.fillStyle = 'rgba(255,220,90,0.45)';
      ctx.fillRect(171 + 120 * 0.72, 90, 120 * 0.28, 10);
      ctx.fillStyle = '#ff9d5d';
      ctx.fillText('Throttling down — handling Max-Q nicely.', 170, 114);
    }
    if ((state.session.phase === 'KARMAN' || state.session.phase === 'BOOSTER_RTLS') && !state.booster.touchdown) {
      const t = state.session.totalElapsed;
      if (!state.booster.reentryBurnDone && t >= 344 && t <= 364) {
        ctx.fillStyle = 'rgba(255,207,93,0.85)';
        ctx.fillRect(CW - 152, CH - 74, 136, 18);
        ctx.fillStyle = '#041014';
        ctx.fillText('REENTRY BURN READY', CW - 146, CH - 61);
      }
      if (!state.booster.landingBurnDone && t >= 394 && t <= 408) {
        ctx.fillStyle = 'rgba(150,255,190,0.85)';
        ctx.fillRect(CW - 152, CH - 52, 136, 18);
        ctx.fillStyle = '#041014';
        ctx.fillText('LANDING BURN READY', CW - 146, CH - 39);
      }
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
    if (state.settings.difficulty === 'PAD_RAT' && state.settings.engineerPanel) {
      const eng = state.telemetry.engineering || {};
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(CW - 170, 120, 160, 106);
      ctx.strokeStyle = '#8ce0ff';
      ctx.strokeRect(CW - 170, 120, 160, 106);
      ctx.fillStyle = '#8ce0ff';
      ctx.fillText(`ΔV ${(eng.deltaV || 0).toFixed(0)} m/s`, CW - 164, 136);
      ctx.fillText(`Mach ${(eng.mach || 0).toFixed(2)}`, CW - 164, 150);
      ctx.fillText(`ρ ${(eng.density || 0).toFixed(3)} kg/m³`, CW - 164, 164);
      ctx.fillText(`T/W ${(eng.twr || 0).toFixed(2)}`, CW - 164, 178);
      ctx.fillText(`q ${(eng.qKpa || 0).toFixed(1)} kPa`, CW - 164, 192);
      ctx.strokeStyle = 'rgba(140,224,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(CW - 164, 212);
      ctx.lineTo(CW - 20, 212 - clamp((eng.qKpa || 0) * 0.15, 0, 36));
      ctx.stroke();
    }
    if (state.session.phaseGrace > 0) {
      const pulse = 0.45 + Math.sin((performance.now() || 0) / 150) * 0.2;
      ctx.strokeStyle = `rgba(120,255,170,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.rocket.x, state.rocket.y, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#9df6bf';
      ctx.fillText('GRACE', state.rocket.x - 14, state.rocket.y - 32);
    }
    if (state.ui.tutorialTimer > 0 && state.session.phase === 'ASCENT') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(58, CH - 112, CW - 116, 32);
      ctx.strokeStyle = '#ffcf5d';
      ctx.strokeRect(58, CH - 112, CW - 116, 32);
      ctx.fillStyle = '#ffcf5d';
      ctx.textAlign = 'center';
      ctx.fillText('Hold BOOST to climb. ◀▶ to steer.', CW / 2, CH - 92);
      ctx.textAlign = 'left';
    }
    if (state.ui.phaseCaptionTimer > 0 && state.ui.phaseCaption) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(24, 116, CW - 48, 28);
      ctx.strokeStyle = '#8ce0ff';
      ctx.strokeRect(24, 116, CW - 48, 28);
      ctx.fillStyle = '#8ce0ff';
      ctx.textAlign = 'center';
      ctx.fillText(state.ui.phaseCaption, CW / 2, 134);
      ctx.textAlign = 'left';
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

    const boosterAlt = timelineValue(BOOSTER_TIMELINE, 'altitude', clamp(state.session.totalElapsed, PHASES.KARMAN.start, PHASES.BOOSTER_RTLS.end));
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
    drawRocket(ctx, CW / 2, CH - 104, 0, 'main', { fairingGone: false });
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
    state.ui.difficultyButtons = [
      { mode: 'KID', x: 80, y: 302, w: 78, h: 24 },
      { mode: 'CADET', x: 171, y: 302, w: 78, h: 24 },
      { mode: 'PAD_RAT', x: 262, y: 302, w: 78, h: 24 }
    ];
    state.ui.difficultyButtons.forEach((btn) => {
      const active = state.settings.difficulty === btn.mode;
      ctx.strokeStyle = active ? '#33ff33' : '#8aa2b0';
      ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
      ctx.fillStyle = active ? '#33ff33' : '#8aa2b0';
      ctx.fillText(btn.mode === 'PAD_RAT' ? 'PAD RAT' : btn.mode, btn.x + btn.w / 2, btn.y + 16);
    });
    ctx.fillStyle = '#33ff33';
    ctx.font = '11px "Share Tech Mono", monospace';
    ctx.fillText('Auto-poll pad, survive Max-Q, recover booster, hit orbit, deploy payload.', CW / 2, 346);
    ctx.fillText('Konami code unlocks Bezos Mode. That is the entire joke.', CW / 2, 366);
    if (state.settings.bestFlight) ctx.fillText(`Mission Record: ${state.settings.bestFlight.name} | ${state.settings.bestFlight.medal}`, CW / 2, 386);
    ctx.fillText('P pause | M mute | Settings in pause menu', CW / 2, 408);
  }

  function drawPadOverlay(ctx) {
    const pollSeconds = padPollDurationSeconds().toFixed(1);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(18, 236, CW - 36, 214);
    ctx.strokeStyle = '#33ff33';
    ctx.strokeRect(18, 236, CW - 36, 214);
    ctx.fillStyle = '#33ff33';
    ctx.font = '18px "VT323", monospace';
    ctx.fillText('AUTO GO / NO-GO POLL', 34, 260);
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillText(`Systems auto-flip green in ${pollSeconds}s. Tap once to skip directly to liftoff.`, 34, 278);
    state.ui.systems.forEach(sys => {
      ctx.strokeStyle = sys.ok ? '#33ff33' : '#56666f';
      ctx.strokeRect(sys.x, sys.y, sys.w, sys.h);
      ctx.fillStyle = sys.ok ? '#33ff33' : '#8aa2b0';
      ctx.fillText(`${sys.label} ${sys.ok ? '✅' : '—'}`, sys.x + 10, sys.y + 22);
    });
    ctx.fillStyle = state.ui.systems.every(s => s.ok) ? '#ffcf5d' : '#8aa2b0';
    ctx.fillText(state.ui.countdownStarted ? `IGNITION STARTED — T-${Math.max(0, Math.ceil(state.ui.countdown))}` : 'AUTOMATED POLL IN PROGRESS (T-3 START)', 34, 446);
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
      ['Haptics', state.settings.haptics],
      ['Telemetry panel', state.settings.engineerPanel]
    ];
    state.ui.settingRows = rows.map((row, idx) => ({ x: 66, y: 194 + idx * 30, w: 288, h: 24, key: row[0] }));
    rows.forEach((row, idx) => {
      const y = 212 + idx * 30;
      ctx.fillStyle = '#8ce0ff';
      ctx.font = '11px "Share Tech Mono", monospace';
      ctx.fillText(row[0], 70, y);
      ctx.fillStyle = row[1] ? '#33ff33' : '#ff5d5d';
      ctx.fillText(row[1] ? 'ON' : 'OFF', 290, y);
    });
    ctx.fillStyle = '#ffcf5d';
    ctx.fillText(`Difficulty: ${state.settings.difficulty}`, 70, 356);
    ctx.fillText('Tap a row to toggle. RESET RECORD is in the side panel.', 70, 374);
    ctx.restore();
  }

  function drawGameOver(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#ff5d5d';
    ctx.textAlign = 'center';
    ctx.font = '34px "VT323", monospace';
    ctx.fillText('MISSION FAILED', CW / 2, 212);
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
    if (state.status === 'CONTINUE') {
      ctx.fillText(`CONTINUE? ${Math.max(0, state.ui.continueCountdown)}...`, CW / 2, 312);
      ctx.fillText(`Tap to restart level (${state.session.continuesUsed}/3 used)`, CW / 2, 330);
    } else if (state.ui.enteringInitials) {
      ctx.fillText(`ENTER INITIALS: ${state.ui.initials}`, CW / 2, 312);
      ctx.fillText('Type A-Z, Backspace to edit, Enter to save.', CW / 2, 330);
      const board = (state.settings.leaderboard || []).slice(0, 5);
      ctx.textAlign = 'left';
      ctx.fillText('TOP PILOTS', 64, 366);
      board.forEach((row, i) => ctx.fillText(`${String(i + 1).padStart(2, '0')} ${row.initials}  ${row.score}  ${row.rank}`, 64, 386 + i * 16));
    } else {
      ctx.fillText('Tap canvas / BOOST / SPACE to fly again.', CW / 2, 312);
    }
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
    ctx.fillText(`Scripted mission time: ${formatMissionTime(PHASES.PAYLOAD_DEPLOY.end)}`, 60, 262);
    ctx.fillText(`Max altitude: ${(state.session.maxAltitude / 1000).toFixed(1)} km`, 60, 282);
    ctx.fillText(`Max velocity: ${Math.round(state.session.maxVelocity)} m/s`, 60, 302);
    ctx.fillText(`Booster recovered: ${state.session.boosterRecovered ? '✅' : '❌'}`, 60, 322);
    ctx.fillText(`Payload deployed: ${state.session.payloadDeployed ? '✅' : '❌'}`, 60, 342);
    const rows = ['PAD', 'ASCENT', 'MAX_Q', 'SUPERSONIC', 'STAGE_SEP', 'KARMAN', 'BOOSTER_RTLS', 'ORBIT_INSERT', 'PAYLOAD_DEPLOY'];
    rows.forEach((row, idx) => ctx.fillText(`${row.replace('_', ' ')}: ${state.session.phaseRatings[row] || '—'}`, 60, 370 + idx * 18));
    if (state.settings.achievements.includes('Pad Rat Certified')) {
      ctx.fillText('Achievement: 🐀🪖 Pad Rat Certified', 60, 538);
    }
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

  function drawLevelIntro(ctx) {
    if (state.ui.levelIntroTimer <= 0 || !LEVEL_ORDER.includes(state.session.phase)) return;
    const n = LEVEL_ORDER.indexOf(state.session.phase) + 1;
    const p = PHASES[state.session.phase] || { label: state.session.phase, start: 0 };
    const t = formatMissionTime(timelineValue(MAIN_TIMELINE, 'actual', p.start));
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, CW, 130);
    ctx.fillRect(0, CH - 130, CW, 130);
    ctx.fillStyle = '#e9f4ff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px "VT323", monospace';
    ctx.fillText(`LEVEL ${n}`, CW / 2, CH / 2 - 44);
    ctx.font = '14px "Share Tech Mono", monospace';
    ctx.fillText('═══════════', CW / 2, CH / 2 - 24);
    ctx.fillText((p.label || '').replace(/^LEVEL \d+:\s*/i, ''), CW / 2, CH / 2 - 6);
    ctx.fillText('═══════════', CW / 2, CH / 2 + 12);
    ctx.fillStyle = '#ffcf5d';
    ctx.fillText(t, CW / 2, CH / 2 + 34);
    ctx.fillText(`TARGET ${((LEVEL_TARGETS[state.session.phase] || 0)).toLocaleString()}`, CW / 2, CH / 2 + 52);
    ctx.restore();
  }

  function drawLevelClear(ctx) {
    if (state.ui.levelClearTimer <= 0 || !state.ui.levelClearPhase) return;
    const n = LEVEL_ORDER.indexOf(state.ui.levelClearPhase) + 1;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(36, 156, CW - 72, 270);
    ctx.strokeStyle = '#ffcf5d';
    ctx.strokeRect(36, 156, CW - 72, 270);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcf5d';
    ctx.font = 'bold 24px "VT323", monospace';
    ctx.fillText(`LEVEL ${n} CLEARED`, CW / 2, 190);
    ctx.font = '11px "Share Tech Mono", monospace';
    state.ui.scorePops.forEach((row, i) => {
      ctx.fillText(`${row.label.padEnd(8, ' ')} : ${row.value}`, CW / 2, 222 + i * 24);
    });
    const next = LEVEL_ORDER[Math.min(LEVEL_ORDER.length - 1, n)] || 'EXTENDED';
    ctx.fillText(`NEXT: ${(PHASES[next] ? PHASES[next].label : next).replace(/^LEVEL \d+:\s*/i, '')}`, CW / 2, 338);
    ctx.restore();
  }

  function drawKarmanBanner(ctx) {
    if (state.ui.karmanBannerTimer <= 0) return;
    ctx.save();
    ctx.fillStyle = 'rgba(6,10,20,0.84)';
    ctx.fillRect(0, CH / 2 - 24, CW, 48);
    ctx.strokeStyle = '#ffcf5d';
    ctx.strokeRect(0, CH / 2 - 24, CW, 48);
    ctx.fillStyle = '#ffcf5d';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px "Share Tech Mono", monospace';
    ctx.fillText('★ KARMAN LINE CROSSED · WELCOME TO SPACE ★', CW / 2, CH / 2 + 6);
    ctx.restore();
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
        if (!state.world.padGone || state.session.phase === 'PAD') drawLaunchPad(ctx);
        Particles.draw(ctx, 'main');
        state.obstacles.forEach(o => drawObstacle(ctx, o));
        drawVaporCone(ctx);
        if (state.effects.shockRing > 0) {
          const r = (1 - state.effects.shockRing) * 170;
          ctx.strokeStyle = `rgba(245,250,255,${state.effects.shockRing})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(CW / 2, CH - 54, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (state.status !== 'RUD') drawRocket(ctx, state.rocket.x, state.rocket.y, state.rocket.tilt, 'main', { fairingGone: state.rocket.fairingGone });
        if (state.session.phase === 'ASCENT' && state.session.phaseElapsed < 1) {
          ctx.fillStyle = 'rgba(255,210,120,0.35)';
          for (let i = 0; i < 6; i++) ctx.fillRect(CW / 2 - 18 + i * 6, CH - 28 + i, 3, 28);
        }
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
      drawLevelClear(ctx);
      drawLevelIntro(ctx);
      drawKarmanBanner(ctx);
      if (state.session.phase === 'PAD' || state.session.phase === 'STAGE_SEP' || state.session.phase === 'PAYLOAD_DEPLOY' || state.ui.karmanBannerTimer > 0 || state.ui.levelIntroTimer > 0 || state.ui.levelClearTimer > 0 || (state.session.phase === 'KARMAN' && !state.rocket.fairingGone) || state.session.phase === 'ORBIT_INSERT') {
        ctx.fillStyle = '#8ce0ff';
        ctx.font = '10px "Share Tech Mono", monospace';
        ctx.fillText('SKIP ▸▸', CW - 60, CH - 10);
      }
      if (state.session.phase === 'PAD') drawPadOverlay(ctx);
    }

    if (state.ui.settingsOpen) drawSettings(ctx);
    if (state.status === 'PAUSED' || state.status === 'PAUSED_AUTO') drawPause(ctx);
    if (state.status === 'GAMEOVER' || state.status === 'CONTINUE') drawGameOver(ctx);
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

  function toggleSettings() {
    state.ui.settingsOpen = !state.ui.settingsOpen;
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
        if (row.key === 'Telemetry panel') state.settings.engineerPanel = !state.settings.engineerPanel;
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
    if (state.ui.phaseCaptionTimer > 0) state.ui.phaseCaptionTimer = 0;
    if (state.ui.levelIntroTimer > 0) state.ui.levelIntroTimer = 0;
    if (state.ui.levelClearTimer > 0) state.ui.levelClearTimer = 0;
    if (state.ui.karmanBannerTimer > 0) state.ui.karmanBannerTimer = 0;
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
      for (const btn of state.ui.difficultyButtons || []) {
        if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          state.settings.difficulty = btn.mode;
          saveSettings();
          Audio.play('ui_click', state.settings);
          return;
        }
      }
      startPadOps();
      return;
    }
    if (state.status === 'CONTINUE') {
      state.session.continuesUsed += 1;
      restartFromFailedLevel();
      Audio.play('ui_click', state.settings);
      return;
    }
    if (state.status === 'GAMEOVER') {
      if (state.ui.enteringInitials) {
        saveLeaderboardEntry(state.ui.initials, false);
        state.ui.enteringInitials = false;
      }
      resetSession();
      startPadOps();
      return;
    }
    if (state.status === 'PAUSED' || state.status === 'PAUSED_AUTO') {
      resumeGame();
      return;
    }
    if (state.session.phase === 'PAD') {
      const vanBox = { x: state.easter.van.x - 24, y: state.easter.van.y - 14, w: 66, h: 30 };
      if (state.easter.van.parked && x >= vanBox.x && x <= vanBox.x + vanBox.w && y >= vanBox.y && y <= vanBox.y + vanBox.h && !state.easter.van.messageShown) {
        state.easter.van.messageShown = true;
        Audio.play('boop', state.settings);
        showOverlayMessage("Nope, that's Steve's. Don't touch it.", 2.2);
        return;
      }
      const tortoiseBox = { x: CW / 2 - 142, y: CH - 72, w: 52, h: 24 };
      if (x >= tortoiseBox.x && x <= tortoiseBox.x + tortoiseBox.w && y >= tortoiseBox.y && y <= tortoiseBox.y + tortoiseBox.h) {
        state.ui.tortoiseMoved += 1;
        Audio.play('tortoise', state.settings);
        return;
      }
      if (!state.ui.countdownStarted) {
        state.ui.systems.forEach(s => { s.ok = true; });
        state.ui.countdownStarted = true;
        state.ui.countdown = 0.1;
        state.ui.countdownMark = 1;
        Audio.play('success', state.settings);
        return;
      }
      if (state.ui.countdownStarted) {
        state.ui.countdown = Math.min(state.ui.countdown, 0.1);
        Audio.play('ui_click', state.settings);
        return;
      }
    }
    if (state.status === 'RUNNING' && x > CW - 64 && y > CH - 24) {
      if (state.session.phase === 'PAD') {
        state.ui.systems.forEach(s => { s.ok = true; });
        state.ui.countdownStarted = true;
        state.ui.countdown = 0.1;
      } else if (state.session.phase === 'STAGE_SEP') {
        state.session.totalElapsed = PHASES.STAGE_SEP.end;
        transitionPhase('KARMAN');
      } else if ((state.session.phase === 'KARMAN' || state.session.phase === 'BOOSTER_RTLS') && !state.rocket.fairingGone) {
        state.rocket.fairingGone = true;
        state.effects.fairingSplit = 0.8;
      } else if (state.session.phase === 'PAYLOAD_DEPLOY') {
        state.upper.released = true;
        state.session.payloadDeployed = true;
        ratePhase('PAYLOAD_DEPLOY', 'GOLD');
        startSummary();
      } else if (state.session.phase === 'ORBIT_INSERT') {
        state.session.phaseElapsed = (PHASES.ORBIT_INSERT.end - PHASES.ORBIT_INSERT.start - 1.5);
      }
      Audio.play('ui_click', state.settings);
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
    buildPadSprite();
    buildRocketSprites();
    buildStarSprites();
    skySprite = makeOffscreenCanvas(CW, CH);
    lastSkyKey = -1;
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
      if (state.status === 'RUNNING' && state.session.phase !== 'PAD') setBoostHeld(true);
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
      if (state.status === 'RUNNING' && state.session.phase !== 'PAD') setBoostHeld(true);
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
      if ((state.status === 'GAMEOVER' || state.status === 'CONTINUE') && state.ui.enteringInitials) {
        if (/^[a-z]$/i.test(e.key)) {
          const arr = state.ui.initials.split('');
          arr[state.ui.initialsIndex] = e.key.toUpperCase();
          state.ui.initials = arr.join('');
          state.ui.initialsIndex = (state.ui.initialsIndex + 1) % 3;
          Audio.play('boop', state.settings);
        } else if (e.code === 'Backspace') {
          e.preventDefault();
          state.ui.initialsIndex = (state.ui.initialsIndex + 2) % 3;
        } else if (e.code === 'Enter') {
          saveLeaderboardEntry(state.ui.initials, false);
          state.ui.enteringInitials = false;
        }
      }
      if (e.code === 'KeyO') toggleSettings();
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
        else if (state.status === 'READY') startPadOps();
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
    if (state.status === 'READY' || state.status === 'RUNNING' || state.status === 'RUD' || state.status === 'SUMMARY' || state.status === 'GAMEOVER' || state.status === 'CONTINUE') {
      if (state.status === 'RUNNING' || state.status === 'RUD') updateMission(dt);
      if (state.status === 'CONTINUE') updateContinue(dt);
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
  window.arcadeToggleSettings = toggleSettings;
  document.addEventListener('DOMContentLoaded', init);
}());
