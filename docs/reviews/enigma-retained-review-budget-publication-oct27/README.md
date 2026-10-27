# Enigma explicit review reservation repair

The retained actual menu at batch 78593 was fully reviewed, but its 14.5435s +
16.8627s frame fetches exhausted the nonrenewable 28s review allowance before
Start Game. No click was dispatched. This source repair preserves that failure.

An optional controller `review_plan` contains `checkpoint_seconds` (one positive
transport-plus-full-image-review allowance per progress checkpoint) and
`progress_seconds` (the total advance-window allowance). The production launch
entry rejects incompatible review, capture and wall budgets before child creation.
Required controller seconds are progress + all review slots + cleanup +
`(4 * checkpoints + 8) * request_timeout`; readiness is added by the supervisor.
This includes bounded step/snapshot window overrun and all action/cleanup calls.
The controller reserves later slots before progress/capture/review, debits actual
review to the original single cumulative allowance, and refuses late decisions.
No plan keeps the existing legacy scheduling contract, including immediate
prewritten reviews at zero wait. No existing budget, CPU/API/capture counter,
listener/authority proof, serial ACK or frozen-zero requirement is renewed.

The source-only regression invokes actual production `main --launch-config`
with the unchanged offline child transport, real subprocess/listener/HTTP and
full synthetic 640x480 PNGs. A fake review clock uses the retained transport
measurements. It does not run Node, a guest, Boat or a remote API, and does not
claim to see the actual retained menu. With explicit 34s admission both reviews
complete and exactly one input follows a fresh frozen-zero snapshot. With 28s
the unplanned regression retains the original zero-input failure. An explicit
inadequate plan rejects before any child. A short first slot cannot spend a
later slot; depleted CPU/API/captures/deadline still refuse input.

The separately admitted example in receipt.json needs 108s inside the unchanged
110s cap, with 17s+19s review slots, 36s progress, 8s readiness, 12s cleanup and
1s control timeout. The old 3s timeout cannot fit that plan and is rejected.
Future transport latency and progress rate remain runtime acceptance gates.
Never replay the exhausted invocation or infer input authority from old images.

This is an orphan report/source task branch: integrate only the two tools, new
test and review receipt after independent acceptance. Never merge the whole tree.
Original diagnostics and canonical publication/cleanup/accounting are in the
worker-owned ops directory and receipt-manifest.json. No main or public deploy.
