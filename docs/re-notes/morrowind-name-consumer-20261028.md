# Original Morrowind Name consumer: static observation boundary

2026-10-28, source-only investigation. Original `Morrowind.exe`, 3,907,584
bytes, SHA-256 `f48300e194c6917cd98d235d259ebc3ab5d7c2071e9b41d798b996a8ce4d0676`.
Source baseline `5edf4c5cacf590153184bb9e347a52ffbeda86af`.
Addresses below are original guest VAs, preferred image base `0x400000`;
apply a **verified** relocation delta before using them in a future guest.

The first missing observation is the **actual buffered keyboard record returned
to the original executable at `0x406926`**, followed through its translation
and Name edit callback. The Name control is statically connected to buffered
DirectInput, not established by the earlier WM_CHAR transport fixture. No
original guest was executed here, no historical lost character was reproduced,
and no production source repair is justified by this evidence.

## Original-consumer evidence

| Original VA | Reviewed evidence and implication |
| --- | --- |
| `0x7a8f6c` | Literal `MenuName_NameSpace`; initializer `0x5e6580` calls `0x57fd70` and stores its 16-bit ID at `0x7c48d4`. Main Name ID is stored at `0x7c4968`. |
| `0x5e6717`–`0x5e672d` | Loads NameSpace ID, passes builder `0x637b50` into `0x579c40`; returned child goes into EDI. `0x5e6736` passes `"|"` to `0x57cc50`; `0x5e678c` retains the child at `[manager+0x88]`. Capture this pointer/lifetime to identify the actual Name target. |
| `0x637cbc`–`0x637cca` | The child builder registers callback `0x638050` for event `0xffff803e` via `0x5738d0`. Registration at `0x56ab4f` names this event `"key"` (`0x7a3d94`), not WM_CHAR. |
| `0x4061ab` | Calls DirectInput8Create thunk `0x654260`, whose IAT entry is `0x738038`. Version argument is `0x800`. |
| `0x4061f6`–`0x40621b` | CreateDevice uses GUID bytes `612b1d6fa0d5cf11bfc7444553540000` (keyboard); stores returned device at input-manager `+0x28`. Keyboard format at `0x73d700` declares 256-byte data and 256 objects. `0x40628e` calls SetProperty with property ID 1 and data `0x20` (32-record buffer request). |
| `0x406900`–`0x406926` | Reads `[inputManager+0x28]`, invokes device vtable `+0x28`: `GetDeviceData(this,20,data,&count,0)`, input count **1**. No peek. Postcall `0x406926` tests HRESULT; `0x40692a` tests returned count. Success with count zero or any nonzero HRESULT returns no event. |
| `0x406932`–`0x406946` | Reads event `dwData` bit `0x80` and copies `dwOfs` out. Returns kind **1 for down**, **2 for up**, 0 for none/error. It does not read WM_CHAR. |
| `0x580700`–`0x58081a` | Calls that poll once at `0x580726`, then translates at `0x5807bd` (`0x5813d0`). There is no local drain loop. A nonzero translated character is stored in UI slot `[ESI+0x64]=0x10`, `[ESI+0x68]=character`, destination `[ESI+0x70]`. Release/modifier events can produce no character. |
| `0x5813d0`–`0x5815e8` | Guest handles Shift scans `0x2a/0x36`, stores shift byte `[UI+0x84]`, modifier bits `[UI+0x9c]`; translates ordinary downs through `0x406960`. English tables map scans `2e,18,20,12,2d` to `c,o,d,e,x`; shifted table maps C to `0x43`. Language selection is dynamic, not proven English at runtime. |
| `0x57fff0` / `0x580040`–`0x580056` | In the enabled UI branch: keyboard poll/translate (`0x580700`), conditional alternate collection (`0x580840`) if no key event, then UI dispatch (`0x580ec0`). This proves **local** update order, not actual host/Worker/frame interleaving or global call frequency. |
| `0x580fd5`–`0x580fec` | Dispatch slot type `0x10` as key event `0xffff803e`, forwarding slot character/aux/target to `0x574f60`. `0x581399` clears a consumed slot; loop visits two slots, not the DirectInput queue. |
| `0x638050` | Registered edit callback. At entry stack: root `ESP+4`, event `+8`, character/command `+12`, aux `+16`, target element `+20`. It obtains current text through `0x5725f0`. |
| `0x638589`–`0x6385ab` | Ordinary positive character branch copies low byte to a one-byte NUL-terminated string and invokes MSVCP60 string `insert` via IAT `0x738154`. The earlier code finds the `|` cursor marker and handles special edit commands `0x80000000` etc. There are width/length rejection branches to `0x6385ff`; reaching the callback does not prove insertion. |
| `0x6385e6` / `0x6385eb` | Calls text setter `0x5726c0`, then returns to invalidation/update calls. Setter's string object is at `element+0x164`, data pointer `object+4`, length `object+8`. Getter may inherit parent text: distinguish actual read object from setter target. |
| `0x5e6895` / `0x637d30` | Name submission gets edited text and filters `|`; raw editor text and final submitted name are different observations. Removing the cursor marker alone is not character loss. |

Other static callers matter for attribution: `0x5adc4d` also calls `0x406900`;
`0x580aa9` and `0x5876d8` also call UI dispatch. Their activity during Name is
unknown. Do not infer that a successful API event was consumed by this Name
invocation merely because the input manager or return address looks familiar.

## Targeted next observation

The executable verifier emits a machine-readable implementation plan:

```sh
node --max-old-space-size=320 tools/probes/morrowind-name-consumer-static.js \
  /READ_ONLY/installed/Morrowind.exe --self-test
```

This command only reads the executable. It validates its complete size/hash,
preferred base and 20 original instruction/data anchors, then emits capture
points and payloads. Its 22 rejecting controls flip every anchor in memory,
reject a wrong full-image hash, and reject truncation. It does **not** implement
a guest observer or claim that static checks are a production behavior test.

A future separately authorized observer should be read-only and off by default,
installed before guest initializers. Capture the Name child's actual pointer
at `0x5e672d` and pin the thread, target lifetime and relocation. Observe API
entry at `0x406923` and its matching completion **at `0x406926`, before any
subsequent guest instruction**. Before the call, the stack contains `this`,
stride 20, output pointer, count pointer and flags 0. After stdcall completion,
`[ESP]` is the returned count, and the 20-byte record begins at `ESP+4`.
Record HRESULT and count before interpreting bytes; zero-count/error outputs
can contain stale stack data. Record all five event fields, including sequence
and timestamp. Attribute other callers separately.

For each matched poll, capture the translated result at `0x5807c2`, Shift and
modifier state, destination slot, and eventual `0x638050` callback arguments.
Require callback target to equal the captured Name child. Capture raw text,
length and cursor before setter call `0x6385e6` and immediately after it at
`0x6385eb`, as well as rejection to `0x6385ff`. Retain the first subsequent
write that changes this same text object/backing buffer before the next
poll/render. Validate all guest pointers/lengths; truncate reads at 31 bytes
and record truncation. Never invoke a guest getter or modify input to observe it.

The first divergent boundary discriminates the causes:

1. Missing down/up at successful API completion: investigate the earlier
   DirectInput producer, sampling/queue and device lifecycle.
2. Delivered scan but missing/wrong translation or wrong callback target:
   inspect guest modifier, scheduling and routing state.
3. Correct character at callback but no insertion: retain the edit rejection
   path and its width/length/cursor state.
4. Correct text after setter, later shortened: identify the first later writer.

Before spending guest allowance, reject synthetic observer records with stale
EAX/count, wrong invocation or wrong target. A trace missing d must identify
its first absent boundary; a complete-then-overwritten trace must identify the
later writer. Those **observer controls remain unimplemented/unrun**. Cap the
future action at one ordinary Name entry and 128 observations; overflow must
be retained and stop observation without replay. Runtime allocation, canonical
module/runner identity and lifecycle remain coordinator gates.

## What this says about the emulator

At retained source `5edf4c5c`, `src/09a8-handlers-directx.wat:10773`
`di_kbd_collect` walks DIK codes in ascending order, comparing live state
against previous state and committing emitted changes up to requested count.
The keyboard `GetDeviceData` branch at line 11031 calls this collector.
This differs from an ordered historical edge queue: a complete press/release
between samples can disappear, and simultaneous pending changes can be ordered
by scan code. With the original executable requesting one record and keeping
guest Shift state, the distinction is now relevant to the **actual Name path**.
It is a source-backed candidate mechanism, not runtime proof of Codex → cox.
The prior 17-message transport checkpoint remains passing and was not replayed.

No input queue, modifier, device lifecycle, renderer, Wine/WAT, Shell or ToyVM
source changed. No module/browser/game build, guest execution, Boat operation,
public deployment, main push or other worker was started.

## Evidence and recovery

Canonical receipt: repository task output
`scratch/usage-watch/morrowind-name-consumer-cause-oct28/receipt.json`.
Its evidence archive preserves owned wrapper, bounded disassemblies, data/import
identity, admissions, startup/mount/parser receipts, static verifier output,
publication and cleanup. Original oversized policy-read diagnostics remain in
the worker launch events; they were not used as disassembly evidence.

Bounded investigation helpers reused installed `tools/disasm.js`, `lib/pe.js`,
`tools/simd-ops.js` and `objdump`; helper and input hashes are in the receipt.
Two exploratory ranges started mid-instruction (`0x580000`, `0x5adc10`);
the corrected UI prologue is `0x57fff0`, and only aligned instructions cited
above support conclusions. The exploratory outputs remain retained.

Recovery requires the immutable original EXE at the hash above and the task
branch named by the receipt. Obtain the small source/report changes from that
branch; do not copy game assets or whole donor history. In an isolated sparse
repository reuse existing donor objects read-only, with auto-GC disabled.
Retain strict configured SSH for publication. Re-run the verifier only when
its executable/helper/source pin changes; its current passing receipt is
reusable. No runtime evidence exists to recover or repeat.
