# Publication and final local cleanup

The tested acceptance commit `324444e85485b375e4fef11865f4806202fe659b`
was pushed to `task/file-bundle-bounded-read-independent-accept-oct26`.
Trusted SSH `git ls-remote --exit-code origin` for that exact ref returned the
same full SHA. The remote reported its repository relocation to
`git@github.com:vgrichina/berrry-wine.git`; strict host/key verification remained
unchanged and no remote URL or trust files were modified.

After successful push and exact verification, the publication shell's optional
`git status` refresh hit SIGXFSZ because the worker mistakenly applied the
128 KiB output cap as a global file-size limit. The original Git index was
1,518,634 bytes; its incomplete owned lock was 131,072 bytes. After the command
exited, only that lock was removed. `GIT_OPTIONAL_LOCKS=0 git status --short`
then succeeded cleanly, with the original index/source/test data intact. No
unchanged denied operation or push was retried. Subsequent publication uses the
authorized 24 MiB individual-file limit; output stays separately bounded.

Earlier publication preparation also corrected the owned sparse path list to
include the new controls file, and compressed the raw first-failure TAP instead
of editing its diagnostic whitespace. The raw log remains unchanged in ops and
is recoverable byte-for-byte from its committed gzip copy. `git diff --check`
then passed without changing source or test behavior.

This documentation-only follow-up preserves publication/cleanup evidence. The
final commit SHA and exact remote verification are in
`/tmp/file-bundle-bounded-read-independent-accept-oct26/ops/result.json` and the
append-only root messageboard. No code changed after the 21 successful checks.
The owned board watcher and all owned test/Git children were reaped. There is
no assigned box, state or expiry; coordinator lifecycle ownership is unchanged.
