'use strict';
// One retained-native invocation, with an independent contradiction control.
// Candidate stays byte unchanged. A unique insertion records live observations
// before its original 972-entry test; all original assertions still execute.
const fs = require('fs'), path = require('path'), Module = require('module');
const assert = require('assert/strict'), crypto = require('crypto');
const file = path.resolve(__dirname, '../repo/tools/maelstrom-retained-breakpoint-probe.cjs');
const original = fs.readFileSync(file, 'utf8');
const hash = crypto.createHash('sha256').update(original).digest('hex');
assert.equal(hash, '33454b44192dfe39952f364b1fa94ee6af7b36aa511efa5e08e8ec9fe9e920f9');
const anchor = '  const storesBeforeYield = e.get_cache_stores();';
assert.equal(original.split(anchor).length, 2);
const control = `
  // Pending yield at the EXACT breakpoint must first halt before counting.
  // Resume consumes skip-once even though blocking yield prevents execution.
  e.set_eip(originalTarget);
  const controlStores = e.get_cache_stores(), controlEBP = e.get_ebp();
  const priority = observe('independent-breakpoint-before-yield', 1000);
  assert.equal(priority.halt, 5); assert.equal(priority.eip, originalTarget);
  assert.equal(priority.interiorCount, 0);
  let independentReads = 0;
  assert.equal(targetEvidence(e, originalTarget, () => ++independentReads), 1);
  const skipped = observe('independent-skip-consumed-without-execution', 1000);
  assert.equal(skipped.halt, 4); assert.equal(skipped.eip, originalTarget);
  assert.equal(skipped.interiorCount, 1);
  assert.equal(e.get_cache_stores(), controlStores); assert.equal(e.get_ebp(), controlEBP);
  assert.equal(targetEvidence(e, originalTarget, () => ++independentReads), null);
  assert.equal(independentReads, 1);
  const rearmed = observe('independent-rearm-after-blocked-skip', 1000);
  assert.equal(rearmed.halt, 5); assert.equal(rearmed.interiorCount, 1);
  // Reject a live halt5/readback match when the requested address differs.
  assert.equal(targetEvidence(e, originalHead, () => ++independentReads), null);
  assert.equal(independentReads, 1);
  // Consume the second pending skip, then restore the original fixture.
  e.run(1000); assert.equal(e.get_last_run_halt(), 4);
  e.clear_bp(); e.clear_counts();
  e.set_count(0, originalHead); e.set_count(1, originalTarget); e.set_bp(originalTarget);
  e.set_eip(originalHead);
`;
const instrumented = original.replace(anchor, control + anchor);
const compiled = new Module(file, module);
compiled.filename = file; compiled.paths = Module._nodeModulePaths(path.dirname(file));
compiled._compile(instrumented, file);
compiled.exports.probe(process.argv[2]).then(result => {
  result.independentControl = { candidateSHA256: hash, insertionAnchor: anchor,
    controlSHA256: crypto.createHash('sha256').update(control).digest('hex'),
    observation: 'breakpoint precedes pending yield; skip consumed by blocked entry; next entry halts again' };
  console.log(JSON.stringify(result, null, 2));
}).catch(error => { console.error(error.stack); process.exitCode = 1; });
