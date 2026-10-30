"""Task-only bridge for the exact retained Enigma runner; reject any other bytes."""
import hashlib
PIN = '96aa1313dabaf59a55875830b35fdd32ec3410fea2e3b2458828a9f49ccbe4b2'
INSTALL_ANCHOR = "  const handleControlCommand = (cmdIn) => {"
COMMAND_ANCHOR = "    if (cmd.action === 'guest-poll') {"
RUN = 'instance.exports.run(BATCH_SIZE)'
INSTALL = """  const stallObserver = require('./enigma-stall-observer.js').createObserver({
    enabled: guestPollTrace.enabled,
    read: () => ({ instance, threadManager, tickState, guestPollTrace,
      poll: guestPollState() }),
  });
"""
COMMAND = """    if (cmd.action === 'input-stall') return stallObserver.sample();
"""
REPLACEMENT = '(stallObserver.before(), instance.exports.run(BATCH_SIZE), stallObserver.after())'
def transform(source):
    assert hashlib.sha256(source.encode()).hexdigest() == PIN, 'retained runner identity mismatch'
    assert source.count(INSTALL_ANCHOR) == source.count(COMMAND_ANCHOR) == 1
    assert source.count(RUN) == 3, 'main continuation sites changed'
    return source.replace(INSTALL_ANCHOR, INSTALL + INSTALL_ANCHOR).replace(COMMAND_ANCHOR, COMMAND + COMMAND_ANCHOR).replace(RUN, REPLACEMENT)
