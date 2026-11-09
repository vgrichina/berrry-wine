'use strict';

// Redline fixture lifecycle. Child wait and pipe EOF are independent obligations.
function observeChild(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({code, signal}));
  });
}

function createLifecycle({resources, closeBrowser, stopProtocol, finalize = () => {},
  signal, exitWaitMs = 10000, initialFailure}) {
  let terminal = false, firstFailure, failed = false, shutdown, protocolStop;
  let failBody;
  const failure = new Promise((_, reject) => { failBody = reject; });
  failure.catch(() => {});
  const remember = error => {
    if (!failed) { failed = true; firstFailure = error; failBody(error); }
  };
  const guard = () => {
    if (terminal || failed || signal?.aborted)
      throw firstFailure ?? signal?.reason ?? Error('fixture terminal; no further input/capture');
  };
  const track = promise => {
    promise.catch(remember); // Observe rejection immediately, including before shutdown.
    return promise;
  };
  const attempt = async fn => { try { return await fn(); } catch (e) { remember(e); } };
  const stop = () => protocolStop ??= attempt(stopProtocol);
  const abort = () => remember(signal.reason ?? Error('fixture cancelled'));
  signal?.addEventListener('abort', abort, {once:true});
  if (signal?.aborted) abort();

  function close() {
    if (shutdown) return shutdown;
    // The run body joins outstanding acquisition before taking this inventory.
    // Seed the primary failure here so it cannot skip that acquisition join.
    if (initialFailure) remember(initialFailure);
    terminal = true; // Synchronous gate, before any independent cleanup starts.
    shutdown = (async () => {
      const {server, browser, exit, streams = [], streamHandles = [], tasks = []} = resources();
      // The same existing shutdown budget also bounds inherited pipe writers.
      // Destroying our read ends joins pipelines but is explicitly NOT EOF proof.
      let streamsSettled=false, streamsTruncated=false;
      const streamTimer=streamHandles.length ? setTimeout(() => {
        if (streamsSettled) return;
        streamsTruncated=true;
        const error=Error('Chrome stream EOF missing within shutdown budget');
        remember(error);
        for(const stream of streamHandles) stream.destroy(error);
      },exitWaitMs) : undefined;
      // Start server close before touching CDP. A CDP failure cannot skip it.
      const serverJoin = attempt(async () => {
        if (!server) return;
        const joined = new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
        try { server.closeAllConnections(); } catch (e) { remember(e); }
        await joined;
      });
      // Retire all ordinary protocol producers before installing the isolated
      // close-response handler. Neither operation cancels child wait or EOF.
      await stop();
      const browserJoin = attempt(async () => {
        if (!browser) return;
        let timer;
        const timedOut = new Promise(resolve => {
          timer = setTimeout(() => resolve(null), exitWaitMs);
        });
        // Start the actual wait before requesting close; don't serialize it behind CDP.
        // closeBrowser only writes the close command; it must not wait for CDP
        // acknowledgement. The actual child wait is the shutdown authority.
        try { closeBrowser(remember); } catch (e) { remember(e); }
        const receipt = await Promise.race([exit, timedOut]).finally(() => clearTimeout(timer));
        if (!receipt) {
          remember(Error('actual Chrome exit missing'));
          // Existing wait budget is exhausted; do not extend it. A signalling
          // error still cannot discharge the actual wait obligation.
          try { browser.kill('SIGKILL'); } catch (e) { remember(e); }
        }
        const actualExit = await exit;
        return actualExit;
      });
      const streamJoin = Promise.allSettled(streams).then(rows => {
        streamsSettled=true; clearTimeout(streamTimer);
        for (const row of rows) if (row.status === 'rejected') remember(row.reason);
        return !streamsTruncated && rows.every(row => row.status === 'fulfilled');
      });
      const taskJoin = Promise.allSettled(tasks).then(rows => {
        for (const row of rows) if (row.status === 'rejected') remember(row.reason);
      });
      const [actualBrowserExit, , streamEOF] = await Promise.all([browserJoin, serverJoin, streamJoin, taskJoin]);
      await attempt(() => finalize({actualBrowserExit, streamEOF, streamsTruncated, terminal:failed, firstFailure}));
    })();
    return shutdown;
  }
  return {guard, track, close, async run(body) {
    let bodyTask;
    try { guard(); bodyTask = Promise.resolve().then(body); await Promise.race([bodyTask, failure]); }
    catch (e) {
      remember(e);
      terminal = true;
      // Wake pending protocol awaits, then join the caller itself. In particular,
      // an asynchronous server acquisition must settle before resources are read.
      await stop();
      if (bodyTask) await bodyTask.catch(remember);
    }
    await close();
    signal?.removeEventListener('abort', abort);
    if (failed) throw firstFailure;
  }};
}

module.exports = {createLifecycle, observeChild};
