# Four namespace repair candidate

Direct production Backend.handle checks pass for the combined rename-type, rename-cycle, UNLINK/RMDIR and READDIR actual-parent repairs.

Baseline HEAD: d96285b9f62c081baa333f2952acbad9885d675f (published cycle-only baseline).
The input was transferred uncommitted cycle+removal WIP, 11615 bytes, SHA256 bb07cae2b018ac4123640af1d18c9ee666b89c048cf7ab9e27039d699989d72f.
Final backend: 12321 bytes, SHA256 d129d1a4d42d9dd4077941927fa57220a32580667a1fef226de11dec2a411171.
Only the accepted rename-type guard and READDIR op28 donor block were added to that WIP. Relative to HEAD the diff also publishes its previously uncommitted removal guards. The cycle guard is unchanged.

Checks: rename-type 156 cases / 9 source mutants; cycle 14 original + 24 independent / 16 oracle controls / 4 mutants; removal 14 original + 168 independent / 12 oracle controls / 9 mutants; READDIR 870 original + 7329 independent wire + 10 corrupt-state EIO cases / 3 oracle controls / 7 mutants; 24 four-repair interactions. Structured results and exact source identity are in results.json and assembly.json. Raw operation captures remain outside Git under the task root e/ directory.

The first reproducer invocation omitted its required source argument, before loading production. The corrected invocation passed. The rename-type suite ran between these invocations, so the boundary-first ordering checkpoint was not fully met. No behavioral failure was hidden or waived.

The mutation target adjustment is restricted to the accepted rename-type guard; behavioral and oracle checks are unchanged. Other retained edits update candidate pins and identity paths only. Historical report candidate strings and donor receipts are provenance, not current pins. The five input pins come exclusively from this task dispatch.

No mounted filesystem, kernel, full CLI, browser, or gameplay claim. Caller still pins the OLD backend. Fresh independent combined acceptance, caller pin update, and full CLI qualification remain gates. No main, public deployment, Boat or runtime operation was performed. No test box was assigned; lifecycle remains with coordinator.
