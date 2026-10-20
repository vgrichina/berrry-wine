# Startup show implementation, 2026-10-20

Candidate source implementation; independent acceptance is still required.
Base is `8bcd437fa4852417b13d375e54e07280621a161a`, whose production parent is
`ea6f896e8099fc8072009fbf0014b52fa06bbedd`. This branch preserves that ancestry;
it is not a proposal to merge the whole ancestry into current main.

This finishes the same implementation preserved by stopped worker
`shell-startup-complete-path-fix-oct20`. Its original resource failure
`2032525312 < 2285895680` remains valid. A fresh authorized checkout was made
with exact sparse patterns installed before materialization, using only the
previous isolated repository's objects as a read-only alternate. Its explicit
tracked diff and sole untracked focused JS fixture were transferred; the
original directory and evidence were not edited. `recovery.patch` and
`recovery-hashes.json` seal that starting point.

## Behavior

Browser launch options now reach `loadExe`, which publishes the command before
PE initialization. Both complete CLI spawn callbacks carry the command into
the child's arguments, and the child applies it before staging/loading the PE.
Absent/null/internal -1 preserves the prior normal default without arming a
first-show override; explicit zero remains SW_HIDE. Invalid stored commands,
including SW_SHOWDEFAULT, are rejected by the common JS boundary.

A 16-byte shared region contains presence, retained command and the atomic
first-applicable-window latch. A/W GetStartupInfo read it. Thread instances
share it rather than resetting per-instance globals. Eligible windows are
unowned overlapped windows or captioned popups; child, owned and bare popup
helpers cannot consume the latch. Invalid HWNDs fail before consuming it.
The first eligible show consumes the latch; normal/show commands substitute
the retained startup choice. Subsequent SW_SHOWDEFAULT still uses the retained
value.

WS_VISIBLE creation applies startup state before exposing the host surface,
records the same guest show state and arms the real post-WM_CREATE activation
continuation only for activating commands. The actual creation callbacks,
continuation EIPs, stack cleanup and returned HWND are exercised. First
explicit ShowWindow uses the same choice, and its custom-wndproc continuation
returns prior visibility instead of the previous constant true.

Minimized activation now includes the iconic WM_ACTIVATE bit and sends
SIZE_MINIMIZED with zero size through the continuation. GetMessage/PeekMessage
pending main-size branches use the retained iconic/maximized state as well,
including nonactivating minimized startup. SW_FORCEMINIMIZE now agrees between
the renderer and guest IsIconic state. Its only additional source boundary is
`src/09c4-defwndproc.wat:$wnd_apply_show_state`; no lookup/registry logic changed.

The first-show and later-default contract follows Microsoft's
[ShowWindow documentation](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-showwindow)
and [STARTUPINFO documentation](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/ns-processthreadsapi-startupinfoa).
The eligible-window and normal/show substitution details follow the inspected
[Wine show_window implementation](https://github.com/wine-mirror/wine/blob/master/dlls/win32u/window.c).
These are source references, not a native Win98 differential experiment.

## Executable evidence

Run from the isolated repository:

```sh
node docs/reviews/shell-startup-complete-path-fix-20261020.js
node docs/reviews/shell-startup-finish-validation-20261020.js
node docs/reviews/shell-startup-show-contract-20261020.js ..
```

The complete-path fixture covers 24 combinations: absent and all eleven
permitted startup commands, each through WS_VISIBLE creation and through
initially hidden creation followed by explicit ShowWindow. It checks A/W
structure bounds/stack cleanup, actual renderer visibility, guest visible,
iconic and maximized state, host foreground, callback order/EIP/arguments,
CreateWindow return and ShowWindow return. It also checks later normal/default
shows, invalid/child/owned/popup eligibility, first explicit hide consumption,
shared-instance state and both pending-size branches with nonzero geometry.

The validation fixture executes the actual browser PE call expression, both
complete CLI callbacks up to recording fork boundaries, the actual child
argument parser and startup application, and the host pre-PE publication
prefix with already initialized and newly initialized hosts. It invokes the
unchanged region generator/allocator through an object-backed sparse reader.
All old region descriptors and exported placements remain unchanged; the new
region and generated hash agree. Fragment balance, logical-AND, silent-stub,
JS syntax and whitespace gates run against the final overlay.

Mutation controls remove creation selection, activation gating, first explicit
selection, startup-info consumption, minimized continuation information,
renderer force-minimize support, guest force-minimize support and ShowWindow
return preservation. Each must fail an assertion. Separate transport controls
remove the browser option, VFS delegation argument and pipe-child argument.
The unchanged original reproduction retains its ten gap checks and ten
rejected acceptance expectations against the exact old source.

`fixture.json`, `validation.json`, `controls.json`, `negative-*.json` and
`tests.json` record exact input/module hashes, counts and failures. The initial
minimized continuation failure and the later guest force-minimize failure are
preserved separately. `receipt.json`, `change.patch`, `remote.txt` and
`SHA256SUMS.json` identify the final publication and recovery checks.

## Fixture boundaries and limits

The production CreateWindowExA, ShowWindow, GetStartupInfo and six return
continuations execute in vendored-compiler slices, with actual host-window and
renderer methods. Guest code is represented by inspecting the actual callback
stack/EIP, supplying successful WM_NCCREATE/WM_CREATE returns, and executing
ret16 before entering the production continuation. This does not run x86
guest callback instructions, a PE, full VM, Worker or browser.

Identity guest addressing, a deterministic scratch allocation, a registered
class seed and graphics/paint/posted-notification sinks are explicit adapters.
The sinks never select show state or activate a window. Geometry and canvas
painting are not qualified. Pending-size tests explicitly seed nonzero
geometry to avoid concealing incorrect notification state behind the geometry
adapter. Sibling tests seed their already-active thread globals; they establish
shared startup state, not concurrent thread scheduling. Child/owned eligibility
uses real WND accessors and the complete ShowWindow handler, not complete child
creation. Dialog-specific callbacks, destruction/reentrancy during callbacks,
full message-pump dispatch and runtime transport remain unqualified.

No main integration, full build, runtime403 retry, Boat command, browser run,
Claude change, subworker/refill, deployment or protected laptop edit occurred.
All writes use the original conservative requirement
`2210398208 + 33554432 + 25165824 + 16777216 = 2285895680` bytes.
This is stricter than subtracting already-used task budget. The task remains
under 16 MiB; no cleanup/retry loop was used.
