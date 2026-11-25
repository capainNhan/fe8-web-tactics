import fs from "node:fs";
const R=new URL("../../",import.meta.url).pathname;
const {createGlobals,createPart,Frame,Gpu,Vram}=await import(R+"js/tearring/unit.js");
const A=R+"assets/tearring/", P=(process.env.TR_ALL||"/tmp/trall")+"/";
const G=createGlobals(JSON.parse(fs.readFileSync(A+"common.json")),new Uint8Array(fs.readFileSync(A+"rsincos.bin")));
const meta={}, chunks=[];
for (const f of fs.readdirSync(P).filter(n=>/^BU\d+\.pak$/.test(n)).sort()) {
  const id=f.slice(0,5);
  try {
    const vram=new Vram();
    const part=createPart(new Uint8Array(fs.readFileSync(P+f)),G,vram,{slot:0});
    const has=k=>!!part.motion[k];
    const m=part.availableMotions.map(n=>n.slice(0,-2)).sort();
    const info={m, flags:part.bset.flags0, x:part.bset.x, y:part.bset.y, len:{}};
    for (const k of [0,1,4,11,12,19]) if (has(k)) info.len[k]=part.motion[k].length;
    meta[id]=info;
    if (!(has(0)&&has(1)&&has(4)&&has(11))) continue;
    part.start(0,160,0);
    const F=new Frame({camX:160,camY:200});
    part.draw(F);
    const gpu=new Gpu(vram,{width:320,height:240,mode:"layer"}).run(F);
    const img=gpu.canvas.image(); let x0=320,y0=240,x1=0,y1=0;
    for(let y=0;y<240;y++)for(let x=0;x<320;x++)if(img[(y*320+x)*4+3]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    if(x1<x0) continue;
    x1++;y1++; const w=x1-x0,h=y1-y0,d=Buffer.alloc(w*h*4);
    for(let y=0;y<h;y++)Buffer.from(img.buffer,((y0+y)*320+x0)*4,w*4).copy(d,y*w*4);
    const hd=Buffer.alloc(12); hd.writeInt32LE(+id.slice(2),0); hd.writeInt32LE(w,4); hd.writeInt32LE(h,8);
    chunks.push(hd,d);
  } catch(e){ meta[id]={err:String(e.message)}; }
}
fs.writeFileSync("/tmp/survey.bin",Buffer.concat(chunks)); fs.writeFileSync("/tmp/survey_meta.json",JSON.stringify(meta));
console.log(Object.keys(meta).length,"unit,",chunks.length/2,"có đủ motion M0_0/M0_1/M0_4/M1_0");
