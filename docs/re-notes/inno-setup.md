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

The child then builds "Select Setup Language". **Next blocker:** the dialog's
label, buttons and combo paint only the first character ("S", "O", "C"; the
combo shows "(‡"). That is UTF-16 text read as ANSI somewhere in native-control
painting or WM_GETTEXT, since the CreateWindow titles in the log are correct.
It has not been investigated. Run 20261125-delphi-corpus-fixes:
`inno5311u-child.png`.
