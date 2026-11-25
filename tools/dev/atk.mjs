import fs from "node:fs";
const R=new URL("../../",import.meta.url).pathname;
const {createGlobals,createPart,Frame,Gpu,Vram}=await import(R+"js/tearring/unit.js");
const A=R+"assets/tearring/", P=(process.env.TR_ALL||"/tmp/trall")+"/";
const G=createGlobals(JSON.parse(fs.readFileSync(A+"common.json")),new Uint8Array(fs.readFileSync(A+"rsincos.bin")));
const ids=process.argv.slice(2).map(Number); const chunks=[];
for (const n of ids) {
  const id="BU"+String(n).padStart(3,"0"); const vram=new Vram();
  const part=createPart(new Uint8Array(fs.readFileSync(P+id+".pak")),G,vram,{slot:0});
  let hit=-1; part.events.hit=()=>{ if(hit<0) hit=part.tick; };
  part.start(11,160,0); let t=0; const L=part.motion[11].length;
  // tìm tick trúng đòn đầu tiên (hoặc 40% nếu không có)
  while(!part.step()&&t++<L) if(hit>=0) break;
  const target = hit>=0 ? hit : Math.floor(L*0.4);
  part.start(11,160,0); for(let i=0;i<target;i++) part.step();
  const F=new Frame({camX:160,camY:200}); part.draw(F);
  const gpu=new Gpu(vram,{width:320,height:240,mode:"layer"}).run(F); const img=gpu.canvas.image();
  let x0=320,y0=240,x1=0,y1=0; for(let y=0;y<240;y++)for(let x=0;x<320;x++)if(img[(y*320+x)*4+3]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  x1++;y1++; const w=x1-x0,h=y1-y0,d=Buffer.alloc(w*h*4);
  for(let y=0;y<h;y++)Buffer.from(img.buffer,((y0+y)*320+x0)*4,w*4).copy(d,y*w*4);
  const hd=Buffer.alloc(16); hd.writeInt32LE(n,0);hd.writeInt32LE(w,4);hd.writeInt32LE(h,8);hd.writeInt32LE(hit,12); chunks.push(hd,d);
}
fs.writeFileSync("/tmp/atk.bin",Buffer.concat(chunks));
