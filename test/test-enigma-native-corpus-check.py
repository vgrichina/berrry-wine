#!/usr/bin/env python3
"""Challenge actual retained records in memory; never rewrite donor evidence."""
import sys
sys.dont_write_bytecode = True
import copy
import importlib.util
import json
from pathlib import Path

HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('corpus_oracle', HERE/'enigma-native-corpus-check.py')
oracle=importlib.util.module_from_spec(spec);spec.loader.exec_module(oracle)


def challenges(backend):
    """Every mutation has a retained-schema meaning; summaries remain true."""
    actions=[]
    def add(name, group, action):
        actions.append((backend+'/'+name, lambda corpus: action(corpus[backend,group])))
    add('missing-case','core',lambda j:j['cases'].pop())
    add('duplicate-case','core',lambda j:j['cases'].__setitem__(-1,copy.deepcopy(j['cases'][0])))
    def wrong_edge(j):
        c=j['cases'][0]
        for d in (c,c['off'],c['on']):d['edge']='NOT_CALL_OR_JMP'
    add('wrong-case-edge','core',wrong_edge)
    add('stale-module','core',lambda j:j.__setitem__('sha256','0'*64))
    add('wrong-backend','hardware',lambda j:j.__setitem__('backend','wine-assembly.other.wasm'))
    add('stale-candidate','unrelated',lambda j:j.__setitem__('candidate','0'*40))
    add('production-overclaim','core',lambda j:j.__setitem__('productionRunnerQualified',True))
    def case_action(name,group,index,f):add(name,group,lambda j:f(j['cases'][index]))
    case_action('missing-record','core',0,lambda c:c['on']['records'].clear())
    case_action('duplicate-record','core',0,lambda c:c['on']['records'].append(copy.deepcopy(c['on']['records'][0])))
    case_action('wrong-record-owner','core',0,lambda c:c['on']['records'][0].__setitem__('invocation',99))
    case_action('wrong-record-api','core',0,lambda c:c['on']['records'][0].__setitem__('api','PeekMessageW'))
    case_action('wrong-record-thread','core',0,lambda c:c['on']['records'][0].__setitem__('thread',2))
    case_action('wrong-record-frame','core',0,lambda c:c['on']['records'][0].__setitem__('entryESP',0))
    case_action('wrong-record-msg','core',0,lambda c:c['on']['records'][0]['msg'].__setitem__('message',0xBAD))
    case_action('wrong-record-result','core',0,lambda c:c['on']['records'][0].__setitem__('result',0))
    case_action('wrong-record-sequence','core',0,lambda c:c['on']['records'][0].__setitem__('sequence',1))
    case_action('missing-complete-import','core',0,lambda c:c['on']['calls'].pop())
    case_action('duplicate-complete-import','core',0,lambda c:c['on']['calls'].append(copy.deepcopy(c['on']['calls'][-1])))
    case_action('misordered-complete-import','core',0,lambda c:c['on']['calls'].reverse())
    case_action('wrong-complete-token','core',0,lambda c:c['on']['calls'][-1].__setitem__(1,99))
    case_action('off-diagnostic-import','core',0,lambda c:c['off']['calls'].append(copy.deepcopy(c['on']['calls'][0])))
    case_action('off-diagnostic-record','core',0,lambda c:c['off']['records'].append(copy.deepcopy(c['on']['records'][0])))
    for field in ('eax','esp','eip','yieldReason','queue'):
        case_action('off-on-'+field,'core',0,lambda c,k=field:c['off']['state'].__setitem__(k,c['off']['state'][k]+1))
    case_action('off-on-MSG','core',0,lambda c:c['off']['state']['msg'].__setitem__(1,999))
    case_action('off-on-first','core',0,lambda c:c['off']['first']['after'].__setitem__('eax',99))
    case_action('off-on-parked','core',1,lambda c:c['off']['bound'].__setitem__('yieldReason',0))
    case_action('stale-retry-arguments','core',1,lambda c:c['on']['calls'][2].__setitem__(4,oracle.MSG+64))
    case_action('missing-park-import','core',1,lambda c:c['on']['calls'].pop(1))
    case_action('nested-record-order','hooks-thread',1,lambda c:c['on']['records'].reverse())
    case_action('nested-token-alias','hooks-thread',1,lambda c:c['on']['calls'][3].__setitem__(1,1))
    case_action('wrong-resume-context','hooks-thread',0,lambda c:c['on']['calls'][2].__setitem__(2,0))
    case_action('off-on-suspended','hooks-thread',0,lambda c:c['off']['suspended'].__setitem__('eax',99))
    case_action('missing-bound-ignored-attempt','hardware',1,lambda c:c['on']['calls'].pop(4))
    case_action('chain-resume-before-bind','hardware',1,lambda c:c['on']['calls'].__setitem__(slice(3,6),list(reversed(c['on']['calls'][3:6]))))
    case_action('unrelated-early-record','unrelated',0,lambda c:c['on']['records'].insert(0,copy.deepcopy(c['on']['records'][0])))
    case_action('unrelated-frame-state','unrelated',0,lambda c:c['off']['unrelatedState'].__setitem__('esp',0))
    case_action('unrelated-suspended-state','unrelated',0,lambda c:c['off']['suspended'].__setitem__('eip',0))
    add('missing-omission-control','core',lambda j:j.pop('omissionControl'))
    add('fabricated-omission-observation','core',lambda j:j['omissionControl']['actual']['records'].append(copy.deepcopy(j['cases'][0]['on']['records'][0])))
    return actions


def rejected(checker, corpus):
    try:checker.check(corpus)
    except (oracle.Rejected,ValueError,KeyError,TypeError) as e:return str(e)[:650]
    return None


def main():
    corpus=oracle.load_corpus(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
    baseline=oracle.check(corpus);results=[]
    def save(name,value):
        p=out/name;t=p.with_suffix('.new');t.write_text(json.dumps(value,indent=2)+'\n');t.replace(p)
    for backend in (() if '--mutants-only' in sys.argv else oracle.MODULES):
        for name, mutate in challenges(backend):
            changed=copy.deepcopy(corpus);mutate(changed)
            reason=rejected(oracle,changed)
            if reason is None:raise AssertionError('surviving adversarial control '+name)
            results.append(dict(control=name,rejected=True,reason=reason))
        save('controls-'+backend+'.json',results[-len(challenges(backend)):])
        save('checker-checkpoint.json',dict(candidate=oracle.CANDIDATE,modules=oracle.MODULES,
             completed=['positive-corpus',backend+'-controls'],controls=len(results),baseline=baseline,
             remaining=['oracle-guard mutants','production-helper offline replay','static executed-version audit'],nativeExecuted=False))
    if '--mutants-only' in sys.argv:
        for backend in oracle.MODULES:results.extend(json.loads((out/('controls-'+backend+'.json')).read_text()))
        # Recheck the corrected coordinated identity challenge; other passed
        # controls reuse their unchanged receipts.
        for backend in oracle.MODULES:
            for name,mutate in challenges(backend):
                if name.endswith('/wrong-case-edge'):
                    changed=copy.deepcopy(corpus);mutate(changed)
                    reason=rejected(oracle,changed)
                    assert reason is not None
                    results=[dict(control=name,rejected=True,reason=reason) if x['control']==name else x for x in results]
    # A lying pass flag must neither admit malformed data nor reject valid raw
    # state. This verifies the checker does not consume donor success summaries.
    flags=copy.deepcopy(corpus)
    for j in flags.values():
        j['pass']=False
        for c in j['cases']:c['pass']=False
        if 'omissionControl' in j:j['omissionControl']['pass']=False;j['omissionControl']['rejectedMissingCompletion']=False
    assert oracle.check(flags)==baseline
    # Mutation-test independent checker guards using the same real controls.
    source=(HERE/'enigma-native-corpus-check.py').read_text()
    mutants={
      'omit-exact-case-set':("equal(set(identities), set(expected), 'exact expected case set')",'pass'),
      'omit-first-state-comparison':("equal(on['first'], off['first'], 'OFF/ON first')",'pass'),
      'omit-import-schedule':("equal(on['calls'], calls, 'exact invocation import schedule')",'pass'),
      'omit-completion-record':("equal(record, expected, 'completion record '+str(i))",'pass'),
    }
    killed=[]
    for name,(old,new) in mutants.items():
        assert source.count(old)==1
        import types
        m=types.ModuleType('mutated_oracle');exec(compile(source.replace(old,new),name,'exec'),m.__dict__)
        # The mutant must accept the real corpus. A syntax/error mutant is no test.
        assert m.check(corpus)==baseline
        # A control admitted by the mutant demonstrates that this guard matters
        # and that our suite would fail when that guard was removed.
        admitted=[]
        for control,mutate in challenges('tail'):
            changed=copy.deepcopy(corpus);mutate(changed)
            try:m.check(changed)
            except (ValueError,KeyError,TypeError):continue
            admitted.append(control)
        assert admitted,'redundant/unjustified checker mutant '+name
        killed.append(dict(mutant=name,killedBy=admitted))
    save('checker-mutants.json',killed)
    result=dict(baseline=baseline,adversarialControls=len(results),rejected=len(results),
                checkerGuardMutantsKilled=len(killed),summaryFlagsIgnored=True,donorFilesEdited=False,
                nativeExecuted=False)
    save('checker-result.json',result);print(json.dumps(result))


if __name__=='__main__':main()
