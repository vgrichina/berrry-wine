# Sims populated registrar startup, 2026-11-17

Evidence: `scratch/runs/20261117-sims-populated-registrar-startup-latency/`.

The preceding original genuinely timed out after 10,008 ms; its registrar
published 293 keys 8,791 ms later. Five native ordering controls already passed.
This work changes startup preparation, not process signals, registry merge order,
or the original guest's 10,000 ms timeout. The separate non-Automation
ISetupServiceProvider proxy-registration failure remains open.

An authored native parent launches the genuine IKernel RegServer with the real
Disc1 mount, inherited D:\Setup, populated system filesystem and registry. An
initial profile measured two full source scans (925 and 1,005 ms) within a
2,105 ms readonly restore. Module/import preparation took about 667 ms,
compilation 34 ms, VFS enumeration 8 ms, and registry import 8 ms. This run
reached registry import in 2,876 ms, so it does not explain the whole historical
15,626 ms delay. Later paired profiles also record main-thread scheduler wait;
shared scheduling varies substantially and is not attributed to hashing.

Previously non-ISO restore checked every source hash before analysis, then
remember() hashed all sources again while binding the real provider owners.
Restore now retains the fresh pins and binds them to the actual reopened
providers with rememberPinned(). The existing one-use preparation worker also
supports CUE/BIN plans, overlapping a fresh complete hash with host construction.
There is no digest cache. Final path identities, live descriptors, remounted
namespace, readonly policy, volume/disc metadata and file timestamps are still
checked before adoption. Cancellation or transfer mutation during asynchronous
CUE analysis also prevents adoption.

A Git-backed old-code regression reads 103,626 source bytes for a 51,813-byte
authored CUE/BIN; the fixed fallback reads exactly 51,813. The prepared route
rejects corrupt digests, replaced sources after worker exit, active/completed
cancellation, context mutation, namespace collisions and revoked live providers.
Two additional real-media comparisons reached registry import at 1,403/1,357 ms
with preparation versus 1,869/1,679 ms with a serial single scan. Broader paired
measurements under changing scheduler load are retained without asserting a
stable whole-launch speedup or resolution of the historical scheduling delay.

Native controls verify genuine registration of 293 keys before process-wait
success, exit-37 failure without registration, and a genuinely runnable authored
child whose real 10-second parent wait returns WAIT_TIMEOUT while STILL_ACTIVE.
The last control computes until TerminateProcess; it uses no sleep or registry
seed. Termination code 37 and later actual close/publication preserve the absent
class. Early event-based fixture attempts are excluded: unnamed infinite waits
were completed by existing local behavior and the named-event fixture returned
an error on the pinned module. Neither is attributed to startup or repaired here.

The five ordinary native normal/dialog/visible/failure/poll controls and the
canonical locked build pass. The produced compatibility module is byte-identical
to the prior qualified module (SHA-256 3e0887b2424d3aa9f90f5707425c75e71b680128a06b52bc199edb66a008301e),
so unchanged proxy, input-guard, BW2 and native-module evidence can be reused by
hash. NV's published desktop preparation is reused without changing its hunks.
The authorized original run is recorded separately in result.json when finished.

## Published fix and the authorized original

Fix `5ec45cc69` is published on main. The one authorized normal original used
the unchanged qualified module and ordinary real ticks. Caller arguments were
validated and the exact native PID exclusively owned the loopback listener before
capture. NV's active scene-module WIP was preserved: the previously qualified
published scene (Git b2118cb19, SHA-256
5a62a5ec9fc542305219719b09fc2ce0c45305664f3d64dab6af20b871f489cd)
was loaded directly from Git in memory, with per-process execution-source pins.
No source tree or media was copied.

The genuine registrar reached registry import in 1,024.9 ms and exited normally.
The parent merged 293 keys, then its original 10,000 ms wait returned success
after 1,744 ms. The original launched the genuine -Embedding child and its
CoCreateInstance returned S_OK. That child subsequently failed with
`COM continuation: unsupported yield 12` in NativeAutomation.invokeStub,
through ComInterfaceRuntime.service and ComOwnedProxyHost.invokeStub. The
owner continuation rejects an unsupported reason without restoring its saved
CPU frame. This is the demonstrated remaining execution blocker; it is not
reported as the separate authored non-Automation provider's missing proxy.

The personally viewed complete bootstrap PNG shows the Sims backdrop,
InstallShield progress window and error "An installation support file could
not be installed. (0x80010108)". A fresh full image after permanent binding
was entirely teal, with no visible close target. The session became terminal
UNKNOWN, with zero physical input and no later HTTP queries. No installation
or native Quit is claimed. After host cancellation, the unsupported continuation
left the embedding process live; identity-checked SIGKILL retired that child,
then its parent recorded actual close/both EOF and exited 0. The registrar,
embedding child, parent, helper, watchdog, supervisor and outer waits are retained.
The failed embedding child had no completion marker and its state was refused.

Host provider/media hashes remain unchanged. Provider omission is execution-only;
the embedding SIGKILL prevents its exit-only provider audit, so that missing audit
is explicit rather than reconstructed. Its inherited preload enforces the same
read refusal before main startup. Full T-db74d863 and original BW2 setup remain
open. No box was created; its ID and expiry are null and stop is not applicable.
