import { backgrounds } from './backgrounds.js';
// Read public search results, keeping only the provider's G-rated GIFs.
const minionsIds = [
  "8ZhiHOybedTYNLzwY3",
  "23qm0bP9BKEl4PWzP1",
  "5UClVovgaIZw4C8LME",
  "2KA0SDTC5ouZtlsJst",
  "9xnGXhVCUnncukEfeF",
  "yxrRWuLhRwcTgEZ7np",
  "1ircTRaqQV6QPxoQ3n",
  "ZOnQ6uGjpryeHvnhNJ",
  "9S1IzGxhAv6kiemMGu",
  "MUq6r269zoEjKzZYpT",
  "ZBifiUNv4wo5wTfw0z",
  "S2IfEQqgWc0AH4r6Al",
  "Pho3XJf7xlcaMDB4rv",
  "WhT0WYe7EarF0j09a3",
  "5z7AlIxGLiVQxGZ9eZ",
  "chWeOzhXp06L95Ji7e",
  "StKiS6x698JAl9d6cx",
  "chzz1FQgqhytWRWbp3",
  "cKbLJzS0cOTklEmzto",
  "jZC7j19LG8s6zsLnoL",
  "j3z00T0gn1sAErZNZg",
  "jVTaVD2VDeN3r3DdkA",
  "TW5RIonnbxx2Lgn0i1",
  "c2uk5s0d1uhvckPqOB",
  "aqZE8qV5vRQ6UJexo2"
];
export async function findGifs(topic, {needed=25, exclude=new Set()}={}) {
  const category=topic.trim();
  const ignored=new Set('a an and at by for from in into of on or the to with who that they really like likes love loves especially please about showing featuring videos clips pictures gifs'.split(' '));
  const words=text=>String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
  const keywords=[...new Set(words(category).filter(w=>!ignored.has(w)))];
  const stem=w=>w.length>4?w.replace(/(?:ing|es|s)$/,''):w;
  const clauses=category.split(/\band\b/i).map(part=>words(part).filter(w=>!ignored.has(w)).map(stem));
  const combined=clauses.length>1;
  const minions=keywords.some(w=>/^minions?$/.test(w));
  const detailed=keywords.length>1;
  const anchor=minions?keywords.find(w=>/^minions?$/.test(w)):keywords[0];
  const extras=keywords.filter(w=>w!==anchor);
  const specific=detailed?[keywords.slice(0,6).join(' '),[anchor,...extras.slice(-2)].join(' '),[anchor,extras[0]].join(' ')]:[];
  const terms=[...new Set([category,...specific,...(combined?category.split(/\band\b/i).map(s=>s.trim()):[]),anchor].filter(Boolean))];
  const results = new Map();
  function addPrepared(){
    if(minions && !combined)for(const id of minionsIds){
      if(!exclude.has(id)&&!results.has(id))results.set(id,{id,matchType:detailed?'related':'full',title:'Minions animation',page:'https://giphy.com/gifs/'+id});
    }
  }
  const scores=new Map();
  if(!detailed)addPrepared();
  const deadline=Date.now()+15000;
  for (const term of terms) {
    if(Date.now()>=deadline)break;
    if([...results.values()].filter(m=>m.matchType==='full').length>=needed && (!detailed || terms.indexOf(term)>=3))break;
    try {
    const slug=encodeURIComponent(term.trim().replace(/\s+/g,'-'));
    const response=await fetch('https://giphy.com/search/'+slug,{signal:AbortSignal.timeout(Math.max(1,Math.min(3000,deadline-Date.now())))});
    if(!response.ok) continue;
    const page=await response.text();
    for(const match of page.matchAll(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g)){
      const chunk=JSON.parse(match[1]);
      const marker='"initialGifs":';
      const start=chunk.indexOf(marker);
      if(start<0) continue;
      const input=chunk.slice(start+marker.length);
      // Locate the end of the list without interpreting brackets inside JSON strings.
      let depth=0,quoted=false;
      for(let i=0;i<input.length;i++){
        const ch=input[i];
        if(quoted && ch==='\\'){i++;continue}
        if(ch==='"'){quoted=!quoted;continue}
        if(quoted)continue;
        if(ch==='[')depth++;
        if(ch!==']'||--depth!==0)continue;
        for(const gif of JSON.parse(input.slice(0,i+1))){
          if(!exclude.has(gif.id) && gif.type==='gif' && gif.rating==='g' && /^[a-zA-Z0-9]+$/.test(gif.id)){
            const metadata=[gif.title,gif.slug,...(Array.isArray(gif.tags)?gif.tags:[])].filter(Boolean).join(' ');
            const tokens=new Set(words(metadata).map(stem));
            const full=keywords.length>0 && keywords.every(w=>tokens.has(stem(w)));
            if(combined && !clauses.some(clause=>clause.length && clause.every(word=>tokens.has(word))))continue;
            const matches=keywords.filter(w=>tokens.has(stem(w)));
            if(!matches.length)continue;
            const score=(full?1000:0)+matches.length*10+(matches.includes(anchor)?4:0)+(term===category?2:0);
            if(!results.has(gif.id)||score>(scores.get(gif.id)||0)){
              scores.set(gif.id,score);
              results.set(gif.id,{id:gif.id,title:gif.title||topic,page:'https://giphy.com/gifs/'+gif.id,matchType:full?'full':'related',matched:matches});
            }
          }
        }
        break;
      }
    }
    }catch{ /* Continue with the other topic searches if a provider request fails. */ }
    if(!detailed && term===category)addPrepared();
  }
  addPrepared();
  return [...results.values()].sort((a,b)=>(scores.get(b.id)||0)-(scores.get(a.id)||0)).slice(0,needed);
}


export function chooseDoorMedia(found,used,index){
  const clip=found.find(item=>!used.has(item.id));
  if(clip)return clip;
  const scenes=backgrounds.map((_,offset)=>backgrounds[(index+offset)%backgrounds.length]);
  const scene=scenes.find(name=>!used.has('scene:'+name))||scenes[0];
  return {id:'scene:'+scene,scene,title:scene,matchType:'festive'};
}
