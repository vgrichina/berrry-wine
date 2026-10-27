import run as c
p=c.R/'.git/info/sparse-checkout'
s=p.read_text();s+='/test/test-airstrike-caption-interior.py\n';p.write_text(s)
report=c.R/'docs/reviews/airstrike-caption-interior-geometry-repair-oct27'
(report/'.gitattributes').write_text('evidence/** whitespace=-blank-at-eol,-blank-at-eof\n')
c.dump('publication-setup-incident.json',dict(stage='Initial add partially staged paths then exit1 because new test was outside exact sparse definition; expanded only own test pattern.',check='Subsequent cached whitespace check rejected raw original stderr/diff trailing spaces; preserve raw diagnostics with report-local evidence whitespace attribute, source checks retained.',sequence='Dependent stat/check were run after initial partial-stage failure; no commit/push occurred. Require successful exact staging and check before commit.',evidence='Original stage.stderr/staged-check.stdout and supervised receipts retained. Synthetic PNG/text fixture streams require explicit force-add of own evidence only; no credentials.'))
print('Own new test included in sparse definition; raw evidence whitespace preserved by local attribute.')
