
/home/user/wine-assembly-aoe3-unsupported-dialog-diagnosis-oct22/scratch/runs/20261022-aoe3-unsupported-dialog-diagnosis/original/age3.exe:     file format pei-i386


Disassembly of section .text:

008e9680 <.text+0x4e8680>:
  8e9680:	83 ec 30             	sub    esp,0x30
  8e9683:	53                   	push   ebx
  8e9684:	55                   	push   ebp
  8e9685:	56                   	push   esi
  8e9686:	8b f1                	mov    esi,ecx
  8e9688:	57                   	push   edi
  8e9689:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  8e968d:	e8 3e 99 ff ff       	call   0x8e2fd0
  8e9692:	80 be 64 18 00 00 00 	cmp    BYTE PTR [esi+0x1864],0x0
  8e9699:	74 28                	je     0x8e96c3
  8e969b:	8b 7e 08             	mov    edi,DWORD PTR [esi+0x8]
  8e969e:	85 ff                	test   edi,edi
  8e96a0:	74 1a                	je     0x8e96bc
  8e96a2:	8b cf                	mov    ecx,edi
  8e96a4:	e8 e7 e0 ff ff       	call   0x8e7790
  8e96a9:	8d 44 24 1c          	lea    eax,[esp+0x1c]
  8e96ad:	50                   	push   eax
  8e96ae:	b9 68 2c c3 00       	mov    ecx,0xc32c68
  8e96b3:	89 7c 24 20          	mov    DWORD PTR [esp+0x20],edi
  8e96b7:	e8 b4 68 bb ff       	call   0x49ff70
  8e96bc:	c7 46 08 00 00 00 00 	mov    DWORD PTR [esi+0x8],0x0
  8e96c3:	8d 4e 18             	lea    ecx,[esi+0x18]
  8e96c6:	e8 a5 96 bc ff       	call   0x4b2d70
  8e96cb:	8d 8e 38 0c 00 00    	lea    ecx,[esi+0xc38]
  8e96d1:	e8 9a 96 bc ff       	call   0x4b2d70
  8e96d6:	8b 4e 0c             	mov    ecx,DWORD PTR [esi+0xc]
  8e96d9:	85 c9                	test   ecx,ecx
  8e96db:	74 05                	je     0x8e96e2
  8e96dd:	e8 8e 96 bc ff       	call   0x4b2d70
  8e96e2:	8b 5c 24 48          	mov    ebx,DWORD PTR [esp+0x48]
  8e96e6:	53                   	push   ebx
  8e96e7:	8d 4c 24 4c          	lea    ecx,[esp+0x4c]
  8e96eb:	8d be 5c 18 00 00    	lea    edi,[esi+0x185c]
  8e96f1:	e8 aa ad ff ff       	call   0x8e44a0
  8e96f6:	50                   	push   eax
  8e96f7:	8b cf                	mov    ecx,edi
  8e96f9:	e8 62 b3 ff ff       	call   0x8e4a60
  8e96fe:	8d 4c 24 48          	lea    ecx,[esp+0x48]
  8e9702:	e8 69 9e ff ff       	call   0x8e3570
  8e9707:	53                   	push   ebx
  8e9708:	8d 4c 24 4c          	lea    ecx,[esp+0x4c]
  8e970c:	e8 8f ad ff ff       	call   0x8e44a0
  8e9711:	8b 6c 24 44          	mov    ebp,DWORD PTR [esp+0x44]
  8e9715:	6a 00                	push   0x0
  8e9717:	6a 00                	push   0x0
  8e9719:	8d 86 60 18 00 00    	lea    eax,[esi+0x1860]
  8e971f:	50                   	push   eax
  8e9720:	8d 4c 24 54          	lea    ecx,[esp+0x54]
  8e9724:	51                   	push   ecx
  8e9725:	55                   	push   ebp
  8e9726:	b9 30 28 ce 00       	mov    ecx,0xce2830
  8e972b:	e8 e0 c2 00 00       	call   0x8f5a10
  8e9730:	8d 4c 24 48          	lea    ecx,[esp+0x48]
  8e9734:	e8 37 9e ff ff       	call   0x8e3570
  8e9739:	53                   	push   ebx
  8e973a:	8d 4c 24 48          	lea    ecx,[esp+0x48]
  8e973e:	e8 5d ad ff ff       	call   0x8e44a0
  8e9743:	6a 00                	push   0x0
  8e9745:	6a 01                	push   0x1
  8e9747:	8d 9e 60 18 00 00    	lea    ebx,[esi+0x1860]
  8e974d:	53                   	push   ebx
  8e974e:	8d 54 24 50          	lea    edx,[esp+0x50]
  8e9752:	52                   	push   edx
  8e9753:	55                   	push   ebp
  8e9754:	b9 30 28 ce 00       	mov    ecx,0xce2830
  8e9759:	e8 b2 c2 00 00       	call   0x8f5a10
  8e975e:	8d 4c 24 44          	lea    ecx,[esp+0x44]
  8e9762:	88 44 24 48          	mov    BYTE PTR [esp+0x48],al
  8e9766:	e8 05 9e ff ff       	call   0x8e3570
  8e976b:	80 7c 24 50 00       	cmp    BYTE PTR [esp+0x50],0x0
  8e9770:	0f 84 01 01 00 00    	je     0x8e9877
  8e9776:	80 7c 24 48 00       	cmp    BYTE PTR [esp+0x48],0x0
  8e977b:	75 61                	jne    0x8e97de
  8e977d:	8d 44 24 20          	lea    eax,[esp+0x20]
  8e9781:	50                   	push   eax
  8e9782:	8b cf                	mov    ecx,edi
  8e9784:	e8 d7 98 ff ff       	call   0x8e3060
  8e9789:	50                   	push   eax
  8e978a:	55                   	push   ebp
  8e978b:	8b ce                	mov    ecx,esi
  8e978d:	e8 ee db ff ff       	call   0x8e7380
  8e9792:	84 c0                	test   al,al
  8e9794:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  8e9798:	0f 84 cf 01 00 00    	je     0x8e996d
  8e979e:	6a ff                	push   0xffffffff
  8e97a0:	6a ff                	push   0xffffffff
  8e97a2:	57                   	push   edi
  8e97a3:	e8 38 ae ff ff       	call   0x8e45e0
  8e97a8:	6a ff                	push   0xffffffff
  8e97aa:	6a ff                	push   0xffffffff
  8e97ac:	68 e8 c8 bc 00       	push   0xbcc8e8
  8e97b1:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  8e97b5:	e8 e6 9e ff ff       	call   0x8e36a0
  8e97ba:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  8e97be:	51                   	push   ecx
  8e97bf:	55                   	push   ebp
  8e97c0:	8b ce                	mov    ecx,esi
  8e97c2:	e8 19 fe ff ff       	call   0x8e95e0
  8e97c7:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  8e97cb:	8a d8                	mov    bl,al
  8e97cd:	e8 9e 9d ff ff       	call   0x8e3570
  8e97d2:	5f                   	pop    edi
  8e97d3:	5e                   	pop    esi
  8e97d4:	5d                   	pop    ebp
  8e97d5:	8a c3                	mov    al,bl
  8e97d7:	5b                   	pop    ebx
  8e97d8:	83 c4 30             	add    esp,0x30
  8e97db:	c2 10 00             	ret    0x10
  8e97de:	8d 54 24 30          	lea    edx,[esp+0x30]
  8e97e2:	52                   	push   edx
  8e97e3:	57                   	push   edi
  8e97e4:	55                   	push   ebp
  8e97e5:	b9 30 28 ce 00       	mov    ecx,0xce2830
  8e97ea:	e8 f1 c7 00 00       	call   0x8f5fe0
  8e97ef:	84 c0                	test   al,al
  8e97f1:	75 24                	jne    0x8e9817
  8e97f3:	68 8e 0f 00 00       	push   0xf8e
  8e97f8:	b9 78 28 ce 00       	mov    ecx,0xce2878
  8e97fd:	e8 0e c5 ff ff       	call   0x8e5d10
  8e9802:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  8e9806:	e8 65 9d ff ff       	call   0x8e3570
  8e980b:	5f                   	pop    edi
  8e980c:	5e                   	pop    esi
  8e980d:	5d                   	pop    ebp
  8e980e:	32 c0                	xor    al,al
  8e9810:	5b                   	pop    ebx
  8e9811:	83 c4 30             	add    esp,0x30
  8e9814:	c2 10 00             	ret    0x10
  8e9817:	8d 44 24 20          	lea    eax,[esp+0x20]
  8e981b:	50                   	push   eax
  8e981c:	8b cf                	mov    ecx,edi
  8e981e:	e8 3d 98 ff ff       	call   0x8e3060
  8e9823:	50                   	push   eax
  8e9824:	55                   	push   ebp
  8e9825:	8b ce                	mov    ecx,esi
  8e9827:	e8 54 db ff ff       	call   0x8e7380
  8e982c:	84 c0                	test   al,al
  8e982e:	74 47                	je     0x8e9877
  8e9830:	8d 4c 24 20          	lea    ecx,[esp+0x20]
  8e9834:	51                   	push   ecx
  8e9835:	8d 4c 24 34          	lea    ecx,[esp+0x34]
  8e9839:	e8 02 dd ff ff       	call   0x8e7540
  8e983e:	84 c0                	test   al,al
  8e9840:	75 35                	jne    0x8e9877
  8e9842:	6a ff                	push   0xffffffff
  8e9844:	6a ff                	push   0xffffffff
  8e9846:	57                   	push   edi
  8e9847:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  8e984b:	e8 90 ad ff ff       	call   0x8e45e0
  8e9850:	6a ff                	push   0xffffffff
  8e9852:	6a ff                	push   0xffffffff
  8e9854:	68 e8 c8 bc 00       	push   0xbcc8e8
  8e9859:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  8e985d:	e8 3e 9e ff ff       	call   0x8e36a0
  8e9862:	8d 54 24 10          	lea    edx,[esp+0x10]
  8e9866:	52                   	push   edx
  8e9867:	55                   	push   ebp
  8e9868:	8b ce                	mov    ecx,esi
  8e986a:	e8 71 fd ff ff       	call   0x8e95e0
  8e986f:	84 c0                	test   al,al
  8e9871:	0f 85 ba 00 00 00    	jne    0x8e9931
  8e9877:	68 f8 c9 bc 00       	push   0xbcc9f8
  8e987c:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  8e9880:	e8 1b ac ff ff       	call   0x8e44a0
  8e9885:	53                   	push   ebx
  8e9886:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  8e988a:	e8 f1 b2 ff ff       	call   0x8e4b80
  8e988f:	8b 44 24 4c          	mov    eax,DWORD PTR [esp+0x4c]
  8e9893:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  8e9897:	51                   	push   ecx
  8e9898:	68 e8 c9 bc 00       	push   0xbcc9e8
  8e989d:	6a 17                	push   0x17
  8e989f:	6a 00                	push   0x0
  8e98a1:	68 d8 c9 bc 00       	push   0xbcc9d8
  8e98a6:	89 46 0c             	mov    DWORD PTR [esi+0xc],eax
  8e98a9:	c7 44 24 28 00 00 00 	mov    DWORD PTR [esp+0x28],0x0
  8e98b0:	00 
  8e98b1:	ff 15 94 08 b3 00    	call   DWORD PTR ds:0xb30894
  8e98b7:	85 c0                	test   eax,eax
  8e98b9:	0f 8c 87 00 00 00    	jl     0x8e9946
  8e98bf:	8b 44 24 14          	mov    eax,DWORD PTR [esp+0x14]
  8e98c3:	8b 10                	mov    edx,DWORD PTR [eax]
  8e98c5:	56                   	push   esi
  8e98c6:	50                   	push   eax
  8e98c7:	ff 52 28             	call   DWORD PTR [edx+0x28]
  8e98ca:	85 c0                	test   eax,eax
  8e98cc:	7c 12                	jl     0x8e98e0
  8e98ce:	8b 4c 24 14          	mov    ecx,DWORD PTR [esp+0x14]
  8e98d2:	8b 11                	mov    edx,DWORD PTR [ecx]
  8e98d4:	8d 46 04             	lea    eax,[esi+0x4]
  8e98d7:	50                   	push   eax
  8e98d8:	51                   	push   ecx
  8e98d9:	ff 52 38             	call   DWORD PTR [edx+0x38]
  8e98dc:	85 c0                	test   eax,eax
  8e98de:	7d 0c                	jge    0x8e98ec
  8e98e0:	8b 44 24 14          	mov    eax,DWORD PTR [esp+0x14]
  8e98e4:	8b 08                	mov    ecx,DWORD PTR [eax]
  8e98e6:	50                   	push   eax
  8e98e7:	ff 51 08             	call   DWORD PTR [ecx+0x8]
  8e98ea:	eb 74                	jmp    0x8e9960
  8e98ec:	8b 54 24 14          	mov    edx,DWORD PTR [esp+0x14]
  8e98f0:	8b 32                	mov    esi,DWORD PTR [edx]
  8e98f2:	8d 4c 24 18          	lea    ecx,[esp+0x18]
  8e98f6:	e8 65 97 ff ff       	call   0x8e3060
  8e98fb:	50                   	push   eax
  8e98fc:	8b 44 24 18          	mov    eax,DWORD PTR [esp+0x18]
  8e9900:	50                   	push   eax
  8e9901:	ff 56 50             	call   DWORD PTR [esi+0x50]
  8e9904:	85 c0                	test   eax,eax
  8e9906:	8b 44 24 14          	mov    eax,DWORD PTR [esp+0x14]
  8e990a:	50                   	push   eax
  8e990b:	7d 16                	jge    0x8e9923
  8e990d:	8b 08                	mov    ecx,DWORD PTR [eax]
  8e990f:	ff 51 08             	call   DWORD PTR [ecx+0x8]
  8e9912:	68 8f 0f 00 00       	push   0xf8f
  8e9917:	b9 78 28 ce 00       	mov    ecx,0xce2878
  8e991c:	e8 ef c3 ff ff       	call   0x8e5d10
  8e9921:	eb 3d                	jmp    0x8e9960
  8e9923:	8b 10                	mov    edx,DWORD PTR [eax]
  8e9925:	ff 52 08             	call   DWORD PTR [edx+0x8]
  8e9928:	8d 4c 24 18          	lea    ecx,[esp+0x18]
  8e992c:	e8 3f 9c ff ff       	call   0x8e3570
  8e9931:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  8e9935:	e8 36 9c ff ff       	call   0x8e3570
  8e993a:	5f                   	pop    edi
  8e993b:	5e                   	pop    esi
  8e993c:	5d                   	pop    ebp
  8e993d:	b0 01                	mov    al,0x1
  8e993f:	5b                   	pop    ebx
  8e9940:	83 c4 30             	add    esp,0x30
  8e9943:	c2 10 00             	ret    0x10
  8e9946:	68 90 0f 00 00       	push   0xf90
  8e994b:	b9 78 28 ce 00       	mov    ecx,0xce2878
  8e9950:	e8 bb c3 ff ff       	call   0x8e5d10
  8e9955:	a1 34 07 cf 00       	mov    eax,ds:0xcf0734
  8e995a:	85 c0                	test   eax,eax
  8e995c:	74 02                	je     0x8e9960
  8e995e:	ff d0                	call   eax
  8e9960:	8d 4c 24 18          	lea    ecx,[esp+0x18]
  8e9964:	e8 07 9c ff ff       	call   0x8e3570
  8e9969:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  8e996d:	e8 fe 9b ff ff       	call   0x8e3570
  8e9972:	5f                   	pop    edi
  8e9973:	5e                   	pop    esi
  8e9974:	5d                   	pop    ebp
  8e9975:	32 c0                	xor    al,al
  8e9977:	5b                   	pop    ebx
  8e9978:	83 c4 30             	add    esp,0x30
  8e997b:	c2 10 00             	ret    0x10
