# Mounted ToyVM production CLI acceptance

Both authorized bounded cases passed their respective oracles on 2026-10-29.
The five production files at candidate 7bf2ad5025b6c273193ebd48084879c61fde6293
were unchanged and matched their accepted hashes locally and remotely.
The actual production qualify_accounted.py CLI ran on task-owned bx_zvw983pv
through supported Boat API exec, with real mounted synchronous FUSE.
The Python executable, immutable cancellation receipt and 170-byte fixture
matched the dispatch manifest. No production repair or broader suite ran.

| Case | CLI exit | accepted | authoritative filesystem result | cleanup |
| --- | --- | --- | --- | --- |
| 1: 1024 bytes | 0 | true | failure=null; written=1024; peak=12288; final live=4096 | complete |
| 2: 9000 bytes | 1 | false | filesystem cumulative write limit; written=0; peak=8192 | complete |

Case 1 emitted TINY_FIXTURE_COMPLETED. Its backend child exited 0,
stopReason=null, CPU=0.109927s, wall=0.070862743s and peakRSS=32768000.
Case 2 did not emit the marker. Its backend child exited -15,
stopReason=filesystem cumulative write limit, CPU=0.148342s,
wall=0.090796219s and peakRSS=33685504.
This is the intended enforced quota rejection, rather than startup failure.
The authoritative receipt identifies cumulative write enforcement; this test
does not separately prove the per-file quota boundary.

Both authoritative receipts reported cleanupComplete=true, unmountExit=0,
serverExit=-15, remainingMounts=[] and openHandles=0. Additional observer scans
found no remaining mounts or processes bearing each owned work path.
Those scans supplement the authoritative child-tree receipt.

The only fixture limit change from the retained earlier counterexample was
live8192 to live16384. write8192/file8192, RSS67108864, CPU10, wall20,
output8192, confinement and accepted production were unchanged.
The observed positive peak12288 leaves4096 headroom. Original fixture bytes
were loaded using fixture.read_text() as one argv element following -c.
No filename replay, textual fixture edit, tracing, policy relaxation, mock,
offline substitute, browser/game workload or public deployment occurred.
The earlier filename/FIOCLEX explanation remains source-only and unproven
historically. Exact failing syscall, errno, own versus outer policy attribution,
and instantaneous accounting remain unobserved.

Preflight opened the real /dev/fuse character device, loaded libfuse3.so.3,
observed Landlock ABI4 and seccomp/proc facilities, compiled observer syntax,
and ran the pinned production CLI's actual argparse --help without workload.
Creation used explicit Boat --file path=value argv elements (nine text files),
not comma-delimited mounts; no mount configuration or checkout was introduced.
The canonical Boat CLI accepted those exact filename-bearing arguments.
Only the five production sources, original receipt, fixture, manifest and tiny
observer were transferred. Account limits permitted one ttl1800 Boat.

See checks.json and manifest.json for pins; case1.json and case2.json preserve
actual argv, CLI decisions, authoritative receipts, marker and cleanup.
observer.py records the bounded observer; recipe.md documents execution.
Raw API envelopes and local supervisor logs remain separately under the owned
task's e/ directory. lifecycle.json records the delegated snapshot-stop.
