'use strict';
// Pure maze generation / collision physics, shared by the game and tests.
const CapMaze=(()=>{
 function create(level=1,random=Math.random){
  const walls=Array.from({length:24},()=>Array(24).fill(true));
  const visited=new Set(['0,0']),stack=[[0,0]],distance={'0,0':0};let far=[0,0];
  const carve=(cx,cy)=>{for(let y=1+cy*4;y<=3+cy*4;y++)for(let x=1+cx*4;x<=3+cx*4;x++)walls[y][x]=false;};
  carve(0,0);
  while(stack.length){
   const [x,y]=stack[stack.length-1];
   const options=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[x+dx,y+dy,dx,dy]).filter(([nx,ny])=>nx>=0&&ny>=0&&nx<5&&ny<5&&!visited.has(nx+','+ny));
   if(!options.length){stack.pop();continue;}
   const [nx,ny,dx,dy]=options[Math.floor(random()*options.length)];visited.add(nx+','+ny);carve(nx,ny);
   if(dx){const wx=dx>0?4+x*4:x*4;for(let py=1+y*4;py<=3+y*4;py++)walls[py][wx]=false;}
   else{const wy=dy>0?4+y*4:y*4;for(let px=1+x*4;px<=3+x*4;px++)walls[wy][px]=false;}
   distance[nx+','+ny]=distance[x+','+y]+1;
   if(distance[nx+','+ny]>distance[far.join(',')])far=[nx,ny];stack.push([nx,ny]);
  }
  return{level,walls,x:2,y:2,vx:0,vy:0,goal:{x:2+far[0]*4,y:2+far[1]*4},won:false};
 }
 function free(m,x,y){const r=.65;return [[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]].every(([px,py])=>px>=0&&py>=0&&px<24&&py<24&&!m.walls[Math.floor(py)][Math.floor(px)]);}
 function step(m,gx,gy,dt){
  if(m.won||!Number.isFinite(gx)||!Number.isFinite(gy))return false;
  dt=Math.max(0,Math.min(.1,dt));
  m.vx=(m.vx+gx/100*16*dt)*Math.pow(.12,dt);m.vy=(m.vy+gy/100*16*dt)*Math.pow(.12,dt);
  const count=Math.max(1,Math.ceil(Math.max(Math.abs(m.vx*dt),Math.abs(m.vy*dt))/.15));
  for(let i=0;i<count;i++){
   const nx=m.x+m.vx*dt/count;if(free(m,nx,m.y))m.x=nx;else m.vx=0;
   const ny=m.y+m.vy*dt/count;if(free(m,m.x,ny))m.y=ny;else m.vy=0;
   if(Math.hypot(m.x-m.goal.x,m.y-m.goal.y)<.85){m.won=true;m.vx=m.vy=0;return true;}
  }return false;
 }
 function pixels(m,now=Date.now()){
  const colors=m.walls.flatMap(row=>row.map(wall=>wall?'12385a':'000000'));
  const pulse=Math.floor(100+100*(.5+.5*Math.sin(now/250))).toString(16).padStart(2,'0');
  for(let y=m.goal.y-1;y<=m.goal.y+1;y++)for(let x=m.goal.x-1;x<=m.goal.x+1;x++)colors[y*24+x]=m.won?'40ff60':'00'+pulse+'24';
  const bx=Math.max(0,Math.min(22,Math.round(m.x-.5))),by=Math.max(0,Math.min(22,Math.round(m.y-.5)));
  for(let y=by;y<=by+1;y++)for(let x=bx;x<=bx+1;x++)if(!m.walls[y][x])colors[y*24+x]=m.won?'aaffaa':'ffffff';
  return colors;
 }
 return{create,free,step,pixels};
})();
if(typeof module!=='undefined')module.exports=CapMaze;
