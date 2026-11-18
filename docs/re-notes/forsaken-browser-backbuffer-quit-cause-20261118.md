# Forsaken ordinary browser Quit: concrete guest fallthrough, 2026-11-18

Ordinary Quit still terminates the original with **ExitProcess(13)**. This is an error exit, not clean Quit. The captured first render-ready transition is the original guest's deliberate shutdown store at `0x4247d9`. Device cleanup succeeds; the same active render invocation then falls through to ShowBackBuffer with rendering disabled. No production runtime repair is justified by the captured API returns alone. This task ends at that bounded cause, with the missing expectation around the caller's post-shutdown guards still requiring reference evidence.

Evidence is `scratch/runs/20261118-forsaken-browser-backbuffer-quit-cause/`, sealed by `result.json` last. This is a fresh scope, not a replay of the predecessor's closed scope. Prior world/combat, native-exit-repair, clean-exit and pinned-Quit notes were read. The predecessor's module3616571e and 873 media pins are contextual evidence only.

## Tested graph and normal gameplay

The immutable published graph is Git `30d1f8d8c20be3eee960dff0599eb3d54b079fcb`, compiled to 2,418,137 bytes, SHA256 `d8e7c4b0fe678597cfeedc7af57c91659c6c13bc76260d55826c21cfcb647490`. `prepared.json` pins its complete browser runtime closure. All 873 predecessor media pins were checked before and after execution, including original EXE SHA256 `366ec5d0943daca839836296f9fb52724e94dc155630c6b0c30d7181106b5e24` and browser manifest `587ce145ab73a3fed2c7136425bb6a7bcf28def312d430c8bf7d1be802b2260b`. No guest binary patch or media copy was made.

The normal production route uses `debug&threads&no-log&d3d-renderer=webgl&gl-renderer=webgl&app=forsaken_demo`, default 100000 slicing and normal CPU Workers. The late inspection finds four live Workers (three guest, one render) with the tested module hash; two already closed Workers have no inspectable module and remain unknown. Actual D3DIM device stats report Worker-backed WebGL1, ANGLE Intel Mesa UHD620. Stats are cumulative, not action-local: 205347 draws, 5694 presents, 5621 readbacks. The separate endpoint adapter snapshot is null; no adapter success is inferred from it.

Authored whole-display calibration2 proves blue-to-red Enter, balanced A/Control/Space and Escape exit0. It precedes the original run. Its module matches the original. The original route is Single Player → Start Normal → Volcano → Enter, Control800ms, A800ms, Escape → Up → Quit to Main Menu → Enter, Up → EXIT GAME → Enter, then promotion Enter400ms. Eleven gestures produce 22 trusted physical key events, each with a separately prearmed release process, actual wait and both EOFs; passive key states are zero.

Selected original whole captures:

- `loading.png`: readable starting room, lives5, shields/hull128, PULS2000.
- `after-primary.png`: readable room, PULS1992.
- `after-forward.png`: closer doorway and incoming fire, player shield reduction, PULS1992. Enemy damage/kill is unproved.
- `pause.png`, `quit-main-selected.png`: original green pause menu over white background. Whitening cause is not established here.
- `returned-main.png`, `exit-selected.png`: complete original 3D main menu and highlighted EXIT GAME.
- `promotion.png`: original promotion; final Enter follows review.
- `ordinary-quit.png`: whole shell after actual process exit13. The shell's teal area is not a gameplay-success claim.

Some command review strings misdescribed text/ammunition/shields. They remain intact; `review-corrections.json` corrects those transcriptions from the images. Chrome stderr also contains non-power-of-two texture errors. These may matter to rendering investigation; they are not evidence that those errors caused the captured Quit path.

## Exact shutdown chain

The run-only import observer calls each original import once, preserves returned values/thrown errors, and reads memory without writing guest state. Its inactive prefix is prepended to immutable `guest-worker.js`; `observer-response.json` pins original/prefix/served hashes and verifies the unchanged original suffix. Existing API/block diagnostics are armed only after gameplay, before EXIT GAME, to include the first shutdown transition. The WASM remains unchanged. Native fake-import passivity/return/error and signed COM-marker controls pass. This observation adds overhead; it is not an uninstrumented timing-equivalence proof.

`original/trace-1.json` retains main-Worker sequences163954–172145, contiguous, with no observer errors. Earlier ring history was overwritten; preserved milestones retain observed flag changes. Sequence numbers below are local to this Worker, not a cross-Worker clock. Original executable disassembly is retained in `original-disassembly.txt`; `causal-sequence.json` selects the relevant rows.

| Stage | Actual evidence |
| --- | --- |
| Last present | Surface_Flip(primary `0x8222030`, back `0x8222038`, flags1) returns0 at171239; ShowBackBuffer returns TRUE. |
| Surface health | Primary/back/depth IsLost all return0 at171268,171273,171278. |
| Final render callback | `0x4635f0` runs with game status0x34; block4636ed sets quit request `[0x7a4e4c]=1`; return to42746e is TRUE at171311. |
| Shutdown selected | Caller427489/427492 enters428ad7, clears quit request, and calls cleanup4247d6. Rendering is still TRUE at171348. |
| Exact false writer | At4247d9, original `mov dword [0xe774b4],0`; then4247e3 clears another flag and4247ed calls43ded6. At43ded6/171349 rendering is FALSE. No intervening API or guest callback separates the observed before/after blocks. |
| Resource callback | Dispatcher43ded6 decrements `[0xe75b68]` from1 to0 and invokes `[0xe764a0]=0x4273b3`. This before-device-destroy resource callback releases resources and returns TRUE at171780. |
| Display cleanup | RestoreDisplayMode returns DD_OK0 at171806. SetCooperativeLevel(this `0x8222020`, HWND NULL, DDSCL_NORMAL8) returns DD_OK0 at171809. Cleanup returns TRUE at171820/171821. COM Release results are reference counts, not failing HRESULTs. |
| Quit posted | PostQuitMessage(0) at172009 returns; shutdown returns to the still-active caller at4274a1/172012. `[0x79306c]` is1, `[0x7928a0]` is0. |
| Fallthrough | Executed4274b7 →4274eb →4274f4 reaches ShowBackBuffer42420b at172016 with rendering FALSE. The guards do not skip this call. |
| Error path | False branch42421a builds “Cannot call D3DAppShowBackBuffer while bRenderingIsOK is FALSE”; ShowBackBuffer returns FALSE at4243b5/172023, caller427506/172024 branches to error handler428b2a. MessageBoxA occurs at172061; ExitProcess(13) occurs at172144. Host terminal state independently records processExited=true, processExitCode=13. |

The writer identification combines an actual observed before/after boundary with the straight-line original instructions; it is not an instruction-by-instruction watchpoint claim. The observer's legacy raw field labels `sceneCallback`, `destroyCallback`, `sceneNesting` mean device-create callback at0xe75b60, device-destroy callback at0xe764a0, and resource callback count at0xe75b68. They do **not** mean BeginScene/EndScene nesting. No BeginScene/EndScene appears in the retained tail; early gameplay scene history and callback creation precede it and are unproved. The last promotion render uses DirectDraw Flip. Some debug strings overwrite the observer's current API label; decisive returns above are corroborated by adjacent original block flow, not assumed perfect pairing for every log row.

Between PostQuitMessage and MessageBox there is no retained PeekMessage/GetMessage, present, or DestroyWindow. Posting quit does not unwind the current call. Microsoft documents [PostQuitMessage](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-postquitmessage) as posting WM_QUIT and returning. [SetCooperativeLevel](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdraw7-setcooperativelevel) permits NULL HWND with DDSCL_NORMAL and defines DD_OK as success. [RestoreDisplayMode](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdraw7-restoredisplaymode) restores the display mode and returns DD_OK on success. These later-interface documents support the base API contract interpretation, not an original Windows execution comparison. They do not require cancellation of the current guest render call.

## Bound, validation and next cause

The concrete next question is why the original caller4274a1–427501 does not skip ShowBackBuffer after successful shutdown428ad7. A real Windows VM trace of this same demo/UI route should compare the final render status0x34, quit-request store4636ed, cleanup entry, caller guards `[0x7928a0]`/`[0x794c80]`, and any synchronous window/message callback during display cleanup. This distinguishes an earlier runtime callback/message omission from original guest fallthrough behavior. No Wine ground truth was used. No unsupported guest patch, error suppression, surface pinning or rendering/music/input-clock forcing was introduced.

The authored controller fixes startup180s, original1200s with240s reserved for Quit, cleanup20s, terminal60s, captures10s, transport15s, release fallback5s and maximum hold1800ms before execution. The independent watchdog also checks the disk floor. Original execution lasted about288s. Calibration2 and original retain actual browser/display/release/watchdog/supervisor/enclosing/invoker waits, both EOFs, process-tree absence and private-display cleanup. Their enclosing tool waits are0. Initial calibration's outer tool returned143 despite internal zero waits/cleanup; its missing enclosing wait and unknown cause are explicit. That scope was never queried after closure. No UNKNOWN scope was replayed.

Focused modal-postquit and DirectDraw-mode tests pass, final observer controls pass, and `flock /tmp/wine-build.lock bash tools/build.sh` passes. The shared working build differs from the tested immutable graph; `binary-diff.json` and relevant worktree patches record that distinction without adopting foreign WIP. There is no runtime change, so native/browser oldfail/newpass and runtime repair negatives are not claimed. Foreign UT, BloodII, host/render and callback-review work remains untouched.

No box was created: ID null, state NOT_CREATED, expiry null, stop receipt null. No deployment or held-title investigation. Evidence hashes, source recovery and finite actual waits are retained in the run. Only this report is published.

The board watcher's enclosing tool returned143 and its child wait/EOF receipt is missing. A postflight process check finds no remaining matching watcher or tail. Complete board-watcher lifecycle evidence is not claimed; this is separate from the original runtime's fully retained zero-exit enclosing waits.
