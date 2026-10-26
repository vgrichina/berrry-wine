# Recovery

Fetch the published task/file-bundle-own-descriptor-repair-oct26 branch from origin with the dedicated trusted SSH configuration. The parent is d0cda4dbe6d788694b98009f9897faf5c12c837e. The branch contains host.js, the new test and compact committed evidence. Check source-verification.json before reusing evidence.

Recover the independent test without modification from c5c22bc471b9b1842844b925edc4bbb5152d39fc:test/file-bundle-parser-independent-accept.test.cjs, placing it under test/ for its relative host/server imports. The framing test is already in the parent. Run each of the independent, framing and own-descriptor tests using timeout 30s node --max-old-space-size=192 --test PATH, under fresh resource admission. Reproduce the failure by testing the unchanged independent test against parent d0cda4db; do not change the oracle. Preserve baseline and repair logs. No ignored binaries or large artifacts are needed.

This isolated Git database borrows existing immutable flat object leaves via alternates without copying or rewriting donors. Publication is the durable backup; /tmp and the ignored root messageboard are not durable artifact storage. Exact remote publication SHA and verification are in ops/publication.json and root messageboard. No main merge is authorized.
