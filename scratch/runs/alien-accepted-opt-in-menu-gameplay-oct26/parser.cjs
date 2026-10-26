const fs=require("fs"),assert=require("assert"),path=require("path"),crypto=require("crypto"),args=["--app=alien_shooter", "--no-build", "--wasm=/tmp/alien-accepted-opt-in-menu-gameplay-oct26/current.wasm", "--d3d9-renderer=software", "--trace-render-wait", "--tick-ms-per-batch=5", "--batch-size=200000", "--max-seconds=112", "--no-close", "--quiet-api", "--frozen", "--control=18129"];const getArg = (name, def) => {
  const prefix = `--${name}=`;
  const arg = args.find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : def;
};
const getArgs = name => {
  const prefix = `--${name}=`;
  return args.filter(value => value.startsWith(prefix))
    .flatMap(value => value.slice(prefix.length).split(','))
    .map(value => value.trim()).filter(Boolean);
};
const hasFlag = name => args.includes(`--${name}`);
;assert.equal(getArg('app'),'alien_shooter');assert(hasFlag('no-build')&&hasFlag('trace-render-wait')&&hasFlag('frozen'));assert.equal(getArgs('vfs-tree').length,0);assert.equal(getArgs('vfs-mount').length,0);const {APPS}=require('./lib/apps'),e=APPS.alien_shooter;fs.accessSync(e.exe);const m=JSON.parse(fs.readFileSync(e.localFileManifest));let dir=path.dirname(e.localFileManifest),files=m.files.map(x=>({...x,host:path.join(dir,x.url)}));for(let x of files)fs.accessSync(x.host);fs.writeFileSync("/tmp/alien-accepted-opt-in-menu-gameplay-oct26/filename-enumeration.json",JSON.stringify({exe:e.exe,manifest:e.localFileManifest,files,commaNames:files.filter(x=>x.url.includes(','))},null,2));console.log(JSON.stringify({count:files.length,exe:e.exe,manifest:e.localFileManifest,commaNames:files.filter(x=>x.url.includes(',')),noCommaSplitForRegisteredManifest:true}));