# SuperTux aggregate chord status, raised landing and ordinary Quit

2026-11-18. Evidence: `scratch/runs/20261118-supertux-aggregate-chord-status-course-quit/` (ignored). The final original scope is `original2/`; `native-outcome.json` records its assertions. This continues `supertux-native-poll-confirmation-contract-course-20261118.md`.

## Cause and repair

The previous jump really reached native USER input return and independent UP. The controller subsequently queried the base chord nonce, but the server retained only child receipts (`base/0`, `base/1`) and a base nonce tombstone. Its known-nonce assertion refused Escape before DOWN. This was a status namespace defect, not expiry. The earlier host-handler reproduction was not native acceptance.

`lib/cli-guarded-input.js` now retains a server-owned aggregate containing its original binding and actual child ticket references. Status derives from these tickets, including their native receipt boundaries. Independent release preserves historic consumption; a complete released chord reports CANCELLED with consumed=true. Partial or applied uncertain effects remain UNKNOWN, consumed=false, noReplay=true. Binding replacement, cancellation and inspection failure cannot manufacture completion. The full base/child namespace is checked and reserved before effects, retained until process exit and unavailable for reuse. No known-nonce assertion is bypassed.

The first new original scope also exposed a separate controller artifact collision: naming a later action `pause-down` reused the earlier pause's receipt filename. Its Down and UP happened before metadata persistence refused overwrite, so that scope closed without replay. `tools/lmarbles-controller.cjs` now rejects previously used artifact names locally before any request. The final scope was a fresh process after this material repair; no closed scope was reopened.

## Verification

- Fourteen focused aggregate cases cover completion/after-release, pending, partial effect, failed edge, lost ACK, cancellation, owner replacement, inspection, base/child/reserved namespace collisions, reuse, foreign lookup and independent UP. These state-machine tests use native-proof-shaped receipts and do not themselves establish actual native acceptance.
- Existing CLI guarded-input and capture-receipt checks pass. Four focused connected-controller cases include zero-request artifact-collision refusal, freshness, partial effect and lost ACK.
- Actual SDL native capture cases `compound`, `compound-release`, `compound-unknown`, `compound-queue` pass in `native-cases/`. The final `native-final-cases/compound/` additionally proves real HTTP base status after independent release, artifact-collision refusal without receipt mutation, then the controller's next Escape reaching native USER return and independent UP. Parent waits exit 0 with both EOFs. Authored fixture screenshots are not SuperTux gameplay evidence.
- Locked `bash tools/build.sh` passes; final directory-level tmpfs build produces wasm `78214bbeca9e136aa0f3bf96cf4fd04abd05e80b485a3c20d3a609f06b7a5116`, byte-identical to the prior restored build artifact. Test-tier and timeout checks pass. No broad unchanged test suite was run.

## Actual original

The final native original used the coherent 253-source d6+09d closure, tested module `0d383140f6d4207d18860e3cb22fc8fcc47a5d260b8d5f2443222396b245fdd5` (2,420,049 bytes), original media verification and the recorded q10000/thread1000 scheduling. `final-source-coherence.json` verifies that only the guarded-input source changed in the pinned runtime closure. The controller repair is separately archived. No recompilation of that original module, mutex/clock/guest-state changes, Wine, OCR, solver or autoplay were used.

All gestures were finite and manually chosen after personally reviewing whole frames. `original2/c1.png` and `c2.png` show course progress; `landed.png` shows settled raised-block landing with **0 score, 0 coins, four lives**. The Right+Space chord has two actual owner-user-return receipts and independent UP. Its aggregate base status is accepted by the next lease; Escape reaches native USER return and UP, and `paused.png` shows the actual native Pause menu. The timer remains 269 across menu navigation.

Ordinary menu gestures select Abort Level, leave the map through Quit Game, select Quit on the title screen, and press Enter. `finalquit-receipt.json` proves final native Enter consumption; its UP is acknowledged. `native-exit.json` records exit code 0 for PID 3963766/start token 306561076 and invocation `6db29389-e936-4fe1-9f84-f9d009e8d4ac`. `native-wait.json` matches that process and records actual wait 0 with stdout/stderr EOF. Native, watchdog, driver, supervisor and detached parent waits all finish without leaks. There is no host-cancel request or terminal-input-failure in this final scope. Browser/display are null: this is the native CLI renderer, not a browser claim.

Seventeen manual gestures produced eighteen DOWN edges. Maximum DOWN ACK was 164.001 ms and maximum UP acknowledgement after dispatch was 652 ms. The 500 ms confirmation and 1750 ms physical-UP limits remain unchanged. This establishes the repaired status path, visible course progress/raised landing and ordinary Quit in the affected original, not merely a host-handler test.

## Preserved limitations and recovery

The prior mutex owner/wakeup explanation remains **unproved**. No applied delayed input was relabeled NOT_SENT. Historical UNKNOWN scopes remain closed.

Failed controls are retained separately: `original-launch-refused/` refused before PE/input when the first build's temporary output symlink was dangling; `native-refined-cases/` refused before native creation after its first module holder disappeared. The first completed original scope proves landing and native Pause but then closes on the artifact collision; its invoking parent tool ended 143 without a separate parent EOF receipt. These are not ordinary-Quit acceptance. The first holder likewise ended 143, sender unknown. Final holder and final original have complete finite supervision/waits.

The first build used output-file symlinks; compiler atomic rename briefly wrote about 4.84 MB to /home. These owned outputs were removed and the prior artifacts restored. The refined locked build redirected the entire build directory, kept new output in owned tmpfs, and restored the exact directory before releasing the lock. /home remained above 1.5 GB. Both build records preserve this distinction.

`RECOVERY.md`, exact Git metadata, relevant binary diff, owned new-file patch, retained unique run inputs, selected named whole PNGs and `retrieval-manifest.json` describe recovery. Large text evidence is gzip-compressed with raw and encoded hashes; every retained file was read back and compared before owned tmpfs cleanup. Git is the source archive; no source-tree snapshots or media bundles are retained. The original module is recovered from the previously retained `20261118-lmarbles-connected-send-freshness-repair-puzzle8/tested.wasm.gz`, verified byte-identical here. No test box was created: box ID/state/expiry/stop receipt are null/NOT_CREATED/null/null.
