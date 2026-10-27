from common import *
E=H.parent/'repo/docs/reviews/penguin-published-projectile-gameplay-oct27'
r=json.loads((E/'receipt.json').read_text());r['incidents'].append('Closeout committed-file inventory found nested operations/manifest.json excluded by overly broad manifest filename filter. Original payload/source file intact in commit4191395; corrected root-only manifest exclusion, no runtime/capture repetition. First failed finish receipt and corrected package source retained.')
(E/'receipt.json').write_text(json.dumps(r,indent=2)+'\n')
for n in ('finish-op.json','finish-op.stdout','finish-op.stderr','package-blocker.py','fix-manifest-coverage.py'):shutil.copyfile(H/n,E/'operations'/n)
manifest={str(p.relative_to(E)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in E.rglob('*') if p.is_file() and p!=E/'manifest.json'}
(E/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(dict(files=len(manifest),rootOnlyExclusion=True,nestedRuntimeManifestCovered='operations/manifest.json' in manifest)))
