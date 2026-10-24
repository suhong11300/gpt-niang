/** Source-registered raster features; native face state/blink/talk still drives them. */
export async function createFacePainter(base,model,load){
 const names=model.face.names,imgs=Object.fromEntries(await Promise.all([...names,'closed','mask'].map(async n=>[n,await load(new URL('retarget_prototype/face_'+n+'.png',base))])));
 const cv=document.createElement('canvas');cv.width=340;cv.height=200;const g=cv.getContext('2d'),tmp=document.createElement('canvas');tmp.width=340;tmp.height=200;const t=tmp.getContext('2d');
 const aliases={content:'neutral',listening:'neutral',run:'determined',waking:'sleepy',squeeze:'sleep',bowing:'sleep'},closedEyeKinds=new Set(['sleep','happy','dragged','flustered','cry']);
 const eyes=[{x:94,y:127,rx:78,ry:46,a:-13},{x:258,y:76,rx:64,ry:52,a:-25}],clip=(ctx,e,h=1)=>{ctx.translate(e.x,e.y);ctx.rotate(e.a*Math.PI/180);ctx.beginPath();ctx.ellipse(0,0,e.rx,e.ry*h,0,0,Math.PI*2);ctx.clip();ctx.rotate(-e.a*Math.PI/180);ctx.translate(-e.x,-e.y);};
 let lastKey='',lastFace='neutral',transition=1,oldFace='neutral',diag={};
 function paint(fc,o){let face=aliases[o.face]||o.face||'neutral';if(!imgs[face])face='neutral';if(o.mode==='sleep')face='sleep';
  const close=Math.max(0,Math.min(1,Math.max(o.blink||0,o.eyeClose||0,o.mode==='sleep'?1:0))),talk=Math.max(0,Math.min(1,o.talk||0)),phase=talk>.1?Math.round((.4+.6*Math.abs(Math.sin(o.t*17)))*talk*8):0;
  if(face!==lastFace){oldFace=lastFace;lastFace=face;transition=0;}transition=Math.min(1,transition+1/8);
  const key=face+':'+Math.round(close*16)+':'+phase+':'+Math.round(transition*8);if(key===lastKey)return false;lastKey=key;
  g.clearRect(0,0,340,200);g.drawImage(imgs[face],0,0); // All image geometry outside feature masks is discarded below.
  if(transition<1){g.globalAlpha=1-transition;g.drawImage(imgs[oldFace],0,0);g.globalAlpha=1;}
  if(close>.01&&!closedEyeKinds.has(face))for(let i=0;i<eyes.length;i++){
   if(face==='wink'&&i===1)continue;const e=eyes[i];g.save();clip(g,e);g.drawImage(imgs.closed,0,0);g.restore();
   if(close<.99){g.save();clip(g,e,Math.max(.005,1-close));g.drawImage(imgs[face],0,0);g.restore();}
  }
  if(phase>0&&face!=='sleep'&&face!=='cry'){
   // A small neutral opening rather than reusing a happy smiling mouth during serious speech.
   g.save();g.beginPath();g.ellipse(196,153,35,25,-15*Math.PI/180,0,Math.PI*2);g.clip();g.drawImage(imgs.neutral,0,0);
   g.translate(196,153);g.rotate(-15*Math.PI/180);const k=.36+phase/20;g.scale(k,k);g.rotate(15*Math.PI/180);g.drawImage(imgs.surprised,-196,-153);g.restore();
  }
  g.globalCompositeOperation='destination-in';g.drawImage(imgs.mask,0,0);g.globalCompositeOperation='source-over';
  diag={requestedFace:o.face,paintedFace:face,blink:close,talkPhase:phase,transition};return true;
 }
 return{canvas:cv,paint,diagnostic:()=>({...diag})};
}
