# Recovery

Canonical output directory:
`/home/user/wine-assembly/scratch/usage-watch/toyvm-capture-cancellation-qualification-oct28`.
Read receipt.json first; it references the verified predecessor manifest and new
delta hashes. Never execute predecessor default wrappers or overwrite their files.

browser-evidence.tgz SHA256:
`eb35a6ef79379a8488fc5520a2edf9c9cb2fe108c5a05227a8fb55f4d973e350`.
Its26 files include exact executed harness/guard/supervisor, CDP command order,
trusted events, control differential, boundaries, startup/build, runtime ledger,
separate logs and rejection. Extract with Python tarfile filter='data' into a new
owned directory. Run the committed verify.cjs against that directory for offline
observation/negative-control verification. It must report qualified:false.

payload.tgz SHA256:
`9e98af1c511c8d90c14ee95bd133d8dcd10d9a4ba46346593ea0fdaab79c4be7`.
It includes the exact four candidate web payloads and pre-execution harness. The
trusted supervisor comes from the read-only helper pinned in the delta receipt.
All original screenshots and sealed passing groups remain by reference in the
predecessor receipt/archive. New task sources add only the focused harness,
offline oracle and report; no binaries/images/credentials are committed.

This is a rejected runtime diagnostic, not a replay recipe or permission for
another attempt. Preserve original90CPU/120wall budget: cumulative
54.646817CPU/18.504449306wall, seven prior images and zero new images. Fresh box
bx_266epr5b is stopped; never resume it as recovery. Any further runtime needs
coordinator assignment and remaining-budget/lifecycle/resource admission.
