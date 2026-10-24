      // --trace-at: one-line register dump per hit, no stop (matches any addr in traceAtAddrs)
      if (traceAtAddrs.length && traceAtAddrs.includes(eipNow >>> 0)) {
        const shouldLog =
          batch >= TRACE_AT_START_BATCH &&
          (!TRACE_AT_LIMIT || traceAtHits < TRACE_AT_LIMIT);
        if (shouldLog) {
          traceAtHits++;
          const e = instance.exports;
          const esp = e.get_esp() >>> 0;
