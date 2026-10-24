
/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe:     file format pei-i386


Disassembly of section .text:

0040e000 <.text+0xd000>:
  40e000:	81 ec 2c 02 00 00    	sub    esp,0x22c
  40e006:	53                   	push   ebx
  40e007:	55                   	push   ebp
  40e008:	56                   	push   esi
  40e009:	57                   	push   edi
  40e00a:	8b 3d f4 f9 41 00    	mov    edi,DWORD PTR ds:0x41f9f4
  40e010:	33 c0                	xor    eax,eax
  40e012:	85 ff                	test   edi,edi
  40e014:	0f 94 c0             	sete   al
  40e017:	a3 f4 f9 41 00       	mov    ds:0x41f9f4,eax
  40e01c:	a1 f8 f9 41 00       	mov    eax,ds:0x41f9f8
  40e021:	8b c8                	mov    ecx,eax
  40e023:	25 00 ff 00 00       	and    eax,0xff00
  40e028:	c1 e1 10             	shl    ecx,0x10
  40e02b:	0b c8                	or     ecx,eax
  40e02d:	66 a1 fa f9 41 00    	mov    ax,ds:0x41f9fa
  40e033:	33 d2                	xor    edx,edx
  40e035:	c1 e1 08             	shl    ecx,0x8
  40e038:	8a f0                	mov    dh,al
  40e03a:	0b ca                	or     ecx,edx
  40e03c:	33 d2                	xor    edx,edx
  40e03e:	8a d4                	mov    dl,ah
  40e040:	a1 60 06 42 00       	mov    eax,ds:0x420660
  40e045:	0b ca                	or     ecx,edx
  40e047:	8b 14 85 34 fa 41 00 	mov    edx,DWORD PTR [eax*4+0x41fa34]
  40e04e:	8b 42 04             	mov    eax,DWORD PTR [edx+0x4]
  40e051:	89 48 01             	mov    DWORD PTR [eax+0x1],ecx
  40e054:	e8 87 76 ff ff       	call   0x4056e0
  40e059:	8b f8                	mov    edi,eax
  40e05b:	25 00 00 ff 00       	and    eax,0xff0000
  40e060:	8b cf                	mov    ecx,edi
  40e062:	8b d7                	mov    edx,edi
  40e064:	81 e1 00 ff 00 00    	and    ecx,0xff00
  40e06a:	89 7c 24 18          	mov    DWORD PTR [esp+0x18],edi
  40e06e:	c1 e2 10             	shl    edx,0x10
  40e071:	0b ca                	or     ecx,edx
  40e073:	8b d7                	mov    edx,edi
  40e075:	c1 ea 10             	shr    edx,0x10
  40e078:	0b c2                	or     eax,edx
  40e07a:	c1 e1 08             	shl    ecx,0x8
  40e07d:	c1 e8 08             	shr    eax,0x8
  40e080:	0b c8                	or     ecx,eax
  40e082:	a1 60 06 42 00       	mov    eax,ds:0x420660
  40e087:	8b 14 85 34 fa 41 00 	mov    edx,DWORD PTR [eax*4+0x41fa34]
  40e08e:	8b 42 04             	mov    eax,DWORD PTR [edx+0x4]
  40e091:	89 48 05             	mov    DWORD PTR [eax+0x5],ecx
  40e094:	8b 0d 60 06 42 00    	mov    ecx,DWORD PTR ds:0x420660
  40e09a:	a1 58 06 42 00       	mov    eax,ds:0x420658
  40e09f:	8b 14 8d 34 fa 41 00 	mov    edx,DWORD PTR [ecx*4+0x41fa34]
  40e0a6:	52                   	push   edx
  40e0a7:	6a 00                	push   0x0
  40e0a9:	50                   	push   eax
  40e0aa:	e8 43 54 00 00       	call   0x4134f2
  40e0af:	a1 fc f9 41 00       	mov    eax,ds:0x41f9fc
  40e0b4:	8b 15 f4 f9 41 00    	mov    edx,DWORD PTR ds:0x41f9f4
  40e0ba:	83 c4 0c             	add    esp,0xc
  40e0bd:	33 db                	xor    ebx,ebx
  40e0bf:	85 c0                	test   eax,eax
  40e0c1:	89 5c 24 10          	mov    DWORD PTR [esp+0x10],ebx
  40e0c5:	7e 1a                	jle    0x40e0e1
  40e0c7:	8d 0c 52             	lea    ecx,[edx+edx*2]
  40e0ca:	8d 0c 8d 3c fa 41 00 	lea    ecx,[ecx*4+0x41fa3c]
  40e0d1:	83 39 00             	cmp    DWORD PTR [ecx],0x0
  40e0d4:	75 01                	jne    0x40e0d7
  40e0d6:	43                   	inc    ebx
  40e0d7:	83 c1 04             	add    ecx,0x4
  40e0da:	48                   	dec    eax
  40e0db:	75 f4                	jne    0x40e0d1
  40e0dd:	89 5c 24 10          	mov    DWORD PTR [esp+0x10],ebx
  40e0e1:	33 c0                	xor    eax,eax
  40e0e3:	8d 4c 24 3c          	lea    ecx,[esp+0x3c]
  40e0e7:	85 d2                	test   edx,edx
  40e0e9:	0f 94 c0             	sete   al
  40e0ec:	85 db                	test   ebx,ebx
  40e0ee:	c7 04 85 24 fa 41 00 	mov    DWORD PTR [eax*4+0x41fa24],0x0
  40e0f5:	00 00 00 00
  40e0f9:	89 4c 24 24          	mov    DWORD PTR [esp+0x24],ecx
  40e0fd:	c7 44 24 2c 00 02 00 	mov    DWORD PTR [esp+0x2c],0x200
  40e104:	00
  40e105:	0f 84 47 03 00 00    	je     0x40e452
  40e10b:	a1 d8 f9 41 00       	mov    eax,ds:0x41f9d8
  40e110:	8b 0d 5c 06 42 00    	mov    ecx,DWORD PTR ds:0x42065c
  40e116:	8d 04 40             	lea    eax,[eax+eax*2]
  40e119:	8d 14 80             	lea    edx,[eax+eax*4]
  40e11c:	8d 04 95 e8 03 00 00 	lea    eax,[edx*4+0x3e8]
  40e123:	50                   	push   eax
  40e124:	51                   	push   ecx
  40e125:	e8 c2 53 00 00       	call   0x4134ec
  40e12a:	83 c4 08             	add    esp,0x8
  40e12d:	85 c0                	test   eax,eax
  40e12f:	75 6e                	jne    0x40e19f
  40e131:	8b 15 f8 f9 41 00    	mov    edx,DWORD PTR ds:0x41f9f8
  40e137:	52                   	push   edx
  40e138:	68 40 e6 41 00       	push   0x41e640
  40e13d:	e8 ee f8 ff ff       	call   0x40da30
  40e142:	a1 fc f9 41 00       	mov    eax,ds:0x41f9fc
  40e147:	83 c4 08             	add    esp,0x8
  40e14a:	33 f6                	xor    esi,esi
  40e14c:	85 c0                	test   eax,eax
  40e14e:	0f 8e f6 02 00 00    	jle    0x40e44a
  40e154:	a1 f4 f9 41 00       	mov    eax,ds:0x41f9f4
  40e159:	8d 0c 46             	lea    ecx,[esi+eax*2]
  40e15c:	8b d0                	mov    edx,eax
  40e15e:	03 d1                	add    edx,ecx
  40e160:	8b 0c 95 3c fa 41 00 	mov    ecx,DWORD PTR [edx*4+0x41fa3c]
  40e167:	85 c9                	test   ecx,ecx
  40e169:	75 24                	jne    0x40e18f
  40e16b:	a1 60 06 42 00       	mov    eax,ds:0x420660
  40e170:	8d 56 01             	lea    edx,[esi+0x1]
  40e173:	8b 0c 85 34 fa 41 00 	mov    ecx,DWORD PTR [eax*4+0x41fa34]
  40e17a:	a1 58 06 42 00       	mov    eax,ds:0x420658
  40e17f:	51                   	push   ecx
  40e180:	52                   	push   edx
  40e181:	50                   	push   eax
  40e182:	e8 6b 53 00 00       	call   0x4134f2
  40e187:	a1 f4 f9 41 00       	mov    eax,ds:0x41f9f4
  40e18c:	83 c4 0c             	add    esp,0xc
  40e18f:	8b 0d fc f9 41 00    	mov    ecx,DWORD PTR ds:0x41f9fc
  40e195:	46                   	inc    esi
  40e196:	3b f1                	cmp    esi,ecx
  40e198:	7c bf                	jl     0x40e159
  40e19a:	e9 ab 02 00 00       	jmp    0x40e44a
  40e19f:	0f 8e a5 02 00 00    	jle    0x40e44a
  40e1a5:	8b 15 58 06 42 00    	mov    edx,DWORD PTR ds:0x420658
  40e1ab:	8d 4c 24 20          	lea    ecx,[esp+0x20]
  40e1af:	51                   	push   ecx
  40e1b0:	52                   	push   edx
  40e1b1:	e8 30 53 00 00       	call   0x4134e6
  40e1b6:	83 c4 08             	add    esp,0x8
  40e1b9:	85 c0                	test   eax,eax
  40e1bb:	0f 8e cb 02 00 00    	jle    0x40e48c
  40e1c1:	8a 44 24 3c          	mov    al,BYTE PTR [esp+0x3c]
  40e1c5:	3c 01                	cmp    al,0x1
  40e1c7:	75 2c                	jne    0x40e1f5
  40e1c9:	a1 d8 f9 41 00       	mov    eax,ds:0x41f9d8
  40e1ce:	85 c0                	test   eax,eax
  40e1d0:	0f 84 74 02 00 00    	je     0x40e44a
  40e1d6:	8b 0d 58 06 42 00    	mov    ecx,DWORD PTR ds:0x420658
  40e1dc:	88 44 24 3d          	mov    BYTE PTR [esp+0x3d],al
  40e1e0:	8d 44 24 20          	lea    eax,[esp+0x20]
  40e1e4:	50                   	push   eax
  40e1e5:	6a ff                	push   0xffffffff
  40e1e7:	51                   	push   ecx
  40e1e8:	e8 05 53 00 00       	call   0x4134f2
  40e1ed:	83 c4 0c             	add    esp,0xc
  40e1f0:	e9 55 02 00 00       	jmp    0x40e44a
  40e1f5:	84 c0                	test   al,al
  40e1f7:	74 1d                	je     0x40e216
  40e1f9:	8b 54 24 3c          	mov    edx,DWORD PTR [esp+0x3c]
  40e1fd:	81 e2 ff 00 00 00    	and    edx,0xff
