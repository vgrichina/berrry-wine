#!/usr/bin/env python3
"""Run the unchanged repaired predecessor gate once against current dispatch pins."""
import hashlib, importlib.util, json, pathlib
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
DISPATCH=pathlib.Path("/home/user/wine-assembly/scratch/usage-watch/toyvm-readdir-repair-independent-accept-oct29-dispatch.json")
def main():
    d=json.loads(DISPATCH.read_text())
    for name,pin in d["sourcePins"].items():
        b=(ROOT/name).read_bytes()
        assert {"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest()}==pin
    spec=importlib.util.spec_from_file_location("predecessor_accept",HERE/"accept.py")
    a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
    c=a.load_contract()
    assert c.PINS==d["sourcePins"]
    c.load()
    observations=[]
    original=c.classify
    def observe(actual,wanted):
        status=original(actual,wanted)
        observations.append(dict(case=len(observations)+1,actual=actual,expected=wanted,status=status))
        return status
    c.classify=observe
    result=a.unchanged_cases(c)
    c.classify=original
    assert len(observations)==870
    controls=a.unchanged_oracle_controls(c)
    (HERE/"original-observations.json").write_text(json.dumps(observations,separators=(",",":"))+"\n")
    summary=dict(status="PASS",candidate=d["candidate"],originalContract=result,originalOracleControls=controls,sourcePins=d["sourcePins"])
    (HERE/"gate-results.json").write_text(json.dumps(summary,indent=2)+"\n")
    print(json.dumps({k:v for k,v in summary.items() if k!="sourcePins"}))
if __name__=="__main__":main()
