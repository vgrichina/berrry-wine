
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

00415e20 <.text+0x14e20>:
  415e20:	56                   	push   esi
  415e21:	57                   	push   edi
  415e22:	8b f1                	mov    esi,ecx
  415e24:	e8 77 ff ff ff       	call   0x415da0
  415e29:	8b 06                	mov    eax,DWORD PTR [esi]
  415e2b:	8b 4e 08             	mov    ecx,DWORD PTR [esi+0x8]
  415e2e:	3b c1                	cmp    eax,ecx
  415e30:	75 4e                	jne    0x415e80
  415e32:	8b 4c 24 0c          	mov    ecx,DWORD PTR [esp+0xc]
  415e36:	85 c9                	test   ecx,ecx
  415e38:	74 46                	je     0x415e80
  415e3a:	8b 86 28 08 00 00    	mov    eax,DWORD PTR [esi+0x828]
  415e40:	33 ff                	xor    edi,edi
  415e42:	85 c0                	test   eax,eax
  415e44:	7e 26                	jle    0x415e6c
  415e46:	8b 86 30 08 00 00    	mov    eax,DWORD PTR [esi+0x830]
  415e4c:	8b 4e 04             	mov    ecx,DWORD PTR [esi+0x4]
  415e4f:	8b 56 08             	mov    edx,DWORD PTR [esi+0x8]
  415e52:	8d 04 f8             	lea    eax,[eax+edi*8]
  415e55:	50                   	push   eax
  415e56:	51                   	push   ecx
  415e57:	50                   	push   eax
  415e58:	52                   	push   edx
  415e59:	e8 fa 17 00 00       	call   0x417658
  415e5e:	8b 86 28 08 00 00    	mov    eax,DWORD PTR [esi+0x828]
  415e64:	83 c4 10             	add    esp,0x10
  415e67:	47                   	inc    edi
  415e68:	3b f8                	cmp    edi,eax
  415e6a:	7c da                	jl     0x415e46
  415e6c:	8b 86 30 08 00 00    	mov    eax,DWORD PTR [esi+0x830]
  415e72:	8b 8e 28 08 00 00    	mov    ecx,DWORD PTR [esi+0x828]
  415e78:	8b 56 04             	mov    edx,DWORD PTR [esi+0x4]
  415e7b:	50                   	push   eax
  415e7c:	51                   	push   ecx
  415e7d:	52                   	push   edx
  415e7e:	eb 0f                	jmp    0x415e8f
  415e80:	8b 8e 30 08 00 00    	mov    ecx,DWORD PTR [esi+0x830]
  415e86:	8b 96 28 08 00 00    	mov    edx,DWORD PTR [esi+0x828]
  415e8c:	51                   	push   ecx
  415e8d:	52                   	push   edx
  415e8e:	50                   	push   eax
  415e8f:	e8 ca 17 00 00       	call   0x41765e
  415e94:	33 c9                	xor    ecx,ecx
  415e96:	8b be 38 08 00 00    	mov    edi,DWORD PTR [esi+0x838]
  415e9c:	66 8b 8e 3c 08 00 00 	mov    cx,WORD PTR [esi+0x83c]
  415ea3:	33 c0                	xor    eax,eax
  415ea5:	c1 e1 02             	shl    ecx,0x2
  415ea8:	8b d1                	mov    edx,ecx
  415eaa:	c7 86 28 08 00 00 00 	mov    DWORD PTR [esi+0x828],0x0
  415eb1:	00 00 00
  415eb4:	c1 e9 02             	shr    ecx,0x2
  415eb7:	f3 ab                	rep stos DWORD PTR es:[edi],eax
  415eb9:	8b ca                	mov    ecx,edx
  415ebb:	83 c4 0c             	add    esp,0xc
  415ebe:	83 e1 03             	and    ecx,0x3
  415ec1:	f3 aa                	rep stos BYTE PTR es:[edi],al
  415ec3:	5f                   	pop    edi
  415ec4:	5e                   	pop    esi
  415ec5:	c2                   	.byte 0xc2
