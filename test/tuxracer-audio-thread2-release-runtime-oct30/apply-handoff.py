"""Apply one scheduler-boundary change to the exact retained runtime source.

This is a historical-runtime candidate, not a current-main integration recipe.
The file pin deliberately rejects the different a998bf36 Git library blob.
"""
import hashlib, pathlib, json, sys

EXPECTED = 'f4ba190b2dbf5e2cf2dac82398577bedfb13aa26d332fb7480b4d9d7e4ea2f78'
BEFORE = '''      Atomics.notify(this.syncView, idx * 4 + 2);
      this._wakeWaitersSoon();'''
AFTER = '''      Atomics.notify(this.syncView, idx * 4 + 2);
      // A cooperative worker can release and reacquire in one WASM slice.
      // Poll an already-parked main waiter at this real release boundary,
      // before the releaser can take the mutex back. Use the ordinary wait
      // completion path; never run the main interpreter recursively here.
      const main = this.mainInstance && this.mainInstance.exports;
      if (!this.workerBackend && threadId !== 1 && main &&
          main.get_yield_reason() === 1 &&
          (main.get_wait_handle() >>> 0) === (handle >>> 0) &&
          !(main.get_wait_handles_ptr && main.get_wait_handles_ptr()) &&
          (!main.get_wait_stack_bytes || main.get_wait_stack_bytes() === 12)) {
        this.checkMainYield();
      }
      this._wakeWaitersSoon();'''

def apply(source):
    assert hashlib.sha256(source).hexdigest() == EXPECTED, 'exact runtime source pin'
    text = source.decode()
    assert text.count(BEFORE) == 1, 'unique mutex release boundary'
    return text.replace(BEFORE, AFTER).encode()

if __name__ == '__main__':
    p = pathlib.Path(sys.argv[1]); source = p.read_bytes(); patched = apply(source)
    p.write_bytes(patched)
    print(json.dumps({'before':EXPECTED,'after':hashlib.sha256(patched).hexdigest(),
                      'bytesBefore':len(source),'bytesAfter':len(patched),'replacements':1}))
