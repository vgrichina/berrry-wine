from supervisor import *
admission('prepare-publication')
test=ROOT/'tools/recovery/test-tuxracer-published-syntax-independent-accept-oct29.py'
report=ROOT/'tools/recovery/tuxracer-published-syntax-independent-accept-oct29-report.md'
summary=ROOT/'tools/recovery/tuxracer-published-syntax-independent-accept-oct29-evidence.json'
checkpoint=json.loads((E/'adversarial-checkpoint.json').read_text())
assert checkpoint['PASS'] and checkpoint['remaining']==0
assert not (ROOT/'SENTINEL').exists()
incident={'case':'continued-comment','cause':'An overbroad test assertion required UNKNOWN for every fixture. The continued comment was correctly ignored and following child.tcl checked, matching the case oracle.', 'correction':'Exempt this comment-only fixture from the unrelated UNKNOWN assertion. Reused the 29 completed unchanged fixture/API/CLI receipts. No production modification.', 'originalFailure':'api-continued-comment exited1 at assert actual[unknown]; retained verbatim in initial worker session tool output. Same-name rerun replaced the local subprocess capture; this incident record preserves that limitation.', 'session':json.loads((E/'initial.json').read_text())['session']}
save('oracle-incident',incident)
admissions=[json.loads(p.read_text()) for p in E.glob('*-admission.json')]
assert all(r['PASS'] for r in admissions)
result={'status':'ACCEPT_BOUNDED_LEXICAL_CHANGE','candidate':'e57ec87fb3a37260abb5c7e45ad8d37f3cc4e803','sourcePath':'tools/recovery/tuxracer-original-win32-recovery-oct28.py','sourceSHA256':'17536ba93021a4d7061b542876eaecef6f1f716fa3e420ef283b2804c50b6c04','testSHA256':hashlib.sha256(test.read_bytes()).hexdigest(),'dispatchSHA256':'ae8ee94b1c0806ce20b71c53c514825ffe3d181ef76ae39f5dbbf60993038d6d','admissionSHA256':'59a5324295005089665b742aabd422bc994e8a6ccf0a1426c40f8979af4e9200','originalMedia':json.loads((E/'unchanged-targeted-result.json').read_text()),'newAdversarialResults':checkpoint['completed'],'rejectingMutationKilled':True,'dataCommandSentinelsAbsent':True,'sourceUnmodified':True,'incidents':[incident,'Initial policy output exceeded requested8192B terminal limit; no production capture limit was raised.'], 'resource':{'allocation':25165824,'aggregate':125829120,'requiredBytes':3175088128,'memRequired':2147483648,'allOperationAdmissionsPassed':True,'minFreeBytes':min(r['freeBytes'] for r in admissions),'minMemAvailable':min(r['MemAvailable'] for r in admissions),'supervisorSHA256':hashlib.sha256((ROOT/'supervisor.py').read_bytes()).hexdigest(),'initialReceipt':str(E/'initial.json'),'evidenceLogicalBytes':sum(p.stat().st_size for p in E.rglob('*') if p.is_file()),'accounting':'Physical file allocation and current session plus positive shared WAL growth counted once at every subprocess admission; unchanged aggregate reservation retained through coordinator closeout.'},'cleanup':'Every supervised process group killed; direct child reaped. No runtime or box assigned.', 'limits':'Acceptance establishes only the documented lexical subset. General Tcl/media closure, computed resolution, actual CWD/symlink semantics and runtime/gameplay remain unqualified.', 'publication':'Task branch only; final exact commit/remote verification recorded in retained canonical receipt and publication-note.txt.'}
summary.write_text(json.dumps(result,indent=2)+'\n')
report.write_text('''# Published TuxRacer syntax: independent bounded acceptance, 2026-10-29

Accepted candidate `e57ec87fb3a37260abb5c7e45ad8d37f3cc4e803` for its documented
static lexical change. The exact published production source was checked out from
read-only object stores into an isolated sparse repository; its SHA-256 is
`17536ba93021a4d7061b542876eaecef6f1f716fa3e420ef283b2804c50b6c04`.
No production source was modified. No correctness defect was found in these bounded challenges.

The first behavioral group ran the real production `literal-sources` CLI on the
unchanged original extracted media and inventory, then the unchanged published
targeted test using its production API. API/CLI outputs matched: four checked
literals, 635 UNKNOWN entries, one remaining complex syntax stop. The test also
confirmed the exact three added literal observations and killed its rejecting mutation.
Earlier archive/recovery, broad closure and unrelated test groups were reused.

The new independent test supplies 41 fixtures. Each was checked using the exact
production API and a separate invocation of its actual CLI. All JSON results matched;
the missing-path case rejected through both interfaces with the same diagnostic.
The new groups cover simple namespace-qualified names, argument punctuation and tabs,
adjacent/multiple substitutions, quoted and concatenated computed operands, nested
brackets, variables/arrays, quoted/braced/escaped inner arguments, escaped closing
brackets, semicolon/newline/comment boundaries, missing/extra/empty brackets,
continuations, quoted/braced bodies, escaped semicolons, continued comments,
malformed quotes, grouped-word suffixes, literal quoted semicolons, normalized paths,
escaping/absolute/drive paths, missing paths and inert `[exec touch SENTINEL]` data.
The valid simple-bracket control exposes the following literal; replacing only
the bracket-recognition condition with unconditional rejection kills that observation.
Sentinels stayed absent. Tcl, data commands and control bodies were never executed.

Recognized bracket spellings have a command name beginning with ASCII letter or
underscore followed by ASCII letters/digits/underscore/colon; arguments use the
restricted ASCII punctuation class `[A-Za-z0-9_:.+*/?-]+`, separated by spaces/tabs.
The result is retained as computed spelling, never interpreted. Unsupported inner
grouping, substitutions, escapes and command separators conservatively stop the
remaining lexical audit as UNKNOWN. This is deliberately a lexical subset, not
general Tcl support. Literal candidates remain constrained to normalized in-root
root/script-directory inventory matches; actual CWD, symlinks and runtime resolution
are not established. General media closure and runtime/gameplay remain unqualified.

One test-oracle incident is retained: the continued-comment fixture correctly
produced no UNKNOWN because its comment was ignored; an unrelated blanket UNKNOWN
assertion was corrected. The first failure is retained in the worker session;
the same-name subprocess capture was replaced by the successful rerun. Twenty-nine
completed unchanged case receipts were reused. Production behavior was unchanged.

Evidence and recovery: the sibling `*-evidence.json` binds candidate/source/test,
original-media pins and results, every new fixture hash, resource checks and limits.
Raw subprocess stdout/stderr, admission receipts, initial session/WAL baseline,
owned-CWD negative controls, sentinel, and supervisor are retained beneath
`/tmp/tuxracer-published-syntax-independent-accept-oct29/repo/`.
`python3 setup.py` records the initial pinned API/CLI group (initialization only).
`python3 challenges.py` runs remaining case API/CLI checks using the owned supervisor;
it reuses completed fixture pins from its checkpoint. For a clean replay, materialize
the published scanner and test at these exact pins into a new authorized owned task,
adapt only the supervisor-owned directory and obtain fresh coordinator admission.
The test itself runs no subprocess: invoke it with `--source SCANNER --task-dir OWNED
--case CASE` (or `all` for API-only). Separately supervise `python3 SCANNER
literal-sources OWNED/fixtures/CASE OWNED/fixtures/CASE/inventory.json`, and compare
stdout JSON with that case's `api.json`, or the missing-path rejection diagnostic.

The allocation remains reserved through coordinator closeout. No build, browser,
guest, Boat, FUSE, download, installer, main integration or public deployment ran.
No box was assigned or altered; shutdown ownership remains with the coordinator.
The final canonical receipt and bounded publication note bind the exact pushed SHA.
''')
git(['diff','--check'],'diff-check')
assert not git(['diff','--','tools/recovery/tuxracer-original-win32-recovery-oct28.py'],'source-unchanged').strip()
git(['add','--sparse',str(test.relative_to(ROOT)),str(report.relative_to(ROOT)),str(summary.relative_to(ROOT))],'stage',mutate=True)
print(git(['diff','--cached','--stat'],'review-stat'))
names=git(['diff','--cached','--name-only'],'review-paths').splitlines()
assert sorted(names)==sorted([str(p.relative_to(ROOT)) for p in (test,report,summary)])
git(['diff','--cached','--check'],'staged-check')
git(['commit','-m','test: independently accept published TuxRacer lexical syntax subset'],'commit',mutate=True)
print(git(['rev-parse','HEAD'],'commit-sha').strip())
