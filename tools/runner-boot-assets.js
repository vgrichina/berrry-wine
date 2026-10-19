'use strict';
// Shared source-only CLI boot closure; no WAT compile/instantiation or guest.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function auditBoot(root, source) {
  assert(/^[a-f0-9]{40}$/.test(source));
  const git = args => cp.execFileSync('git', ['-C', root, ...args]);
  const blob = p => git(['show', source + ':' + p]);
  for (const p of ['test/run.js','lib/font-substitutions.js','lib/process-boot.js']) assert.equal(sha(fs.readFileSync(path.join(root,p))),sha(blob(p)), 'Boot source mismatch: '+p);
  const font = require(path.join(root, 'lib/font-substitutions'));
  const system = require(path.join(root, 'lib/process-boot')).SYSTEM_DATA_FILES;
  // Verify the manifest itself before deriving any required subset paths.
  const substitutions = blob('fonts/substitutions.json');
  const paths = [...new Set([...system.map(f => f.url), 'fonts/substitutions.json',
    ...font.BUNDLED_BITMAP_FONTS.map(n => 'fonts/' + n),
    ...font.fontMounts(JSON.parse(substitutions), { subset: true }).map(f => 'fonts/' + f.file)])];
  const files = paths.map(p => {
    const expected = blob(p), actual = fs.readFileSync(path.join(root, p));
    assert.equal(sha(actual), sha(expected), 'Required CLI asset: ' + p);
    return { path: p, bytes: actual.length, sha256: sha(actual), provenance: source + ':' + p };
  });
  return {sourceOnly:true,source,files,bytes:files.reduce((n,f)=>n+f.bytes,0)};
}
module.exports={auditBoot};
if(require.main===module)console.log(JSON.stringify(auditBoot(path.resolve(process.argv[2]),process.argv[3]),null,2));
