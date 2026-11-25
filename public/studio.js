(()=>{
if(!params.has('admin'))return;
const studio=el('studio'),status=el('studioStatus');
let current=null,busy=false;
const opts=(select,values)=>select.replaceChildren(...values.map(v=>new Option(v,v)));
async function api(id,options={},day){
  const q=new URLSearchParams();
  if(id)q.set('id',id);if(day)q.set('day',day);
  const r=await fetch('/api/recipients?'+q,{...options,headers:{...headers,...options.headers}});
  if(!r.ok)throw Error((await r.text()).slice(0,180)||'Unable to open calendar.');
  return r.json();
}
const post=data=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
function door(){
  if(!current)return;
  const d=current.doors[Number(el('editDay').value)-1];
  el('doorInterest').value=d.category;el('doorStyle').value=d.style;el('doorBg').value=d.background||'';
  el('replaceGif').checked=false;
  const image=new Image();image.alt=d.category;image.src='https://media.giphy.com/media/'+encodeURIComponent(d.media.id)+'/giphy.gif';
  el('miniPreview').replaceChildren(image);
}
function display(c){
  current=c;el('recipientEmail').value=c?.email||'';el('categories').value=c?.interests.join(', ')||'';
  el('calStyle').selectedIndex=0;el('calBg').selectedIndex=0;
  el('delivery').hidden=!c;el('library').value=c?.id||'';
  el('build').textContent=c?'Save calendar changes':'Find content and create calendar';
  if(!c)return;
  el('calStyle').value=c.style;el('calBg').value=c.background;
  const url=location.origin+'/#calendar='+c.invite;
  el('inviteUrl').value=url;el('previewInvite').href='/#calendar='+c.test;
  el('mailInvite').href='mailto:'+encodeURIComponent(c.email)+'?subject='+encodeURIComponent('Your Christmas advent calendar')+'&body='+encodeURIComponent('A little Christmas surprise for you. Open a window each day in December.\n\n'+url);
  let option=Array.from(el('library').options).find(o=>o.value===c.id);
  if(!option){option=new Option(c.email,c.id);el('library').add(option)}
  option.textContent=c.email+' · '+c.id.slice(-6);el('library').value=c.id;door();
}
async function work(action){
  if(busy)return;busy=true;studio.inert=true;status.textContent='Working…';
  try{await action()}catch(e){status.textContent=e.message}
  finally{studio.inert=false;busy=false}
}
async function open(id){
  const c=id?await api(id):null;el('editDay').value='1';display(c);status.textContent='';
}
el('library').onchange=e=>work(()=>open(e.target.value));
el('lookup').onsubmit=e=>{e.preventDefault();work(async()=>{
  const u=new URL(el('lookupUrl').value);const id=new URLSearchParams(u.hash.slice(1)).get('calendar')?.split('.')[0];
  if(!id||!/^[a-f0-9]{32}$/.test(id))throw Error('Paste a recipient invitation created in this studio.');
  await open(id);
})};
el('recipientForm').onsubmit=e=>{e.preventDefault();work(async()=>{
  status.textContent='Finding content and preparing the calendar…';
  const data={email:el('recipientEmail').value,interests:el('categories').value.split(',').map(s=>s.trim()).filter(Boolean),style:el('calStyle').value,background:el('calBg').value,version:current?.version};
  display(await api(current?.id,post(data)));status.textContent='Calendar saved. Your private invitation is ready.';
})};
el('editDay').onchange=door;
el('doorForm').onsubmit=e=>{e.preventDefault();work(async()=>{
  const data={category:el('doorInterest').value,style:el('doorStyle').value,background:el('doorBg').value,replace:el('replaceGif').checked,version:current.version};
  display(await api(current.id,post(data),el('editDay').value));status.textContent='Window saved to the existing invitation.';
})};
el('copyInvite').onclick=async()=>{try{await navigator.clipboard.writeText(el('inviteUrl').value);status.textContent='Invitation copied.'}catch{el('inviteUrl').select();status.textContent='Copy the selected invitation.'}};
el('recipientPhoto').onchange=e=>{const file=e.target.files[0];if(!file)return;work(async()=>{
  const src=URL.createObjectURL(file);
  try{const img=new Image();img.src=src;await img.decode();const scale=Math.min(1,1600/Math.max(img.width,img.height));
    const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(img.width*scale));cv.height=Math.max(1,Math.round(img.height*scale));
    cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
    await api(current.id,post({photo:cv.toDataURL('image/jpeg',.83).split(',')[1]}),el('editDay').value);status.textContent='Photo saved to this recipient’s window.';
  }finally{URL.revokeObjectURL(src);el('recipientPhoto').value=''}
})};
api().then(data=>{
  studio.hidden=false;
  opts(el('calStyle'),data.styles);opts(el('doorStyle'),data.styles);opts(el('calBg'),data.backgrounds);opts(el('doorBg'),data.backgrounds);
  el('doorBg').add(new Option('Use calendar background',''),0);
  for(let i=1;i<=25;i++)el('editDay').add(new Option(i+' December',String(i)));
  for(const c of data.calendars)el('library').add(new Option(c.email+' · '+c.id.slice(-6),c.id));
  display(null);
}).catch(e=>{studio.hidden=false;status.textContent=e.message});
})();