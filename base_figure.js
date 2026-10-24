/** Isolated ART PROTOTYPE. Native controller input, mother-coordinate geometry. Not a distributable pack. */
import {createWhaleFigure} from './native/figure.js';
import {createFacePainter} from './face_painter_r5.js';
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),smooth=(a,b,v)=>{const k=clamp((v-a)/(b-a));return k*k*(3-2*k);};
function rot(p,pivot,a,tx=0,ty=0){const r=a*Math.PI/180,c=Math.cos(r),s=Math.sin(r),x=p[0]-pivot[0],y=p[1]-pivot[1];return[pivot[0]+x*c-y*s+tx,pivot[1]+x*s+y*c+ty];}
const blend=(a,b,w)=>a.map((v,i)=>v+(b[i]-v)*w);
export async function createGptBody(base,opts){
 const model=opts.model||await(await fetch(new URL('model.json',base))).json(),P=model.pivots;
 const nativeModel=model.native;
 const load=opts.loadImage||((u)=>new Promise((ok,bad)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=bad;im.src=u;}));
 const images=Object.fromEntries(await Promise.all([...model.parts.map(p=>p.tex),'head_closed'].map(async id=>[id,await load(new URL('retarget_prototype/'+id+'.png',base))])));
 const facePainter=await createFacePainter(base,model,load);
 let incoming={fc:{},o:{}},lastNative=null,lastMapped=null,lastRig=null,frameNo=0,rest=false;
 const sampleOld=(st,k,u,v)=>{const def=lastNative?.model.deformers[k],fn=st[k]?.fn;if(!def?.rect||!fn)return[0,0];const b=def.rect;return fn(clamp(u),clamp(v),b[0]+u*(b[2]-b[0]),b[1]+v*(b[3]-b[1]));};
 const uvOf=(id,x,y)=>{
  // Anatomical domains, not old texture boxes: source visible pixels never change scale independently.
  const rect={head:[250,90,1000,585],face:[250,90,1000,585],hair_back:[150,120,1120,1200],dress:[385,760,985,1200],tail:[920,830,1190,1190],leg_l:[550,900,690,1220],leg_r:[695,970,820,1220]}[id]||[0,0,1254,1254];
  const sx=(x-128)/.2+627,sy=(y-256)/.2+1215;return[clamp((sx-rect[0])/(rect[2]-rect[0])),clamp((sy-rect[1])/(rect[3]-rect[1])),sx,sy];
 };
 function map(st){
  const out={body:rest?{}:st.body,alpha:{},z:{}};const o=incoming.o,fc=incoming.fc;
  const seat=rest?0:clamp(st.alpha?.skirt_sit||0);out.seatedMix=seat;
  const waist=(p,w=1)=>blend(p,rot(p,P.waist,st.waist?.a||0),w);
  const head=p=>waist(rot(p,P.neck,st.neck?.a||0,st.neck?.tx||0,st.neck?.ty||0));
  for(const part of model.parts){const id=part.tex;
   if(id!=='head'&&id!=='face')out.alpha[part.id]=id.startsWith('seat_')?seat:1-seat;
   out[id]={fn:(u,v,x,y)=>{
    if(rest)return[0,0];const p=[x,y],[du,dv,sx,sy]=uvOf(id,x,y);let q=p;
    if(id.startsWith('seat_')){
     // Pose-specific painting avoids rotating standing knees through the long skirt.
     q=[x,y-6];
     if(id==='seat_arm_l'||id==='seat_arm_r'){
      const near=id==='seat_arm_l',pivot=near?[112.6,143]:[158.6,144],angle=st[near?'armNear':'armFar']?.a||0;
      q=waist(rot(q,[pivot[0],pivot[1]-6],angle+(near?4:6)));
     }else if(id==='seat_dress')q=waist(q,1-smooth(760,1060,sy));
     else if(id==='seat_hair_back')q=blend(q,head(q),1-smooth(540,1050,sy));
     else if(id==='seat_wing_l'||id==='seat_wing_r')q=waist(rot(q,id==='seat_wing_l'?P.wing_l:P.wing_r,st[id==='seat_wing_l'?'finNear':'finFar']?.a*.65||0));
    }else if(id==='head'||id==='face'){
     const d=sampleOld(st,'headMid',du,dv),b=sampleOld(st,'bangsSway',du,dv),bw=smooth(280,330,sx)*(1-smooth(780,850,sx))*(1-smooth(340,430,sy));
     let hp=[x+d[0]*.85+b[0]*bw*.55,y+d[1]*.9+b[1]*bw*.55];
     const aw=smooth(430,460,sx)*(1-smooth(620,650,sx))*(1-smooth(135,190,sy));
     hp=blend(hp,rot(hp,[104.6,44],st.ahoge?.a||0),aw);q=head(hp);
    }else if(id==='arm_l'||id==='arm_r'){
     const near=id==='arm_l',a=st[near?'armNear':'armFar']?.a||0;
     const cloth=rot(p,near?[98.6,183]:[182.6,183],-a*.35*smooth(860,1030,sy));
     q=waist(rot(cloth,near?P.armNear:P.armFar,a));
    }
    else if(id==='leg_l'||id==='leg_r'){
     const n=id==='leg_l'?'legBack':'legFront',oldHip=nativeModel.pivots[n],hip=P[n],old=st[n]?.fn;
     // Recover the native lower-leg rigid angle/lift below its hinge transition.
     // Reusing the old 20-unit hinge ramp on the new thigh, with x-only scaling,
     // inverted visible cells. Retarget the rigid motion, NOT that foreign ramp.
     const a=old?old(.5,1,oldHip[0],oldHip[1]+60):[0,0],b=old?old(.5,1,oldHip[0]+10,oldHip[1]+60):[0,0];
     const angle=Math.atan2(b[1]-a[1],10+b[0]-a[0])*180/Math.PI;
     const lift=60+a[1]-60*Math.cos(angle*Math.PI/180);
     q=rot(p,hip,angle,0,lift);
    }else if(id==='dress'){
     const d=sampleOld(st,'skirt',du,dv),w=smooth(735,930,sy);q=[x+d[0]*w,y+d[1]*w];q=waist(q,1-smooth(760,930,sy));
    }else if(id==='hair_back'){
     // Retarget hair counter-rotation to its actual ankle-length geometry.
     const w=1-smooth(470,1140,sy),dh=sampleOld(st,'hairSway',du,dv),oldHeadA=st.neck?.a||0;
     // Remove the old short-hair neck counter-rotation before applying the new source-domain one.
     const oldRect=lastNative.model.deformers.hairSway.rect,oldP=[oldRect[0]+du*(oldRect[2]-oldRect[0]),oldRect[1]+dv*(oldRect[3]-oldRect[1])],oldNeck=nativeModel.pivots.neck;
     const oldCounter=rot(oldP,oldNeck,-oldHeadA*smooth(.3,.8,dv));
     q=blend(p,head(p),w);q=[q[0]+(dh[0]-(oldCounter[0]-oldP[0]))*.7,q[1]+(dh[1]-(oldCounter[1]-oldP[1]))*.7];
    }else if(id==='tail'){q=rot(p,P.tail,-(st.tail?.a||0)*.5);const d=sampleOld(st,'tailBend',du,dv);q=[q[0],q[1]+d[1]*.55];}
    else if(id==='wing_l'||id==='wing_r')q=waist(rot(p,P[id],st[id==='wing_l'?'finNear':'finFar']?.a*.65||0));
    return[q[0]-x,q[1]-y];
   }};
  }
  const closed=rest?0:Math.max(o.blink||0,o.eyeClose||0,o.mode==='sleep'?1:0);
  out.eyeClose=clamp(closed);return out;
 }
 const kit={...opts.kit,createRig(canvas,nativeRigModel){
  const rig=opts.kit.createRig(canvas,model);lastRig=rig;lastNative={model:nativeRigModel,st:null};for(const p of model.parts)rig.upload(p.tex,images[p.tex]);
  // The native face raster is intentionally ignored: old DeepSeek eyes are not the new character's face.
  return{...rig,upload(){},render(st){lastNative.st=st;lastMapped=map(st);if(facePainter.paint(incoming.fc,incoming.o))rig.upload('face',facePainter.canvas);rig.render(lastMapped);frameNo++;},point(d,st,x,y){const q=[P.neck[0]+(x-129.9)*1.05,P.neck[1]+(y-154.73)*.9];return rig.point('head',lastMapped||map(st),...q);}};
 }};
 const figure=await createWhaleFigure(new URL('native/',base),{...opts,kit,model:nativeModel,scheme:'deepseek-maid',asset:p=>new URL('native/'+p,base)});
 const originalDraw=figure.draw;figure.draw=(g,fc,o)=>{incoming={fc,o};originalDraw(g,fc,o);if(lastRig&&lastMapped){const at=(x,y)=>lastRig.point('head',lastMapped,x,y);figure.anchors.gaze=at(129.8,103.3);figure.anchors.tear=at(113.4,119);figure.anchors.tears=[at(113.4,119),at(146.2,108)];}};
 figure.anchors={gaze:[129.8,103.3],tear:[113.4,119],tears:[[113.4,119],[146.2,108]],z:[197,40],hearts:[98,176,50],bubble:[128,13]};
 const body=opts.kit.createBody(opts.host,{figure});
 window.r4Diagnostic={rest(v){rest=v;if(lastNative?.st){lastMapped=map(lastNative.st);lastRig.render(lastMapped);}},trace(){return{frameNo,input:structuredClone(incoming),nativeScalars:Object.fromEntries(Object.entries(lastNative?.st||{}).filter(([k,v])=>!v?.fn)),eyeClose:lastMapped?.eyeClose,seatedMix:lastMapped?.seatedMix,face:facePainter.diagnostic(),releaseAllowed:false};},model,point(id,x,y){const parent=model.parts.find(p=>p.tex===id)?.parent||id;return lastRig.point(parent,lastMapped,x,y);}};
 return body;
}
