
/home/user/wine-assembly-aoe3-unsupported-dialog-diagnosis-oct22/scratch/runs/20261022-aoe3-unsupported-dialog-diagnosis/original/age3.exe:     file format pei-i386


Disassembly of section .text:

00489eaa <.text+0x88eaa>:
  489eaa:	68 b0 35 b5 00       	push   0xb535b0
  489eaf:	8d 4c 24 30          	lea    ecx,[esp+0x30]
  489eb3:	e8 e8 a5 45 00       	call   0x8e44a0
  489eb8:	57                   	push   edi
  489eb9:	8d 4c 24 30          	lea    ecx,[esp+0x30]
  489ebd:	e8 9e 91 45 00       	call   0x8e3060
  489ec2:	50                   	push   eax
  489ec3:	a1 58 66 c1 00       	mov    eax,ds:0xc16658
  489ec8:	50                   	push   eax
  489ec9:	e8 f2 ac 45 00       	call   0x8e4bc0
  489ece:	83 c4 0c             	add    esp,0xc
  489ed1:	68 88 35 b5 00       	push   0xb53588
  489ed6:	8d 4c 24 34          	lea    ecx,[esp+0x34]
  489eda:	e8 c1 a5 45 00       	call   0x8e44a0
  489edf:	57                   	push   edi
  489ee0:	8d 4c 24 34          	lea    ecx,[esp+0x34]
  489ee4:	e8 77 91 45 00       	call   0x8e3060
  489ee9:	8b 0d 58 66 c1 00    	mov    ecx,DWORD PTR ds:0xc16658
  489eef:	50                   	push   eax
  489ef0:	51                   	push   ecx
  489ef1:	e8 ca ac 45 00       	call   0x8e4bc0
  489ef6:	83 c4 0c             	add    esp,0xc
  489ef9:	e8 e2 78 05 00       	call   0x4e17e0
  489efe:	8b 15 e0 66 c1 00    	mov    edx,DWORD PTR ds:0xc166e0
  489f04:	57                   	push   edi
  489f05:	52                   	push   edx
  489f06:	b9 30 28 ce 00       	mov    ecx,0xce2830
  489f0b:	e8 20 b1 46 00       	call   0x8f5030
  489f10:	50                   	push   eax
  489f11:	8d 4c 24 24          	lea    ecx,[esp+0x24]
  489f15:	e8 46 ab 45 00       	call   0x8e4a60
  489f1a:	a1 dc 66 c1 00       	mov    eax,ds:0xc166dc
  489f1f:	57                   	push   edi
  489f20:	50                   	push   eax
  489f21:	b9 30 28 ce 00       	mov    ecx,0xce2830
  489f26:	e8 05 b1 46 00       	call   0x8f5030
  489f2b:	50                   	push   eax
  489f2c:	8d 4c 24 28          	lea    ecx,[esp+0x28]
  489f30:	e8 2b ab 45 00       	call   0x8e4a60
  489f35:	e8 d6 cb ff ff       	call   0x486b10
  489f3a:	50                   	push   eax
  489f3b:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  489f3f:	e8 5c a5 45 00       	call   0x8e44a0
  489f44:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  489f48:	51                   	push   ecx
  489f49:	b9 d0 4d d5 00       	mov    ecx,0xd54dd0
  489f4e:	e8 0d ab 45 00       	call   0x8e4a60
  489f53:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  489f57:	e8 14 96 45 00       	call   0x8e3570
  489f5c:	8b 15 08 5f c1 00    	mov    edx,DWORD PTR ds:0xc15f08
  489f62:	57                   	push   edi
  489f63:	6a 01                	push   0x1
  489f65:	52                   	push   edx
  489f66:	b9 a0 d7 ca 00       	mov    ecx,0xcad7a0
  489f6b:	e8 e0 31 25 00       	call   0x6dd150
  489f70:	3b c7                	cmp    eax,edi
  489f72:	89 44 24 38          	mov    DWORD PTR [esp+0x38],eax
  489f76:	0f 84 dd 13 00 00    	je     0x48b359
  489f7c:	a1 0c 5f c1 00       	mov    eax,ds:0xc15f0c
  489f81:	57                   	push   edi
  489f82:	57                   	push   edi
  489f83:	50                   	push   eax
  489f84:	b9 a0 d7 ca 00       	mov    ecx,0xcad7a0
  489f89:	e8 c2 31 25 00       	call   0x6dd150
  489f8e:	85 c0                	test   eax,eax
  489f90:	0f 84 c3 13 00 00    	je     0x48b359
  489f96:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  489f9a:	e8 c1 90 45 00       	call   0x8e3060
  489f9f:	8b 8c 24 b0 03 00 00 	mov    ecx,DWORD PTR [esp+0x3b0]
  489fa6:	8b 94 24 ac 03 00 00 	mov    edx,DWORD PTR [esp+0x3ac]
  489fad:	50                   	push   eax
  489fae:	8b 84 24 a4 03 00 00 	mov    eax,DWORD PTR [esp+0x3a4]
  489fb5:	51                   	push   ecx
  489fb6:	8b 8c 24 a0 03 00 00 	mov    ecx,DWORD PTR [esp+0x3a0]
  489fbd:	52                   	push   edx
  489fbe:	8b 94 24 c0 03 00 00 	mov    edx,DWORD PTR [esp+0x3c0]
  489fc5:	50                   	push   eax
  489fc6:	51                   	push   ecx
  489fc7:	8b 8c 24 cc 03 00 00 	mov    ecx,DWORD PTR [esp+0x3cc]
  489fce:	e8 9d f8 ff ff       	call   0x489870
  489fd3:	83 c4 14             	add    esp,0x14
  489fd6:	84 c0                	test   al,al
  489fd8:	0f 84 76 13 00 00    	je     0x48b354
  489fde:	e8 5d d7 ff ff       	call   0x487740
  489fe3:	57                   	push   edi
  489fe4:	8d 54 24 20          	lea    edx,[esp+0x20]
  489fe8:	52                   	push   edx
  489fe9:	b9 30 28 ce 00       	mov    ecx,0xce2830
  489fee:	e8 1d af 46 00       	call   0x8f4f10
  489ff3:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  489ff7:	e8 64 90 45 00       	call   0x8e3060
  489ffc:	6a ff                	push   0xffffffff
  489ffe:	6a ff                	push   0xffffffff
  48a000:	50                   	push   eax
  48a001:	b9 38 07 cf 00       	mov    ecx,0xcf0738
  48a006:	e8 e5 92 45 00       	call   0x8e32f0
  48a00b:	8d 44 24 54          	lea    eax,[esp+0x54]
  48a00f:	50                   	push   eax
  48a010:	8d 4c 24 4c          	lea    ecx,[esp+0x4c]
  48a014:	51                   	push   ecx
  48a015:	8d 54 24 60          	lea    edx,[esp+0x60]
  48a019:	52                   	push   edx
  48a01a:	8d 44 24 68          	lea    eax,[esp+0x68]
  48a01e:	50                   	push   eax
  48a01f:	89 7c 24 58          	mov    DWORD PTR [esp+0x58],edi
  48a023:	89 7c 24 64          	mov    DWORD PTR [esp+0x64],edi
  48a027:	e8 e4 db 46 00       	call   0x8f7c10
  48a02c:	83 c4 10             	add    esp,0x10
  48a02f:	83 7c 24 48 04       	cmp    DWORD PTR [esp+0x48],0x4
  48a034:	75 21                	jne    0x48a057
  48a036:	8b 44 24 54          	mov    eax,DWORD PTR [esp+0x54]
  48a03a:	83 f8 0a             	cmp    eax,0xa
  48a03d:	74 05                	je     0x48a044
  48a03f:	83 f8 5a             	cmp    eax,0x5a
  48a042:	75 13                	jne    0x48a057
  48a044:	6a 01                	push   0x1
  48a046:	b9 30 28 ce 00       	mov    ecx,0xce2830
  48a04b:	e8 00 a9 46 00       	call   0x8f4950
  48a050:	c6 44 24 35 01       	mov    BYTE PTR [esp+0x35],0x1
  48a055:	eb 10                	jmp    0x48a067
  48a057:	57                   	push   edi
  48a058:	b9 30 28 ce 00       	mov    ecx,0xce2830
  48a05d:	e8 ee a8 46 00       	call   0x8f4950
  48a062:	c6 44 24 35 00       	mov    BYTE PTR [esp+0x35],0x0
  48a067:	56                   	push   esi
  48a068:	b9 f8 27 ce 00       	mov    ecx,0xce27f8
  48a06d:	e8 be 05 46 00       	call   0x8ea630
  48a072:	8b 0d ec 66 c1 00    	mov    ecx,DWORD PTR ds:0xc166ec
  48a078:	89 0d 24 28 ce 00    	mov    DWORD PTR ds:0xce2824,ecx
  48a07e:	68 f4 24 b4 00       	push   0xb424f4
  48a083:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  48a087:	e8 14 a4 45 00       	call   0x8e44a0
  48a08c:	a1 5c 66 c1 00       	mov    eax,ds:0xc1665c
  48a091:	57                   	push   edi
  48a092:	57                   	push   edi
  48a093:	6a 01                	push   0x1
  48a095:	8d 54 24 1c          	lea    edx,[esp+0x1c]
  48a099:	52                   	push   edx
  48a09a:	50                   	push   eax
  48a09b:	b9 f8 27 ce 00       	mov    ecx,0xce27f8
  48a0a0:	e8 db 08 46 00       	call   0x8ea980
  48a0a5:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  48a0a9:	e8 c2 94 45 00       	call   0x8e3570
  48a0ae:	68 d4 24 b4 00       	push   0xb424d4
  48a0b3:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  48a0b7:	e8 e4 a3 45 00       	call   0x8e44a0
  48a0bc:	8b 15 5c 66 c1 00    	mov    edx,DWORD PTR ds:0xc1665c
  48a0c2:	57                   	push   edi
  48a0c3:	57                   	push   edi
  48a0c4:	6a 01                	push   0x1
  48a0c6:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  48a0ca:	51                   	push   ecx
  48a0cb:	52                   	push   edx
  48a0cc:	b9 f8 27 ce 00       	mov    ecx,0xce27f8
  48a0d1:	e8 aa 08 46 00       	call   0x8ea980
  48a0d6:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  48a0da:	e8 91 94 45 00       	call   0x8e3570
  48a0df:	68 68 35 b5 00       	push   0xb53568
  48a0e4:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  48a0e8:	e8 b3 a3 45 00       	call   0x8e44a0
  48a0ed:	8b 0d ec 66 c1 00    	mov    ecx,DWORD PTR ds:0xc166ec
  48a0f3:	6a 01                	push   0x1
  48a0f5:	6a 01                	push   0x1
  48a0f7:	6a 02                	push   0x2
  48a0f9:	8d 44 24 1c          	lea    eax,[esp+0x1c]
  48a0fd:	50                   	push   eax
  48a0fe:	51                   	push   ecx
  48a0ff:	b9 f8 27 ce 00       	mov    ecx,0xce27f8
  48a104:	e8 77 08 46 00       	call   0x8ea980
  48a109:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  48a10d:	e8 5e 94 45 00       	call   0x8e3570
  48a112:	68 68 35 b5 00       	push   0xb53568
  48a117:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  48a11b:	e8 80 a3 45 00       	call   0x8e44a0
  48a120:	a1 ec 66 c1 00       	mov    eax,ds:0xc166ec
  48a125:	8d 54 24 10          	lea    edx,[esp+0x10]
  48a129:	52                   	push   edx
  48a12a:	50                   	push   eax
  48a12b:	b9 f8 27 ce 00       	mov    ecx,0xce27f8
  48a130:	e8 ab fa 45 00       	call   0x8e9be0
  48a135:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  48a139:	e8 32 94 45 00       	call   0x8e3570
  48a13e:	68 50 35 b5 00       	push   0xb53550
  48a143:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  48a147:	e8 54 a3 45 00       	call   0x8e44a0
  48a14c:	8b 15 5c 66 c1 00    	mov    edx,DWORD PTR ds:0xc1665c
  48a152:	57                   	push   edi
  48a153:	57                   	push   edi
  48a154:	6a 04                	push   0x4
  48a156:	8d 4c 24 1c          	lea    ecx,[esp+0x1c]
  48a15a:	51                   	push   ecx
  48a15b:	52                   	push   edx
  48a15c:	b9 f8 27 ce 00       	mov    ecx,0xce27f8
  48a161:	e8 1a 08 46 00       	call   0x8ea980
  48a166:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  48a16a:	e8 01 94 45 00       	call   0x8e3570
  48a16f:	68 3c 35 b5 00       	push   0xb5353c
  48a174:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  48a178:	e8 23 a3 45 00       	call   0x8e44a0
  48a17d:	8b 0d ec 66 c1 00    	mov    ecx,DWORD PTR ds:0xc166ec
  48a183:	57                   	push   edi
  48a184:	57                   	push   edi
  48a185:	6a 04                	push   0x4
  48a187:	8d 44 24 1c          	lea    eax,[esp+0x1c]
  48a18b:	50                   	push   eax
  48a18c:	51                   	push   ecx
  48a18d:	b9 f8 27 ce 00       	mov    ecx,0xce27f8
  48a192:	e8 e9 07 46 00       	call   0x8ea980
  48a197:	85 c0                	test   eax,eax
  48a199:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  48a19d:	0f 95 c3             	setne  bl
  48a1a0:	e8 cb 93 45 00       	call   0x8e3570
  48a1a5:	84 db                	test   bl,bl
  48a1a7:	74 30                	je     0x48a1d9
  48a1a9:	68 3c 35 b5 00       	push   0xb5353c
  48a1ae:	8d 4c 24 14          	lea    ecx,[esp+0x14]
  48a1b2:	e8 e9 a2 45 00       	call   0x8e44a0
  48a1b7:	a1 5c 66 c1 00       	mov    eax,ds:0xc1665c
  48a1bc:	57                   	push   edi
  48a1bd:	57                   	push   edi
  48a1be:	6a 04                	push   0x4
  48a1c0:	8d 54 24 1c          	lea    edx,[esp+0x1c]
  48a1c4:	52                   	push   edx
  48a1c5:	50                   	push   eax
  48a1c6:	b9 f8 27 ce 00       	mov    ecx,0xce27f8
  48a1cb:	e8 b0 07 46 00       	call   0x8ea980
  48a1d0:	8d 4c 24 10          	lea    ecx,[esp+0x10]
  48a1d4:	e8 97 93 45 00       	call   0x8e3570
  48a1d9:	e8 72 ec ff ff       	call   0x488e50
  48a1de:	84 c0                	test   al,al
  48a1e0:	0f 84 73 11 00 00    	je     0x48b359
