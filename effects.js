'use strict';
let tiltEnabled=false,lastTilt=null,tiltZero={beta:0,gamma:0},gravityWanted=null,gravitySending=false;
const plasmaCanvas=$('plasmaCanvas'),plasmaCtx=plasmaCanvas.getContext('2d'),plasmaTouches=new Map();
let plasmaWanted=null,plasmaSending=false;
let cameraStream=null,cameraOwner=null,cameraStarting=false,cameraSession=0,cameraTimer=null;
let tugState=null,tugPolling=false,tugTaps=0,tugSending=false,tugPlayer='',tugSeq=0,visitor='';
try{visitor=localStorage.getItem('cap-visitor')||'';tugPlayer=sessionStorage.getItem('cap-tug-player')||'';tugSeq=Number(sessionStorage.getItem('cap-tug-seq')||0);}catch(_){}
if(!/^[a-z0-9_-]{8,80}$/i.test(visitor)){visitor='v'+Math.random().toString(36).slice(2)+Date.now().toString(36);try{localStorage.setItem('cap-visitor',visitor);}catch(_){}}
function savePlayer(){try{sessionStorage.setItem('cap-tug-player',tugPlayer);sessionStorage.setItem('cap-tug-seq',String(tugSeq));}catch(_){}}
function renderEffects(){
  const connected=reachable&&state.connected&&!busy;
  $('enableTilt').disabled=!connected||state.mode!=='SAND';$('calibrateTilt').disabled=!tiltEnabled;
  if(state.mode!=='SAND'&&tiltEnabled){tiltEnabled=false;window.removeEventListener('deviceorientation',orientation);gravityWanted=null;}
  $('calibrateTilt').disabled=!tiltEnabled;
  if(state.mode!=='PLASMA'){plasmaTouches.clear();plasmaWanted=null;}
  if(cameraStream&&!cameraStarting&&(state.mode!=='VIDEO'||cameraSession!==revision))stopCameraLocal();
  $('stopVideo').disabled=!cameraStream;
  const tug=connected&&state.mode==='TUG',you=tugState&&tugState.you;
  $('joinRed').disabled=!tug||!!(tugState?.players.red&&you!=='red')||!!(you&&you!=='red');
  $('joinBlue').disabled=!tug||!!(tugState?.players.blue&&you!=='blue')||!!(you&&you!=='blue');
  $('leaveTug').disabled=!tug||!you;
  $('startTug').disabled=!tug||!you||!tugState?.players.red||!tugState?.players.blue||['playing','countdown'].includes(tugState?.phase);
  $('tapTug').disabled=!tug||!you||tugState?.phase!=='playing';
  if(!tug)tugTaps=0;
}
function bounded(n){return Math.max(-100,Math.min(100,Math.round(n)));}
function orientation(event){
  if(!Number.isFinite(event.beta)||!Number.isFinite(event.gamma))return;
  lastTilt={beta:event.beta,gamma:event.gamma};
  const angle=((screen.orientation&&screen.orientation.angle)||window.orientation||0)*Math.PI/180;
  const x=(event.gamma-tiltZero.gamma)*2,y=(event.beta-tiltZero.beta)*2,flip=$('invertTilt').checked?-1:1;
  gravityWanted={x:bounded((x*Math.cos(angle)+y*Math.sin(angle))*flip),y:bounded((-x*Math.sin(angle)+y*Math.cos(angle))*flip)};
  $('sandStatus').textContent='Tilt active. Tip the phone to move the sand; calibrate to set your neutral angle.';
}
async function flushGravity(){
  if(gravitySending||busy||!reachable||state.mode!=='SAND'||!gravityWanted)return;
  gravitySending=true;const value=gravityWanted;gravityWanted=null;
  try{await requestSerial('/api/sand/gravity',value);}catch(e){$('sandStatus').textContent=describeError(e);}finally{gravitySending=false;}
}
$('startSand').onclick=()=>action('/api/sand/start',{},'Sand ready. Enable tilt or use the gravity sliders.');
$('enableTilt').onclick=async()=>{
  try{
    if(!window.isSecureContext)throw new Error('iPhone tilt needs the SECURE PHONE https:// link. Start the bridge with --tunnel. Manual gravity sliders still work here.');
    if(typeof DeviceOrientationEvent==='undefined')throw new Error('Orientation sensors are unavailable. Use the manual gravity sliders.');
    if(typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted')throw new Error('Motion permission was denied. Allow Motion & Orientation for this website in Safari, or use the sliders.');
    lastTilt=null;tiltEnabled=true;window.addEventListener('deviceorientation',orientation);$('sandStatus').textContent='Motion allowed. Tilt the phone; waiting for sensor data…';renderEffects();
  }catch(e){$('sandStatus').textContent=e.message;}
};
$('calibrateTilt').onclick=()=>{if(lastTilt){tiltZero={...lastTilt};orientation(lastTilt);}};
for(const id of ['gravityX','gravityY'])$(id).addEventListener('input',()=>{tiltEnabled=false;window.removeEventListener('deviceorientation',orientation);gravityWanted={x:Number($('gravityX').value),y:Number($('gravityY').value)};flushGravity();});
setInterval(()=>{if(tiltEnabled&&lastTilt&&state.mode==='SAND')orientation(lastTilt);flushGravity();},180);
function plasmaPoint(e){const b=plasmaCanvas.getBoundingClientRect();return{x:Math.max(0,Math.min(23,Math.floor((e.clientX-b.left)*24/b.width))),y:Math.max(0,Math.min(23,Math.floor((e.clientY-b.top)*24/b.height)))};}
function previewPlasma(){
  plasmaCtx.fillStyle='#0b0717';plasmaCtx.fillRect(0,0,480,480);plasmaCtx.strokeStyle='#6746b3';plasmaCtx.lineWidth=3;
  const points=[...plasmaTouches.values()];
  for(const p of points){plasmaCtx.beginPath();plasmaCtx.moveTo(240,240);for(let n=1;n<=6;n++)plasmaCtx.lineTo(240+((p.x+.5)*20-240)*n/6+(n<6?(Math.random()-.5)*20:0),240+((p.y+.5)*20-240)*n/6+(n<6?(Math.random()-.5)*20:0));plasmaCtx.stroke();}
  plasmaCtx.strokeStyle='#315c91';for(let i=1;i<points.length;i++){plasmaCtx.beginPath();plasmaCtx.moveTo((points[i-1].x+.5)*20,(points[i-1].y+.5)*20);plasmaCtx.lineTo((points[i].x+.5)*20,(points[i].y+.5)*20);plasmaCtx.stroke();}
  plasmaCtx.fillStyle='#b098d9';plasmaCtx.beginPath();plasmaCtx.arc(240,240,12,0,Math.PI*2);plasmaCtx.fill();
}
function queuePlasma(){plasmaWanted=[...plasmaTouches.values()];previewPlasma();flushPlasma();}
async function flushPlasma(){
  if(plasmaSending||busy||state.mode!=='PLASMA'||!reachable||plasmaWanted===null)return;
  plasmaSending=true;const points=plasmaWanted;plasmaWanted=null;
  try{await requestSerial('/api/plasma/points',{points});$('plasmaStatus').textContent=points.length+' touch'+(points.length===1?'':'es')+' — cap confirmed.';}catch(e){$('plasmaStatus').textContent=describeError(e);}finally{plasmaSending=false;}
}
$('startPlasma').onclick=()=>action('/api/plasma/start',{},'Plasma globe ready. Hold your fingers on the globe.');
plasmaCanvas.addEventListener('pointerdown',e=>{e.preventDefault();if(plasmaTouches.size>=5)return;plasmaCanvas.setPointerCapture(e.pointerId);plasmaTouches.set(e.pointerId,plasmaPoint(e));queuePlasma();});
plasmaCanvas.addEventListener('pointermove',e=>{if(plasmaTouches.has(e.pointerId)){e.preventDefault();plasmaTouches.set(e.pointerId,plasmaPoint(e));plasmaWanted=[...plasmaTouches.values()];previewPlasma();}});
for(const event of ['pointerup','pointercancel'])plasmaCanvas.addEventListener(event,e=>{plasmaTouches.delete(e.pointerId);queuePlasma();});
setInterval(()=>{if(state.mode==='PLASMA'){plasmaWanted=[...plasmaTouches.values()];flushPlasma();}},200);
function stopCameraLocal(){
  if(cameraTimer)clearTimeout(cameraTimer);cameraTimer=null;
  if(cameraStream)cameraStream.getTracks().forEach(track=>track.stop());cameraStream=null;
  $('cameraFeed').srcObject=null;$('stopVideo').disabled=true;
}
function rasterHex(data,mirror=false){
  // Reverse 180 degrees before transmission to compensate the cap's scene turn.
  let hex='';for(let y=23;y>=0;y--)for(let x=23;x>=0;x--){const i=(y*24+(mirror?23-x:x))*4;for(let c=0;c<3;c++)hex+=data[i+c].toString(16).padStart(2,'0');}return hex;
}
async function sendCamera(){
  if(!cameraStream||busy||state.mode!=='VIDEO'||cameraSession!==revision){if(!cameraStarting)stopCameraLocal();return;}
  const started=Date.now(),video=$('cameraFeed'),raster=$('videoRaster'),rc=raster.getContext('2d');
  try{
    if(video.videoWidth&&video.videoHeight){
      const side=Math.min(video.videoWidth,video.videoHeight);rc.drawImage(video,(video.videoWidth-side)/2,(video.videoHeight-side)/2,side,side,0,0,24,24);
      const pixels=rasterHex(rc.getImageData(0,0,24,24).data,$('mirrorVideo').checked);
      await requestSerial('/api/video/frame',{owner:cameraOwner,pixels});
      $('videoStatus').textContent='Live 24 × 24 raster — cap confirmed. USB transfer determines the actual update rate.';
    }
    if(cameraStream&&cameraSession===revision)cameraTimer=setTimeout(sendCamera,Math.max(30,1000/Number($('videoFPS').value)-(Date.now()-started)));
  }catch(e){stopCameraLocal();$('videoStatus').textContent=describeError(e);}
}
$('startVideo').onclick=async()=>{
  if(cameraStarting)return;cameraStarting=true;
  try{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access needs the SECURE PHONE https:// link. Start the bridge with --tunnel, then open its secure link in Safari.');
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:640},height:{ideal:480}}});
    stopCameraLocal();cameraStream=stream;$('cameraFeed').srcObject=stream;await $('cameraFeed').play();
    const result=await action('/api/video/start',{},'Camera stream started.');
    if(!result||state.mode!=='VIDEO')throw new Error('The cap did not start camera mode. Check the connection and retry.');
    cameraOwner=result.owner;cameraSession=revision;cameraStarting=false;renderEffects();sendCamera();
  }catch(e){stopCameraLocal();cameraStarting=false;$('videoStatus').textContent=e.message;renderEffects();}
};
$('stopVideo').onclick=async()=>{const owner=cameraOwner;stopCameraLocal();if(state.mode==='VIDEO')await action('/api/video/stop',{owner},'Camera stopped.');};
async function pollTug(){
  if(tugPolling||!reachable||!state.connected||state.mode!=='TUG')return;tugPolling=true;
  try{
    tugState=await api('/api/tug',undefined,tugPlayer?{'X-Player-Key':tugPlayer}:{});
    if(tugPlayer&&!tugState.you){tugPlayer='';savePlayer();}
    $('tugKnot').style.left=(50+tugState.score*1.1)+'%';
    const phase=tugState.phase,red=tugState.players.red,blue=tugState.players.blue;
    $('tugStatus').textContent=(tugState.you?'You are '+tugState.you+'. ':'Spectating. ')+(phase==='waiting'?(red&&blue?'Both players joined. Start the round.':'Waiting for '+(!red?'red':'blue')+' player.'):phase==='countdown'?'Starts in '+Math.ceil(tugState.remaining)+'…':phase==='playing'?Math.ceil(tugState.remaining)+' seconds · red '+tugState.taps.red+' taps / blue '+tugState.taps.blue+' taps':tugState.winner==='draw'?'Draw! Start a rematch.':tugState.winner.toUpperCase()+' wins!');
    $('tapTug').textContent=tugState.you?'TAP FOR '+tugState.you.toUpperCase():'CHOOSE A PLAYER';renderEffects();
  }catch(e){$('tugStatus').textContent=describeError(e);}finally{tugPolling=false;}
}
$('openTug').onclick=async()=>{await action('/api/tug/open',{},'Tug of war is open. Choose a player on each phone.');pollTug();};
for(const side of ['Red','Blue'])$('join'+side).onclick=async()=>{try{const result=await api('/api/tug/join',{side:side.toLowerCase(),client:visitor});tugPlayer=result.player;tugState=result.game;savePlayer();pollTug();}catch(e){$('tugStatus').textContent=e.message;}};
$('leaveTug').onclick=async()=>{try{await api('/api/tug/leave',{player:tugPlayer});tugPlayer='';savePlayer();pollTug();}catch(e){$('tugStatus').textContent=e.message;}};
$('startTug').onclick=async()=>{try{await api('/api/tug/start',{player:tugPlayer});pollTug();}catch(e){$('tugStatus').textContent=e.message;}};
$('tapTug').addEventListener('pointerdown',e=>{e.preventDefault();if(!$('tapTug').disabled)tugTaps=Math.min(20,tugTaps+1);});
async function sendTaps(){
  if(tugSending||!tugTaps||!tugPlayer||state.mode!=='TUG'||tugState?.phase!=='playing')return;
  tugSending=true;const count=Math.min(10,tugTaps);tugTaps-=count;tugSeq=tugSeq%2147483646+1;savePlayer();
  try{const response=await api('/api/tug/tap',{player:tugPlayer,seq:tugSeq,count});tugState=response.game;renderEffects();}catch(e){tugTaps=0;$('tugStatus').textContent=e.message;}finally{tugSending=false;}
}
setInterval(pollTug,500);setInterval(sendTaps,160);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCameraLocal();plasmaTouches.clear();queuePlasma();if(tiltEnabled){window.removeEventListener('deviceorientation',orientation);tiltEnabled=false;}}});
previewPlasma();renderEffects();
