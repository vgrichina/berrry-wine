const fs = require('fs');
const assert = require('assert');
const {PNG} = require('./runner/node_modules/pngjs');
const signature=Buffer.from('89504e470d0a1a0a','hex');
function encode(buf) {
  assert(Buffer.isBuffer(buf) && buf.subarray(0,8).equals(signature), 'real PNG required');
  const w=buf.readUInt32BE(16),h=buf.readUInt32BE(20);
  assert(w>0 && h>0 && w<=800 && h<=600 && w*h<=480000, 'capture dimensions');
  const image=PNG.sync.read(buf);
  const result=PNG.sync.write(image,{deflateLevel:9,deflateStrategy:3});
  assert(result.length<=131072,'capture byte limit');
  assert.deepStrictEqual(PNG.sync.read(result).data,image.data,'capture pixel identity');
  return result;
}
module.exports={encode};
if (process.env.MAELSTROM_CAPTURE_INSTALL==='1') {
  const write=fs.writeFileSync;let frames=0,total=0;
  fs.writeFileSync=function(file,data,...args) {
    if(typeof file==='string' && file.endsWith('.png')) {
      data=encode(data);assert(++frames<=3,'capture frame limit');total+=data.length;
      assert(total<=393216,'capture cumulative byte limit');
      process.stderr.write(`[capture] pixel-preserving png ${frames} ${data.length} bytes\n`);
    }
    return write.call(this,file,data,...args);
  };
}
