'use strict';
// Recover the exact captured observer runner with post-loader arming moved past
// ordinary main initialization. This does not move earlier DLL initialization.
const crypto = require('node:crypto');
const fs = require('node:fs');
const INPUT_SHA256 = '5b2596b3746e17427d26a50466ed36adcfec9f9f119755f05b1fa4bc3c79be58';
const START = '    nativeAdapter.start();\n';
const BOUNDARY = '  for (let batch = 0; batch < MAX_BATCHES && !stopped; batch++) {\n';
const ARM = '  // Arm once after ordinary main setup, before batch inputs, timers or run.\n' +
  '  try {\n    nativeAdapter.start();\n' +
  "  } catch (error) { nativeRaw('first-loader-or-start-rejection', error); throw error; }\n";
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
function unique(text, needle) {
  const at = text.indexOf(needle);
  if (at < 0 || text.indexOf(needle, at + needle.length) >= 0) throw new Error('runner anchor identity mismatch');
  return at;
}
function transform(input) {
  if (!Buffer.isBuffer(input) || sha256(input) !== INPUT_SHA256) throw new Error('captured runner SHA-256 mismatch');
  const source = input.toString('utf8');
  const start = unique(source, START), boundary = unique(source, BOUNDARY);
  const initialization = unique(source, '  experiments.applyMain(instance, { copySuperops: COPY_SUPEROPS, ctx });\n');
  if (!(start < initialization && initialization < boundary)) throw new Error('runner setup order mismatch');
  // Exactly one contiguous replacement: its interior retains every setup byte.
  const before = source.slice(start, boundary);
  const after = before.slice(START.length) + ARM;
  const output = Buffer.from(source.slice(0, start) + after + source.slice(boundary));
  return {output, receipt: {schema: 'maelstrom-initialized-runner-arm/v1', inputSHA256: INPUT_SHA256,
    outputSHA256: sha256(output), inputBytes: input.length, outputBytes: output.length,
    replacement: {offset: Buffer.byteLength(source.slice(0, start)), beforeBytes: Buffer.byteLength(before),
      beforeSHA256: sha256(before), afterBytes: Buffer.byteLength(after), afterSHA256: sha256(after)},
    armCount: output.toString('utf8').split(START).length - 1,
    scope: 'post-loader setup to main execution; earlier DLL initialization unchanged'}};
}
module.exports = {transform, INPUT_SHA256};
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2) throw new Error('usage: node tools/maelstrom-initialized-runner-arm.cjs CAPTURE_RUN_JS NEW_OUTPUT_JS');
    const stat = fs.statSync(args[0]);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('captured runner input must be a file <= 1 MiB');
    const {output, receipt} = transform(fs.readFileSync(args[0]));
    // Refuse overwriting an input, existing runner or standing donor.
    fs.writeFileSync(args[1], output, {flag: 'wx'});
    console.log(JSON.stringify(receipt));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
