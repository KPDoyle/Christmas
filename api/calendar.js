import { get, list, put } from '@vercel/blob';
import { gifs } from '../lib/gifs.js';
import { findGifs } from '../lib/discovery.js';
import { createHash, createHmac } from 'node:crypto';
import { collections } from '../lib/postcards.js';
const settingsPath = 'settings/2026-topic.txt';
async function selectedTopic() {
  const result = await get(settingsPath, {access:'private',useCache:false});
  if (result?.statusCode !== 200) return 'kitchen';
  const topic = await new Response(result.stream).text();
  return Object.hasOwn(collections, topic) ? topic : 'kitchen';
}
const prefix = 'christmas-2026/';
export default async function handler(req, res) {
  res.setHeader('Cache-Control','private, no-store');
  const key = process.env.CALENDAR_KEY;
  if (!key) return res.status(503).send('Calendar unavailable');
  const guest = createHmac('sha256',key).update('guest').digest('base64url');
  const previewKey = createHmac('sha256',key).update('2026-preview').digest('base64url');
  const token = req.headers.authorization?.replace(/^Bearer /,'');
  const admin = token === key;
  const preview = token === previewKey;
  const unlocked = preview ? 25 : Math.max(0, Math.min(25, 1 + Math.floor((Date.now()-Date.UTC(2026,11,1))/86400000)));
  if(req.method==='POST' && req.query.discover==='1'){
    if(!admin)return res.status(403).end();
    const name=String(req.body?.name||'').trim();
    if(name.length<2 || name.length>60)return res.status(400).send('Enter a topic of 2 to 60 characters.');
    const id='custom-'+createHash('sha256').update(name.toLowerCase()).digest('hex').slice(0,32);
    const path='topics/'+id+'.json';
    const existing=await get(path,{access:'private',useCache:false});
    if(existing?.statusCode===200)return res.json({id,name});
    let clips;
    try{clips=await findGifs(name)}catch{return res.status(503).send('GIF search is unavailable. Try again or choose a prepared topic.')}
    if(clips.length!==25)return res.status(422).send('Fewer than 25 suitable GIFs were found. Try a broader topic.');
    await put(path,JSON.stringify({name,clips}),{access:'private',allowOverwrite:true,contentType:'application/json'});
    return res.json({id,name});
  }
  if (req.method === 'PUT' && !req.query.day) {
    if (!admin) return res.status(403).end();
    const topic = req.body?.topic;
    if (typeof topic !== 'string' || !Object.hasOwn(collections, topic)) return res.status(400).end();
    await put(settingsPath,topic,{access:'private',allowOverwrite:true,cacheControlMaxAge:60});
    return res.json({topic});
  }
  if (!req.query.day && req.method === 'GET') {
    if (!admin) return res.json({unlocked, preview});
    const { blobs } = await list({prefix});
    return res.json({unlocked, guest, previewKey, topic:await selectedTopic(), topics:Object.entries(collections).map(([id,c])=>({id,name:c.name})), filled:blobs.map(b=>Number(b.pathname.slice(prefix.length,-4)))});
  }
  const day = Number(req.query.day);
  if (!Number.isInteger(day) || day<1 || day>25) return res.status(400).send('Invalid day');
  const path = prefix + day + '.jpg';
  if (req.method === 'POST') {
    if (!admin) return res.status(403).send('Admin access required');
    const data = Buffer.from(typeof req.body?.photo === 'string' ? req.body.photo : '', 'base64');
    if (data.length > 2500000 || data[0]!==255 || data[1]!==216) return res.status(400).send('Choose a smaller JPEG photo');
    await put(path,data,{access:'private',allowOverwrite:true,contentType:'image/jpeg',cacheControlMaxAge:60});
    return res.json({saved:true});
  }
  if (req.method !== 'GET') return res.status(405).end();
  if (!admin && !preview && token !== guest) return res.status(403).send('Open your invitation link to see the photos.');
  if (!admin && day>unlocked) return res.status(423).send('Opens on '+day+' December.');
  if(req.query.card==='1'){
    const requested=req.query.topic;
    if(/^custom-[a-f0-9]{32}$/.test(requested)){
      const saved=await get('topics/'+requested+'.json',{access:'private',useCache:false});
      if(saved?.statusCode!==200)return res.status(404).send('Topic unavailable');
      const collection=await new Response(saved.stream).json();
      return res.json({topic:collection.name,media:collection.clips[day-1]});
    }
    const topic=Object.hasOwn(collections,requested)?requested:await selectedTopic();
    return res.json({topic:collections[topic].name,media:gifs[topic][day-1]});
  }
  const photo = await get(path,{access:'private',useCache:false});
  if (photo?.statusCode!==200) return res.status(404).send('A photo has yet to arrive for this door.');
  res.setHeader('Content-Type','image/jpeg');
  res.send(Buffer.from(await new Response(photo.stream).arrayBuffer()));
}
