// Read public search results, keeping only the provider's G-rated GIFs.
export async function findGifs(topic) {
  const terms = [topic,topic+' Christmas',topic+' animation'];
  const results = new Map();
  for (const term of terms) {
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
          if(gif.type==='gif' && gif.rating==='g' && /^[a-zA-Z0-9]+$/.test(gif.id)){
            results.set(gif.id,{id:gif.id,title:gif.title||topic,page:'https://giphy.com/gifs/'+gif.id});
          }
        }
        break;
      }
    }
    if(results.size>=25)break;
  }
  return [...results.values()].slice(0,25);
}
