
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/SDL.dll:     file format pei-i386


Disassembly of section .text:

10017cd0 <.text+0x16cd0>:
10017cd0:	a1 b4 45 03 10       	mov    0x100345b4,%eax
10017cd5:	83 ec 14             	sub    $0x14,%esp
10017cd8:	85 c0                	test   %eax,%eax
10017cda:	75 07                	jne    0x10017ce3
10017cdc:	83 c8 ff             	or     $0xffffffff,%eax
10017cdf:	83 c4 14             	add    $0x14,%esp
10017ce2:	c3                   	ret
10017ce3:	a1 b0 45 03 10       	mov    0x100345b0,%eax
10017ce8:	55                   	push   %ebp
10017ce9:	50                   	push   %eax
10017cea:	33 ed                	xor    %ebp,%ebp
10017cec:	e8 3f ad 00 00       	call   0x10022a30
10017cf1:	83 c4 04             	add    $0x4,%esp
10017cf4:	85 c0                	test   %eax,%eax
10017cf6:	0f 85 cc 00 00 00    	jne    0x10017dc8
10017cfc:	8b 44 24 24          	mov    0x24(%esp),%eax
10017d00:	53                   	push   %ebx
10017d01:	56                   	push   %esi
10017d02:	57                   	push   %edi
10017d03:	85 c0                	test   %eax,%eax
10017d05:	75 26                	jne    0x10017d2d
10017d07:	8b 7c 24 2c          	mov    0x2c(%esp),%edi
10017d0b:	85 ff                	test   %edi,%edi
10017d0d:	0f 8e 9c 00 00 00    	jle    0x10017daf
10017d13:	8b 74 24 28          	mov    0x28(%esp),%esi
10017d17:	56                   	push   %esi
10017d18:	e8 c3 00 00 00       	call   0x10017de0
10017d1d:	83 c4 04             	add    $0x4,%esp
10017d20:	03 e8                	add    %eax,%ebp
10017d22:	83 c6 14             	add    $0x14,%esi
10017d25:	4f                   	dec    %edi
10017d26:	75 ef                	jne    0x10017d17
10017d28:	e9 82 00 00 00       	jmp    0x10017daf
10017d2d:	8b 5c 24 28          	mov    0x28(%esp),%ebx
10017d31:	85 db                	test   %ebx,%ebx
10017d33:	75 11                	jne    0x10017d46
10017d35:	b8 01 00 00 00       	mov    $0x1,%eax
10017d3a:	8d 5c 24 10          	lea    0x10(%esp),%ebx
10017d3e:	89 44 24 30          	mov    %eax,0x30(%esp)
10017d42:	89 44 24 2c          	mov    %eax,0x2c(%esp)
10017d46:	8b 4c 24 2c          	mov    0x2c(%esp),%ecx
10017d4a:	a1 b8 45 03 10       	mov    0x100345b8,%eax
10017d4f:	85 c9                	test   %ecx,%ecx
10017d51:	7e 5c                	jle    0x10017daf
10017d53:	3b 05 bc 45 03 10    	cmp    0x100345bc,%eax
10017d59:	74 54                	je     0x10017daf
10017d5b:	8d 0c 80             	lea    (%eax,%eax,4),%ecx
10017d5e:	ba 01 00 00 00       	mov    $0x1,%edx
10017d63:	8d 34 8d c0 45 03 10 	lea    0x100345c0(,%ecx,4),%esi
10017d6a:	8a 0c 8d c0 45 03 10 	mov    0x100345c0(,%ecx,4),%cl
10017d71:	d3 e2                	shl    %cl,%edx
10017d73:	8b 4c 24 34          	mov    0x34(%esp),%ecx
10017d77:	85 d1                	test   %edx,%ecx
10017d79:	74 21                	je     0x10017d9c
10017d7b:	b9 05 00 00 00       	mov    $0x5,%ecx
10017d80:	8b fb                	mov    %ebx,%edi
10017d82:	f3 a5                	rep movsl %ds:(%esi),%es:(%edi)
10017d84:	8b 4c 24 30          	mov    0x30(%esp),%ecx
10017d88:	45                   	inc    %ebp
10017d89:	83 c3 14             	add    $0x14,%ebx
10017d8c:	83 f9 02             	cmp    $0x2,%ecx
10017d8f:	75 0b                	jne    0x10017d9c
10017d91:	50                   	push   %eax
10017d92:	e8 e9 00 00 00       	call   0x10017e80
10017d97:	83 c4 04             	add    $0x4,%esp
10017d9a:	eb 0d                	jmp    0x10017da9
10017d9c:	40                   	inc    %eax
10017d9d:	25 7f 00 00 80       	and    $0x8000007f,%eax
10017da2:	79 05                	jns    0x10017da9
10017da4:	48                   	dec    %eax
10017da5:	83 c8 80             	or     $0xffffff80,%eax
10017da8:	40                   	inc    %eax
10017da9:	3b 6c 24 2c          	cmp    0x2c(%esp),%ebp
10017dad:	7c a4                	jl     0x10017d53
10017daf:	8b 15 b0 45 03 10    	mov    0x100345b0,%edx
10017db5:	52                   	push   %edx
10017db6:	e8 b5 ac 00 00       	call   0x10022a70
10017dbb:	83 c4 04             	add    $0x4,%esp
10017dbe:	8b c5                	mov    %ebp,%eax
10017dc0:	5f                   	pop    %edi
10017dc1:	5e                   	pop    %esi
10017dc2:	5b                   	pop    %ebx
10017dc3:	5d                   	pop    %ebp
10017dc4:	83 c4 14             	add    $0x14,%esp
10017dc7:	c3                   	ret
10017dc8:	68 88 15 03 10       	push   $0x10031588
10017dcd:	e8 8e f5 ff ff       	call   0x10017360
10017dd2:	83 c4 04             	add    $0x4,%esp
10017dd5:	83 cd ff             	or     $0xffffffff,%ebp
10017dd8:	8b c5                	mov    %ebp,%eax
10017dda:	5d                   	pop    %ebp
10017ddb:	83 c4 14             	add    $0x14,%esp
10017dde:	c3                   	ret


/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/SDL.dll:     file format pei-i386


Disassembly of section .text:

10017f60 <.text+0x16f60>:
10017f60:	e8 bb ff ff ff       	call   0x10017f20
10017f65:	8b 44 24 04          	mov    0x4(%esp),%eax
10017f69:	6a ff                	push   $0xffffffff
10017f6b:	6a 02                	push   $0x2
10017f6d:	6a 01                	push   $0x1
10017f6f:	50                   	push   %eax
10017f70:	e8 5b fd ff ff       	call   0x10017cd0
10017f75:	83 c4 10             	add    $0x10,%esp
10017f78:	33 c9                	xor    %ecx,%ecx
10017f7a:	85 c0                	test   %eax,%eax
10017f7c:	0f 9f c1             	setg   %cl
10017f7f:	8b c1                	mov    %ecx,%eax
10017f81:	c3                   	ret


/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/SDL.dll:     file format pei-i386


Disassembly of section .text:

10022a70 <.text+0x21a70>:
10022a70:	8b 44 24 04          	mov    0x4(%esp),%eax
10022a74:	85 c0                	test   %eax,%eax
10022a76:	75 11                	jne    0x10022a89
10022a78:	68 20 22 03 10       	push   $0x10032220
10022a7d:	e8 de 48 ff ff       	call   0x10017360
10022a82:	83 c4 04             	add    $0x4,%esp
10022a85:	83 c8 ff             	or     $0xffffffff,%eax
10022a88:	c3                   	ret
10022a89:	8b 00                	mov    (%eax),%eax
10022a8b:	50                   	push   %eax
10022a8c:	ff 15 7c a0 02 10    	call   *0x1002a07c
10022a92:	85 c0                	test   %eax,%eax
10022a94:	75 11                	jne    0x10022aa7
10022a96:	68 34 22 03 10       	push   $0x10032234
10022a9b:	e8 c0 48 ff ff       	call   0x10017360
10022aa0:	83 c4 04             	add    $0x4,%esp
10022aa3:	83 c8 ff             	or     $0xffffffff,%eax
10022aa6:	c3                   	ret
10022aa7:	33 c0                	xor    %eax,%eax
10022aa9:	c3                   	ret


/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/SDL_net.dll:     file format pei-i386


Disassembly of section .text:

1000133e <.text+0x33e>:
1000133e:	8b 44 24 14          	mov    0x14(%esp),%eax
10001342:	8d 4c 24 18          	lea    0x18(%esp),%ecx
10001346:	51                   	push   %ecx
10001347:	89 44 24 1c          	mov    %eax,0x1c(%esp)
1000134b:	8b 44 24 14          	mov    0x14(%esp),%eax
1000134f:	6a 00                	push   $0x0
10001351:	8d 54 24 28          	lea    0x28(%esp),%edx
10001355:	6a 00                	push   $0x0
10001357:	52                   	push   %edx
10001358:	50                   	push   %eax
10001359:	89 74 24 30          	mov    %esi,0x30(%esp)
1000135d:	e8 ee 09 00 00       	call   0x10001d50
10001362:	8b e8                	mov    %eax,%ebp
10001364:	ff d7                	call   *%edi
10001366:	83 38 04             	cmpl   $0x4,(%eax)
10001369:	74 a2                	je     0x1000130d
1000136b:	85 ed                	test   %ebp,%ebp


/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/SDL_net.dll:     file format pei-i386


Disassembly of section .text:

10001d4a <.text+0xd4a>:
10001d4a:	ff 25 54 20 00 10    	jmp    *0x10002054
10001d50:	ff 25 50 20 00 10    	jmp    *0x10002050


/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

004019a0 <.text+0x9a0>:
  4019a0:	56                   	push   %esi
  4019a1:	6a 00                	push   $0x0
  4019a3:	e8 a8 0e 00 00       	call   0x402850
  4019a8:	83 c4 04             	add    $0x4,%esp
  4019ab:	e8 50 c6 00 00       	call   0x40e000
  4019b0:	85 c0                	test   %eax,%eax
  4019b2:	7d 11                	jge    0x4019c5
  4019b4:	68 a0 b0 41 00       	push   $0x41b0a0
  4019b9:	e8 72 c0 00 00       	call   0x40da30
  4019be:	83 c4 04             	add    $0x4,%esp
  4019c1:	33 c0                	xor    %eax,%eax
  4019c3:	5e                   	pop    %esi
  4019c4:	c3                   	ret
  4019c5:	a1                   	.byte 0xa1


/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

00402850 <.text+0x1850>:
  402850:	83 ec 14             	sub    $0x14,%esp
  402853:	56                   	push   %esi
  402854:	8b 74 24 1c          	mov    0x1c(%esp),%esi
  402858:	8d 44 24 04          	lea    0x4(%esp),%eax
  40285c:	50                   	push   %eax
  40285d:	e8 c4 0b 01 00       	call   0x413426
  402862:	83 c4 04             	add    $0x4,%esp
  402865:	85 c0                	test   %eax,%eax
  402867:	74 1b                	je     0x402884
  402869:	8d 4c 24 04          	lea    0x4(%esp),%ecx
  40286d:	51                   	push   %ecx
  40286e:	e8 2d 00 00 00       	call   0x4028a0
  402873:	8d 54 24 08          	lea    0x8(%esp),%edx
  402877:	52                   	push   %edx
  402878:	e8 a9 0b 01 00       	call   0x413426
  40287d:	83 c4 08             	add    $0x8,%esp
  402880:	85 c0                	test   %eax,%eax
  402882:	75 e5                	jne    0x402869
  402884:	85 f6                	test   %esi,%esi
  402886:	74 0a                	je     0x402892
  402888:	6a 10                	push   $0x10
  40288a:	e8 91 0b 01 00       	call   0x413420
  40288f:	83 c4 04             	add    $0x4,%esp
  402892:	8b c6                	mov    %esi,%eax
  402894:	4e                   	dec    %esi
  402895:	85 c0                	test   %eax,%eax
  402897:	75 bf                	jne    0x402858
  402899:	5e                   	pop    %esi
  40289a:	83 c4 14             	add    $0x14,%esp
  40289d:	c3                   	ret
