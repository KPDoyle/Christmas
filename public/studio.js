(()=>{
if(!params.has('admin'))return;
document.addEventListener('click',event=>{
  const button=event.target.closest?.('#studio button,#editor button,#adminHome');
  if(button && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    button.animate([{transform:'translateY(2px)'},{transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
  }
},true);
const studio=el('studio'),status=el('studioStatus');
const previewScene=document.querySelector('.street-scroll');
el('studioPreviewHeading').hidden=false;
previewScene.setAttribute('role','region');
previewScene.setAttribute('aria-labelledby','studioPreviewTitle');
previewScene.removeAttribute('aria-label');
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
  if(warn)studio.prepend(note);else el('accountSettings').append(note);
}).catch(()=>{});
let current=null,busy=false,activeDay=1,pendingBackgroundFile=null,pendingBackgroundUrl='';
let creatingCalendar=false;
function updatePreviewContext(){
  const drafting=!current && (creatingCalendar || (calendarBaseline && calendarChanged()));
  const kind=current?'saved':drafting?'draft':'sample';
  setStudioPreview(kind,current?.id||'');
  el('studioPreviewTitle').textContent=current?'Calendar preview · '+current.email:
    drafting?'New calendar preview':'Sample calendar preview';
}
el('recipientForm').addEventListener('input',updatePreviewContext);
el('recipientForm').addEventListener('change',updatePreviewContext);
let activeSection='recipientForm';
const sectionButtons=Array.from(el('studioSections').querySelectorAll('button'));
function showSection(id){
  activeSection=id;
  for(const button of sectionButtons){
    const selected=button.dataset.section===id;
    el(button.dataset.section).hidden=!selected;
    if(selected)button.setAttribute('aria-current','step');
    else button.removeAttribute('aria-current');
  }
}
for(const button of sectionButtons)button.onclick=()=>showSection(button.dataset.section);
const drafts=new Map();
const windowFields=['dayNote'];
const calendarFields=['recipientEmail','categories','calBg','recipientName','senderName','dedication'];
let calendarBaseline='';
const values=fields=>fields.map(id=>el(id).value);
const applyValues=(fields,data)=>fields.forEach((id,i)=>{el(id).value=data[i]});
const calendarChanged=()=>JSON.stringify(values(calendarFields))!==calendarBaseline;
function trackWindow(){
  if(!current)return;
  const d=current.doors[activeDay-1], data=values(windowFields);
  if(JSON.stringify(data)===JSON.stringify([d.note||'']))drafts.delete(activeDay);
  else drafts.set(activeDay,data);
  el('saveNote').disabled=!drafts.has(activeDay);
  updateDraftStatus();
}
function updateDraftStatus(){
  el('draftStatus').textContent=drafts.size?'Unsaved windows: '+[...drafts.keys()].sort((a,b)=>a-b).join(', ')+'. Select a window and use Save note.':'';
}
el('doorForm').addEventListener('input',event=>{if(windowFields.includes(event.target.id))trackWindow()});
function hasEdits(){return drafts.size>0||(calendarBaseline&&calendarChanged())}
window.addEventListener('beforeunload',event=>{if(hasEdits()){event.preventDefault();event.returnValue=''}});

async function api(id,options={},day,extra={}){
  const q=new URLSearchParams();
  if(id)q.set('id',id);if(day)q.set('day',day);
  for(const [key,value] of Object.entries(extra))q.set(key,value);
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
function previewLetter(){
  const name=el('recipientName').value.trim(),sender=el('senderName').value.trim(),message=el('dedication').value.trim();
  el('studioPreviewLetter').hidden=!(name||sender||message);
  el('previewTo').textContent=name?'To '+name:'';
  el('previewMessage').textContent=message;
  el('previewFrom').textContent=sender;
}
for(const id of ['recipientName','senderName','dedication'])el(id).addEventListener('input',previewLetter);
function previewArt(){
  previewLetter();
  const selected=el('calBg').value;
  if(!selected)return;
  const theme=themeImage(selected);
  const imageUrl=pendingBackgroundUrl||(current?.customBackground&&current.customBackgroundUrl)||('/hd/'+theme+'.webp');
  street.style.setProperty('--street','url("'+imageUrl+'")');
  street.dataset.theme=pendingBackgroundUrl||current?.customBackground?'custom':theme;
  el('calendarArt').src=imageUrl;
  el('calendarArt').alt=pendingBackgroundUrl||current?.customBackground?'Your uploaded background':selected;
}
el('calBg').addEventListener('change',previewArt);
el('animationMode').onclick=()=>{
  clearChoices();
  el('animationMode').setAttribute('aria-expanded','true');
  el('animationResults').hidden=false;
  el('animationFeedback').textContent='';
  el('saveAnimation').hidden=true;
  const query=el('animationQuery');
  query.value=current.doors[activeDay-1].category;
  query.focus();query.select();
};
el('searchAnimations').onclick=browseAnimations;
el('animationQuery').onkeydown=event=>{
  if(event.key==='Enter'&&!event.isComposing){event.preventDefault();browseAnimations()}
};
el('cancelAnimation').onclick=()=>{clearChoices();el('animationMode').focus()};
for(const [id,step] of [['prevDay',-1],['nextDay',1]]){
  el(id).onclick=()=>{el('editDay').value=String(activeDay+step);door()};
}
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
  clearChoices();
  el('recipientFilename').textContent='';
  if(!current)return;
  activeDay=Number(el('editDay').value);
  el('prevDay').disabled=activeDay===1;
  el('nextDay').disabled=activeDay===current.doors.length;
  el('mediaHeading').textContent=activeDay+' December · Window content';
  el('saveNote').disabled=!drafts.has(activeDay);
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
  el('clearCustomBackground').hidden=!c?.customBackground;
  el('customBackgroundStatus').textContent=c?.customBackground?'Your uploaded background is being used.':'';
  el('openStudioPreview').hidden=!c;
  current=c;el('recipientEmail').value=c?.email||'';el('categories').value=formatInterests(c?.interests||[]);
  backgroundsMenu.value=defaultCalendarScene;
  el('studioSections').hidden=!c;
  showSection(c?activeSection:'recipientForm');
  el('delivery').hidden=!c;el('library').value=c?.id||'';
  el('build').textContent=c?'Save calendar changes':'Create calendar';
  if(!c){calendarBaseline=JSON.stringify(values(calendarFields));updatePreviewContext();previewArt();return;}
  el('calBg').value=c.background;
  updatePreviewContext();
  calendarBaseline=JSON.stringify(values(calendarFields));
  el('matchGrid').replaceChildren(...c.doors.map((d,i)=>{
    const tile=document.createElement('button');tile.type='button';tile.className='matchTile';
    const image=new Image();image.loading='lazy';image.alt='';image.src=mediaUrl(d.media,true);
    const name=document.createElement('span');name.textContent=(i+1)+' Dec · '+d.category;
    tile.append(image,name);
    if(d.media.matchType){const label=document.createElement('small');label.textContent=({full:'Full interest match',related:'Related interest',festive:'Christmas artwork'})[d.media.matchType];tile.append(label)}
    if(d.media.matched?.length){const tags=document.createElement('small');tags.textContent='Matched: '+d.media.matched.join(', ');tile.append(tags)}
    tile.onclick=()=>{el('editDay').value=String(i+1);door();el('matches').open=false;el('editDay').focus()};
    return tile;
  }));
  for(const [day,src] of doorPhotos)updatePhotoTile(day,src);
  const url=shareOrigin+'/#calendar='+c.invite;
  el('inviteUrl').value=url;el('previewInvite').href='/#calendar='+c.test+'&preview=1';
  el('openStudioPreview').href=el('previewInvite').href;
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
  const c=id?await api(id):null;creatingCalendar=!id;drafts.clear();el('editDay').value='1';activeSection='recipientForm';display(c);status.textContent='';
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
    creatingCalendar=false;display(null);el('recipientEmail').focus();
    status.textContent='Calendar deleted for '+selected.email+'.';
  });
};
async function uploadCustomBackground(file){
  const source=URL.createObjectURL(file);
  try{
    const image=new Image();image.src=source;await image.decode();
    const scale=Math.min(1,2000/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const encoded=canvas.toDataURL('image/jpeg',.82).split(',')[1];
    if(encoded.length>3400000)throw Error('This image is too large. Choose a smaller image.');
    return api(current.id,post({backgroundPhoto:encoded,version:current.version}),undefined,{background:'1'});
  }finally{URL.revokeObjectURL(source)}
}
el('customBackgroundFile').onchange=event=>{
  const file=event.target.files?.[0];if(!file)return;
  pendingBackgroundFile=file;
  if(pendingBackgroundUrl)URL.revokeObjectURL(pendingBackgroundUrl);
  pendingBackgroundUrl=URL.createObjectURL(file);
  previewArt();
  el('customBackgroundStatus').textContent=current?'Uploading your background…':'Your image will upload when you create the calendar.';
  if(current)work(async()=>{
    const saved=await uploadCustomBackground(file);
    pendingBackgroundFile=null;URL.revokeObjectURL(pendingBackgroundUrl);pendingBackgroundUrl='';
    display(saved);el('customBackgroundStatus').textContent='Your uploaded background is being used.';
  });
};
el('clearCustomBackground').onclick=()=>work(async()=>{
  if(!current)return;
  const saved=await api(current.id,post({clearCustomBackground:true,version:current.version}),undefined,{background:'1'});
  display(saved);status.textContent='Using the selected background scene.';
});
el('recipientForm').onsubmit=e=>{e.preventDefault();work(async()=>{
  status.textContent='Finding content and preparing the calendar…';
  const data={recipientName:el('recipientName').value,senderName:el('senderName').value,dedication:el('dedication').value,email:el('recipientEmail').value,interests:parseInterests(el('categories').value),background:el('calBg').value,version:current?.version};
  const creating=!current;
  display(await api(current?.id,post(data)));
  if(creating){showSection('windowSection');requestAnimationFrame(()=>el('editDay').focus())}
  if(pendingBackgroundFile){
    el('customBackgroundStatus').textContent='Uploading your background…';
    const saved=await uploadCustomBackground(pendingBackgroundFile);
    pendingBackgroundFile=null;if(pendingBackgroundUrl)URL.revokeObjectURL(pendingBackgroundUrl);pendingBackgroundUrl='';
    display(saved);
  }
  status.textContent='Calendar saved. Your private invitation is ready.';
})};
el('editDay').onchange=door;
let options=[],selectedOption=null,resultsTopic='';
function clearChoices(){
  options=[];selectedOption=null;
  el('savedView').hidden=false;
  el('animationMode').setAttribute('aria-expanded','false');
  el('animationResults').hidden=true;
  el('animationChoices').replaceChildren();
  el('candidatePreview').hidden=true;
  el('candidatePreview').removeAttribute('src');
  el('saveAnimation').disabled=true;
}
function browseAnimations(){
  const topic=el('animationQuery').value.trim();
  clearChoices();
  el('animationResults').hidden=false;
  el('animationMode').setAttribute('aria-expanded','true');
  el('saveAnimation').hidden=true;
  if(!topic){el('animationFeedback').textContent='Enter a topic to search.';el('animationQuery').focus();return}
  el('animationFeedback').textContent='Searching…';
  work(async()=>{
    status.textContent='Finding animations…';
    let result;
    try{result=await api(current.id,post({browse:true,category:topic,version:current.version}),activeDay)}
    catch(error){el('animationFeedback').textContent=error.message;status.textContent='';return}
    resultsTopic=topic;
    options=result.options;
    el('animationMode').setAttribute('aria-expanded','true');
    el('animationResults').hidden=false;
    el('animationFeedback').textContent=options.length?'Choose an animation for “'+topic+'”.':'No matches for “'+topic+'”. Try another topic.';
    el('saveAnimation').hidden=!options.length;
    el('animationChoices').replaceChildren(...options.map((option,index)=>{
      const label=document.createElement('label');
      const radio=document.createElement('input');
      radio.type='radio';radio.name='animationChoice';
      radio.setAttribute('aria-label',(index+1)+'. '+(option.media.title||topic));
      const img=new Image();img.alt='';img.loading='lazy';img.src=mediaUrl(option.media,true);
      radio.onchange=()=>{
        selectedOption=option;
        el('savedView').hidden=true;
        el('candidatePreview').src=mediaUrl(option.media);
        el('candidatePreview').hidden=false;
        el('saveAnimation').disabled=false;
        el('animationFeedback').textContent='Previewing animation '+(index+1)+' of '+options.length;
        label.scrollIntoView({block:'nearest',inline:'nearest'});
      };
      label.append(radio,img);return label;
    }));
    status.textContent='';
  });
}
function saveWindow(selection){
  return work(async()=>{
    const door=current.doors[activeDay-1];
    const category=selection?resultsTopic:door.category;
    const data={note:selection?door.note:el('dayNote').value,category,background:door.background,selection,version:current.version};
    const pendingCalendar=calendarChanged()?values(calendarFields):null;
    const saved=await api(current.id,post(data),activeDay);
    if(selection)updatePhotoTile(activeDay,mediaUrl(saved.doors[activeDay-1].media));
    else drafts.delete(activeDay);
    display(saved);
    if(pendingCalendar){applyValues(calendarFields,pendingCalendar);previewArt()}
    status.textContent=selection?'Selected animation saved to this window.':'Personal note saved.';
  });
}
el('doorForm').onsubmit=e=>{e.preventDefault();saveWindow(null)};
el('saveAnimation').onclick=()=>{if(selectedOption)saveWindow(selectedOption)};
el('copyInvite').onclick=async()=>{try{await navigator.clipboard.writeText(el('inviteUrl').value);status.textContent='Invitation copied.'}catch{el('inviteUrl').select();status.textContent='Copy the selected invitation.'}};
el('recipientPhoto').onchange=e=>{const file=e.target.files[0];if(!file)return;clearChoices();++photoRequest;showPhoto(file);el('recipientFilename').textContent='Uploading '+file.name+'…';work(async()=>{
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
  el('calBg').replaceChildren(...Object.entries(data.backgroundGroups).map(([label,scenes])=>{
    const group=document.createElement('optgroup');group.label=label;
    group.append(...scenes.map(scene=>new Option(scene,scene)));return group;
  }));
  for(let i=1;i<=25;i++)el('editDay').add(new Option(i+' December',String(i)));
  for(const c of data.calendars)el('library').add(new Option(c.email+' · '+c.id.slice(-6),c.id));
  const edit=params.get('edit');
  if(edit && data.calendars.some(c=>c.id===edit))await open(edit);else display(null);
}).catch(e=>{studio.hidden=false;status.textContent=e.message});
})();
