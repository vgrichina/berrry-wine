
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

00415760 <.text+0x14760>:
  415760:	33 f6                	xor    esi,esi
  415762:	89 44 24 14          	mov    DWORD PTR [esp+0x14],eax
  415766:	89 74 24 18          	mov    DWORD PTR [esp+0x18],esi
  41576a:	81 e3 ff 00 00 00    	and    ebx,0xff
  415770:	dd 5c 24 1c          	fstp   QWORD PTR [esp+0x1c]
  415774:	dd 44 24 24          	fld    QWORD PTR [esp+0x24]
  415778:	dc 74 24 1c          	fdiv   QWORD PTR [esp+0x1c]
  41577c:	8b eb                	mov    ebp,ebx
  41577e:	89 5c 24 0c          	mov    DWORD PTR [esp+0xc],ebx
  415782:	df 6c 24 14          	fild   QWORD PTR [esp+0x14]
  415786:	0f af e8             	imul   ebp,eax
  415789:	de c9                	fmulp  st(1),st
  41578b:	e8 a0 1c 00 00       	call   0x417430
  415790:	40                   	inc    eax
  415791:	0f af c3             	imul   eax,ebx
  415794:	50                   	push   eax
  415795:	e8 7c 1c 00 00       	call   0x417416
  41579a:	dd 44 24 20          	fld    QWORD PTR [esp+0x20]
  41579e:	dc 74 24 28          	fdiv   QWORD PTR [esp+0x28]
  4157a2:	83 c4 04             	add    esp,0x4
  4157a5:	3b ee                	cmp    ebp,esi
  4157a7:	89 44 24 3c          	mov    DWORD PTR [esp+0x3c],eax
  4157ab:	89 74 24 40          	mov    DWORD PTR [esp+0x40],esi
  4157af:	da 4c 24 0c          	fimul  DWORD PTR [esp+0xc]
  4157b3:	dd 05 48 9b 41 00    	fld    QWORD PTR ds:0x419b48
  4157b9:	76 3d                	jbe    0x4157f8
  4157bb:	57                   	push   edi
  4157bc:	33 c0                	xor    eax,eax
  4157be:	8b 54 24 14          	mov    edx,DWORD PTR [esp+0x14]
  4157c2:	8b cb                	mov    ecx,ebx
  4157c4:	d8 c1                	fadd   st,st(1)
  4157c6:	8d 34 10             	lea    esi,[eax+edx*1]
  4157c9:	8b 44 24 44          	mov    eax,DWORD PTR [esp+0x44]
  4157cd:	8b 54 24 40          	mov    edx,DWORD PTR [esp+0x40]
  4157d1:	d9 c0                	fld    st(0)
  4157d3:	8d 3c 10             	lea    edi,[eax+edx*1]
  4157d6:	8b c1                	mov    eax,ecx
  4157d8:	c1 e9 02             	shr    ecx,0x2
  4157db:	f3 a5                	rep movs DWORD PTR es:[edi],DWORD PTR ds:[esi]
  4157dd:	8b 54 24 44          	mov    edx,DWORD PTR [esp+0x44]
  4157e1:	8b c8                	mov    ecx,eax
  4157e3:	83 e1 03             	and    ecx,0x3
  4157e6:	03 d3                	add    edx,ebx
  4157e8:	f3 a4                	rep movs BYTE PTR es:[edi],BYTE PTR ds:[esi]
  4157ea:	89 54 24 44          	mov    DWORD PTR [esp+0x44],edx
  4157ee:	e8 3d 1c 00 00       	call   0x417430
  4157f3:	3b c5                	cmp    eax,ebp
  4157f5:	72 c7                	jb     0x4157be
  4157f7:	5f                   	pop    edi
  4157f8:	8b 54 24 38          	mov    edx,DWORD PTR [esp+0x38]
  4157fc:	8b 4c 24 3c          	mov    ecx,DWORD PTR [esp+0x3c]
  415800:	8b 44 24 40          	mov    eax,DWORD PTR [esp+0x40]
  415804:	5e                   	pop    esi
  415805:	89 0a                	mov    DWORD PTR [edx],ecx
  415807:	33 d2                	xor    edx,edx
  415809:	dd d8                	fstp   st(0)
  41580b:	f7 f3                	div    ebx
  41580d:	dd d8                	fstp   st(0)
  41580f:	5d                   	pop    ebp
  415810:	5b                   	pop    ebx
  415811:	83 c4 20             	add    esp,0x20
  415814:	c2                   	.byte 0xc2
