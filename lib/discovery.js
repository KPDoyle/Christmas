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
export async function findGifs(topic, {style='', needed=25, exclude=new Set()}={}) {
  const category=topic.trim();
  const minions=/^minions?$/i.test(category);
  const pref={Humorous:'funny',Heartwarming:'heartwarming',Playful:'playful',Scenic:'scenic'}[style];
  const terms=[...(pref?[category+' '+pref]:[]),category,category+' Christmas',category+' animation',...(minions?['despicable me minions']:[])];
  const results = new Map();
  function addPrepared(){
    if(minions)for(const id of minionsIds){
      if(!exclude.has(id)&&!results.has(id))results.set(id,{id,title:'Minions animation',page:'https://giphy.com/gifs/'+id});
    }
  }
  if(!pref)addPrepared();
  for (const term of terms) {
    if(results.size>=needed)break;
    try {
    const slug=encodeURIComponent(term.trim().replace(/\s+/g,'-'));
    const response=await fetch('https://giphy.com/search/'+slug,{signal:AbortSignal.timeout(7000)});
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
            results.set(gif.id,{id:gif.id,title:gif.title||topic,page:'https://giphy.com/gifs/'+gif.id});
          }
        }
        break;
      }
    }
    }catch{ /* Continue with the other topic searches if a provider request fails. */ }
    if(term===category)addPrepared();
  }
  return [...results.values()].slice(0,needed);
}
