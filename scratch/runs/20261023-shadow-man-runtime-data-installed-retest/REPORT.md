# Blocked at API staging; no guest retest

The exact-command data audit found **27 missing mandatory files, 692,498 bytes**:
stdole2.tlb (15,088 bytes), five bitmap FONs, fonts/substitutions.json and 20
distinct subset TTFs. All are available locally and match their Git blob IDs in
intended main 58e90870a40a541a4083cae5e987ca8de31889e6. SHA-256, size, source
path and blob provenance are in required-data-manifest.json. The helper itself
was checked against the same tree. No snapshot, binary download or build occurred.

The one staging API request returned **HTTP 400 sandbox_direct_failed**. It
embedded the original data as base64 in a Python command, making the command
large. An argument-size limit is a plausible explanation, but the API response
does not establish that cause. This request construction was an avoidable worker
mistake. There was no retry or alternate transfer after the blocker.

Read-only inspection subsequently confirmed **all 27 inputs still absent**, all
immutable paths read-only and unchanged allocation. The staged script did not
leave partial data or permission changes. The coherent gate is FAIL at mandatory
data presence; configuration/game commands were never invoked. Zero new guest
instances, windows, input or guest/OS test exits exist to report. Prior JS/PNG/
forwarding/compileguard/canonical fixture evidence remains scoped and unchanged;
it does not make this gate pass.

The source read inventory and line-numbered review are preserved. closure-review.json
classifies the exact parent, possible spawned-child and Worker reads. No browser,
media, compiler or unrelated app mode was added. The planned command is the donor's
original pinned config command, with conditional game launch only after a real
successful configuration within the same aggregate 90 seconds. Neither was reached.

Read-only final checks rehashed 2,083 restored files, matched all 1,959 original
files, verified all 2,045 mutable clone files, 158 runtime paths, 23 codec files,
canonical module and exact original/clone registry. No production source changes,
ownership changes, reclone, reinstallation or original-payload transfers occurred.
Actual registry contains DirectX Version 4.07.00.0700 and InstalledVersion bytes
[0,0,0,4,7,0,0,0]; these are preserved registry data, not newly qualified capability
or an observed DSETUP return. Configuration and gameplay remain unknown.

Whole-local admission includes all six reused donors, root inputs, newly referenced
font/data allocation, tool allowance, task allocation and an internal 8 MiB reserve.
See admission.json, data-admission.json and verification.json. Remote immutable
205,307,904 bytes; mutable used 183,590,912 / 939,524,096 bytes, UID/GID 1000:1000,
mode 0755; fixed 143,360 bytes; free space over 48 GB. The accepted full-copy
projection 885,211,136 remains below the hard tmpfs cap; no material copy occurred.

**Handoff:** bx_rp3s5k54 RUNNING (idle/healthy, stop null), expiry
2026-10-23T01:30:59.916Z. No Node processes or owned command groups. Coordinator
owns shutdown at 00:25 UTC. Historical launch/clone/correction scripts were not run.
Task branch only; no main merge. Publication receipt records the verified remote SHA.
