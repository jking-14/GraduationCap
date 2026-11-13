'use strict';
const pondCanvas=$('rippleCanvas'),pondContext=pondCanvas.getContext('2d');
let pondPreview=[],pondQueue=[],pondSending=false,pondAnimating=false;
const pondPointers=new Map();
function renderPond(){
  if(state.mode!=='RIPPLE')pondQueue=[];
}
function paintPond(){
  const now=Date.now();pondPreview=pondPreview.filter(r=>now-r.born<12600);
  pondContext.fillStyle='#061b25';pondContext.fillRect(0,0,480,480);
  for(const ring of pondPreview){
    const age=now-ring.born,fade=Math.max(0,1-age/12600);
    pondContext.strokeStyle=`rgba(45,190,220,${fade})`;pondContext.lineWidth=3;
    pondContext.beginPath();pondContext.arc((ring.x+.5)*20,(ring.y+.5)*20,Math.max(.5,age*20/372),0,Math.PI*2);pondContext.stroke();
  }
  if(pondPreview.length){pondAnimating=true;requestAnimationFrame(paintPond);}else pondAnimating=false;
}
function pondPoint(e){const box=pondCanvas.getBoundingClientRect();return{x:Math.max(0,Math.min(23,Math.floor((e.clientX-box.left)*24/box.width))),y:Math.max(0,Math.min(23,Math.floor((e.clientY-box.top)*24/box.height)))};}
function touchPond(point){
  pondPreview.push({...point,born:Date.now()});if(pondPreview.length>8)pondPreview.shift();if(!pondAnimating)paintPond();
  if(!reachable||!state.connected||state.mode!=='RIPPLE'||busy){$('rippleStatus').textContent='Preview only. Connect the cap and tap Start touch pond to send ripples.';return;}
  pondQueue.push(point);if(pondQueue.length>8)pondQueue.shift();flushPond();
}
async function flushPond(){
  if(pondSending||busy||!reachable||!state.connected||state.mode!=='RIPPLE')return;
  pondSending=true;const session=revision;
  try{while(pondQueue.length&&!busy&&session===revision&&state.mode==='RIPPLE'){
    await requestSerial('/api/ripple',pondQueue.shift());
    if(session===revision)$('rippleStatus').textContent='Touch received — cap confirmed.';
  }}catch(e){pondQueue=[];if(session===revision){$('rippleStatus').textContent='Touch not confirmed. Start the touch pond again to retry.';setupError(describeError(e));}}
  finally{pondSending=false;}
}
$('startRipples').onclick=async()=>{pondQueue=[];pondPreview=[];await action('/api/ripple/start',{},'Touch pond ready — tap or drag the pond surface.');paintPond();$('rippleStatus').textContent=state.mode==='RIPPLE'?'Tap or drag to create ripples at matching cap positions.':'Start the touch pond after connecting the cap.';};
pondCanvas.addEventListener('pointerdown',e=>{e.preventDefault();pondCanvas.setPointerCapture(e.pointerId);const point=pondPoint(e);pondPointers.set(e.pointerId,{...point,time:Date.now()});touchPond(point);});
pondCanvas.addEventListener('pointermove',e=>{const previous=pondPointers.get(e.pointerId);if(!previous)return;e.preventDefault();const point=pondPoint(e),now=Date.now();if(now-previous.time>=130&&(point.x!==previous.x||point.y!==previous.y)){pondPointers.set(e.pointerId,{...point,time:now});touchPond(point);}});
for(const event of ['pointerup','pointercancel'])pondCanvas.addEventListener(event,e=>pondPointers.delete(e.pointerId));
paintPond();renderPond();
