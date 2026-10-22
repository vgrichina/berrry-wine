
/home/user/wine-assembly-aoe3-unsupported-dialog-diagnosis-oct22/scratch/runs/20261022-aoe3-unsupported-dialog-diagnosis/original/age3.exe:     file format pei-i386


Disassembly of section .text:

00918670 <.text+0x517670>:
  918670:	53                   	push   ebx
  918671:	55                   	push   ebp
  918672:	56                   	push   esi
  918673:	57                   	push   edi
  918674:	8b f9                	mov    edi,ecx
  918676:	8b af b8 01 00 00    	mov    ebp,DWORD PTR [edi+0x1b8]
  91867c:	33 f6                	xor    esi,esi
  91867e:	85 ed                	test   ebp,ebp
  918680:	7e 1e                	jle    0x9186a0
  918682:	8b 5c 24 14          	mov    ebx,DWORD PTR [esp+0x14]
  918686:	8b 87 b4 01 00 00    	mov    eax,DWORD PTR [edi+0x1b4]
  91868c:	8b 0c b0             	mov    ecx,DWORD PTR [eax+esi*4]
  91868f:	53                   	push   ebx
  918690:	e8 cb 7e 01 00       	call   0x930560
  918695:	84 c0                	test   al,al
  918697:	75 13                	jne    0x9186ac
  918699:	83 c6 01             	add    esi,0x1
  91869c:	3b f5                	cmp    esi,ebp
  91869e:	7c e6                	jl     0x918686
  9186a0:	5f                   	pop    edi
  9186a1:	5e                   	pop    esi
  9186a2:	5d                   	pop    ebp
  9186a3:	b8 20 a7 ce 00       	mov    eax,0xcea720
  9186a8:	5b                   	pop    ebx
  9186a9:	c2 04 00             	ret    0x4
  9186ac:	8b bf b4 01 00 00    	mov    edi,DWORD PTR [edi+0x1b4]
  9186b2:	8b 0c b7             	mov    ecx,DWORD PTR [edi+esi*4]
  9186b5:	53                   	push   ebx
  9186b6:	e8 75 7e 01 00       	call   0x930530
  9186bb:	5f                   	pop    edi
  9186bc:	5e                   	pop    esi
  9186bd:	5d                   	pop    ebp
  9186be:	5b                   	pop    ebx
  9186bf:	c2 04 00             	ret    0x4
