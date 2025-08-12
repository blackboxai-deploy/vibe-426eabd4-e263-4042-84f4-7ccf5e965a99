const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const dpr = () => Math.max(1, Math.min(2, window.devicePixelRatio || 1));

const ui = document.getElementById('ui');
const startBtn = document.getElementById('start-btn');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const gameover = document.getElementById('gameover');
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

let best = Number(localStorage.getItem('dodgefall_best')||0);
bestEl.textContent = best;

let state = 'menu'; // 'menu' | 'playing' | 'over'
let width = 0, height = 0, scale = 1;
let last = 0;

const input = {
  left:false,right:false,up:false,down:false,
  pointerActive:false,
  pointerX:0,pointerY:0
};

const world = {
  player: { x:0, y:0, r:14, speed:260, vx:0, vy:0, color:'#5cf5c7' },
  obstacles: [],
  particles: [],
  score: 0,
  spawnTimer: 0,
};

function resize(){
  const DPR = dpr();
  const rect = canvas.getBoundingClientRect();
  width = Math.max(320, rect.width|0);
  height = Math.max(480, rect.height|0);
  canvas.width = Math.floor(width * DPR);
  canvas.height = Math.floor(height * DPR);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
  scale = Math.min(width, height) / 600; // for sizing
}
window.addEventListener('resize', resize);
resize();

function rand(min,max){return Math.random()*(max-min)+min}
function clamp(v,a,b){return Math.max(a, Math.min(b, v))}
function lerp(a,b,t){return a+(b-a)*t}

function resetGame(){
  world.player.x = width/2; world.player.y = height*0.8;
  world.player.vx = 0; world.player.vy = 0;
  world.obstacles.length = 0;
  world.particles.length = 0;
  world.score = 0;
  world.spawnTimer = 0;
}

function start(){
  resetGame();
  state = 'playing';
  ui.classList.add('hidden');
  gameover.classList.add('hidden');
}

function gameOver(){
  state = 'over';
  finalScoreEl.textContent = `Score: ${Math.floor(world.score)}`;
  if (world.score > best) {
    best = Math.floor(world.score);
    localStorage.setItem('dodgefall_best', String(best));
    bestEl.textContent = best;
  }
  gameover.classList.remove('hidden');
}

// Input
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = true;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.up = true;
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.down = true;
  if (e.key === ' ' && state !== 'playing') start();
});
window.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = false;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.up = false;
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.down = false;
});

function pointerPos(e){
  const rect = canvas.getBoundingClientRect();
  const x = (e.touches? e.touches[0].clientX : e.clientX) - rect.left;
  const y = (e.touches? e.touches[0].clientY : e.clientY) - rect.top;
  return {x, y};
}
canvas.addEventListener('pointerdown', e => { input.pointerActive = true; const p = pointerPos(e); input.pointerX = p.x; input.pointerY = p.y; if(state!=='playing') start(); });
canvas.addEventListener('pointermove', e => { if(!input.pointerActive) return; const p = pointerPos(e); input.pointerX = p.x; input.pointerY = p.y; });
window.addEventListener('pointerup', ()=> input.pointerActive=false);

startBtn.addEventListener('click', start);
restartBtn.addEventListener('click', start);

function spawnObstacle(){
  const base = Math.max(0.9, 1 - world.score/200); // size scales down slightly
  const w = rand(24, 38) * scale * base;
  const h = rand(18, 28) * scale * base;
  const x = rand(w, width - w);
  const speed = lerp(140, 380, Math.min(1, world.score/120));
  const vx = rand(-30, 30) * scale;
  world.obstacles.push({x,y:-h,w,h,vy:speed,vx,color: randomColor()});
}

function randomColor(){
  const hues = [190, 165, 210, 130, 0, 45];
  const h = hues[(Math.random()*hues.length)|0];
  return `hsl(${h} 80% 60%)`;
}

function addBurst(x,y,color){
  for(let i=0;i<12;i++){
    world.particles.push({
      x,y, life: rand(0.4,0.9), t:0, r: rand(1,3)*scale, 
      vx: rand(-140,140)*scale, vy: rand(-60, -160)*scale, g: 360*scale,
      color
    });
  }
}

function update(dt){
  if (state !== 'playing') return;
  world.score += dt * 10; // score over time
  scoreEl.textContent = Math.floor(world.score);

  // Player movement
  const p = world.player;
  const acc = p.speed * 3;
  const friction = 10;

  let ax = 0, ay = 0;
  if (input.left) ax -= acc;
  if (input.right) ax += acc;
  if (input.up) ay -= acc;
  if (input.down) ay += acc;

  if (input.pointerActive) {
    const tx = clamp(input.pointerX, 0, width);
    const ty = clamp(input.pointerY, 0, height);
    const toX = tx - p.x; const toY = ty - p.y;
    ax += toX * 6; ay += toY * 6;
  }

  p.vx += ax * dt; p.vy += ay * dt;
  p.vx -= p.vx * friction * dt; p.vy -= p.vy * friction * dt;
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.x = clamp(p.x, p.r, width - p.r);
  p.y = clamp(p.y, p.r, height - p.r);

  // Spawn
  world.spawnTimer -= dt;
  const spawnInterval = lerp(0.75, 0.18, Math.min(1, world.score/120));
  if (world.spawnTimer <= 0) {
    world.spawnTimer = spawnInterval * rand(0.7,1.25);
    spawnObstacle();
  }

  // Obstacles
  for (let i=world.obstacles.length-1; i>=0; i--) {
    const o = world.obstacles[i];
    o.y += o.vy * dt; o.x += o.vx * dt;
    if (o.x < o.w*0.5 || o.x > width - o.w*0.5) o.vx *= -1;

    // Collision
    const dx = Math.abs(p.x - o.x) - (o.w*0.5);
    const dy = Math.abs(p.y - o.y) - (o.h*0.5);
    if (dx < p.r && dy < p.r) {
      addBurst(p.x, p.y, '#ff6b6b');
      gameOver();
    }

    if (o.y - o.h > height + 40) {
      world.obstacles.splice(i,1);
      addBurst(o.x, height, o.color);
    }
  }

  // Particles
  for (let i=world.particles.length-1;i>=0;i--){
    const pa = world.particles[i];
    pa.t += dt; if (pa.t > pa.life) { world.particles.splice(i,1); continue; }
    pa.vy += pa.g * dt; pa.x += pa.vx * dt; pa.y += pa.vy * dt;
  }
}

function clear(){
  ctx.clearRect(0,0,width,height);
}

function draw(){
  // subtle grid background
  const grid = 32 * scale;
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#9bb1e4';
  ctx.lineWidth = 1;
  for(let x= (width%grid); x<width; x+=grid){
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke();
  }
  for(let y= (height%grid); y<height; y+=grid){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke();
  }
  ctx.restore();

  // player
  const p = world.player;
  const glow = ctx.createRadialGradient(p.x,p.y, p.r*0.2, p.x,p.y, p.r*2.2);
  glow.addColorStop(0, 'rgba(92,245,199,0.6)');
  glow.addColorStop(1, 'rgba(92,245,199,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*2.1,0,Math.PI*2); ctx.fill();

  ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();

  // obstacles
  for (const o of world.obstacles){
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(Math.sin(o.y*0.01) * 0.08);
    ctx.fillStyle = o.color;
    roundRect(ctx, -o.w*0.5, -o.h*0.5, o.w, o.h, Math.min(10*scale, o.h*0.25));
    ctx.fill();
    ctx.restore();
  }

  // particles
  for (const pa of world.particles){
    const t = pa.t / pa.life;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = pa.color || '#fff';
    ctx.beginPath(); ctx.arc(pa.x, pa.y, pa.r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx, x, y, w, h, r){
  const rr = Math.min(r, w*0.5, h*0.5);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
  ctx.closePath();
}

function loop(ts){
  const t = ts*0.001;
  const dt = Math.min(0.033, Math.max(0.001, t - last || 0));
  last = t;
  clear();
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// initial art flourish
(function introParticles(){
  for(let i=0;i<40;i++){
    world.particles.push({
      x: rand(width*0.2,width*0.8), y: rand(height*0.2,height*0.8),
      life: rand(1.2,2.0), t: rand(0,0.9), r: rand(1,2)*scale,
      vx: rand(-20,20)*scale, vy: rand(-30,30)*scale, g: 0,
      color: randomColor()
    });
  }
})();
