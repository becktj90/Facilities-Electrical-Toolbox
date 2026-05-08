(function () {
  'use strict';

  const scenarios = [
    {
      level: 'Grocery Store',
      text: 'You accidentally block the aisle while comparing pasta sauces.',
      choices: [
        { text: 'Pretend to intensely read ingredients.', normality: -5, suspicion: 10, thought: 'Why am I holding this sauce like an ancient artifact?' },
        { text: 'Move cart awkwardly while apologizing too much.', normality: 5, suspicion: -5, thought: 'Too many apologies. Abort eye contact.' },
        { text: 'Walk away without buying anything.', normality: -10, suspicion: 15, thought: 'Now everyone thinks I was stealing sauce knowledge.' }
      ]
    },
    {
      level: 'Elevator',
      text: 'Someone enters the elevator after you already chose your standing corner.',
      choices: [
        { text: 'Nod once respectfully.', normality: 10, suspicion: -5, thought: 'Good. Human interaction completed.' },
        { text: 'Stare at floor numbers dramatically.', normality: -5, suspicion: 5, thought: 'Act natural. Floors are fascinating.' },
        { text: 'Press a button already pressed.', normality: -15, suspicion: 15, thought: 'Catastrophic error.' }
      ]
    },
    {
      level: 'Crosswalk',
      text: 'A car stops for you. The wave timing is critical.',
      choices: [
        { text: 'Perfect polite wave.', normality: 15, suspicion: -10, thought: 'Elite pedestrian behavior.' },
        { text: 'Half-wave half-jog panic move.', normality: -10, suspicion: 10, thought: 'That looked weird. That definitely looked weird.' },
        { text: 'Wave twice accidentally.', normality: -20, suspicion: 20, thought: 'Too much wave. Too much wave!' }
      ]
    },
    {
      level: 'Party',
      text: 'You are holding a drink and suddenly become aware of your hands.',
      choices: [
        { text: 'Lean casually against wall.', normality: 5, suspicion: -5, thought: 'Walls are socially powerful.' },
        { text: 'Pretend to text someone.', normality: -5, suspicion: 10, thought: 'Why am I opening calculator app repeatedly?' },
        { text: 'Stand in kitchen silently.', normality: -15, suspicion: 15, thought: 'I have become furniture.' }
      ]
    },
    {
      level: 'Goodbye Sequence',
      text: 'You said goodbye but accidentally walked the same direction as the other person.',
      choices: [
        { text: 'Commit to same direction confidently.', normality: 5, suspicion: 5, thought: 'Maybe destiny?' },
        { text: 'Fake check phone and stop walking.', normality: -5, suspicion: 10, thought: 'I live here now.' },
        { text: 'Cross street immediately.', normality: -20, suspicion: 20, thought: 'Tactical retreat initiated.' }
      ]
    }
  ];

  const state = {
    normality: 100,
    suspicion: 0,
    index: 0,
    choiceLocked: false
  };

  let scenarioEl;
  let choicesEl;
  let thoughtsEl;
  let normalityEl;
  let suspicionEl;
  let levelEl;
  let nextBtn;
  let canvas;
  let ctx;
  let dots = [];

  function clampStats() {
    state.normality = Math.max(0, Math.min(100, state.normality));
    state.suspicion = Math.max(0, Math.min(100, state.suspicion));
  }

  function updateUI() {
    normalityEl.textContent = String(state.normality);
    suspicionEl.textContent = String(state.suspicion);
  }

  function gameOver() {
    state.choiceLocked = true;
    levelEl.textContent = 'Simulation End';
    scenarioEl.textContent = state.suspicion >= 100
      ? "Someone asked if you're okay. Society has detected your weirdness."
      : 'You became too self-aware and dissolved into awkward energy.';

    choicesEl.innerHTML = '';
    thoughtsEl.textContent = 'Replay Vision: You circled the same grocery aisle 6 times holding yogurt.';
    nextBtn.textContent = 'Restart';
  }

  function loadScenario() {
    if (state.normality <= 0 || state.suspicion >= 100) {
      gameOver();
      return;
    }

    const scenario = scenarios[state.index % scenarios.length];
    state.choiceLocked = false;
    levelEl.textContent = scenario.level;
    scenarioEl.textContent = scenario.text;
    choicesEl.innerHTML = '';
    thoughtsEl.textContent = '';
    nextBtn.textContent = 'Next';

    scenario.choices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn tbn-choice';
      btn.textContent = choice.text;
      btn.addEventListener('click', () => {
        if (state.choiceLocked) return;
        state.choiceLocked = true;

        state.normality += choice.normality;
        state.suspicion += choice.suspicion;
        clampStats();

        thoughtsEl.textContent = `Internal Thought: ${choice.thought}`;
        updateUI();

        Array.from(choicesEl.querySelectorAll('button')).forEach((choiceBtn) => {
          choiceBtn.disabled = true;
        });

        if (state.normality <= 0 || state.suspicion >= 100) {
          gameOver();
        }
      });
      choicesEl.appendChild(btn);
    });
  }

  function resetGame() {
    state.normality = 100;
    state.suspicion = 0;
    state.index = 0;
    state.choiceLocked = false;
    updateUI();
    loadScenario();
  }

  function resize() {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      dots = Array.from({ length: 60 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 3 + 1,
        dx: (Math.random() - 0.5) * 0.4,
        dy: (Math.random() - 0.5) * 0.4
      }));
    }
  }

  function animate() {
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#121820';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    dots.forEach((dot) => {
      dot.x += dot.dx;
      dot.y += dot.dy;
      if (dot.x < 0 || dot.x > canvas.width) dot.dx *= -1;
      if (dot.y < 0 || dot.y > canvas.height) dot.dy *= -1;

      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
    });

    requestAnimationFrame(animate);
  }

  function init() {
    scenarioEl = document.getElementById('tbn-scenario');
    choicesEl = document.getElementById('tbn-choices');
    thoughtsEl = document.getElementById('tbn-thoughts');
    normalityEl = document.getElementById('tbn-normality');
    suspicionEl = document.getElementById('tbn-suspicion');
    levelEl = document.getElementById('tbn-level');
    nextBtn = document.getElementById('tbn-next-btn');
    canvas = document.getElementById('tbn-bg');
    if (!scenarioEl || !choicesEl || !thoughtsEl || !normalityEl || !suspicionEl || !levelEl || !nextBtn || !canvas) return;
    ctx = canvas.getContext('2d');
    if (!ctx) return;

    nextBtn.addEventListener('click', () => {
      if (state.normality <= 0 || state.suspicion >= 100) {
        resetGame();
        return;
      }
      state.index += 1;
      loadScenario();
    });

    resize();
    window.addEventListener('resize', resize);
    updateUI();
    loadScenario();
    animate();
  }

  document.addEventListener('DOMContentLoaded', init);
}());
