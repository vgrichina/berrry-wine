# Nox bounded compiled mouse observation and native admission repair

Implemented an opt-in, default-inert Nox observation closure in
`tools/nox-passive-consumption.cjs`, emitted by `tools/nox-current-driver.cjs`
when `NOX_PASSIVE_CONSUMPTION=1`. Shared source providers, Q3, LBreakout, the
accepted fixture `682f77655`, and readiness repair `bce2b316f` remain unchanged.
The unchanged native fixture/preflight is not retried by this opt-in route.

Evidence is in `scratch/runs/20261110-nox-passive-cursor-consumption-0158/`.
The native implementation commit is `b80751e74f93af134d7d1124eaed3564b96cc9c6`;
`git-base.txt`, `owned.patch`, `repaired-base.txt`, `repaired.patch`, the explicit
plans and generated patch pinsets preserve exact Git provenance. Git is the
source archive. There are no source archives, repeated media copies, local
Chrome runs, nested workers, or changes to the stopped `bx_jpmn9aqq`.

## Observation

The in-memory compiler overlay adds read-only callbacks at existing compiled
CALL/entry/RET and DirectInput dispatch-return seams. It does not enable trace
ranges or disable transfer chaining/micro-op tiers. The production modules
remain primary `3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`
and compatibility `ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf`.
The observation module is `6856d2bb142190238622681996e69eb58be5ff42a662049dede95ce6573a31bf`,
2,186,841 bytes, verified by the Worker before instantiation.

Records bind all eighteen accepted Nox owner fields, command and prior image
SHA, monotonically increasing observation sequence, and FIFO head/tail.
GetDeviceData/GetDeviceState entry and real compiled return records include
device slot, acquisition/format flags, data size/object offsets, relative or
absolute axis mode, capacity, arguments/request, HRESULT, count and bounded
returned bytes. Natural original functions observed are mouse poll `0x481340`,
record consumer `0x481290`, batch consumer `0x42b2c0`, cursor update/get
`0x42b980`/`0x42b970`, GUI dispatch `0x479a80`/`0x479800`, and hit test
`0x4798f0`. Cursor coordinates, bounds, arguments and return values are read.

The observer has a fixed 24-minute lifetime, 12,000 records, two million
selected events, 32 frames, and bounded direct-window reads. It arms per
admitted command and disarms at capture. Unfinished calls, wrong bindings,
read failures and exhaustion are sticky terminal observations. Debug arming
globals are separate from guest state. No guest memory/clock stores,
translation/fault helpers, artificial guest handler calls, compensation,
deadline extensions or extra game waits were added.

## One native attempt and proven offline repair

The original launched once. At `02:23:21.889Z`, before the first image or input,
the retained admission helper refused `unique recovered live Worker module
required: 2 !== 1`. Both canonical and observation modules had been compiled
in the owning Worker; compilation alone did not identify the instantiated
module. The automatic independent file watcher sent owning custody SIGTERM
26.7 ms after the first terminal record. There was no later game protocol,
input, capture, retry, quit or extension. The operator's subsequent owning
cancel found that process already absent.

The same worker repaired this cause offline. The opt-in route now emits a
Nox-only admission adapter. The installer retains the actual instantiated
object and supplies its verified module SHA/size, endpoint, slot and existing
instance token. Admission authenticates this receipt, rejects unknown compiled
modules, then requires exactly one matching CDP bytecode record and rereads
its bytes. It preserves canonical page identity and the existing owner/image
guards. Default and historical admission helpers are unchanged.

The regression reproduces the native two-module refusal using both actual
compiled modules, passes with the emitted adapter, and refuses wrong SHA,
size, endpoint, slot or instance, changed bytes, missing/duplicate selected
records, a foreign compiled module, and replacement of the instantiated
object. This repair has offline validation only: no second native attempt
was made. No live mouse-return/cursor/hit-test evidence or gameplay progress
was obtained. The recovered transform `293,204 -> 293,196` remains valid; FIFO
drain still cannot establish original-game consumption.

## Validation and lifecycle

Initial and repaired actual emitted-driver controls pass for success,
wrong binding, incomplete call and first-failure terminal behavior. Real
compiled synthetic x86 fixtures pass natural CALL/entry/RET and production
GetDeviceData/GetDeviceState returns, including `-26,-42` record payloads,
default-inert behavior and capture disarming. All eighteen identity mutations
refuse. The production pointer observer's three controls, all 27 existing
driver controls, the real fork/wait/EOF automatic-cancel control, and locked
builds pass. Offline synthetic fixtures are not native game acceptance.

The only new box was `bx_gake4jqg`, UUID
`e83e5cb0-ce80-48b4-8567-714a0524356f`. Its independently prearmed immutable
watchdog deadline was `2026-11-10T02:47:19.242Z`; initial API expiry was
`02:47:20.020Z`. Custody reaped all 171 owned descendants with complete kernel
fork lineage, actual parent return 1 and separate stdout/stderr EOF. Processes
and ports were absent before evidence retrieval.

After retrieval exited, independent rereads verified 33 references, 32 unique
contents, 4,767,954 bytes, four gzip streams and zero PNGs. Only then was the
single delegated unforced normal stop requested. Receipt
`stop_b3f53a6b411b143d` completed at `02:24:11.023Z`. Independent API and receipt
lookups confirm final state archived/stopped, expiry null. The watchdog's
supervisor actually waited, return 0, separate stdout/stderr EOF. The box was
not resumed or deleted. Home free space remained above 1.5 GB.

Next work requires a separately authorized native attempt with the repaired
instantiated-module guard, followed by the missing consumption evidence and
bounded Multiplay -> Jack -> bunker staff gameplay if attainable. This task
releases ownership and stops without claiming that progression.
