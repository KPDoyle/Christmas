import {get,put,list} from '@vercel/blob';
import {randomBytes,createHmac} from 'node:crypto';
import {findGifs} from '../lib/discovery.js';

const styles=['Traditional','Humorous','Heartwarming','Playful','Scenic'];
const backgrounds=['Dickensian London','Victorian Christmas market','Snowy coaching inn'];
const prefix='recipient-calendars/';
const pathFor=id=>prefix+id+'.json';
const signature=(id,role)=>createHmac('sha256',process.env.CALENDAR_KEY).update(role+'/'+id).digest('base64url');
function view(c){
  return {...c,invite:c.id+'.'+signature(c.id,'invite'),test:c.id+'.'+signature(c.id,'preview')};
}
async function read(path){
  const b=await get(path,{access:'private',useCache:false});
  return b?.statusCode===200?new Response(b.stream).json():null;
}
const bad=message=>Object.assign(new Error(message),{status:400});
function requireChoice(value,options){
  if(!options.includes(value))throw bad('Choose a listed style.');
  return value;
}
function categories(value){
  if(!Array.isArray(value)||!value.length||value.length>8||value.some(s=>typeof s!=='string'||!s.trim()||s.length>60))throw bad('Enter one to eight interests, up to 60 characters each.');
  return [...new Set(value.map(s=>s.trim()))];
}
async function populate(doors,indexes){
  const groups=new Map();
  for(const i of indexes){
    const d=doors[i],key=d.category+' '+d.style;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(i);
  }
  const used=new Set(doors.filter((_,i)=>!indexes.includes(i)).map(d=>d.media?.id));
  await Promise.all([...groups].map(async ([term,slots])=>{
    const first=doors[slots[0]];
    const found=await findGifs(first.category,{style:first.style,needed:25,exclude:used});
    for(const i of slots){
      const clip=found.find(m=>!used.has(m.id));
      if(!clip)throw bad('Too few distinct results for “'+term+'”. Try a broader category or another style.');
      doors[i].media=clip;used.add(clip.id);
    }
  }));
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(!process.env.CALENDAR_KEY)return res.status(503).end();
  const auth=req.headers.authorization?.replace(/^Bearer /,'')||'';
  const admin=auth===process.env.CALENDAR_KEY;
  const [linkId,sig]=auth.split('.');
  const id=admin?req.query.id:linkId;
  const validId=typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
  const test=!admin&&validId&&sig===signature(id,'preview');
  if(!admin&&(!validId||(!test&&sig!==signature(id,'invite'))))return res.status(403).end();
  try{
    if(id&&!validId)throw bad('Invalid calendar.');
    if(req.method==='GET'&&admin&&!id){
      let cursor;const calendars=[];
      do{
        const batch=await list({prefix,limit:100,cursor});
        const items=await Promise.all(batch.blobs.map(b=>read(b.pathname)));
        calendars.push(...items.filter(Boolean).map(c=>({id:c.id,email:c.email})));
        cursor=batch.hasMore?batch.cursor:null;
      }while(cursor);
      return res.json({calendars,styles,backgrounds});
    }
    const c=id?await read(pathFor(id)):null;
    if(id&&!c)return res.status(404).send('Calendar not found.');
    const day=Number(req.query.day);
    if(req.query.day&&(!Number.isInteger(day)||day<1||day>25))throw bad('Invalid door.');
    const unlocked=admin||test?25:Math.max(0,Math.min(25,1+Math.floor((Date.now()-Date.UTC(2026,11,1))/86400000)));
    if(req.method==='GET'){
      if(day){
        if(day>unlocked)return res.status(423).end();
        const door=c.doors[day-1];
        if(req.query.card==='1')return res.json({topic:door.category,media:door.media,background:door.background||c.background});
        const photo=await get('recipient-photos/'+id+'/'+day+'.jpg',{access:'private',useCache:false});
        if(photo?.statusCode!==200)return res.status(404).end();
        res.setHeader('Content-Type','image/jpeg');return res.send(Buffer.from(await new Response(photo.stream).arrayBuffer()));
      }
      return res.json(admin?view(c):{unlocked,preview:test,background:c.background});
    }
    if(!admin)return res.status(403).end();
    if(req.method==='POST'&&day&&c&&typeof req.body?.photo==='string'){
      const bytes=Buffer.from(String(req.body?.photo||''),'base64');
      if(bytes.length>2500000||bytes[0]!==255||bytes[1]!==216)throw bad('Choose a JPEG photo.');
      await put('recipient-photos/'+id+'/'+day+'.jpg',bytes,{access:'private',allowOverwrite:true,contentType:'image/jpeg'});
      return res.json({saved:true});
    }
    if(req.method!=='POST')return res.status(405).end();
    const input=req.body||{};
    if(c&&input.version!==c.version)return res.status(409).send('Calendar changed. Reopen it before saving.');
    let next;
    if(day){
      if(!c)throw bad('Select a calendar.');
      const category=categories([input.category])[0],style=requireChoice(input.style,styles);
      const old=c.doors[day-1];
      const background=input.background?requireChoice(input.background,backgrounds):'';
      next={...c,doors:[...c.doors]};
      next.doors[day-1]={...old,category,style,background,custom:true};
      if(category!==old.category||style!==old.style||input.replace)await populate(next.doors,[day-1]);
    }else{
      const email=String(input.email||'').trim();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw bad('Enter a valid email.');
      const interests=categories(input.interests),style=requireChoice(input.style,styles),background=requireChoice(input.background,backgrounds);
      const indexes=[];
      const doors=Array.from({length:25},(_,i)=>{
        const old=c?.doors[i],category=interests[i%interests.length];
        if(old&&(old.custom||(old.category===category&&old.style===style)))return old;
        indexes.push(i);return {category,style,background:'',custom:false};
      });
      await populate(doors,indexes);
      next={id:c?.id||randomBytes(16).toString('hex'),email,interests,style,background,doors};
    }
    next.version=randomBytes(12).toString('hex');
    // Detect an intervening edit while online search was running.
    if(c&&(await read(pathFor(id)))?.version!==c.version)return res.status(409).send('Calendar changed. Reopen it before saving.');
    await put(pathFor(next.id),JSON.stringify(next),{access:'private',allowOverwrite:!!c,contentType:'application/json'});
    return res.json(view(next));
  }catch(e){return res.status(e.status||503).send(e.status?e.message:'Calendar or content search temporarily unavailable. Please retry.')}
}