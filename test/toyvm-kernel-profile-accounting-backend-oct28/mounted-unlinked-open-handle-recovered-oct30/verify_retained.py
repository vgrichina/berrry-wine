"""Accept retained mounted bytes; corruption controls never execute a guest."""
import copy,hashlib,importlib.util,json,lzma,pathlib,struct,tempfile,traceback
from unittest.mock import patch
HERE=pathlib.Path(__file__).resolve().parent

def verify(temp_root):
    packed=(HERE/'raw-runtime.json.xz').read_bytes()
    raw=lzma.decompress(packed);expected=json.loads((HERE/'raw-runtime-recovery.json').read_text())
    assert len(raw)==expected['bytes'] and hashlib.sha256(raw).hexdigest()==expected['sha256']
    d=json.loads(raw)
    spec=importlib.util.spec_from_file_location('retained_decoder',HERE/'accept.py')
    decoder=importlib.util.module_from_spec(spec);spec.loader.exec_module(decoder)
    source=(HERE/'accept.py').read_text().splitlines()
    with tempfile.TemporaryDirectory(prefix='retained-',dir=temp_root) as name:
        tiny=pathlib.Path(name);(tiny/'raw-runtime.json.xz').write_bytes(packed);decoder.E=tiny
        result=decoder.accept()
        retained=json.loads((HERE/'mounted-result.json').read_text())
        lifecycle=retained.pop('lifecycle')
        assert lifecycle==json.loads((HERE/'lifecycle-proof.json').read_text())
        assert result==retained
        u=result['unlinkedInode'];ordinary=result['ordinaryInode'];rows=d['rawWire']
        assert len({w['unique'] for w in rows})==len(rows)
        ix=next(i for i,w in enumerate(rows) if w['unique']==result['unlinkUnique'])
        ri=next(i for i,w in enumerate(rows) if w['unique']==result['releaseUnique'])
        wi=next(i for i,w in enumerate(rows) if w['unique']==result['postUnlinkWriteUnique'])
        ei=next(i for i,w in enumerate(rows) if w['unique']==result['extensionUnique'])
        assert ix<wi<ri<ei
        assert rows[ix]['nodes'][str(u)]==dict(links=0,opens=1,bytes=128)
        assert result['retainedLive']-result['releasedLive']==8192
        assert result['withoutReleaseExtension']>result['liveLimit']>=result['extendedLive']
        payload=bytes(range(128));patched=payload[:51]+b'LIVE-FD'+payload[58:]
        reads=[(i,bytes.fromhex(w['responseHex'])[16:]) for i,w in enumerate(rows) if ix<i<ri and w['inode']==u and w['opcode']==15]
        assert any(i<wi and b==payload for i,b in reads)
        assert any(i>wi and b==patched for i,b in reads)
        assert result['final']==dict(live=4096,peak=20480,written=4232,inodes=1,openHandles=0)
        controls=[]
        def reject(label,mutate,reason):
            bad=copy.deepcopy(d);mutate(bad)
            with patch.object(decoder.lzma,'decompress',return_value=json.dumps(bad).encode()):
                try:decoder.accept()
                except (AssertionError,StopIteration) as e:
                    frame=traceback.extract_tb(e.__traceback__)[-1]
                    line=source[frame.lineno-1].strip()
                    assert reason in line,(label,line)
                    controls.append(dict(control=label,rejected=True,assertion=line))
                else:raise AssertionError('corruption accepted: '+label)
        def wrong_fd(bad):
            w=next(w for w in bad['rawWire'] if w['unique']==result['postUnlinkReadUnique'][0]);b=bytearray.fromhex(w['requestHex']);struct.pack_into('<Q',b,40,999);w['requestHex']=b.hex()
        reject('wrong retained READ handle',wrong_fd,"struct.unpack_from('<Q'")
        reject('RELEASE fails to reclaim live charge',lambda bad:bad['rawWire'][ri]['after'].__setitem__('live',20480),"after']['live']==12288")
        def wrong_order(bad):
            row=bad['rawWire'].pop(ei);bad['rawWire'].insert(ri,row)
        reject('extension before actual RELEASE',wrong_order,"assert all(t[0]['after']['live']==20480")
        def wrong_bytes(bad):
            for w in bad['rawWire']:
                if w['inode']==u and w['opcode']==15 and w['unique'] in result['postUnlinkReadUnique']:
                    b=bytearray.fromhex(w['responseHex']);b[16]^=1;w['responseHex']=b.hex()
        reject('corrupted retained read response bytes',wrong_bytes,'assert any(t[2]==payload')
    return dict(accepted=True,artifactCount=17,decodedBytes=len(raw),rawSHA256=expected['sha256'],positive=result,negativeControls=controls,runtimeReplay=False,coverage='Retained real mounted FUSE wire/accounting only; no additional backend qualification.')

if __name__=='__main__':
    import sys
    result=verify(sys.argv[1]);print(json.dumps(result))
