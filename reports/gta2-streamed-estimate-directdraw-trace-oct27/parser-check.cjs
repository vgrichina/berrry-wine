const fs=require("fs");const args=["--app=gta2_demo"];const getArg = (name, def) => {
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
;if(getArg("app",null)!=="gta2_demo")throw Error("parser");console.log(JSON.stringify({actualFilenameMountArgv:[],app:getArg("app",null),reason:"registered requiredFiles route; no extra filename-bearing mounts",limits:fs.readFileSync("/proc/self/limits","utf8"),version:process.version}));