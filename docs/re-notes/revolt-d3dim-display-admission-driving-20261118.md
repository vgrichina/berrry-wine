# ReVolt D3DIM admission, Worker discovery and shared closure — 2026-11-18

Harness repair `b12b90091826dc92797444e3716bb22c17aaa243` is tested and published. The one fresh original admitted its native display and discovered all three exact-parent empty-URL Workers, then closed on a bounded identity-query timeout before input. Manual driving, paired speed/steering, checkpoint/lap progress and ordinary original Quit remain unverified. No production runtime defect is established.

Evidence: `scratch/runs/20261118-revolt-d3dim-display-admission-driving/`, with `result.json` written last. See [the preceding investigation](revolt-current-browser-driving-checkpoint-20261118.md). Its diagnostic UNKNOWN did not close startup: 54 later passive queries violated closure, with zero inputs. The retained `prior-closure-policy-failure.json` preserves that violation; all post-UNKNOWN material is excluded from acceptance. Neither old nor fresh original scope was reopened or replayed.

## Harness behavior and controls

`tools/revolt-display-admission.cjs` shares a sticky UNKNOWN gate across startup, diagnostics and connection creation. Query exceptions, protocol errors, session mismatches and timeouts close every consumer before another ordinary endpoint/input can be sent. Prearmed independent matching key releases retain their separate transport and exact process/document/endpoint ownership checks; they cannot reopen admission.

Native display admission uses the production current-display validator and completed CPU/readback publication, checking the live native window, process/instance, visibility, source/output geometry, publication and freshness. It accepts a completed ordinary publication after a readback request, or retained already-displayed pixels. GPS presenter ownership is not a prerequisite. Explicit known compositor transactions return NOT_READY for a bounded passive wait; validator failures remain failures. No synthetic PRESENT, forced guest poll/focus/clock, or retired D3D implementation was used.

Worker discovery uses exact page target/parent identity, including empty and delayed URLs. Page replacement/navigation and foreign-parent targets are rejected. Page-session autoattachment materializes only discovered exact-parent targets, without pausing them. Passive lexical endpoint/slot/instance reads determine roles; actual Debugger script bytes recover executing wasm. URLs describe metadata, never identity or a guessed slot.

Validation passed:

- Focused tracked tests cover empty/delayed URLs, replacement/foreign-parent negatives, readback owner/source/freshness, and shared query error/exception/timeout/session closure. Real Chrome error/timeout/replaced-page controls reject all later ordinary calls locally.
- Actual native Device7 textured draw/fence/readback produces RGB565 red through the published software executor. A normal browser PE with its own WndProc and ordinary message pump produces native blue/green/blue input consequences. Authored final `calibration8` proves paired Up+Right with exact independent reverse-order releases, physical neutral, native focus ownership and ordinary Escape `ExitProcess(0)`.
- The authored browser executes real WebGL1 DRAW_UP and READBACK records with zero GPS PRESENT records. The old presenter predicate and Worker URL filter reject this case; the repaired path admits it and recovers actual guest/render wasm `a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`.
- A post-DOWN injected query failure closes ordinary admission; independently prearmed Right-UP then Up-UP still complete and leave physical neutral. There are zero later ordinary requests. Readback/attachment/STATIC-focus/command-file/expected-retirement failures in earlier authored scopes remain closed and excluded from final successful Quit qualification. `admission.json` identifies the successful evidence; selected whole blue/green/blue PNGs are explicitly named there, not inferred from every idle frame.
- `node test/test-revolt-display-admission.cjs` and `flock /tmp/wine-build.lock bash tools/build.sh` pass (`focused-final.log`, `build-qualified.log`). An earlier clean-main timer-export compilation failure is retained separately; its owner fixed it in `0b55b3c2f`. No foreign timer/export/render WIP was edited by this task.

## One fresh registered original

The original used immutable published Git `b12b90091826dc92797444e3716bb22c17aaa243`, normal registered `re_volt_demo` Workers, the unchanged 463 media pins including real Mss32.dll, and the clean module `a6002d5d…`. Authored source `0b55b3c2f` and published runtime graph were compared byte-for-byte before launch. Dirty shared runtime files were excluded, with binary diffs retained. No guest/config/registry/media edits were made.

Predeclared limits were startup 900 seconds, total 1800, Quit reserve 180, terminal observation 60, cleanup 20, transport/capture 3, independent release fallback 5, and maximum gesture 1.4 seconds. Menu review freshness was 30 seconds, gameplay 5. A separate finite disk watchdog sampled at 100 ms and stopped below 1.6 GB; its original minimum was 1,889,705,984 bytes. No limit was extended.

At 09:48:01.595 UTC ordinary native display publication 7 completed after its readback request; canvas2d readback completed at 09:48:01.602. The owner was HWND 65537/process 1000, exclusive source 640×480 with full-source viewport and visible output 752×589. GPS presenter count was zero. `original/startup.png`, personally reviewed whole, shows black game output and startup/mount log, not a race or Demo Mode. Display admission alone proves neither racing progress nor input readiness.

All three Worker targets initially had empty URLs and exact parent page `A69209301A65E2A0331BC3DF304F705F`. Autoattachment later supplied guest/guest/render script URLs. Target `F23049E64DB34B6D2A09182D3926AD89` actually identified itself as auxiliary guest endpoint 2/slot 1; its recovered executing wasm matched `a6002d5d…`.

Request 29, `Runtime.evaluate`, was sent at 09:48:01.909 to session `B0FEAA0D5550E469EDA5861458E1DEC0`, exact target `AB2F192752C5214BD015FC9F17ABFF7D`. Its passive endpoint/slot/instance classification did not return within 3000 ms. UNKNOWN closed the shared scope at 09:48:04.910. There is no raw reply or retained body-entry/body-end marker for that request. The exact expression parses offline, but execution/completion is unknown. The target's role, slot, instance and executing module remain unknown; they are not assigned by elimination. Main and render executing-module recovery is incomplete. Auxiliary module recovery is not substituted for either.

The wire contains 29 ordinary requests total, zero inputs and zero requests after UNKNOWN. Host teardown completed without ordinary Quit. All actual browser/Xvfb/window-manager/supervisor/watchdog/enclosing-launcher/invoker waits include both EOFs; native supervision reports no leak. Postflight rehash confirms all 463 media unchanged. No original retry, race movement, checkpoint or Quit claim follows this closure. The precise remaining blocker is the bounded Worker identity-classification query, not a proved engine cause.

## Recovery and custody

Git is the source archive. `prepared.json`, publication receipts, relevant binary diffs and `owned-new-files.patch` pin sources; retained wasm, authored PE C/DEF/EXE and `native-extra.wat` pin unique inputs. `RECOVERY.md` gives reconstruction steps. Closed request/reply logs compressed losslessly have SHA/size/roundtrip receipts and replacement notices; decompress individually when needed. Final run-local controllers are authoritative over earlier generators.

No agents, Codex workers, boxes, Python, Wine, public deployment or held-title actions were started. Box ID/expiry/stop receipt are null, state `NOT_CREATED`. Foreign UT, AoW2, Hexen and held BloodII work was preserved. Ownership is released after sealing the evidence.
