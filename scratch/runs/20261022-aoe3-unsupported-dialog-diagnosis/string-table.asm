
/home/user/wine-assembly-aoe3-unsupported-dialog-diagnosis-oct22/scratch/runs/20261022-aoe3-unsupported-dialog-diagnosis/original/age3.exe:     file format pei-i386


Disassembly of section .text:

00930530 <.text+0x52f530>:
  930530:	8b 44 24 04          	mov    eax,DWORD PTR [esp+0x4]
  930534:	85 c0                	test   eax,eax
  930536:	7c 0f                	jl     0x930547
  930538:	3b 41 18             	cmp    eax,DWORD PTR [ecx+0x18]
  93053b:	7d 0a                	jge    0x930547
  93053d:	8b 51 14             	mov    edx,DWORD PTR [ecx+0x14]
  930540:	8b 04 82             	mov    eax,DWORD PTR [edx+eax*4]
  930543:	85 c0                	test   eax,eax
  930545:	7d 08                	jge    0x93054f
  930547:	b8 20 a7 ce 00       	mov    eax,0xcea720
  93054c:	c2 04 00             	ret    0x4
  93054f:	8b 49 08             	mov    ecx,DWORD PTR [ecx+0x8]
  930552:	8d 04 81             	lea    eax,[ecx+eax*4]
  930555:	c2 04 00             	ret    0x4
  930558:	cc                   	int3
  930559:	cc                   	int3
  93055a:	cc                   	int3
  93055b:	cc                   	int3
  93055c:	cc                   	int3
  93055d:	cc                   	int3
  93055e:	cc                   	int3
  93055f:	cc                   	int3
  930560:	8b 44 24 04          	mov    eax,DWORD PTR [esp+0x4]
  930564:	85 c0                	test   eax,eax
  930566:	7c 05                	jl     0x93056d
  930568:	3b 41 18             	cmp    eax,DWORD PTR [ecx+0x18]
  93056b:	7c 05                	jl     0x930572
  93056d:	32 c0                	xor    al,al
  93056f:	c2 04 00             	ret    0x4
  930572:	8b 49 14             	mov    ecx,DWORD PTR [ecx+0x14]
  930575:	83 3c 81 00          	cmp    DWORD PTR [ecx+eax*4],0x0
  930579:	0f 9d c0             	setge  al
  93057c:	c2 04 00             	ret    0x4
  93057f:	cc                   	int3
  930580:	56                   	push   esi
  930581:	8b f1                	mov    esi,ecx
  930583:	e8 48 2a fb ff       	call   0x8e2fd0
  930588:	8d 4e 04             	lea    ecx,[esi+0x4]
  93058b:	e8 40 2a fb ff       	call   0x8e2fd0
  930590:	33 c0                	xor    eax,eax
  930592:	89 46 08             	mov    DWORD PTR [esi+0x8],eax
  930595:	89 46 0c             	mov    DWORD PTR [esi+0xc],eax
  930598:	89 46 10             	mov    DWORD PTR [esi+0x10],eax
  93059b:	89 46 14             	mov    DWORD PTR [esi+0x14],eax
  93059e:	89 46 18             	mov    DWORD PTR [esi+0x18],eax
  9305a1:	89 46 1c             	mov    DWORD PTR [esi+0x1c],eax
  9305a4:	8b c6                	mov    eax,esi
  9305a6:	5e                   	pop    esi
  9305a7:	c3                   	ret
  9305a8:	cc                   	int3
  9305a9:	cc                   	int3
  9305aa:	cc                   	int3
  9305ab:	cc                   	int3
  9305ac:	cc                   	int3
  9305ad:	cc                   	int3
  9305ae:	cc                   	int3
  9305af:	cc                   	int3
  9305b0:	56                   	push   esi
  9305b1:	57                   	push   edi
  9305b2:	8b f1                	mov    esi,ecx
  9305b4:	33 ff                	xor    edi,edi
  9305b6:	39 7e 08             	cmp    DWORD PTR [esi+0x8],edi
  9305b9:	74 2d                	je     0x9305e8
  9305bb:	53                   	push   ebx
  9305bc:	33 db                	xor    ebx,ebx
  9305be:	39 7e 10             	cmp    DWORD PTR [esi+0x10],edi
  9305c1:	7e 13                	jle    0x9305d6
  9305c3:	8b 46 08             	mov    eax,DWORD PTR [esi+0x8]
  9305c6:	8d 0c 98             	lea    ecx,[eax+ebx*4]
  9305c9:	e8 a2 2f fb ff       	call   0x8e3570
  9305ce:	83 c3 01             	add    ebx,0x1
  9305d1:	3b 5e 10             	cmp    ebx,DWORD PTR [esi+0x10]
  9305d4:	7c ed                	jl     0x9305c3
  9305d6:	8b 4e 08             	mov    ecx,DWORD PTR [esi+0x8]
  9305d9:	51                   	push   ecx
  9305da:	b9 74 89 cc 00       	mov    ecx,0xcc8974
  9305df:	e8 fc 27 fb ff       	call   0x8e2de0
  9305e4:	89 7e 08             	mov    DWORD PTR [esi+0x8],edi
  9305e7:	5b                   	pop    ebx
  9305e8:	89 7e 10             	mov    DWORD PTR [esi+0x10],edi
  9305eb:	89 7e 0c             	mov    DWORD PTR [esi+0xc],edi
  9305ee:	39 7e 1c             	cmp    DWORD PTR [esi+0x1c],edi
  9305f1:	7c 03                	jl     0x9305f6
  9305f3:	89 7e 18             	mov    DWORD PTR [esi+0x18],edi
  9305f6:	8b 46 14             	mov    eax,DWORD PTR [esi+0x14]
  9305f9:	3b c7                	cmp    eax,edi
  9305fb:	74 0b                	je     0x930608
  9305fd:	50                   	push   eax
  9305fe:	b9 74 89 cc 00       	mov    ecx,0xcc8974
  930603:	e8 d8 27 fb ff       	call   0x8e2de0
  930608:	39 7e 08             	cmp    DWORD PTR [esi+0x8],edi
  93060b:	74 26                	je     0x930633
  93060d:	39 7e 10             	cmp    DWORD PTR [esi+0x10],edi
  930610:	7e 13                	jle    0x930625
  930612:	8b 56 08             	mov    edx,DWORD PTR [esi+0x8]
  930615:	8d 0c ba             	lea    ecx,[edx+edi*4]
  930618:	e8 53 2f fb ff       	call   0x8e3570
  93061d:	83 c7 01             	add    edi,0x1
  930620:	3b 7e 10             	cmp    edi,DWORD PTR [esi+0x10]
  930623:	7c ed                	jl     0x930612
  930625:	8b 46 08             	mov    eax,DWORD PTR [esi+0x8]
  930628:	50                   	push   eax
  930629:	b9 74 89 cc 00       	mov    ecx,0xcc8974
  93062e:	e8 ad 27 fb ff       	call   0x8e2de0
  930633:	8d 4e 04             	lea    ecx,[esi+0x4]
  930636:	e8 35 2f fb ff       	call   0x8e3570
  93063b:	5f                   	pop    edi
  93063c:	8b ce                	mov    ecx,esi
  93063e:	5e                   	pop    esi
  93063f:	e9 2c 2f fb ff       	jmp    0x8e3570
  930644:	cc                   	int3
  930645:	cc                   	int3
  930646:	cc                   	int3
  930647:	cc                   	int3
  930648:	cc                   	int3
  930649:	cc                   	int3
  93064a:	cc                   	int3
  93064b:	cc                   	int3
  93064c:	cc                   	int3
  93064d:	cc                   	int3
  93064e:	cc                   	int3
  93064f:	cc                   	int3
  930650:	b8 88 18 00 00       	mov    eax,0x1888
  930655:	e8 b6 0c f8 ff       	call   0x8b1310
  93065a:	53                   	push   ebx
  93065b:	56                   	push   esi
  93065c:	8b b4 24 98 18 00 00 	mov    esi,DWORD PTR [esp+0x1898]
  930663:	8b d9                	mov    ebx,ecx
  930665:	56                   	push   esi
  930666:	89 5c 24 28          	mov    DWORD PTR [esp+0x28],ebx
  93066a:	e8 f1 43 fb ff       	call   0x8e4a60
  93066f:	8d 4c 24 28          	lea    ecx,[esp+0x28]
  930673:	e8 c8 7b fb ff       	call   0x8e8240
  930678:	6a 01                	push   0x1
  93067a:	6a 00                	push   0x0
  93067c:	8b ce                	mov    ecx,esi
  93067e:	e8 dd 29 fb ff       	call   0x8e3060
  930683:	50                   	push   eax
  930684:	8b 84 24 a0 18 00 00 	mov    eax,DWORD PTR [esp+0x18a0]
  93068b:	50                   	push   eax
  93068c:	8d 4c 24 38          	lea    ecx,[esp+0x38]
  930690:	e8 eb 8f fb ff       	call   0x8e9680
  930695:	84 c0                	test   al,al
  930697:	75 25                	jne    0x9306be
  930699:	68 c8 0f 00 00       	push   0xfc8
  93069e:	b9 78 28 ce 00       	mov    ecx,0xce2878
  9306a3:	e8 68 56 fb ff       	call   0x8e5d10
  9306a8:	8d 4c 24 28          	lea    ecx,[esp+0x28]
  9306ac:	e8 2f 7c fb ff       	call   0x8e82e0
  9306b1:	5e                   	pop    esi
  9306b2:	32 c0                	xor    al,al
  9306b4:	5b                   	pop    ebx
  9306b5:	81 c4 88 18 00 00    	add    esp,0x1888
  9306bb:	c2 08 00             	ret    0x8
  9306be:	8b 4c 24 30          	mov    ecx,DWORD PTR [esp+0x30]
  9306c2:	85 c9                	test   ecx,ecx
  9306c4:	8b f1                	mov    esi,ecx
  9306c6:	75 25                	jne    0x9306ed
  9306c8:	68 c9 0f 00 00       	push   0xfc9
  9306cd:	b9 78 28 ce 00       	mov    ecx,0xce2878
  9306d2:	e8 39 56 fb ff       	call   0x8e5d10
  9306d7:	8d 4c 24 28          	lea    ecx,[esp+0x28]
  9306db:	e8 00 7c fb ff       	call   0x8e82e0
  9306e0:	5e                   	pop    esi
  9306e1:	32 c0                	xor    al,al
  9306e3:	5b                   	pop    ebx
  9306e4:	81 c4 88 18 00 00    	add    esp,0x1888
  9306ea:	c2 08 00             	ret    0x8
  9306ed:	6a ff                	push   0xffffffff
  9306ef:	6a 00                	push   0x0
  9306f1:	68 2c c0 b6 00       	push   0xb6c02c
  9306f6:	e8 35 74 fb ff       	call   0x8e7b30
  9306fb:	8b c8                	mov    ecx,eax
  9306fd:	e8 8e 38 fb ff       	call   0x8e3f90
  930702:	85 c0                	test   eax,eax
  930704:	74 25                	je     0x93072b
  930706:	68 ca 0f 00 00       	push   0xfca
  93070b:	b9 78 28 ce 00       	mov    ecx,0xce2878
  930710:	e8 fb 55 fb ff       	call   0x8e5d10
  930715:	8d 4c 24 28          	lea    ecx,[esp+0x28]
  930719:	e8 c2 7b fb ff       	call   0x8e82e0
  93071e:	5e                   	pop    esi
  93071f:	32 c0                	xor    al,al
  930721:	5b                   	pop    ebx
  930722:	81 c4 88 18 00 00    	add    esp,0x1888
  930728:	c2 08 00             	ret    0x8
  93072b:	83 7e 0c 01          	cmp    DWORD PTR [esi+0xc],0x1
  93072f:	7d 25                	jge    0x930756
  930731:	68 cb 0f 00 00       	push   0xfcb
  930736:	b9 78 28 ce 00       	mov    ecx,0xce2878
  93073b:	e8 d0 55 fb ff       	call   0x8e5d10
  930740:	8d 4c 24 28          	lea    ecx,[esp+0x28]
  930744:	e8 97 7b fb ff       	call   0x8e82e0
  930749:	5e                   	pop    esi
  93074a:	32 c0                	xor    al,al
  93074c:	5b                   	pop    ebx
  93074d:	81 c4 88 18 00 00    	add    esp,0x1888
  930753:	c2 08 00             	ret    0x8
  930756:	57                   	push   edi
  930757:	6a 00                	push   0x0
  930759:	8b ce                	mov    ecx,esi
  93075b:	e8 20 ea fb ff       	call   0x8ef180
  930760:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  930764:	8b f8                	mov    edi,eax
  930766:	51                   	push   ecx
  930767:	68 6c bb b5 00       	push   0xb5bb6c
  93076c:	8b cf                	mov    ecx,edi
  93076e:	89 7c 24 24          	mov    DWORD PTR [esp+0x24],edi
  930772:	c7 44 24 18 00 00 00 	mov    DWORD PTR [esp+0x18],0x0
  930779:	00 
  93077a:	e8 71 71 fb ff       	call   0x8e78f0
  93077f:	84 c0                	test   al,al
  930781:	75 26                	jne    0x9307a9
  930783:	68 cc 0f 00 00       	push   0xfcc
  930788:	b9 78 28 ce 00       	mov    ecx,0xce2878
  93078d:	e8 7e 55 fb ff       	call   0x8e5d10
  930792:	8d 4c 24 2c          	lea    ecx,[esp+0x2c]
  930796:	e8 45 7b fb ff       	call   0x8e82e0
  93079b:	5f                   	pop    edi
  93079c:	5e                   	pop    esi
  93079d:	32 c0                	xor    al,al
  93079f:	5b                   	pop    ebx
  9307a0:	81 c4 88 18 00 00    	add    esp,0x1888
  9307a6:	c2 08 00             	ret    0x8
  9307a9:	8b 54 24 10          	mov    edx,DWORD PTR [esp+0x10]
  9307ad:	55                   	push   ebp
  9307ae:	6a ff                	push   0xffffffff
  9307b0:	6a ff                	push   0xffffffff
  9307b2:	52                   	push   edx
  9307b3:	8d 4b 04             	lea    ecx,[ebx+0x4]
  9307b6:	e8 25 3e fb ff       	call   0x8e45e0
  9307bb:	8d 6b 14             	lea    ebp,[ebx+0x14]
  9307be:	8b cd                	mov    ecx,ebp
  9307c0:	e8 0b a7 b9 ff       	call   0x4caed0
  9307c5:	83 c3 08             	add    ebx,0x8
  9307c8:	83 3b 00             	cmp    DWORD PTR [ebx],0x0
  9307cb:	74 2c                	je     0x9307f9
  9307cd:	33 f6                	xor    esi,esi
  9307cf:	39 73 08             	cmp    DWORD PTR [ebx+0x8],esi
  9307d2:	7e 12                	jle    0x9307e6
  9307d4:	8b 03                	mov    eax,DWORD PTR [ebx]
  9307d6:	8d 0c b0             	lea    ecx,[eax+esi*4]
  9307d9:	e8 92 2d fb ff       	call   0x8e3570
  9307de:	83 c6 01             	add    esi,0x1
  9307e1:	3b 73 08             	cmp    esi,DWORD PTR [ebx+0x8]
  9307e4:	7c ee                	jl     0x9307d4
  9307e6:	8b 0b                	mov    ecx,DWORD PTR [ebx]
  9307e8:	51                   	push   ecx
  9307e9:	b9 74 89 cc 00       	mov    ecx,0xcc8974
  9307ee:	e8 ed 25 fb ff       	call   0x8e2de0
  9307f3:	c7 03 00 00 00 00    	mov    DWORD PTR [ebx],0x0
  9307f9:	33 c9                	xor    ecx,ecx
  9307fb:	89 4b 08             	mov    DWORD PTR [ebx+0x8],ecx
  9307fe:	89 4b 04             	mov    DWORD PTR [ebx+0x4],ecx
  930801:	8b 47 0c             	mov    eax,DWORD PTR [edi+0xc]
  930804:	33 ff                	xor    edi,edi
  930806:	85 c0                	test   eax,eax
  930808:	89 44 24 28          	mov    DWORD PTR [esp+0x28],eax
  93080c:	89 7c 24 1c          	mov    DWORD PTR [esp+0x1c],edi
  930810:	0f 8e da 00 00 00    	jle    0x9308f0
  930816:	8b 4c 24 20          	mov    ecx,DWORD PTR [esp+0x20]
  93081a:	57                   	push   edi
  93081b:	e8 60 e9 fb ff       	call   0x8ef180
  930820:	8b f0                	mov    esi,eax
  930822:	8b ce                	mov    ecx,esi
  930824:	e8 07 73 fb ff       	call   0x8e7b30
  930829:	6a ff                	push   0xffffffff
  93082b:	6a 00                	push   0x0
  93082d:	68 ec 9f b5 00       	push   0xb59fec
  930832:	8b c8                	mov    ecx,eax
  930834:	e8 57 37 fb ff       	call   0x8e3f90
  930839:	85 c0                	test   eax,eax
  93083b:	0f 85 9e 00 00 00    	jne    0x9308df
  930841:	8d 54 24 10          	lea    edx,[esp+0x10]
  930845:	52                   	push   edx
  930846:	68 f0 bf b6 00       	push   0xb6bff0
  93084b:	8b ce                	mov    ecx,esi
  93084d:	e8 fe 70 fb ff       	call   0x8e7950
  930852:	84 c0                	test   al,al
  930854:	75 15                	jne    0x93086b
  930856:	8d 44 24 10          	lea    eax,[esp+0x10]
  93085a:	50                   	push   eax
  93085b:	68 84 69 b5 00       	push   0xb56984
  930860:	8b ce                	mov    ecx,esi
  930862:	e8 e9 70 fb ff       	call   0x8e7950
  930867:	84 c0                	test   al,al
  930869:	74 74                	je     0x9308df
  93086b:	83 c6 14             	add    esi,0x14
  93086e:	56                   	push   esi
  93086f:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  930873:	e8 88 43 fb ff       	call   0x8e4c00
  930878:	8d 4c 24 18          	lea    ecx,[esp+0x18]
  93087c:	51                   	push   ecx
  93087d:	8b cb                	mov    ecx,ebx
  93087f:	e8 1c 2f af ff       	call   0x4237a0
  930884:	8b 54 24 2c          	mov    edx,DWORD PTR [esp+0x2c]
  930888:	8b 7a 18             	mov    edi,DWORD PTR [edx+0x18]
  93088b:	8b 74 24 10          	mov    esi,DWORD PTR [esp+0x10]
  93088f:	3b fe                	cmp    edi,esi
  930891:	89 44 24 24          	mov    DWORD PTR [esp+0x24],eax
  930895:	7f 2a                	jg     0x9308c1
  930897:	6a 00                	push   0x0
  930899:	83 c6 64             	add    esi,0x64
  93089c:	56                   	push   esi
  93089d:	8b cd                	mov    ecx,ebp
  93089f:	e8 5c 0d ad ff       	call   0x401600
  9308a4:	3b fe                	cmp    edi,esi
  9308a6:	8b c7                	mov    eax,edi
  9308a8:	7d 17                	jge    0x9308c1
  9308aa:	8d 9b 00 00 00 00    	lea    ebx,[ebx+0x0]
  9308b0:	8b 4d 00             	mov    ecx,DWORD PTR [ebp+0x0]
  9308b3:	c7 04 81 ff ff ff ff 	mov    DWORD PTR [ecx+eax*4],0xffffffff
  9308ba:	83 c0 01             	add    eax,0x1
  9308bd:	3b c6                	cmp    eax,esi
  9308bf:	7c ef                	jl     0x9308b0
  9308c1:	8b 44 24 10          	mov    eax,DWORD PTR [esp+0x10]
  9308c5:	8d 54 24 24          	lea    edx,[esp+0x24]
  9308c9:	52                   	push   edx
  9308ca:	50                   	push   eax
  9308cb:	8b cd                	mov    ecx,ebp
  9308cd:	e8 3e 1b 10 00       	call   0xa32410
  9308d2:	8d 4c 24 18          	lea    ecx,[esp+0x18]
  9308d6:	e8 95 2c fb ff       	call   0x8e3570
  9308db:	8b 7c 24 1c          	mov    edi,DWORD PTR [esp+0x1c]
  9308df:	83 c7 01             	add    edi,0x1
  9308e2:	3b 7c 24 28          	cmp    edi,DWORD PTR [esp+0x28]
  9308e6:	89 7c 24 1c          	mov    DWORD PTR [esp+0x1c],edi
  9308ea:	0f 8c 26 ff ff ff    	jl     0x930816
  9308f0:	8d 4c 24 30          	lea    ecx,[esp+0x30]
  9308f4:	e8 e7 79 fb ff       	call   0x8e82e0
  9308f9:	5d                   	pop    ebp
  9308fa:	5f                   	pop    edi
  9308fb:	5e                   	pop    esi
  9308fc:	b0 01                	mov    al,0x1
  9308fe:	5b                   	pop    ebx
  9308ff:	81 c4 88 18 00 00    	add    esp,0x1888
  930905:	c2 08 00             	ret    0x8
  930908:	cc                   	int3
  930909:	cc                   	int3
  93090a:	cc                   	int3
  93090b:	cc                   	int3
  93090c:	cc                   	int3
  93090d:	cc                   	int3
  93090e:	cc                   	int3
  93090f:	cc                   	int3
  930910:	8b 44 24 04          	mov    eax,DWORD PTR [esp+0x4]
  930914:	39 05 30 0b d5 00    	cmp    DWORD PTR ds:0xd50b30,eax
  93091a:	74 05                	je     0x930921
  93091c:	a3 30 0b d5 00       	mov    ds:0xd50b30,eax
  930921:	c2 04 00             	ret    0x4
  930924:	cc                   	int3
  930925:	cc                   	int3
  930926:	cc                   	int3
  930927:	cc                   	int3
  930928:	cc                   	int3
  930929:	cc                   	int3
  93092a:	cc                   	int3
  93092b:	cc                   	int3
  93092c:	cc                   	int3
  93092d:	cc                   	int3
  93092e:	cc                   	int3
  93092f:	cc                   	int3
  930930:	8b 44 24 04          	mov    eax,DWORD PTR [esp+0x4]
  930934:	83 ec 28             	sub    esp,0x28
  930937:	f6 c4 18             	test   ah,0x18
  93093a:	74 1a                	je     0x930956
  93093c:	b8 0d 00 00 c0       	mov    eax,0xc000000d
  930941:	39 05 30 0b d5 00    	cmp    DWORD PTR ds:0xd50b30,eax
  930947:	74 05                	je     0x93094e
  930949:	a3 30 0b d5 00       	mov    ds:0xd50b30,eax
  93094e:	33 c0                	xor    eax,eax
  930950:	83 c4 28             	add    esp,0x28
  930953:	c2 14 00             	ret    0x14
  930956:	8b 4c 24 34          	mov    ecx,DWORD PTR [esp+0x34]
  93095a:	55                   	push   ebp
  93095b:	33 ed                	xor    ebp,ebp
  93095d:	3b cd                	cmp    ecx,ebp
  93095f:	75 1b                	jne    0x93097c
  930961:	b8 0d 00 00 c0       	mov    eax,0xc000000d
  930966:	39 05 30 0b d5 00    	cmp    DWORD PTR ds:0xd50b30,eax
  93096c:	74 05                	je     0x930973
  93096e:	a3 30 0b d5 00       	mov    ds:0xd50b30,eax
  930973:	33 c0                	xor    eax,eax
  930975:	5d                   	pop    ebp
  930976:	83 c4 28             	add    esp,0x28
  930979:	c2 14 00             	ret    0x14
  93097c:	53                   	push   ebx
  93097d:	56                   	push   esi
  93097e:	8b f0                	mov    esi,eax
  930980:	81 e6 00 01 00 00    	and    esi,0x100
  930986:	57                   	push   edi
  930987:	89 74 24 1c          	mov    DWORD PTR [esp+0x1c],esi
  93098b:	74 02                	je     0x93098f
  93098d:	89 29                	mov    DWORD PTR [ecx],ebp
  93098f:	33 d2                	xor    edx,edx
  930991:	89 54 24 20          	mov    DWORD PTR [esp+0x20],edx
  930995:	89 54 24 24          	mov    DWORD PTR [esp+0x24],edx
  930999:	89 54 24 28          	mov    DWORD PTR [esp+0x28],edx
  93099d:	89 54 24 2c          	mov    DWORD PTR [esp+0x2c],edx
  9309a1:	89 54 24 30          	mov    DWORD PTR [esp+0x30],edx
  9309a5:	89 54 24 34          	mov    DWORD PTR [esp+0x34],edx
  9309a9:	8b d8                	mov    ebx,eax
  9309ab:	8b d0                	mov    edx,eax
  9309ad:	c1 eb 09             	shr    ebx,0x9
  9309b0:	c1 ea 0d             	shr    edx,0xd
  9309b3:	8b f8                	mov    edi,eax
  9309b5:	80 e3 01             	and    bl,0x1
  9309b8:	80 e2 01             	and    dl,0x1
  9309bb:	81 e7 ff 00 00 00    	and    edi,0xff
  9309c1:	81 ff ff 00 00 00    	cmp    edi,0xff
  9309c7:	88 5c 24 18          	mov    BYTE PTR [esp+0x18],bl
  9309cb:	88 54 24 14          	mov    BYTE PTR [esp+0x14],dl
  9309cf:	89 6c 24 3c          	mov    DWORD PTR [esp+0x3c],ebp
  9309d3:	75 03                	jne    0x9309d8
  9309d5:	83 cf ff             	or     edi,0xffffffff
  9309d8:	f6 c4 04             	test   ah,0x4
  9309db:	0f 84 ee 00 00 00    	je     0x930acf
  9309e1:	3b f5                	cmp    esi,ebp
  9309e3:	0f 85 9f 00 00 00    	jne    0x930a88
  9309e9:	8b 5c 24 48          	mov    ebx,DWORD PTR [esp+0x48]
  9309ed:	8d 34 1b             	lea    esi,[ebx+ebx*1]
  9309f0:	8b c1                	mov    eax,ecx
  9309f2:	8d 4c 24 20          	lea    ecx,[esp+0x20]
  9309f6:	51                   	push   ecx
  9309f7:	8b 4c 24 18          	mov    ecx,DWORD PTR [esp+0x18]
  9309fb:	8d 54 24 14          	lea    edx,[esp+0x14]
  9309ff:	52                   	push   edx
