# Original LMarbles Puzzle8 manual attempt, 2026-11-18

**The requested clear → onward → ordinary Quit sequence was not achieved.**
The retained run is `scratch/runs/20261118-lmarbles-current-manual-puzzle8-clear/`.
Native exit 0 after cancellation is not ordinary Quit or puzzle completion.

## Observed progress

- The gray-first original reached **74 moves remaining, 22 settled slides**.
  Its next rightward slide was visible in progress when reviewed; a settled
  73-move board was not verified. The earlier messageboard claim was corrected.
- A blue-first attempt used the ordinary current-level light and Y to restart
  after discovering that the right gray blocked the bottom corridor. Its
  corrected restart reached **81 moves remaining, 15 settled slides**, including
  the first blue on the bottom target. It then closed at the actual disk floor.
- The final fresh original reached Puzzle8 at 96 moves and selected the first
  blue. No slide completed before another actual disk-floor closure.
- A 96-slide continuation was planned personally from screenshots but was
  neither executed nor proved. No parser, solver, OCR, or autoplay was used.

Complete screenshots were reviewed before individually chosen finite inputs.
Game freshness stayed 5 seconds; confirmation 500 ms, independent UP 1750 ms,
observation/completion 3000 ms, and the finite watchdog/Quit reserve remained
unchanged. Rejected intents were retained as NOT_SENT, followed by a new capture
and a distinct intent when retried. Recent recorded expired ages included
5.016–8.170 seconds. Smaller whole-desktop previews and removal of redundant
path text did not resolve the delivery latency.

## Runtime and closure

The published `d7a471f0a` controller/common helpers were recovered exactly from
Git, using the retained qualified module SHA-256
`0d383140f6d4207d18860e3cb22fc8fcc47a5d260b8d5f2443222396b245fdd5`
and its 251-source pinned graph at runtime Git `1c56d4135c03ee060c25cabcea031810f4f5f8dc`.
There was no production-code change, repeat compilation, or broad qualification
rerun. The prior controller19/native2/locked-build results remain prior evidence.

Seven originals have actual native waits of 0 with both EOFs. One early enclosing
invocation ended SIGTERM/143, and a preparation failure exited 1; these remain
failures, separately from the native waits. Twenty supervision receipts report
no leaks. The final runtime and its manual helpers exited 0. All recorded closure
checks and their limits are retained in `closure-audit.json`.

One preparation scope bound a changing black startup image: the native paint
check refused it, while permanently consuming the bind reservation. A separately
recorded fresh bind was refused as permanent; the scope was closed without any
gameplay input. The next original used one fresh menu bind successfully. No
request was sent after that scope's recorded UNKNOWN closure.

Repeated **actual** disk-floor breaches prevented continuous floor compliance;
the final original closed at 1,498,554,368 bytes free. Verified, reversible
compression of older closed, untracked logs and evidence metadata recovered
413,184,000 allocated bytes across five passes. Every removal followed disk
round-trip SHA/size verification, a stable-source check, and a durable recovery
recipe. Held titles and active outputs were excluded. FD visibility was
incomplete: no observed selected descriptor is claimed, not complete proof of
no open descriptors. Subsequent shared growth exhausted that headroom again.

Selected screenshots and all unique native records were retrieved and verified
before removing the owned tmpfs directories. Recovery recipes, source binary
diff, owned new-input patches, selected-image inventories, and actual waits are
retained; Git remains the source archive. No old endpoint is reusable.

No agents, workers, Wine reference runs, Python, public deployment, or test boxes
were used. Box ID `null`, state `NOT_CREATED`, expiry `null`, stop receipt `null`.
Clear, onward, and ordinary Quit remain open.
