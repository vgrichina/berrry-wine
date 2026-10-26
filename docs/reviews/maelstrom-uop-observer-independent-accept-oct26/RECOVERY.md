# Independent review recovery

Candidate 145e66c80606c1ab4f854cef0cfcff2f5d6364ac; base 44e344fdb26daab9a07210656597902ba27cb5f7.
Branch task/maelstrom-uop-observer-independent-accept-oct26.
Task root /tmp/maelstrom-uop-observer-independent-accept-oct26, repo and ops below it.
Read-only donor /tmp/maelstrom-uop-owned-native-observer-repair-oct26.
Recreate focused source with setup.py only in a NEW task directory after resource admission; never run it over an existing checkout. Flat object leaves are in checkout.json. No recursive alternates or full-history fetch.
Run installed Node/compiler in place. Source pins/standing files are in pins.json and standing-source.json; standing-tools.json records installed compiler identities. Verify hashes before execution.
Restore baseline-latch.cjs from the donor ops path or git show 44e344fdb26daab9a07210656597902ba27cb5f7:tools/maelstrom-native-errno-latch.cjs. Require SHA256 24b0e65c902cad56974a12da48251b77b3eebb018c4bd5825d7e2f5050b06095.
Restore run.py into ops. For the baseline invoke: python3 ops/run.py baseline node test/maelstrom-uop-native-observer.test.cjs --baseline (cwd unimportant, runner selects repo); expected exit1 is asserted. Its raw assertion stack is retained unchanged.
Run repaired supplied test, seven suites and independent test using command vectors in acceptance.json. The runner includes resource checks and exact environment. Keep NODE_OPTIONS=--max-old-space-size=192 and wall/output/file guards.
Fixture Wasm is reconstructible; its hashes match the original supplied repair and baseline. Original binary roots remain standing readonly paths in run.py; verify BINARY_PINS before use. No original/native-game result follows from these fixtures.
The independent test loads only the factory prefix of the byte-pinned supplied fixture, cutting at the first unchanged raw-completion test, then exports the fixture functions. The supplied nine groups are separately executed unchanged. This is explicit harness reuse, not a second independent decoder.
Evidence manifest excludes itself and binds every retained payload; later publication receipts bind the final commit via ops/result.json. Recover by exact task remote SHA reported in result.json, using trusted configuration in configuration.json. Never force push.
No assigned box: do not query/start/stop one; lifecycle remains coordinator-owned. Remaining canonical/full-compiler/authentic-game gates are in the review. No runtime is authorized by this recipe.

If Git tree creation reports missing immutable parent review blobs, use object-recovery.json exact donor loose-object paths. Verify decompressed Git SHA1 before copying into the owned object store; recover-objects.py records the finite loop and first failures. Donors are never written. No full-history fetch is needed.
