
/home/user/wine-assembly-aoe3-unsupported-dialog-diagnosis-oct22/scratch/runs/20261022-aoe3-unsupported-dialog-diagnosis/original/age3.exe:     file format pei-i386


Disassembly of section .text:

004888e0 <.text+0x878e0>:
  4888e0:	81 ec 28 01 00 00    	sub    esp,0x128
  4888e6:	a1 48 15 c3 00       	mov    eax,ds:0xc31548
  4888eb:	56                   	push   esi
  4888ec:	8b b4 24 30 01 00 00 	mov    esi,DWORD PTR [esp+0x130]
  4888f3:	c6 06 00             	mov    BYTE PTR [esi],0x0
  4888f6:	83 c6 04             	add    esi,0x4
  4888f9:	8b ce                	mov    ecx,esi
  4888fb:	89 84 24 28 01 00 00 	mov    DWORD PTR [esp+0x128],eax
  488902:	e8 d9 a6 45 00       	call   0x8e2fe0
  488907:	a1 ac 3e c1 00       	mov    eax,ds:0xc13eac
  48890c:	8b 00                	mov    eax,DWORD PTR [eax]
  48890e:	85 c0                	test   eax,eax
  488910:	7c 5b                	jl     0x48896d
  488912:	3b 05 14 28 ce 00    	cmp    eax,DWORD PTR ds:0xce2814
  488918:	7d 53                	jge    0x48896d
  48891a:	80 3d 28 28 ce 00 00 	cmp    BYTE PTR ds:0xce2828,0x0
  488921:	74 4a                	je     0x48896d
  488923:	8b 0d 10 28 ce 00    	mov    ecx,DWORD PTR ds:0xce2810
  488929:	8b 14 81             	mov    edx,DWORD PTR [ecx+eax*4]
  48892c:	8b 82 4c 01 00 00    	mov    eax,DWORD PTR [edx+0x14c]
  488932:	83 f8 ff             	cmp    eax,0xffffffff
  488935:	74 36                	je     0x48896d
  488937:	8b 0d fc 27 ce 00    	mov    ecx,DWORD PTR ds:0xce27fc
  48893d:	8d 04 80             	lea    eax,[eax+eax*4]
  488940:	8d 04 c1             	lea    eax,[ecx+eax*8]
  488943:	85 c0                	test   eax,eax
  488945:	74 26                	je     0x48896d
  488947:	f6 40 18 08          	test   BYTE PTR [eax+0x18],0x8
  48894b:	0f 9f c0             	setg   al
  48894e:	84 c0                	test   al,al
  488950:	0f 94 c0             	sete   al
  488953:	84 c0                	test   al,al
  488955:	74 16                	je     0x48896d
  488957:	b0 01                	mov    al,0x1
  488959:	5e                   	pop    esi
  48895a:	8b 8c 24 24 01 00 00 	mov    ecx,DWORD PTR [esp+0x124]
  488961:	e8 2e 89 42 00       	call   0x8b1294
  488966:	81 c4 28 01 00 00    	add    esp,0x128
  48896c:	c3                   	ret
  48896d:	53                   	push   ebx
  48896e:	68 cc 2f b5 00       	push   0xb52fcc
  488973:	b3 01                	mov    bl,0x1
  488975:	ff 15 50 03 b3 00    	call   DWORD PTR ds:0xb30350
  48897b:	83 f8 20             	cmp    eax,0x20
  48897e:	89 44 24 10          	mov    DWORD PTR [esp+0x10],eax
  488982:	73 3a                	jae    0x4889be
  488984:	6a ff                	push   0xffffffff
  488986:	6a ff                	push   0xffffffff
  488988:	68 a0 a2 00 00       	push   0xa2a0
  48898d:	8d 4c 24 18          	lea    ecx,[esp+0x18]
  488991:	e8 ea c2 45 00       	call   0x8e4c80
  488996:	50                   	push   eax
  488997:	8b ce                	mov    ecx,esi
  488999:	e8 72 bd 45 00       	call   0x8e4710
  48899e:	8d 4c 24 0c          	lea    ecx,[esp+0xc]
  4889a2:	e8 c9 ab 45 00       	call   0x8e3570
  4889a7:	5b                   	pop    ebx
  4889a8:	32 c0                	xor    al,al
  4889aa:	5e                   	pop    esi
  4889ab:	8b 8c 24 24 01 00 00 	mov    ecx,DWORD PTR [esp+0x124]
  4889b2:	e8 dd 88 42 00       	call   0x8b1294
  4889b7:	81 c4 28 01 00 00    	add    esp,0x128
  4889bd:	c3                   	ret
  4889be:	55                   	push   ebp
  4889bf:	57                   	push   edi
  4889c0:	8b 3d 54 03 b3 00    	mov    edi,DWORD PTR ds:0xb30354
  4889c6:	68 b4 2f b5 00       	push   0xb52fb4
  4889cb:	50                   	push   eax
  4889cc:	ff d7                	call   edi
  4889ce:	8b e8                	mov    ebp,eax
  4889d0:	85 ed                	test   ebp,ebp
  4889d2:	75 47                	jne    0x488a1b
  4889d4:	6a ff                	push   0xffffffff
  4889d6:	6a ff                	push   0xffffffff
  4889d8:	68 a0 a2 00 00       	push   0xa2a0
  4889dd:	8d 4c 24 20          	lea    ecx,[esp+0x20]
  4889e1:	e8 9a c2 45 00       	call   0x8e4c80
  4889e6:	50                   	push   eax
  4889e7:	8b ce                	mov    ecx,esi
  4889e9:	e8 22 bd 45 00       	call   0x8e4710
  4889ee:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  4889f2:	e8 79 ab 45 00       	call   0x8e3570
  4889f7:	8b 54 24 18          	mov    edx,DWORD PTR [esp+0x18]
  4889fb:	52                   	push   edx
  4889fc:	ff 15 58 03 b3 00    	call   DWORD PTR ds:0xb30358
  488a02:	5f                   	pop    edi
  488a03:	5d                   	pop    ebp
  488a04:	5b                   	pop    ebx
  488a05:	32 c0                	xor    al,al
  488a07:	5e                   	pop    esi
  488a08:	8b 8c 24 24 01 00 00 	mov    ecx,DWORD PTR [esp+0x124]
  488a0f:	e8 80 88 42 00       	call   0x8b1294
  488a14:	81 c4 28 01 00 00    	add    esp,0x128
  488a1a:	c3                   	ret
  488a1b:	8b 44 24 18          	mov    eax,DWORD PTR [esp+0x18]
  488a1f:	68 98 2f b5 00       	push   0xb52f98
  488a24:	50                   	push   eax
  488a25:	ff d7                	call   edi
  488a27:	85 c0                	test   eax,eax
  488a29:	89 44 24 1c          	mov    DWORD PTR [esp+0x1c],eax
  488a2d:	75 47                	jne    0x488a76
  488a2f:	6a ff                	push   0xffffffff
  488a31:	6a ff                	push   0xffffffff
  488a33:	68 a0 a2 00 00       	push   0xa2a0
  488a38:	8d 4c 24 20          	lea    ecx,[esp+0x20]
  488a3c:	e8 3f c2 45 00       	call   0x8e4c80
  488a41:	50                   	push   eax
  488a42:	8b ce                	mov    ecx,esi
  488a44:	e8 c7 bc 45 00       	call   0x8e4710
  488a49:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  488a4d:	e8 1e ab 45 00       	call   0x8e3570
  488a52:	8b 4c 24 18          	mov    ecx,DWORD PTR [esp+0x18]
  488a56:	51                   	push   ecx
  488a57:	ff 15 58 03 b3 00    	call   DWORD PTR ds:0xb30358
  488a5d:	5f                   	pop    edi
  488a5e:	5d                   	pop    ebp
  488a5f:	5b                   	pop    ebx
  488a60:	32 c0                	xor    al,al
  488a62:	5e                   	pop    esi
  488a63:	8b 8c 24 24 01 00 00 	mov    ecx,DWORD PTR [esp+0x124]
  488a6a:	e8 25 88 42 00       	call   0x8b1294
  488a6f:	81 c4 28 01 00 00    	add    esp,0x128
  488a75:	c3                   	ret
  488a76:	8b 54 24 18          	mov    edx,DWORD PTR [esp+0x18]
  488a7a:	68 88 2f b5 00       	push   0xb52f88
  488a7f:	52                   	push   edx
  488a80:	ff d7                	call   edi
  488a82:	85 c0                	test   eax,eax
  488a84:	89 44 24 14          	mov    DWORD PTR [esp+0x14],eax
  488a88:	74 29                	je     0x488ab3
  488a8a:	8b 4c 24 18          	mov    ecx,DWORD PTR [esp+0x18]
  488a8e:	68 74 2f b5 00       	push   0xb52f74
  488a93:	51                   	push   ecx
  488a94:	ff d7                	call   edi
  488a96:	68 70 72 48 00       	push   0x487270
  488a9b:	8d 54 24 24          	lea    edx,[esp+0x24]
  488a9f:	52                   	push   edx
  488aa0:	8b f8                	mov    edi,eax
  488aa2:	c7 44 24 28 00 00 00 	mov    DWORD PTR [esp+0x28],0x0
  488aa9:	00 
  488aaa:	ff d5                	call   ebp
  488aac:	83 7c 24 20 00       	cmp    DWORD PTR [esp+0x20],0x0
  488ab1:	75 47                	jne    0x488afa
  488ab3:	6a ff                	push   0xffffffff
  488ab5:	6a ff                	push   0xffffffff
  488ab7:	68 a0 a2 00 00       	push   0xa2a0
  488abc:	8d 4c 24 20          	lea    ecx,[esp+0x20]
  488ac0:	e8 bb c1 45 00       	call   0x8e4c80
  488ac5:	50                   	push   eax
  488ac6:	8b ce                	mov    ecx,esi
  488ac8:	e8 43 bc 45 00       	call   0x8e4710
  488acd:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  488ad1:	e8 9a aa 45 00       	call   0x8e3570
  488ad6:	8b 44 24 18          	mov    eax,DWORD PTR [esp+0x18]
  488ada:	50                   	push   eax
  488adb:	ff 15 58 03 b3 00    	call   DWORD PTR ds:0xb30358
  488ae1:	5f                   	pop    edi
  488ae2:	5d                   	pop    ebp
  488ae3:	5b                   	pop    ebx
  488ae4:	32 c0                	xor    al,al
  488ae6:	5e                   	pop    esi
  488ae7:	8b 8c 24 24 01 00 00 	mov    ecx,DWORD PTR [esp+0x124]
  488aee:	e8 a1 87 42 00       	call   0x8b1294
  488af3:	81 c4 28 01 00 00    	add    esp,0x128
  488af9:	c3                   	ret
  488afa:	8d 4c 24 30          	lea    ecx,[esp+0x30]
  488afe:	51                   	push   ecx
  488aff:	6a 00                	push   0x0
  488b01:	ff 54 24 24          	call   DWORD PTR [esp+0x24]
  488b05:	85 c0                	test   eax,eax
  488b07:	75 4b                	jne    0x488b54
  488b09:	6a ff                	push   0xffffffff
  488b0b:	6a ff                	push   0xffffffff
  488b0d:	68 a0 a2 00 00       	push   0xa2a0
  488b12:	8d 4c 24 28          	lea    ecx,[esp+0x28]
  488b16:	e8 65 c1 45 00       	call   0x8e4c80
  488b1b:	50                   	push   eax
  488b1c:	8b ce                	mov    ecx,esi
  488b1e:	e8 ed bb 45 00       	call   0x8e4710
  488b23:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  488b27:	e8 44 aa 45 00       	call   0x8e3570
  488b2c:	ff 54 24 14          	call   DWORD PTR [esp+0x14]
  488b30:	8b 54 24 18          	mov    edx,DWORD PTR [esp+0x18]
  488b34:	52                   	push   edx
  488b35:	ff 15 58 03 b3 00    	call   DWORD PTR ds:0xb30358
  488b3b:	5f                   	pop    edi
  488b3c:	5d                   	pop    ebp
  488b3d:	5b                   	pop    ebx
  488b3e:	32 c0                	xor    al,al
  488b40:	5e                   	pop    esi
  488b41:	8b 8c 24 24 01 00 00 	mov    ecx,DWORD PTR [esp+0x124]
  488b48:	e8 47 87 42 00       	call   0x8b1294
  488b4d:	81 c4 28 01 00 00    	add    esp,0x128
  488b53:	c3                   	ret
  488b54:	8b 44 24 20          	mov    eax,DWORD PTR [esp+0x20]
  488b58:	8b 88 e0 00 00 00    	mov    ecx,DWORD PTR [eax+0xe0]
  488b5e:	8b ac 24 3c 01 00 00 	mov    ebp,DWORD PTR [esp+0x13c]
  488b65:	89 4d 08             	mov    DWORD PTR [ebp+0x8],ecx
  488b68:	8b 90 dc 00 00 00    	mov    edx,DWORD PTR [eax+0xdc]
  488b6e:	89 55 0c             	mov    DWORD PTR [ebp+0xc],edx
  488b71:	8b 80 e4 00 00 00    	mov    eax,DWORD PTR [eax+0xe4]
  488b77:	c1 e8 14             	shr    eax,0x14
  488b7a:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  488b7e:	89 45 10             	mov    DWORD PTR [ebp+0x10],eax
  488b81:	e8 4a a4 45 00       	call   0x8e2fd0
  488b86:	e8 45 e8 ff ff       	call   0x4873d0
  488b8b:	84 c0                	test   al,al
  488b8d:	75 34                	jne    0x488bc3
  488b8f:	68 b8 a5 00 00       	push   0xa5b8
  488b94:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  488b98:	c6 45 00 01          	mov    BYTE PTR [ebp+0x0],0x1
  488b9c:	e8 4f ba 45 00       	call   0x8e45f0
  488ba1:	6a ff                	push   0xffffffff
  488ba3:	6a ff                	push   0xffffffff
  488ba5:	8d 4c 24 18          	lea    ecx,[esp+0x18]
  488ba9:	51                   	push   ecx
  488baa:	8b ce                	mov    ecx,esi
  488bac:	e8 5f bb 45 00       	call   0x8e4710
  488bb1:	6a ff                	push   0xffffffff
  488bb3:	6a ff                	push   0xffffffff
  488bb5:	68 68 2f b5 00       	push   0xb52f68
  488bba:	8b ce                	mov    ecx,esi
  488bbc:	e8 df aa 45 00       	call   0x8e36a0
  488bc1:	32 db                	xor    bl,bl
  488bc3:	ff d7                	call   edi
  488bc5:	85 c0                	test   eax,eax
  488bc7:	0f 85 d1 01 00 00    	jne    0x488d9e
  488bcd:	bf 30 21 c4 00       	mov    edi,0xc42130
  488bd2:	8b 07                	mov    eax,DWORD PTR [edi]
  488bd4:	85 c0                	test   eax,eax
  488bd6:	0f 84 c2 01 00 00    	je     0x488d9e
  488bdc:	3d 01 03 00 00       	cmp    eax,0x301
  488be1:	0f 8f 13 01 00 00    	jg     0x488cfa
  488be7:	0f 84 b4 00 00 00    	je     0x488ca1
  488bed:	2d 01 01 00 00       	sub    eax,0x101
  488bf2:	0f 84 9f 00 00 00    	je     0x488c97
  488bf8:	83 e8 02             	sub    eax,0x2
  488bfb:	74 3e                	je     0x488c3b
  488bfd:	83 e8 03             	sub    eax,0x3
  488c00:	0f 85 89 01 00 00    	jne    0x488d8f
  488c06:	68 92 a2 00 00       	push   0xa292
  488c0b:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  488c0f:	e8 dc b9 45 00       	call   0x8e45f0
  488c14:	6a ff                	push   0xffffffff
  488c16:	6a ff                	push   0xffffffff
  488c18:	8d 54 24 18          	lea    edx,[esp+0x18]
  488c1c:	52                   	push   edx
  488c1d:	8b ce                	mov    ecx,esi
  488c1f:	e8 ec ba 45 00       	call   0x8e4710
  488c24:	6a ff                	push   0xffffffff
  488c26:	6a ff                	push   0xffffffff
  488c28:	68 68 2f b5 00       	push   0xb52f68
  488c2d:	8b ce                	mov    ecx,esi
  488c2f:	e8 6c aa 45 00       	call   0x8e36a0
  488c34:	32 db                	xor    bl,bl
  488c36:	e9 54 01 00 00       	jmp    0x488d8f
  488c3b:	68 43 a2 00 00       	push   0xa243
  488c40:	8d 4c 24 2c          	lea    ecx,[esp+0x2c]
  488c44:	e8 37 c0 45 00       	call   0x8e4c80
  488c49:	8d 4c 24 28          	lea    ecx,[esp+0x28]
  488c4d:	e8 0e a4 45 00       	call   0x8e3060
  488c52:	8b 4c 24 20          	mov    ecx,DWORD PTR [esp+0x20]
  488c56:	8b 91 e4 00 00 00    	mov    edx,DWORD PTR [ecx+0xe4]
  488c5c:	c1 ea 14             	shr    edx,0x14
  488c5f:	52                   	push   edx
  488c60:	50                   	push   eax
  488c61:	8d 44 24 18          	lea    eax,[esp+0x18]
  488c65:	50                   	push   eax
  488c66:	e8 75 bd 45 00       	call   0x8e49e0
  488c6b:	83 c4 0c             	add    esp,0xc
  488c6e:	6a ff                	push   0xffffffff
  488c70:	6a ff                	push   0xffffffff
  488c72:	8d 4c 24 18          	lea    ecx,[esp+0x18]
  488c76:	51                   	push   ecx
  488c77:	8b ce                	mov    ecx,esi
  488c79:	e8 92 ba 45 00       	call   0x8e4710
  488c7e:	6a ff                	push   0xffffffff
  488c80:	6a ff                	push   0xffffffff
  488c82:	68 68 2f b5 00       	push   0xb52f68
  488c87:	8b ce                	mov    ecx,esi
  488c89:	e8 12 aa 45 00       	call   0x8e36a0
  488c8e:	8d 4c 24 28          	lea    ecx,[esp+0x28]
  488c92:	e9 f1 00 00 00       	jmp    0x488d88
  488c97:	68 93 a2 00 00       	push   0xa293
  488c9c:	e9 6a ff ff ff       	jmp    0x488c0b
  488ca1:	68 3a 58 00 00       	push   0x583a
  488ca6:	8d 4c 24 28          	lea    ecx,[esp+0x28]
  488caa:	e8 d1 bf 45 00       	call   0x8e4c80
  488caf:	8d 4c 24 24          	lea    ecx,[esp+0x24]
  488cb3:	e8 a8 a3 45 00       	call   0x8e3060
  488cb8:	8b 4c 24 20          	mov    ecx,DWORD PTR [esp+0x20]
  488cbc:	8b 91 dc 00 00 00    	mov    edx,DWORD PTR [ecx+0xdc]
  488cc2:	52                   	push   edx
  488cc3:	50                   	push   eax
  488cc4:	8d 44 24 18          	lea    eax,[esp+0x18]
  488cc8:	50                   	push   eax
  488cc9:	e8 12 bd 45 00       	call   0x8e49e0
  488cce:	83 c4 0c             	add    esp,0xc
  488cd1:	6a ff                	push   0xffffffff
  488cd3:	6a ff                	push   0xffffffff
  488cd5:	8d 4c 24 18          	lea    ecx,[esp+0x18]
  488cd9:	51                   	push   ecx
  488cda:	8b ce                	mov    ecx,esi
  488cdc:	e8 2f ba 45 00       	call   0x8e4710
  488ce1:	6a ff                	push   0xffffffff
  488ce3:	6a ff                	push   0xffffffff
  488ce5:	68 68 2f b5 00       	push   0xb52f68
  488cea:	8b ce                	mov    ecx,esi
  488cec:	e8 af a9 45 00       	call   0x8e36a0
  488cf1:	8d 4c 24 24          	lea    ecx,[esp+0x24]
  488cf5:	e9 8e 00 00 00       	jmp    0x488d88
  488cfa:	3d 01 04 00 00       	cmp    eax,0x401
  488cff:	74 15                	je     0x488d16
  488d01:	3d 01 05 00 00       	cmp    eax,0x501
  488d06:	0f 85 83 00 00 00    	jne    0x488d8f
  488d0c:	68 6c 46 00 00       	push   0x466c
  488d11:	e9 f5 fe ff ff       	jmp    0x488c0b
  488d16:	68 3f a2 00 00       	push   0xa23f
  488d1b:	8d 4c 24 20          	lea    ecx,[esp+0x20]
  488d1f:	e8 5c bf 45 00       	call   0x8e4c80
  488d24:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  488d28:	e8 33 a3 45 00       	call   0x8e3060
  488d2d:	8b 4c 24 20          	mov    ecx,DWORD PTR [esp+0x20]
  488d31:	8b 89 e0 00 00 00    	mov    ecx,DWORD PTR [ecx+0xe0]
  488d37:	85 c9                	test   ecx,ecx
  488d39:	89 4c 24 2c          	mov    DWORD PTR [esp+0x2c],ecx
  488d3d:	db 44 24 2c          	fild   DWORD PTR [esp+0x2c]
  488d41:	7d 06                	jge    0x488d49
  488d43:	d8 05 30 81 b3 00    	fadd   DWORD PTR ds:0xb38130
  488d49:	d8 0d 58 8a b3 00    	fmul   DWORD PTR ds:0xb38a58
  488d4f:	83 ec 08             	sub    esp,0x8
  488d52:	8d 54 24 18          	lea    edx,[esp+0x18]
  488d56:	dd 1c 24             	fstp   QWORD PTR [esp]
  488d59:	51                   	push   ecx
  488d5a:	50                   	push   eax
  488d5b:	52                   	push   edx
  488d5c:	e8 7f bc 45 00       	call   0x8e49e0
  488d61:	83 c4 14             	add    esp,0x14
  488d64:	6a ff                	push   0xffffffff
  488d66:	6a ff                	push   0xffffffff
  488d68:	8d 44 24 18          	lea    eax,[esp+0x18]
  488d6c:	50                   	push   eax
  488d6d:	8b ce                	mov    ecx,esi
  488d6f:	e8 9c b9 45 00       	call   0x8e4710
  488d74:	6a ff                	push   0xffffffff
  488d76:	6a ff                	push   0xffffffff
  488d78:	68 68 2f b5 00       	push   0xb52f68
  488d7d:	8b ce                	mov    ecx,esi
  488d7f:	e8 1c a9 45 00       	call   0x8e36a0
  488d84:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  488d88:	32 db                	xor    bl,bl
  488d8a:	e8 e1 a7 45 00       	call   0x8e3570
  488d8f:	83 c7 04             	add    edi,0x4
  488d92:	81 ff 58 21 c4 00    	cmp    edi,0xc42158
  488d98:	0f 8c 34 fe ff ff    	jl     0x488bd2
  488d9e:	84 db                	test   bl,bl
  488da0:	75 6f                	jne    0x488e11
  488da2:	68 a1 a2 00 00       	push   0xa2a1
  488da7:	8d 4c 24 20          	lea    ecx,[esp+0x20]
  488dab:	e8 d0 be 45 00       	call   0x8e4c80
  488db0:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  488db4:	e8 a7 a2 45 00       	call   0x8e3060
  488db9:	8b 4c 24 20          	mov    ecx,DWORD PTR [esp+0x20]
  488dbd:	8b 91 cc 00 00 00    	mov    edx,DWORD PTR [ecx+0xcc]
  488dc3:	52                   	push   edx
  488dc4:	8b 91 d0 00 00 00    	mov    edx,DWORD PTR [ecx+0xd0]
  488dca:	52                   	push   edx
  488dcb:	8b 91 c8 00 00 00    	mov    edx,DWORD PTR [ecx+0xc8]
  488dd1:	52                   	push   edx
  488dd2:	8b 91 e4 00 00 00    	mov    edx,DWORD PTR [ecx+0xe4]
  488dd8:	c1 ea 14             	shr    edx,0x14
  488ddb:	52                   	push   edx
  488ddc:	8b 91 dc 00 00 00    	mov    edx,DWORD PTR [ecx+0xdc]
  488de2:	8b 89 e0 00 00 00    	mov    ecx,DWORD PTR [ecx+0xe0]
  488de8:	52                   	push   edx
  488de9:	51                   	push   ecx
  488dea:	50                   	push   eax
  488deb:	8d 54 24 2c          	lea    edx,[esp+0x2c]
  488def:	52                   	push   edx
  488df0:	e8 eb bb 45 00       	call   0x8e49e0
  488df5:	83 c4 20             	add    esp,0x20
  488df8:	6a ff                	push   0xffffffff
  488dfa:	6a ff                	push   0xffffffff
  488dfc:	8d 44 24 18          	lea    eax,[esp+0x18]
  488e00:	50                   	push   eax
  488e01:	8b ce                	mov    ecx,esi
  488e03:	e8 08 b9 45 00       	call   0x8e4710
  488e08:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  488e0c:	e8 5f a7 45 00       	call   0x8e3570
  488e11:	ff 54 24 14          	call   DWORD PTR [esp+0x14]
  488e15:	8b 4c 24 18          	mov    ecx,DWORD PTR [esp+0x18]
  488e19:	51                   	push   ecx
  488e1a:	ff 15 58 03 b3 00    	call   DWORD PTR ds:0xb30358
  488e20:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  488e24:	e8 47 a7 45 00       	call   0x8e3570
  488e29:	8b 8c 24 34 01 00 00 	mov    ecx,DWORD PTR [esp+0x134]
  488e30:	5f                   	pop    edi
  488e31:	5d                   	pop    ebp
  488e32:	8a c3                	mov    al,bl
  488e34:	5b                   	pop    ebx
  488e35:	5e                   	pop    esi
  488e36:	e8 59 84 42 00       	call   0x8b1294
  488e3b:	81 c4 28 01 00 00    	add    esp,0x128
  488e41:	c3                   	ret
  488e42:	cc                   	int3
  488e43:	cc                   	int3
  488e44:	cc                   	int3
  488e45:	cc                   	int3
  488e46:	cc                   	int3
  488e47:	cc                   	int3
  488e48:	cc                   	int3
  488e49:	cc                   	int3
  488e4a:	cc                   	int3
  488e4b:	cc                   	int3
  488e4c:	cc                   	int3
  488e4d:	cc                   	int3
  488e4e:	cc                   	int3
  488e4f:	cc                   	int3
  488e50:	68 9c 31 c4 00       	push   0xc4319c
  488e55:	e8 86 fa ff ff       	call   0x4888e0
  488e5a:	83 c4 04             	add    esp,0x4
  488e5d:	84 c0                	test   al,al
  488e5f:	74 03                	je     0x488e64
  488e61:	b0 01                	mov    al,0x1
  488e63:	c3                   	ret
  488e64:	33 c0                	xor    eax,eax
  488e66:	a3 7c 76 ce 00       	mov    ds:0xce767c,eax
  488e6b:	a2 90 96 ce 00       	mov    ds:0xce9690,al
  488e70:	a1 a0 31 c4 00       	mov    eax,ds:0xc431a0
  488e75:	50                   	push   eax
  488e76:	68 fc 2f b5 00       	push   0xb52ffc
  488e7b:	68 78 28 ce 00       	push   0xce2878
  488e80:	c7 05 84 96 ce 00 f0 	mov    DWORD PTR ds:0xce9684,0xb52ff0
  488e87:	2f b5 00 
  488e8a:	c7 05 88 96 ce 00 7c 	mov    DWORD PTR ds:0xce9688,0x97c
  488e91:	09 00 00 
  488e94:	e8 37 cf 45 00       	call   0x8e5dd0
  488e99:	83 c4 0c             	add    esp,0xc
  488e9c:	e8 2f e3 ff ff       	call   0x4871d0
  488ea1:	84 c0                	test   al,al
  488ea3:	75 bc                	jne    0x488e61
  488ea5:	8b 0d 84 31 c4 00    	mov    ecx,DWORD PTR ds:0xc43184
  488eab:	8b 15 78 31 c4 00    	mov    edx,DWORD PTR ds:0xc43178
  488eb1:	68 9c 31 c4 00       	push   0xc4319c
  488eb6:	68 30 6e 48 00       	push   0x486e30
  488ebb:	51                   	push   ecx
  488ebc:	68 b1 00 00 00       	push   0xb1
  488ec1:	52                   	push   edx
  488ec2:	ff 15 fc 05 b3 00    	call   DWORD PTR ds:0xb305fc
  488ec8:	3d 08 04 00 00       	cmp    eax,0x408
  488ecd:	0f 94 c0             	sete   al
  488ed0:	c3                   	ret
