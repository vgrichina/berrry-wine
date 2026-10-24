
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

0040674f <.text+0x574f>:
  40674f:	8b 0d 7c f9 41 00    	mov    ecx,DWORD PTR ds:0x41f97c
  406755:	83 c4 04             	add    esp,0x4
  406758:	d1 fa                	sar    edx,1
  40675a:	8b c2                	mov    eax,edx
  40675c:	03 d7                	add    edx,edi
  40675e:	c1 e8 1f             	shr    eax,0x1f
  406761:	6a 01                	push   0x1
  406763:	8d 7c 10 03          	lea    edi,[eax+edx*1+0x3]
  406767:	8b 01                	mov    eax,DWORD PTR [ecx]
  406769:	66 8b 50 0c          	mov    dx,WORD PTR [eax+0xc]
  40676d:	66 8b 40 08          	mov    ax,WORD PTR [eax+0x8]
  406771:	52                   	push   edx
  406772:	50                   	push   eax
  406773:	53                   	push   ebx
  406774:	53                   	push   ebx
  406775:	e8 56 f7 00 00       	call   0x415ed0
  40677a:	a1 e0 f4 41 00       	mov    eax,ds:0x41f4e0
  40677f:	3b c3                	cmp    eax,ebx
  406781:	7e 1a                	jle    0x40679d
  406783:	8b 0c 85 74 0a 42 00 	mov    ecx,DWORD PTR [eax*4+0x420a74]
  40678a:	3b cb                	cmp    ecx,ebx
  40678c:	74 0b                	je     0x406799
  40678e:	8b 11                	mov    edx,DWORD PTR [ecx]
  406790:	6a 01                	push   0x1
  406792:	ff 12                	call   DWORD PTR [edx]
  406794:	a1 e0 f4 41 00       	mov    eax,ds:0x41f4e0
  406799:	3b c3                	cmp    eax,ebx
  40679b:	7f e6                	jg     0x406783
  40679d:	89 35 98 f2 41 00    	mov    DWORD PTR ds:0x41f298,esi
  4067a3:	89 35 28 f3 41 00    	mov    DWORD PTR ds:0x41f328,esi
  4067a9:	8b 35 fc f9 41 00    	mov    esi,DWORD PTR ds:0x41f9fc
  4067af:	89 1d 24 f7 41 00    	mov    DWORD PTR ds:0x41f724,ebx
  4067b5:	3b f3                	cmp    esi,ebx
  4067b7:	89 1d b8 f2 41 00    	mov    DWORD PTR ds:0x41f2b8,ebx
  4067bd:	89 1d cc f2 41 00    	mov    DWORD PTR ds:0x41f2cc,ebx
  4067c3:	74 11                	je     0x4067d6
  4067c5:	8b 0c b5 08 0c 42 00 	mov    ecx,DWORD PTR [esi*4+0x420c08]
  4067cc:	4e                   	dec    esi
  4067cd:	8b 01                	mov    eax,DWORD PTR [ecx]
  4067cf:	ff 50 7c             	call   DWORD PTR [eax+0x7c]
  4067d2:	3b f3                	cmp    esi,ebx
  4067d4:	75 ef                	jne    0x4067c5
  4067d6:	53                   	push   ebx
  4067d7:	6a 01                	push   0x1
  4067d9:	e8 c2 ef ff ff       	call   0x4057a0
  4067de:	8b 0d 7c f9 41 00    	mov    ecx,DWORD PTR ds:0x41f97c
  4067e4:	83 c4 08             	add    esp,0x8
  4067e7:	53                   	push   ebx
  4067e8:	e8 33 f6 00 00       	call   0x415e20
  4067ed:	3b fb                	cmp    edi,ebx
  4067ef:	7e 39                	jle    0x40682a
  4067f1:	68 80 02 00 00       	push   0x280
  4067f6:	e8 f5 ee ff ff       	call   0x4056f0
  4067fb:	66 8b f0             	mov    si,ax
  4067fe:	6a 0a                	push   0xa
  406800:	81 e6 ff ff 00 00    	and    esi,0xffff
  406806:	c1 e6 04             	shl    esi,0x4
  406809:	e8 e2 ee ff ff       	call   0x4056f0
  40680e:	83 c4 08             	add    esp,0x8
  406811:	66 85 c0             	test   ax,ax
  406814:	53                   	push   ebx
  406815:	56                   	push   esi
  406816:	75 07                	jne    0x40681f
  406818:	e8 73 63 00 00       	call   0x40cb90
  40681d:	eb 05                	jmp    0x406824
  40681f:	e8 9c 62 00 00       	call   0x40cac0
  406824:	83 c4 08             	add    esp,0x8
  406827:	4f                   	dec    edi
  406828:	75 c7                	jne    0x4067f1
  40682a:	8b 35 7c f9 41 00    	mov    esi,DWORD PTR ds:0x41f97c
  406830:	5f                   	pop    edi
  406831:	39 9e 10 04 00 00    	cmp    DWORD PTR [esi+0x410],ebx
  406837:	74 07                	je     0x406840
  406839:	8b ce                	mov    ecx,esi
  40683b:	e8 30 f5 00 00       	call   0x415d70
  406840:	8b 4e 08             	mov    ecx,DWORD PTR [esi+0x8]
  406843:	89 0e                	mov    DWORD PTR [esi],ecx
  406845:	be 98 f6 41 00       	mov    esi,0x41f698
  40684a:	8b 06                	mov    eax,DWORD PTR [esi]
  40684c:	8b 50 08             	mov    edx,DWORD PTR [eax+0x8]
  40684f:	66 8b 48 04          	mov    cx,WORD PTR [eax+0x4]
  406853:	52                   	push   edx
  406854:	66 8b 10             	mov    dx,WORD PTR [eax]
  406857:	51                   	push   ecx
  406858:	8b 0d 7c f9 41 00    	mov    ecx,DWORD PTR ds:0x41f97c
  40685e:	52                   	push   edx
  40685f:	e8 6c f7 00 00       	call   0x415fd0
  406864:	83 c6 04             	add    esi,0x4
  406867:	81 fe 10 f7 41 00    	cmp    esi,0x41f710
  40686d:	7c db                	jl     0x40684a
  40686f:	8b 0d 7c f9 41 00    	mov    ecx,DWORD PTR ds:0x41f97c
  406875:	6a 01                	push   0x1
  406877:	e8 a4 f5 00 00       	call   0x415e20
  40687c:	8b 35 7c f9 41 00    	mov    esi,DWORD PTR ds:0x41f97c
  406882:	39 9e 10 04 00 00    	cmp    DWORD PTR [esi+0x410],ebx
  406888:	74 07                	je     0x406891
  40688a:	8b ce                	mov    ecx,esi
  40688c:	e8 df f4 00 00       	call   0x415d70
  406891:	8b 46 04             	mov    eax,DWORD PTR [esi+0x4]
  406894:	89 06                	mov    DWORD PTR [esi],eax
  406896:	8b 0d 7c f9 41 00    	mov    ecx,DWORD PTR ds:0x41f97c
  40689c:	5e                   	pop    esi
  40689d:	5b                   	pop    ebx
  40689e:	e9 ad ff 00 00       	jmp    0x416850
