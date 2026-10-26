# Independent renderer operation-accounting review: REJECT

Candidate: `9004eca8e8f45a982f53eb24cf2c663565357f84`, tree
`5ea8549f4bdc5eeb693075629d3124dded6bd332`.

Two complete Uint8Array source scans evade the synchronous loaded-script
operation observer. Both traverse nested subview aliases:

```js
for (let j = 0; j < alias.length; j++) sum += (alias[j] += 0);
for (let j = 0; j < alias.length; j++) {
  const {[j]: value} = alias;
  sum += value;
}
```

Each consumes every byte and returns the independently calculated native sum.
The compound assignment preserves every source byte; destructuring only reads.
Native and observed producer RGBA agree. At sides 16, 32 and 64, the extra scans
read 1024, 4096 and 16384 source bytes respectively, but `indexedSourceReads`
is zero and the unchanged warm `budget()` accepts all six cases. These are
U8 indexed Gets in the exact synchronous loaded renderer script, within the
assigned scope. They require neither another typed-array type nor external or
asynchronous execution. Instrumentation does not reject this syntax.

`tools/d3d9-operation-observer.js` excludes all assignment left operands from
read instrumentation, including compound assignments that perform a Get.
Its MemberExpression rewrite also misses the implicit indexed Get performed
by computed object destructuring. The red oracle asserts the executed read
count; its expectations and the prior oracles/budgets were not weakened.

Validation on this exact candidate:

| Controls | Result |
| --- | --- |
| Unchanged prior independent reproducer | 14 PASS |
| Original source/fixture controls | 20 PASS |
| Earlier operation-accounting controls | 16 PASS |
| Candidate subview/tag controls | 21 PASS |
| New independent acceptance oracle | 4 PASS, 6 FAIL |

The four new positive controls challenge union accounting across overlapping
source ranges, nested/offset/partial/disjoint aliases, canonical/noncanonical
keys, native key coercion, OOB reads, throwing-key restoration, computed tag
receiver mutation during key/getter/substitution evaluation, same-site template
identity, distinct-site template identity, frozen raw templates and fail-closed
optional/suspending grammar. The supplied exact-version controls additionally
exercise tag throws at all evaluation stages, descriptor/observer restoration,
immutable RGBA ownership, ABA, suppression and recovery allocation rejection.
The baseline's unchanged 10 PASS / 4 FAIL receipt is reused from the repair
task. Older raw 4 PASS / 9 FAIL results remain measured budget rejections;
they are not a passing thirteen-test suite.

Run the independent oracle from repository root:

```sh
NODE_OPTIONS=--max-old-space-size=128 node --test --test-concurrency=1 docs/reviews/render-subview-tagged-independent-integrate-oct26/reproduce.js
```

`independent.log` records all six accepted-bypass counts and six assertion
failures. `unchanged14.log` and `supplied57.log` retain the green controls.
`identity-and-reuse.json` binds all five supplied pins. Production
`lib/d3d9-host.js` remains byte-identical with SHA-256
`3519e4ffeee513a1ba106ac25c77cadab7ffbe492eb61f70f5b4f7fbb38db22c`.

No implementation repair was attempted during acceptance. No main integration
is authorized by this rejecting result. Remote main was freshly observed at
`020576f4f6b206eb7981afdcf4eadc1002b8a0b2`; only this review task branch is
published. The candidate helper chain remains unintegrated.

This is source/fixture rejection, without a game performance or gameplay claim.
No new benchmark, timing row, historical seal packaging, browser, GPU, VM,
Wasm, compiler, build, Boat, deployment or service operation was performed.
Box `bx_k38z8byn` is unassigned here; the coordinator reported it stopped.
No box state was accessed or changed. Runtime lifecycle remains coordinator-owned.
