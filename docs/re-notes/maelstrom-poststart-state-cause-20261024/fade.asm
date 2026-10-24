
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

00416850 <.text+0x15850>:
  416850:	81 ec 04 02 00 00    	sub    esp,0x204
  416856:	53                   	push   ebx
  416857:	55                   	push   ebp
  416858:	56                   	push   esi
  416859:	57                   	push   edi
  41685a:	89 4c 24 10          	mov    DWORD PTR [esp+0x10],ecx
  41685e:	bb 01 00 00 00       	mov    ebx,0x1
  416863:	bd 20 00 00 00       	mov    ebp,0x20
  416868:	8b 44 24 10          	mov    eax,DWORD PTR [esp+0x10]
  41686c:	8b fb                	mov    edi,ebx
  41686e:	8b 88 14 04 00 00    	mov    ecx,DWORD PTR [eax+0x414]
  416874:	85 c9                	test   ecx,ecx
  416876:	75 02                	jne    0x41687a
  416878:	8b fd                	mov    edi,ebp
  41687a:	33 c9                	xor    ecx,ecx
  41687c:	33 f6                	xor    esi,esi
  41687e:	8b c6                	mov    eax,esi
  416880:	03 f7                	add    esi,edi
  416882:	99                   	cdq
  416883:	83 e2 1f             	and    edx,0x1f
  416886:	03 c2                	add    eax,edx
  416888:	33 d2                	xor    edx,edx
  41688a:	c1 f8 05             	sar    eax,0x5
  41688d:	8a f0                	mov    dh,al
  41688f:	66 89 54 4c 14       	mov    WORD PTR [esp+ecx*2+0x14],dx
  416894:	41                   	inc    ecx
  416895:	81 f9 00 01 00 00    	cmp    ecx,0x100
  41689b:	7c e1                	jl     0x41687e
  41689d:	8d 44 24 14          	lea    eax,[esp+0x14]
  4168a1:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  4168a5:	50                   	push   eax
  4168a6:	8d 54 24 18          	lea    edx,[esp+0x18]
  4168aa:	51                   	push   ecx
  4168ab:	52                   	push   edx
  4168ac:	e8 b3 0d 00 00       	call   0x417664
  4168b1:	6a 0a                	push   0xa
  4168b3:	e8 68 cb ff ff       	call   0x413420
  4168b8:	83 c4 10             	add    esp,0x10
  4168bb:	43                   	inc    ebx
  4168bc:	4d                   	dec    ebp
  4168bd:	83 fd 01             	cmp    ebp,0x1
  4168c0:	7d a6                	jge    0x416868
  4168c2:	8b 4c 24 10          	mov    ecx,DWORD PTR [esp+0x10]
  4168c6:	33 c0                	xor    eax,eax
  4168c8:	8b 91 14 04 00 00    	mov    edx,DWORD PTR [ecx+0x414]
  4168ce:	85 d2                	test   edx,edx
  4168d0:	0f 94 c0             	sete   al
  4168d3:	85 c0                	test   eax,eax
  4168d5:	89 81 14 04 00 00    	mov    DWORD PTR [ecx+0x414],eax
  4168db:	74 24                	je     0x416901
  4168dd:	b9 80 00 00 00       	mov    ecx,0x80
  4168e2:	33 c0                	xor    eax,eax
  4168e4:	8d 7c 24 14          	lea    edi,[esp+0x14]
  4168e8:	8d 54 24 14          	lea    edx,[esp+0x14]
  4168ec:	f3 ab                	rep stos DWORD PTR es:[edi],eax
  4168ee:	8d 44 24 14          	lea    eax,[esp+0x14]
  4168f2:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  4168f6:	50                   	push   eax
  4168f7:	51                   	push   ecx
  4168f8:	52                   	push   edx
  4168f9:	e8 66 0d 00 00       	call   0x417664
  4168fe:	83 c4 0c             	add    esp,0xc
  416901:	5f                   	pop    edi
  416902:	5e                   	pop    esi
  416903:	5d                   	pop    ebp
  416904:	5b                   	pop    ebx
  416905:	81 c4 04 02 00 00    	add    esp,0x204
  41690b:	c3                   	ret
