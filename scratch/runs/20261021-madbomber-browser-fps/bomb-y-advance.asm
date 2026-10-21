  404687:	c7 45 c8 00 00 00 00 	mov    DWORD PTR [ebp-0x38],0x0
  40468e:	83 7d c8 7f          	cmp    DWORD PTR [ebp-0x38],0x7f
  404692:	7e 05                	jle    0x404699
  404694:	e9 23 03 00 00       	jmp    0x4049bc
  404699:	8b 45 c8             	mov    eax,DWORD PTR [ebp-0x38]
  40469c:	89 c2                	mov    edx,eax
  40469e:	01 d2                	add    edx,edx
  4046a0:	01 c2                	add    edx,eax
  4046a2:	8d 04 95 00 00 00 00 	lea    eax,[edx*4+0x0]
  4046a9:	83 b8 b0 f4 40 00 00 	cmp    DWORD PTR [eax+0x40f4b0],0x0
  4046b0:	0f 84 fc 02 00 00    	je     0x4049b2
  4046b6:	8b 55 c8             	mov    edx,DWORD PTR [ebp-0x38]
  4046b9:	89 d0                	mov    eax,edx
  4046bb:	01 c0                	add    eax,eax
  4046bd:	01 d0                	add    eax,edx
  4046bf:	8d 0c 85 00 00 00 00 	lea    ecx,[eax*4+0x0]
  4046c6:	8b 55 c8             	mov    edx,DWORD PTR [ebp-0x38]
  4046c9:	89 d0                	mov    eax,edx
  4046cb:	01 c0                	add    eax,eax
  4046cd:	01 d0                	add    eax,edx
  4046cf:	8d 14 85 00 00 00 00 	lea    edx,[eax*4+0x0]
  4046d6:	a1 30 f4 40 00       	mov    eax,ds:0x40f430
  4046db:	8b 04 85 60 f2 40 00 	mov    eax,DWORD PTR [eax*4+0x40f260]
  4046e2:	01 c0                	add    eax,eax
  4046e4:	03 82 b8 f4 40 00    	add    eax,DWORD PTR [edx+0x40f4b8]
  4046ea:	83 c0 02             	add    eax,0x2
  4046ed:	89 81 b8 f4 40 00    	mov    DWORD PTR [ecx+0x40f4b8],eax
  4046f3:	8b 55 c8             	mov    edx,DWORD PTR [ebp-0x38]
  4046f6:	89 d0                	mov    eax,edx
  4046f8:	01 c0                	add    eax,eax
  4046fa:	01 d0                	add    eax,edx
  4046fc:	c1 e0 02             	shl    eax,0x2
  4046ff:	81 b8 b8 f4 40 00 9f 	cmp    DWORD PTR [eax+0x40f4b8],0x19f
  404706:	01 00 00 
  404709:	7e 0a                	jle    0x404715
  40470b:	c7 05 30 fd 40 00 01 	mov    DWORD PTR ds:0x40fd30,0x1
  404712:	00 00 00 
  404715:	8b 45 c8             	mov    eax,DWORD PTR [ebp-0x38]
