# Installed VB5 DLL closure

The installed executable lives in an opaque UUID blob. Its original guest
identity is `c:\program files\vb5cce\vb5cce.exe`; searching its host blob
directory for `VBA5.DLL` cannot discover the installed companion. The previous
installed invocation failed before UI at ordinal 8, despite the authentic DLL
being present in the persisted overlay.

The CLI now finishes base mounts, overlay hydration, cwd and registry restoration
before static DLL discovery and any PE DLL initializer. Both static and late
lookup resolve guest paths through the hydrated VFS. Explicit guest paths do
not fall back to unrelated same-basename host files. Installed modules retain
their actual guest paths instead of acquiring root/system file aliases.
Hydration errors refuse startup before DLL discovery.

`test/test-installed-dll-closure.cjs` uses original VBA5 and OLEAUT32 bytes from
the authenticated installation, referenced by their existing paths and hashes.
An authored x86 client occupies an opaque blob and uses the same CLI launch
arguments as the installed executable. Main and actual CPU Worker cases cover
static ordinal and named imports, late loads, dependency initialization order,
wrong paths before/after mapping, broken hydration and a declared DLL whiteout.
The original VBA5 `EbGetVersion` body writes all four version outputs; no
runtime ordinal result is synthesized. Read-only discovery of the actual
installed EXE finds VBA5 and OLEAUT32. OLE32's missing-file warning is recorded
separately and does not predict a later runtime fault.

Evidence: `scratch/runs/20261117-vb5-authentic-overlay-dll-closure-ide-sample/`.
The final result records the published graph, module, native qualification,
installed invocation and its actual outcome. Earlier closed endpoints remain
closed. The repair does not reinstall or change original installation bytes,
registry contents, configuration or sample arguments.

The complete native regression passed on published
`68b9bdac434926ed52ea807a2a2e1f01942b27f2`, module
`5a4178950559d4f677d86aa75403908abee343493805f01a0b8aae8f1df2429a`
(2,332,633 bytes). The source pool and module were sealed before execution;
main, CPU Worker and OS child inheritance passed. The only installed launch
used native 1800 seconds, independent watchdog 1820 seconds and reserve 180
seconds, with compilation and qualification completed before that clock.

That launch hydrated all 86 files and imported all 836 original registry
entries before resolving VBA5 and OLEAUT32. Dependency initialization succeeded,
and the executable progressed past its former ordinal-8 failure. Late native
VB5IDECC and MSO97RT initialization also succeeded. The next observed blocker
was a real startup message box: `System DLL 'COMCTL32.DLL' could not be loaded`.
The complete 640×480 image was personally reviewed. Its OK button was consumed
at the matching native BUTTON dispatch return in 61.49 ms; the independent
physical release completed in 181.05 ms and the intent completed in 230.09 ms.
The image was 29,804 ms old at DOWN, within the unchanged 30-second menu limit.

Acknowledging this startup error led to native exit code 0, followed by the
parent's actual wait and the independent watchdog's actual wait and both pipe
EOFs. This is an error acknowledgement and normal process exit, not a claimed
IDE Quit. The IDE, project execution and AxButton click were not reached.
There was exactly one installed invocation and no subsequent request to its
closed endpoint. No box was created.

The authentic installation contains COMCTL32.OCX and COMCTL32.DEP, but no
COMCTL32.DLL blob. The existing registry intentionally serves COMCTL32 through
builtin common controls. This is context for the next investigation, not proof
of the precise failing API or a reason to substitute a DLL. The separate OLE32
warning remained present; no OLE32 runtime fault was observed. Original blobs
and provenance remain unchanged. Natural writes to this launch's separate
registry export are retained rather than copied back to the installation.
