'use strict';
let labyrinth=null,labOwner=null,labRevision=-1,labUnsubscribe=null,labForce={x:0,y:0},labAngles=null,labZero={beta:0,gamma:0},labSending=false,labFrameAt=0,labStepAt=Date.now(),labWonAt=0,labStarting=false,labHasReading=false,labNeutralPending=true,labReadingAt=0;
const labContext=$('labyrinthCanvas').getContext('2d');
function renderLabyrinth(){
 if(labOwner&&(state.mode!=='VIDEO'||revision!==labRevision||!state.connected))stopLabyrinthLocal();
 $('levelLabyrinth').disabled=!labOwner;$('stopLabyrinth').disabled=!labOwner;
 if(labOwner){$('nowPlaying').textContent='Tilt labyrinth · Level '+labyrinth.level;$('modeLabel').textContent='Roll the white ball into the green goal';}
}
function stopLabyrinthLocal(){if(labUnsubscribe)labUnsubscribe();labUnsubscribe=null;labOwner=null;labForce={x:0,y:0};}
function previewLabyrinth(colors){for(let i=0;i<576;i++){labContext.fillStyle='#'+colors[i];labContext.fillRect(i%24*20,Math.floor(i/24)*20,20,20);}}
function labyrinthReading(sample){
 const o=sample.orientation;if(!o.events||!Number.isFinite(o.beta)||!Number.isFinite(o.gamma))return;
 labAngles={beta:o.beta,gamma:o.gamma};labHasReading=true;labReadingAt=o.at||Date.now();
 if(labNeutralPending){labZero={...labAngles};labNeutralPending=false;}
 const modern=typeof screen!=='undefined'?screen.orientation?.angle:undefined;
 const angle=(Number.isFinite(modern)?modern:Number.isFinite(window.orientation)?window.orientation:0)*Math.PI/180;
 const x=Math.sin((o.gamma-labZero.gamma)*Math.PI/180)*100,y=Math.sin((o.beta-labZero.beta)*Math.PI/180)*100;
 labForce={x:x*Math.cos(angle)+y*Math.sin(angle),y:-x*Math.sin(angle)+y*Math.cos(angle)};
 if(!labyrinth.won)$('labyrinthStatus').textContent='Level '+labyrinth.level+' · Roll the white ball to the green goal.';
}
$('startLabyrinth').onclick=async()=>{
 if(busy||labStarting)return;labStarting=true;
 try{
  await capSensors.request('orientation');
  // Restart our own stream cleanly; another visitor's stream stays protected.
  if(labOwner){const owner=labOwner;stopLabyrinthLocal();await action('/api/video/stop',{owner},'Restarting maze…');}
  const result=await action('/api/video/start',{},'Starting labyrinth…');
  if(!result?.owner||state.mode!=='VIDEO')throw new Error('Could not start the maze. Stop any live camera stream, then try again.');
  labyrinth=CapMaze.create();labOwner=result.owner;labRevision=revision;labZero={beta:0,gamma:0};labAngles=null;labHasReading=false;labNeutralPending=true;labReadingAt=0;labForce={x:0,y:0};labWonAt=0;labFrameAt=0;labStepAt=Date.now();
  labUnsubscribe=capSensors.subscribe(labyrinthReading);
  // Use the player's comfortable starting position as neutral.
  if(labAngles){labZero={...labAngles};labForce={x:0,y:0};}
  $('labyrinthStatus').textContent='Level 1 · Tilt toward the green goal. Set phone level adjusts your neutral position.';
  renderLabyrinth();await sendLabyrinth();
 }catch(e){stopLabyrinthLocal();$('labyrinthStatus').textContent=e.message;}finally{labStarting=false;}
};
$('levelLabyrinth').onclick=()=>{if(labAngles){labZero={...labAngles};labForce={x:0,y:0};labyrinth.vx=labyrinth.vy=0;$('labyrinthStatus').textContent='Phone level set. Tilt to roll.';}};
$('stopLabyrinth').onclick=async()=>{const owner=labOwner;stopLabyrinthLocal();if(state.mode==='VIDEO'&&owner)await action('/api/video/stop',{owner},'Labyrinth stopped.');$('labyrinthStatus').textContent='Game stopped. Tap Play for a new maze.';renderLabyrinth();};
async function sendLabyrinth(){
 if(!labOwner||labSending||busy)return;labSending=true;const owner=labOwner;
 try{const colors=CapMaze.pixels(labyrinth);previewLabyrinth(colors);await requestSerial('/api/video/frame',{owner,pixels:colors.join('')});labFrameAt=Date.now();}
 catch(e){if(labOwner===owner){stopLabyrinthLocal();$('labyrinthStatus').textContent='Game paused. '+describeError(e);renderLabyrinth();}}finally{labSending=false;}
}
setInterval(()=>{
 const now=Date.now(),dt=(now-labStepAt)/1000;labStepAt=now;
 if(!labOwner||document.hidden||state.mode!=='VIDEO'||revision!==labRevision)return;
 if(labyrinth.won){if(now-labWonAt>1500){labyrinth=CapMaze.create(labyrinth.level+1);labForce={x:0,y:0};if(labAngles)labZero={...labAngles};$('labyrinthStatus').textContent='Level '+labyrinth.level+' · New maze! Find the green goal.';}}
 else if(CapMaze.step(labyrinth,now-labReadingAt<1500?labForce.x:0,now-labReadingAt<1500?labForce.y:0,dt)){labWonAt=now;$('labyrinthStatus').textContent='Level '+labyrinth.level+' complete! Next maze…';}
 if(!labHasReading)$('labyrinthStatus').textContent='Waiting for phone tilt. Keep Safari open and allow motion access.';
 previewLabyrinth(CapMaze.pixels(labyrinth,now));
 if(now-labFrameAt>100)sendLabyrinth();
},40);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&labOwner)$('stopLabyrinth').onclick();});
previewLabyrinth(CapMaze.pixels(CapMaze.create()));renderLabyrinth();
