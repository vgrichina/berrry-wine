
/home/user/wine-assembly-aoe3-unsupported-dialog-diagnosis-oct22/scratch/runs/20261022-aoe3-unsupported-dialog-diagnosis/original/age3.exe:     file format pei-i386


Disassembly of section .text:

00918790 <.text+0x517790>:
  918790:	51                   	push   ecx
  918791:	53                   	push   ebx
  918792:	57                   	push   edi
  918793:	6a 20                	push   0x20
  918795:	8b d9                	mov    ebx,ecx
  918797:	e8 64 88 ae ff       	call   0x401000
  91879c:	83 c4 04             	add    esp,0x4
  91879f:	85 c0                	test   eax,eax
  9187a1:	74 0b                	je     0x9187ae
  9187a3:	8b c8                	mov    ecx,eax
  9187a5:	e8 d6 7d 01 00       	call   0x930580
  9187aa:	8b f8                	mov    edi,eax
  9187ac:	eb 02                	jmp    0x9187b0
  9187ae:	33 ff                	xor    edi,edi
  9187b0:	8b 44 24 14          	mov    eax,DWORD PTR [esp+0x14]
  9187b4:	8b 4c 24 10          	mov    ecx,DWORD PTR [esp+0x10]
  9187b8:	50                   	push   eax
  9187b9:	51                   	push   ecx
  9187ba:	8b cf                	mov    ecx,edi
  9187bc:	89 7c 24 10          	mov    DWORD PTR [esp+0x10],edi
  9187c0:	e8 8b 7e 01 00       	call   0x930650
  9187c5:	84 c0                	test   al,al
  9187c7:	74 16                	je     0x9187df
  9187c9:	6a 00                	push   0x0
  9187cb:	8d 54 24 0c          	lea    edx,[esp+0xc]
  9187cf:	52                   	push   edx
  9187d0:	8d 8b b4 01 00 00    	lea    ecx,[ebx+0x1b4]
  9187d6:	e8 75 86 c9 ff       	call   0x5b0e50
  9187db:	85 c0                	test   eax,eax
  9187dd:	7d 1c                	jge    0x9187fb
  9187df:	85 ff                	test   edi,edi
  9187e1:	74 10                	je     0x9187f3
  9187e3:	8b cf                	mov    ecx,edi
  9187e5:	e8 c6 7d 01 00       	call   0x9305b0
  9187ea:	57                   	push   edi
  9187eb:	e8 30 88 ae ff       	call   0x401020
  9187f0:	83 c4 04             	add    esp,0x4
  9187f3:	5f                   	pop    edi
  9187f4:	32 c0                	xor    al,al
  9187f6:	5b                   	pop    ebx
  9187f7:	59                   	pop    ecx
  9187f8:	c2 08 00             	ret    0x8
  9187fb:	83 bb c0 01 00 00 00 	cmp    DWORD PTR [ebx+0x1c0],0x0
  918802:	75 5b                	jne    0x91885f
  918804:	83 c7 04             	add    edi,0x4
  918807:	8b cf                	mov    ecx,edi
  918809:	e8 32 a8 fc ff       	call   0x8e3040
  91880e:	83 f8 01             	cmp    eax,0x1
  918811:	7c 4c                	jl     0x91885f
  918813:	55                   	push   ebp
  918814:	56                   	push   esi
  918815:	8b cf                	mov    ecx,edi
  918817:	e8 24 a8 fc ff       	call   0x8e3040
  91881c:	8b f0                	mov    esi,eax
  91881e:	83 c6 01             	add    esi,0x1
  918821:	8d 2c 36             	lea    ebp,[esi+esi*1]
  918824:	55                   	push   ebp
  918825:	e8 d6 87 ae ff       	call   0x401000
  91882a:	83 c4 04             	add    esp,0x4
  91882d:	8b cf                	mov    ecx,edi
  91882f:	89 83 c0 01 00 00    	mov    DWORD PTR [ebx+0x1c0],eax
  918835:	e8 26 a8 fc ff       	call   0x8e3060
  91883a:	81 fe ff ff ff 7f    	cmp    esi,0x7fffffff
  918840:	77 0e                	ja     0x918850
  918842:	50                   	push   eax
  918843:	8b 83 c0 01 00 00    	mov    eax,DWORD PTR [ebx+0x1c0]
  918849:	56                   	push   esi
  91884a:	50                   	push   eax
  91884b:	e8 e0 66 c4 ff       	call   0x55ef30
  918850:	8b 8b c0 01 00 00    	mov    ecx,DWORD PTR [ebx+0x1c0]
  918856:	5e                   	pop    esi
  918857:	66 c7 44 29 fe 00 00 	mov    WORD PTR [ecx+ebp*1-0x2],0x0
  91885e:	5d                   	pop    ebp
  91885f:	5f                   	pop    edi
  918860:	b0 01                	mov    al,0x1
  918862:	5b                   	pop    ebx
  918863:	59                   	pop    ecx
  918864:	c2 08 00             	ret    0x8
