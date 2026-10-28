# Recovery

Fetch the published task branch with the configured trusted Git SSH command.
Its first parent must be 2e6f5984d3f64d7781fb02da09bbb8d564302123.
No module/native/guest output was produced. The previous build report remains
on task/shadow-man-admitted-remote-native-oct28 at 70fc442fef1d5af4ee2f851241d870eb1d39c4db.

In a resource-admitted full source checkout, run the unchanged production scanner
with `/usr/bin/node --max-old-space-size=320 tools/callback-ownership-census.js`,
and the focused regression with `/usr/bin/node --max-old-space-size=320 tools/shadow-man-callback-census.test.js`.
Use the recorded CPU90/wall120/groupRSS512MiB/output2MiB supervisor limits;
apply Git DATA256MiB only to Git. Preserve an 8MiB disk reserve.
To reproduce the original rejection, use a separate checkout of the exact parent
and run its unchanged scanner. Do not replace the current census in place.

The original census and eight-producer-review.json permit an independent exact
six-replacement/two-addition check. The candidate source delta is retained; source
files and scanner are available from the exact parent Git tree. The guard and
reconcile scripts are historical task recipes: their paths assume a task directory
with ops/, evidence/ and repo/; remap that task root for another recovery location.
A portable archive of ops/ and evidence/ is sealed in the canonical publication
directory, together with the publication receipt and SHA256. Runtime is forbidden
under this task; recovery commands are source-only.
