
/home/user/wine-assembly-shadow-man-original-recover-runtime-oct22/scratch/runs/20261022-shadow-man-original-source/ranges/161796096-73728.bin:     file format pei-i386


Disassembly of section .text:

00402fb0 <.text+0x1fb0>:
  402fb0:	55                   	push   ebp
  402fb1:	8b ec                	mov    ebp,esp
  402fb3:	81 ec 40 01 00 00    	sub    esp,0x140
  402fb9:	53                   	push   ebx
  402fba:	56                   	push   esi
  402fbb:	57                   	push   edi
  402fbc:	8d 85 c0 fe ff ff    	lea    eax,[ebp-0x140]
  402fc2:	68 05 01 00 00       	push   0x105
  402fc7:	50                   	push   eax
  402fc8:	68 c7 1b 00 00       	push   0x1bc7
  402fcd:	e8 39 25 00 00       	call   0x40550b
  402fd2:	8d 85 c0 fe ff ff    	lea    eax,[ebp-0x140]
  402fd8:	50                   	push   eax
  402fd9:	e8 f0 48 00 00       	call   0x4078ce
  402fde:	8b d8                	mov    ebx,eax
  402fe0:	bf 30 75 00 00       	mov    edi,0x7530
  402fe5:	3b df                	cmp    ebx,edi
  402fe7:	59                   	pop    ecx
  402fe8:	76 02                	jbe    0x402fec
  402fea:	8b df                	mov    ebx,edi
  402fec:	8b 35 c8 d0 40 00    	mov    esi,DWORD PTR ds:0x40d0c8
  402ff2:	ff d6                	call   esi
  402ff4:	03 c3                	add    eax,ebx
  402ff6:	a3 ac 07 41 00       	mov    ds:0x4107ac,eax
  402ffb:	ff d6                	call   esi
  402ffd:	05 c0 d4 01 00       	add    eax,0x1d4c0
  403002:	a3 b0 07 41 00       	mov    ds:0x4107b0,eax
  403007:	ff d6                	call   esi
  403009:	83 25 c8 07 41 00 00 	and    DWORD PTR ds:0x4107c8,0x0
  403010:	6a 00                	push   0x0
  403012:	68 e8 03 00 00       	push   0x3e8
  403017:	68 e9 03 00 00       	push   0x3e9
  40301c:	ff 75 08             	push   DWORD PTR [ebp+0x8]
  40301f:	03 c7                	add    eax,edi
  403021:	a3 b4 07 41 00       	mov    ds:0x4107b4,eax
  403026:	ff 15 80 d2 40 00    	call   DWORD PTR ds:0x40d280
  40302c:	6a 01                	push   0x1
  40302e:	58                   	pop    eax
  40302f:	5f                   	pop    edi
  403030:	5e                   	pop    esi
  403031:	5b                   	pop    ebx
  403032:	c9                   	leave
  403033:	c3                   	ret
  403034:	55                   	push   ebp
  403035:	8b ec                	mov    ebp,esp
  403037:	83 ec 10             	sub    esp,0x10
  40303a:	8b 4d 0c             	mov    ecx,DWORD PTR [ebp+0xc]
  40303d:	56                   	push   esi
  40303e:	8b c1                	mov    eax,ecx
  403040:	57                   	push   edi
  403041:	48                   	dec    eax
  403042:	48                   	dec    eax
  403043:	0f 84 8b 01 00 00    	je     0x4031d4
  403049:	83 e8 12             	sub    eax,0x12
  40304c:	0f 84 53 01 00 00    	je     0x4031a5
  403052:	83 e8 05             	sub    eax,0x5
  403055:	0f 84 2e 01 00 00    	je     0x403189
  40305b:	2d f7 00 00 00       	sub    eax,0xf7
  403060:	0f 84 da 00 00 00    	je     0x403140
  403066:	48                   	dec    eax
  403067:	0f 84 b5 00 00 00    	je     0x403122
  40306d:	48                   	dec    eax
  40306e:	0f 84 a5 00 00 00    	je     0x403119
  403074:	48                   	dec    eax
  403075:	74 3a                	je     0x4030b1
  403077:	3b 0d a0 07 41 00    	cmp    ecx,DWORD PTR ds:0x4107a0
  40307d:	75 10                	jne    0x40308f
  40307f:	6a 01                	push   0x1
  403081:	58                   	pop    eax
  403082:	50                   	push   eax
  403083:	a3 c0 07 41 00       	mov    ds:0x4107c0,eax
  403088:	6a 00                	push   0x0
  40308a:	e9 a4 00 00 00       	jmp    0x403133
  40308f:	3b 0d a4 07 41 00    	cmp    ecx,DWORD PTR ds:0x4107a4
  403095:	0f 85 a7 01 00 00    	jne    0x403242
  40309b:	ff 75 14             	push   DWORD PTR [ebp+0x14]
  40309e:	ff 75 10             	push   DWORD PTR [ebp+0x10]
  4030a1:	ff 75 08             	push   DWORD PTR [ebp+0x8]
  4030a4:	e8 aa 06 00 00       	call   0x403753
  4030a9:	83 c4 0c             	add    esp,0xc
  4030ac:	e9 93 01 00 00       	jmp    0x403244
  4030b1:	33 ff                	xor    edi,edi
  4030b3:	39 3d bc 07 41 00    	cmp    DWORD PTR ds:0x4107bc,edi
  4030b9:	0f 85 c2 00 00 00    	jne    0x403181
  4030bf:	8b 35 c8 d0 40 00    	mov    esi,DWORD PTR ds:0x40d0c8
  4030c5:	c7 05 bc 07 41 00 01 	mov    DWORD PTR ds:0x4107bc,0x1
  4030cc:	00 00 00
  4030cf:	ff d6                	call   esi
  4030d1:	3b 05 b0 07 41 00    	cmp    eax,DWORD PTR ds:0x4107b0
  4030d7:	76 10                	jbe    0x4030e9
  4030d9:	57                   	push   edi
  4030da:	57                   	push   edi
  4030db:	ff 75 08             	push   DWORD PTR [ebp+0x8]
  4030de:	e8 37 07 00 00       	call   0x40381a
  4030e3:	83 c4 0c             	add    esp,0xc
  4030e6:	89 45 10             	mov    DWORD PTR [ebp+0x10],eax
  4030e9:	39 3d c0 07 41 00    	cmp    DWORD PTR ds:0x4107c0,edi
  4030ef:	74 1a                	je     0x40310b
  4030f1:	ff d6                	call   esi
  4030f3:	3b 05 ac 07 41 00    	cmp    eax,DWORD PTR ds:0x4107ac
  4030f9:	76 10                	jbe    0x40310b
  4030fb:	57                   	push   edi
  4030fc:	57                   	push   edi
  4030fd:	ff 75 08             	push   DWORD PTR [ebp+0x8]
  403100:	e8 15 07 00 00       	call   0x40381a
  403105:	83 c4 0c             	add    esp,0xc
  403108:	89 45 10             	mov    DWORD PTR [ebp+0x10],eax
  40310b:	8b 45 10             	mov    eax,DWORD PTR [ebp+0x10]
  40310e:	89 3d bc 07 41 00    	mov    DWORD PTR ds:0x4107bc,edi
  403114:	e9 2b 01 00 00       	jmp    0x403244
  403119:	81 7d 10 60 f0 00 00 	cmp    DWORD PTR [ebp+0x10],0xf060
  403120:	eb 07                	jmp    0x403129
  403122:	8b 45 10             	mov    eax,DWORD PTR [ebp+0x10]
  403125:	48                   	dec    eax
  403126:	74 59                	je     0x403181
  403128:	48                   	dec    eax
  403129:	0f 85 13 01 00 00    	jne    0x403242
  40312f:	6a 00                	push   0x0
  403131:	6a 01                	push   0x1
  403133:	ff 75 08             	push   DWORD PTR [ebp+0x8]
  403136:	e8 df 06 00 00       	call   0x40381a
  40313b:	e9 69 ff ff ff       	jmp    0x4030a9
  403140:	6a 0f                	push   0xf
  403142:	ff 15 a8 d2 40 00    	call   DWORD PTR ds:0x40d2a8
  403148:	50                   	push   eax
  403149:	ff 15 40 d0 40 00    	call   DWORD PTR ds:0x40d040
  40314f:	33 ff                	xor    edi,edi
  403151:	a3 dc 07 41 00       	mov    ds:0x4107dc,eax
  403156:	3b c7                	cmp    eax,edi
  403158:	0f 84 e4 00 00 00    	je     0x403242
  40315e:	ff 75 08             	push   DWORD PTR [ebp+0x8]
  403161:	e8 6f 09 00 00       	call   0x403ad5
  403166:	3b c7                	cmp    eax,edi
  403168:	59                   	pop    ecx
  403169:	a3 e0 07 41 00       	mov    ds:0x4107e0,eax
  40316e:	0f 84 ce 00 00 00    	je     0x403242
  403174:	ff 75 14             	push   DWORD PTR [ebp+0x14]
  403177:	ff 75 08             	push   DWORD PTR [ebp+0x8]
  40317a:	e8 cb 00 00 00       	call   0x40324a
  40317f:	59                   	pop    ecx
  403180:	59                   	pop    ecx
  403181:	6a 01                	push   0x1
  403183:	58                   	pop    eax
  403184:	e9 bb 00 00 00       	jmp    0x403244
  403189:	ff 75 14             	push   DWORD PTR [ebp+0x14]
  40318c:	ff 75 10             	push   DWORD PTR [ebp+0x10]
  40318f:	ff 35 dc 07 41 00    	push   DWORD PTR ds:0x4107dc
  403195:	ff 75 08             	push   DWORD PTR [ebp+0x8]
  403198:	e8 f9 08 00 00       	call   0x403a96
  40319d:	83 c4 10             	add    esp,0x10
  4031a0:	e9 9f 00 00 00       	jmp    0x403244
  4031a5:	83 3d dc 07 41 00 00 	cmp    DWORD PTR ds:0x4107dc,0x0
  4031ac:	0f 84 90 00 00 00    	je     0x403242
  4031b2:	8d 45 f0             	lea    eax,[ebp-0x10]
  4031b5:	50                   	push   eax
  4031b6:	ff 75 08             	push   DWORD PTR [ebp+0x8]
  4031b9:	ff 15 78 d2 40 00    	call   DWORD PTR ds:0x40d278
  4031bf:	ff 35 dc 07 41 00    	push   DWORD PTR ds:0x4107dc
  4031c5:	8d 45 f0             	lea    eax,[ebp-0x10]
  4031c8:	50                   	push   eax
  4031c9:	ff 75 10             	push   DWORD PTR [ebp+0x10]
  4031cc:	ff 15 dc d1 40 00    	call   DWORD PTR ds:0x40d1dc
  4031d2:	eb ad                	jmp    0x403181
  4031d4:	ff 35 cc 07 41 00    	push   DWORD PTR ds:0x4107cc
  4031da:	ff 15 88 d2 40 00    	call   DWORD PTR ds:0x40d288
  4031e0:	33 ff                	xor    edi,edi
  4031e2:	85 c0                	test   eax,eax
  4031e4:	74 23                	je     0x403209
  4031e6:	57                   	push   edi
  4031e7:	ff 35 cc 07 41 00    	push   DWORD PTR ds:0x4107cc
  4031ed:	ff 15 84 d2 40 00    	call   DWORD PTR ds:0x40d284
  4031f3:	a1 cc 07 41 00       	mov    eax,ds:0x4107cc
  4031f8:	3b c7                	cmp    eax,edi
  4031fa:	74 07                	je     0x403203
  4031fc:	50                   	push   eax
  4031fd:	ff 15 bc d1 40 00    	call   DWORD PTR ds:0x40d1bc
  403203:	89 3d cc 07 41 00    	mov    DWORD PTR ds:0x4107cc,edi
  403209:	a1 dc 07 41 00       	mov    eax,ds:0x4107dc
  40320e:	8b 35 14 d0 40 00    	mov    esi,DWORD PTR ds:0x40d014
  403214:	3b c7                	cmp    eax,edi
  403216:	74 03                	je     0x40321b
  403218:	50                   	push   eax
  403219:	ff d6                	call   esi
  40321b:	a1 e0 07 41 00       	mov    eax,ds:0x4107e0
  403220:	3b c7                	cmp    eax,edi
  403222:	74 03                	je     0x403227
  403224:	50                   	push   eax
  403225:	ff d6                	call   esi
  403227:	39 3d c4 07 41 00    	cmp    DWORD PTR ds:0x4107c4,edi
  40322d:	89 3d dc 07 41 00    	mov    DWORD PTR ds:0x4107dc,edi
  403233:	89 3d e0 07 41 00    	mov    DWORD PTR ds:0x4107e0,edi
  403239:	75 07                	jne    0x403242
  40323b:	57                   	push   edi
  40323c:	ff 15 e8 d1 40 00    	call   DWORD PTR ds:0x40d1e8
  403242:	33 c0                	xor    eax,eax
  403244:	5f                   	pop    edi
  403245:	5e                   	pop    esi
  403246:	c9                   	leave
  403247:	c2               	ret    0x10

/home/user/wine-assembly-shadow-man-original-recover-runtime-oct22/scratch/runs/20261022-shadow-man-original-source/ranges/161796096-73728.bin:     file format pei-i386


Disassembly of section .text:

0040381a <.text+0x281a>:
  40381a:	56                   	push   esi
  40381b:	33 f6                	xor    esi,esi
  40381d:	39 74 24 10          	cmp    DWORD PTR [esp+0x10],esi
  403821:	74 12                	je     0x403835
  403823:	8b 35 c8 d0 40 00    	mov    esi,DWORD PTR ds:0x40d0c8
  403829:	ff d6                	call   esi
  40382b:	3b 05 ac 07 41 00    	cmp    eax,DWORD PTR ds:0x4107ac
  403831:	73 1e                	jae    0x403851
  403833:	eb f4                	jmp    0x403829
  403835:	39 74 24 0c          	cmp    DWORD PTR [esp+0xc],esi
  403839:	74 16                	je     0x403851
  40383b:	ff 15 c8 d0 40 00    	call   DWORD PTR ds:0x40d0c8
  403841:	3b 05 b4 07 41 00    	cmp    eax,DWORD PTR ds:0x4107b4
  403847:	72 20                	jb     0x403869
  403849:	39 35 c8 07 41 00    	cmp    DWORD PTR ds:0x4107c8,esi
  40384f:	74 18                	je     0x403869
  403851:	ff 74 24 08          	push   DWORD PTR [esp+0x8]
  403855:	ff 15 88 d2 40 00    	call   DWORD PTR ds:0x40d288
  40385b:	85 c0                	test   eax,eax
  40385d:	74 0a                	je     0x403869
  40385f:	ff 74 24 08          	push   DWORD PTR [esp+0x8]
  403863:	ff 15 bc d1 40 00    	call   DWORD PTR ds:0x40d1bc
  403869:	6a 01                	push   0x1
  40386b:	58                   	pop    eax
  40386c:	5e                   	pop    esi
  40386d:	c3                   	ret

/home/user/wine-assembly-shadow-man-original-recover-runtime-oct22/scratch/runs/20261022-shadow-man-original-source/ranges/161796096-73728.bin:     file format pei-i386


Disassembly of section .text:

004062db <.text+0x52db>:
  4062db:	8b 1d c8 d0 40 00    	mov    ebx,DWORD PTR ds:0x40d0c8
  4062e1:	ff d3                	call   ebx
  4062e3:	8b 2d 4c d2 40 00    	mov    ebp,DWORD PTR ds:0x40d24c
  4062e9:	56                   	push   esi
  4062ea:	8b f8                	mov    edi,eax
  4062ec:	56                   	push   esi
  4062ed:	56                   	push   esi
  4062ee:	8d 44 24 1c          	lea    eax,[esp+0x1c]
  4062f2:	56                   	push   esi
  4062f3:	81 c7 f4 01 00 00    	add    edi,0x1f4
  4062f9:	50                   	push   eax
  4062fa:	ff d5                	call   ebp
  4062fc:	85 c0                	test   eax,eax
  4062fe:	74 6d                	je     0x40636d
  406300:	ff d3                	call   ebx
  406302:	3b c7                	cmp    eax,edi
  406304:	73 67                	jae    0x40636d
  406306:	83 7c 24 14 12       	cmp    DWORD PTR [esp+0x14],0x12
  40630b:	74 54                	je     0x406361
  40630d:	ff 35 cc 0e 41 00    	push   DWORD PTR ds:0x410ecc
  406313:	ff 15 88 d2 40 00    	call   DWORD PTR ds:0x40d288
  406319:	85 c0                	test   eax,eax
  40631b:	75 15                	jne    0x406332
  40631d:	8d 44 24 10          	lea    eax,[esp+0x10]
  406321:	50                   	push   eax
  406322:	ff 35 cc 0e 41 00    	push   DWORD PTR ds:0x410ecc
  406328:	ff 15 40 d2 40 00    	call   DWORD PTR ds:0x40d240
  40632e:	85 c0                	test   eax,eax
  406330:	75 24                	jne    0x406356
  406332:	56                   	push   esi
  406333:	56                   	push   esi
  406334:	8d 44 24 18          	lea    eax,[esp+0x18]
  406338:	56                   	push   esi
  406339:	50                   	push   eax
  40633a:	ff 15 3c d2 40 00    	call   DWORD PTR ds:0x40d23c
  406340:	8d 44 24 10          	lea    eax,[esp+0x10]
  406344:	50                   	push   eax
  406345:	ff 15 44 d2 40 00    	call   DWORD PTR ds:0x40d244
  40634b:	8d 44 24 10          	lea    eax,[esp+0x10]
  40634f:	50                   	push   eax
  406350:	ff 15 48 d2 40 00    	call   DWORD PTR ds:0x40d248
  406356:	56                   	push   esi
  406357:	56                   	push   esi
  406358:	56                   	push   esi
  406359:	8d 44 24 1c          	lea    eax,[esp+0x1c]
  40635d:	56                   	push   esi
  40635e:	50                   	push   eax
  40635f:	eb 99                	jmp    0x4062fa
  406361:	56                   	push   esi
  406362:	ff 15 e8 d1 40 00    	call   DWORD PTR ds:0x40d1e8
  406368:	6a 01                	push   0x1
  40636a:	58                   	pop    eax
  40636b:	eb 02                	jmp    0x40636f
  40636d:	33 c0                	xor    eax,eax
