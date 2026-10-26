# Bounded immutable Ricochet capture readback

The parent controller's external `readfile(target, local)` adapter required 90
sequential API roundtrips for its 401056-byte menu PNG and wrote the destination
before hash verification. This change supplies `tools/boat-capture-readback.py`
and wires the real adapter interface in
`test/fixtures/ricochet-serial-controller/{read,work}.py`. The completed parent's
directory is untouched. `serial.py` is retained byte-exact; its synchronous
guest-control path is unchanged. There is no emulator, input protocol or oracle
change, and this task made no Boat/API/guest invocation.

The caller must freeze the artifact and serialize guest commands first. Pass the
controller's remaining **monotonic** deadline to `readfile(..., deadline=...)`;
the standalone adapter defaults to a 30-second readback budget. It issues only
read-only Python file operations, never guest controls, steps, input or captures.
Parallel reads require permitted API concurrency. Any real denial stops the
operation; neither helper nor adapter retries or switches transport.

The helper keeps at most four active/pending jobs, replenishing only completed
slots. Validated exact size determines all offsets, lengths and the final short
chunk. Each request retains the 4500-byte raw chunk and 8192-byte full-response
ceiling; artifacts remain limited to 2 MiB. It checks regular-file device/inode,
size, mtime and ctime before and after hashing, around each chunk, and in final
metadata. Metadata hashing reads at most the originally stated size, never an
unbounded growing stream (two metadata hashes plus exactly one artifact's worth
of chunk reads). It validates API success/truncation fields, strict canonical
Base64, exact chunk lengths and the final local SHA256. A private temporary file
is fsynced and atomically replaced only after all validation and a deadline
check. Rejection preserves any existing destination and removes the temporary.

Subprocess jobs use structured local argv and separately quoted remote Python.
Pipes are nonblocking and bounded. Deadline/failure cancels every active job,
kills its owned process group and reaps the direct child with a bounded wait;
there are no worker threads or 90 prequeued futures.

## Focused offline acceptance

Run `python3 test/test-boat-capture-readback.py -v`. All **8 tests passed** on
the final helper and adapter. `source-manifest.json` binds the exact source and
fixture bytes; `final-test-results.json` retains metrics/completion offsets.

The unchanged 640x480 PNG is 401056 bytes, SHA256
`9e6b81e080cfa6476fdd76ef4093217b43567e37f9d9f7fcd69cc021d1541d88`.
Both serial and four-request fixture paths returned byte-identical data with
90 chunks and two metadata requests. The final chunk is 556 bytes. Out-of-order
completion was observed, while active and pending counts never exceeded four.
The largest simulated full API response was 6317 bytes.

| Offline fixture | Chunk waves | Actual elapsed | Max active/pending |
| --- | ---: | ---: | ---: |
| Serial baseline | 90 | 0.669738 s | 1 / 1 |
| Bounded parallel | 23 | 0.127482 s | 4 / 4 |

These are measured **offline simulations**, including local execution of the
generated read-only Python. Waves are causal request-depth measurements; they
exclude the two serial metadata calls. No remote speed or gameplay claim follows.
A second test transported all 90 chunks through actual local Python subprocess
pipes with the same complete JSON response encoding.

Nineteen injected rejection types were checked with both absent and existing
destinations: transport error/denial, stdout/stderr truncation, invalid and
noncanonical Base64, short/long chunks, wrong offset contents, bad digest,
changed metadata/inode, oversize/invalid metadata, response overflow, invalid
JSON, timeout/launcher flags and missing flags. Additional tests mutated/replaced
the actual frozen-file fixture between metadata and chunks, tested real local
subprocess exit/stderr/overflow/JSON failures without retries, empty artifacts,
unsafe target paths, shell-sensitive filenames, and expired/invalid deadlines.
No case issued guest input.

One owned blocking request ignored SIGTERM and forked a child. The controller
rejected at its 0.3-second deadline, returned in 0.301541 seconds, killed the
owned process group, reaped the direct child and left no owned live child.
Pending jobs were canceled; no partial destination remained.

The first local pipe fixture failed because executing the generated program in
the wrapper's namespace replaced its StringIO variable. The retained first
failure and output document this; isolated execution namespaces fixed the test
fixture. Passing groups were checkpointed and reused; the final suite reran
after bounding the helper's metadata hash reads. No broad suite or guest rerun.

## Pins, resources and handback

Parent: `283eb307e139b9deacd6c9921706e4b8427c8f0a`, published branch
`task/ricochet-serial-progress-gameplay-api-oct26`. Runtime source
`754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2` and runner SHA256
`87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7`
are unchanged. Reuse the parent's five passing cmd/deadline validator cases and
seven acknowledged serial steps/nine zero-credit snapshots; this task does not
repeat them. `input-hashes.json` identifies the exact parent files read.

The source/controller tests sampled 75321344 bytes peak process-tree RSS,
0.90 aggregate CPU seconds and 2.210 supervisor wall seconds, within the 128 MiB
test allocation, CPU90/wall120/file24MiB/output2MiB controls. Python child DATA
was bounded to 96 MiB; Git DATA512MiB is applied only to Git children, with
physical Git512MiB serialized against tests. No Node execution was needed.
Fresh admission and accounting receipts cover own selective Git/source/evidence,
session/events, positive WAL growth counted once, 32 MiB publication/future
growth and an 8 MiB reserve inside the complete 128 MiB allocation. Standing
read-only donor data is excluded. The admission helper was corrected to retain
the launch receipt's conservative 3489660928-byte minimum; all measured
executions already exceeded that minimum. No denial or user limit was relaxed.
Final accounting and exact remote publication receipts accompany closeout.

No box was created or queried. The parent's last measured state was
`bx_ex22dvm8 RUNNING`, expiry `2026-10-26T22:31:02.949Z`; the coordinator owns
its cutoff/shutdown. That historical state is not a current-state claim.
This worker leaves lifecycle ownership with the coordinator.

The next gameplay gate requires a separately assigned, freshly admitted guest
attempt: freeze and inspect the menu early, consume a timely production `cmd`
decision with acknowledgment, then demonstrate Play Game / Anonymous Guest /
round / paddle-and-ball gameplay. None of those gameplay steps is accepted by
this offline implementation task. Main/public deployment and worker refill are
outside this assignment.
