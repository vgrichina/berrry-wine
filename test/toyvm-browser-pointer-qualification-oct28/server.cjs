const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=__dirname;
// Harness fixture: mode13, fill visible VGA pixels, wait for real keyboard input.
const com=Buffer.from('b81300cd10b800a08ec031ffb900fab02af3aab400cd16ebfa','hex');
const digest=crypto.createHash('sha256').update(com).digest('hex');
const title={id:'pointer-probe',title:'Pointer qualification fixture',launchable:true,status:'untested',entry:{program:'PROBE.COM',args:'',env:{}},blockers:[],cautions:[],files:[{path:'PROBE.COM',name:'PROBE.COM',size:com.length,sha256:digest,url:'/probe.com'}]};
const style='<style>canvas{width:640px!important;height:400px!important;display:block;max-width:none!important}body{margin:12px}dialog{padding:8px}button{min-width:60px}</style>';
const boot='<script src="/bundle.js"></script><script src="/observe.js"></script>';
const demo=`<!doctype html><head>${style}${boot}</head><body>
<figure id="probe" data-live="probe" data-live-src="/program.js" data-live-exe="PROBE.COM" data-live-sound="none"><button class="open"><img src="/blank.svg"></button><a class="fn">Pointer probe</a></figure>
<dialog id="lb"><a id="lb-name"></a><div id="lb-meta"></div><div id="lb-screen"></div><a id="lb-pouet"></a><img id="lb-img"><canvas id="lb-canvas" tabindex="0"></canvas><button id="lb-play">Run</button><div id="lb-status"></div><select id="lb-cpu"><option>10</option></select><button id="lb-sound">Sound</button><button id="lb-fs">Fullscreen</button><button id="lb-close">Close</button><button id="lb-auto">Auto</button><button id="lb-jit">JIT</button></dialog>
<input id="outside" value="focus target"><script>localStorage.setItem('toyvm-live',JSON.stringify({sound:false,auto:false,jit:false,cpu:'10'}));</script><script src="/site.js"></script></body>`;
const files={'/bundle.js':'candidate/docs/dos-corpus/live/toyvm-bundle.js','/toyvm/runtime/toyvm-bundle.js':'candidate/docs/dos-corpus/live/toyvm-bundle.js','/site.js':'candidate/docs/dos-corpus/site.js','/toyvm/live.js':'candidate/ops/toyvm-live/live.js','/observe.js':'observe.js'};
const requests=[];
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');requests.push(u.pathname);
 let data,type='text/javascript';
 if(u.pathname==='/dashboard') {data=fs.readFileSync(path.join(root,'candidate/ops/toyvm-live/index.html'),'utf8').replace('</head>',style+boot+'</head>').replace('</body>','<input id="outside" value="focus target"></body>');type='text/html';}
 else if(u.pathname==='/demo'){data=demo;type='text/html';}
 else if(u.pathname==='/toyvm/api/title'){data=JSON.stringify(title);type='application/json';}
 else if(u.pathname==='/probe.com'||u.pathname.includes('/file')){data=com;type='application/octet-stream';}
 else if(u.pathname==='/program.js')data='self.ToyVMPrograms={program:{files:{"PROBE.COM":"'+com.toString('base64')+'"}}};';
 else if(u.pathname==='/blank.svg'){data='<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>';type='image/svg+xml';}
 else if(u.pathname==='/requests'){data=JSON.stringify(requests);type='application/json';}
 else if(u.pathname==='/live/toyvm-bundle.js')data=fs.readFileSync(path.join(root,files['/bundle.js']));
 else if(files[u.pathname])data=fs.readFileSync(path.join(root,files[u.pathname]));
 else {res.writeHead(u.pathname.endsWith('.css')?200:404);res.end();return;}
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data);
});
server.listen(8765,'127.0.0.1',()=>console.log(JSON.stringify({port:8765,fixtureSHA256:digest,fixtureBytes:com.length})));
