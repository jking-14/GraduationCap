'use strict';
// Browser-only sensor capture: no cap mode, network, or USB dependency.
const capSensors=(()=>{
  const subscribers=new Set();
  const number=value=>value===null||value===undefined||value===''?null:Number.isFinite(Number(value))?Number(value):null;
  const vector=value=>({x:number(value?.x),y:number(value?.y),z:number(value?.z)});
  const data={reader:'raw-sensors-1',secure:window.isSecureContext===true,topLevel:typeof window.top==='undefined'||window.top===window,origin:location.origin,userAgent:navigator.userAgent||'unknown',permission:{motion:'not requested',orientation:'not requested'},policy:{},motion:{events:0,at:null,gravity:{x:null,y:null,z:null},acceleration:{x:null,y:null,z:null},rotation:{alpha:null,beta:null,gamma:null}},orientation:{events:0,at:null,alpha:null,beta:null,gamma:null,absolute:null},lastError:null};
  try{const policy=document.permissionsPolicy||document.featurePolicy;if(policy&&typeof policy.allowsFeature==='function')for(const name of ['accelerometer','gyroscope','magnetometer'])data.policy[name]=policy.allowsFeature(name);}catch(e){data.lastError=e.message;}
  function snapshot(){return JSON.parse(JSON.stringify({...data,visible:document.visibilityState||'unknown'}));}
  function notify(){for(const subscriber of subscribers){try{subscriber(snapshot());}catch(e){data.lastError='Subscriber: '+e.message;}}}
  function captureMotion(event){
    data.motion.events++;data.motion.at=Date.now();
    try{data.motion.gravity=vector(event.accelerationIncludingGravity);data.motion.acceleration=vector(event.acceleration);data.motion.rotation={alpha:number(event.rotationRate?.alpha),beta:number(event.rotationRate?.beta),gamma:number(event.rotationRate?.gamma)};data.motion.interval=number(event.interval);}catch(e){data.lastError='Motion event: '+e.message;}
    notify();
  }
  function captureOrientation(event){
    data.orientation.events++;data.orientation.at=Date.now();
    try{data.orientation.alpha=number(event.alpha);data.orientation.beta=number(event.beta);data.orientation.gamma=number(event.gamma);data.orientation.absolute=event.absolute===true;}catch(e){data.lastError='Orientation event: '+e.message;}
    notify();
  }
  // Register before permission and keep capture independent of all app modes.
  window.addEventListener('devicemotion',captureMotion,{capture:true});
  window.addEventListener('deviceorientation',captureOrientation,{capture:true});
  window.addEventListener('deviceorientationabsolute',captureOrientation,{capture:true});
  async function request(which='both'){
    data.lastError=null;
    if(!data.secure){data.lastError='Not a secure context. Open the HTTPS Phone link directly in Safari.';notify();throw new Error(data.lastError);}
    if(!data.topLevel){data.lastError='Embedded frame detected. Open this URL directly in a Safari tab.';notify();throw new Error(data.lastError);}
    const choices=[['motion',typeof DeviceMotionEvent!=='undefined'?DeviceMotionEvent:null],['orientation',typeof DeviceOrientationEvent!=='undefined'?DeviceOrientationEvent:null]].filter(([name])=>which==='both'||which===name);
    const requests=choices.map(([name,type])=>{
      if(!type){data.permission[name]='API unavailable';return Promise.resolve();}
      if(typeof type.requestPermission!=='function'){data.permission[name]='API available; no permission method';return Promise.resolve();}
      data.permission[name]='requesting';
      try{return Promise.resolve(type.requestPermission()).then(value=>{data.permission[name]=String(value);},error=>{data.permission[name]=(error.name||'Error')+': '+error.message;});}
      catch(error){data.permission[name]=(error.name||'Error')+': '+error.message;return Promise.resolve();}
    });
    // The map invokes every native permission method in the original tap stack.
    await Promise.all(requests);notify();
    if(!choices.some(([name])=>data.permission[name]==='granted'||data.permission[name]==='API available; no permission method'))throw new Error('Sensor permission is not granted. See the raw sensor report for each API’s result.');
    return snapshot();
  }
  function reset(){data.motion.events=0;data.orientation.events=0;data.motion.at=null;data.orientation.at=null;notify();}
  return{snapshot,request,reset,subscribe(fn){subscribers.add(fn);fn(snapshot());return()=>subscribers.delete(fn);}};
})();
