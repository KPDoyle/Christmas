const el=id=>document.getElementById(id);
const params=new URLSearchParams(location.hash.slice(1));
const token=params.get('admin') || params.get('gift') || '';
const headers={Authorization:'Bearer '+token};
const marks=['✧','❄','✴','❅','✦'];
let state={}, day=0, request=0, objectUrl;
async function refresh(){
  const r=await fetch('/api/calendar',{headers});
  if(!r.ok) throw Error('The calendar could not load. Please refresh.');
  state=await r.json();
  if(state.guest){
    el('mode').textContent='CALENDAR ADMIN';
    el('share').hidden=false;
    el('hint').textContent=(state.filled.length)+' of 25 photos ready. Choose a door to upload or replace its photo.';
  }
  el('grid').replaceChildren();
  for(let n=1;n<=25;n++){
    const b=document.createElement('button');
    b.className='door'+(n<=state.unlocked?' available':'');
    b.dataset.mark=marks[(n*3+Math.floor(n/5))%5];
    b.textContent=String(n).padStart(2,'0');
    b.setAttribute('aria-label',n+' December'+(state.filled?.includes(n)?', photo ready':''));
    if(state.filled?.includes(n)){const tick=document.createElement('b');tick.textContent='✓';b.append(tick)}
    b.onclick=()=>openDay(n);el('grid').append(b);
  }
}
async function openDay(n){
  const current=++request;day=n;
  if(objectUrl) URL.revokeObjectURL(objectUrl);
  el('date').textContent=n+' December';el('photo').hidden=true;el('upload').hidden=!state.guest;
  el('upload').querySelector('input').value='';
  if(!el('popup').open)el('popup').showModal();
  el('notice').textContent='Opening your door…';
  if(!state.guest && Date.now()<Date.UTC(2026,11,n) && n>state.unlocked){
    el('notice').textContent='This door opens on '+n+' December at midnight UK time.';return;
  }
  try{
    const r=await fetch('/api/calendar?day='+n,{headers});
    if(current!==request)return;
    if(!r.ok){el('notice').textContent=r.status===404?'This door is waiting for its photo.':r.status===423?'This door opens on '+n+' December.':r.status===403?'Open the invitation link from your sender to view the photo.':'Could not load this photo. Please try again.';return}
    const blob=await r.blob();if(current!==request)return;
    objectUrl=URL.createObjectURL(blob);el('photo').src=objectUrl;el('photo').alt='Your photo for '+n+' December';el('photo').hidden=false;el('notice').textContent='';
  }catch{if(current===request)el('notice').textContent='Connection lost. Please try again.'}
}
el('close').onclick=()=>el('popup').close();
el('share').onclick=async()=>{
  const url=location.origin+'/#gift='+state.guest;
  try{await navigator.clipboard.writeText(url);el('share').textContent='Guest link copied'}catch{prompt('Copy your guest link',url)}
};
const input=el('upload').querySelector('input');
input.onchange=async()=>{
  const file=input.files[0],selected=day;
  if(!file)return;
  input.disabled=true;el('notice').textContent='Saving photo…';
  let src=URL.createObjectURL(file);
  try{
    const image=new Image();image.src=src;await image.decode();
    const scale=Math.min(1,1600/Math.max(image.width,image.height));
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(image.width*scale));c.height=Math.max(1,Math.round(image.height*scale));
    const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,0,0,c.width,c.height);
    const photo=c.toDataURL('image/jpeg',.83).split(',')[1];
    const r=await fetch('/api/calendar?day='+selected,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({photo})});
    if(!r.ok)throw Error();
    await refresh();if(el('popup').open && selected===day)await openDay(selected);
  }catch{el('notice').textContent='Could not save this picture. Try a JPEG or PNG and check your connection.'}
  finally{URL.revokeObjectURL(src);input.disabled=false}
};
refresh().catch(e=>el('hint').textContent=e.message);
