/** API-2 additive special actions. Native 1.3 geometry/controller remain in base_figure.js. */
import {createGptBody as createBaseBody} from './base_figure.js';
import {createSpecialPolicy,SPECIAL_WORDS} from './special_policy.js';
import {createSpecialRenderer} from './special_renderer.js';
export async function createGptBody(base,opts){
 const policy=createSpecialPolicy({rng:opts.gptRandom});
 const renderer=await createSpecialRenderer(base,opts);
 let currentBody=null,originalDraw=null;
 const kit={...opts.kit,createBody(host,config){
  const figure=config.figure,nativeExtent=figure.extent;originalDraw=figure.draw;
  const syncExtent=()=>{const visual=policy.visual(currentBody?.layout()||{mode:'idle',busy:false,moving:false,pressing:false});figure.extent=visual?opts.model.specials.rig.view:nativeExtent;return visual;};
  figure.draw=(g,fc,frame)=>{originalDraw(g,fc,frame);renderer.paint(g,syncExtent());};
  const body=opts.kit.createBody(host,config),original={step:body.step,do:body.do,set:body.set,walk:body.walk,pointer:body.pointer,drop:body.drop,move:body.move,dispose:body.dispose};
  currentBody=body;
  // Installed readVocab's ID is /^[a-z0-9][a-z0-9-]{0,31}$/ (no underscores).
  body.words=[...new Set([...(body.words||[]),...SPECIAL_WORDS.map(w=>w.replaceAll('_','-'))])];
  const flush=()=>{for(const e of policy.drainEvents())host.emit(e.kind,{...e.detail,word:e.detail.word.replaceAll('_','-')});};
  body.step=dt=>{policy.step(dt,body.layout());syncExtent();original.step(dt);syncExtent();flush();};
  body.do=word=>{if(!policy.signal(String(word).replaceAll('-','_'),body.layout())){policy.nativeInput(word);original.do(word);}syncExtent();flush();};
  body.set=state=>{policy.set(state);original.set(state);syncExtent();};
  body.walk=(...args)=>{policy.nativeInput('walk');syncExtent();return original.walk(...args);};
  body.pointer=(...args)=>{if(args[0]==='down')policy.nativeInput('pointer');const result=original.pointer(...args);syncExtent();return result;};
  body.drop=(...args)=>{policy.nativeInput('drop');return original.drop(...args);};
  if(original.move)body.move=(...args)=>{policy.nativeInput('move');return original.move(...args);};
  body.dispose=()=>{renderer.dispose();policy.dispose();original.dispose();};
  return body;
 }};
 const body=await createBaseBody(base,{...opts,kit});
 // Diagnostic is local to the sandbox; not a network/OS/account bridge.
 globalThis.r6Diagnostic={trace:()=>({policy:policy.snapshot(),visual:renderer.diagnostic(),native:globalThis.r4Diagnostic?.trace()}),
  point:(id,x,y)=>renderer.point(id,x,y)};
 return body;
}
