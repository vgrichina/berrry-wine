# GPS owner rejection diagnostics

The released MCM diagnostic WIP eagerly evaluated every owner predicate. An earlier rejection could therefore be masked by a later local-export or participant exception. The repaired guard preserves the original thirteen short-circuit checks and primary error prefix, adding the first failed predicate and bounded primitive owner identities only on rejection. Optional diagnostic faults cannot replace the rejection. WeakMap keys add no strong owner lifetime; no callback registration, admission, epoch, cleanup or scheduler behavior changes.

Review anchor: preceding host SHA-256 985d34ab5d6f1074abfee9a8e009320bc2c3e3599bd1f4be682644362d525b4d. The review is confined to the host diagnostic diff. Existing unrelated review WIP remains unchanged.

Validation and exact released/migrated patches: scratch/runs/20261120-main-host-callback-diagnostics-build-repair/. Thirteen predicate negatives, healthy/default and epoch-version controls, six error/payload controls, and the existing ten GPS lifecycle tests cover the change. Fixtures establish diagnostic behavior only. The actual MCM GPS failure predicate and gameplay remain unproved.
