# MCM explicit reviewed gameplay keyboard context

Evidence: `scratch/runs/20261120-mcm-quarry-keyboard-reviewed-context-implementation/`.

`tools/mcm-gameplay-reviewed-context.cjs` adds the explicit
`mcm-gameplay-keyboard-reviewed-context-v1` capability. Its private one-use
handle binds one personally reviewed complete source to one exact key, VK,
physical code, duration and nonce. Allowed keys are the four arrows and Escape;
holds are 50–1500 ms. Source age is strictly below 30 seconds, review age below
15 seconds, and each newly captured current frame below 5 seconds. Reviewing
again cannot renew the original source timestamp.

Animated source/current images may differ. Both complete frames, hashes,
capture-start times, completion times, private owner identity observations and
review metadata are synchronously retained before dispatch. The proof explicitly
says `exactWholeRGBA:false` and does not claim the current frame was personally
reviewed. The production image sink writes exclusive read-only files, fsyncs and
verifies their hashes. It retains each unique complete PNG once.

The opt-in MCM chain reads the actual page, CPU Worker and renderer Worker,
recovers and hashes their modules, and fences process, thread manager, native
instance, memory, HWND object, endpoint, preparation, renderer executor/context,
document epoch, focus, modal state and viewport. Volatile execution counters
are observations, not owner identity. A published GPS owner is required;
the prepared MENU with no GPS endpoint cannot authorize this path.

Before DOWN the authority captures current pixels, arms an independent physical
release, requires a genuine new native input owner observation, and captures
another complete frame. All owner reads, image retention and awaits finish
before its final synchronous fence. The handle is consumed before socket
publication. The native ticket stays within 500 ms; a transport acknowledgement
cannot qualify it. Success requires the exact nonce/key's owning Worker native
USER return and the independent trusted UP receipt. Any ambiguous failure
permanently closes the chain; UP cleanup remains independent. This implementation
does not assert that a USER receipt proves a DirectInput device poll.

The default direct capture/admission and physical-hold bodies are unchanged,
including `MAX_AGE_MS = 12000`. The MENU context file is untouched by this task;
it still requires exact whole-image equality. The released adapter already had
uncommitted stable MENU-owner projection and native/thread checks on entry;
those inherited edits are recorded separately and preserved in its explicit-path
commit. They are not an animation exception.

Validation includes focused refusal tests for replaced owners, epochs, stale
current captures, expired source/review, unsupported keys, MENU confusion,
borrowed/reused handles, cancellation at the final sink, missing native owner,
transport-only success, a mismatched native nonce and failed UP. The production
Worker test uses genuine elapsed time over 12 seconds and below 30 seconds:
unchanged DIRECT refuses before dispatch, while explicit context admits new
authored current frames and a real native PeekMessage return from the executing
production Worker. Its images and physical-release participant are authored
controls, not a qualification of trusted original-game keyboard input. The
retained repeat stores complete source/current PNGs through the immutable sink.
The literal locked full build passed. Final logs and exit results are in the run.

The affected registered original used the retained `f5ae1ac84e3d5e13bb093aca53b8aa2fe18c000cc891587a5d75b46eb559b2ba`
module and 311 verified existing media inputs. The actual CPU Worker bytes
matched. All driver, navigation, gameplay, release and shutdown recipes were
prepared before browser launch. An independent release participant was READY
with zero dispatched inputs. Each complete 800×600 navigation source was
personally reviewed before its single action: hardware OK, RIDER name, Single
Player Event, Stunt Quarry, Practice, T-rific and the yellow-bike Rider menu.
GPS source preparation completed there.

At **2026-11-20T16:05:34.195Z**, actual `/home` free space reached
**1,494,151,168 bytes**. The existing independent floor guard permanently closed
the scope before Start. The later local Start command was refused before being
published. No throttle, turn, Escape or ordinary Quit was attempted or proved.
The request audit records 215 requests and zero after closure; recovered disk
space did not reopen the scope. Native supervision reports no leaks, and direct
child joins retain stdout/stderr EOF. Browser termination was cleanup, not game
Quit. This is the precise original-progress blocker.

No shared host/bridge/WAT, W3, Hex, DX, or game media was edited. Source recovery
uses Git, exact diffs, owned-new-file patches, the existing frozen graph recipe
and retained module references. No source-tree snapshot or media copy was made.
Local box ID is null, state `NOT_CREATED`, expiry null, stop receipt null.
Finite supervised shutdown was delegated to the existing custodian/watchdog
and completed locally. No workers, Python, Wine or public deployment were used.
