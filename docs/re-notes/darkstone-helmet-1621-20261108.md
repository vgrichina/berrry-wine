# Darkstone: helmet restore, second opening and Neophyte’s Cape saved

Restored the actual helmet checkpoint through production HTTP/loadFiles/VFS and
native **Load a Game**, crossed the second stone opening, broke a reviewed barrel,
and collected the native-identified **Neophyte’s Cape**. It equipped automatically
and raised **AC 12 → 14**. Early and final native **New Save** files were retrieved
and independently hashed. No production code changed.

Evidence R: `scratch/runs/20261108-darkstone-helmet-1621/`.
Predecessors: [terminal retirement](darkstone-exit-terminal-20261108.md),
`275dd018aad23b8e2988a78033cddaa2e25d8df3`, and
[bounded browser startup](darkstone-helmet-native-20261108.md), `b3377657b`.
Preparation checkout: `83d6b743334c7b65eb3d5599f35ade21b92a73de`.

## Actual restore and reviewed progress

The selected source pair from Level One’s `new-save-recovery.json`, staged copies,
and restored VFS bytes all matched:

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,204 | `70fcfbe302a9ff1f1b7452223e67e800371086812d679ba04c03d4adffca036a` |
| `game641d_6af08808.sav` | 3,204,341 | `a4ecb215f5ffab7524cc0524c419c46498eb7ef14a0e3f404c880f72a769f45d` |

Before allocation, actual `provision.bytes` yielded a 1,234-byte manifest,
SHA-256 `ce610f155b3cee51bc7ff8b79ac8ee0c2343d30af0a5b5d76dfa452c48ac2b01`.
The local production HTTP handler and remote driver verified those exact bytes.
Production loading mounted fifteen data files; read-only observation at
16:23:33.734 UTC independently hashed both checkpoint files in the actual VFS.
The native Load preview showed the sole LEVEL 1 save and matching corridor.
Ordinary OK restored it. The loading capture retains a pending release; no
further input followed until `restore-live-settled` showed buttons zero and
queue EMPTY, with inventory visibly closed.

Personally reviewed captures under R/review establish:

- `baseline-panel-settled`: **9+0, LIFE 19/35, MANA 25/25, Gold 1532,
  Food 49, AC 12**, helmet equipped and red quickslot vial retained.
- `stone-threshold-walk`: hero approached the second stone arch on clear floor.
  `cross-second-opening` and `new-room-settled`: hero crossed into a newly
  revealed room containing barrels, jars and a wooden container. The later
  capture confirms settled position, buttons zero and queue EMPTY.
- `barrel-native-hover`: exact native hover highlighted the nearest barrel.
  One ordinary click approached it; `barrel-consequence-settled` shows its staves
  and lid with a new white floor object. The other barrel and container remain.
- `drop-native-hover`: native message **NEOPHYTE’S CAPE** identifies that object
  before collection. `cape-collected-world` shows it gone after ordinary click.
- `final-native-inventory`: cape equipped in the body slot, helmet retained,
  **AC 14, LIFE 19/35, MANA 25/25, Gold 1532, Food 47, victories 9+0**.
  `final-saved-cape-room`: inventory closed, buttons zero and queue EMPTY.

No hostile or human was attacked, no potion was used, and no private guest write,
configuration, clock or seed change occurred. Pathfinding continued after some
releases; subsequent captures were reviewed before the next target. Every DOWN
had its independent UP armed first.

One review error is retained explicitly: `final-native-save-menu` still showed
the world, although the input queue was empty. The next Save a Game click was
sent before menu pixels were confirmed. The following capture shows the actual
native New Save submenu, and final New Save was selected from that reviewed
capture. This is not presented as perfect visual admission at every step.

## Recovered incremental native saves

Driver execution began **16:21:59.237 UTC**. Early read-only recovery completed
**16:28:58.373**; unique retrieval and independent hashing completed
**16:29:06.230**: **426.993 seconds after driver start**, or **506.442 seconds
after allocation start**, before minute ten under either reference.
R/early-save-recovery.json retains the reached second-room checkpoint:

| Early file | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,212 | `ab6aeed5b7f22d2ab35908cb1e69c6594683b5e98bb2bdb3abf55b2239237614` |
| `game641d_6af0a33d.sav` | 3,204,341 | `373a1e43dc19e4235abd80f59a78bb648e8cb8b60285fe2810eecf4435ee09c3` |

Final native New Save preserved the broken barrel, equipped cape and room position.
Read-only recovery completed **16:31:54.796**; retrieval and independent hashing
completed **16:31:59.447**, well before the immutable **16:43:39.788** browser cap.
R/new-save-recovery.json selects these `continuationFiles` under R/final-recovery:

| Native path | Bytes | SHA-256 |
| --- | ---: | --- |
| `c:\\dsave\\characters\\characters.lpl` | 1,342,220 | `8dca71058d6e7ce4a1b5e148168e7cbd24043c55501b70f388535396eed4e309` |
| `c:\\dsave\\games\\game641d_6af0a3ec.sav` | 3,204,341 | `787f3c48f60fb174557fe386d7d36ce3a1aec6c33cbb6fc5035b99c41d5f34fb` |

The loaded SAV and original/staged input pair remained byte-identical. The final
pair was **not reloaded**. Next restore must derive a new actual HTTP manifest
for these continuation bytes, then use production loadFiles/VFS/native Load.

## Verification and lifecycle

The immutable selected generation preserves **548 exact providers / 42 helpers**,
original runtime `90c1fcfee91c4680877083e80498afcb73c9384d`, ignored module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`, exact
published kernel `275dd018a`, and endpoint helper SHA-256
`11683651fa033d56f861adeb64a3f46cb8422553b9651ba051f5200111614ecc`.
All providers passed cheap exact preflight and remote verification, and stayed
unchanged. Joined uploads preceded the unchanged shared content publication;
queue and parent both required its exact receipt. Five-file bootstrap and remote
lock preceded provisioning. Seven controls, hover, eleven barrier tests and
accepted kernel/startup/endpoint evidence were reused unchanged by independently
rereading 68 references. No fixture churn, second original or runtime repair.
The published terminal repair's 89 retained artifacts were also independently
hash-checked; selected kernel and endpoint bytes match exact Git `275dd018a`.

R/final-audit.json passes **28 exact command ACKs, zero UNKNOWN, 19 independent
pulses, 52 trusted balanced native events, 28 PNG CRC/scanline decodes**, exact
restored VFS hashes and save recovery. No guest trap, exception or guest process
exit was observed. This was docs/evidence work; no code build change is claimed.
Exact Git SHA, empty relevant final binary diff, small owned helper patches,
provider recovery mapping and existing media hashes are retained. No source
archive, repeated media bundle or peer WIP was copied into the runtime.

Ordinary browser completion was requested. Chrome exceeded the existing 8s/5s
close grace and exited by its driver’s **SIGKILL fallback** at 16:32:27.695.
The initial evidence reader required exit code zero and refused; its log and
remote result remain preserved. A separate read-only inventory recorded the
actual signal without weakening process/port/profile/writer/input checks.
Browser exit-zero is **not** claimed. The unchanged kernel supervisor completed
normal drain: **359 owned tasks / 359 reaped**, exit zero, no remaining tasks,
all recorded PID/start identities independently absent, supervisor absent and
remote lock free. The 58-identity parent census also drained. Both endpoints and
ports closed; profile, writers and held inputs were absent. Kernel fork lineage
was complete for this run; CLONE_UNTRACED flags were not audited, historical
reconstruction and unsupported nonleader exec remain outside scope.

All **335 remote references / 265,799,084 bytes** were uniquely retrieved and
independently reread/hash-verified before normal API stop (278 unique contents,
265,784,546 bytes). The independently observable watchdog was prearmed before
UUID-idempotent allocation; immutable deadlines were browser 16:43:39.788,
independent stop 16:45:39.788, initial expiry 16:46:39.973 UTC. All three recorded
local supervisor/normal/watchdog identities are absent, both roles exited zero,
and supervisor children are empty. No local heavy runtime or local runtime lock.
An initial local finalizer found its board watcher already absent; that harmless
ProcessLookupError is retained, and finalization verified its absence.

Box **bx_5mw95z27** is **archived**, final expiry **null**. Delegated normal stop
**stop_10273603198cf55a** completed **16:34:12.334 UTC**, forced false, error null;
R/stop-receipt.json independently confirms it. No resume, deletion, deployment,
old-box action or subworker occurred.

Next: restore the selected cape-bearing pair and continue from the second room.
Full27, parity, audio and FPS remain open. RELEASE and stop after publication.
