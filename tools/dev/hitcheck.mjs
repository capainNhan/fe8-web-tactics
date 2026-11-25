import fs from "node:fs";
const R=new URL("../../",import.meta.url).pathname;
const {createGlobals,createPart,Frame,Gpu,Vram}=await import(R+"js/tearring/unit.js");
const A=R+"assets/tearring/";
const G=createGlobals(JSON.parse(fs.readFileSync(A+"common.json")),new Uint8Array(fs.readFileSync(A+"rsincos.bin")));
const out=[]; const rows=[];
for (const [id,mot] of [["BU016",11],["BU027",11],["BU051",11],["BU212",11],["BU016",12],["BU016",19]]) {
  const vram=new Vram(); const part=createPart(new Uint8Array(fs.readFileSync(A+id+".pak")),G,vram,{slot:0,shadow:true});
  const hit=part.bset.dv.getUint16({11:0x14,12:0x16,19:0x18}[mot],true);
  const frames=[];
  for (const dt of [-10,-5,0,5,12]) {
    part.start(mot,0,part.bset.y); const target=Math.max(0,hit+dt); for(let i=0;i<target;i++) part.step();
    const F=new Frame({camX:0,camY:160}); part.draw(F);
    const bd=new Uint8ClampedArray(320*160*4); for(let i=0;i<bd.length;i+=4){bd[i]=38;bd[i+1]=59;bd[i+2]=85;bd[i+3]=255}
    const gpu=new Gpu(vram,{width:320,height:160,mode:"backdrop",backdrop:bd}).run(F); frames.push(Buffer.from(gpu.canvas.px.buffer.slice(0)));
  }
  rows.push(Buffer.concat(frames)); console.log(id,"mot",mot,"hit tick",hit,"len",part.motion[mot].length);
}
fs.writeFileSync("/tmp/hit.rgba",Buffer.concat(rows));
