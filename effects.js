'use strict';
let tiltEnabled=false,lastTilt=null,lastMotion=null,lastSampleAt=0,motionAt=0,sensorSource="none",sensorTimer=null;
let tiltZero={beta:0,gamma:0},motionZero={x:0,y:0},latestForce=null,gravityWanted=null,gravitySending=false,lastGravityAck=null,melting=false,gravityOwner=null,manualGravityActive=false,gravityClaiming=false;
const plasmaCanvas=$('plasmaCanvas'),plasmaCtx=plasmaCanvas.getContext('2d'),plasmaTouches=new Map();
let plasmaWanted=null,plasmaSending=false;
let cameraStream=null,cameraOwner=null,cameraStarting=false,cameraSession=0,cameraTimer=null;
let tugState=null,tugPolling=false,tugTaps=0,tugSending=false,tugPlayer='',tugSeq=0,visitor='';
try{visitor=localStorage.getItem('cap-visitor')||'';tugPlayer=sessionStorage.getItem('cap-tug-player')||'';tugSeq=Number(sessionStorage.getItem('cap-tug-seq')||0);}catch(_){}
if(!/^[a-z0-9_-]{8,80}$/i.test(visitor)){visitor='v'+Math.random().toString(36).slice(2)+Date.now().toString(36);try{localStorage.setItem('cap-visitor',visitor);}catch(_){}}
function savePlayer(){try{sessionStorage.setItem('cap-tug-player',tugPlayer);sessionStorage.setItem('cap-tug-seq',String(tugSeq));}catch(_){}}
function renderEffects(){
  const connected=reachable&&state.connected&&!busy;
  $('enableTilt').disabled=!connected||!['SAND','PARTICLES'].includes(state.mode);$('calibrateTilt').disabled=!tiltEnabled;
  if(!['SAND','PARTICLES'].includes(state.mode)&&(tiltEnabled||manualGravityActive||gravityOwner))stopTilt();
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
function tiltMessage(message){$('sandStatus').textContent=message;$('drawingTiltStatus').textContent=message;}
function tiltDiagnostics(ack){
  if(ack)lastGravityAck=ack;
  const seen=lastSampleAt?Math.max(0,Math.round((Date.now()-lastSampleAt)/1000)):null;
  $('tiltDiagnostics').textContent='Sensors: '+(tiltEnabled?(seen===null?'waiting for data':sensorSource+' · '+seen+'s ago'):'manual / disabled')+' · cap gravity: '+(lastGravityAck||'waiting for confirmation')+' · Due: '+(state.device_gravity?state.device_gravity.x+', '+state.device_gravity.y:'not yet reported')+' · controller: '+(gravityOwner?'this page':state.gravity_source?'another page ('+state.gravity_source+')':'none');
}
function stopTilt(){
  tiltEnabled=false;window.removeEventListener('deviceorientation',orientation);window.removeEventListener('devicemotion',motion);
  if(sensorTimer)clearTimeout(sensorTimer);sensorTimer=null;gravityWanted=null;latestForce=null;gravityOwner=null;manualGravityActive=false;
}
function forceInScreen(x,y){
  const angle=((screen.orientation&&screen.orientation.angle)||window.orientation||0)*Math.PI/180;
  const flip=$('invertTilt').checked?-1:1;
  latestForce={x:bounded((x*Math.cos(angle)+y*Math.sin(angle))*flip),y:bounded((-x*Math.sin(angle)+y*Math.cos(angle))*flip)};
  gravityWanted={...latestForce};tiltDiagnostics();
}
function motion(event){
  const a=event.accelerationIncludingGravity;
  if($('tiltSource').value==='orientation')return;
  if(!a||!Number.isFinite(a.x)||!Number.isFinite(a.y)||!Number.isFinite(a.z)||Math.abs(a.x)+Math.abs(a.y)+Math.abs(a.z)<.01)return;
  lastMotion={x:-a.x,y:a.y};motionAt=Date.now();lastSampleAt=motionAt;sensorSource='gravity sensor';
  forceInScreen((lastMotion.x-motionZero.x)*100/9.81,(lastMotion.y-motionZero.y)*100/9.81);
}
function orientation(event){
  if(!Number.isFinite(event.beta)||!Number.isFinite(event.gamma))return;
  lastTilt={beta:event.beta,gamma:event.gamma};
  if($('tiltSource').value==='gravity'||($('tiltSource').value!=='orientation'&&lastMotion&&Date.now()-motionAt<1500))return;
  lastSampleAt=Date.now();sensorSource='orientation fallback';
  forceInScreen(Math.sin((event.gamma-tiltZero.gamma)*Math.PI/180)*100,Math.sin((event.beta-tiltZero.beta)*Math.PI/180)*100);
}
async function requestPhoneSensors(){
  if(!window.isSecureContext)throw new Error('Tilt needs the SECURE PHONE https:// link. Start the bridge with --tunnel; the manual gravity sliders work here.');
  const types=[typeof DeviceMotionEvent!=='undefined'?DeviceMotionEvent:null,typeof DeviceOrientationEvent!=='undefined'?DeviceOrientationEvent:null].filter(Boolean);
  if(!types.length)throw new Error('This browser has no motion sensor API. Use Safari on the iPhone, or the manual gravity sliders.');
  // Invoke both permission requests during the original tap, before any network await.
  const requests=[];for(const type of types)if(typeof type.requestPermission==='function'){try{requests.push(type.requestPermission());}catch(e){requests.push(Promise.reject(e));}}
  const results=await Promise.allSettled(requests);
  if(requests.length&&!results.some(r=>r.status==='fulfilled'&&r.value==='granted'))throw new Error('Motion permission was denied. Allow Motion & Orientation for this site in Safari, then tap Enable tilt again.');
}
async function startPhoneSensors(){
  stopTilt();
  const claim=await api('/api/tilt/claim',{client:visitor,kind:'sensor'});gravityOwner=claim.owner;
  lastGravityAck=null;lastTilt=null;lastMotion=null;lastSampleAt=0;motionAt=0;tiltEnabled=true;
  window.addEventListener('devicemotion',motion);window.addEventListener('deviceorientation',orientation);
  tiltMessage('Motion permission allowed. Waiting for sensor readings…');tiltDiagnostics();renderEffects();
  sensorTimer=setTimeout(()=>{if(tiltEnabled&&!lastSampleAt)tiltMessage('No sensor readings arrived. Open the SECURE PHONE link in Safari and check Motion & Orientation permission, or use the sliders.');},5000);
}
async function flushGravity(){
  if(gravitySending||busy||!reachable||!gravityOwner||!['SAND','PARTICLES'].includes(state.mode)||!gravityWanted)return;
  gravitySending=true;const value=gravityWanted;gravityWanted=null;const session=revision;
  try{const result=await requestSerial('/api/sand/gravity',{...value,owner:gravityOwner});if(result.device_gravity)state.device_gravity=result.device_gravity;if(session===revision){tiltDiagnostics(value.x+', '+value.y+' confirmed');tiltMessage(tiltEnabled?(lastSampleAt?'Tilt active — cap gravity confirmed. Tip the phone; Calibrate sets neutral.':'Manual gravity confirmed; still waiting for sensor readings.'):'Manual gravity confirmed.');}}
  catch(e){if(session===revision){stopTilt();tiltMessage(describeError(e));}}finally{gravitySending=false;}
}
$('startSand').onclick=()=>action('/api/sand/start',{},'Sand ready. Enable tilt or use the gravity sliders.');
$('enableTilt').onclick=async()=>{try{await requestPhoneSensors();await startPhoneSensors();}catch(e){stopTilt();tiltMessage(e.message);tiltDiagnostics();renderEffects();}};
$('animateDrawing').onclick=async()=>{
  if(busy||melting)return;
  const count=pixels.filter(color=>color!=='000000').length;
  if(!count){$('drawingTiltStatus').textContent='Draw some colored pixels first. Black pixels are empty space.';return;}
  if(count===576){$('drawingTiltStatus').textContent='Erase some space first: a fully packed canvas has no room for particles to move.';return;}
  melting=true;
  try{
    let sensorError=null;try{await requestPhoneSensors();}catch(e){sensorError=e;}
    await action('/api/draw/particles',{pixels:pixels.join('')},'Your drawing is now loose particles. Show drawing restores the original.');
    if(state.mode==='PARTICLES'){if(!sensorError)await startPhoneSensors();else tiltMessage('Drawing particles are ready. '+sensorError.message);}
  }finally{melting=false;}
};
$('tiltSource').onchange=()=>{lastMotion=null;lastSampleAt=0;latestForce=null;gravityWanted=null;tiltMessage('Tilt source changed. Waiting for a fresh sensor reading.');};
$('calibrateTilt').onclick=()=>{
  if(lastTilt)tiltZero={...lastTilt};if(lastMotion)motionZero={...lastMotion};
  if(lastMotion&&Date.now()-motionAt<1500)forceInScreen(0,0);else if(lastTilt)orientation(lastTilt);
};
$('invertTilt').onchange=()=>{if(lastMotion&&Date.now()-motionAt<1500)forceInScreen((lastMotion.x-motionZero.x)*100/9.81,(lastMotion.y-motionZero.y)*100/9.81);else if(lastTilt)orientation(lastTilt);};
async function manualGravity(){
  if(!['SAND','PARTICLES'].includes(state.mode)||gravityClaiming)return;
  if(!manualGravityActive||!gravityOwner){
    stopTilt();gravityClaiming=true;
    try{const claim=await api('/api/tilt/claim',{client:visitor,kind:'manual'});gravityOwner=claim.owner;manualGravityActive=true;}
    catch(e){tiltMessage(describeError(e));return;}finally{gravityClaiming=false;}
  }
  gravityWanted={x:Number($('gravityX').value),y:Number($('gravityY').value)};flushGravity();
}
for(const id of ['gravityX','gravityY'])$(id).addEventListener('input',manualGravity);
setInterval(()=>{
  if(document.hidden||!['SAND','PARTICLES'].includes(state.mode))return;
  if(tiltEnabled&&latestForce)gravityWanted={...latestForce};
  else if(manualGravityActive&&gravityOwner)gravityWanted={x:Number($('gravityX').value),y:Number($('gravityY').value)};
  flushGravity();
},180);
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
  // Same row-major logical coordinates as drawing; the firmware turns it once.
  let hex='';for(let y=0;y<24;y++)for(let x=0;x<24;x++){const i=(y*24+(mirror?23-x:x))*4;for(let c=0;c<3;c++)hex+=data[i+c].toString(16).padStart(2,'0');}return hex;
}
function filterRaster(data,options={}){
  const mode=options.mode||'natural',brightness=Number(options.brightness)||0,contrast=Number(options.contrast)||1,gamma=Number(options.gamma)||1;
  const luma=new Float32Array(576),hist=new Uint16Array(256);let sum=0;
  for(let n=0;n<576;n++){const i=n*4;const light=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];luma[n]=light;hist[Math.round(light)]++;sum+=light;}
  let gain=1,offset=0;
  if(options.auto){
    let accumulated=0,low=0,high=255;
    for(let i=0;i<256;i++){accumulated+=hist[i];if(accumulated>=29){low=i;break;}}
    accumulated=0;for(let i=255;i>=0;i--){accumulated+=hist[i];if(accumulated>=29){high=i;break;}}
    if(high-low>=24){gain=Math.max(.6,Math.min(4,200/(high-low)));offset=16-low*gain;}
    else gain=Math.max(.7,Math.min(2.5,110/(sum/576+1)));
  }
  const out=new Uint8ClampedArray(data.length);
  const adjust=value=>Math.max(0,Math.min(255,255*Math.pow(Math.max(0,Math.min(255,((value*gain+offset)-128)*contrast+128+brightness))/255,gamma)));
  for(let n=0;n<576;n++){
    const i=n*4;let r=adjust(data[i]),g=adjust(data[i+1]),b=adjust(data[i+2]);
    if(mode==='mono'||mode==='silhouette'){let v=.2126*r+.7152*g+.0722*b;if(mode==='silhouette')v=v>=128?235:0;r=g=b=v;}
    if(mode==='edges'){
      const x=n%24,y=Math.floor(n/24),get=(dx,dy)=>luma[Math.max(0,Math.min(23,y+dy))*24+Math.max(0,Math.min(23,x+dx))];
      const gx=-get(-1,-1)+get(1,-1)-2*get(-1,0)+2*get(1,0)-get(-1,1)+get(1,1);
      const gy=-get(-1,-1)-2*get(0,-1)-get(1,-1)+get(-1,1)+2*get(0,1)+get(1,1);
      const edge=adjust(Math.min(255,Math.sqrt(gx*gx+gy*gy)*.7));r=edge*.25;g=edge;b=edge;
    }
    out[i]=r;out[i+1]=g;out[i+2]=b;out[i+3]=255;
  }
  return out;
}
function videoSettings(){return{mode:$('videoFilter').value||'natural',auto:$('autoExposure').checked,brightness:Number($('videoBrightness').value)||0,contrast:(Number($('videoContrast').value)||100)/100,gamma:(Number($('videoGamma').value)||100)/100};}
$('videoFilter').onchange=()=>{
  const presets={natural:[0,100,100],lowlight:[15,110,65],bright:[-10,150,110],mono:[0,120,100],silhouette:[0,150,100],edges:[0,120,100]};
  const preset=presets[$('videoFilter').value]||presets.natural;
  $('videoBrightness').value=String(preset[0]);$('videoContrast').value=String(preset[1]);$('videoGamma').value=String(preset[2]);$('autoExposure').checked=true;
};
async function sendCamera(){
  if(!cameraStream||busy||state.mode!=='VIDEO'||cameraSession!==revision){if(!cameraStarting)stopCameraLocal();return;}
  const started=Date.now(),video=$('cameraFeed'),raster=$('videoRaster'),rc=raster.getContext('2d');
  try{
    if(video.videoWidth&&video.videoHeight){
      const side=Math.min(video.videoWidth,video.videoHeight);rc.drawImage(video,(video.videoWidth-side)/2,(video.videoHeight-side)/2,side,side,0,0,24,24);
      const image=rc.getImageData(0,0,24,24);const filtered=filterRaster(image.data,videoSettings());
      if($('mirrorVideo').checked){for(let y=0;y<24;y++)for(let x=0;x<24;x++){const dst=(y*24+x)*4,src=(y*24+23-x)*4;for(let c=0;c<4;c++)image.data[dst+c]=filtered[src+c];}}
      else image.data.set(filtered);
      rc.putImageData(image,0,0);
      const pixels=rasterHex(filtered,$('mirrorVideo').checked);
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
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCameraLocal();plasmaTouches.clear();queuePlasma();if(tiltEnabled){stopTilt();tiltMessage('Tilt paused while the page is hidden. Tap Enable tilt to resume.');}}});
previewPlasma();renderEffects();
