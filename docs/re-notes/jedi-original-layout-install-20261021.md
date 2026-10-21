# Jedi demo: original SFX layout and ordinary installation

The original directory contract is proven from the pinned self-extractor's
metadata and code. Faithful source recovery fixes the missing-payload result:
ordinary installation now copies **28 original game files, 39,900,850 bytes**,
with every SHA-256 unchanged. Installed `Jedi.exe` displays its launcher and
responds to Play. Play opens the original **DirectX 5.0 requirement** dialog;
`JkDemo.exe` does not start. Gameplay remains unqualified. No gate was bypassed.

## Original-byte proof

Package: `jedidemo.exe`, 21,195,858 bytes, SHA-256
`8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e`.
The existing package on the assigned runtime was reused; no download occurred.
All 39 original names, sizes, offsets and hashes match the predecessor inventory.

The flat ZIP headers omit essential information. Between its 39 single-member
ZIPs, the SFX stores records comprising a 32-bit path length, encoded source
path, 32-bit timestamp and 32-bit embedded ZIP length. They form one exact chain
from package offset `0xacf0` through EOF, not a heuristic scan for filenames.

The NE resource table identifies the configuration at **file offset `0xa450`**,
resource type 1024. Its first fields are structure size 404, format 6, first
record `0xacf0`, member count 39, package size 21,195,858. Its decoded fields are:

* `+0x44`: `setup.exe`.
* `+0xc4`: `the Jedi Knight Demo`.
* `+0x114`: `D:\PROJECTS\LUCASA~1\JEDI\FULLDE~1\INSTAL~1\DISK1\`.

The original NE code/data segments are Blinker compressed. `unpack.py` executes
the **original segment-1 decompression routine at `0x61e`** in an isolated
Unicorn 2.1.4 x86-16 harness with scratch memory/stack. It does not run a Windows
guest or substitute decompression code. Expanded segment 2 is 55,000 bytes,
SHA-256 `312d7c807564970dd8c81864d3568214f4be3ea9316ab9c826e65a0ebb3765c0`;
segment 3 is 5,535 bytes, SHA-256
`3dddba53f8738a1b4c4c25ad7870ed84d9875c2c96f4284463f7845b03fa91a0`.
An initial 10-million-instruction inspection limit was insufficient; its failure
receipt is retained. The bounded 200-million limit completes. No originals were
patched. The inspection dependency lives only in task-owned remote storage.

Segment **2:0xe4c–0xeaa** is the original metadata decoder. The key is original
segment 3 bytes `0x10–0x17`: `b3 f2 ea 1f aa 27 66 13`. For byte index `i`, let
`j=i&7`, `r=7-j`; plaintext is `ROR8(cipher XOR key[r], r) XOR key[j]`.
All **43 strings** (four resource fields and 39 member paths) were independently
evaluated by both the Python transcription and that unmodified x86 routine;
every byte agrees. `layout-proof.json` retains encoded records and decoded paths.

The directory interpretation is established by the original caller, not merely
by plausible decoded text. Segment 2 at `0x1470–0x1488` copies and decodes the
resource prefix; `0x1637–0x1648` decodes and terminates a member path;
`0x164d–0x1664` splits it at its final backslash using `0xa2c`;
`0x1667–0x1680` takes the configured prefix length and copies the directory
suffix. NE relocation chains identify **KERNEL.90 lstrlen** at operand `0x1674`
and **KERNEL.88 lstrcpy** at `0x1681`. `0x1685–0x1690` creates that relative
directory under the extraction root. `0x1887–0x18dc` changes into that directory
and invokes the embedded ZIP extractor at `0x201a`. Thus the directory comes
from the outer record and the extracted basename comes from the ZIP member.
The DOS source spelling `JK1MPDEM.GOB` does not rename ZIP member
`jk1mpdemo.gob`. Full code, focused disassembly and relocation/resource records
are sealed as evidence.

The proven layout, relative to the extraction root, is:

```text
11 setup/support files at root
WEBJEDI/
  Jedi.exe, jkdemo.exe, SysCheck.exe, Website.exe, Register.exe, Zone.exe
  SMACKW32.DLL, Jedi.txt, Jedi.doc, Readme.txt, Readme.doc
  EPISODE/jk1demo.gob, jk1mpdemo.gob
  RESOURCE/res1demo.gob
  RESOURCE/VIDEO/splash.smk
  CONTROLS/<13 original .ctl files>
```

This is a source distribution tree, not an invented installed tree. Host VFS
paths are normalized to lowercase, retaining Windows case-insensitive names.

## Corrected recovery and controls

The files-only [recover-layout.py](../reviews/jedi-original-layout-install-20261021/recover-layout.py)
replaces the flat-only recovery recipe for this exact package:

```text
python3 recover-layout.py /path/jedidemo.exe original-inventory.json NEW_SOURCE_DIR
python3 recover-layout.py /path/jedidemo.exe original-inventory.json EXISTING_TREE --check
```

It pins the package SHA-256, decodes the original base prefix and every record,
checks the contiguous ZIP-length chain to EOF, extracts each individual ZIP
with Python's standard library (including CRC checks), validates all 39 sizes
and SHA-256 values, and rejects unsafe paths before writing. `--check` successfully
re-extracted and compared all 39 originals against the staged source tree.
No duplicate package, build, installed tree or registry is synthesized.

The complete prior bootstrap capture was reused. `layout.py` copies its
unchanged support files and generated INI/child, removes the flat original-file
mounts (including the redundant executable alias), and supplies the 39 originals
at their proven source paths. It retains the actual `_ins0432._mp`, empty args,
`C:\` cwd and genuine bootstrap registry. Prior source/capture trees are intact.

**79 exact-source VFS controls pass:** the predecessor's nine controls, all 39
faithful source-file lookups, all 28 installed-file lookups, and three negative
controls. `C:\WebJedi\*.*` now enumerates the expected files/subdirectories;
root `Jedi.exe`/`res1demo.gob` and absent sound paths remain absent. Filesystem
semantics were unchanged. The offline verifier checks 87 sealed files, all 361
recovery mappings, encoded metadata, installed payload and launch/input evidence.

## Two bounded guest attempts

1. **Installation, 13:34:16–13:34:20 UTC.** Ordinary licence Yes was
   `click:415:395`, batch 14088, at 13:34:16.485Z, followed by Welcome.
   The same original UI route reaches Setup Complete; Finish exits 0 at
   13:34:20.224Z. Every installed game payload hash matches its original,
   including Jedi.exe (305664), jkdemo.exe (1388032), all three GOBs, video,
   Smacker DLL and 13 controller files. The installer generated its own
   registry, uninstall log and shortcuts. This is verified copying, beyond
   the predecessor's metadata-only completion.
2. **Installed launch.** Original installed `Jedi.exe`, installed cwd and
   actual exported installer registry display `Jedi Knight Demo Launcher`.
   Ordinary `click:320:284` at batch 1503322 selects Play. The original program
   probes the supplied `DDRAW.DLL` and `DSOUND.DLL` (each 1024 bytes) and opens
   `Jedi Knight Demo DirectX (tm) Setup`, saying DirectX 5.0 is required and
   not supplied in the demo. Only Cancel is visible. No game child handoff
   occurs. The capture was inspected, and the bounded controller quit ends
   the session at 13:35:39Z. No direct-engine workaround or third attempt.

The precise observed blocker is the launcher's DirectX requirement dialog.
This task does not establish which detection/version predicate fails or claim
that all DirectX functionality is absent. Gameplay, game input, audio and FPS
are not qualified. Launcher input is qualified only through the observed Play
transition. No broad emulator change is justified by this result alone.

## Identity, sealed recovery and handoff

Exact source **`fe49a84e745015ecdbe752e028235924ef4324dc`**, all 7403 tracked
blobs verified before/after; remote checkout status clean. Canonical module
**`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`** reused
unchanged. Canonical build/gate evidence is reused from predecessor
`866e4249818d27a8c2a4397008e577d552cfd3db`; no production change needs a rebuild.
Diagnosis predecessor is remote-verified
`7ca0dee679034d6792cd74b91a8298ab9b3986ac`.

Archive `evidence.tgz`: **1,925,047 bytes**, SHA-256
`fea97ead7fe1b0f4f9bba0264d8073e5956857150dba2d97a2b1a4a62190f9cb`.
Recovered locally at 13:37:43Z, before the 14:30 handoff deadline. It contains
87 sealed evidence files, original decoder/code proof, screenshots, logs,
registry exports and recovery payloads. `recovery-trees.json` maps **361 files**
across faithful source capture, installed VFS and post-launch VFS to exact-source
blobs, unchanged originals or included content-addressed payloads. `restore.py`
verifies each hash while restoring those observed trees; it runs no guest.
Run `python3 verify.py` beside the archive for offline acceptance checks.

Local run: `scratch/runs/20261021-jedi-original-layout-install`.
Tracked bundle: `docs/reviews/jedi-original-layout-install-20261021/`.
Task branch: `task/jedi-original-layout-install-oct21`, no main merge/deploy.
The dashboard checker retains its pre-existing Zuma outside-run reference and
historical missing/invalid records. Jedi is unregistered; no unrelated candidate
record was fabricated.

Remote staging: `/home/user/jedi-original-layout-install`; its `faithful-capture`,
`install1/vfs`, `launch2/vfs` and sibling `.tgz` remain intact. Existing
`/home/user/jedi-current-main`, `/home/user/jedi-original`, `/home/user/jedi-evidence`
and `/home/user/jedi-missing-payload-diagnosis` are preserved. Postflight shows
no guest/controller processes. Box **bx_723bg5h6 remains RUNNING**, API state
`idle`, health `ok`, expiry **2026-10-21T14:51:37.859Z**. The coordinator owns
shutdown. No SSH, resume, new box, snapshot-stop, workers or replacement tasks.
Producer-changing integration freeze and unrelated root WIP remain intact.
Local task allocation stays below 64 MiB; shared free space briefly dipped below
the requested reserve and recovered before bulk evidence materialization.
Publication receipts record exact task/main remote refs and final free space.
