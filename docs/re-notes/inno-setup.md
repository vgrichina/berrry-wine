# Inno Setup (Delphi corpus)

Samples and provenance: `test/binaries/SOURCES.md`, "Delphi corpus". The
loader (`isetup-*.exe`) extracts `is-XXXXX.tmp\<name>.tmp` and runs it as a
child process, so a run needs `--spawn-processes` and child capture flags:

    node test/run.js --exe=test/binaries/candidates/delphi-inno-isetup-5.3.11-unicode/extracted/isetup-5.3.11-unicode.exe \
      --quiet-api --no-close --png=loader.png --max-batches=1000000 --stuck-after=0 \
      --spawn-processes "--pipe-child-args=--no-close --png=child.png"

Without `--spawn-processes`, 60K batches show only `InnoSetupLdrWindow` and an
empty desktop.

## 5.3.11 Unicode: "Invalid code page." (fixed 2026-11-25)

That text is Delphi 2009's `SInvalidCodePage`. `TMBCSEncoding.Create` raises it
when `GetCPInfo(CodePage)` fails, and the RTL builds `TEncoding.UTF7` and
`TEncoding.UTF8` that way (65000 / 65001). Our GetCPInfo accepted only pages
that have conversion tables. It now gives the fixed Windows CPINFO for
CP_UTF7 / CP_UTF8: MaxCharSize 5 / 4, DefaultChar "?", no lead bytes.
`is_supported_code_page` is unchanged, because IsValidCodePage and the console
code-page APIs share it and the conversion layer has no real UTF-8 path.

The child then builds "Select Setup Language".

## 5.3.11 Unicode: text painted only its first character (fixed 2026-11-26)

The label, buttons and combo showed "S", "O", "C" and "(‡". The text APIs were
not involved: the VCL creates every control under its own superclass
(`TButton`, `TNewStaticText`, `TComboBox`) and chains each message to the stock
proc with `CallWindowProcW(<GetClassInfoW lpfnWndProc>, ...)`. That proc is our
`$WNDPROC_SYSCLASS` marker, so the native control got a Unicode payload:

- WM_CREATE carried CREATESTRUCTW, and the button/static procs `strlen` the
  UTF-16 caption, which stops at the first character.
- CB_ADDSTRING was sent with SendMessageW to a control that had been adopted
  as a native combo. `$msg_narrow_text_lparam` narrowed it, but the target's
  proc is guest code, so the narrowed copy was freed before the VCL read it.
  That gave "(‡".

Fix (09a5c `$wmsg_narrow_in` / `$wmsg_widen_out`): CallWindowProcW to a native
marker converts CREATESTRUCTW, text-in messages and WM_GETTEXT / CB_GETLBTEXT /
LB_GETTEXT around the synchronous call. SendMessageW no longer narrows for a
control that a Unicode guest proc has subclassed. DefWindowProcW now handles
WM_SETTEXT / WM_GETTEXT / WM_GETTEXTLENGTH; they used to return 0. A native
control created directly by CreateWindowExW is also sent an ANSI CREATESTRUCT.
W-created EDIT/RichEdit keep UTF-16 text messages, since `$edit_wndproc` reads
UTF-16 for them. Test: `test/test-callwindowproc-wide-native.js`.

Now the dialog renders whole. Enter at child batch 400000 reaches the wizard's
Welcome page, which renders correctly with its bitmap. Run
20261126-delphi-corpus-fixes-2: `inno5311u-child-after.png`,
`inno5311u-child-enter.png`.

## 6.7.4: Vista-era startup APIs (2026-11-25)

The 6.7.4 loader needed, in order: VerSetConditionMask, VerifyVersionInfoW
(the minimum-Windows check, compared against `$winver`), CharUpperBuffW,
CompareStringOrdinal (switch names), and GetFileSizeEx / SetFilePointerEx
(it sizes and seeks its own exe). All are implemented, with assertions in
`test/test-delphi-corpus-apis.js`.

**Next blocker:** MessageBox "The setup files are corrupted" (shown truncated
in the log as "The setup files "). This is not a seek bug. The trace shows
GetFileSizeEx and both SetFilePointerEx calls returning the expected
positions, and the 0x40/0x4/0x31/0x4/0x9 header reads at 0x8958d6..0x89594f,
then 4 KB chunk reads from 0x89595c. The failure is in Inno's own
CRC/decompression of those chunks: guest code, so likely an x86 emulation
issue. It has not been investigated. Run 20261125-delphi-corpus-fixes,
`logs/inno674-trace.log`.

Double Commander 1.2.11 (FPC) gets past LookupPrivilegeValueW and stops on
`SetDllDirectoryW` at batch 174. That API is not in api_table.json; it needs
a DLL search directory threaded into LoadLibrary, so it was left unimplemented.

## 1.3.26 / 2.0.19 / 3.0.7: not windowless (2026-11-25)

The sweep reported "no window" for these loaders. Their first UI is a modal
Yes/No `MessageBox` ("This will install Inno Setup. Do you wish to
continue?", type 0x24), not a CreateWindowEx frame, so a window census never
sees it. The PNG shows the box rendered correctly. To go further, click Yes
with `--input`; the wizard runs in the spawned child. Run
20261125-delphi-corpus-fixes, `inno307-loader.png`.
