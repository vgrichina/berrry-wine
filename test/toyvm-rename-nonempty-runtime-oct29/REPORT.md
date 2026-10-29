# Rename over nonempty directory at quota

PASS in one unchanged production CLI/FUSE invocation at candidate `5a88ca099b962e946160afd2d4d71a950bf46db3`.

The supplied fixture created D, S, T and T/E. `os.rename(S,T)` raised observed ENOTEMPTY (39). All four paths remained directories with their original distinct inode identities (2, 3, 4, 5).

CLI exit was 0 and accepted was true. Post-reap accounting: live/peak 20480 bytes, written 0, inodes 5, open handles 0. No stop reason, filesystem failure, external safety cleanup, or remaining FUSE mount. Sampled PID/start identities were absent or reused, and the production-owned identity subset matched. Exact five source hashes were unchanged.

The supplied source/fixture/gate prechecks were reused; no broader tests or second production invocation ran. Fixture, observer and oracle are byte-exact. Raw runtime, executable pins, prelaunch record, bounded staging manifest and API lifecycle receipts are retained in evidence. Local admission retained the 24 MiB aggregate allocation and unchanged memory/disk floors; Git limits applied only to Git subprocesses.

Source guard ordering is inference, separate from observed errno/namespace behavior. No callback-specific trace was captured. Process/RSS observations are sampled. Browser/gameplay/general-resource qualification remains outside scope; browser allowance is unchanged.

Boat bx_th7j9v6r was preserved with a named snapshot, then stopped and verified actually stopped under explicit task delegation. Actual expiry is recorded in runtime-canonical.json. No production repair, main integration, or public deployment.
