'use strict';
const $ = id => document.getElementById(id);
const groups = [
  ['NATURE & NIGHT', [[19,'Growing Plant','♧'],[20,'Beach','≈'],[21,'Moonlit Campfire','☾'],[22,'Underwater','⋈'],[23,'Spiral','✺'],[24,'Fractal','❖'],[18,'Rain and Lightning','ϟ'],[2,'Pond Ripples','◎']]],
  ['RETRO GAMES', [[1,'Tron','⌁'],[3,'Breakout','▤'],[6,'Pong','Ⅱ'],[11,'Tetris','▙'],[12,'Pac-Man','◔'],[13,'Snake','⌇'],[14,'Space Invaders','⋀'],[16,'Platformer','▟']]],
  ['LIGHT & MOTION', [[0,'Matrix Rain','⋮'],[4,'Rotating Cube','◇'],[5,'Loading Bar','▰'],[7,'DVD','▱'],[8,'Starfield','✧'],[9,'Lava Lamp','◒'],[10,'Sine Waves','∿'],[15,'Fireworks','✳'],[17,'Game of Life','⁙']]]
];
let key = '';
try { key = localStorage.getItem('cap-key') || ''; } catch (_) {}
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.get('key')) { key = hash.get('key').trim(); saveKey(); }
const validKey = value => /^[A-Za-z0-9_-]{4,128}$/.test(value);
if (key && !validKey(key)) { key=''; saveKey(); }
let ioTail=Promise.resolve();
function requestSerial(path,body){const job=ioTail.then(()=>api(path,body));ioTail=job.catch(()=>{});return job;}
let state = {connected:false}, busy = false, reachable = false, polling = false, revision = 0;
function saveKey() { try { localStorage.setItem('cap-key',key); } catch (_) {} }
function feedback(message, error=false) { $('feedback').textContent=message; $('feedback').classList.toggle('error',error); }
function setupError(message) {
  $('setup').open=true;
  feedback(message,true);
}
function describeError(error) {
  if(error.name==='AbortError') return 'The bridge did not reply. Keep it running on the computer, check Wi-Fi, then tap Retry bridge connection.';
  if(error.name==='SyntaxError'||error.name==='TypeError') return 'The browser could not reach the bridge. Open the full Phone link from the running bridge, or paste it below and tap Update.';
  return error.message || 'Connection failed. Update the bridge link below and retry.';
}
async function api(path, body, extraHeaders={}) {
  if(location.protocol!=='http:' && location.protocol!=='https:')
    throw new Error('This page was opened as a file. Paste the full http:// Phone link printed by the bridge below, then tap Update.');
  if(!validKey(key)) throw new Error('Paste the latest full Phone link from the running bridge, then tap Update.');
  const abort = new AbortController();
  const timer = setTimeout(()=>abort.abort(), path==='/api/connect'?16000:9000);
  try {
    const response = await fetch(new URL(path,location.href).href, {method:body===undefined?'GET':'POST', headers:{'X-Cap-Key':key,...extraHeaders,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:abort.signal,cache:'no-store'});
    // Check the reply before parsing so wrong hosts and 404 pages produce
    // useful guidance rather than an opaque browser parsing error.
    const contentType=(response.headers.get('Content-Type')||'').toLowerCase();
    if(!contentType.includes('application/json'))
      throw new Error('This address is serving a web page, not the running bridge. Paste the full Phone link printed by the bridge below and tap Update. GitHub Pages cannot run the USB bridge.');
    let data;
    try { data=await response.json(); }
    catch(_) { throw new Error('The bridge returned an unreadable response. Restart the bridge and update this page with its new Phone link.'); }
    if(!response.ok) throw new Error(data.error || `Bridge returned ${response.status}`);
    reachable=true; return data;
  } finally { clearTimeout(timer); }
}

function render() {
  const connected=reachable && state.connected;
  $('connectionBadge').textContent=connected?'Cap connected':(!reachable?'Bridge unavailable':state.port_open?'Waiting for cap reply':'USB disconnected');
  $('connectionBadge').prepend(document.createElement('i'));
  $('connectionBadge').classList.toggle('connected',connected);
  $('nowPlaying').textContent=connected?(state.mode==='OFF'?'LEDs off':state.mode==='DRAW'?'Your drawing':({SAND:'Tilt sand',PARTICLES:'Tilt drawing',PLASMA:'Plasma globe',VIDEO:'Live camera',TUG:'Tug of war'})[state.mode]||state.animation_name||'Starting playlist…'):'Connect your cap';
  $('modeLabel').textContent=connected?`${({DEMO:'Demo playlist',CEREMONY:'Ceremony playlist',MANUAL:'Selected scene',OFF:'Playback stopped',DRAW:'Touch drawing',GAME:'You are playing',RIPPLE:'Touch pond',SAND:'Tilt sand',PARTICLES:'Tilt drawing',PLASMA:'Plasma globe',VIDEO:'Live camera',TUG:'Tug of war'})[state.mode]||'Ready'} · ${state.port}`:'USB → computer → this phone';
  document.querySelectorAll('[data-control]').forEach(b=>b.disabled=!connected||busy);
  document.querySelectorAll('[data-scene]').forEach(b=>b.classList.toggle('active',connected&&state.animation===Number(b.dataset.scene)));
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',connected&&state.mode===b.dataset.mode));
  $('connect').disabled=busy||!reachable||!$('ports').value;
  $('disconnect').disabled=busy||!reachable||!state.port_open;
  $('refresh').disabled=busy||!key;
  $('pair').disabled=busy;
  $('retry').disabled=busy;
  $('pairKey').disabled=busy;
  if(typeof renderCreative==='function')renderCreative();
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
  if(polling||busy||!key||!reachable)return;polling=true;const started=revision;
  try { const result=await api('/api/status'); if(started===revision){state=result;if(state.error) feedback(state.error,true);} }
  catch(e) { if(started===revision){reachable=false;setupError(describeError(e));} }
  finally { polling=false;render(); }
}
async function action(path,body,message) {
  if(busy)return;busy=true;revision++;render();feedback(path==='/api/connect'?'Opening USB and waiting for the cap to reply…':'Sending command…');
  try {
    const result=await requestSerial(path,body);
    state=result.state||result;
    feedback(message);
    if(path==='/api/connect')$('setup').open=false;
    return result;
  } catch(e) {setupError(describeError(e));}
  finally {busy=false;render();poll();}
}
$('ports').addEventListener('change',render);
$('connect').onclick=()=>action('/api/connect',{port:$('ports').value},'USB connected — the cap replied. Choose an animation.');
$('disconnect').onclick=()=>action('/api/disconnect',{},'USB disconnected. The cap continues its current mode.');
$('refresh').onclick=()=>init();
$('retry').onclick=()=>init();
$('ping').onclick=()=>action('/api/ping',{},'Connection test passed — the Due replied through USB.');
$('off').onclick=()=>action('/api/off',{},'LEDs off — cap confirmed.');
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>action('/api/mode',{mode:b.dataset.mode},`${b.dataset.mode==='DEMO'?'Demo':'Ceremony'} playlist started — cap confirmed.`);
function pairingTarget(value) {
  value=value.trim();
  if(!value) throw new Error('Paste the full Phone link or the pairing key before tapping Update.');
  if(validKey(value)) return {key:value};
  let url;
  try { url=new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value)?value:'http://'+value); }
  catch(_) { throw new Error('That bridge link is incomplete. Copy the entire Phone link, including http://, port number, and #key=.'); }
  if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password||(url.protocol==='http:'&&!url.port))
    throw new Error('Use the complete Phone link printed by bridge.py: a local http:// link with its port, or the secure https:// tunnel link.');
  const nextKey=new URLSearchParams(url.hash.slice(1)).get('key');
  if(!nextKey||!validKey(nextKey)) throw new Error('The bridge link needs its pairing key. Copy the entire Phone link, including #key= and everything after it.');
  if(location.hostname!==url.hostname && ['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname))
    throw new Error('Use the Phone link with the computer’s Wi-Fi IP address, not localhost or 127.0.0.1.');
  return {key:nextKey,url:url.origin+'/#key='+encodeURIComponent(nextKey),origin:url.origin};
}
$('pair').onclick=async()=>{
  if(busy)return;
  try {
    const target=pairingTarget($('pairKey').value);
    // Navigate to the local bridge rather than trying cross-origin USB commands.
    if(target.url && (target.origin!==location.origin || location.pathname!=='/')) {
      location.assign(target.url);return;
    }
    key=target.key;saveKey();revision++;
    try { history.replaceState(null,'',location.pathname+'#key='+encodeURIComponent(key)); } catch(_) {}
    await init();
  } catch(e) {setupError(describeError(e));render();}
};
$('pairKey').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('pair').click();}});
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
  if(busy)return;
  if(!key){setupError('Paste the latest full Phone link printed by the running bridge, then tap Update.');render();return;}
  busy=true;revision++;render();
  try {state=await api('/api/status');await refreshPorts();feedback(state.connected?'The cap is connected. Pick a scene.':'Choose the Due’s USB port, then tap Connect cap.');}
  catch(e){reachable=false;setupError(describeError(e));}
  finally {busy=false;render();}
}
$('pairKey').value=key;
init();setInterval(poll,2000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
