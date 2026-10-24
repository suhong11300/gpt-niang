/** Source-pose local fields: shared by runtime and visible-mesh verification. */
const smooth=(a,b,x)=>{const k=Math.max(0,Math.min(1,(x-a)/(b-a)));return k*k*(3-2*k);};
const bump=(x,y,cx,cy,rx,ry)=>Math.exp(-(((x-cx)/rx)**2+((y-cy)/ry)**2));
export function deformSpecial(pose,t,x,y,source){
 const {scale:s,left,top}=source,sx=(x-left)/s,sy=(y-top)/s;
 let dx=0,dy=0;
 // Small continuous fields, rooted at the new pose. Feet/board ground remain fixed.
 const upper=1-smooth(530,890,sy),headA=(pose==='quota_exhausted' ? .32 : pose==='writing'||pose==='office' ? .12 : .42)*Math.PI/180*Math.sin(t*.85);
 dx+=-(sy-585)*headA*upper;dy+=(sx-645)*headA*upper;
 dy-=1.8*Math.sin(t*1.65)*(1-smooth(800,1170,sy));
 const tail=smooth(900,1120,sx)*smooth(750,1020,sy)*(1-smooth(1140,1230,sy));
 dy+=Math.sin(t*1.4)*(pose==='quota_exhausted'?2.2:5)*tail;
 if(pose==='writing'){
  const w=Math.max(bump(sx,sy,448,690,64,62),bump(sx,sy,385,588,57,97));
  dx+=7*Math.sin(t*5.4)*w;dy+=4*Math.sin(t*10.8)*w;
 }else if(pose==='office'){
  const l=bump(sx,sy,457,710,52,35),r=bump(sx,sy,615,740,55,33);
  dy+=5*(Math.sin(t*13)*l+Math.sin(t*13+Math.PI)*r);
 }else if(pose==='commission'){
  const w=Math.max(bump(sx,sy,419,552,54,63),bump(sx,sy,325,527,83,26));
  dy+=8*Math.sin(t*3.8)*w;dx+=3*Math.sin(t*1.9)*w;
 }else if(pose==='respect'){
  dy+=1.3*Math.sin(t*2.1)*bump(sx,sy,690,645,150,80);
 }else if(pose==='magic_orb'){
  const w=bump(sx,sy,900,655,147,151);
  dy-=9*Math.sin(t*1.3)*w;dx+=3*Math.sin(t*.8)*w;
 }else if(pose==='quota_exhausted'){
  dy+=2.8*(.5+.5*Math.sin(t*.9))*bump(sx,sy,630,593,28,34);
  dy+=2.2*Math.sin(t*.7)*(bump(sx,sy,240,848,115,75)+bump(sx,sy,1050,845,100,75));
 }
 return[dx*s,dy*s];
}
