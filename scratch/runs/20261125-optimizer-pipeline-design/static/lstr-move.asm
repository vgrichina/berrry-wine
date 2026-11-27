--- 0x405934 ---
00405934  8b 10                        mov edx, [eax]
00405936  85 d2                        test edx, edx
00405938  74 1c                        jz short 0x405956
0040593a  c7 00 00 00 00 00            mov dword [eax], 0x0
00405940  8b 4a f8                     mov ecx, [edx-0x8]
00405943  49                           dec ecx
00405944  7c 10                        jl short 0x405956
00405946  f0                           db 0xf0
00405947  ff 4a f8                     dec [edx-0x8]
0040594a  75 0a                        jnz short 0x405956
0040594c  50                           push eax
0040594d  8d 42 f8                     lea eax, [edx-0x8]
00405950  e8 5f d4 ff ff               call 0x402db4
00405955  58                           pop eax
00405956  c3                           ret
--- 0x405988 ---
00405988  85 d2                        test edx, edx
0040598a  74 24                        jz short 0x4059b0
0040598c  8b 4a f8                     mov ecx, [edx-0x8]
0040598f  41                           inc ecx
00405990  7f 1a                        jg short 0x4059ac
00405992  50                           push eax
00405993  52                           push edx
00405994  8b 42 fc                     mov eax, [edx-0x4]
00405997  e8 5c 00 00 00               call 0x4059f8
0040599c  89 c2                        mov edx, eax
0040599e  58                           pop eax
0040599f  52                           push edx
004059a0  8b 48 fc                     mov ecx, [eax-0x4]
004059a3  e8 00 d7 ff ff               call 0x4030a8
004059a8  5a                           pop edx
004059a9  58                           pop eax
004059aa  eb 04                        jmp short 0x4059b0
004059ac  f0                           db 0xf0
004059ad  ff 42 f8                     inc [edx-0x8]
004059b0  87 10                        xchg [eax], edx
004059b2  85 d2                        test edx, edx
004059b4  74 14                        jz short 0x4059ca
004059b6  8b 4a f8                     mov ecx, [edx-0x8]
004059b9  49                           dec ecx
004059ba  7c 0e                        jl short 0x4059ca
004059bc  f0                           db 0xf0
004059bd  ff 4a f8                     dec [edx-0x8]
004059c0  75 08                        jnz short 0x4059ca
004059c2  8d 42 f8                     lea eax, [edx-0x8]
004059c5  e8 ea d3 ff ff               call 0x402db4
--- 0x4030a8 ---
004030a8  39 d0                        cmp eax, edx
004030aa  74 31                        jz short 0x4030dd
004030ac  83 f9 20                     cmp dword ecx, 0x20
004030af  77 7c                        ja short 0x40312d
004030b1  83 e9 08                     sub dword ecx, 0x8
004030b4  7f 07                        jg short 0x4030bd
004030b6  ff 24 8d 00 31 40 00         jmp [0x403100+ecx*4]
