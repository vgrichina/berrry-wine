// Task-only serial input client. Never writes guest memory or alters the runner.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {PNG}=require('/tmp/wa-local-runtime-deps/node_modules/pngjs');
const N='civ2-win16-map-movement-gameplay-oct26',R='/home/user/wine-assembly/scratch/runs/'+N;
const P='/home/user/wine-assembly/scratch/runs/civ2-win16-complete-setup-map-gameplay-oct26';
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); let serial=0;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function put(n,o){const p=R+'/'+n;fs.writeFileSync(p+'.tmp',JSON.stringify(o,null,2)+'\n');fs.renameSync(p+'.tmp',p);}
async function ctl(req){
 req={...req,id:'serial-'+(++serial)};fs.appendFileSync(R+'/control-in.jsonl',JSON.stringify(req)+'\n');
 const start=Date.now();while(Date.now()-start<12000){
  const s=fs.existsSync(R+'/guest.log')?fs.readFileSync(R+'/guest.log','utf8'):'';
  for(const l of s.split('\n'))if(l.startsWith('[ctl] ')){const o=JSON.parse(l.slice(6));if(o.id===req.id){if(!o.ok)throw Error(JSON.stringify(o));return o.value;}}
  await sleep(10);
 }throw Error('unacknowledged request; STOP without replay '+JSON.stringify(req));
}
async function step(n){const a=await ctl({action:'step',n});if(a.ran!==n||!a.frozen)throw Error('step incomplete');const s=await ctl({action:'snapshot'});if(!s.frozen.frozen||s.frozen.credits!==0)throw Error('not frozen zero');return s;}
async function input(cmd){return ctl({cmd});}
async function capture(name){if(fs.readdirSync(R).filter(x=>x.endsWith('.png')).length>=20)throw Error('capture cap');const p=R+'/'+name+'.png';await ctl({action:'png',path:p});const b=fs.readFileSync(p);if(b.length>2097152)throw Error('PNG bytes');const png=PNG.sync.read(b);if(png.width!==640||png.height!==480)throw Error('PNG dimensions');return png;}
function crop(im,[x,y,w,h]){const b=Buffer.alloc(w*h*4);for(let j=0;j<h;j++)im.data.copy(b,j*w*4,((y+j)*im.width+x)*4,((y+j)*im.width+x+w)*4);return b;}
const checks=[];
function match(name,im,rects,donor=P){const ref=PNG.sync.read(fs.readFileSync(donor+'/'+name+'.png'));const parts=rects.map(rect=>{const a=crop(im,rect),b=crop(ref,rect);return {rect,actual:hash(a),reference:hash(b),equal:a.equals(b)};});const ok=parts.every(p=>p.equal);checks.push({name,reference:donor+'/'+name+'.png',referenceSHA256:hash(fs.readFileSync(donor+'/'+name+'.png')),parts,ok});put('pixel-checkpoints.json',{checks});if(!ok)throw Error('presented pixels differ at '+name);}
async function state(name,rects){const im=await capture(name);match(name,im,rects);put('durable-controller.json',{stage:name,inputsAcknowledged:serial,pixelChecks:checks.length,remaining:'ordinary movement and normal quit'});console.log('verified '+name);return im;}
async function advance(name,rects,cmds,n){await state(name,rects);for(const c of cmds)await input(c);return step(n);}
async function main(){
 await step(500);
 await advance('language',[[100,215,440,45],[100,270,220,20]],['click:210:280'],150);
 await advance('heralds',[[100,145,440,160],[100,317,440,20]],['click:320:327'],200);
 // A rendered movie signature plus visible intro window geometry, never title alone.
 const intro=await capture('intro');const snap=await ctl({action:'snapshot'});
 let black=0,colored=0;for(let y=0;y<480;y++)for(let x=0;x<640;x++){const i=(y*640+x)*4,r=intro.data[i],g=intro.data[i+1],b=intro.data[i+2];if(y<115||y>=365){if(r+g+b<15)black++;}else if(x>170&&x<460&&y>180&&y<300&&r>80&&r>g&&g>b)colored++;}
 const visible=snap.windows.filter(w=>w.visible&&!w.isChild);const ok=black>140000&&colored>4000&&visible.some(w=>w.w>=600&&w.h>=400);
 put('intro-checkpoint.json',{blackBorderPixels:black,centralLogoColoredPixels:colored,visible,ok,frameSHA256:hash(fs.readFileSync(R+'/intro.png'))});if(!ok)throw Error('unknown presented intro');
 await input('keydown:27');await input('keyup:27');await step(300);
 await advance('post-intro',[[430,270,200,175]],['click:478:464'],200);
 await advance('world',[[160,352,320,95]],['click:180:391','click:320:464'],200);
 await advance('difficulty',[[10,287,320,160]],['click:90:465'],200);
 await advance('civilizations',[[310,310,320,137]],['click:327:435','click:468:465'],200);
 await advance('barbarians',[[10,330,320,117]],['click:172:465'],150);
 await advance('rules',[[310,375,320,72]],['click:385:465'],150);
 await advance('gender',[[160,375,320,72]],['click:235:465'],150);
 await advance('tribe',[[20,265,600,182]],['click:320:465'],150);
 await advance('name',[[100,393,440,24],[102,421,88,16]],['click:210:465'],250);
 await advance('ready',[[310,215,320,235]],['click:388:465'],300);
 await advance('map-entry',[[70,345,500,22],[140,371,265,14],[80,453,480,14]],['click:320:460'],200);
 await advance('map-before',[[90,10,460,93],[95,112,450,13]],['click:320:118'],50);
 await state('gameplay-before',[[180,46,100,18],[520,267,70,34],[470,305,50,12]]);
 await input('keydown:39');await input('keyup:39');await step(150);
 await capture('gameplay-after');put('durable-controller.json',{stage:'movement acknowledged and afterPNG retained; visual inspection pending',inputsAcknowledged:serial,remaining:'personal movement inspection and ordinary quit'});
 console.log('MOVEMENT CAPTURED');
 await input('click:26:31');await step(10);await capture('quit-menu');console.log('QUIT MENU READY');
}
if(process.argv.includes('--check')){
 const im=PNG.sync.read(fs.readFileSync(P+'/world.png'));match('world',im,[[160,352,320,95]]);
 const wrong=PNG.sync.read(fs.readFileSync(P+'/gender.png'));let rejected=false;try{match('world',wrong,[[160,352,320,95]]);}catch(e){rejected=true;}if(!rejected)throw Error('wrong dialog accepted');
 put('controller-selfcheck.json',{sameFrameAccepted:true,wrongDialogRejected:rejected,pixelsAreReadOnly:true});fs.unlinkSync(R+'/pixel-checkpoints.json');
}else main().catch(e=>{put('controller-error.json',{message:e.message,stack:e.stack,serial,at:new Date().toISOString(),noReplay:true});console.error(e.stack);});
