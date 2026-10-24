/** Pure local scheduling. No account/OS/network access, and no native RNG consumption. */
export const DEFAULTS=Object.freeze({workChance:.85,orbChance:.9,thinkingSeconds:4,idleSeconds:6,workCooldown:90,orbCooldown:90,socialChance:.45,socialCooldown:160,workSeconds:8,orbSeconds:9});
export const SPECIAL_WORDS=Object.freeze(['tease_deepseek','respect_claude','art_commission','quota_exhausted','quota_recovered','workload_high','workload_normal','writing','office','magic_orb']);
const SOCIAL={tease_deepseek:['detective',5.5],respect_claude:['respect',5.5],art_commission:['commission',8]};
const SOCIAL_WORDS=Object.freeze(Object.keys(SOCIAL));
function localRandom(){
 if(globalThis.crypto?.getRandomValues){const n=new Uint32Array(1);crypto.getRandomValues(n);return n[0]/4294967296;}
 localRandom.seed=((localRandom.seed??(Date.now()>>>0))*1664525+1013904223)>>>0;return localRandom.seed/4294967296;
}
export function createSpecialPolicy({rng=localRandom,config={}}={}){
 const C={...DEFAULTS,...config};
 let time=0,thinking=false,thinkingAt=null,high=false,listening=false,dialogOpen=false,episodeTried=false;
 let quotaExhausted=false,active=null,workUntil=-Infinity,orbUntil=-Infinity,socialUntil=-Infinity,orbAt=C.idleSeconds,idleEligible=true,workTrials=0,orbTrials=0,socialTrials=0;
 const events=[];
 const emit=(word,extra={})=>{events.push({kind:'done',detail:{word,...extra}});if(events.length>64)events.shift();};
 const safe=l=>l&&!l.busy&&!l.pressing&&!l.moving&&['idle','sit'].includes(l.mode);
 const eligibleWork=l=>safe(l)&&!listening&&!dialogOpen&&!quotaExhausted;
 const random=()=>{const n=Number(rng());return Number.isFinite(n)?Math.max(0,Math.min(1,n)):1;};
 const thinkingElapsed=()=>thinking&&thinkingAt!==null?time-thinkingAt:0;
 const qualified=()=>high||thinkingElapsed()+1e-8>=C.thinkingSeconds;
 function end(reason='complete'){
  if(!active)return;
  const a=active;active=null;
  if(a.id==='magic_orb')orbUntil=time+C.orbCooldown;
  if(SOCIAL[a.id])socialUntil=time+C.socialCooldown;
  if(a.request&&!a.persistent)emit(a.request,{reason});
 }
 function start(id,pose,duration,request=null,persistent=false){
  end('superseded');active={id,pose,at:time,duration,request,persistent};idleEligible=false;orbAt=time+C.idleSeconds;
 }
 function tryWork(l,requested=null){
  if(!qualified()||!eligibleWork(l)||active||episodeTried)return false;
  episodeTried=true;
  if(time<workUntil)return false;
  workTrials++;
  if(random()>=C.workChance)return false;
  const id=requested|| (random()<.5?'writing':'office');
  workUntil=time+C.workCooldown;start(id,id,C.workSeconds,requested);return true;
 }
 function tryOrb(l,request=null){
  if(!safe(l)||l.mode!=='idle'||thinking||high||listening||dialogOpen||quotaExhausted||active||time<orbUntil)return false;
  orbTrials++;orbAt=time+C.idleSeconds;
  if(random()>=C.orbChance)return false;
  start('magic_orb','magic_orb',C.orbSeconds,request);return true;
 }
 function trySocial(l,request=null){
  if(!safe(l)||l.mode!=='idle'||thinking||high||listening||dialogOpen||quotaExhausted||active||time<socialUntil)return false;
  socialTrials++;
  if(random()>=C.socialChance)return false;
  const id=SOCIAL_WORDS[Math.min(SOCIAL_WORDS.length-1,Math.floor(random()*SOCIAL_WORDS.length))];
  const[pose,seconds]=SOCIAL[id];
  socialUntil=time+C.socialCooldown;start(id,pose,seconds,request);return true;
 }
 function signal(word,layout){
  if(!SPECIAL_WORDS.includes(word))return false;
  if(word==='quota_exhausted'){
   quotaExhausted=true;start(word,word,Infinity,null,true);emit(word,{persistent:true});return true;
  }
  if(word==='quota_recovered'){
   if(quotaExhausted){quotaExhausted=false;start(word,'respect',4,word);}else emit(word,{skipped:true});
   return true;
  }
  if(word==='workload_normal'){high=false;if(!thinking)episodeTried=false;emit(word);return true;}
  if(quotaExhausted){emit(word,{skipped:true,reason:'quota-state'});return true;}
  if(word==='workload_high'){
   if(active?.id==='magic_orb')end('high-intensity-hint');
   if(!high){high=true;episodeTried=false;}tryWork(layout);emit(word,{signalOnly:true});return true;
  }
  if(word==='writing'||word==='office'){if(!tryWork(layout,word))emit(word,{skipped:true});return true;}
  if(word==='magic_orb'){if(!tryOrb(layout,word))emit(word,{skipped:true});return true;}
  if(SOCIAL[word]){
   if(safe(layout)){const[pose,seconds]=SOCIAL[word];start(word,pose,seconds,word);}
   else emit(word,{skipped:true,reason:'native-interaction-priority'});
  }
  return true;
 }
 function set(state={}){
  if(typeof state.thinking==='boolean'&&state.thinking!==thinking){
   thinking=state.thinking;thinkingAt=thinking?time:null;if(!high)episodeTried=false;
  }
  if(typeof state.listening==='boolean')listening=state.listening;
  if(typeof state.dialogOpen==='boolean')dialogOpen=state.dialogOpen;
  if(active&&!active.persistent&&(listening||dialogOpen||(thinking&&active.id==='magic_orb')))end('higher-priority-state');
 }
 function step(dt,layout){
  if(!Number.isFinite(dt)||dt<=0)return;time+=dt;
  if(active&&!active.persistent&&time-active.at+1e-8>=active.duration)end();
  if(active&&!safe(layout)&&!active.persistent)end('native-interaction-priority');
  if(!quotaExhausted&&!active&&qualified()&&eligibleWork(layout)&&!episodeTried)tryWork(layout);
  const eligible=!active&&!quotaExhausted&&safe(layout)&&layout.mode==='idle'&&!thinking&&!high&&!listening&&!dialogOpen;
  if(!eligible){idleEligible=false;orbAt=time+C.idleSeconds;}
  else{
   if(!idleEligible){idleEligible=true;orbAt=time+C.idleSeconds;}
   if(time+1e-8>=orbAt){tryOrb(layout);if(!active)trySocial(layout);}
  }
 }
 function visual(layout){
  if(!active||!safe(layout))return null;
  const age=time-active.at,fadeIn=Math.min(1,age/.55),fadeOut=active.persistent?1:Math.min(1,Math.max(0,(active.duration-age)/.55));
  return{id:active.id,pose:active.pose,age,duration:active.duration,weight:Math.max(0,fadeIn*fadeOut),persistent:active.persistent};
 }
 return{signal,set,step,visual,nativeInput(reason){if(!active?.persistent)end(reason);idleEligible=false;orbAt=time+C.idleSeconds;},
  drainEvents(){return events.splice(0);},dispose(){active=null;quotaExhausted=false;events.length=0;},
  snapshot(){return{time,thinking,thinkingElapsed:thinkingElapsed(),high,listening,dialogOpen,quotaExhausted,episodeTried,workTrials,orbTrials,socialTrials,active:active?{...active,age:time-active.at}:null,workCooldownUntil:workUntil,orbCooldownUntil:orbUntil,socialCooldownUntil:socialUntil,config:{...C}};}};
}
