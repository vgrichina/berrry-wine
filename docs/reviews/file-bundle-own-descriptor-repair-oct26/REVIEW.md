# Own descriptor field repair

Rejected input: `d0cda4dbe6d788694b98009f9897faf5c12c837e`.
Read-only independent review: `c5c22bc471b9b1842844b925edc4bbb5152d39fc`.

The parser now requires an own `f` before reading the filename. The existing two-own-key check and own size/status validation then establish exactly {f,size} or {f,status}. The additional check precedes property access, so an inherited filename getter is never invoked. No framing, server, loader or name compatibility changes were made.

The unchanged independent reproducer ran on the exact rejected source: 7 passed, 2 failed, showing both actual Maps rather than null. After repair: all 9 passed. The unchanged supplied framing suite passed all 8 before and after. The new focused suite passed 3/4 before and all 4 after. It covers missing own f success/404/413, inherited throwing getter, clean realms, inherited size/status, own nonstring names, extra keys, valid own special/empty/Unicode names under contamination, zero length, offset zero-copy views, error ordering, duplicate names and trailing bytes. All tests evaluate the complete host.js in fresh VM contexts; no emulator or wasm arena is constructed. Logs retain Node's default spec reporter output despite their .tap filename suffix.

Every suite used `timeout 30s node --max-old-space-size=192 --test TEST_PATH`. Baseline and repaired checkpoints retain exact commands, exit codes and hashes after each group. source-verification.json binds baseline files to immutable Git objects, verifies the independent reproducer byte-for-byte against the review, and records repaired full-file hashes. lib/file-bundle.js and the framing suite are unchanged. The coordinator already rehashed the review's 13 committed payloads; this task reused that receipt and ran the final unchanged nine-group test.

Only host.js parser region, test/file-bundle-own-descriptor.test.cjs and this review directory are committed. Root worktree/index/refs and all donors stayed read only; messageboard entries are append only. No main integration, service restart, heavy build, runtime/guest access, public deployment or test-box operation occurred. No box was assigned; lifecycle remains coordinator-owned.

Remaining gate: independent acceptance of this repair, followed by coordinator-owned reconciliation against current remote main and the separately owned bounded-read server repair. Maelstrom owns shared integration. These small Node tests make no runtime/gameplay claim.

Incidents: the initial combined instruction/test reads exceeded the 8192-byte excerpt limit; later reads were bounded. An expected absent destination glob returned exit 2 during discovery and was corrected by creating the isolated directories. A summary grep expected TAP markers while Node emitted spec output and returned 1; individual suite exit codes were already preserved and the summary pattern was corrected. No oracle or test failure was suppressed. Before tests, admission measured repo/ops plus launcher and used a conservative 30MiB future envelope; publication explicitly measures this session and conservatively charges all shared WAL once with 12MiB future and 8MiB reserve, superseding that estimate. Installed Node and read-only donor objects remain standing inputs.

The whole staged-tree whitespace check reported whitespace emitted by Node in the preserved failing logs. Raw first-failure evidence is retained byte-for-byte; the source/test/docs check excludes only those raw .tap logs.

The first commit attempt stopped because the fresh Git repository had no author identity. No commit or push occurred; copied the existing donor Codex author identity into this isolated repository only, then retried publication.
