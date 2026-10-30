'use strict';
// Use the image decoder already installed in the retained runtime.
const fs = require('fs');
const { PNG } = require('pngjs');
const input = PNG.sync.read(fs.readFileSync(process.argv[2]));
if (input.width !== 640 || input.height !== 480) throw Error('unexpected guest dimensions');
const output = new PNG({width: 320, height: 240});
for (let y = 0; y < 240; y++) for (let x = 0; x < 320; x++) {
  input.data.copy(output.data, (y * 320 + x) * 4, (y * 2 * 640 + x * 2) * 4,
    (y * 2 * 640 + x * 2) * 4 + 4);
}
fs.writeFileSync(process.argv[3], PNG.sync.write(output));
console.log(JSON.stringify({decoded: true, original: [input.width, input.height], display: [320, 240]}));
