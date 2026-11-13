'use strict';
const canvas=$('drawCanvas'), ctx=canvas.getContext('2d');
let pixels=Array(576).fill('000000'), erase=false, lastPoint=null, pointer=null;
let strokes=new Map(), strokeBusy=false, desiredInput=null, inputBusy=false;
try{const saved=localStorage.getItem('cap-drawing');if(/^[0-9a-f]{3456}$/i.test(saved||''))pixels=saved.match(/.{6}/g);}catch(_){}
function drawPreview(){
  ctx.fillStyle='#060b09';ctx.fillRect(0,0,480,480);
  for(let y=0;y<24;y++)for(let x=0;x<24;x++){ctx.fillStyle='#'+pixels[y*24+x];ctx.fillRect(x*20+1,y*20+1,18,18);}
}
function saveDrawing(){try{localStorage.setItem('cap-drawing',pixels.join(''));}catch(_){} }
function renderCreative(){
  const playing=reachable&&state.connected&&!busy&&state.mode==='GAME';
  $('clearDrawing').disabled=busy;
  $('paddle').disabled=!playing||![3,6].includes(state.animation);
  document.querySelectorAll('[data-direction]').forEach(b=>b.disabled=!playing||state.animation!==13);
  document.querySelectorAll('[data-game]').forEach(b=>b.classList.toggle('active',playing&&Number(b.dataset.game)===state.animation));
  $('gameHelp').textContent=playing?(state.animation===13?'Use the arrows or swipe this pad. Walls and your own tail end the round; a new round starts automatically.':state.animation===6?'You control the red paddle. The blue paddle is the computer. Move the slider while watching the cap.':'Move the slider to keep the ball in play. Watch the cap; a new round starts after your lives run out.'):'Choose a game to play. Animation buttons below run their automatic versions.';
  if(state.mode!=='DRAW'){strokes.clear();}
  if(!playing)desiredInput=null;
}
function position(event){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(23,Math.floor((event.clientX-r.left)*24/r.width))),y:Math.max(0,Math.min(23,Math.floor((event.clientY-r.top)*24/r.height)))};}
function paint(x,y){const color=erase?'000000':$('brushColor').value.slice(1);pixels[y*24+x]=color;strokes.set(y*24+x,{x,y,color});}
function line(a,b){let x=a.x,y=a.y;const dx=Math.abs(b.x-x),sx=x<b.x?1:-1,dy=-Math.abs(b.y-y),sy=y<b.y?1:-1;let error=dx+dy;while(true){paint(x,y);if(x===b.x&&y===b.y)break;const twice=2*error;if(twice>=dy){error+=dy;x+=sx;}if(twice<=dx){error+=dx;y+=sy;}}}
canvas.addEventListener('pointerdown',e=>{if(pointer!==null)return;e.preventDefault();pointer=e.pointerId;canvas.setPointerCapture(pointer);lastPoint=position(e);paint(lastPoint.x,lastPoint.y);drawPreview();$('drawingStatus').textContent=state.mode==='DRAW'&&state.connected?'Drawing…':'Saved on this phone. Tap Show drawing to send it to the cap.';});
canvas.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;e.preventDefault();const next=position(e);line(lastPoint,next);lastPoint=next;drawPreview();});
function finishStroke(e){if(pointer!==e.pointerId)return;pointer=null;lastPoint=null;saveDrawing();flushStroke();}
canvas.addEventListener('pointerup',finishStroke);canvas.addEventListener('pointercancel',finishStroke);
$('eraser').onclick=()=>{erase=!erase;$('eraser').setAttribute('aria-pressed',String(erase));};
$('brushColor').oninput=()=>{erase=false;$('eraser').setAttribute('aria-pressed','false');};
$('showDrawing').onclick=async()=>{strokes.clear();await action('/api/draw/frame',{pixels:pixels.join('')},'Drawing displayed — cap confirmed.');$('drawingStatus').textContent=state.mode==='DRAW'?'New strokes send live when Live is checked.':'Drawing remains saved on this phone.';};
$('clearDrawing').onclick=async()=>{pixels.fill('000000');strokes.clear();drawPreview();saveDrawing();if(reachable&&state.connected&&state.mode==='DRAW')await action('/api/draw/clear',{},'Drawing cleared — cap confirmed.');else $('drawingStatus').textContent='Canvas cleared on this phone.';};
$('liveDrawing').onchange=()=>{if($('liveDrawing').checked&&state.mode==='DRAW')$('showDrawing').click();};
async function flushStroke(){
  if(strokeBusy||busy||!reachable||!state.connected||state.mode!=='DRAW'||!$('liveDrawing').checked||!strokes.size)return;
  strokeBusy=true;const session=revision;
  try{
    while(strokes.size&&!busy&&session===revision&&state.mode==='DRAW'){
      const batch=[...strokes.entries()].slice(0,32);batch.forEach(([id])=>strokes.delete(id));
      await requestSerial('/api/draw/stroke',{pixels:batch.map(([,p])=>p)});
      if(session===revision)$('drawingStatus').textContent='Stroke displayed — cap confirmed.';
    }
  }catch(e){strokes.clear();if(session===revision){$('drawingStatus').textContent='Stroke not confirmed. Tap Show drawing to resend the full canvas.';setupError(describeError(e));}}
  finally{strokeBusy=false;}
}
setInterval(flushStroke,120);
for(const b of document.querySelectorAll('[data-game]'))b.onclick=()=>{desiredInput=null;return action('/api/game',{id:Number(b.dataset.game)},`${b.textContent} is ready — you are playing.`);};
async function sendInput(value){
  if(busy||!reachable||!state.connected||state.mode!=='GAME')return;
  if(value.direction&&state.animation!==13)return;
  if(value.paddle!==undefined&&![3,6].includes(state.animation))return;
  desiredInput=value;if(inputBusy)return;inputBusy=true;const session=revision;
  try{while(desiredInput&&session===revision&&!busy&&state.mode==='GAME'){
    const next=desiredInput;desiredInput=null;await requestSerial('/api/input',next);
  }}catch(e){desiredInput=null;if(session===revision)setupError(describeError(e));}
  finally{inputBusy=false;}
}
let sliderTimer=null;
$('paddle').addEventListener('input',()=>{if(sliderTimer)return;sliderTimer=setTimeout(()=>{sliderTimer=null;sendInput({paddle:Number($('paddle').value)});},65);});
for(const b of document.querySelectorAll('[data-direction]'))b.onclick=()=>sendInput({direction:b.dataset.direction});
let swipe=null;
$('snakePad').addEventListener('pointerdown',e=>{if(state.mode==='GAME'&&state.animation===13)swipe={x:e.clientX,y:e.clientY};});
$('snakePad').addEventListener('pointerup',e=>{if(!swipe)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;sendInput({direction:Math.abs(dx)>Math.abs(dy)?dx>0?'RIGHT':'LEFT':dy>0?'DOWN':'UP'});});
$('snakePad').addEventListener('pointercancel',()=>{swipe=null;});
drawPreview();renderCreative();
