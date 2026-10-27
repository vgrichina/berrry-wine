import pathlib,hashlib,json,tarfile,os
H=pathlib.Path(__file__).parent
D=pathlib.Path('/tmp/airstrike-focus-menu-controller-repair-oct27/repo/docs/re-notes/airstrike-focus-menu-controller-20261027')
pin=json.loads((D/'source-pin.json').read_text()); archive=pathlib.Path(pin['archive'])
assert hashlib.sha256(archive.read_bytes()).hexdigest()==pin['sha256']
with tarfile.open(archive,'r:gz') as t:
    member=t.getmember(pin['member']); assert member.isfile() and member.size<1024*1024
    b=t.extractfile(member).read()
assert hashlib.sha256(b).hexdigest()==pin['memberSha256']
lines=b.decode().splitlines(); excerpt=(D/'airstrike.c.excerpt').read_text();count=0;exact=[];normalized=[];numbers=[]
for line in excerpt.splitlines():
    n,text=line.split(': ',1)
    original=lines[int(n)-1]
    assert original.rstrip()==text,(n,text,original)
    if original!=text:normalized.append(int(n))
    exact.append(f'{n}: {original}\n');numbers.append(int(n));count+=1
assert 'choice = 0;' in lines[301]
assert 'case SDLK_DOWN:' in lines[330] and 'choice++;' in lines[331]
assert 'case 6:' in lines[490] and 'exit(EXIT_SUCCESS);' in lines[491]
exactBytes=''.join(exact).encode();(H/'game-source-exact.excerpt').write_bytes(exactBytes)
receipt=dict(status='PASS',archive=pin,archiveStandingBytes=archive.stat().st_size,sourceBytes=len(b),excerptLines=count,excerptSha256=hashlib.sha256(excerpt.encode()).hexdigest(),publishedNormalization='rstrip trailing whitespace per source line',normalizedLines=normalized,exactExcerptRecipe={'lineNumbers':numbers,'format':'decimal line number + colon space + original source line + LF','sha256':hashlib.sha256(exactBytes).hexdigest(),'bytes':len(exactBytes)},sourceSemantics='Escape toggles pause; wait_for_key SDL_KEYDOWN; seven-item menu starts row0; Down increments; row6 selects exit(EXIT_SUCCESS). Parent must supply genuine focus/menu/terminal receipts.',trustBoundary='Factual trusted parent; no OCR, hostile-observer protection or runtime proof.',runtime=False)
(H/'source-contract.json').write_text(json.dumps(receipt,indent=2)+'\n')
p=json.loads((H/'checkpoint.json').read_text());p.update(sourceContract='PASS',remaining=['report review','task branch publication'],status='OFFLINE_ACCEPTANCE_PASS')
tmp=H/'checkpoint.tmp';tmp.write_text(json.dumps(p,indent=2)+'\n');os.replace(tmp,H/'checkpoint.json')
print('PASS independently rehashed archive/member and all published source excerpt lines:',count)
