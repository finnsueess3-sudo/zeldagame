// --- Konfiguration ---
const config = { tileSize:32, mapSize:60, viewTilesX:30, viewTilesY:20 };
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = config.tileSize*config.viewTilesX;
canvas.height = config.tileSize*config.viewTilesY;
canvas.focus();

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function randInt(a,b){return Math.floor(Math.random()*(b-a+1))+a}

// --- Multiplayer WebSocket ---
const socket = new WebSocket('ws://localhost:8080'); // auf Render anpassen
let myId = null, otherPlayers = {};

socket.onmessage = msg=>{
  const data = JSON.parse(msg.data);
  if(data.type==='init'){ myId = data.id; otherPlayers = data.players; }
  if(data.type==='players'){ otherPlayers = data.players; }
};

function sendState(){
  if(!myId) return;
  socket.send(JSON.stringify({
    type:'update',
    state:{ x:player.x, y:player.y, hp:player.hp, class:player.class, weapon:player.weapon }
  }));
}
setInterval(sendState,50);

// --- Spielerklasse ---
class Entity{constructor(x,y,w=20,h=28){this.x=x;this.y=y;this.w=w;this.h=h;this.vx=0;this.vy=0;this.speed=140;this.hp=10;this.facing='down';this.swing=0;this.swingDir=1;}}
const player = new Entity(config.mapSize/2*config.tileSize, config.mapSize/2*config.tileSize, 20,28);
player.speed = 150;

let world = null;
function generateWorld(){
  const size = config.mapSize;
  const houses=[];
  for(let i=0;i<10;i++){
    const hx=randInt(4,size-6), hy=randInt(4,size-6);
    houses.push({x:hx,y:hy,w:randInt(2,4),h:randInt(2,3),color:'#b3542c'});
  }
  world={size,houses};
}
generateWorld();
document.getElementById('regen').addEventListener('click',()=>generateWorld());

// --- Input ---
const keys={};
window.addEventListener('keydown',e=>{ if(e.code==='Space' || e.code==='ShiftLeft') e.preventDefault(); keys[e.code]=true; });
window.addEventListener('keyup',e=>{ keys[e.code]=false; });
canvas.addEventListener('click',()=>canvas.focus());

// --- Movement ---
function moveWithCollisions(ent,dx,dy,dt){
  ent.x+=dx*dt; ent.y+=dy*dt;
}

// --- Camera ---
const camera={x:0,y:0,w:canvas.width,h:canvas.height};
function updateCamera(){ camera.x=player.x-camera.w/2; camera.y=player.y-camera.h/2; }

// --- Klassen ---
const CLASSES={
  magier:{hp:4,mana:10,weapon:"magic",abilities:["fire","ice"]},
  schuetze:{hp:5,mana:0,weapon:"bow",abilities:["highDamage"]},
  krieger:{hp:8,mana:0,weapon:"sword",abilities:[]},
  ninja:{hp:2,mana:0,weapon:"katana",abilities:["dash"]}
};
function showClassSelect(){
  const box=document.createElement('div');box.id="classSelect";
  box.style.position="absolute";box.style.top="50%";box.style.left="50%";box.style.transform="translate(-50%,-50%)";
  box.style.background="#222";box.style.color="white";box.style.padding="20px";box.style.border="3px solid #fff";box.style.fontSize="20px";
  box.innerHTML=`
    <h2>Wähle deine Klasse</h2>
    <button onclick="chooseClass('magier')">Magier (Feuer & Eis, 4 Leben)</button>
    <button onclick="chooseClass('schuetze')">Schütze (Bogen, 5 Leben, hoher Schaden)</button>
    <button onclick="chooseClass('krieger')">Krieger (Schwert, 8 Leben)</button>
    <button onclick="chooseClass('ninja')">Ninja (Dash & Katana, 2 Leben)</button>
  `;
  document.body.appendChild(box);
}
function chooseClass(type){
  const cfg=CLASSES[type]; player.class=type; player.hp=cfg.hp; player.maxHp=cfg.hp;
  player.weapon=cfg.weapon; player.abilities=cfg.abilities;
  player.inventory={sword:false,bow:false,magic:false,katana:false};
  if(cfg.weapon==='sword')player.inventory.sword=true;
  if(cfg.weapon==='bow')player.inventory.bow=true;
  if(cfg.weapon==='magic')player.inventory.magic=true;
  if(cfg.weapon==='katana')player.inventory.katana=true;
  document.getElementById('classSelect').remove();
}
window.onload=showClassSelect;

// --- Dash ---
let dashCooldown=0;
function handleDash(dt){
  if(player.class==='ninja' && keys['ShiftLeft'] && dashCooldown<=0){
    const dashDist=200; let dx=0,dy=0;
    if(player.facing==='up')dy=-dashDist;
    if(player.facing==='down')dy=dashDist;
    if(player.facing==='left')dx=-dashDist;
    if(player.facing==='right')dx=dashDist;
    moveWithCollisions(player,dx,dy,1);
    dashCooldown=1;
  }
  if(dashCooldown>0)dashCooldown-=dt;
}

// --- Update / Loop ---
let last=performance.now();
function loop(now){
  const dt=Math.min((now-last)/1000,1/20); last=now;
  update(dt); render(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function update(dt){
  handleDash(dt);
  let mx=0,my=0;
  if(keys['KeyW']){ my-=1; player.facing='up'; }
  if(keys['KeyS']){ my+=1; player.facing='down'; }
  if(keys['KeyA']){ mx-=1; player.facing='left'; }
  if(keys['KeyD']){ mx+=1; player.facing='right'; }
  if(mx!==0 && my!==0){ mx*=0.7071; my*=0.7071; }
  moveWithCollisions(player,mx*player.speed,my*player.speed,dt);
  updateCamera();
}

function render(){
  ctx.fillStyle='#6ea564'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // Houses
  for(const h of world.houses){
    const x=h.x*config.tileSize-camera.x;
    const y=h.y*config.tileSize-camera.y;
    ctx.fillStyle=h.color; ctx.fillRect(x,y,h.w*config.tileSize,h.h*config.tileSize);
  }
  // Andere Spieler
  for(const id in otherPlayers){
    if(id===myId)continue;
    const p=otherPlayers[id];
    const x=p.x-camera.x; const y=p.y-camera.y;
    ctx.fillStyle='#ff0'; ctx.fillRect(x,y,20,28);
  }
  // Eigener Spieler
  const px=player.x-camera.x; const py=player.y-camera.y;
  ctx.fillStyle='#00f'; ctx.fillRect(px,py,20,28);
}
