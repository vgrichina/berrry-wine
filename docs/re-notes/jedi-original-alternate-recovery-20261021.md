# Jedi alternate original recovery: acquisition blocked

No original package was recovered. Observed-tree restoration was not started:
the 174 original-dependent mappings still lack their exact input bytes. There
were no guest probes, installer replays, builds, production changes or workers.

Acquisition ran approximately 16:14–16:17 UTC on 2026-10-21, below the
20-minute limit. Four distinct source candidates were considered, conservatively
counting the supplied archive lead as one:

1. The [preserved official download page](https://www.jkdf2.net/JKBot/JKArchive/JKDF2/JKDF2/Websites/Official%20Jedi%20Knight%20Website/Star%20Wars%20Jedi%20Knight%20Dark%20Forces%20II%20-%20Demo_files/demo_download.htm)
   links to `http://www.3dgamers.com/3daction/00archives/jediknight/`, not a local
   installer. Its parent JKDF2 archive directory returned HTTP 403.
2. That 3D Gamers web link redirects to `https://www.fileplanet.com/`, HTTP 403.
   The actual historical FTP package link published in the
   [Gamers.org FAQ](https://www.gamers.org/docs/rgcd-pips/Other3D.html),
   `ftp://ftp.3dgamers.com/pub/3daction/jediknight/releases/jedidemo.exe`,
   timed out connecting after 8.003 seconds, curl exit 28, zero bytes.
3. The [PCGamingWiki demo listing](https://community.pcgamingwiki.com/files/file/1308-jedi-knight-dark-forces-ii-demo/)
   returned HTTP 403 and a JavaScript challenge. No bypass attempted.
4. The [RGB Classic Games forum](https://www.classicdosgames.com/forum/viewtopic.php?p=8808)
   preserves a historical Terra package URL inside a Wayback link. The original
   URL `http://www.terra.com.br/games/downloads/jedi_knight_dark_forces_2/jedidemo.exe`
   redirects to HTTPS and returns HTTP 404, curl exit 22, zero bytes. Wayback
   itself was not requested.

All shell acquisition requests used an eight-second connection timeout and
20-second page or 40-second package limit, with no retries. Package requests
also capped advertised size at 21,195,858 bytes. None of the forbidden Archive.org
endpoints or the predecessor's 3dfxzone challenge was retried. No alternate full
game, patched executable or different demo bytes were accepted.

## Identity and recovery handoff

Required package: `jedidemo.exe`, **21,195,858 bytes**, SHA-256
`8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e`.
**Durable original location: none**, locally or newly recovered remotely.
This is a bounded acquisition failure, not proof that no other mirror exists.

The predecessor's offline verifier was rerun: PASS 16 seals, 7403 source
inventory entries, 187 available / 174 original-dependent mappings, zero launch
probes. That verifies retained evidence, not a new runtime replay. API exec
confirmed `/home/user/jedi-source` remains clean at
`fe49a84e745015ecdbe752e028235924ef4324dc`. No module search or build occurred.

On SAME box `bx_wbedea9e`, `/home/user/jedi-predicate` retains `predecessor.tgz`,
`recover-layout.py`, `restore.py`, `original-inventory.json` and `HANDOFF.md`.
Their hashes were checked through API exec and match the predecessor. Recipes
were read before any use. After future exact package acquisition, recover all
39 source files with `recover-layout.py`, verify with `--check`, then provide
`restore.py` a flat original directory using inventory-spelled basenames (not
the lowercase nested faithful-source paths). `restore.py` checks every mapping;
preserve all 28 installed-original hashes and use only the retained observed
registry exports. Neither recipe was executed in this task because its required
original input is missing.

The box is left **RUNNING**, API `state=idle`, `health=ok`, `stop=null`, expiry
**2026-10-21T18:01:57.547Z**. The coordinator owns shutdown and receives ownership
back. Existing source, module and predecessor staging remain intact.

## Evidence and storage

Evidence: `docs/reviews/jedi-original-alternate-recovery-20261021/`;
run directory: `/home/user/wine-assembly/scratch/runs/20261021-jedi-original-alternate-recovery`.
Run `python3 verify.py` in the evidence directory for the sealed blocker checks.
No game binaries or credentials are committed. Original HTML is retained only
in the task run directory; tracked evidence contains focused provenance excerpts
and sanitized receipts, excluding challenge tokens and unrelated forum links.

The mandatory prewrite guard briefly blocked the Terra request: free space was
2,815,086,592 bytes at 16:16:13Z, below the 2,915,041,280-byte reserve. No package
write proceeded then. A handoff check observed an actual recovery to 3.54 GB;
the guarded Terra request then completed with 404. No unrelated cleanup occurred.
The task stays under its 64 MiB allocation. Sparse checkout contains only the
two instruction files plus this task's new evidence; shared config and root WIP
are preserved. No main merge, deploy, SSH, new/resumed box or lifecycle action.

The initial messageboard ownership entry used an estimated `16:17Z` timestamp;
the claim actually preceded the observed 16:16:07Z clock receipt. Subsequent
publication uses the system clock; this correction does not alter acquisition results.
