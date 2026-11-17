# Half-Life 2 full wrapper and normal installation progress

Evidence: `scratch/runs/20261117-halflife2-fixed-wrapper-normal-install-progress/result.json`.

The prior installer endpoint remains permanently closed. Its correctly bound
Next control was never sent input because the wrapper shadowed the helper
source lookup key with the finite intent name; published `936ccca4f` fixes that
collision.

The authored full-wrapper regression now retains the complete original runtime
metadata and an opaque `source` field, then executes capture, review, bind and
an arbitrary finite intent name against a real native DialogBox. It requires
the native BUTTON return and both title and body changes. Reusing the same
capture must produce a non-consumed native cancellation; every subsequent
capture, bind and intent must fail before HTTP. Existing wrong-target and
actor/focus/modal/generation/context checks and 500/1750/3000 ms limits remain.

The adapter uses this task's separate single-invocation reservation. Completed
published VB native-core component tests are reused only for the same compiled
module and matching material source inventory. This does not reuse the VB
original's later cleanup as an outer lifecycle proof. The adapter always runs
fresh sealed main/CPUWorker/OSchild inheritance, focused changed components,
the full wrapper and its own actual outer lifecycle before original startup.
Changed module, material bytes and inventory are explicitly refused.

Normal installer progress and its next boundary will be recorded below after
the separately authorized original invocation. Installed physical footprint
is unknown; the installer declaration of 3995 MB is not storage admission.
