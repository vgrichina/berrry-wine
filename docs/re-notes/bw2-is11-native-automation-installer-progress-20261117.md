# BW2 / InstallShield 11 original startup remains incomplete

One normal startup of the retained 647,216,200-byte original demo package reached
“BW2InstallerDemo - InstallShield Wizard” and its preparation progress window.
It subsequently called through NULL and left a blank teal window. No input,
Welcome/Next/license/Install choice, game installation, game startup or native
Quit is proved. Full T-db74d863 remains open. Evidence is
`scratch/runs/20261117-bw2-is11-native-automation-installer-progress/result.json`.

The original package SHA-256 remains
`57ff873eed789ff84d7337996bbe784bd00ac9675d098a8f6563ae8430f60c3f`.
All nine recorded entry headers, offsets and lengths were verified again before
execution. The package itself ran: its own extraction and engine startup were
not replaced by a hand-built installation or a registry seed.

The canonical locked build passed. Its compatibility module is
`f3568ba6cd1c1982cf3c79eebada41823dd9c3d6a21cc6ac9e48491af4ed6c19`,
with region map
`8e15e720bcfded5902defa7e323661b824baf53ebc25de0fdcad3e8620982bf9`.
The module and matching function-name map are retained. Existing native
VARIANT/SAFEARRAY proof uses this exact module. Earlier native BW2 MSFT209 /
SLTG198 type enumeration, all imported bases, registration and built-in stdole
proof was reused by hash: the entire typelib source still matches that proof
apart from the standard proxy-class classifier, explicitly excluded from this
parser/import/stdole reuse. No broad test matrix was repeated.

The original read its extracted `isprobe.tlb`; native `LoadTypeLib` and
`RegisterTypeLib` returned S_OK. The written typelib is byte-identical to the
previously recovered NT MSFT input, SHA-256
`38b3d8a37e89e8899be78f7787aa2f0ced65c77772689c11115146c8f6654167`.
Thirteen later `LoadRegTypeLib` calls returned `0x8002801d`
(`TYPE_E_LIBNOTREGISTERED`). The requested GUID was not decoded from guest
memory. This evidence neither identifies the requested library nor proves an
incorrect public API result or a causal connection to the NULL call. Native
stdole 1/2 handling is already present in `tl_load_reg`; inventing a registry
entry or a successful lookup would be unjustified.

Ten files totaling 2,009,175 bytes were written under the InstallShield common
runtime directory, including its real typelib and registration script. These
are bootstrap runtime files, not BW2 game files or evidence of successful game
installation. Their exact paths, lengths and hashes are in `written-files.json`.

Genuine oleaut32/olepro32 DLLs and stdole typelibs were absent from the execution
file view; the final provider audit records zero genuine Automation provider
reads. Host provider hashes and original media were preserved. A small local
helper disabled the CLI's automatic private crash/stack/disassembly and hardcoded
COM diagnostics, without changing API results or guest state. The helper first
failed a local check because another pre-run private diagnostic remained; that
check was repaired and passed before the original launch. Package aliases used
the existing provider-backed VFS so child-state export could not duplicate the
647 MB source package. No new download, source archive, media extraction archive,
box, worker or deployment was made. The unique normal log was losslessly
compressed and its complete hash round-trip verified.

Both selected whole screenshots were personally reviewed: the first shows the
preparation window with its disabled Cancel button; the later image is blank
teal. The latter permanently closed control as UNKNOWN. No subsequent endpoint
query, replay, private-memory observation, native binary disassembly or held
Sims artifact inspection was performed. No speculative production API change
was made. The permitted name/error diagnostics do not establish a public API
repair; investigation of private callers/objects is outside this task's review
boundary, and there is no further original startup in this allowance.

Host cancellation completed with native exit 0 and both stream EOFs. The
independent prearmed watchdog and supervisor were actually waited with both
EOFs; no native child was spawned. All recorded owned PIDs are absent, both
reserved listener ports refuse connections, and the empty own temporary
directory was removed. Exit 0 here records orderly host shutdown, not installer
success or native Quit. Box ID and expiry are null, state NOT_CREATED, stop
receipt NOT_APPLICABLE.

The strict disk-floor requirement was **not satisfied throughout**: after the
native runtime had exited, a shared-home check observed 1,385,795,584 free bytes
and a subsequent check 1,481,359,360. Before execution there were 2,480,893,952
free bytes; this run then occupied about 64 MB. The source of the other space
change is unproved. No foreign data was removed. Hash-verified compression of
the own unique 57 MB log restored an observed 1,558,880,256 free bytes; a later
check exceeded 2.49 GB. This exception is retained, rather than claiming a
continuous floor from sparse successful samples.
