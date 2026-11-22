// Paint the winter village in a fixed illustration space so it scales like a printed card.
(()=>{
 const canvas=document.getElementById('village'), ctx=canvas.getContext('2d');
 canvas.width=1400;canvas.height=680;ctx.scale(2,2);
 function polygon(points,colour){
   ctx.fillStyle=colour;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();
 }
 function circle(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
 function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
 function fir(x,y,h){
   rect(x-2,y-10,4,12,'#685049');
   for(let k=0;k<3;k++){
     const top=y-h+k*h*.22, width=h*(.16+k*.048);
     polygon([[x,top],[x-width,top+h*.53],[x+width,top+h*.53]],'#234f4c');
     polygon([[x,top],[x-width*.66,top+h*.35],[x-width*.13,top+h*.27],[x+width*.28,top+h*.32]],'#e0ece1');
   }
 }
 function house(x,y,w,h,paint){
   rect(x,y-h,w,h,paint);rect(x+w*.7,y-h-27,w*.11,23,'#ab7565');
   polygon([[x-5,y-h],[x+w*.43,y-h-w*.42],[x+w+5,y-h]],'#583e42');
   polygon([[x-7,y-h],[x+w*.43,y-h-w*.47],[x+w+7,y-h],[x+w+2,y-h+4],[x+w*.43,y-h-w*.36],[x-3,y-h+4]],'#fff4dc');
   for(const a of [.16,.62]){
     rect(x+w*a,y-h*.77,w*.22,h*.32,'#543d34');rect(x+w*a+2,y-h*.77+2,w*.22-4,h*.32-4,'#ffd481');
     rect(x+w*(a+.1),y-h*.77,2,h*.32,'#76523b');rect(x+w*a,y-h*.61,w*.22,2,'#76523b');
   }
   rect(x+w*.43,y-h*.34,w*.16,h*.34,'#483b36');
   for(let j=0;j<8;j++)circle(x+j*w/7,y-h+3,1.7,j%2?'#f1be63':'#da7268');
 }
 circle(532,80,32,'#ffe6ab');circle(520,68,29,'#193c43');
 polygon([[0,310],[110,240],[190,250],[305,168],[374,205],[460,139],[610,214],[700,166],[700,340],[0,340]],'#52716d');
 for(let i=0;i<32;i++)fir(i*24,265+Math.sin(i)*14,38+(i*17)%45);
 polygon([[0,319],[126,283],[249,286],[381,260],[505,264],[633,228],[700,250],[700,340],[0,340]],'#d1e1d9');
 house(265,295,58,38,'#a3544b');house(347,282,45,46,'#be916c');house(411,282,68,46,'#834e48');
 house(505,262,55,51,'#b67459');house(597,259,46,38,'#a59a81');
 fir(333,307,81);fir(574,280,95);fir(652,286,88);fir(688,314,126);
 polygon([[0,335],[147,312],[302,316],[420,293],[566,294],[700,272],[700,340],[0,340]],'#f4ecdc');
 for(let i=0;i<13;i++){let x=360+i*21,y=319-i*1.8;rect(x,y-12,3,16,'#796659');if(i<12)rect(x,y-8,22,2,'#796659')}
})();
