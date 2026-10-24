
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

004057a0 <.text+0x47a0>:
  4057a0:	8a 44 24 04          	mov    al,BYTE PTR [esp+0x4]
  4057a4:	81 ec 80 02 00 00    	sub    esp,0x280
  4057aa:	53                   	push   ebx
  4057ab:	55                   	push   ebp
  4057ac:	33 db                	xor    ebx,ebx
  4057ae:	56                   	push   esi
  4057af:	57                   	push   edi
  4057b0:	3a c3                	cmp    al,bl
  4057b2:	bf 01 00 00 00       	mov    edi,0x1
  4057b7:	0f 84 d2 01 00 00    	je     0x40598f
  4057bd:	8b 0d fc f9 41 00    	mov    ecx,DWORD PTR ds:0x41f9fc
  4057c3:	83 c8 ff             	or     eax,0xffffffff
  4057c6:	89 3d 10 f3 41 00    	mov    DWORD PTR ds:0x41f310,edi
  4057cc:	a3 80 f2 41 00       	mov    ds:0x41f280,eax
  4057d1:	8d 51 ff             	lea    edx,[ecx-0x1]
  4057d4:	8b ca                	mov    ecx,edx
  4057d6:	3b cb                	cmp    ecx,ebx
  4057d8:	7c 0a                	jl     0x4057e4
  4057da:	89 04 8d d0 f2 41 00 	mov    DWORD PTR [ecx*4+0x41f2d0],eax
  4057e1:	49                   	dec    ecx
  4057e2:	79 f6                	jns    0x4057da
  4057e4:	8b 0d 9c f2 41 00    	mov    ecx,DWORD PTR ds:0x41f29c
  4057ea:	a3 ac f2 41 00       	mov    ds:0x41f2ac,eax
  4057ef:	3b cf                	cmp    ecx,edi
  4057f1:	a3 2c f3 41 00       	mov    ds:0x41f32c,eax
  4057f6:	a3 a0 f2 41 00       	mov    ds:0x41f2a0,eax
  4057fb:	a3 90 f2 41 00       	mov    ds:0x41f290,eax
  405800:	a3 c8 f2 41 00       	mov    ds:0x41f2c8,eax
  405805:	a3 88 f2 41 00       	mov    ds:0x41f288,eax
  40580a:	a3 08 f3 41 00       	mov    ds:0x41f308,eax
  40580f:	a3 c0 f2 41 00       	mov    ds:0x41f2c0,eax
  405814:	a3 7c f2 41 00       	mov    ds:0x41f27c,eax
  405819:	a3 f0 f2 41 00       	mov    ds:0x41f2f0,eax
  40581e:	75 10                	jne    0x405830
  405820:	8b ca                	mov    ecx,edx
  405822:	3b cb                	cmp    ecx,ebx
  405824:	7c 0a                	jl     0x405830
  405826:	89 1c 8d 30 f3 41 00 	mov    DWORD PTR [ecx*4+0x41f330],ebx
  40582d:	49                   	dec    ecx
  40582e:	79 f6                	jns    0x405826
  405830:	8b 15 3c f3 41 00    	mov    edx,DWORD PTR ds:0x41f33c
  405836:	a3 e0 f2 41 00       	mov    ds:0x41f2e0,eax
  40583b:	a3 a8 f2 41 00       	mov    ds:0x41f2a8,eax
  405840:	a1 c4 f8 41 00       	mov    eax,ds:0x41f8c4
  405845:	66 8b c8             	mov    cx,ax
  405848:	52                   	push   edx
  405849:	51                   	push   ecx
  40584a:	8b 0d 7c f9 41 00    	mov    ecx,DWORD PTR ds:0x41f97c
  405850:	68 7f 02 00 00       	push   0x27f
  405855:	50                   	push   eax
  405856:	53                   	push   ebx
  405857:	89 1d 8c f2 41 00    	mov    DWORD PTR ds:0x41f28c,ebx
  40585d:	89 1d 00 f3 41 00    	mov    DWORD PTR ds:0x41f300,ebx
  405863:	89 1d f4 f2 41 00    	mov    DWORD PTR ds:0x41f2f4,ebx
  405869:	89 1d 84 f2 41 00    	mov    DWORD PTR ds:0x41f284,ebx
  40586f:	89 1d dc f2 41 00    	mov    DWORD PTR ds:0x41f2dc,ebx
  405875:	e8 16 08 01 00       	call   0x416090
  40587a:	8b 15 48 f3 41 00    	mov    edx,DWORD PTR ds:0x41f348
  405880:	a1 c4 f8 41 00       	mov    eax,ds:0x41f8c4
  405885:	68 ff 00 00 00       	push   0xff
  40588a:	6a 75                	push   0x75
  40588c:	6a 75                	push   0x75
  40588e:	57                   	push   edi
  40588f:	52                   	push   edx
  405890:	83 c0 0b             	add    eax,0xb
  405893:	68 d4 b3 41 00       	push   0x41b3d4
  405898:	50                   	push   eax
  405899:	6a 03                	push   0x3
  40589b:	e8 90 5b 00 00       	call   0x40b430
  4058a0:	8b 0d 48 f3 41 00    	mov    ecx,DWORD PTR ds:0x41f348
  4058a6:	8b 15 c4 f8 41 00    	mov    edx,DWORD PTR ds:0x41f8c4
  4058ac:	68 ff 00 00 00       	push   0xff
  4058b1:	6a 75                	push   0x75
  4058b3:	6a 75                	push   0x75
  4058b5:	8b f0                	mov    esi,eax
  4058b7:	57                   	push   edi
  4058b8:	51                   	push   ecx
  4058b9:	83 c2 0b             	add    edx,0xb
  4058bc:	83 c6 49             	add    esi,0x49
  4058bf:	68 cc b3 41 00       	push   0x41b3cc
  4058c4:	52                   	push   edx
  4058c5:	56                   	push   esi
  4058c6:	e8 65 5b 00 00       	call   0x40b430
  4058cb:	8b 0d c4 f8 41 00    	mov    ecx,DWORD PTR ds:0x41f8c4
  4058d1:	83 c4 40             	add    esp,0x40
  4058d4:	8d 74 06 46          	lea    esi,[esi+eax*1+0x46]
  4058d8:	a1 48 f3 41 00       	mov    eax,ds:0x41f348
  4058dd:	68 ff 00 00 00       	push   0xff
  4058e2:	6a 75                	push   0x75
  4058e4:	6a 75                	push   0x75
  4058e6:	57                   	push   edi
  4058e7:	50                   	push   eax
  4058e8:	83 c1 0b             	add    ecx,0xb
  4058eb:	68 c4 b3 41 00       	push   0x41b3c4
  4058f0:	51                   	push   ecx
  4058f1:	56                   	push   esi
  4058f2:	e8 39 5b 00 00       	call   0x40b430
  4058f7:	8b 15 48 f3 41 00    	mov    edx,DWORD PTR ds:0x41f348
  4058fd:	68 ff 00 00 00       	push   0xff
  405902:	8d 74 06 1e          	lea    esi,[esi+eax*1+0x1e]
  405906:	a1 c4 f8 41 00       	mov    eax,ds:0x41f8c4
  40590b:	6a 75                	push   0x75
  40590d:	6a 75                	push   0x75
  40590f:	57                   	push   edi
  405910:	52                   	push   edx
  405911:	83 c0 0b             	add    eax,0xb
  405914:	68 bc b3 41 00       	push   0x41b3bc
  405919:	50                   	push   eax
  40591a:	56                   	push   esi
  40591b:	e8 10 5b 00 00       	call   0x40b430
  405920:	8b 0d 48 f3 41 00    	mov    ecx,DWORD PTR ds:0x41f348
  405926:	8b 15 c4 f8 41 00    	mov    edx,DWORD PTR ds:0x41f8c4
  40592c:	83 c4 40             	add    esp,0x40
  40592f:	8d 44 06 1e          	lea    eax,[esi+eax*1+0x1e]
  405933:	83 c2 0b             	add    edx,0xb
  405936:	68 ff 00 00 00       	push   0xff
  40593b:	6a 75                	push   0x75
  40593d:	6a 75                	push   0x75
  40593f:	57                   	push   edi
  405940:	51                   	push   ecx
  405941:	68 b4 b3 41 00       	push   0x41b3b4
  405946:	52                   	push   edx
  405947:	50                   	push   eax
  405948:	e8 e3 5a 00 00       	call   0x40b430
  40594d:	a1 fc f9 41 00       	mov    eax,ds:0x41f9fc
  405952:	83 c4 20             	add    esp,0x20
  405955:	3b c7                	cmp    eax,edi
  405957:	7e 36                	jle    0x40598f
  405959:	a1 48 f3 41 00       	mov    eax,ds:0x41f348
  40595e:	8b 0d c4 f8 41 00    	mov    ecx,DWORD PTR ds:0x41f8c4
  405964:	68 ff 00 00 00       	push   0xff
  405969:	6a 75                	push   0x75
  40596b:	6a 75                	push   0x75
  40596d:	57                   	push   edi
  40596e:	50                   	push   eax
  40596f:	83 c1 0b             	add    ecx,0xb
  405972:	68 ac b3 41 00       	push   0x41b3ac
  405977:	51                   	push   ecx
  405978:	68 12 02 00 00       	push   0x212
  40597d:	e8 ae 5a 00 00       	call   0x40b430
  405982:	83 c4 20             	add    esp,0x20
  405985:	05 16 02 00 00       	add    eax,0x216
  40598a:	a3 fc f2 41 00       	mov    ds:0x41f2fc,eax
