# Canonical settings capture proved; defaults wrote Grafix.Cfg and enabled Spielen; exit blocker

One guest session ran on the same prepared bx_fn7pn7yg. Ordinary Configuration
1024 and visually identified OK/defaults 1 returned to a new launcher with
Spielen enabled and a genuine 50-byte Grafix.Cfg. Ordinary Beenden 3 then reached
`[eip-zero] guest called through NULL at batch 2578996`. The external watchdog
stopped the owned process group at 47.395874195 seconds, within 90 seconds;
parent OS exit -9, no guest ExitProcess, no remaining owned members. STOP at this
first concrete guest failure. No second/third session, reopen, Play dispatch,
original game launch or player input. Persistence across reopen remains UNTESTED.

## Exact correction to the historical diagnosis

The assertion that 3e64d839's committed observer expects two literal separators
is disproved by exact source and byte tests. Its SHA256 is
`e926bfcc1f46b53dfdfa65d4a6ce690896458714fbdd4faeb9f55b7da76c4256`.
Its regex, split and replacement each contain TWO source backslashes, representing
ONE literal separator in JavaScript. The old observer passes a genuinely canonical
single-separator root changed-path test. Its missing safety controls nevertheless
justify the explicitly pinned diagnostic-only containment/path validation repair.

The failure exposed by that task comes from the fixture construction's nested
Python string interpolation: the executed JS source contains one source backslash
before `test.ini`, which JavaScript decodes as TAB. `construction-regression.json`
proves historical path codepoints [99,58,9,101,115,116,46,105,110,105], versus
canonical [99,58,92,116,101,115,116,46,105,110,105]. The old fixture's failing
receipt is preserved as historical-settings-capture-fixture-api.json, and the
exact extracted JS is historical-executed-fixture.cjs. Remote execution replayed
that exact failure. It has NOT been reclassified as passing.

The new fixture is a standalone CJS file, avoiding nested literal interpolation.
It tests actual canonical root and nested paths, exact retained changed bytes,
no synthetic guest mutation by the observer, and real storage export. It also
runs the historical observer successfully against the actual canonical path.
The repaired observer keeps single-separator split/join semantics, validates all
observed names before creating a state directory, checks resolved destination
containment, rejects noncanonical output paths, verifies real non-symlink output
parents, and creates state files exclusively. Guest names cannot redirect writes
outside the new evidence state directory.

Final settings-fixture-final-api.json has API exit0 and inner fixture exit0,
17 rejecting path controls (traversal, other drive, POSIX absolute, UNC, rooted,
drive-relative, forward slash, duplicate separators, dot components, trailing
separator/space, stream colon, encoded escape, NUL and wildcard), four label
controls, four output controls and a preexisting-state-symlink rejection. New
helper pins are recorded separately in explicit-helper-review.json. The original
remote observer and original failed fixture remain unchanged. No production code
was edited. Three draft fixture failures are retained: doubled synthetic separators,
a mistakenly canonical negative after escape correction, and the disproved
historical-observer expectation. They were diagnostic-only, never guest attempts.

## Preflight and actual ordinary UI

Fresh info and UID1000 exec verified healthy idle RUNNING state, no actual Node
process, the existing hard 939524096-byte tmpfs and absent prior guest sessions.
Read-only remote main matched bb9c496ed13095cc832fdf607f0937fb9c14b7de, docs-only
successor of runtime source 58e90870a40a541a4083cae5e987ca8de31889e6. Current policies,
prior REPORT/RECOVERY, remaining session helpers and exact fixture construction
were read before guest launch. All 2083 originals/186399681B, all224 staged entries,
separate ctl receipt and the existing2045-file clone were rehashed; immutable
readonly and pristine/cloned registry d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3 passed.
ONE existing tmpfs, ONE existing clone; zero restore/reinstall/retransfer/build.

The ordinary-user exact-full-command gate passed, including canonical export
availability, control/PNG/storage/Worker dependencies, writable UID1000 output,
ports and capacity. Accepted PNG/forwarding/compile-reject/watchdog fixtures were
reused with unchanged seals. The actual no-default-build command, environment and
helper hashes are in session1-preflight.json. Runner deadline was explicitly
extended to03:02 for the coordinator's03:05 handback/03:10 shutdown instruction.
No lifecycle operation occurred.

Canonical1879387B SHA256
ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553
was actually consumed and instantiated under the inherited fail-closed compile
fallback guard; session1-fixed-module-consumption.jsonl records exact provenance.
No source compilation, unknown module, DLL spoof, enable patch or fabricated config.
Native identities for D3DConfigUtility/MSS32/DSETUP/ShadowMan remain in handback.json.

The three genuine PNGs were visually inspected: session1-output-launcher-before.png
shows disabled Spielen, session1-output-configuration.png shows Primary Display
Driver/640x480x16/default sliders/OK, and session1-output-after-ok.png shows the
new launcher with enabled Spielen. Original OK ID1 HWND65543 was matched to actual
control geometry/class/visible-enabled state before the one ordinary dispatch.
API trace records CreateFileA("Grafix.Cfg"), WriteFile(...0x32...), CloseHandle,
EndDialog and new launcher creation. Before/after captures retain2051->2052 VFS
files, one changed/new path and unchanged live registry export SHA
3ca98c6099e95175208fcd09ca9977a90a34de94ce789189754a65e0941949fe.
This live storage JSON serialization hash is distinct from the pristine registry
file hash; no registry semantic mutation is claimed.

Actual changed file:
`c:\program files\acclaim entertainment\shadowman\grafix.cfg`,50B SHA256
0407969d4bf39f2287f8d99bd37feac1212e6492f41038a817f77f39ef79d42d.
Its genuine bytes are retained locally as session1-grafix.cfg, and in remote
state-after-ok/vfs. The new launcher parent HWND65564/0x1001c has Play HWND65566,
ID1025 style1342242817/0x50010001: WS_VISIBLE set and WS_DISABLED clear. The old
launcher Play control remains disabled. The actual new control is enabled;
this proves neither game execution nor post-reopen persistence.

Both Configuration and OK callbacks retain ABANDONED-wndproc/64round/yield15
qualification limits (two entries). The visible response and file write do not
prove normal synchronous callback completion. COMCTL32/OLE32 warnings alone did
not terminate the run. The first hard failure was NULL execution on ordinary
Beenden from the new launcher, not on observer capture. A complete save-vfs
export was interrupted by external termination:479 files, no exported Grafix.Cfg.
Do NOT treat that partial export as a complete persistent VFS. The separate
50-byte settings evidence is complete; genuine reopen persistence is unknown.

## Bounds and handback

Final remote immutable206180352B (<2GiB), fixed434176B (<96MiB), tmpfs297472000B
of hard939524096B. In-session observed tmpfs peak186097664B; final usage includes
partial export growth during termination. Remote free48836108288B (>2GiB).
Fixed ceiling96 + tmpfs896 + reserve32MiB =1GiB. Host admission projected42086400B
including read donors/own allowance/tools/Git/8MiB reserve under64MiB, host free
6752702464B > mandatory2982150144B floor; final local measurement is verification.json.

Final hash checks passed again for2083 originals,224 staged entries and2045
unchanged clone files; pristine/cloned registry unchanged and immutable readonly.
Initial collection's substring pgrep node also matched a kernel inode worker;
handback-integrity-api.json retains that failure. Exact pgrep -ax node fixed only
the collection diagnostic, with positive/negative name tests in construction
regression. It caused no guest retry or process termination of unrelated work.

bx_fn7pn7yg is left RUNNING (API idle), healthok, stop=null, expiry
2026-10-23T03:46:00.580Z. PG54631 fully reaped, remaining=[], no actual Node process.
Coordinator owns03:10 shutdown, handback before03:05. No stop/resume/new/fork/delete,
public deploy, laptop, HeroesII, shared source/census/ledger edits or workers.

Helper checkpoint e30b1524a832bbc92bd6a8724a1baa24c4c73c3f was promptly pushed and
independently ls-remote verified before guest launch. Final publication.json and
append-only messageboard record final commit/remote backup. Stop after handback;
no replacement task. This unregistered candidate is documented here and in the
owned re-note, without an unrelated dashboard candidate record.
