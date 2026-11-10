# Q3 original menu input: verified route and evidence blocker

Evidence: `scratch/runs/20261110-q3-native-menu-consumption-0135/`.
Starting Git: `b56fdfc8ea2b8fb4c4da4dc48b71ca805acda483`.
Prior native result: [durable release service](20261110-q3-durable-release-service-0106.md).

Arena movement/fire remains unattained. This investigation found no demonstrated
causal repair. No production code, input timing, completion condition, guest
state, clock, shared provider or startup service was changed. In particular,
published `7607cab84` and `tools/q3-startup-custody.py` remain untouched.
No fresh box or native attempt was made: the task conditions another native
attempt on an offline demonstrated causal repair, which is absent.

The read-only `audit.py` in the run directory independently decompresses and
checks retained console and state artifact SHA-256 and size against the original
retrieval manifest. It reads the existing EXE and PK3 in place, verifies their
hashes, decodes the original `vm/ui.qvm` in memory, and asserts the relevant
instruction sequences. `audit.json` records its results, exact input references,
hashes, selected disassembly and the explicit unknown runtime boundary. No game
media, source archive or recovered artifact copies were created.

The original EXE SHA-256 is
`2c0dd4d06e3282e0abc41ebc8e84e2d9868a17182ac175b232a9bb604a8269a3`;
PK3 SHA-256 is
`e77abad2466f45a0a7ea018445528f9b95a0fe7789fa1abc1a7718bbf0754b08`;
UI QVM SHA-256 is
`6903548472c2d95898c71c979304e07fbe966e9db2d22db5d9c1ee4f8ddeb88f`.

## What the retained original actually observed

Within the same page observer clock, command begin was 42154.955ms. Trusted
Enter reached the production renderer down/up handlers at 42162.985ms and
42309.485ms. Host dequeues followed at 42352.315, 42354.145 and 42354.825ms:
`WM_KEYDOWN(13,0x001c0001)`, `WM_CHAR(13,0x001c0001)` and
`WM_KEYUP(13,0xc01c0001)`. The result image bound at 43950.875ms.
These times describe page observations, not guest handler completion.

All nineteen owner fields match between startup and result. Execution slices
differ, as permitted; focus remains HWND 65543. The prior native input receipt
records balanced acknowledgements and two wholly-held physical samples. Neither
physical samples nor removal from the host FIFO proves Worker or guest
consumption. The installed observer explicitly records `guestHooks:false`.
The first subsequent model-reviewed image remained mainmenu and caused owning
cancellation. This report retains that terminal result and does not conclude
that the guest ignored Enter.

## Actual original handler path, statically verified

The game window procedure begins at `0x443a10`. The separate procedure at
`0x4433d0` belongs to the console window; it is not the game keyboard handler.
The game procedure's ordinary keydown path calls `MapKey` at `0x443f80` and
queues a down event through `0x4403b0`. `MapKey` extracts the scan-code byte
from lParam; the original table maps scan code `0x1c` to Q3 key 13.
WM_CHAR takes a separate queued character path.

The source route after the observed dequeue is Worker RPC input receipt and
its scoped hwnd/lParam reads (`lib/guest-rpc.js`), the Win32 message APIs
(`src/09a5-handlers-window.wat`), DispatchMessage into the actual window
procedure, the engine event queue, and `Key_Event` at `0x40aa70`. These are
source/static routes, not retained execution observations. Key_Event tests the
UI catcher before ordinary key bindings and calls `VM_Call(3,key)` at
`0x40ac65`. Thus the configured `bind ENTER "+button2"` does not by itself
explain failure while the UI catcher is active. Character events are marked
with `0x400` before the UI call and are not interchangeable with key 13.

Within the authentic UI QVM:

- vmMain's key-event branch at instruction 39 calls UI_KeyEvent 4375.
- UI_KeyEvent reads the active menu at data offset 175620. A custom key
  callback, when present at menu+272, takes precedence; otherwise instruction
  4412 calls Menu_DefaultKey 34954.
- The ordinary Enter comparison at 35170 branches to **35444** for key 13.
  That branch requires a selected item and rejects item flags masked by
  `0x6800`; it then calls Menu_ActivateItem 34912.
- Activation invokes item+48 with event 3 (`QM_ACTIVATED`). Original main-menu
  setup gives Single Player item 191212 id 10, flags 264 (`0x108`), callback
  13938. Those flags do not intersect `0x6800`.
- The id-10 callback branch at 13968 calls Single Player menu entry 45971.

These bytes establish the intended handler route and disprove a static claim
that ordinary Enter has no main-menu activation branch. They do not establish
the active runtime menu pointer, cursor/item, flags, callback, UI catcher,
VM execution mode, or which of these branches actually executed. The saved
`vm_ui "0"` setting alone is insufficient to establish the loaded VM mode.

## Validation and stopping condition

The read-only audit passes. Existing `tools/q3-input-observer.test.cjs` passes
against the actual current generated consumer, including all nineteen owner
field refusals, changing slice telemetry, stale image binding, malformed review
and inactive observer refusal before dispatch, with production Enter down/up
and host dequeues. Existing `tools/q3-arena-command-boundary.test.cjs` passes
all seven actual composed command/screenshot clock controls through the current
foreign closure: historical late continuation is reproduced, while the current
consumer aborts without resend or late input. These validate existing guards;
they are **not** failing-before/passing-after evidence for a new menu repair.
The required locked build also passes.

Concrete blocker: the retained original contains no observation of Worker input
return, Win32 dispatch, Key_Event entry/return, or UI VM key-handler entry/return.
It therefore cannot distinguish an unhandled key from a handler still in
progress or a completed handler whose result was not presented. Adding a wait,
choosing a completion predicate, or changing delivery without establishing that
boundary would claim a cause unsupported by this evidence. No new incomplete/
wrong-binding/first-failure guest-completion controls or causal native acceptance
are claimed. The next investigation needs a narrowly bounded passive trace of
that missing boundary, tied to the reviewed image, command and immutable owner;
it must not infer completion from ACK, physical state, dequeue, or elapsed time.

Lifecycle: no task box was created, so no task UUID, expiry, stop request or
watchdog was applicable. Existing stopped `bx_hsh4576p` and all other agents'
boxes were untouched. No local Chrome, nested worker or guest execution was
used. This single-task worker releases its files and stops with this blocker.
