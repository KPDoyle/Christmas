(()=>{
if(!params.has('admin'))return;
document.addEventListener('click',event=>{
  const button=event.target.closest?.('#studio button,#editor button,#adminHome');
  if(button && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    button.animate([{transform:'translateY(2px)'},{transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
  }
},true);
const studio=el('studio'),status=el('studioStatus');
// Owner account / Microsoft 365 sender notice for admins.
fetch('/api/owner?action=status',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(s=>{
  if(!s)return;
  const note=document.createElement('p');note.id='ownerNotice';note.setAttribute('role','status');
  const link=(text)=>{const a=document.createElement('a');a.href='/owner.html';a.textContent=text;return a};
  let warn=false;
  if(params.get('admin')==='session'&&!s.loggedIn){note.append('Your owner session has ended. ',link('Sign in again'));warn=true}
  else if(s.setupRequired){note.append('No owner login yet. ',link('Set your owner password'));warn=true}
  else if(s.loggedIn&&s.sender&&!s.sender.connected){note.append('Password-reset emails cannot be sent: the Microsoft 365 sender is not connected. ',link('Connect it in owner settings'));warn=true}
  else note.append(link(s.loggedIn?'Owner settings':'Owner sign-in'));
  if(warn)note.style.cssText='background:#fff3cd;color:#5a4300;border:1px solid #c79100;padding:.6rem;border-radius:.3rem';
  studio.prepend(note);
}).catch(()=>{});
let current=null,busy=false,activeDay=1;
const drafts=new Map();
const windowFields=['dayNote'];
const calendarFields=['recipientEmail','categories','calStyle','calBg','recipientName','senderName','dedication'];
let calendarBaseline='';
const values=fields=>fields.map(id=>el(id).value);
const applyValues=(fields,data)=>fields.forEach((id,i)=>{el(id).value=data[i]});
const calendarChanged=()=>JSON.stringify(values(calendarFields))!==calendarBaseline;
function trackWindow(){
  if(!current)return;
  const d=current.doors[activeDay-1], data=values(windowFields);
  if(JSON.stringify(data)===JSON.stringify([d.note||'']))drafts.delete(activeDay);
  else drafts.set(activeDay,data);
  updateDraftStatus();
}
function updateDraftStatus(){
  el('draftStatus').textContent=drafts.size?'Unsaved windows: '+[...drafts.keys()].sort((a,b)=>a-b).join(', ')+'. Select a window and use Save window.':'';
}
el('doorForm').addEventListener('input',event=>{if(windowFields.includes(event.target.id))trackWindow()});
function hasEdits(){return drafts.size>0||(calendarBaseline&&calendarChanged())}
window.addEventListener('beforeunload',event=>{if(hasEdits()){event.preventDefault();event.returnValue=''}});

const opts=(select,values)=>select.replaceChildren(...values.map(v=>new Option(v,v)));
async function api(id,options={},day){
  const q=new URLSearchParams();
  if(id)q.set('id',id);if(day)q.set('day',day);
  const r=await fetch('/api/recipients?'+q,{...options,headers:{...headers,...options.headers}});
  if(!r.ok)throw Error((await r.text()).slice(0,180)||'Unable to open calendar.');
  return r.json();
}
const post=data=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
function formatInterests(values){
  return values.map(value=>/[",\n]/.test(value)?'"'+value.replace(/"/g,'""')+'"':value).join(', ');
}
function parseInterests(input){
  const groups=[];let part='',quoted=false;
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(ch==='"' && (quoted || !part.trim())){
      if(quoted && input[i+1]==='"'){part+='"';i++}
      else quoted=!quoted;
    }else if(!quoted && (ch===','||ch==='\n')){
      if(part.trim())groups.push(part.trim());
      part='';
    }else part+=ch;
  }
  if(quoted)throw Error('Close the quotation mark around your search.');
  if(part.trim())groups.push(part.trim());
  return groups;
}
function previewArt(){
  const selected=el('calBg').value;
  if(!selected)return;
  const theme=themeImage(selected);
  const imageUrl='/'+theme+'.webp';
  street.style.setProperty('--street','url('+imageUrl+')');
  street.dataset.theme=theme;
  el('calendarArt').src=imageUrl;
  el('calendarArt').alt=selected;
}
el('calBg').addEventListener('change',previewArt);
let photoRequest=0;
let previewUrl='';
function showPhoto(blob){
  const preview=el('savedPhotoPreview');
  if(previewUrl)URL.revokeObjectURL(previewUrl);
  previewUrl=blob?URL.createObjectURL(blob):'';
  preview.hidden=!blob;
  if(blob)preview.src=previewUrl;
  else preview.removeAttribute('src');
}
async function loadPhoto(id,day){
  const request=++photoRequest;
  showPhoto(null);
  const door=current.doors[day-1];
  const preview=el('savedPhotoPreview');
  preview.src=mediaUrl(door.media);
  preview.hidden=false;
  const caption=el('recipientFilename');
  if(door.preferAnimation){caption.textContent='';return}
  caption.textContent='Checking for a saved photo…';
  try{
    const response=await fetch('/api/recipients?id='+encodeURIComponent(id)+'&day='+day,{headers,cache:'no-store'});
    if(request!==photoRequest)return;
    if(response.status===404){caption.textContent='';return}
    if(!response.ok)throw Error();
    const blob=await response.blob();
    if(request!==photoRequest)return;
    showPhoto(blob);
    caption.textContent='Saved photo for window '+day;
  }catch{if(request===photoRequest)caption.textContent='Saved photo preview unavailable.'}
}
function door(){
  el('recipientFilename').textContent='';
  if(!current)return;
  activeDay=Number(el('editDay').value);
  const d=current.doors[activeDay-1];
  loadPhoto(current.id,activeDay);
  el('dayNote').value=d.note||'';
  if(drafts.has(activeDay))applyValues(windowFields,drafts.get(activeDay));
  previewArt();
}
const doorPhotos=new Map();
function updatePhotoTile(day,src){
  doorPhotos.set(day,src);
  for(const tile of [el('door-'+day),el('matchGrid').children[day-1]]){
    if(!tile)continue;
    if(tile.classList.contains('matchTile'))tile.querySelector('img').src=src;
    else tile.style.setProperty('--uploaded-photo','url("'+src+'")');
  }
}
function display(c){
  if(studioCalendarId!==(c?.id||'')){
    photoRequest++;showPhoto(null);doorPhotos.clear();
    document.querySelectorAll('.street .door').forEach(tile=>tile.style.removeProperty('--uploaded-photo'));
  }
  studioCalendarId=c?.id||'';
  const backgroundsMenu=el('calBg');
  backgroundsMenu.querySelector('option[data-legacy]')?.remove();
  if(c && !Array.from(backgroundsMenu.options).some(o=>o.value===c.background)){
    const legacy=new Option(c.background+' (previous selection)',c.background);
    legacy.hidden=true;legacy.dataset.legacy='true';backgroundsMenu.add(legacy);
  }
  if(!c||current?.id!==c.id)drafts.clear();
  updateDraftStatus();
  for(const field of ['recipientName','senderName','dedication'])el(field).value=c?.[field]||'';
  el('deleteCalendar').hidden=!c;
  current=c;el('recipientEmail').value=c?.email||'';el('categories').value=formatInterests(c?.interests||[]);
  el('calStyle').selectedIndex=0;el('calBg').selectedIndex=0;
  el('delivery').hidden=!c;el('library').value=c?.id||'';
  el('build').textContent=c?'Save calendar changes':'Create calendar';
  if(!c){calendarBaseline=JSON.stringify(values(calendarFields));previewArt();return;}
  el('calStyle').value=c.style;el('calBg').value=c.background;
  calendarBaseline=JSON.stringify(values(calendarFields));
  el('matchGrid').replaceChildren(...c.doors.map((d,i)=>{
    const tile=document.createElement('button');tile.type='button';tile.className='matchTile';
    const image=new Image();image.loading='lazy';image.alt='';image.src=mediaUrl(d.media,true);
    const name=document.createElement('span');name.textContent=(i+1)+' Dec · '+d.category;
    tile.append(image,name);
    if(d.media.matchType){const label=document.createElement('small');label.textContent=({full:'Full interest match',related:'Related interest',festive:'Christmas artwork'})[d.media.matchType];tile.append(label)}
    if(d.media.matched?.length){const tags=document.createElement('small');tags.textContent='Matched: '+d.media.matched.join(', ');tile.append(tags)}
    tile.onclick=()=>{el('editDay').value=String(i+1);door();el('dayNote').focus()};
    return tile;
  }));
  for(const [day,src] of doorPhotos)updatePhotoTile(day,src);
  const url=shareOrigin+'/#calendar='+c.invite;
  el('inviteUrl').value=url;el('previewInvite').href='/#calendar='+c.test+'&preview=1';
  el('previewInvite').target='_blank';el('previewInvite').rel='noopener';
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
  if(hasEdits()&&!confirm('Discard your unsaved edits and open another calendar?')){el('library').value=current?.id||'';return}
  const c=id?await api(id):null;drafts.clear();el('editDay').value='1';display(c);status.textContent='';
}
el('library').onchange=e=>work(async()=>{
  try{await open(e.target.value)}catch(error){el('library').value=current?.id||'';throw error}
});
el('deleteCalendar').onclick=()=>{
  const selected=current;
  if(!selected||busy)return;
  if(!confirm('Delete the calendar for '+selected.email+' ('+selected.id.slice(-6)+') and its uploaded photos? Both shared links will stop working.'))return;
  work(async()=>{
    await api(selected.id,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:selected.version})});
    Array.from(el('library').options).find(option=>option.value===selected.id)?.remove();
    display(null);el('recipientEmail').focus();
    status.textContent='Calendar deleted for '+selected.email+'.';
  });
};
el('recipientForm').onsubmit=e=>{e.preventDefault();work(async()=>{
  status.textContent='Finding content and preparing the calendar…';
  const data={recipientName:el('recipientName').value,senderName:el('senderName').value,dedication:el('dedication').value,email:el('recipientEmail').value,interests:parseInterests(el('categories').value),style:el('calStyle').value,background:el('calBg').value,version:current?.version};
  const creating=!current;
  display(await api(current?.id,post(data)));
  if(creating)requestAnimationFrame(()=>el('inviteHeading').focus());
  status.textContent='Calendar saved. Your private invitation is ready.';
})};
el('editDay').onchange=door;
el('doorForm').onsubmit=e=>{e.preventDefault();work(async()=>{
  const {category,style,background}=current.doors[activeDay-1];
  const data={note:el('dayNote').value,category,style,background,replace:e.submitter?.id==='replaceGif',version:current.version};
  if(data.replace)status.textContent='Searching for a different animation…';
  const pendingCalendar=calendarChanged()?values(calendarFields):null;
  const saved=await api(current.id,post(data),activeDay);
  if(data.replace)updatePhotoTile(activeDay,mediaUrl(saved.doors[activeDay-1].media));
  drafts.delete(activeDay);display(saved);
  if(pendingCalendar){applyValues(calendarFields,pendingCalendar);previewArt()}
 status.textContent=data.replace?'New animation saved to this window.':'Window saved to the existing invitation.';
})};
el('copyInvite').onclick=async()=>{try{await navigator.clipboard.writeText(el('inviteUrl').value);status.textContent='Invitation copied.'}catch{el('inviteUrl').select();status.textContent='Copy the selected invitation.'}};
el('recipientPhoto').onchange=e=>{const file=e.target.files[0];if(!file)return;++photoRequest;showPhoto(file);el('recipientFilename').textContent='Uploading '+file.name+'…';work(async()=>{
  const src=URL.createObjectURL(file);
  try{const img=new Image();img.src=src;await img.decode();const scale=Math.min(1,1600/Math.max(img.width,img.height));
    const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(img.width*scale));cv.height=Math.max(1,Math.round(img.height*scale));
    cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
    const result=await api(current.id,post({photo:cv.toDataURL('image/jpeg',.83).split(',')[1],version:current.version}),activeDay);
    if(result.version)current.version=result.version;
    current.doors[activeDay-1].preferAnimation=false;
    const thumb=document.createElement('canvas');thumb.width=160;thumb.height=Math.max(1,Math.round(160*cv.height/cv.width));if(thumb.height>160){thumb.width=Math.max(1,Math.round(160*cv.width/cv.height));thumb.height=160}
    thumb.getContext('2d').drawImage(cv,0,0,thumb.width,thumb.height);
    updatePhotoTile(activeDay,thumb.toDataURL('image/jpeg',.8));
    el('recipientFilename').textContent='Saved: '+file.name;status.textContent='';
  }catch(error){await loadPhoto(current.id,activeDay);el('recipientFilename').textContent='Upload failed. Choose the photo again to retry.';throw error}finally{URL.revokeObjectURL(src);el('recipientPhoto').value=''}
})};
api().then(async data=>{
  studio.hidden=false;
  opts(el('calStyle'),data.styles);el('calBg').replaceChildren(...Object.entries(data.backgroundGroups).map(([label,scenes])=>{
    const group=document.createElement('optgroup');group.label=label;
    group.append(...scenes.map(scene=>new Option(scene,scene)));return group;
  }));
  for(let i=1;i<=25;i++)el('editDay').add(new Option(i+' December',String(i)));
  for(const c of data.calendars)el('library').add(new Option(c.email+' · '+c.id.slice(-6),c.id));
  const edit=params.get('edit');
  if(edit && data.calendars.some(c=>c.id===edit))await open(edit);else display(null);
}).catch(e=>{studio.hidden=false;status.textContent=e.message});
})();
