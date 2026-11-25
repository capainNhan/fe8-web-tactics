import fs from "node:fs";
const R=new URL("../../",import.meta.url).pathname;
const {createGlobals,createPart,Frame,Gpu,Vram}=await import(R+"js/tearring/unit.js");
const A=R+"assets/tearring/", P=(process.env.TR_ALL||"/tmp/trall")+"/";
const G=createGlobals(JSON.parse(fs.readFileSync(A+"common.json")),new Uint8Array(fs.readFileSync(A+"rsincos.bin")));
const bbox=(part,vram)=>{const F=new Frame({camX:160,camY:200}); part.draw(F); const img=new Gpu(vram,{width:320,height:240,mode:"layer"}).run(F).canvas.image(); let x0=999,x1=-1,mass=0,cx=0;
  for(let y=0;y<240;y++)for(let x=0;x<320;x++)if(img[(y*320+x)*4+3]>40){ if(x<x0)x0=x; if(x>x1)x1=x; }
  return [x0,x1];};
for (const n of process.argv.slice(2).map(Number)) {
  const id="BU"+String(n).padStart(3,"0"), vram=new Vram();
  const part=createPart(new Uint8Array(fs.readFileSync(P+id+".pak")),G,vram,{slot:0});
  part.start(0,160,0); const [i0,i1]=bbox(part,vram);
  part.start(11,160,0); let u0=i0,u1=i1; const L=part.motion[11].length;
  for(let t=0;t<L;t++){ const [a,b]=bbox(part,vram); if(a<999){u0=Math.min(u0,a);u1=Math.max(u1,b);} part.step(); }
  const extL=i0-u0, extR=u1-i1;
  console.log(id, "idle x",i0,i1,"| atk reach L",extL,"R",extR,"=>",extL>extR?"left":"right", "| M1_0 len",L, "| M0_1",part.motion[1].length,"M0_4",part.motion[4].length,"crit",!!part.motion[19]);
}
