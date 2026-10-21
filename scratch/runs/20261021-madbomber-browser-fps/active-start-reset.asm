  403f9b:	83 7d c4 01          	cmp    DWORD PTR [ebp-0x3c],0x1
  403f9f:	0f 85 1b 01 00 00    	jne    0x4040c0
  403fa5:	83 3d d0 fd 40 00 00 	cmp    DWORD PTR ds:0x40fdd0,0x0
  403fac:	75 0e                	jne    0x403fbc
  403fae:	83 3d d4 fd 40 00 00 	cmp    DWORD PTR ds:0x40fdd4,0x0
  403fb5:	75 05                	jne    0x403fbc
  403fb7:	e9 04 01 00 00       	jmp    0x4040c0
  403fbc:	83 3d 40 1a 41 00 00 	cmp    DWORD PTR ds:0x411a40,0x0
  403fc3:	0f 85 f7 00 00 00    	jne    0x4040c0
  403fc9:	83 3d 70 fd 40 00 01 	cmp    DWORD PTR ds:0x40fd70,0x1
  403fd0:	0f 85 ea 00 00 00    	jne    0x4040c0
  403fd6:	a1 30 f4 40 00       	mov    eax,ds:0x40f430
  403fdb:	8b 04 85 60 f2 40 00 	mov    eax,DWORD PTR [eax*4+0x40f260]
  403fe2:	8b 04 85 2c de 40 00 	mov    eax,DWORD PTR [eax*4+0x40de2c]
  403fe9:	a3 50 f4 40 00       	mov    ds:0x40f450,eax
  403fee:	c7 05 c0 fd 40 00 00 	mov    DWORD PTR ds:0x40fdc0,0x0
  403ff5:	00 00 00 
  403ff8:	a1 30 f4 40 00       	mov    eax,ds:0x40f430
  403ffd:	83 3c 85 a0 fd 40 00 	cmp    DWORD PTR [eax*4+0x40fda0],0x0
  404004:	00 
  404005:	74 18                	je     0x40401f
  404007:	8b 15 50 f4 40 00    	mov    edx,DWORD PTR ds:0x40f450
  40400d:	89 d0                	mov    eax,edx
  40400f:	c1 f8 1f             	sar    eax,0x1f
  404012:	c1 e8 1f             	shr    eax,0x1f
  404015:	8d 04 10             	lea    eax,[eax+edx*1]
  404018:	d1 f8                	sar    eax,1
  40401a:	a3 50 f4 40 00       	mov    ds:0x40f450,eax
  40401f:	a1 30 f4 40 00       	mov    eax,ds:0x40f430
  404024:	c7 04 85 a0 fd 40 00 	mov    DWORD PTR [eax*4+0x40fda0],0x0
  40402b:	00 00 00 00 
  40402f:	c7 05 40 1a 41 00 01 	mov    DWORD PTR ds:0x411a40,0x1
  404036:	00 00 00 
  404039:	c7 05 40 fd 40 00 00 	mov    DWORD PTR ds:0x40fd40,0x0
  404040:	00 00 00 
  404043:	c7 05 60 1a 41 00 00 	mov    DWORD PTR ds:0x411a60,0x0
  40404a:	00 00 00 
  40404d:	8b 15 38 fc 40 00    	mov    edx,DWORD PTR ds:0x40fc38
  404053:	b8 80 02 00 00       	mov    eax,0x280
  404058:	2b 42 08             	sub    eax,DWORD PTR [edx+0x8]
  40405b:	89 c2                	mov    edx,eax
  40405d:	89 d0                	mov    eax,edx
  40405f:	c1 f8 1f             	sar    eax,0x1f
  404062:	c1 e8 1f             	shr    eax,0x1f
  404065:	8d 04 10             	lea    eax,[eax+edx*1]
  404068:	d1 f8                	sar    eax,1
  40406a:	66 89 45 b0          	mov    WORD PTR [ebp-0x50],ax
  40406e:	a1 38 fc 40 00       	mov    eax,ds:0x40fc38
  404073:	0f b7 50 0c          	movzx  edx,WORD PTR [eax+0xc]
  404077:	b8 e0 01 00 00       	mov    eax,0x1e0
  40407c:	29 d0                	sub    eax,edx
  40407e:	66 89 45 b2          	mov    WORD PTR [ebp-0x4e],ax
  404082:	a1 38 fc 40 00       	mov    eax,ds:0x40fc38
  404087:	0f b7 40 08          	movzx  eax,WORD PTR [eax+0x8]
  40408b:	66 89 45 b4          	mov    WORD PTR [ebp-0x4c],ax
  40408f:	a1 38 fc 40 00       	mov    eax,ds:0x40fc38
  404094:	0f b7 40 0c          	movzx  eax,WORD PTR [eax+0xc]
  404098:	66 89 45 b6          	mov    WORD PTR [ebp-0x4a],ax
  40409c:	8b 45 b0             	mov    eax,DWORD PTR [ebp-0x50]
  40409f:	8b 55 b4             	mov    edx,DWORD PTR [ebp-0x4c]
  4040a2:	89 04 24             	mov    DWORD PTR [esp],eax
  4040a5:	89 54 24 04          	mov    DWORD PTR [esp+0x4],edx
  4040a9:	e8 90 46 00 00       	call   0x40873e
  4040ae:	8b 45 b0             	mov    eax,DWORD PTR [ebp-0x50]
  4040b1:	8b 55 b4             	mov    edx,DWORD PTR [ebp-0x4c]
  4040b4:	89 04 24             	mov    DWORD PTR [esp],eax
  4040b7:	89 54 24 04          	mov    DWORD PTR [esp+0x4],edx
  4040bb:	e8 ba 2b 00 00       	call   0x406c7a
  4040c0:	83 3d 90 32 41 00 01 	cmp    DWORD PTR ds:0x413290,0x1
