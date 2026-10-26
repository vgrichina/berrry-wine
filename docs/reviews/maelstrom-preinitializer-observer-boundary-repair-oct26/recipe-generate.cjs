'use strict';
// No compilation/execution. Both files must be placed together; never patch a
// standing runtime. Remaining dependency closure is a separate runtime gate.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {transformPair}=require('../../../tools/maelstrom-initialized-runner-arm.cjs');
const [runnerInput,loaderInput,newDirectory]=process.argv.slice(2);
if(!runnerInput||!loaderInput||!newDirectory)throw Error('usage: RECIPE CAPTURE_RUN_JS ARCHIVED_DLL_LOADER_JS NEW_DIRECTORY');
const pair=transformPair(fs.readFileSync(runnerInput),fs.readFileSync(loaderInput));
new vm.Script(pair.runner.output.toString());new vm.Script(pair.loader.output.toString());
fs.mkdirSync(newDirectory);fs.mkdirSync(path.join(newDirectory,'test'));fs.mkdirSync(path.join(newDirectory,'lib'));
fs.writeFileSync(path.join(newDirectory,'test/run.js'),pair.runner.output,{flag:'wx'});
fs.writeFileSync(path.join(newDirectory,'lib/dll-loader.js'),pair.loader.output,{flag:'wx'});
console.log(JSON.stringify(pair.receipt));
