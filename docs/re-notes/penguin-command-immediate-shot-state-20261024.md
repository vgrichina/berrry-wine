# Penguin Command immediate A-key state, 2026-10-24

**Authentic SDL A delivery is proven. Cannon acceptance or rejection remains
unresolved.** Two authorized guest runs completed; no third run was attempted.
No emulator change, instrumentation, build, state forcing or deployment occurred.

## Captured boundary

The first run hit the authentic executable filter at `0x4031a1`, batch **40033**.
EBX was `0x074ffa44`; its exact 20 bytes were:

```
020001001e01000061000000000000006100e200
```

The event type is 2, pressed byte `[EBX+2]` is 1, and dword `[EBX+8]` is
`0x61`. This is actual guest execution after the filter's type check and
SDL_GetKeyState call, immediately before loading the symbol for its comparison.
At that boundary reverse flag `[0x4130a0]` was 0, active count `[0x4130a4]`
was 0, ammo at `0x410110/114/118` was **10/10/10**, and target
`[0x413e50]/[0x413f30]` was **237/177**. It establishes active filter delivery,
without assuming that later comparison/call instructions executed correctly.

The second run targeted **`0x406ef0`**, the first instruction after the cannon's
ammo store at `0x406eec`. The accepted path also stores the incremented count
at `0x406ece`. This boundary was chosen to witness the accepted stores with
effective cannon EDI, old count ECX and new ammo EAX, rather than infer an
earlier decrement solely from a post-call value. Existing flags were used:

```
--trace-at=0x406ef0 --trace-at-start-batch=39999 --trace-at-limit=1
--trace-at-mem=ebp+8:12
--trace-at-dump=0x4130a0:8,0x410110:12,0x413e50:4,0x413f30:4,0x4d0750:64
```

**There were zero hits at that second boundary.** Its same-run baseline39999
dumps show count0, reverse0, ammo10/10/10 and 64 zero bytes at first-record
address `0x4d0750 = 0x4d0750 + 0*0x7d2c`. No immediate post-write state was
captured. No rejection branch or its operands were witnessed. A missing hit
cannot distinguish a rejected call, an unreached call, or exact-address trace
visibility. Neither acceptance nor rejection is claimed. No generic input bug
or patch is justified by this evidence. Projectile visibility remains unproven.

The first trace used exactly the assigned flags at `0x4031a1`, with EBX20 and
the four requested global dumps. Both runs used one trace address, retaining
the runner's batch size; multiple addresses force batch-size1 and were excluded.
The retained source excerpts bind option parsing, delayed arming, hit limit,
memory expressions and dump behavior to the exact runner. No new trace code
was introduced. The second run adds only readonly baseline dumps to the same
menu/aim/key schedule. Complete actual argv are in each `command.json` and the
two `*-args.json` recipes.

## Timing, inputs and images

Both runs scheduled menu down34000/up34500, aim34800, A-down40000/up40200;
the initial pointer move remained33000. Actual menu down was34004 and
menu release/aim37629. Actual A dispatch was **40033**, keyup **40295** in
both runs, with lParams `0x001e0001` and `0xc01e0001`, hwnd `0x10001`.
The down dispatch clock was8006600ms; up8059000ms. The filter hit's batch
corresponds to8006600ms under200ms/batch. These instrumented timings supersede
the previous uninstrumented40032/40282 for these executions. Delayed trace
arming can perturb execution; identical original actual batches are not claimed.
Buffered input diagnostic lines can appear after the trace line; retain their
embedded batch/clock fields rather than infer ordering from flush position.

Both guests reached the43000 batch cap with returncode0, not a guest exit.
Supervisor elapsed times were1.964s and1.720s (runner measured1.715s and1.493s).
Limits were fixed512MiB arena,512MiB Node oldspace, CPU/wall90s,
guest wall60s and524288-byte output guard. Fresh MemAvailable was checked
before each guest and is recorded in each `command.json`. Both terminal
receipts report no remaining process group.

Only one full unclipped840x660 baseline39999 image per run was captured.
They are byte-identical, SHA256
`95112041c84196db00873e676117ac51d58562a21cabe06f5498d1f4b0504972`.
The reviewed frame shows gameplay and full ammo; it is pre-A and supplies no
projectile proof. Existing trace flags have no breakpoint screenshot action;
no delayed image was substituted for an immediate boundary frame.

## Exact inputs and preflight

Base main: `5691793a58b4670fd2a621114d7926100a1e47de`, read-only donor
`/tmp/input-consumption-clock-independent-closeout-oct24/repo`.

| Input | SHA256 |
| --- | --- |
| Main runner test/run.js | `3c59fd034391e069f24a6047cf96cd8dac84a791d7d7591d55e5f7cb6e161a5e` |
| Historical1879746-byte Wasm | `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686` |
| Original EXE | `14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1` |
| Original SDL.dll | `15537c9176d7e6d5c28c607c4b147c8c2a7c45102b1b8e836b38d2f9449fc8ce` |

This is the previously qualified mixed main-runner/historical-module route,
**not a current-main Wasm build**. Actual new transfer rehash passed all291
files /15760340 bytes. Fresh codec pngjs7.0.0 roundtrip, fonts, rasterCanvas
route, module region stamp9a3bc9149d58209c and accepted291-import/fixed-memory
contract passed. Prior exact-input production-host instantiation evidence is
explicitly reused; no new native compilation/instantiation preflight was added.
The two guest runs themselves used the actual production runner. Actual SDL
load base was0x7be000 in both logs, preferred base0x68100000; EXE entry401290.
The manifest contains all file identities. No packages, media acquisition or
repacking occurred. Source-only compatibility receipts apply to these exact
unchanged inputs, with the same historical-build limitation.

## Validation, resources and handoff

`verify.py` checks the exact filter event bytes, unique hit, both actual A
dispatch pairs, two43000-batch runs, zero second-boundary hits and clean
terminal groups. `verification.json` records the bounded verdict. Recipes,
raw logs, source/disassembly excerpts, input manifest, screenshots and seals
are adjacent in `penguin-command-immediate-shot-state-20261024/`.

Initial admission projected59148948/67108864 bytes including8MiB reserve.
Post-collection projection59709858 includes all local/remote copies, full
session and launcher growth, positive SQLite growth, CLI transport history,
12MB future allowance and the reserve. Resource receipts recheck before
publication; no history was erased. Internal capture remains below the1MiB
cumulative allowance; source slices<=8192 bytes and instruction reads<=65536.
Per-file25MiB and free-space-after-projection2982150144-byte gates pass.
Installed tools and immutable donors are separately standing inputs.

The first cleanup substring probe falsely counted its own Python command text;
its raw receipt is retained. Corrected exact-argv0/runner-argument probing found
**zero owned Node processes**, consistent with both supervisor group receipts.
The assigned box **bx_rcsfy9bm** remains running (Boat API state`idle`, health`ok`),
expiry **2026-10-24T06:12:03.889Z**. Coordinator owns shutdown checkpoint06:00UTC.
All guest groups finished before05:38UTC, well before05:57 deadline. No box
create/resume/stop/delete or public hosting was attempted.

Publication is only private task branch `task/penguin-immediate-shot-state-oct24`;
strict SSH remote-main reconciliation and push/SHA verification are retained
externally in `publication.json`. No main merge. Root and donor tracked files,
indexes and refs remain read-only; only append-only messageboard coordination
was shared. Task ends at the exact unobserved cannon boundary above.
