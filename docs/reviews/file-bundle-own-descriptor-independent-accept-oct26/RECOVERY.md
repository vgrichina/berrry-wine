# Recovery

Fetch the published review branch using exactly:

```sh
export GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
git fetch origin task/file-bundle-own-descriptor-independent-accept-oct26
```

The review commit's parent is exact candidate
`3f5956fffd23ed03cdd22975b474e348c8b966ca`. Use a fresh isolated focused checkout;
do not change main or donors. Verify source-pins.json and evidence-manifest.json.
Recover the unchanged reproducer from
`c5c22bc471b9b1842844b925edc4bbb5152d39fc:test/file-bundle-parser-independent-accept.test.cjs`
under test/ without modifying it; it is not added to this review commit.

Under fresh resource admission, run each test independently:

```sh
timeout 30s node --max-old-space-size=192 --test test/file-bundle-parser-independent-accept.test.cjs
timeout 30s node --max-old-space-size=192 --test test/file-bundle-parser-framing.test.cjs
timeout 30s node --max-old-space-size=192 --test test/file-bundle-own-descriptor.test.cjs
timeout 30s node --max-old-space-size=192 --test test/file-bundle-own-descriptor-independent.test.cjs
```

No binaries, installs, server process, guest mount or wasm arena are required.
Local /tmp and ignored messageboard entries are not durable backup. Publication
SHA and exact trusted ls-remote verification are in the task ops/publication.json
and the root messageboard. Review result and payload manifest are committed here.
Current-main reconciliation is explicitly separate.
