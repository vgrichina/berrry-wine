
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

00401d4c <.text+0xd4c>:
  401d4c:	8b 15 e0 f4 41 00    	mov    edx,DWORD PTR ds:0x41f4e0
  401d52:	8d 72 ff             	lea    esi,[edx-0x1]
  401d55:	85 f6                	test   esi,esi
  401d57:	7c 0f                	jl     0x401d68
  401d59:	8b 0c b5 78 0a 42 00 	mov    ecx,DWORD PTR [esi*4+0x420a78]
  401d60:	8b 01                	mov    eax,DWORD PTR [ecx]
  401d62:	ff 50 50             	call   DWORD PTR [eax+0x50]
  401d65:	4e                   	dec    esi
  401d66:	79 f1                	jns    0x401d59
  401d68:	8b 0d fc f9 41 00    	mov    ecx,DWORD PTR ds:0x41f9fc
  401d6e:	8d 71 ff             	lea    esi,[ecx-0x1]
  401d71:	85 f6                	test   esi,esi
  401d73:	7c 0f                	jl     0x401d84
  401d75:	8b 0c b5 0c 0c 42 00 	mov    ecx,DWORD PTR [esi*4+0x420c0c]
  401d7c:	8b 11                	mov    edx,DWORD PTR [ecx]
  401d7e:	ff 52 50             	call   DWORD PTR [edx+0x50]
  401d81:	4e                   	dec    esi
  401d82:	79 f1                	jns    0x401d75
  401d84:	8b 0d 7c f9 41 00    	mov    ecx,DWORD PTR ds:0x41f97c
  401d8a:	6a 00                	push   0x0
  401d8c:	e8 8f 40 01 00       	call   0x415e20
  401d91:	a1 fc f9 41 00       	mov    eax,ds:0x41f9fc
  401d96:	33 f6                	xor    esi,esi
  401d98:	33 ff                	xor    edi,edi
  401d9a:	85 c0                	test   eax,eax
  401d9c:	7e 1b                	jle    0x401db9
  401d9e:	8b 0c b5 0c 0c 42 00 	mov    ecx,DWORD PTR [esi*4+0x420c0c]
  401da5:	8b 01                	mov    eax,DWORD PTR [ecx]
  401da7:	ff 50 74             	call   DWORD PTR [eax+0x74]
  401daa:	85 c0                	test   eax,eax
  401dac:	74 01                	je     0x401daf
  401dae:	47                   	inc    edi
  401daf:	a1 fc f9 41 00       	mov    eax,ds:0x41f9fc
  401db4:	46                   	inc    esi
  401db5:	3b f0                	cmp    esi,eax
  401db7:	7c e5                	jl     0x401d9e
  401db9:	83 f8 01             	cmp    eax,0x1
  401dbc:	7e 26                	jle    0x401de4
  401dbe:	8d 70 ff             	lea    esi,[eax-0x1]
  401dc1:	85 f6                	test   esi,esi
  401dc3:	7c 12                	jl     0x401dd7
  401dc5:	8b 0c b5 0c 0c 42 00 	mov    ecx,DWORD PTR [esi*4+0x420c0c]
  401dcc:	8b 11                	mov    edx,DWORD PTR [ecx]
  401dce:	ff 92 b4 00 00 00    	call   DWORD PTR [edx+0xb4]
  401dd4:	4e                   	dec    esi
  401dd5:	79 ee                	jns    0x401dc5
  401dd7:	8b 0d 7c f9 41 00    	mov    ecx,DWORD PTR ds:0x41f97c
  401ddd:	6a 00                	push   0x0
  401ddf:	e8 3c 40 01 00       	call   0x415e20
  401de4:	8b 0d 7c f9 41 00    	mov    ecx,DWORD PTR ds:0x41f97c
  401dea:	6a 00                	push   0x0
  401dec:	e8 2f 40 01 00       	call   0x415e20
  401df1:	a1 90 f9 41 00       	mov    eax,ds:0x41f990
  401df6:	85 c0                	test   eax,eax
  401df8:	75 5e                	jne    0x401e58
  401dfa:	e8 2d 16 01 00       	call   0x41342c
  401dff:	8d 04 40             	lea    eax,[eax+eax*2]
  401e02:	8b 35 24 f7 41 00    	mov    esi,DWORD PTR ds:0x41f724
  401e08:	8d 0c 80             	lea    ecx,[eax+eax*4]
  401e0b:	b8 d3 4d 62 10       	mov    eax,0x10624dd3
  401e10:	c1 e1 02             	shl    ecx,0x2
  401e13:	f7 e1                	mul    ecx
  401e15:	c1 ea 06             	shr    edx,0x6
  401e18:	8b c2                	mov    eax,edx
  401e1a:	2b c6                	sub    eax,esi
  401e1c:	83 f8 02             	cmp    eax,0x2
  401e1f:	73 31                	jae    0x401e52
  401e21:	6a 01                	push   0x1
  401e23:	e8 f8 15 01 00       	call   0x413420
  401e28:	83 c4 04             	add    esp,0x4
  401e2b:	e8 fc 15 01 00       	call   0x41342c
  401e30:	8d 04 40             	lea    eax,[eax+eax*2]
  401e33:	8b 35 24 f7 41 00    	mov    esi,DWORD PTR ds:0x41f724
  401e39:	8d 0c 80             	lea    ecx,[eax+eax*4]
  401e3c:	b8 d3 4d 62 10       	mov    eax,0x10624dd3
  401e41:	c1 e1 02             	shl    ecx,0x2
  401e44:	f7 e1                	mul    ecx
  401e46:	c1 ea 06             	shr    edx,0x6
  401e49:	8b c2                	mov    eax,edx
  401e4b:	2b c6                	sub    eax,esi
  401e4d:	83 f8 02             	cmp    eax,0x2
  401e50:	72 cf                	jb     0x401e21
  401e52:	89 15 24 f7 41 00    	mov    DWORD PTR ds:0x41f724,edx
  401e58:	8b c7                	mov    eax,edi
  401e5a:	5f                   	pop    edi
  401e5b:	5b                   	pop    ebx
  401e5c:	5e                   	pop    esi
  401e5d:	c3                   	ret
