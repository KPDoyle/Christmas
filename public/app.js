const el=id=>document.getElementById(id);
const params=new URLSearchParams(location.hash.slice(1));
const token=params.get('admin') || params.get('gift') || params.get('test') || '';
const headers={Authorization:'Bearer '+token};
const windows=[[8,12],[24,12],[38,13],[66,17],[76,17],[91,10],[6,25],[25,25],[38,26],[65,29],[75,29],[87,27],[95,27],[10,36],[21,36],[39,35],[66,43],[78,43],[9,62],[20,60],[27,62],[38,65],[76,56],[87,57],[94,63]];
const marks=['🎄','🕯️','🦌','🎁','🛷','🔔','🧦','🍪','⛄','🕊️'];
let chosenTopic=params.get('topic') || '';
let state={}, day=0, request=0, objectUrl;
async function refresh(){
  const r=await fetch('/api/calendar',{headers});
  if(!r.ok) throw Error('The calendar could not load. Please refresh.');
  state=await r.json();
  if(state.preview){
    el('mode').textContent='TEST CALENDAR';
    el('hint').textContent='All 25 doors are open for testing.';
  }
  if(state.guest){
    if(!state.topics.some(t=>t.id===chosenTopic)) chosenTopic=state.topic;
    el('testLink').href='/#test='+state.previewKey+'&topic='+encodeURIComponent(chosenTopic);
    el('editor').hidden=false;
    el('topics').replaceChildren(...state.topics.map(t=>new Option(t.name,t.id)));
    el('topics').value=chosenTopic;
    el('mode').textContent='CALENDAR ADMIN';
    el('share').hidden=false;
    el('hint').textContent=(state.filled.length)+' personal photos added. Preview any door or add a photo to its Christmas postcard.';
  }
  el('grid').replaceChildren();
  for(let n=1;n<=25;n++){
    const b=document.createElement('button');
    b.className='door'+(n<=state.unlocked?' available':'');
    const [x,y]=windows[n-1];
    b.style.left=x+'%';b.style.top=y+'%';
    b.dataset.mark=marks[(n*3+Math.floor(n/5))%5];
    b.textContent=String(n).padStart(2,'0');
    b.setAttribute('aria-label',n+' December'+(state.filled?.includes(n)?', photo ready':''));
    if(state.filled?.includes(n)){const tick=document.createElement('b');tick.textContent='✓';b.append(tick)}
    b.onclick=()=>openDay(n);el('grid').append(b);
  }
}
async function openDay(n){
  const current=++request;day=n;
  el('card').hidden=true;
  if(objectUrl) URL.revokeObjectURL(objectUrl);
  el('date').textContent=n+' December';el('photo').hidden=true;el('upload').hidden=!state.guest;
  el('upload').querySelector('input').value='';
  if(!el('popup').open)el('popup').showModal();
  el('notice').textContent='Opening your door…';
  if(!state.guest && Date.now()<Date.UTC(2026,11,n) && n>state.unlocked){
    el('notice').textContent='This door opens on '+n+' December at midnight UK time.';return;
  }
  try{
    const query=new URLSearchParams({card:'1',day:n,topic:chosenTopic});
    const cardResponse=await fetch('/api/calendar?'+query,{headers});
    if(current!==request)return;
    if(!cardResponse.ok){
      el('notice').textContent=cardResponse.status===423?'This door opens on '+n+' December.':cardResponse.status===403?'Use the guest link from your sender to open this door.':'This postcard could not load. Please reopen the door.';
      return;
    }
    const card=await cardResponse.json();
    if(current!==request)return;
    el('series').textContent=card.topic;
    el('setup').textContent=card.setup;
    el('punch').textContent=card.punchline;
    el('card').hidden=false;
    el('notice').textContent='';
    const r=await fetch('/api/calendar?day='+n,{headers});
    if(current!==request)return;
    if(!r.ok){el('notice').textContent=r.status===404?'':r.status===423?'This door opens on '+n+' December.':r.status===403?'Open the invitation link from your sender to view the photo.':'Could not load this photo. Please try again.';return}
    const blob=await r.blob();if(current!==request)return;
    objectUrl=URL.createObjectURL(blob);el('photo').src=objectUrl;el('photo').alt='Your photo for '+n+' December';el('photo').hidden=false;el('notice').textContent='';
  }catch{if(current===request)el('notice').textContent='Connection lost. Please try again.'}
}
el('close').onclick=()=>el('popup').close();
el('share').onclick=async()=>{
  const url=location.origin+'/#gift='+state.guest+'&topic='+encodeURIComponent(chosenTopic);
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

el('topics').onchange=e=>{
  chosenTopic=e.currentTarget.value;
  el('testLink').href='/#test='+state.previewKey+'&topic='+encodeURIComponent(chosenTopic);
  el('share').textContent='Copy invitation';
  el('saved').textContent='Ready to share · '+e.currentTarget.selectedOptions[0].text;
};
