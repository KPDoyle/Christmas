import { get, list, put } from '@vercel/blob';
import { createHmac } from 'node:crypto';
import { collections, getCard } from '../lib/postcards.js';
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
  if (req.query.card === '1') return res.json(getCard(Object.hasOwn(collections,req.query.topic) ? req.query.topic : await selectedTopic(), day));
  const photo = await get(path,{access:'private',useCache:false});
  if (photo?.statusCode!==200) return res.status(404).send('A photo has yet to arrive for this door.');
  res.setHeader('Content-Type','image/jpeg');
  res.send(Buffer.from(await new Response(photo.stream).arrayBuffer()));
}
