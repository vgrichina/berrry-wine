# Original Jedi Knight Play: authentic executable candidates

Ordinary launcher Play now selects and starts the installed original engine.
The captured engine renders its intro movie. **Player-controlled gameplay is
not verified.** The first new handoff limitation is two original WinExec calls
creating two engines without a startup-readiness boundary; their diagnostic
control ports collide. The bounded run subsequently repeats movie EOF reads.
No further product change was attempted at this new boundary.

Evidence: `scratch/runs/20261103-jedi-authentic-launch-path/`, including
`RECOVERY.md`, `result.json`, `retrieved/manifest.json`, original disassembly,
contract documents, before/after controls and normal shutdown receipt.
Predecessor: [genuine prerequisite Play investigation](jedi-provisioned-original-play-20261103.md).

## Period contract and original provenance

The retained Microsoft MSDN CreateProcess reference explicitly covers Windows
95 or later and names Windows 95/98 in its search rules. It describes ordered
interpretations of an ambiguous unquoted image: `c:\program.exe`,
`c:\program files\sub.exe`, `c:\program files\sub dir\program.exe`, then
`c:\program files\sub dir\program name.exe`. Its remarks identify WinExec as
implemented through CreateProcess. Thus the first whitespace boundary is a
candidate; absence of that candidate does not terminate resolution. Source:
[period Microsoft CreateProcess documentation, mirrored](https://techshelps.github.io/MSDN/WINBASE/devdoc/live/pdwbase/prothred_9dpv.htm).

The original installed `Jedi.exe` has OS/subsystem version4.0. The period
GetModuleFileName contract permits long names for applications marked4.0 or
later. Its actual Play routine at402840 calls GetModuleFileName(NULL), strips
`Jedi.exe`, appends `Jkdemo.exe`, then calls WinExec at402a0f. The fallback
reads the installer's long Executable/Install Path values and calls WinExec at
402c0a. These commands are present in the unchanged original disassembly and
ordinary guest traces. Source:
[period Microsoft GetModuleFileName documentation, mirrored](https://techshelps.github.io/Win32Api%20Documentation/html/3oo70x8.htm).

The original imports GetShortPathNameA at42a7e0, but its call at401e60 is in a
different routine, outside Play. Current A/W handlers copying the long name
unchanged are a separate limitation, not the demonstrated cause of these
commands. Neither forced8.3 module paths nor fabricated registry aliases are
justified. The accepted76-key installer export is an observed emulator export;
it is not claimed to be a native Windows98 installation. These primary
contracts were retrieved from mirrors of Microsoft documentation; no native
Windows98 experiment was performed. Full source bytes and SHA256 are in
`primary-contract-sources.json`.

Original identities remain:

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| package jedidemo.exe | 21195858 | 8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e |
| installed Jedi.exe | 305664 | ab3c7c41153284aa9632fae871296ce266d2323defb5a20c987356d082ede1a1 |
| installed JkDemo.exe | 1388032 | 0f8a1b01cfdcb196b043ebb4ebf42dc3a6d4fa394034ebfb8cad9e383e14aa46 |

## First causal mismatch and repair

Before editing, an offline control executed the actual CLI shell callback,
VFS exporter, child records and cleanup, substituting only the OS fork. Its
literal expectations came from the period contract, independently of the
parser implementation. `static-boundary.json` preserves the initial result;
`fixed-boundary.json` preserves the same controls after repair.

| Control | Before | After |
| --- | --- | --- |
| Quoted full image and spaced arguments | exact image/arguments,33 | same |
| Only full unquoted image exists | failure2,no fork | full image,33,one fork |
| No candidate exists | failure2,no fork | same |
| Earlier Program.exe exists | earlier image wins | same |
| Quoted absent Program image | failure2,no expansion | same |
| ShellExecute separate lpFile has spaces | full image,33 | same |

`host.js` now probes successive unquoted WinExec whitespace boundaries against
the caller's VFS, using the existing executable-extension/path resolver.
The earliest existing file wins; directories are excluded. Selection only
examines file identity, leaving invalid-image/loading errors to the ordinary
loader. Quoted commands, arguments and separate ShellExecute lpFile behavior
are preserved. Browser and both CLI launch/capture paths pass the VFS to this
shared parser. No game-specific lookup, alias, registry change, original patch,
engine shortcut or GetShortPathName change was introduced.

Focused regressions cover the production browser shell callback and ordinary
CLI spawn/export boundary, intermediate competing images, relative spaced
paths, quotations, missing images and argument preservation. WinExec handler
and relative VFS forwarding regressions also pass. The required fresh
`flock /tmp/wine-build.lock bash tools/build.sh` passes. Its first attempt
stopped at the expected changed host-file ownership pin; only that reviewed
hash/rationale was updated, preserving pending ownership and classifications.
The canonical2081417-byte wasm remains
`36a80f073b3bc4f59bb66d8c292684085c111be42cf999523723ff0cfab64788`.

## Ordinary runtime and next blocker

After Alice82263's exact AUTHOR RELEASE05:27:35/terminal0, then GL3658's exact
AUTHOR RELEASE05:40:57/terminal0, one finite-TTL task boat recovered the exact
original package, verified87 historical seals and361 recovery mappings, and
restored28 installed originals totaling39900850bytes. It mounted the genuine
DSOUND.VXD and DDHELP.EXE prerequisite files. File-only prerequisite provenance
and builtin-only DDRAW/DSOUND execution policy remain intact.

A recorded renderer click at320,284 on installed original `Jedi.exe` is the
sole Play action in the valid attempt. The genuine prerequisite predicate
returns0 and reaches402905. Both original unquoted WinExec commands select the
full installed path, return33, and normally spawn `jkdemo.exe` (logical4004 and
4008). Both children load original smackw32.dll, discover res1demo.gob and
render the intro. Process observers verify all28 originals and the unchanged
76-key registry before loading the parent and each child, and verify actual
canonical wasm compile/instantiate inputs in all three processes. The parent
exits0 and its final76-key registry remains unchanged. The observed child keeps
all original values and adds only `Version`=`0.1` under the existing Demo key;
`child-observed-registry-delta.json` preserves that guest-generated change.
The original Executable, Install Path, source/CD, sound and install guards are
unchanged. No registry values were manufactured by the task.

The first new qualification boundary is startup/duplicate handoff: both
engines start, and the second control listener reports EADDRINUSE on8144.
The host returns success immediately after fork, without the documented
WinExec wait for the started process to call GetMessage or reach a timeout.
That missing contract warrants the next controlled investigation; this run
does not prove adding that wait alone prevents the second launch. Original
code compares the first result against31 and calls a virtual close method,
then continues to its registry fallback. No original control flow was patched.
Source: [period Microsoft WinExec documentation, mirrored](https://techshelps.github.io/MSDN/WINBASE/devdoc/live/pdwbase/prothred_36w3.htm).

`ordinary-child.png` shows an intro scene, not gameplay. `child-final.png`
shows the closing promotional card. The captured trace has81442 zero-byte
reads at splash.smk EOF offset0x1dbc88; the supervisor terminates the scoped
process group at its finite log bound after73.315seconds. The complete output
is17378374bytes, retained compressed with compressed and original fullSHA
verification. This is an observed movie-completion symptom, not an established
ReadFile contract defect. No gameplay input or level was reached or claimed.

An earlier observation attempt is explicitly INVALID for product attribution:
the scratch NODE_OPTIONS observer inherited process-only argv assertions in
Node Workers and caused an authority deadline. Independent no-guest authority
controls pass without it, fail with it, and pass with a process-main-thread-only
observer. The complete invalid attempt is retained separately; no product
source was changed to accommodate it.

All64 retrieved evidence members and their original uncompressed bytes passed
fullSHA checks. Postflight confirms no scoped guests and closed8143/8144 ports.
Boat `bx_bmy3m9ht` had original expiry06:05:30.203Z, recorded before use, and
normal snapshots; the original task explicitly delegated its shutdown.
Normal stop `stop_d47864ea794ed1e8` completed05:51:17.507Z with error=null;
STOPPED state and a retained verified snapshot are recorded in the run. No public
deployment, retained/laptop lane, historical27 claim or gameplay acceptance.
