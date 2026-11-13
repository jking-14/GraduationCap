'use strict';
const $ = id => document.getElementById(id);
const groups = [
  ['NATURE & NIGHT', [[19,'Growing Plant','♧'],[20,'Beach','≈'],[21,'Moonlit Campfire','☾'],[22,'Underwater','⋈'],[23,'Night City','▥'],[18,'Rain and Lightning','ϟ'],[2,'Pond Ripples','◎']]],
  ['RETRO GAMES', [[1,'Tron','⌁'],[3,'Breakout','▤'],[6,'Pong','Ⅱ'],[11,'Tetris','▙'],[12,'Pac-Man','◔'],[13,'Snake','⌇'],[14,'Space Invaders','⋀'],[16,'Platformer','▟']]],
  ['LIGHT & MOTION', [[0,'Matrix Rain','⋮'],[4,'Rotating Cube','◇'],[5,'Loading Bar','▰'],[7,'DVD','▱'],[8,'Starfield','✧'],[9,'Lava Lamp','◒'],[10,'Sine Waves','∿'],[15,'Fireworks','✳'],[17,'Game of Life','⁙']]]
];
let key = '';
try { key = localStorage.getItem('cap-key') || ''; } catch (_) {}
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.get('key')) { key = hash.get('key'); saveKey(); }
let state = {connected:false}, busy = false, reachable = false, polling = false, revision = 0;
function saveKey() { try { localStorage.setItem('cap-key',key); } catch (_) {} }
function feedback(message, error=false) { $('feedback').textContent=message; $('feedback').classList.toggle('error',error); }
async function api(path, body) {
  const abort = new AbortController();
  const timer = setTimeout(()=>abort.abort(), path==='/api/connect'?16000:9000);
  try {
    const response = await fetch(path, {method:body===undefined?'GET':'POST', headers:{'X-Cap-Key':key,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:abort.signal,cache:'no-store'});
    const data=await response.json();
    if(!response.ok) {
      if(response.status===401) $('pairing').hidden=false;
      throw new Error(data.error || `Bridge returned ${response.status}`);
    }
    reachable=true; return data;
  } finally { clearTimeout(timer); }
}
function render() {
  const connected=reachable && state.connected;
  $('connectionBadge').textContent=connected?'Cap connected':(!reachable?'Bridge unavailable':state.port_open?'Waiting for cap reply':'USB disconnected');
  $('connectionBadge').prepend(document.createElement('i'));
  $('connectionBadge').classList.toggle('connected',connected);
  $('nowPlaying').textContent=connected?(state.mode==='OFF'?'LEDs off':state.animation_name||'Starting playlist…'):'Connect your cap';
  $('modeLabel').textContent=connected?`${({DEMO:'Demo playlist',CEREMONY:'Ceremony playlist',MANUAL:'Selected scene',OFF:'Playback stopped'})[state.mode]||'Ready'} · ${state.port}`:'USB → computer → this phone';
  document.querySelectorAll('[data-control]').forEach(b=>b.disabled=!connected||busy);
  document.querySelectorAll('[data-scene]').forEach(b=>b.classList.toggle('active',connected&&state.animation===Number(b.dataset.scene)));
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',connected&&state.mode===b.dataset.mode));
  $('connect').disabled=busy||!reachable||!$('ports').value;
  $('disconnect').disabled=busy||!reachable||!state.port_open;
  $('refresh').disabled=busy||!key;
  $('pairing').hidden=!!key && $('pairing').hidden;
}
for(const [title,scenes] of groups) {
  const heading=document.createElement('h3');heading.className='group-title';heading.textContent=title;
  const grid=document.createElement('div');grid.className='scene-grid';
  for(const [id,name,symbol] of scenes) {
    const b=document.createElement('button');b.className='scene';b.dataset.scene=id;b.dataset.control='';b.disabled=true;
    const icon=document.createElement('span');icon.className='symbol';icon.textContent=symbol;icon.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.className='scene-name';label.textContent=name;
    b.append(icon,label);b.addEventListener('click',()=>action('/api/play',{id},`Playing ${name} — cap confirmed.`));grid.append(b);
  }
  $('animations').append(heading,grid);
}
async function refreshPorts() {
  const ports=await api('/api/ports');const old=$('ports').value;const select=$('ports');select.replaceChildren();
  if(!ports.length) select.add(new Option('No USB ports found',''));
  for(const p of ports)select.add(new Option(`${p.device} — ${p.description}`,p.device));
  if(ports.some(p=>p.device===old))select.value=old;
  else if(ports.some(p=>p.device===state.port))select.value=state.port;
  render();
}
async function poll() {
  if(polling||busy||!key)return;polling=true;const started=revision;
  try { const result=await api('/api/status'); if(started===revision){state=result;if(state.error) feedback(state.error,true);} }
  catch(e) { reachable=false;feedback(e.name==='AbortError'?'Bridge is not responding. Check the computer.':e.message,true); }
  finally { polling=false;render(); }
}
async function action(path,body,message) {
  if(busy)return;busy=true;revision++;render();feedback(path==='/api/connect'?'Opening USB and waiting for the cap to reply…':'Sending command…');
  try {
    const result=await api(path,body);
    state=result.state||result;
    feedback(message);
    if(path==='/api/connect')$('setup').open=false;
  } catch(e) {feedback(e.name==='AbortError'?'No reply from bridge. Check the cap before retrying.':e.message,true);}
  finally {busy=false;render();poll();}
}
$('ports').addEventListener('change',render);
$('connect').onclick=()=>action('/api/connect',{port:$('ports').value},'USB connected — the cap replied. Choose an animation.');
$('disconnect').onclick=()=>action('/api/disconnect',{},'USB disconnected. The cap continues its current mode.');
$('refresh').onclick=()=>refreshPorts().catch(e=>feedback(e.message,true));
$('ping').onclick=()=>action('/api/ping',{},'Connection test passed — the Due replied through USB.');
$('off').onclick=()=>action('/api/off',{},'LEDs off — cap confirmed.');
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>action('/api/mode',{mode:b.dataset.mode},`${b.dataset.mode==='DEMO'?'Demo':'Ceremony'} playlist started — cap confirmed.`);
$('pair').onclick=async()=>{
  const value=$('pairKey').value.trim();
  try {key=new URLSearchParams(new URL(value).hash.slice(1)).get('key')||value;} catch(_){key=value;}
  saveKey();$('pairing').hidden=true;await init();
};
$('copyLink').onclick=async()=>{
  if(!key){feedback('Use the complete pairing link printed by the bridge.',true);return;}
  let link=`${location.origin}/#key=${encodeURIComponent(key)}`;
  if(location.hostname==='localhost'||location.hostname==='127.0.0.1') {
    try { const info=await api('/api/info'); if(info.phone_url)link=info.phone_url; } catch(_) {}
  }
  try {
    if(navigator.clipboard && window.isSecureContext)await navigator.clipboard.writeText(link);
    else {const t=document.createElement('textarea');t.value=link;document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();if(!ok)throw new Error('Copy manually');}
    feedback('Pairing link copied. Send it privately to your iPhone.');
  } catch(_) {window.prompt('Copy this pairing link. On iPhone use the Wi-Fi IP instead of localhost.',link);}
};
async function init() {
  if(!key){$('pairing').hidden=false;feedback('Open the complete pairing link printed by the bridge.',true);render();return;}
  try {state=await api('/api/status');await refreshPorts();feedback(state.connected?'The cap is connected. Pick a scene.':'Choose the Due’s USB port, then tap Connect cap.');}
  catch(e){reachable=false;feedback(e.message,true);}
  render();
}
init();setInterval(poll,2000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
