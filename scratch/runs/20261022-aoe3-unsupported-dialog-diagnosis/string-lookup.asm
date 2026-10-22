
/home/user/wine-assembly-aoe3-unsupported-dialog-diagnosis-oct22/scratch/runs/20261022-aoe3-unsupported-dialog-diagnosis/original/age3.exe:     file format pei-i386


Disassembly of section .text:

008e45f0 <.text+0x4e35f0>:
  8e45f0:	8b 44 24 04          	mov    eax,DWORD PTR [esp+0x4]
  8e45f4:	53                   	push   ebx
  8e45f5:	56                   	push   esi
  8e45f6:	8b d9                	mov    ebx,ecx
  8e45f8:	50                   	push   eax
  8e45f9:	b9 18 25 ce 00       	mov    ecx,0xce2518
  8e45fe:	e8 6d 40 03 00       	call   0x918670
  8e4603:	8b 30                	mov    esi,DWORD PTR [eax]
  8e4605:	85 f6                	test   esi,esi
  8e4607:	0f 84 bd 00 00 00    	je     0x8e46ca
  8e460d:	66 83 3e 00          	cmp    WORD PTR [esi],0x0
  8e4611:	0f 84 b3 00 00 00    	je     0x8e46ca
  8e4617:	55                   	push   ebp
  8e4618:	57                   	push   edi
  8e4619:	8b 3b                	mov    edi,DWORD PTR [ebx]
  8e461b:	85 ff                	test   edi,edi
  8e461d:	74 6d                	je     0x8e468c
  8e461f:	3b f7                	cmp    esi,edi
  8e4621:	75 0e                	jne    0x8e4631
  8e4623:	8b cb                	mov    ecx,ebx
  8e4625:	e8 16 ea ff ff       	call   0x8e3040
  8e462a:	83 f8 ff             	cmp    eax,0xffffffff
  8e462d:	74 33                	je     0x8e4662
  8e462f:	3b f7                	cmp    esi,edi
  8e4631:	72 59                	jb     0x8e468c
  8e4633:	8b 47 f4             	mov    eax,DWORD PTR [edi-0xc]
  8e4636:	8d 4c 47 fe          	lea    ecx,[edi+eax*2-0x2]
  8e463a:	3b f1                	cmp    esi,ecx
  8e463c:	77 4e                	ja     0x8e468c
  8e463e:	8b d6                	mov    edx,esi
  8e4640:	2b d7                	sub    edx,edi
  8e4642:	d1 fa                	sar    edx,1
  8e4644:	2b c2                	sub    eax,edx
  8e4646:	56                   	push   esi
  8e4647:	89 44 24 18          	mov    DWORD PTR [esp+0x18],eax
  8e464b:	e8 30 f3 00 00       	call   0x8f3980
  8e4650:	8b e8                	mov    ebp,eax
  8e4652:	83 c4 04             	add    esp,0x4
  8e4655:	3b 6c 24 14          	cmp    ebp,DWORD PTR [esp+0x14]
  8e4659:	7c 0e                	jl     0x8e4669
  8e465b:	8b cb                	mov    ecx,ebx
  8e465d:	e8 0e ef ff ff       	call   0x8e3570
  8e4662:	5f                   	pop    edi
  8e4663:	5d                   	pop    ebp
  8e4664:	5e                   	pop    esi
  8e4665:	5b                   	pop    ebx
  8e4666:	c2 04 00             	ret    0x4
  8e4669:	8d 44 2d 00          	lea    eax,[ebp+ebp*1+0x0]
  8e466d:	50                   	push   eax
  8e466e:	8b 03                	mov    eax,DWORD PTR [ebx]
  8e4670:	56                   	push   esi
  8e4671:	50                   	push   eax
  8e4672:	e8 69 15 fd ff       	call   0x8b5be0
  8e4677:	8b 0b                	mov    ecx,DWORD PTR [ebx]
  8e4679:	83 c4 0c             	add    esp,0xc
  8e467c:	66 c7 04 69 00 00    	mov    WORD PTR [ecx+ebp*2],0x0
  8e4682:	89 6f f0             	mov    DWORD PTR [edi-0x10],ebp
  8e4685:	5f                   	pop    edi
  8e4686:	5d                   	pop    ebp
  8e4687:	5e                   	pop    esi
  8e4688:	5b                   	pop    ebx
  8e4689:	c2 04 00             	ret    0x4
  8e468c:	56                   	push   esi
  8e468d:	e8 ee f2 00 00       	call   0x8f3980
  8e4692:	8b e8                	mov    ebp,eax
  8e4694:	83 c4 04             	add    esp,0x4
  8e4697:	8d 55 01             	lea    edx,[ebp+0x1]
  8e469a:	52                   	push   edx
  8e469b:	8b cb                	mov    ecx,ebx
  8e469d:	e8 4e eb ff ff       	call   0x8e31f0
  8e46a2:	8b 03                	mov    eax,DWORD PTR [ebx]
  8e46a4:	8d 4c 2d 00          	lea    ecx,[ebp+ebp*1+0x0]
  8e46a8:	8b d1                	mov    edx,ecx
  8e46aa:	c1 e9 02             	shr    ecx,0x2
  8e46ad:	8b f8                	mov    edi,eax
  8e46af:	f3 a5                	rep movs DWORD PTR es:[edi],DWORD PTR ds:[esi]
  8e46b1:	8b ca                	mov    ecx,edx
  8e46b3:	83 e1 03             	and    ecx,0x3
  8e46b6:	f3 a4                	rep movs BYTE PTR es:[edi],BYTE PTR ds:[esi]
  8e46b8:	8b 0b                	mov    ecx,DWORD PTR [ebx]
  8e46ba:	5f                   	pop    edi
  8e46bb:	66 c7 04 69 00 00    	mov    WORD PTR [ecx+ebp*2],0x0
  8e46c1:	89 68 f0             	mov    DWORD PTR [eax-0x10],ebp
  8e46c4:	5d                   	pop    ebp
  8e46c5:	5e                   	pop    esi
  8e46c6:	5b                   	pop    ebx
  8e46c7:	c2 04 00             	ret    0x4
  8e46ca:	8b 03                	mov    eax,DWORD PTR [ebx]
  8e46cc:	85 c0                	test   eax,eax
  8e46ce:	74 13                	je     0x8e46e3
  8e46d0:	66 c7 00 00 00       	mov    WORD PTR [eax],0x0
  8e46d5:	8b 13                	mov    edx,DWORD PTR [ebx]
  8e46d7:	5e                   	pop    esi
  8e46d8:	c7 42 f0 00 00 00 00 	mov    DWORD PTR [edx-0x10],0x0
  8e46df:	5b                   	pop    ebx
  8e46e0:	c2 04 00             	ret    0x4
  8e46e3:	6a 01                	push   0x1
  8e46e5:	b9 18 25 ce 00       	mov    ecx,0xce2518
  8e46ea:	e8 e1 3c 03 00       	call   0x9183d0
  8e46ef:	8d 48 10             	lea    ecx,[eax+0x10]
  8e46f2:	89 0b                	mov    DWORD PTR [ebx],ecx
  8e46f4:	5e                   	pop    esi
  8e46f5:	66 c7 01 00 00       	mov    WORD PTR [ecx],0x0
  8e46fa:	c7 00 00 00 00 00    	mov    DWORD PTR [eax],0x0
  8e4700:	5b                   	pop    ebx
  8e4701:	c2 04 00             	ret    0x4
