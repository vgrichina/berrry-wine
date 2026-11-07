'use strict';

// A Worker can retire between page.workers() and evaluate(). Keep that fact
// separate from successful observations; it cannot stand in for an owner.
async function captureWorkerCensus(page, {read, identify, requiredOwners}) {
  if (!Array.isArray(requiredOwners)) throw new Error('Explicit requiredOwners policy required');
  const observation = {at: new Date().toISOString(), workers: [], retirements: []};
  const retired = new Set();
  const onDestroyed = worker => retired.add(worker);
  page.on('workerdestroyed', onDestroyed);
  const fail = message => {
    const error = new Error(message);
    error.observation = observation;
    throw error;
  };
  try {
    const successful = new Map();
    for (const worker of page.workers()) {
      // Capture immutable debugger identity before any asynchronous read.
      const identity = identify(worker);
      try {
        const row = await read(worker);
        observation.workers.push(row);
        successful.set(worker, row);
      } catch (error) {
        const detached = /Execution context is not available in detached frame or worker|Execution context was destroyed|Session closed|Target closed/i.test(String(error));
        if (!detached || (!retired.has(worker) && page.workers().includes(worker))) {
          error.observation = observation;
          throw error;
        }
        observation.retirements.push({...identity, slot: null, endpoint: null,
          status: 'retired-during-read', error: String(error)});
      }
    }
    for (const expected of requiredOwners) {
      if (!Number.isInteger(expected.slot) || !expected.sha256) fail('Required owner identity incomplete');
      const matches = [...successful].filter(([, row]) => row.slot === expected.slot &&
        row.endpoint != null && row.modules?.some(m => m.sha256 === expected.sha256) &&
        ['endpoint', 'targetId', 'sessionId'].every(k => expected[k] === undefined || expected[k] === row[k]));
      if (matches.length !== 1) fail('Required owning-worker observation unavailable or ambiguous');
      const [worker, row] = matches[0];
      if (row.errors?.length || retired.has(worker) || !page.workers().includes(worker)) fail('Required owning worker lost or invalid');
      // Revalidate after the census: an auxiliary read may have yielded while
      // the owner retired. Never return its earlier observation as still live.
      let current;
      try { current = await read(worker); }
      catch (error) { fail('Required owning worker revalidation failed: ' + error); }
      if (retired.has(worker) || !page.workers().includes(worker) || current.errors?.length ||
          ['slot', 'endpoint', 'targetId', 'sessionId'].some(k => current[k] !== row[k]) ||
          !current.modules?.some(m => m.sha256 === expected.sha256)) fail('Required owning worker changed during capture');
    }
    return observation;
  } finally {
    page.off('workerdestroyed', onDestroyed);
  }
}

module.exports = {captureWorkerCensus};
