# Baldur's Gate II demo

Distinct from the Baldur's Gate 1 previews in baldurs-gate-demos.md. No BG2
entry exists in the inspected DESKTOP_APPS list or current app registry.

Original local package directory:
`test/binaries/win98-games-a-d/Baldurs-Gate-2_demo-SW-OpenGL/`.
Seven split Wise installer files are present: `bg2demogs.EXE` and
`bg2demogs.W02` through `bg2demogs.W07`. The first six are102400000 bytes each;
W07 is33270892 bytes, total647670892. EXE header strings identify Wise and
"Baldur's Gate II Demo". No payload modification or installation yet.

Run `20261009T0852Z-bg2-installer-preflight` contains exact paths, sizes and
SHA256 for every part. Initial executable SHA256:
`772c67fd2d73599e60a43c74466df11641a55f68ccce02fb82b38e26e666f689`.

Next: transfer the original split package to a temporary boat, inspect the
installer route and extract/install there. Keep all split siblings mounted
together. Installed executable/support paths remain unknown until this is
done. Local disk is near the2GiB floor, so do not extract locally. Serialize
runtime behind Alice; no concurrent second worker under the budget policy.

Acceptance requires registered launch, ordinary input changing gameplay and
a reviewed screenshot with original media/build identity. Installer, menu and
automatic cinematic captures do not qualify. No public deployment or approval
of agreements is authorized by this task.

Original-media transfer started21:12:13Z to bx_42ztf6q5:/home/user/bg2-original-20261009. SCP was unavailable to this API key; existing authorized exec-based file transfer is used instead. Local controller2285616 has immutable21:42:13Z deadline and per-file original/remote SHA256 checks. Receipt scratch/bg2-transfer-20261009/receipt.json is authoritative; partial transfer is not installation. This only copies original files while the one guest-runtime slot stays serialized.

## Remote media staged (2026-10-09T21:38:58Z)

Resumed controller2307995 completed all seven original Wise parts,647670892 bytes, with per-file SHA256 verification on bx_42ztf6q5:/home/user/bg2-original-20261009. Receipt and initial file inspection retained in scratch/runs/20261009T2139Z-bg2-staged-media/. Remote box lacks 7z and unshield; archive listing did not run, even though the piped shell returned0. Next obtain a suitable extractor on the temporary box, inspect the Wise package and determine installed executable/support paths. No installer acceptance, game run or gameplay evidence yet. Boat expires22:04:59Z.
