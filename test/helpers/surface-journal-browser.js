'use strict';

// Same assertions run against the production class in Node and real Chrome.
function checkSurfaceJournal(API) {
  const check = (ok, why) => { if (!ok) throw Error(why); };
  const same = (a, b, why) => check(JSON.stringify(a) === JSON.stringify(b), why);
  const throws = (fn, why) => { let error; try { fn(); } catch (e) { error = e; } check(!!error, why); };
  const journal = new API.SurfaceVersionJournal(new SharedArrayBuffer(3 * 65536));
  const record = { owner: { scope: 'journal-α🍷', endpointId: 7, generation: 3 },
    observationGeneration: 5, batch: 19, ordinal: 2, sourceVersion: 1,
    front: 4096, back: 4128, request: { descriptor: 8192, serial: 91, workerSlot: 0 },
    layout: { dib: 16384, palette: 32768, bpp: 8, pitch: 640, width: 640, height: 480 },
    pages: { root: 65536, proof: [[123, '18446744073709551614'], [456, '19']] },
    hostVersion: 17, qualified: false, consumedSurfaceVersion: null };
  check(journal.read(0) === null, 'uncommitted slot stays absent');
  Atomics.store(journal.words, 0, -1);
  journal.bytes.set(new TextEncoder().encode('{"half":'), 16);
  check(journal.read(0) === null, 'incomplete reserved payload cannot decode');
  Atomics.store(journal.words, 0, 0); // Test setup only: production never cancels reservations.
  journal.finish(0, record);
  const encoded = new TextEncoder().encode(JSON.stringify(record));
  same([...journal.bytes.slice(16, 16 + encoded.length)], [...encoded], 'exact committed JSON bytes');
  same(journal.read(0), record, 'exact palette/proof/request/owner identity');
  check(journal.bytes.buffer instanceof SharedArrayBuffer, 'real shared storage');
  const decoded = journal.read(0); decoded.pages.proof[0][1] = '0';
  same(journal.read(0), record, 'reader cannot mutate immutable source');
  throws(() => journal.finish(0, { overwritten: true }), 'committed rewrite rejected');
  same(journal.read(0), record, 'failed rewrite leaves exact payload');
  journal.begin(1, record.front);
  check(journal.records().length === 1 && journal.records()[0].superseded, 'retired source remains in raw ledger');
  const rejected = { ...record, sourceVersion: 2, versionRejected: 'overlapping-or-poisoned-source-writer' };
  journal.finish(1, rejected);
  check(journal.records().length === 2 && journal.records()[1].versionRejected === rejected.versionRejected,
    'rejected source retained, never silent empty coverage');
  for (const index of [-1, 0.5, 3, NaN]) {
    throws(() => journal.read(index), 'invalid read index');
    throws(() => journal.finish(index, record), 'invalid writer index');
  }
  throws(() => journal.finish(2, { padding: 'x'.repeat(65520) }), 'overflow rejected before reservation');
  check(Atomics.load(journal.words, 32768) === 0, 'overflow leaves fallback slot available');
  for (const length of [65521, -2]) {
    Atomics.store(journal.words, 32768, length);
    throws(() => journal.records(), 'invalid commit cannot become empty successful coverage');
  }
  journal.bytes.set(new TextEncoder().encode('{broken'), 2 * 65536 + 16);
  Atomics.store(journal.words, 32768, 7);
  throws(() => journal.records(), 'malformed committed JSON fails closed');
  for (const text of ['null', 'false', '[]']) {
    journal.bytes.set(new TextEncoder().encode(text), 2 * 65536 + 16);
    Atomics.store(journal.words, 32768, text.length);
    throws(() => journal.records(), 'non-record JSON cannot silently disappear');
  }
  const invalidUtf8 = [123, 34, 120, 34, 58, 34, 255, 34, 125];
  journal.bytes.set(invalidUtf8, 2 * 65536 + 16); Atomics.store(journal.words, 32768, invalidUtf8.length);
  throws(() => journal.records(), 'invalid UTF-8 cannot alter identity through replacement');
  Atomics.store(journal.words, 32768, 0);
  // Deterministically expose an invalid commit transition during the copy.
  const slice = journal.bytes.slice.bind(journal.bytes);
  journal.bytes.slice = (...args) => { const copy = slice(...args); Atomics.store(journal.words, 0, -1); return copy; };
  throws(() => journal.read(0), 'ordinary copy cannot legitimize a changing commit');
  return { status: 'PASS', exactBytes: encoded.length, records: 2,
    controls: ['uncommitted', 'incomplete', 'exact-identity', 'immutable-copy', 'rewrite',
      'retired', 'rejected-ledger', 'bounds', 'overflow', 'invalid-commit', 'malformed', 'non-record-json', 'invalid-utf8', 'changed-commit'] };
}
if (typeof module !== 'undefined') module.exports = { checkSurfaceJournal };
