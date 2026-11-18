'use strict';
const canvas=$('drawCanvas'), ctx=canvas.getContext('2d');
let pixels=Array(576).fill('000000'), erase=false, lastPoint=null, pointer=null;
let joystickPointer=null,joystickDirection=null,joystickPaddle=null,joystickRevision=-1;
let strokes=new Map(), strokeBusy=false, desiredInput=null, inputBusy=false, inputEvents=[];
try{const saved=localStorage.getItem('cap-drawing');if(/^[0-9a-f]{3456}$/i.test(saved||''))pixels=saved.match(/.{6}/g);}catch(_){}
function drawPreview(){
  ctx.fillStyle='#060b09';ctx.fillRect(0,0,480,480);
  for(let y=0;y<24;y++)for(let x=0;x<24;x++){ctx.fillStyle='#'+pixels[y*24+x];ctx.fillRect(x*20+1,y*20+1,18,18);}
}
function saveDrawing(){try{localStorage.setItem('cap-drawing',pixels.join(''));}catch(_){} }
function renderCreative(){
  const playing=reachable&&state.connected&&!busy&&state.mode==='GAME';
  $('clearDrawing').disabled=busy;
  $('paddle').disabled=!playing||![3,6,14].includes(state.animation);
  $('snakePad').setAttribute('aria-disabled',String(!playing||![3,6,13,14].includes(state.animation)));
  if(!playing||joystickRevision!==revision)resetJoystick();
  document.querySelectorAll('[data-game]').forEach(b=>b.classList.toggle('active',playing&&Number(b.dataset.game)===state.animation));
  const help={
    3:'Drag the joystick or move the slider to keep the ball in play. The slider uses the same left/right frame as drawing.',
    6:'You control the red paddle against the blue computer paddle. Drag the joystick or move the slider while watching the cap.',
    13:'Drag the joystick to steer. Directions follow the same top/bottom and left/right frame as drawing. Avoid walls and your body.',
    14:'Steer your ship with the joystick or slider and tap Fire to shoot. Clear the aliens and dodge their shots.',
    16:'The scene scrolls automatically. Tap Jump to clear gaps, platforms and enemies. New runs start after a fall.'
  };
  $('gameHelp').textContent=playing?help[state.animation]:'Choose a game to play. Scene buttons above run their automatic versions.';
  $('paddleLabel').textContent=state.animation===14?'Move your ship':'Move your paddle';
  $('gameAction').disabled=!playing||![14,16].includes(state.animation);
  $('gameAction').textContent=state.animation===14?'Fire':state.animation===16?'Jump':'Jump / Fire';
  if(state.mode!=='DRAW'){strokes.clear();}
  if(!playing){desiredInput=null;inputEvents=[];}
  if(typeof renderPond==='function')renderPond();
  if(typeof renderEffects==='function')renderEffects();
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
$('clearDrawing').onclick=async()=>{pixels.fill('000000');strokes.clear();drawPreview();saveDrawing();if(reachable&&state.connected&&['DRAW','PARTICLES'].includes(state.mode))await action('/api/draw/clear',{},'Drawing cleared — cap confirmed.');else $('drawingStatus').textContent='Canvas cleared on this phone.';};
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
for(const b of document.querySelectorAll('[data-game]'))b.onclick=()=>{desiredInput=null;inputEvents=[];$('paddle').value='12';return action('/api/game',{id:Number(b.dataset.game)},`${b.textContent} is ready — you are playing.`);};
async function sendInput(value){
  if(busy||!reachable||!state.connected||state.mode!=='GAME')return;
  if(value.direction&&state.animation!==13)return;
  if(value.paddle!==undefined&&![3,6,14].includes(state.animation))return;
  if(value.action){if(![14,16].includes(state.animation))return;if(inputEvents.length<8)inputEvents.push(value);}
  else desiredInput=value;
  if(inputBusy)return;inputBusy=true;const session=revision;
  try{while((desiredInput||inputEvents.length)&&session===revision&&!busy&&state.mode==='GAME'){
    const next=desiredInput||inputEvents.shift();if(next===desiredInput)desiredInput=null;await requestSerial('/api/input',next);
  }}catch(e){desiredInput=null;inputEvents=[];if(session===revision)setupError(describeError(e));}
  finally{inputBusy=false;}
}
let sliderTimer=null;
$('paddle').addEventListener('input',()=>{if(sliderTimer)return;sliderTimer=setTimeout(()=>{sliderTimer=null;sendInput({paddle:Number($('paddle').value)});},65);});
$('gameAction').onclick=()=>sendInput({action:state.animation===14?'FIRE':'JUMP'});
function resetJoystick(){joystickPointer=null;joystickDirection=null;joystickPaddle=null;$('joystickKnob').style.transform='translate(-50%,-50%)';}
function joystickEnabled(){return !busy&&reachable&&state.connected&&state.mode==='GAME'&&[3,6,13,14].includes(state.animation);}
function moveJoystick(e){
 if(!joystickEnabled())return;const r=$('snakePad').getBoundingClientRect(),radius=Math.min(r.width,r.height||r.width)*.32;
 let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-(r.height||r.width)/2;
 const length=Math.hypot(x,y);if(length>radius){x*=radius/length;y*=radius/length;}
 $('joystickKnob').style.transform='translate(-50%,-50%) translate('+x+'px,'+y+'px)';
 if(Math.hypot(x,y)<radius*.2){joystickDirection=null;return;}
 if(state.animation===13){const direction=Math.abs(x)>Math.abs(y)?x>0?'RIGHT':'LEFT':y>0?'DOWN':'UP';if(direction!==joystickDirection){joystickDirection=direction;sendInput({direction});}}
 else{const paddle=Math.max(0,Math.min(23,Math.round(11.5+x/radius*11.5)));if(paddle!==joystickPaddle){joystickPaddle=paddle;$('paddle').value=String(paddle);sendInput({paddle});}}
}
$('snakePad').addEventListener('pointerdown',e=>{if(!joystickEnabled()||joystickPointer!==null)return;e.preventDefault();joystickPointer=e.pointerId;joystickRevision=revision;$('snakePad').setPointerCapture(e.pointerId);moveJoystick(e);});
$('snakePad').addEventListener('pointermove',e=>{if(e.pointerId!==joystickPointer)return;e.preventDefault();moveJoystick(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('snakePad').addEventListener(event,e=>{if(e.pointerId===joystickPointer)resetJoystick();});
$('snakePad').addEventListener('keydown',e=>{if(!joystickEnabled())return;const directions={ArrowUp:'UP',ArrowDown:'DOWN',ArrowLeft:'LEFT',ArrowRight:'RIGHT'};if(!directions[e.key])return;e.preventDefault();if(state.animation===13)sendInput({direction:directions[e.key]});else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){const paddle=Math.max(0,Math.min(23,Number($('paddle').value)+(e.key==='ArrowRight'?2:-2)));$('paddle').value=String(paddle);sendInput({paddle});}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetJoystick();});
drawPreview();renderCreative();
