import {deformSpecial} from './special_deform.js';
const NS='http://www.w3.org/2000/svg';
export async function createSpecialRenderer(base,opts){
 const model=opts.model.specials.rig,sources=opts.model.specials.sources;
 const images=Object.fromEntries(await Promise.all(model.parts.map(async p=>[p.tex,await opts.loadImage(new URL('special/'+p.tex+'.png',base))])));
 let rig=null,fo=null,mounted=null,root=null,fx=null,lastState=null,lastVisual=null;
 function mount(g){
  const doc=g.ownerDocument;fo=doc.createElementNS(NS,'foreignObject');fo.dataset.gptSpecial='true';
  const[vx,vy,x1,y1]=model.view;for(const[k,v]of Object.entries({x:vx,y:vy,width:x1-vx,height:y1-vy}))fo.setAttribute(k,String(v));
  const canvas=doc.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=672;canvas.height=672;canvas.style.cssText='width:100%;height:100%;display:block';fo.appendChild(canvas);g.appendChild(fo);
  rig=opts.kit.createRig(canvas,model);for(const p of model.parts)rig.upload(p.tex,images[p.tex]);
  fx=doc.createElementNS(NS,'g');fx.dataset.gptSpecial='true';fx.setAttribute('pointer-events','none');g.appendChild(fx);mounted=g;
 }
 function paint(g,visual){
  const weight=visual?.weight||0;
  if(weight>0&&(!rig||mounted!==g||!g.contains(fo)))mount(g);
  for(const child of g.children)if(child.dataset.gptSpecial!=='true')child.style.opacity=weight>0?String(1-weight):'';
  if(!fo)return;
  fo.style.opacity=String(weight);fo.style.display=weight>0?'':'none';fx.style.opacity=String(weight);
  lastVisual=visual;
  if(!visual){fx.textContent='';lastState=null;return;}
  const state={alpha:{},body:{}};
  for(const part of model.parts){
   state.alpha[part.id]=part.tex===visual.pose?1:0;
   if(part.tex===visual.pose)state[part.parent]={fn:(u,v,x,y)=>deformSpecial(visual.pose,visual.age,x,y,sources[visual.pose])};
  }
  lastState=state;rig.render(state);
  fx.textContent='';
  if(visual.pose==='magic_orb'){
   const src=sources.magic_orb,t=visual.age,point=(sx,sy)=>{const x=src.left+sx*src.scale,y=src.top+sy*src.scale,[dx,dy]=deformSpecial('magic_orb',t,x,y,src);return[x+dx,y+dy];};
   const[cx,cy]=point(900,645);
   for(let i=0;i<4;i++){
    const a=t*.7+i*Math.PI/2,x=cx+Math.cos(a)*25,y=cy+Math.sin(a)*17,r=i%2?1.1:1.7;
    const spark=g.ownerDocument.createElementNS(NS,'path');spark.setAttribute('d',`M${x-r} ${y}L${x} ${y-r*1.6}L${x+r} ${y}L${x} ${y+r*1.6}Z`);spark.setAttribute('fill',i%2?'#f5eeff':'#b4a0f4');spark.setAttribute('opacity',String(.55+.35*Math.sin(t*2+i)));fx.appendChild(spark);
   }
   const ring=g.ownerDocument.createElementNS(NS,'ellipse');for(const[k,v]of Object.entries({cx,cy,rx:23,ry:9,fill:'none',stroke:'#c6b5f0','stroke-width':.65,opacity:.45,transform:`rotate(${t*12} ${cx} ${cy})`}))ring.setAttribute(k,String(v));fx.appendChild(ring);
  }
 }
 return{paint,diagnostic:()=>lastVisual?{...lastVisual}:null,point:(id,x,y)=>rig?.point('warp_'+id,lastState,x,y),
  dispose(){rig?.dispose();fo?.remove();fx?.remove();rig=null;fo=null;mounted=null;}};
}
