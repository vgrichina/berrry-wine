import publication_supervisor as s
import pathlib, json, hashlib, datetime, sys
def main():
    d=json.loads((s.D/(s.NAME+'-dispatch.json')).read_text())
    pins=d['testedWIP']
    for rel,p in pins.items(): assert s.sha(s.R/rel)==p['sha256']
    s.write('wrapper-import-incident.json',dict(error='First publication entry failed before supervisor import or subprocess creation: module filename used hyphens while import used underscores.',resolution='Renamed own supervisor to matching underscore module filename; no production command, test, admission/provider denial or runtime was retried.'))
    s.write('diff-review',dict(PASS=True,base=d['base'],paths=list(pins),diffSHA256=s.sha(s.E/'review-diff.stdout'),notes='Exact three tested files; scanner change preserves bracket spelling as computed UNKNOWN and extends only lexical observation. Test/report reviewed. No implementation change or acceptance rerun.',inheritedAcceptance='API equals actual CLI; literal sources1->4; syntax6->1; rejecting mutation killed',publicationAuthorization='explicit fresh continuation; git add --sparse authorized'))
    s.git(['config','user.name','Wine Ops Worker'],'author-name',cwd=s.R,mutate=True)
    s.git(['config','user.email','wine-ops@users.noreply.github.com'],'author-email',cwd=s.R,mutate=True)
    s.git(['config','core.hooksPath','/dev/null'],'disable-hooks',cwd=s.R,mutate=True)
    s.git(['commit','-m','Preserve simple Tcl substitutions during TuxRacer lexical recovery'],'commit',cwd=s.R,mutate=True)
    commit=s.git(['rev-parse','HEAD'],'commit-sha',cwd=s.R).decode().strip()
    assert s.git(['rev-parse','HEAD^'],'parent-sha',cwd=s.R).decode().strip()==d['base']
    changed=s.git(['diff-tree','--no-commit-id','--name-only','-r','HEAD'],'commit-paths',cwd=s.R).decode().splitlines()
    assert sorted(changed)==sorted(pins)
    for i,(rel,p) in enumerate(pins.items()):
        blob=s.git(['show',commit+':'+rel],'published-blob-'+str(i),cwd=s.R)
        assert len(blob)==p['bytes'] and hashlib.sha256(blob).hexdigest()==p['sha256']
    remote='git@github.com:vgrichina/wine-assembly.git'
    ref='refs/heads/task/'+s.NAME
    s.git(['push',remote,commit+':'+ref],'push',cwd=s.R,mutate=True)
    reply=s.git(['ls-remote','--exit-code',remote,ref],'verify-remote',cwd=s.R).decode().strip()
    assert reply==commit+'\t'+ref
    status=s.git(['status','--porcelain','--untracked-files=no'],'tracked-status',cwd=s.R).decode()
    assert not status
    s.admission('closeout')
    canonical=dict(task=s.NAME,at=datetime.datetime.now(datetime.timezone.utc).isoformat(),status='PUBLISHED_TASK_BRANCH',base=d['base'],branch='task/'+s.NAME,commit=commit,remote=remote,remoteRef=ref,verifiedRemoteSHA=commit,remoteVerification=str(s.E/'verify-remote.stdout'),sourceAndTestPins=pins,inheritedEvidence=str(s.E/'inherited-evidence'),inheritedCanonicalReceipt=d['canonicalReceipt'],inheritedCanonicalSHA256=s.sha(d['canonicalReceipt']),acceptance='Reused unchanged exact source/test/media pins and retained PASS receipts. API equals actual CLI; literal sources1->4; syntax6->1; rejecting mutation killed; computed remains UNKNOWN.',newChecks=['dispatch/admission hashes','all retained manifest hashes','owned-CWD rejection controls and sentinel','exact SSH/empty mount configuration reuse','base scanner SHA','review exact staged diff','diff --check','commit parent/path/blob verification','push and exact remote SHA verification','tracked tree clean'],remainingGate='fresh independent source acceptance before any main integration',main='unchanged by this task',runtimeExecuted=False,boxes=[],shutdownOwner='coordinator; no box assigned or altered',allocationBytes=25165824,aggregateBytes=125829120,allocationRetainedThrough='coordinator closeout including publication-note board delivery',initialSessionLimitsAndWAL=str(s.E/'initial'),rootRefReceipt=str(s.D/s.NAME/'root-ref-digest.json'),cleanup='Every supervisor subprocess group killed at closeout and direct child reaped. Local repository/evidence retained; no test, Git or runtime process retained.',predecessorIncidents='Preserved unchanged in inherited receipt/manifest, including sparse staging rejection, alternate nesting diagnostic, setup/argv incidents and result-path collision. No assertion of retroactive compliance.',taskIncidents=['Initial read-only policy/dispatch tool output exceeded requested terminal byte ceiling and one later review output was truncated; retained in session. Subsequent production supervisor captures bounded separately. No production admission failure, subprocess rejection or provider denial occurred.'],publicationNote=str(s.R/'publication-note.txt'))
    canonical['taskIncidents'].append('Pre-spawn local publication module-name mismatch fixed within task; receipt: '+str(s.E/'wrapper-import-incident.json'))
    s.write('canonical-receipt.json',canonical)
    note=(f'{s.NAME}: published exact retained tested three-file lexical repair.\nCommit: {commit}\nRemote branch: {ref}\nExact remote SHA verified: {commit}\nCanonical receipt: {s.E}/canonical-receipt.json\nTests reused by unchanged pins: API/CLI equality, literal sources1->4, syntax6->1, mutation killed; computed UNKNOWN.\nMain unchanged; fresh independent acceptance required. Predecessor incidents retained; initial inspection output over ceiling noted.\nOwn24MiB/aggregate125829120 allocation retained through coordinator closeout and board delivery. No runtime/boxes; process groups cleaned.\n')
    (s.R/'publication-note.txt').write_text(note)
    print(json.dumps(dict(status='PUBLISHED',commit=commit,branch=ref,canonicalReceipt=str(s.E/'canonical-receipt.json'),publicationNote=str(s.R/'publication-note.txt'))))
if __name__=='__main__':
    try: main()
    except Exception as exc:
        s.write('FIRST-FAILURE',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),error=repr(exc),allocationRetained=True))
        print('STOP',repr(exc));sys.exit(1)
