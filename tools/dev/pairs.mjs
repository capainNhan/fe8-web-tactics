import fs from "node:fs";
const R=new URL("../../",import.meta.url).pathname;
globalThis.ImageData=class{constructor(d,w,h){this.data=d;this.width=w;this.height=h}};
globalThis.Phaser={Textures:{FilterMode:{NEAREST:0}},Scenes:{Events:{UPDATE:"u",SHUTDOWN:"s"}}};
const {TearRingStage}=await import(R+"js/tearring/stage.js"); const {TEARRING_UNITS,MOTION}=await import(R+"js/data/tearringUnits.js");
const A=R+"assets/tearring/"; const common=JSON.parse(fs.readFileSync(A+"common.json")); const rs=new Uint8Array(fs.readFileSync(A+"rsincos.bin"));
const pak=id=>new Uint8Array(fs.readFileSync(A+id+".pak"));
const snaps=[];
for (const [a,b] of [["BU016","BU051"],["BU038","BU061"],["BU002","BU081"],["BU027","BU212"],["BU190","BU204"],["BU224","BU218"]]) {
  let last; const L={};
  const scene={textures:{exists:()=>false,remove(){},createCanvas:()=>({setFilter(){},refresh(){},getContext:()=>({putImageData:im=>last=Uint8ClampedArray.from(im.data)})})}, events:{on:(e,f)=>L[e]=f,once(){},off(){}}, time:{delayedCall:(m,f)=>setTimeout(f,m)}};
  const st=new TearRingStage(scene,{assets:{common,rsincos:rs,paks:[pak(a),pak(b)]},units:[a,b],config:TEARRING_UNITS});
  st.actors.left.loop(0); st.actors.right.loop(0);
  const step=n=>{for(let i=0;i<n;i++)L.u(0,st.tickMs+0.001)};
  step(10); snaps.push(last);
  st.actors.left.play(MOTION.attack); step(Math.floor(st.actors.left.part.motion[11].length*0.45)); snaps.push(last);
}
fs.writeFileSync("/tmp/pairs.rgba",Buffer.concat(snaps.map(a=>Buffer.from(a.buffer))));
console.log(snaps.length);
