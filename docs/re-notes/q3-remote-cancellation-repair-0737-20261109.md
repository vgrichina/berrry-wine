# Q3 remote cancellation repair — 2026-11-09

The offline composed boundary reproduced missing cancellation propagation. The
owned client rejected its pending local command when its launch transport exited
or reached EOF, but the independently running generated remote parent and Node
consumer continued. The pending remote command subsequently wrote its capture
and successful numbered ACK. Local transport cancellation alone did not revoke
that remote work. This repairs that demonstrated binding; it does not explain
historical0052's SIGPIPE or recover its missing waits.

Evidence: `scratch/runs/20261109-q3-remote-cancellation-repair-0737/`.
`old2` executes the original caller/composer, with only the Q3 custody provider
pin refreshed to current source so composition can proceed. Both exit and EOF
controls produce the later capture and ACK0. `paired-old` also exercises pending
CDP: the original unbound caller path remains active after local terminal, then
an explicitly released inert protocol response permits the later effect. This
control leaves the new consumer cancellation check inert because there is no
caller-to-remote cancellation binding. It preserves the actual generated parent,
numbered sender, prelaunch barrier and composed consumer; no historical input
file is edited.

`q3-native-launch-client.py` now binds one run-scoped cleanup operation alongside
both retained real remote call sites. First local terminal dispatches a separate
remote cancellation publication, outside ordinary command admission. Publication
is sticky and wakes the remote numbered ACK sender with failure rather than an
ACK. The exact generated remote launch-parent code is amended at its unique
pump/wait site; unsupported source fails before dispatch. Its nonblocking,
bounded log pump observes cancellation independently of log bytes or EOF. It
signals the actual native runtime supervisor only after the runtime identity,
current PID/start and matching kernel-armed supervisor receipt agree. Waiting
for kernel arming avoids killing the reaper before its signal handlers exist.
SIGHUP/TERM/INT received by this parent also request cancellation. The parent
joins its actual prelaunch child and drains its pipe; the original runtime and
prelaunch parent-wait receipts retain cancellation status1, independently of EOF.

The Q3 composer observes the same marker during idle work and before execution,
CDP sends, captures and cancellable waits. First terminal evidence remains
sticky; pending promises reject and later work cannot resume into a capture.
Normal Browser.close keeps its existing handling. Native custody is unchanged:
its real pending fork messages, queued CONT fairness, actual waits and command
EOF determine drain. No command/CDP/ACK, browser-close, runtime or cleanup cap
was extended. A cancellation publication is not a remote custody receipt. If
that separate cleanup transport fails, remote custody remains UNKNOWN and the
independent runtime/watchdog deadlines still apply.

`accepted-final` passes all four cancellation cases: exit/EOF during a passive
command wait and exit/EOF during pending CDP. No later capture or successful ACK
is written. Full observed cancellation/join intervals were0.29–1.42 seconds.
Native ownership/reap counts were26/26,19/19,26/26,26/26; each drain is complete,
with command EOF true and no missing waits. The normal bound-parent control
retains successful quit ACK, runtime/prelaunch actual wait0,26/26 native reaps
and separate command EOF. Every accepted fixture's independently dispatched
remote sender, generated parent, local transport and prearmed observable
watchdog has an actual wait receipt. Local client cleanup still reports remote
custody UNKNOWN. Pre-cancel executes the actual generated source and refuses
prelaunch with zero children; earlier failure content and cancellation publication
remain unchanged. Unsupported generated parent source is refused.

The existing launch-client suite passes its SIGPIPE/exit0/exit7 pending and
before-next controls, two normal numbered requests, EOF-before-exit and held-pipe
cases. Missing EOF remains false at the short test cleanup cap. The eight-case
actual composed-driver suite passes, including delayed startup, pending CDP,
command wait, missing preload and the unchanged30-second drain failure. Ten
prelaunch audit-hook controls pass, now including missing cancellation-helper
refusal. The helper must be included in a fresh strict manifest and uploaded
before any separately authorized runtime; an old manifest cannot authorize these
new bytes. The required locked build passes with unchanged CPU output.

Exact current custody tested is SHA256
`5ec810c4d4704ff86afc367b38f7335edf1214e3450ebb98a62ce3df6386b5fe`
from `c4b4cd337d5c21ef27441451d56596ffc96c46b6`. Revision
`4341b87723a7d56bc98223215cca4cdc878fcae2` has custody SHA256
`d38f2092c7fc0d5b1e4caabf2bd21040167d4f147c55186fd6e4a39cd00a4636`;
it was not substituted or retested here. The actual0052 retained manifest pins
still older `fb670a47d4712aa44fd2fae3d2047587374c0e1c2bb4e927ff87572147dfcfff`.
Its133 recovered remote artifacts and451 inventory files were independently
reread with stored/original SHA256, sizes and gzip CRC checks. Its33 missing
waits, command EOF:false and incomplete custody remain UNKNOWN. No historical
creator, wait or SIGPIPE cause is invented. Marker SHA256 remains exactly
`1858eea7efb8875e44088ffe9f5ea434c3b22915444113204fb51673e4f5ac0d`;
CPU remains2185596bytes, SHA256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.

Development failures are retained separately. The first fixture manifest omitted
the composer and failed before runtime. A misleadingly named `fixed` run omitted
the selection flag and is another old control, not new acceptance. Later,
`paired-fixed` exposed a cancellation output parameter shadowed by its file
handle; this was corrected before `fixed-final`, `accepted` and `accepted-final`.
Its cleanup timed out before recording the independent remote request's actual
wait; its watchdog fired and lacks a parent-wait receipt. Those two development
fixture waits remain UNKNOWN. Physical absence and complete native drain do not
upgrade them. A reader attempted CRC validation of an actively written gzip log;
completed-stream validation supersedes that premature read. These are excluded
from accepted oldFAIL/newPASS evidence.

Recovery uses the recorded Git base plus small relevant binary diffs, including
new owned files, and small generated fixture inputs. Existing source/media/module
paths and hashes are referenced; there is no source-tree or repeated media/module
archive. Streaming test/build/remote logs are gzip from first byte; the existing
client also retains its small buffered protocol result files. No browser, guest,
game original, box, agent, worker or deployment was started. No Q2, Redline, NFS,
shared host/WAT, HeroesII or CLAUDE source was edited. Free `/home` stayed above
1.5GB. Box ID/state/expiry/stop receipt: NONE / NOT_CREATED / N/A / N/A.

Next requires separately authorized fresh-manifest remote qualification, including
actual Boat cancellation-delivery receipts. The offline fixture deliberately
separates transport from remote executor; it does not claim Boat itself delivers
signals on disconnection, instantaneous revocation at the local timestamp,
normal Chrome close, or original-game acceptance. No original retry is scheduled.
This single task stops after publishing the tested repair.
