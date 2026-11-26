// Two depths of falling snow and small pools of gaslight across the painted street.
const flakes=document.querySelector('.flurries');
for(let i=0;i<168;i++){
  const flake=document.createElement('i');
  flake.style.left=(i*37%103)+'%';
  flake.style.setProperty('--size',(1+i%5)+'px');
  flake.style.animationDuration=(5+i%9)+'s';
  flake.style.animationDelay=-(i*1.79)+'s';
  flake.style.pointerEvents='none';
  flakes.append(flake);
}
const lights=document.querySelector('.lights');
for(const [x,y] of [[46.5,46],[48.9,52],[59.3,51],[55.3,49],[98.5,51],[65.3,60],[9,53],[37.7,58],[83.5,58],[26,51]]){
  const glow=document.createElement('i');
  glow.style.left=x+'%';glow.style.top=y+'%';
  glow.style.animationDelay=-(x/5)+'s';lights.append(glow);
}
