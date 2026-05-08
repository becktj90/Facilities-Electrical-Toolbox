
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

const state = {
  player:{x:200,y:400,speed:3},
  stress:12,
  reputation:74,
  countdown:3600,
  weather:'GO',
  logs:[],
  worldTime:0,
  anomalies:[],
  currentEvent:null
};

const npcs = [
  {x:500,y:320,name:'Launch Director Vega'},
  {x:760,y:540,name:'Sleep-Deprived Cryo Tech'},
  {x:1020,y:260,name:'Range Safety Officer'}
];

function log(msg){
  state.logs.unshift(msg);
  state.logs = state.logs.slice(0,20);

  const el = document.getElementById('log');
  el.innerHTML = state.logs.map(v=>`<div class="log-entry">${v}</div>`).join('');
}

log('Pad systems initializing.');
log('Welcome back, Pad Rat.');

const keys = {};

window.addEventListener('keydown',e=>keys[e.key]=true);
window.addEventListener('keyup',e=>keys[e.key]=false);

function update(){
  state.worldTime += 0.016;

  if(keys['w']||keys['ArrowUp']) state.player.y -= state.player.speed;
  if(keys['s']||keys['ArrowDown']) state.player.y += state.player.speed;
  if(keys['a']||keys['ArrowLeft']) state.player.x -= state.player.speed;
  if(keys['d']||keys['ArrowRight']) state.player.x += state.player.speed;

  state.countdown -= 0.016;

  if(Math.random() < 0.0015){
    triggerAnomaly();
  }

  document.getElementById('stress').textContent = Math.floor(state.stress);
  document.getElementById('rep').textContent = state.reputation;
  document.getElementById('countdown').textContent = Math.floor(state.countdown);
  document.getElementById('weather').textContent = state.weather;
}

function triggerAnomaly(){
  const events = [
    'Methane pressure fluctuation detected.',
    'Boat entered exclusion zone.',
    'Unexpected vibration in Engine 4.',
    'Pad camera feed lost.',
    'Coffee spilled onto checklist binder.'
  ];

  const event = events[Math.floor(Math.random()*events.length)];

  log(event);
  state.stress += 6;

  showInteraction(event,[
    {
      text:'Investigate manually',
      action:()=>{
        log('Manual investigation successful.');
        state.reputation += 2;
        state.stress -= 4;
      }
    },
    {
      text:'Ignore warning',
      action:()=>{
        log('Issue escalated during countdown.');
        state.stress += 10;
      }
    }
  ]);
}

function showInteraction(text,choices){
  const interaction = document.getElementById('interaction');
  const dialogue = document.getElementById('dialogue');
  const choicesEl = document.getElementById('choices');

  interaction.style.display = 'block';
  dialogue.textContent = text;
  choicesEl.innerHTML = '';

  choices.forEach(c=>{
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = c.text;

    btn.onclick = ()=>{
      c.action();
      interaction.style.display = 'none';
    };

    choicesEl.appendChild(btn);
  });
}

function render(){
  ctx.fillStyle = '#08111d';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // stars
  for(let i=0;i<120;i++){
    ctx.fillStyle='rgba(255,255,255,0.6)';
    ctx.fillRect((i*97)%canvas.width,(i*53)%canvas.height,2,2);
  }

  // ground
  ctx.fillStyle='#1b2835';
  ctx.fillRect(0, canvas.height-220, canvas.width, 220);

  // launch tower
  ctx.fillStyle='#7f8c99';
  ctx.fillRect(canvas.width-260,120,40,360);

  // rocket
  ctx.fillStyle='white';
  ctx.fillRect(canvas.width-220,170,28,240);

  ctx.fillStyle='#2e8fff';
  ctx.fillRect(canvas.width-220,350,28,30);

  // launch glow
  const glow = Math.sin(state.worldTime*2)*10;
  ctx.fillStyle=`rgba(80,140,255,${0.08+glow/100})`;
  ctx.beginPath();
  ctx.arc(canvas.width-206,390,90+glow,0,Math.PI*2);
  ctx.fill();

  // player
  ctx.fillStyle='#ffcc66';
  ctx.beginPath();
  ctx.arc(state.player.x,state.player.y,12,0,Math.PI*2);
  ctx.fill();

  // NPCs
  npcs.forEach(n=>{
    ctx.fillStyle='#55ffaa';
    ctx.beginPath();
    ctx.arc(n.x,n.y,10,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle='white';
    ctx.fillText(n.name,n.x-30,n.y-18);
  });

  // fog
  ctx.fillStyle='rgba(255,255,255,0.03)';
  for(let i=0;i<5;i++){
    ctx.fillRect((i*220 + state.worldTime*10)%canvas.width,80+i*50,260,40);
  }
}

function loop(){
  update();
  render();
  requestAnimationFrame(loop);
}

loop();
