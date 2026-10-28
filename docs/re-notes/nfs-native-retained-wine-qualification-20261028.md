# Retained native Wine32 qualification, 2026-10-28

Status: **BLOCKED before remote inspection or Wine execution**. The single
authorized resume of retained snapshot `bx_nnnajdp9` was refused with HTTP 403:

```json
{"code":"api_key_action_forbidden","error":"This API key cannot perform sandbox.resume.","event":"error","status":403}
```

The exact command was:

```sh
/home/user/.ascii/boat --no-update --json resume bx_nnnajdp9 --ttl 2400 --fail-fast
```

It exited 1. Separate stdout (119 bytes) and empty stderr were preserved. Stdout
SHA-256 is `7a80cfe6ba07c5f0371d8a6e41b737300bd5795fb0852a3ca7049e37d2d7340f`.
The local supervisor reported cleanup complete. No retry, alternate box, SSH,
remote exec, package operation, prefix, display, installer or game followed.

## Retained evidence and limits

The predecessor canonical receipt is
`scratch/usage-watch/nfs2se-original-installer-output-oct28/receipt.json`, SHA-256
`6eccb60f3cb16ad9eb1bf2250ab2f71852fb9b3301267a83fbaabb37388004fc`.
Its coordinator review and shutdown confirmation are reused without rescanning
373 payloads. The confirmed snapshot was stopped at 12:18:49 UTC; the refused
resume supplies no fresh running-state or expiry evidence. Lifecycle ownership
returns to the coordinator. No remote processes were started by this task.

The earlier package operation remains **REJECTED: 126.655995 CPU seconds > 90**.
The installed Wine `9.0~repack-4build3`, wine32/libwine i386 and Xvfb package
entries, and previously empty dpkg audit, do not establish execution qualification.
They were not refreshed after the refusal. The failed package operation was
neither repaired nor repeated.

Actual remote executable resolution, versions, memory/disk, supported resource
enforcement, prefix architecture/hashes, PE32 cmd sentinel and exit are all
**UNOBSERVED in this task**. There is no CPU90 execution pass. The trusted
supervisor conservatively charges observed own+waited CPU and retains reaped
usage, but explicitly describes sampled/reaped RSS as a lower bound. Its report
alone cannot prove an exact whole-descendant physical RSS ceiling. Current
remote controls and complete CPU accounting could not be qualified after the
access refusal; no limit was weakened or reinterpreted.

## Deferred qualification recipe

This is a design for a separately authorized execution, not a successful or
ready-to-run reference recipe. First resolve and hash the installed Wine loader,
wineserver, optional Xvfb and Windows cmd.exe on the assigned box. Inspect the
actual cmd.exe PE machine type (i386/PE32), rather than infer it from wine version.
Verify supported whole-descendant accounting/enforcement before any Wine call;
unknown or incomplete accounting must stop execution.

Use one new private directory
`/home/user/nfs-native-retained-wine-qualification-oct28`, with a fresh `prefix`
and separate stdout/stderr from creation. The intended environment is a cleared
environment with `HOME=/home/user`, `PATH=/usr/bin:/bin`, `LANG=C.UTF-8`, `TZ=UTC`,
`WINEPREFIX` pointing to that private prefix, `WINEARCH=win32`,
`WINEDLLOVERRIDES=mscoree,mshtml=`, and `WINEDEBUG=+timestamp,+pid,+tid,+seh`.
Use a private display only if required, and record its exact configuration.
Invoke the resolved installed Wine command once to initialize the prefix and
run installed 32-bit Windows `cmd.exe /d /c "echo NFS_WINE32_OCT28_QUALIFIED&exit /b 0"`.
Do not separately initialize Wine or grant wineserver/display another budget.

The entire operation, including initialization, command, server, optional
display and cleanup, shares CPU90/wall120, whole-descendant physical RSS at
most 1 GiB with 805306368-byte remote reserve, and at most 1 GiB new disk with
2 GiB floor. Preserve conservative own+waited CPU accounting; unknown
completeness is not a pass. Capture exact launch argv/environment, executable
identities, distinct stdout/stderr, exit, prefix architecture and file hashes,
resource diagnostics and PID/start-time-owned descendant cleanup. Stop on the
first guard/access rejection and do not repeat rejected qualification.

## Consequence

This result **does not justify a separately authorized original-installer task**.
The retained native environment is still unqualified, rather than demonstrated
incompatible. No `INSTALL.WIN` was created and no project runtime was changed.
Even a future successful PE32 smoke would not prove compatibility of the
original NFS II NE installer, either original installer's behavior, authentic
installed state, CD dependencies, or gameplay.

Canonical task evidence:
`scratch/usage-watch/nfs-native-retained-wine-qualification-oct28/receipt.json`.
Private local diagnostics and wrapper sources are preserved alongside it;
no original binary, media, prefix or credential is committed. Initial policy
reads exceeded the terminal output ceiling before the bounded wrapper was
established; that incident is recorded and is not represented as compliant
execution acceptance.
