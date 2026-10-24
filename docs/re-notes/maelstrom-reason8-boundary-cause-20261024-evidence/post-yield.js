    // Check if main thread is waiting on an event
    await threadManager.resolveMainThreadSend();
    if (threadManager.checkMainYield()) {
      // Main thread still waiting — don't advance EIP check
    }

// Watchpoint check
    if (checkWatchpoint(batch)) {
