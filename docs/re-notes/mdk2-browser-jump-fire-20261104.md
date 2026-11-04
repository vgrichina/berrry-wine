# MDK2 original browser jump and fire — 2026-11-04

Reviewed original tutorial pixels confirm one ordinary jump, landing, and a
chain-gun impact on a target dummy. This extends the accepted movement/sniper
result `cb5fb1b71617436d3e042d2582577d632e8c479f`. No production change was
needed. Evidence is in `scratch/runs/20261104-mdk2-browser-jump-fire/` (ignored),
including recovered raw PNG/JSON pairs, HTTP/console/request journals and both
modules. No game/configuration/check patch, cheat or guest-memory write was used.

Runtime source was committed `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`;
relevant runtime source differences from the accepted revision were empty.
Foreign shared-tree WIP was excluded. Exact Git commits and binary diff files
are the source archive; no source tree or media archive was created.
All 29 original media references matched before and after; executable SHA-256
is `b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`.
The runtime's 29 media, two modules and standard typelib references also
matched after execution. Media was referenced by path/hash and transferred
only into the runtime.

Both accepted build artifacts were recovered and fully SHA-256 checked:

| Artifact | SHA-256 | Use in this segment |
| --- | --- | --- |
| canonical | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` | Browser compilation and actual instantiation |
| compatibility | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` | Staged/hash checked; no second game execution |

The observer links the canonical compilation hash to the module sent to each
guest worker and `lib/d3d-render-worker.js?v=dev`, then links each received
module object to its actual instantiation (2,261 exports). The owning renderer
created an OffscreenCanvas **WebGL1** context, with 692,677 drawArrays and 9,291
clear calls at final capture. Actual provider was ANGLE Vulkan SwiftShader
(Subzero), rather than the prior result's Intel Mesa provider. This proves the
browser WebGL1 path on this provider; it adds no hardware GPU, WebGL2, other
backend, FPS or full visual-parity claim.

The original English readme has hardware options but no controls table.
Packaged `scripts.zip` defaultkeys.lua lines 18–20 bind jump to 1001 and shoot
to 1000; defaultkeys2 agrees. mdk2.lua lines 243/248 name right/left mouse
buttons. These agree with the original Customize screen in
[the MDK2 investigation](mdk2-demo.md). Original scripts/localized tutorial
text were decoded in memory and selected references recorded in
`original-control-references.json`; game media was not extracted into evidence.

The ordinary selector Launch → New Game → Medium route was preserved. Frozen
startup used tick 16 ms then 20 ms at the menu, followed the learned logo,
comic, dialogue, title, falling and doorway stages, and reached the tutorial at
batch 27,296. Loading was advanced in sequential requests without repeatedly
capturing unchanged stages. Important inspected PNG/JSON pairs, relative to
`recovery-control/`, are:

| Completed batch | Capture | Observed result |
| --- | --- | --- |
| 29,344 | `tutorial-dialogue-settled-29344` | Grounded before jump; center arrow present |
| 29,352 / 29,360 | `jump-held-29352`, `jump-released-29360` | Grounded; release still queued at 29,360, so no response claim yet |
| 29,368 / 29,376 | `jump-settle-29368`, `jump-airborne-29376` | Queue drained; feet above platform and camera/floor relationship changed |
| 29,504 | `jump-settling-29504` | Landed; original floor relationship restored, health 100 |
| 29,616 | `fire-released-29616` | First short left-button hold released; no clear target impact claimed |
| 29,712 | `center-29712` | Ordinary Up movement reaches center arrow and triggers shooting instruction |
| 30,224 | `targets-30224` | Two upright white dummies appear under red arrows |
| 30,248 / 30,256 | `target-fire-30248`, `target-fire-30256` | After left-button fire, white/orange impact at right dummy and visible sideways reaction |
| 30,264 / 30,328 | `impact-after-release-30264`, `controls-drained-30328` | Button released, queue empty; reaction and ejected floor casings visible |

There was exactly one right-button jump sequence. The file named
`jump-landed-29440` still shows airborne motion; landing is established only
at 29,504. Fire was attempted twice, separated by the actual tutorial stage
change. The first hold is not impact evidence. Original level1.lua lines
2178–2182 require reaching within four units of the center arrow; the following
doctor panel and dummy creation at lines 2232–2240 explain the observed
shooting dependency. Both dummies remain afterwards: no kill, ten-hit counter,
completed tutorial or later jump-platform progression is claimed.

Harness limitations are preserved rather than erased:

- The initial HTTP allowlist omitted the existing standard `stdole2.tlb`.
  Before the first guest batch, its request returned 500 and the optional
  system-data mount was declined. The driver halted; a same-browser CDP
  controller continued without reloading, mounting guest data or modifying
  production code. Provenance metadata was corrected, but the live server's
  original allowlist was not replaced. The initial failure logs are retained.
- An early Puppeteer mouse reconnect lost pointer/button bookkeeping. Its
  failed release and incorrect initial coordinates are retained. Run-only
  control switched to explicit trusted CDP mouse events with persistent
  coordinates/buttons and a corrective release. Later controls were reviewed
  against captures before use; no fresh run was launched.
- Aggregate command 80 timed out externally after requesting 43 sequential
  64-batch steps. Its journal contains 42 completed replies through 14,496;
  the next status establishes 14,560, but the final individual reply is absent.
  It was not retried. The remaining 531 individually recorded completions sum
  to 31,912; adding that status-established 64 yields final 31,976. Every
  recorded request completed its requested count, at most 64. This is a
  disclosed acknowledgement gap, not a claim of a complete request journal.

All 40 observed DOM input events were trusted. At final capture, Enter,
Escape, Up and Down were released, mouse mask was zero, input queue empty and
active input null. Raw before/after pixels distinguish response from delivery.
Run-input JavaScript syntax and Python compile checks passed; all 343 recovered
inventoried files (26,940,005 bytes), including both modules, matched full
SHA-256. No production edit/build or new module build was performed.

Coordinator explicitly released this task at 01:31:49Z. Fresh box
`bx_7hux258g`, TTL 3600, expiry **2026-11-04T02:34:28.943Z**, was recorded with
shutdownOwner=coordinator before execution. One browser segment ran
01:35:43–02:00:28Z, within 25 minutes. Ordinary pause → Quit → Yes was inspected
and confirmed before the deadline, but guest rendering remained black through
31,976; menu return and guest process exit are unconfirmed. Normal
`browser.close()` exited Chrome with code 0; driver PID 6545 was absent and
port 46173 closed. The box was handed back **RUNNING / API idle** for coordinator
snapshot/normal STOP. The worker did not stop, delete or resume it.

The exact historical 27-ID corpus membership and other backend gaps remain
unresolved; see [the corpus status](../gl-d3d-corpus-status.md) and
[the accepted browser result](mdk2-browser-gameplay-20261104.md).
