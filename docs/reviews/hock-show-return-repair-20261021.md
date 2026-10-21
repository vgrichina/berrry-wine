# ShowWindow destruction result correction

Production repair `dd6c585bba95422da631fb59a24245f6566135c8` is based on
candidate `c4718fb5204a0f4541c1575e84557cfefad6959d` and evidence
`695c9e8d5b71e0ee5d0974c7b1feb660aa111e22`. It addresses the rejection in
review `601ba885ee4cc1378e5e6a56957d190933f92251`. Main remains
`1d8dbd7a44656178d01869f28869be624a59fa39`; independent acceptance is required.

## Defect and result convention

The shared activation destruction continuation overwrote the saved normal
result with zero. That is a placement/creation failure result, but ShowWindow
must retain its invocation's prior visibility. The frame now owns four cells:
target HWND, destruction result, saved return address, normal result.
ShowWindow captures prior visibility as its destruction result; placement and
implicit creation capture zero. Destruction copies that cell to the saved
result. Both normal and destruction completion release the two private cells.
Target revalidation, final current-client payload, placement failure handling,
and the existing full-HUD correction remain in place.

Only the two changed census producer hashes and their lifetime explanations
changed; 401 boundaries remain inventoried, ownership still pending. The
inherited census mutation test also failed on the unmodified parent: it named
`$handle_ShowWindow` after the producer was extracted into `$show_window_core`.
Its target name is corrected; the mutation and exact rejection assertion are
unchanged. The parent failure is preserved in `inspect-census-test.json`.

## Tests and rejecting controls

The reviewer fixture was reused with only its absolute module-import paths
redirected to the new candidate. It still makes the natural two calls:
SW_SHOWNOACTIVATE followed by SW_SHOWNORMAL, destroying the now-visible target
at WM_ACTIVATEAPP, WM_ACTIVATE, or WM_SETFOCUS.

* Parent repro: each returns 0 instead of 1, assertion exit 1. Receipt
  `cmd_xtnb66gershy` wraps that expected exit in a successful baseline check;
  the complete assertion is in `baseline-review.log`.
* Repaired repro: all three return 1, receipt `cmd_xpbi8cvurmtx`, exit 0.
* Four hidden/visible × activation-pending/complete controls pass on both.
* The maintained regression adds eight destruction cases: hidden/prior-visible
  at ACTIVATEAPP/ACTIVATE/SETFOCUS/MOVE. Caller ESP, EBX/ESI/EDI, released
  WINDOWPOS depth, removed target, and no later callbacks to it are checked.
* Existing placement tests pass: ordinary/unchanged/consumed notifications,
  callback-mutated input snapshot, nested placement, destruction at
  CHANGING/CHANGED/MOVE/SIZE and activation, current startup/queued client
  payloads, and min/max/restore state controls.

Focused mutants reject: `zero-destruction` returns 0 instead of 1 for visible
ShowWindow; `keep-success` returns 1 instead of 0 for destroyed placement.
Both are assertion exit 1, not compilation or fixture failures. Five inherited
rejecting controls also reject: exact main baseline ordinary/startup/queued,
late showCmd snapshot, and stale startup size. Receipt `cmd_8oebxjrvlaaa`
records all seven. Five related regressions pass without skips: placement
client (15 cases), hidden child size, secondary top-level size,
ShowWindowAsync, and GetStartupInfo A/W (134 sparse splits), receipt
`cmd_tieg8to9wsme`. Final maintained regression and census mutation suite pass
in `cmd_00ujxo0jnbbm`; the final canonical build reruns the census checks.

## Canonical build and original held route

`bash tools/build.sh` passed all gates on the assigned runtime, final receipt
`cmd_zqjl8rpyz1fq`, exit 0. No gate was bypassed. The earlier successful build
and an inherited census-test failure are also preserved, not hidden.

* WASM: `f9bd92c5774f3bc332889f8765e75e4f85bef81692314c19186aff1c0dfe1271`
* Compat: `eef7dc134267cb24314e4259c61430566d7d2f05664e8abeb441646dc7a51e05`

All 7,134 candidate source/test hashes match the committed Git blobs and the
runtime files. The parent source is unchanged. All 44 intake entries (39 game
files plus provenance) match the preserved package seals. The route explicitly
loads the freshly built canonical module.

Original held route receipt `cmd_56klxvoae0jd` exits 0 after **45.2245 seconds**.
Inspected selected/final 640×480 captures show the complete score (0/20) and
timer (120 then 86). The original selection, movement and shot-attempt sequence
is retained; no diagnostic resize, game patch or guest-memory intervention.
This is bounded full-HUD/input regression evidence, not scoring, completion,
audio quality/synchronization, FPS or exhaustive Windows parity acceptance.

## Explicit historical evidence supersession

The old committed archive remains unchanged, SHA256
`203f313aa3936e9c8b9e2cdb12e015e135c1ef333286017d5b9642ae4643a5b6`.
Its blanket 40-file seal acceptance is superseded by this reconciliation.
38 original entries match; these two do not:

| File | Manifest/original SHA256 | Archived replacement SHA256 |
| --- | --- | --- |
| controls.json | 748c4165cb5aca257fd0a69ce22a18079d4fcb15541b75b20520f781477348f1 | 9825e51f8d5ef4f2ac4dba1749a2ef93d1c5f6d9b0fca1e4c20bb46fecfb50e0 |
| related-tests.json | 077469fde06b50a59b845e21f01f7805acd2b6e67bbbdcec4ab3c36d22621883 | 3a7c50fd8ccc9ee4ffcc3d66f243fad4925a55a14389c31e1e6d6f02728aec40 |

The archived replacements are byte-for-byte Boat command receipts
`cmd_dmv9uewddkkg` and `cmd_g4bxhh88vpnb`, identical to their local originals.
The preserved test-summary arrays, checked locally and on the runtime, match
the old manifest hashes exactly. This identifies a receipt/summary publication
path collision after sealing, not a changed test outcome. Receipt stdout and
per-test logs agree with the summary results.

Sibling `hock-placement-notify-repair-20261021-corrected-evidence.tgz` restores
the original summary arrays, retains the displaced receipts under
`publication-receipts/`, retains `original-SHA256SUMS.json`, and includes an
explicit RECONCILIATION.json. Its new manifest verifies 56 files. Archive SHA256:
`a9a493af033ed4a14ab228e619f0bcb6a87e01b6355c37940ad251732ea79427`.
This separately published historical correction does not accept the defective
old production candidate or retroactively rewrite its claims.

## Recovery and handoff

New evidence: sibling `hock-show-return-repair-20261021-evidence.tgz`, with
separate remote evidence and command-receipt namespaces and a verified manifest.
Local run: `scratch/runs/20261021-hock-show-return-repair`; RECOVERY.md records
commands and original sources. Remote candidate/evidence:
`/home/user/hock-show-return-repair/{repo,original-held}` on **bx_3f3x23m3**.
Modules/assets are not committed; canonical rebuild and sealed intake recovery
are required if the runtime expires.

Box left running, expiry **2026-10-21T05:56:19.894Z**. Coordinator owns shutdown
and independent acceptance. No main merge, worker launch, lifecycle operation,
deployment, shared configuration or unrelated WIP changes. Local allocation
and final remote refs are recorded in publication.json. This single task stops
after preservation; no new task or game is selected.
