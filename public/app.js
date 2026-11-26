const el=id=>document.getElementById(id);
const params=new URLSearchParams(location.hash.slice(1));
const shareOrigin=location.hostname==='december-post-kevindoyle.vercel.app'?'https://calendar-post-kevindoyle.vercel.app':location.origin;
if(params.has('admin') && params.get('admin')!=='session')location.replace('/owner.html');
if(params.get('admin')==='session')fetch('/api/owner?action=status').then(r=>r.json()).then(s=>{if(!s.loggedIn)location.replace('/owner.html')});
const recipient=params.get('calendar');
const endpoint=recipient?'/api/recipients':'/api/calendar';
const token=recipient||params.get('admin') || params.get('gift') || params.get('test') || '';
const demo=!token;
const sampleSets={travel:[['Alpine chalets','For all the mountain trips we still have to take.'],['Christmas steam train','I still think the train ride was the best part of our holiday.'],['Northern lights cabin','One for the wish list. Next winter?']],food:[['Gingerbread bakery','Remember the gingerbread house that leaned to the left? It was still my favourite.'],['German market square','One day we’ll settle the great gingerbread debate in person.'],['Tudor Christmas feast','This one is for the person who always makes room for one more at the table.']],stage:[['Nutcracker ballet','For the night we missed our train because we stayed for every curtain call.'],['Victorian drawing room','Imagine rehearsing our lines beside this fire.'],['Midnight cathedral','I saved the music for the finale.']]};
const sampleTheme=Object.hasOwn(sampleSets,params.get('sample'))?params.get('sample'):'travel';
const samples=sampleSets[sampleTheme];
const sampleScenes=[
  "Dickensian London",
  "Victorian Christmas market",
  "Snowy coaching inn",
  "Cotswold Christmas",
  "Alpine chalets",
  "Paris at Christmas",
  "Dutch canal skating",
  "German market square",
  "Scandinavian harbour",
  "Victorian drawing room",
  "Toymaker workshop",
  "Gingerbread bakery",
  "Midnight cathedral",
  "Tudor Christmas feast",
  "Nutcracker ballet",
  "Christmas steam train",
  "Moonlit sleigh ride",
  "Winter conservatory",
  "Lanterns on the lake",
  "Snowbound lighthouse",
  "Northern lights cabin"
];
const headers={Authorization:'Bearer '+token};
const windows=[
  [9,13],[28,16],[48,12],[69,15],[91,12],
  [14,31],[35,34],[55,30],[75,33],[93,31],
  [7,50],[26,52],[46,49],[65,52],[86,49],
  [13,68],[34,70],[54,67],[74,70],[93,68],
  [8,87],[28,89],[47,86],[67,89],[87,86]
];
const marks=['🎄','🕯️','🦌','🎁','🛷','🔔','🧦','🍪','⛄','🕊️'];
let chosenTopic=params.get('topic') || '';
const customTopics=new Map();
let state={}, day=0, request=0, objectUrl;
const role=params.has('admin')?'admin':params.has('test')?'preview':'guest';
const progressKey='december-post:2026:'+role+':'+(demo?'public-sample-'+sampleTheme:recipient||params.get('topic')||'default');
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
function themeImage(name){
  return ({'Dickensian London':'carol','Victorian Christmas market':'market','Snowy coaching inn':'inn'})[name] || (name?'scenes/'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-'):'carol');
}
function showOpened(button,n){
  button.classList.add('opened');
  button.setAttribute('aria-label',n+' December, opened. Revisit postcard');
  button.style.setProperty('--picture','url(/'+paintings[(n-1)%3]+'.webp)');
  button.style.setProperty('--crop',(12+(n*19)%76)+'% '+(24+(n*13)%56)+'%');
}
function showGift(){
  const title=document.querySelector('.mast h1'),intro=document.querySelector('.mast p');
  if(demo){
    el('samplePicker').hidden=false;el('sampleTheme').value=sampleTheme;
    el('sampleTheme').onchange=e=>{location.hash='sample='+e.target.value;location.reload()};
    el('shareSample').onclick=async()=>{
      const url=shareOrigin+'/#sample='+sampleTheme;
      try{if(navigator.share)await navigator.share({title:'December Post',url});else{await navigator.clipboard.writeText(url);el('shareSample').textContent='Sample link copied'}}
      catch(e){if(e.name!=='AbortError')prompt('Copy sample link',url)}
    };
    title.textContent='Christmas, made for you.';
    intro.textContent='25 illustrated doors filled with their favourite things and messages from you.';
    el('mode').textContent='EXPLORE A SAMPLE GIFT';
    el('hint').textContent='Open any of the 25 doors to explore this sample.';
  }else if(recipient && state.recipientName){
    title.textContent='Christmas for '+state.recipientName;
    intro.textContent='December 2026';
  }
  el('letter').hidden=!(state.dedication||state.senderName||state.recipientName);
  el('toLine').textContent=state.recipientName?'Dear '+state.recipientName+',':'';
  el('giftMessage').textContent=state.dedication||'';
  el('fromLine').textContent=state.senderName?'From '+state.senderName:'';
}
function updateJourney(){
  if(state.guest)return;
  const limit=25;
  const available=Math.min(state.unlocked,limit);
  const next=Array.from({length:available},(_,i)=>i+1).find(n=>!opened.has(n));
  el('journey').hidden=false;
  const count=[...opened].filter(n=>n>=1&&n<=limit).length;
  el('progressText').textContent=count+' of '+limit+' '+(demo?'sample ':'')+'doors opened';
  el('doorProgress').max=limit;el('doorProgress').value=count;
  el('nextDoor').hidden=!next;
  if(next){el('nextDoor').textContent=(demo?'Try door ':'Open door ')+next;el('nextDoor').onclick=()=>openDay(next)}
}
async function refresh(){
  if(demo)state={unlocked:25,recipientName:'Alex',senderName:'Sam',dedication:({travel:'A December full of places I’d love to explore with you.',food:'For the cook who makes our kitchen the warmest place in December.',stage:'For my favourite person to sit beside when the house lights go down.'})[sampleTheme]};
  else {
  const r=await fetch(endpoint,{headers});
  if(!r.ok) throw Error('The calendar could not load. Please refresh.');
  state=await r.json();
  }
  showGift();updateJourney();
  if(recipient){
    const theme=themeImage(state.background);
    const catalog=(state.backgrounds||[]).map(themeImage);
    const start=Math.max(0,catalog.indexOf(theme));
    const trio=catalog.length?Array.from({length:3},(_,i)=>catalog[(start+i)%catalog.length]):paintings;
    for(const [index,variable] of ['--street','--market','--inn'].entries()){
      street.style.setProperty(variable,'url(/'+trio[(visit+index)%3]+'.webp)');
    }
    street.dataset.theme=theme;
  }
  if(state.preview){
    el('mode').textContent='TEST CALENDAR';
    el('hint').textContent='All 25 doors are open for testing.';
  }
  if(state.guest){
    try{sessionStorage.setItem('calendarAdminHome',location.hash)}catch{}
    state.topics.push(...customTopics.values());
    if(!state.topics.some(t=>t.id===chosenTopic)) chosenTopic=state.topic;
    el('testLink').href='/#test='+state.previewKey+'&topic='+encodeURIComponent(chosenTopic);
    el('editor').hidden=true;
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
    b.style.setProperty('--slot',(n-1+visit*7)%25);b.style.left=x+'%';b.style.top=y+'%';
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
  const current=++request;day=n;el('postNote').hidden=true;
  el('card').hidden=true;el('media').replaceChildren();
  if(objectUrl) URL.revokeObjectURL(objectUrl);
  el('date').textContent=n+' December';el('photo').hidden=true;el('upload').hidden=!state.guest;
  el('upload').querySelector('input').value='';
  if(!el('popup').open)el('popup').showModal();
  el('notice').textContent='Opening your door…';
  if(demo){
    const [scene,note]=samples[n-1]||[sampleScenes[(n-4)%sampleScenes.length],''];
    const img=new Image();img.src='/'+themeImage(scene)+'.webp';img.alt=scene;
    el('series').textContent=scene;el('media').replaceChildren(img);
    el('postNote').textContent=note;el('postNote').hidden=false;el('card').hidden=false;el('notice').textContent='';
    opened.add(n);saveProgress();showOpened(el('door-'+n),n);updateJourney();return;
  }
  try{
    const query=new URLSearchParams({card:'1',day:n,topic:chosenTopic});
    const cardResponse=await fetch(endpoint+'?'+query,{headers});
    if(current!==request)return;
    if(!cardResponse.ok){
      el('notice').textContent=cardResponse.status===423?'This door opens on '+n+' December.':cardResponse.status===403?'Use the guest link from your sender to open this door.':'This postcard could not load. Please reopen the door.';
      return;
    }
    const card=await cardResponse.json();
    if(current!==request)return;
    opened.add(n);saveProgress();showOpened(el('door-'+n),n);
    updateJourney();el('postNote').textContent=card.note||'';el('postNote').hidden=!card.note;
    if(card.background)el('card').style.setProperty('--postcard-art','url(/'+themeImage(card.background)+'.webp)');
    el('series').textContent=card.topic;
    if(card.media){
      const animation=new Image();
      animation.alt=card.media.title||card.topic;
      animation.onerror=()=>animation.replaceWith('This animation is temporarily unavailable.');
      animation.src=mediaUrl(card.media);
      el('media').replaceChildren(animation);
    }
    el('card').hidden=false;
    el('notice').textContent='';
    const r=await fetch(endpoint+'?day='+n,{headers});
    if(current!==request)return;
    if(!r.ok){el('notice').textContent=r.status===404?'':r.status===423?'This door opens on '+n+' December.':r.status===403?'Open the invitation link from your sender to view the photo.':'Could not load this photo. Please try again.';return}
    const blob=await r.blob();if(current!==request)return;
    objectUrl=URL.createObjectURL(blob);el('photo').src=objectUrl;el('photo').alt='Your photo for '+n+' December';el('photo').hidden=false;el('notice').textContent='';
  }catch{if(current===request)el('notice').textContent='Connection lost. Please try again.'}
}
el('popup').addEventListener('close',()=>{request++;el('media').replaceChildren()});
el('close').onclick=()=>el('popup').close();
el('share').onclick=async()=>{
  const url=shareOrigin+'/#gift='+state.guest+'&topic='+encodeURIComponent(chosenTopic);
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
function showAdminHome(){
  let adminHash=params.has('admin')?location.hash:'';
  try{adminHash=adminHash||sessionStorage.getItem('calendarAdminHome')||''}catch{}
  if(!adminHash.startsWith('#admin='))return;
  const home=el('adminHome');
  home.hidden=false;
  home.onclick=()=>{location.hash=adminHash;location.reload()};
}
showAdminHome();
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


function mediaUrl(media,thumb=false){
  return media.scene?'/'+themeImage(media.scene)+'.webp':'https://media.giphy.com/media/'+encodeURIComponent(media.id)+(thumb?'/200w_s.gif':'/giphy.gif');
}
