'use strict';

// Local EventEmitter listener retirement is safe after a runtime scope closes.
// Every other page method remains fenced, including synchronous input methods.
function fencePage(page, isTerminal, fail) {
  const local = new Set(['off', 'removeListener']);
  return new Proxy(page, {get(target, key) {
    const value = Reflect.get(target, key, target);
    if (typeof value !== 'function') return value;
    return (...args) => {
      if (isTerminal() && !local.has(key)) throw Error('scope closed: ZERO later endpoints');
      const result = Reflect.apply(value, target, args);
      return result && typeof result.then === 'function'
        ? result.catch(error => { fail(String(error)); throw error; }) : result;
    };
  }});
}

// Cleanup stages are independent: a diagnostic or listener failure cannot
// suppress OS termination, actual waits, or disposable-resource removal.
async function finalize(stages) {
  const results = [];
  for (const [name, run] of stages) {
    try { results.push({name, status:'fulfilled', value:await run()}); }
    catch (error) { results.push({name, status:'rejected', error:String(error)}); }
  }
  return results;
}

function verifyWorkers(rows) {
  if (!rows.length) throw Error('no executing workers');
  for (const row of rows) {
    if (row.error || row.enableError) throw Error('worker proof error: '+(row.error || row.enableError));
    const source = row.source || row.sources;
    if (!source?.length || !source.every(v => v.match)) throw Error('worker source proof missing or wrong');
    if (!row.modules?.length || !row.modules.every(v => v.match)) throw Error('worker module proof missing or wrong');
  }
  return true;
}
module.exports = {fencePage, finalize, verifyWorkers};
