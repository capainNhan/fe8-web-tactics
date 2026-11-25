import fs from "node:fs";
const R=new URL("../../",import.meta.url).pathname;
const {createGlobals,createPart,Vram}=await import(R+"js/tearring/unit.js");
const {pathEval}=await import(R+"js/tearring/path.js");
const A=R+"assets/tearring/";
const G=createGlobals(JSON.parse(fs.readFileSync(A+"common.json")),new Uint8Array(fs.readFileSync(A+"rsincos.bin")));
for (const u of ["004","030","052"]) {
  const part=createPart(new Uint8Array(fs.readFileSync(A+`BU${u}.pak`)),G,new Vram(),{slot:0});
  const out=[];
  for (const name of part.availableMotions.sort()) {
    const [,g,k]=/^M(\d+)_(\d+)/.exec(name).map(Number);
    if (g===2) continue;
    part.start(g*11+k,0,0); let n=0,minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9,lastx=0; const m=part.motion[g*11+k]; const o={x:0,y:0,angle:0};
    while(!part.step()&&n++<1000){ const c=m.ch[0]; if(!c.active) continue; pathEval(c,o); minx=Math.min(minx,o.x);maxx=Math.max(maxx,o.x);miny=Math.min(miny,o.y);maxy=Math.max(maxy,o.y); lastx=o.x; }
    out.push(`${name.slice(0,-2)} x[${minx},${maxx}] y[${miny},${maxy}] end.x=${lastx}`);
  }
  console.log("BU"+u+": "+out.join(" | "));
}
