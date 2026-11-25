import fs from "node:fs";
const R=new URL("../../",import.meta.url).pathname;
const {createGlobals,createPart,Vram}=await import(R+"js/tearring/unit.js");
const A=R+"assets/tearring/";
const G=createGlobals(JSON.parse(fs.readFileSync(A+"common.json")),new Uint8Array(fs.readFileSync(A+"rsincos.bin")));
for (const id of process.argv.slice(2)) {
  const part=createPart(new Uint8Array(fs.readFileSync(A+id+".pak")),G,new Vram(),{slot:0});
  const out=[];
  for (const m of [0,1,2,4,7,8,10,11,12,19]) {
    if(!part.motion[m]) continue;
    const ev=[]; part.events.delay=v=>ev.push(`${part.tick}:d${v}`); part.events.hit=()=>ev.push(`${part.tick}:H`);
    part.events.e02=()=>ev.push(`${part.tick}:e02`); part.events.e20=()=>ev.push(`${part.tick}:e20`); part.events.e40=()=>ev.push(`${part.tick}:e40`);
    part.start(m,0,0); let n=0; while(!part.step()&&n++<1000);
    out.push(`M${Math.floor(m/11)}_${m%11}(len ${part.motion[m].length}): ${ev.join(" ")||"-"}`);
  }
  console.log(id+"\n  "+out.join("\n  "));
}
