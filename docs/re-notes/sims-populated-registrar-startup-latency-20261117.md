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
