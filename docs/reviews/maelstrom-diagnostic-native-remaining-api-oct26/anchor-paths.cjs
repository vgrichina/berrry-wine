'use strict';
// Path-only adapter: exact retained fixture and anchor bytes remain unchanged.
const fs=require('node:fs'),path=require('node:path'),original=fs.readFileSync;
const O=__dirname;
const paths={
 '/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/SDL_net.dll':path.join(O,'anchors/net'),
 '/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe':path.join(O,'anchors/exe'),
 '/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll':path.join(O,'anchors/crt')
};
fs.readFileSync=function(p,...args){return Reflect.apply(original,this,[typeof p==='string'&&Object.hasOwn(paths,p)?paths[p]:p,...args]);};
