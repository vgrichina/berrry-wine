# ShellEx startup show contract — blocked, 2026-10-20

**No implementation or acceptance.** The retained full candidate is
`ea6f896e8099fc8072009fbf0014b52fa06bbedd`. This task preserves that ancestry
and adds only this report and its executable reproduction. No production file
was edited, and no main integration was attempted. Independent reports
`96360e91d971aca8940f8199b2623dee8ceb8858` and
`31bd5e6996f9ef729dc465fdffb4a9a49d040007` were read; their transport-only
qualification is confirmed.

## Exact stopping condition

The missing contract crosses more than a launch option assignment:

1. Browser `launchAppInner` omits `showCmd` from the actual `wine.loadExe`
   options. `host.js` then boots either the Worker-owned instance or the local
   instance. The option must become guest process state before any guest
   startup code, including DLL initialization, consumes it.
2. CLI `h.process_spawn` drops its seventh argument when calling
   `spawnVfsChild`; the latter constructs a fresh `run.js` command line.
   Redirected-pipe children have a separate command-line construction path.
   Changing only the callback signature does not carry anything into either
   child.
3. Both guest GetStartupInfo encodings call `startup_info_init`, which writes
   constant `STARTF_USESHOWWINDOW=1` and `SW_SHOWNORMAL=1`. Explicit ShowWindow
   forwards its caller's command directly to the renderer and WAT state.
4. **WS_VISIBLE creation bypasses that explicit ShowWindow path.**
   `handle_CreateWindowExA` supplies the visible style to `host_create_window`
   before returning through guest creation callbacks. It separately arms
   `createwnd_implicit_show`; `09b-dispatch.wat` consumes that flag and activates
   the main window after WM_CREATE. Renderer `createWindow` derives visibility
   directly from the style; minimized rendering instead lives in
   `showWindow`. A setter plus an explicit-ShowWindow override would therefore
   leave an initially visible child exposed and could still activate it under
   hidden/minimized startup.

The last path is the safe-implementation blocker for this attempt. Correcting
it requires validating startup consumption against actual window creation,
guest callback return, visibility/minimize state, and the activation
continuation—not just validating a new command-selection helper. The permitted
execution here excludes runtime, full builds, browsers and held diagnostics;
the runtime403 restriction remains binding. I cannot safely qualify that
combined behavior with the small isolated source slices used below. I stopped
before adding partial production behavior, per the task's explicit stopping
condition. This is an implementation/validation dependency, **not** a failed
capacity check, missing candidate object, or permission request to retry the
runtime.

The follow-up needs an allowed execution surface for the integrated creation
and first-show continuation, or a separately authorized faithful source-slice
fixture that executes those complete production paths. No runtime access was
attempted. No helper with synthesized successful visibility/activation was
introduced. A complete source-only fixture may be possible; this report does
not establish that runtime access is the only theoretical solution.

## Evidence actually executed

Run from the isolated repository:

```sh
node docs/reviews/shell-startup-show-contract-20261020.js ..
node --check docs/reviews/shell-startup-show-contract-20261020.js
git diff --check
```

The helper pins every production/compiler input to `ea6f896`, including absent
sparse files read through Git objects. It records all input SHA-256 identities
in `../tests.json`. Results: **10 passing reproduction checks and 10 rejected
acceptance expectations**. These expected failures demonstrate the old gap,
not implementation success.

- Actual A/W GetStartupInfo handlers and their complete shared initializer
  compile to a 274-byte in-memory module. Both report normal startup, preserve
  output canaries and perform their existing stdcall stack cleanup. Four
  hidden/minimized expectations reject. Identity guest-addressing,
  `guest_memset`, `gs16` and `gs32` are the only memory adapters.
- The complete production CLI `process_spawn` callback executes its count-zero
  route for hidden, normal and minimized choices. A recording VFS callee sees
  command, directory and force, but no show command. Three preservation
  expectations reject. There is no fork or actual child runtime in this test.
- The exact production browser `wine.loadExe` call expression executes with
  each of those three launch choices. A recording callee receives the other
  executable options but no show command. Three preservation expectations
  reject. This executes option construction, not a browser or PE boot.
- Two static source checks retain the explicit-show forwarding and the
  independent WS_VISIBLE/activation-continuation trace. These paths were
  inspected, **not executed**.

Compiled module SHA-256:
`c044aa11c1d7b684b082271d4c2bccc7d843f2acc13833460a786100d2124817`.
Exact slice source SHA-256:
`09bd24efdce168b7f4a769f63c24a32664198b3711df134bbd723a758bf0b747`.
There is no full-runtime module identity because none was built or run.

## Contract and edit mapping for a future bounded fix

Microsoft documents startup-provided first-show behavior and subsequent
SW_SHOWDEFAULT selection in [ShowWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-showwindow).
[STARTUPINFOA](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/ns-processthreadsapi-startupinfoa)
ties `wShowWindow` to STARTF_USESHOWWINDOW and excludes SW_SHOWDEFAULT as a
stored startup value. Distinguish an explicit hidden value zero from an absent
option. Keep the first-show latch separate from the retained value used by
GetStartupInfo and subsequent SW_SHOWDEFAULT calls.

Wine's current [show_window implementation](https://github.com/wine-mirror/wine/blob/master/dlls/win32u/window.c)
also distinguishes unowned top-level windows from controls and applies
first-show substitution to particular commands. This is useful implementation
evidence, not a native Win98 differential result. A fix needs explicit
acceptance choices for invalid handles, child/owned windows, startup flags
absent, and creation-time implicit showing rather than silently consuming
startup state on a toolbar.

Potential overlapping files, **none changed here**:

| Path | Startup-specific concern |
| --- | --- |
| `lib/browser-shell.js` | Carry launch options into the PE boot call |
| `host.js` | Install startup state before guest execution in both boot modes |
| `lib/process-boot.js` | Shared startup-option application/validation |
| `test/run.js` | VFS/pipe child arguments and child-side consumption |
| `src/09a-handlers3-sync.wat` | A/W common startup-info consumer |
| `src/01-header.wat` | Shared process state, not per-WASM-instance latch |
| `src/09a5-handlers-window.wat` | Explicit first-show and creation-time state |
| `src/09b-dispatch.wat` | Existing implicit-show continuation ordering |

No process alias, window lookup, host lifecycle or renderer implementation
hunks were owned or changed. Ordinary CreateProcess currently passes a
constant show value in `09d7-pipes.wat`; its STARTUPINFO flag/word is another
legitimate-option boundary to distinguish from ShellEx's nShow. CLI untracked
ShellExecute also has existing logging/capture behavior; this task does not
claim it launches a child. Unsupported ShellEx masks and other existing
compatibility limits remain unchanged.

## Preservation

Evidence folder:
`scratch/runs/20261020-shell-startup-show-contract-oct20/`.
`setup.json` records exact sparse patterns installed before checkout,
read-only object alternates, the candidate parent and shared HEAD/index/config
hashes. `tests.json` records input/module hashes, exact expected failures and
capacity readings. `receipt.json`, `remote.txt` and `SHA256SUMS.json` record
publication and preservation checks.

All writes use a conservative available-space threshold of
`2210398208 + 33554432 + 25165824 + 8388608 = 2277507072` bytes, at least the
required floor plus remaining task budget. Total task allocation remains
below 8 MiB. No cleanup retries, workers, queue refill, fullbuild, runtime,
Boat, SSH runtime command, browser, benchmark, public deployment, Claude or
held diagnostic occurred. Protected laptop HeroesII/WarcraftIII work and
shared HEAD/index/config/WIP were not edited.
