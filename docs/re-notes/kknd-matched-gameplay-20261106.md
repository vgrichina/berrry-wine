# KKnD matched-build attempt: required DDRAW transport failed, 2026-11-06

The single original attempt stopped at the host download boundary with
**HTTP 404 for `/kknd-prerequisite/ddraw.dll`**. I personally reviewed
`first-prerequisite-failure.png` and `terminal.png`. No menu, Walkover,
selection, commanded movement, FPS or audio is proved. No original retry was
performed. This is a run-harness prerequisite provisioning failure, not a
demonstrated KKnD, VERSION, DirectDraw or x86 defect. Production code is unchanged.

Evidence: `scratch/runs/20261106-kknd-matched-gameplay/`. The unchanged original
16-file tree remains at `scratch/game-media/kknd-demo-20261106/installed/`.
All 16 sizes/hashes matched the recovery manifest before and after the attempt:
15,653,500 bytes total. The authentic DX7a package and decompressed DDRAW pins
in [the prerequisite note](kknd-version-prerequisite-20261106.md) also matched.
No source tree archive, game tree copy, DLL renaming, synthetic version,
guest modification, checkpoint registry import or pending rename was used.

## Matched source, controls and first boundary

The coordinator confirmed the assigned slot and D3D0430 → Aranna0500 →
Conan0510 order. Their exact terminal releases were observed in order.
Independent verification found 340 absent recorded PIDs, 21 refused ports,
14 absent profiles, four free locks and no heavy runtime before shared work.
The active window began at 06:25:01Z, with deadline 07:10:01Z.

The pull was already current at `a15c7f867b73bbced023658d93bfac13438f9c92`.
A later coordinator-only documentation commit made tested runtime source HEAD
`299e4eaa2690d8702d2f627bfdbbea3417aef6a4`; relevant runtime bytes stayed unchanged.
Both locked builds passed. Both rebuilt shipped modules passed 72 VERSION
checks each with the unchanged genuine DDRAW 4.7.0.700 input, DirectX system-file
controls, the production parser fixture and builtin execution-policy controls.

Before any browser, the first HTTP preflight refused the dev server's optional
agent-script injection because served `index.html` differed from disk. That
refusal and cleanup are retained under `pre-browser-http-*`; no profile or
browser was created. I selected the existing `noAgentInject:true` server option,
rebuilt under the lock, reran controls, and verified source/helper stability.
This was a pre-browser harness correction, not an original retry.

The source placement, generated mirror and both module stamps matched
`fbae3a59c4fddb48`. Before browser creation, real HTTP GETs of index, host,
region mirror, main include list and both modules matched recorded bytes:

* Standard: 2,178,481 bytes, SHA-256
  `41d3ed6a2b52b46d25550dd54f582c574a7acc48f2024c3e01f878bdafbe470f`.
* Compatibility: 2,181,127 bytes, SHA-256
  `2c94cba0b6138e51d2d69ed19f938f2cb6abd7b83cd3cc0363ce232119cbaf7a`.

The sole browser opened at 06:27:33Z and closed normally at 06:28:17Z.
Chrome was 151.0.7922.108, viewport 1100×850. The launch used the ordinary
registered `kknd_xtreme_demo` entry and required local companions. A small
manifest response added authentic DDRAW as an explicit required file at
`C:\WINDOWS\SYSTEM\ddraw.dll`, with native execution policy unchanged.
The host manifest on disk was unchanged.

The first real boundary is preserved at 06:27:34.919Z:

```text
failed to load 1 of 16 data files:
http://127.0.0.1:44921/kknd-prerequisite/ddraw.dll:
Unable to load http://127.0.0.1:44921/kknd-prerequisite/ddraw.dll: HTTP 404
```

The emulator initialized and logged PE entry `0x004545a0` before the required
data load failed. It did not reach the normal `wine.run` launch after that
load. Failure teardown removed the app; captures contain `apps: []` and zero
trusted input events. No CPU trap or game dialog was observed. The browser was
not cross-origin isolated and selected the cooperative scheduler; the invocation
omitted `--isolate`. Future launches should serve COOP/COEP from the first page.

All 99 recorded actual browser source responses matched. Post-run verification
also matched 319 production/retained-helper/module pins. However, the retained
WASM response observer produced no served-module record, despite initialization
and PE loading. The actual instantiated browser module's hash is therefore
**unrecorded**. Pre-browser HTTP module hashes and focused module tests are
established; they are not substituted for an observed browser module hash.

## Concrete recovery without another original

The retained page-level request interceptor never recorded serving DDRAW, and
the real dev server had no route for its synthetic URL. The failed lifetime
does not retain enough request detail to establish why interception missed it.
Do not infer a service-worker, native-loading or guest VERSION failure.

`recovery-origin.cjs` supplies a real origin route instead. It decompresses
the existing pinned gzip only in memory and serves exact original DDRAW bytes
and a manifest overlay. It neither copies media nor starts a browser. File
declaration includes the exact length and SHA-256, required mode, explicit
system VFS path and `httpRange:false`.

Run the retained file-only control from the checkout:

```sh
node scratch/runs/20261106-kknd-matched-gameplay/recovery-control.cjs --isolate
```

This exercises actual production `host.loadFiles`, not a replacement loader:
the baseline route returns 404; real origin HEAD/GET then return the exact
352,528-byte DDRAW pin; the normal bundle omits that in-memory member and its
ordinary GET fallback succeeds. Required size/SHA validation and the explicit
VFS mount preserve hash
`0a37a508dc6703f0998fb41d8fd5b03d7bbb5d466165dce5b45559d85174ca26`.
All three transport controls pass. No executable, guest or browser is started
by this control. Builtin execution-policy controls also remain passing.

A future separately assigned original must install `recovery-origin.cjs` on
the local server before listening, remove the failed page-only manifest/DDRAW
interception, and use `noAgentInject:true` plus `--isolate`. Preflight real
manifest/GET/HEAD and bundle fallback before creating the browser. Preserve
the source/layout/module guards, and ensure the actual compiled module identity
is captured directly (for example through the existing perf-stream identity
hook) before making any runtime claim. Rebuild and recheck after source changes.
Then attempt menu → Evolved → Walkover and inspect released trusted selection
and displacement with a stable camera. This note does not authorize a retry in
the consumed lifetime.

Git SHA, relevant binary diffs and owned new-file patches are retained; Git is
the source archive. Owned runtime processes, ports and profile are cleaned
before final result publication. Box ID/state/expiry: N/A, none assigned or used.
No subworkers, held-task retries, Heroes II or public deployment were touched.
