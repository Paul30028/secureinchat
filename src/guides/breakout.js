(()=>{
const c=document.getElementById('c'),x=c.getContext('2d');
const W=c.width,H=c.height;
const COLS=8,ROWS=5,BW=52,BH=20,GAP=6,TOP=50,LEFT=(W-(COLS*BW+(COLS-1)*GAP))/2;
let paddle,ball,bricks,score,lives,state; // state: ready | play | over | win
const scoreEl=document.getElementById('score'),livesEl=document.getElementById('lives'),msgEl=document.getElementById('msg');
function reset(){
  paddle={w:84,h:12,x:W/2-42,y:H-34};
  bricks=[];
  for(let r=0;r<ROWS;r++)for(let k=0;k<COLS;k++)bricks.push({x:LEFT+k*(BW+GAP),y:TOP+r*(BH+GAP),alive:true,row:r});
  score=0;lives=3;state='ready';serve();hud('Press Space or tap to start');
}
function serve(){ball={x:W/2,y:paddle.y-9,r:8,vx:3,vy:-4};}
function hud(m){scoreEl.textContent=score;livesEl.textContent=lives;if(m!==undefined)msgEl.textContent=m;}
let keys={};
addEventListener('keydown',e=>{keys[e.key]=true;if(e.key===' '||e.key==='Enter'){e.preventDefault();start();}});
addEventListener('keyup',e=>keys[e.key]=false);
function start(){if(state==='ready'){state='play';hud('');}else if(state==='over'||state==='win'){reset();}}
c.addEventListener('pointerdown',start);
c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect();paddle.x=clamp((e.clientX-r.left)*W/r.width-paddle.w/2,0,W-paddle.w);});
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function step(){
  if(keys.ArrowLeft||keys.a)paddle.x=clamp(paddle.x-7,0,W-paddle.w);
  if(keys.ArrowRight||keys.d)paddle.x=clamp(paddle.x+7,0,W-paddle.w);
  if(state==='ready'){ball.x=paddle.x+paddle.w/2;ball.y=paddle.y-9;return;}
  if(state!=='play')return;
  ball.x+=ball.vx;ball.y+=ball.vy;
  if(ball.x<ball.r){ball.x=ball.r;ball.vx*=-1;}
  if(ball.x>W-ball.r){ball.x=W-ball.r;ball.vx*=-1;}
  if(ball.y<ball.r){ball.y=ball.r;ball.vy*=-1;}
  if(ball.vy>0&&ball.y+ball.r>=paddle.y&&ball.y+ball.r<=paddle.y+paddle.h+6&&ball.x>=paddle.x&&ball.x<=paddle.x+paddle.w){
    const hit=(ball.x-(paddle.x+paddle.w/2))/(paddle.w/2);
    const sp=Math.min(8,Math.hypot(ball.vx,ball.vy)*1.01);
    ball.vx=hit*sp*0.8;
    if(Math.abs(ball.vx)<1)ball.vx=(Math.random()<0.5?-1:1)*(1+Math.random()); // never bounce straight up forever
    ball.vy=-Math.sqrt(Math.max(sp*sp-ball.vx*ball.vx,4));
    ball.y=paddle.y-ball.r;
  }
  for(const b of bricks){
    if(!b.alive)continue;
    if(ball.x+ball.r>b.x&&ball.x-ball.r<b.x+BW&&ball.y+ball.r>b.y&&ball.y-ball.r<b.y+BH){
      b.alive=false;score+=10*(ROWS-b.row);
      const ox=Math.min(ball.x+ball.r-b.x,b.x+BW-(ball.x-ball.r)),oy=Math.min(ball.y+ball.r-b.y,b.y+BH-(ball.y-ball.r));
      if(ox<oy)ball.vx*=-1;else ball.vy*=-1;
      hud();break;
    }
  }
  if(bricks.every(b=>!b.alive)){state='win';hud('You win! Press Space to play again');}
  if(ball.y>H+ball.r){lives--;if(lives<=0){state='over';hud('Game over. Press Space to retry');}else{state='ready';serve();hud('Press Space or tap to continue');}}
}
const colors=['#ff6b6b','#ffa94d','#ffd43b','#69db7c','#4dabf7'];
function draw(){
  x.clearRect(0,0,W,H);
  for(const b of bricks){if(!b.alive)continue;x.fillStyle=colors[b.row%colors.length];x.fillRect(b.x,b.y,BW,BH);}
  x.fillStyle='#e8ecf3';x.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);
  x.beginPath();x.arc(ball.x,ball.y,ball.r,0,Math.PI*2);x.fill();
}
function loop(){step();draw();requestAnimationFrame(loop);}
window.__game={get:()=>({state,score,lives,ball,bricksLeft:bricks.filter(b=>b.alive).length,paddle}),reset,start};
reset();loop();
})();
