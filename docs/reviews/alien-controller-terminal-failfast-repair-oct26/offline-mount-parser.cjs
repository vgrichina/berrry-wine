const args=[];
const getArg = (name, def) => {
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

if(getArgs("vfs-mount").length || getArgs("vfs-tree").length)throw Error("unexpected mount"); console.log(JSON.stringify({argv:args,intendedFiles:[],mounts:[],offline:true}));
