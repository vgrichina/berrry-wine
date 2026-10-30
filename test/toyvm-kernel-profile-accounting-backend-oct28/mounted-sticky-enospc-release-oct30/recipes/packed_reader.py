"""Read-only, bounded Git v2 pack-index lookup and Git pack delta decoding."""
import struct, zlib, hashlib
LIMIT=524288
class PackedReader:
    def __init__(self,stores,load):
        self.load=load;self.indexes=[];seen=set()
        for store in stores:
            for p in (store/'pack').glob('*.idx'):
                real=p.resolve()
                if real in seen:continue
                seen.add(real)
                with p.open('rb') as f:
                    if f.read(8)!=b'\xfftOc\x00\x00\x00\x02':continue
                    f.seek(1028);n=struct.unpack('>I',f.read(4))[0]
                    self.indexes.append((p,n))
    def lookup(self,oid):
        target=bytes.fromhex(oid)
        for idx,n in self.indexes:
            with idx.open('rb') as f:
                lo=0;hi=n
                while lo<hi:
                    mid=(lo+hi)//2;f.seek(1032+20*mid);value=f.read(20)
                    if value<target:lo=mid+1
                    else:hi=mid
                if lo==n:continue
                f.seek(1032+20*lo)
                if f.read(20)!=target:continue
                f.seek(1032+24*n+4*lo);offset=struct.unpack('>I',f.read(4))[0]
                if offset&0x80000000:
                    f.seek(1032+28*n+8*(offset&0x7fffffff));offset=struct.unpack('>Q',f.read(8))[0]
            kind,body=self.at(idx.with_suffix('.pack'),offset,0)
            raw=kind.encode()+b' '+str(len(body)).encode()+b'\0'+body
            assert hashlib.sha1(raw).hexdigest()==oid
            return raw
        raise RuntimeError('object absent from loose stores and v2 pack indexes '+oid)
    def at(self,path,offset,depth):
        assert depth<50
        with path.open('rb') as f:
            f.seek(offset);c=f.read(1)[0];typ=(c>>4)&7;size=c&15;shift=4
            while c&128:
                c=f.read(1)[0];size|=(c&127)<<shift;shift+=7;assert shift<64
            assert size<=LIMIT
            base=None
            if typ==6:
                c=f.read(1)[0];distance=c&127
                while c&128:c=f.read(1)[0];distance=((distance+1)<<7)+(c&127)
                base=(path,offset-distance)
            elif typ==7:base=f.read(20).hex()
            dec=zlib.decompressobj();pieces=[];total=0
            while not dec.eof:
                chunk=f.read(4096);assert chunk
                b=dec.decompress(chunk,LIMIT-total+1);total+=len(b);assert total<=LIMIT;pieces.append(b)
            body=b''.join(pieces);assert len(body)==size
        if typ in (1,2,3,4):return {1:'commit',2:'tree',3:'blob',4:'tag'}[typ],body
        assert typ in (6,7)
        if typ==6:kind,original=self.at(*base,depth+1)
        else:kind,original=self.load(base)
        pos=0
        def varint():
            nonlocal pos
            result=0;shift=0
            while True:
                c=body[pos];pos+=1;result|=(c&127)<<shift;shift+=7
                if not c&128:return result
                assert shift<64
        assert varint()==len(original);expected=varint();assert expected<=LIMIT
        output=bytearray()
        while pos<len(body):
            op=body[pos];pos+=1
            if op&128:
                start=length=0
                for j in range(4):
                    if op&(1<<j):start|=body[pos]<<(8*j);pos+=1
                for j in range(3):
                    if op&(1<<(4+j)):length|=body[pos]<<(8*j);pos+=1
                length=length or 65536;assert start+length<=len(original);output.extend(original[start:start+length])
            else:
                assert op;output.extend(body[pos:pos+op]);pos+=op
            assert len(output)<=expected
        assert len(output)==expected
        return kind,bytes(output)
