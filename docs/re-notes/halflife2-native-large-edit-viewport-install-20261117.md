# Native large Edit viewport repair

Evidence: `scratch/runs/20261117-halflife2-native-large-edit-viewport-install/`.
The previous numeric-only run and its exact 9099 native module are retained;
its 453,207-byte report alone did not establish a valid allocation or document.

The public native text exports read EditState's NUL-terminated ANSI buffer and
character count excluding NUL, also returned by ordinary WM_GETTEXTLENGTH.
New native viewport preparation proves exact live arena allocations for both
the 40-byte state and text buffer, capacity, mapped contiguous pages, terminal
NUL and canonical native layout. Allocation walks share a finite budget and
never flush allocator lists, allocate, call guest code or force painting.
Unexplained foreign free-list accounting, stale layouts and malformed spans
refuse. Password controls return before text reads. The host additionally
checks interior NUL, identity, generation and the entire document SHA-256.

Large controls now expose an explicit incomplete-document, complete-viewport
contract. It contains native scroll/selection state and canonical visible line
spans; it never labels a prefix as a complete caption. The complete-text limit
remains 65,536. Document validation is bounded at 1 MiB and visible text work at
65,536 bytes. The full window tree, host image and existing context fences
remain required; unsupported controls still refuse complete capture.

Two native faults were reproduced and repaired. The canonical wrapping table
stopped at 384 rows, making the rest unreachable to native caret/scroll APIs.
A reusable native spill allocation removes that semantic limit. Native paint,
hit testing and navigation share the original wrapping algorithm. An exact
byte copy and layout keys allow read-only public validation without remeasuring
the document under the capture deadline. A second fixture produced a complete
but blank image: an uninitialized template Edit client rectangle let final
nonclient scrollbar paint overwrite the text. Ordinary native WM_PAINT now
initializes that rectangle with the existing native calculation before painting.

The old retained module fails the 3,001-row fixture at exactly 384 rows. The
repaired native fixture reaches the final sentinel through EM_SETSEL and
EM_SCROLLCARET. Tests cover readonly multiline documents, selection,
SetWindowText and EM_REPLACESEL replacement, offscreen identity changes,
negative/oversized lengths, invalid capacities, interior/freed/unmapped spans,
missing NUL, password privacy and snapshot changes. Ordinary caret/drag flags
are included in the validated state range.

An authored normal dialog sets 453,207 bytes through ordinary SetWindowTextA
and verifies ordinary GetWindowTextLengthA. Its retained sealed capture shows
real native white client area, text and scrollbar, with both sibling buttons
present. Pixel checks require actual visible native ink; the earlier blank
capture is retained as a failing reproduction. No OCR, synthetic pixels,
agreement whitelist or unsupported-control exemption is used.

The adapter reconstructs the prior proved source graph, adopts only the named
Edit/observer/test delta, compiles and seals the module, and retains/hash-checks
it before execution. Exact Git, binary patches, source inventory, module hashes,
selected complete PNGs and actual process waits are recorded in the run.
No box or worker is created. Installation outcome and final published workflow
receipts are recorded in result.json after execution; this source note does not
claim agreement acceptance, installation, authentication or gameplay.
