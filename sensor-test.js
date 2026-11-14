'use strict';
const report=document.getElementById('sensorReport'),message=document.getElementById('sensorMessage');
function renderReport(){report.textContent=JSON.stringify(capSensors.snapshot(),null,2);}
for(const [id,kind] of [['testBoth','both'],['testMotion','motion'],['testOrientation','orientation']])document.getElementById(id).onclick=async()=>{capSensors.reset();try{await capSensors.request(kind);message.textContent='Permission result recorded. Tip the phone and watch the event counters below.';}catch(e){message.textContent=e.message;}renderReport();};
document.getElementById('copySensorReport').onclick=async()=>{const text=JSON.stringify(capSensors.snapshot(),null,2);try{await navigator.clipboard.writeText(text);message.textContent='Report copied. It contains no pairing key.';}catch(_){report.focus();message.textContent='Select and copy the report below.';}};
document.getElementById('backController').href='/'+location.hash;
renderReport();setInterval(renderReport,150);
