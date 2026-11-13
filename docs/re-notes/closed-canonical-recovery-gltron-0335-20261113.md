# Additional canonical worker log recovery, 2026-11-13

Nine additional closed canonical wine-worker rollouts were recovered losslessly
into LOCAL original-path `.jsonl.gz` siblings. Full original bytes total
32,709,174; encoded bytes total 20,318,859. Allocated reclaim before run evidence
was 12,394,496 bytes. This is distinct from net filesystem free-space change.
No prior 23 or NFS0250 six encoded paths were changed.

Evidence and executable recovery recipe:
`scratch/runs/20261113-closed-canonical-recovery-gltron-0335/RECOVERY.txt`.
Keep all nine sibling gzip files, `index-UUID.json` files and `restore.py`.
Run `python3 scratch/runs/20261113-closed-canonical-recovery-gltron-0335/restore.py INDEX`
to restore the original raw path BEFORE history consumption/resumption.
Restoration refuses overwrite and preserves original mode and nanosecond mtime.
Encoded bytes and indexes must remain after restore.

Eligibility used the all-date completion-dedup canonical processed records,
each worker's own exitCode 0/profile wine-worker result, nonempty final metadata
and full hash, and canonical review. Filename UUID and first session_meta id/cwd
matched; complete newline-terminated JSONL syntax and full original SHA/size
were stable across checks. H2 content stayed opaque storage bytes: no guest
payload decoding, extraction or interpretation. Worker success is distinct from
inner game/supervisor failure or UNKNOWN. Thus closed graphics0150 and GLTron0230
workers were eligible despite their runtime limits. The rejected H2 worker
01a1d201-fe82-7792-a61e-4802f070d6af and scope-failed manifest0050 worker were
excluded, along with Diablo families, active registry UUIDs, root/coordinator,
unprocessed and failed workers. No rejected workflow was retried.

Before each raw unlink: fsynced exclusive sibling and directory, independent
`gzip -dc` original SHA/size, encoded SHA/size, durable index/recipe/helpers,
actual RAM restore with mode/mtime/SHA and overwrite refusal, unchanged source
and result/final/review hashes, privileged zero-opener FD/map census, and live
registry recheck all passed. Ten privileged censuses reported no hits or errors.
Final independent verification repeated all nine full decode and RAM restore
checks. No external storage, source/media archives or production edits occurred.
Exact Git SHA, relevant binary diff and owned new helper/note patches are retained.
All 92 existing GLTron media paths and hashes were verified without copies.

At final verification actual `/home` free space was 1,486,368,768 bytes, short of
the owner 1,500,000,000 rule by 13,631,232. The inspected eligible nine are exhausted.
No floor-hold loop or game launch/input occurred. The parent improved supervisor,
atomic consumer and existing five plus three test artifacts were referenced by
SHA; no matrices repeated. A fresh game would require its independent runtime
guard before launch, but no runtime was created here. Two live distinct corners
remain UNPROVED; prior one-corner/PLAYER3WINS and parent actual runtime EOF UNKNOWN
are unchanged. No replay, route, tracking, guest state or config writes occurred.

Box ID none; state NOT_CREATED; expiry null; stop receipt N/A. Next: additional
explicitly authorized local recovery sufficient for actual free space, then a
fresh bounded ordinary-UI GLTron round using the prepared supervisor and reviewed
full scenes between finite inputs with independent UP. This commit is notes only;
no production build was required.
