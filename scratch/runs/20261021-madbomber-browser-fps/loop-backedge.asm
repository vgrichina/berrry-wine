  405788:	e8 f3 51 00 00       	call   0x40a980
  40578d:	89 c2                	mov    edx,eax
  40578f:	8b 45 ac             	mov    eax,DWORD PTR [ebp-0x54]
  405792:	83 c0 21             	add    eax,0x21
  405795:	39 c2                	cmp    edx,eax
  405797:	73 17                	jae    0x4057b0
  405799:	e8 e2 51 00 00       	call   0x40a980
  40579e:	89 c2                	mov    edx,eax
  4057a0:	8b 45 ac             	mov    eax,DWORD PTR [ebp-0x54]
  4057a3:	29 d0                	sub    eax,edx
  4057a5:	83 c0 2d             	add    eax,0x2d
  4057a8:	89 04 24             	mov    DWORD PTR [esp],eax
  4057ab:	e8 00 52 00 00       	call   0x40a9b0
  4057b0:	83 7d d0 00          	cmp    DWORD PTR [ebp-0x30],0x0
  4057b4:	75 0b                	jne    0x4057c1
  4057b6:	83 7d cc 00          	cmp    DWORD PTR [ebp-0x34],0x0
  4057ba:	75 05                	jne    0x4057c1
  4057bc:	e9 40 e5 ff ff       	jmp    0x403d01
  4057c1:	83 3d b0 fd 40 00 01 	cmp    DWORD PTR ds:0x40fdb0,0x1
