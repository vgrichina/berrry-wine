# GetFullPathName directory separator compatibility

Source candidate base: main `cdc48b24d16fffd53a1ff8972b206d08212ce9d3`,
which follows60f403b4e with a TODO-only update. Isolated branch
`task/army-fullpath-separator-oct19`; no unmerged LockFile source included.
Ownership is restricted to VirtualFS.getFullPathName and its host import.

The original Army directory-validation-v2 observation is sealed separately
in `scratch/runs/20261019-army-men-directory-validation-v2`, manifest
`e9dfb850f15bf3dfbeb28832022216587756ac48c6952c7800acb486c0f66a76`.
It captures a GetFullPathNameA input ending Campaigns/, followed by the game's
FindFirstFileA pattern campaigns*.* without a separator, failed enumeration,
then a leading-NUL cached directory passed to native _chdir. The original
SetAt instruction trace had zero hits; exact dynamic store attribution remains
unavailable. No claim that the earlier AVI transition proves this campaign path.

## Contract and scope

[Microsoft GetFullPathNameA documentation](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfullpathnamea)
specifies successful length excluding NUL, required capacity including NUL,
and a zero file-part pointer for a directory result. It does not require the
path to exist. The shared host import serves A and W in TCHAR units.

[Wine's Windows path conformance tests](https://github.com/wine-mirror/wine/blob/master/dlls/kernel32/tests/path.c),
`test_ValidPathA` lines129–137, explicitly compare a trailing-backslash input's
full result including that separator and require NULL filePart. This supplies
the trailing-separator evidence not explicit in Microsoft's prose. No original
application binary or alternative assets are used in the new tests.

The fix changes API display semantics only: normalize slash spelling before
resolving an API path, preserve an explicit final separator, and represent a
drive root with its backslash. Canonical VFS lookup still uses the unchanged
_resolvePath/_normPath functions; existing case-folding policy is retained.
On short buffers, return required TCHAR capacity before writing output or
filePart. On successful directory-form output, set filePart to zero; for a file
result retain the pointer into the output, scaled for ANSI/UTF-16. Empty inputs
retain their existing failure behavior. This is not a complete Windows path
normalization overhaul (case retention, device namespace and per-drive CWD
limitations remain outside the scoped change).

## Validation and pending runtime

`node test/test-full-path-name.js` passes pure-JavaScript production host imports
using16KiB ArrayBuffer memory, no WebAssembly instance: A/W explicit separators,
mixed separators, roots, parent traversal, relative/nonexistent paths, sufficient
and exact-short/zero capacity, output sentinels, optional and directory/file
file-part pointers, and composing Campaigns/ with *.* for enumeration.
`node test/test-vfs.js`:46 passed,0 failed. Syntax check passes.
The sealed old v4 VirtualFS negative control returns C:\work\campaigns without
its slash, demonstrating the regression that the new test detects.
The first test draft compared a Uint8Array to Buffer with strict equality;
that test-only representation mismatch was corrected before all checks passed.

No build, native guest, browser or original Army retry has run on this candidate.
Root must review/integrate the disjoint filesystem hunks and qualify an immutable
consumer before any claim that this fixes BootCamp gameplay. Original files and
historical bundles remain untouched.
