const el=id=>document.getElementById(id);
const params=new URLSearchParams(location.hash.slice(1));
const token=params.get('admin') || params.get('gift') || params.get('test') || '';
const headers={Authorization:'Bearer '+token};
const windows=[[8,12],[24,12],[38,13],[66,17],[76,17],[91,10],[6,25],[25,25],[38,26],[65,29],[75,29],[87,27],[95,27],[10,36],[21,36],[39,35],[66,43],[78,43],[9,62],[20,60],[27,62],[38,65],[76,56],[87,57],[94,63]];
const marks=['🎄','🕯️','🦌','🎁','🛷','🔔','🧦','🍪','⛄','🕊️'];
let chosenTopic=params.get('topic') || '';
const customTopics=new Map();
let state={}, day=0, request=0, objectUrl;
const role=params.has('admin')?'admin':params.has('test')?'preview':'guest';
const progressKey='december-post:2026:'+role+':'+(params.get('topic')||'default');
function readProgress(){
  try{return JSON.parse(localStorage.getItem(progressKey))||{}}catch{return {}}
}
const previous=readProgress();
const opened=new Set(Array.isArray(previous.days)?previous.days:[]);
const visit=opened.size?(Number(previous.visit)||0)+1:0;
function saveProgress(){
  const latest=readProgress();
  for(const n of latest.days||[])opened.add(n);
  try{localStorage.setItem(progressKey,JSON.stringify({days:[...opened],visit:Math.max(visit,Number(latest.visit)||0)}))}catch{}
}
if(opened.size)saveProgress();
const paintings=['carol','market','inn'];
const street=document.querySelector('.street');
for(const [index,variable] of ['--street','--market','--inn'].entries()){
  street.style.setProperty(variable,'url(/'+paintings[(visit+index)%3]+'.webp)');
}
function showOpened(button,n){
  button.classList.add('opened');
  button.setAttribute('aria-label',n+' December, opened. Revisit postcard');
  button.style.setProperty('--picture','url(/'+paintings[(n-1)%3]+'.webp)');
  button.style.setProperty('--crop',(12+(n*19)%76)+'% '+(24+(n*13)%56)+'%');
}
async function refresh(){
  const r=await fetch('/api/calendar',{headers});
  if(!r.ok) throw Error('The calendar could not load. Please refresh.');
  state=await r.json();
  if(state.preview){
    el('mode').textContent='TEST CALENDAR';
    el('hint').textContent='All 25 doors are open for testing.';
  }
  if(state.guest){
    state.topics.push(...customTopics.values());
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
    const [x,y]=windows[(n-1+visit*7)%25];
    b.style.left=x+'%';b.style.top=y+'%';
    b.dataset.mark=marks[(n*3+Math.floor(n/5))%5];
    b.textContent=String(n).padStart(2,'0');
    b.setAttribute('aria-label',n+' December'+(state.filled?.includes(n)?', photo ready':''));
    if(state.filled?.includes(n)){const tick=document.createElement('b');tick.textContent='✓';b.append(tick)}
    b.id='door-'+n;
    if(opened.has(n))showOpened(b,n);
    b.onclick=()=>openDay(n);el('grid').append(b);
  }
}
async function openDay(n){
  const current=++request;day=n;
  el('card').hidden=true;el('media').replaceChildren();
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
    opened.add(n);saveProgress();showOpened(el('door-'+n),n);
    el('series').textContent=card.topic;
    if(card.media){
      const animation=new Image();
      animation.alt=card.topic+' animation for '+n+' December';
      animation.onerror=()=>animation.replaceWith('This animation is temporarily unavailable.');
      animation.src='https://media.giphy.com/media/'+encodeURIComponent(card.media.id)+'/giphy.gif';
      el('media').replaceChildren(animation);
    }
    el('card').hidden=false;
    el('notice').textContent='';
    const r=await fetch('/api/calendar?day='+n,{headers});
    if(current!==request)return;
    if(!r.ok){el('notice').textContent=r.status===404?'':r.status===423?'This door opens on '+n+' December.':r.status===403?'Open the invitation link from your sender to view the photo.':'Could not load this photo. Please try again.';return}
    const blob=await r.blob();if(current!==request)return;
    objectUrl=URL.createObjectURL(blob);el('photo').src=objectUrl;el('photo').alt='Your photo for '+n+' December';el('photo').hidden=false;el('notice').textContent='';
  }catch{if(current===request)el('notice').textContent='Connection lost. Please try again.'}
}
el('popup').addEventListener('close',()=>{request++;el('media').replaceChildren()});
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

el('discover').onsubmit=async e=>{
  e.preventDefault();
  const button=e.currentTarget.querySelector('button');
  button.disabled=true;el('share').disabled=true;el('saved').textContent='Finding 25 different GIFs…';
  try{
    const r=await fetch('/api/calendar?discover=1',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({name:el('interest').value})});
    if(!r.ok)throw Error(r.status===422?'Try a broader interest to find 25 GIFs.':'Search unavailable. Try again or choose a prepared topic.');
    const t=await r.json();
    if(!customTopics.has(t.id))el('topics').add(new Option(t.name,t.id));
    customTopics.set(t.id,t);el('topics').value=t.id;el('topics').dispatchEvent(new Event('change'));
  }catch(error){el('saved').textContent=error.message}
  finally{button.disabled=false;el('share').disabled=false}
};
