
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

00402850 <.text+0x1850>:
  402850:	83 ec 14             	sub    esp,0x14
  402853:	56                   	push   esi
  402854:	8b 74 24 1c          	mov    esi,DWORD PTR [esp+0x1c]
  402858:	8d 44 24 04          	lea    eax,[esp+0x4]
  40285c:	50                   	push   eax
  40285d:	e8 c4 0b 01 00       	call   0x413426
  402862:	83 c4 04             	add    esp,0x4
  402865:	85 c0                	test   eax,eax
  402867:	74 1b                	je     0x402884
  402869:	8d 4c 24 04          	lea    ecx,[esp+0x4]
  40286d:	51                   	push   ecx
  40286e:	e8 2d 00 00 00       	call   0x4028a0
  402873:	8d 54 24 08          	lea    edx,[esp+0x8]
  402877:	52                   	push   edx
  402878:	e8 a9 0b 01 00       	call   0x413426
  40287d:	83 c4 08             	add    esp,0x8
  402880:	85 c0                	test   eax,eax
  402882:	75 e5                	jne    0x402869
  402884:	85 f6                	test   esi,esi
  402886:	74 0a                	je     0x402892
  402888:	6a 10                	push   0x10
  40288a:	e8 91 0b 01 00       	call   0x413420
  40288f:	83 c4 04             	add    esp,0x4
  402892:	8b c6                	mov    eax,esi
  402894:	4e                   	dec    esi
  402895:	85 c0                	test   eax,eax
  402897:	75 bf                	jne    0x402858
  402899:	5e                   	pop    esi
  40289a:	83 c4 14             	add    esp,0x14
  40289d:	c3                   	ret
