--- 0x529290 ---
00529290  ff 8b 1d e4 f6 58            dec [ebx+0x58f6e41d]
00529296  00 8b c3 8b d6 8b            add [ebx+0x8bd68bc3], cl
0052929c  0d f0 36 54 00               or eax, 0x5436f0
005292a1  e8 a6 d4 ed ff               call 0x40674c
005292a6  83 c3 18                     add dword ebx, 0x18
005292a9  83 c6 18                     add dword esi, 0x18
005292ac  4f                           dec edi
005292ad  75 e8                        jnz short 0x529297
005292af  33 c0                        xor eax, eax
005292b1  5a                           pop edx
005292b2  59                           pop ecx
005292b3  59                           pop ecx
--- 0x529195 ---
00529195  fe ff                        dec byte bh
00529197  ff 8b c3 8b d6 8b            dec [ebx+0x8bd68bc3]
0052919d  0d f0 36 54 00               or eax, 0x5436f0
005291a2  e8 a5 d5 ed ff               call 0x40674c
005291a7  83 c3 18                     add dword ebx, 0x18
005291aa  83 c6 18                     add dword esi, 0x18
005291ad  4f                           dec edi
005291ae  75 e8                        jnz short 0x529198
005291b0  8b 7d 14                     mov edi, [ebp+0x14]
005291b3  4f                           dec edi
005291b4  85 ff                        test edi, edi
005291b6  7c 22                        jl short 0x5291da
--- 0x4a8a78 ---
004a8a78  56                           push esi
004a8a79  08 8b 0d f0 36 54            or [ebx+0x5436f00d], cl
004a8a7f  00 e8                        add al, ch
004a8a81  c7 dc f5 ff eb 7b            mov dword esp, 0x7bebfff5
004a8a87  8b 45 fc                     mov eax, [ebp-0x4]
004a8a8a  b9 00 7d 00 00               mov ecx, 0x7d00
004a8a8f  99                           cdq
004a8a90  f7 f9                        idiv ecx
004a8a92  8b d8                        mov ebx, eax
004a8a94  8b 45 fc                     mov eax, [ebp-0x4]
004a8a97  b9 00 7d 00 00               mov ecx, 0x7d00
004a8a9c  99                           cdq
--- 0x52789c ---
0052789c  c7 8d 53 10 8b 0d f0 36 54 00 mov dword [ebp+0xd8b1053], 0x5436f0
005278a6  e8 a1 ee ed ff               call 0x40674c
005278ab  eb 47                        jmp short 0x5278f4
005278ad  8b cf                        mov ecx, edi
005278af  8b d3                        mov edx, ebx
005278b1  e8 0a ff ff ff               call 0x5277c0
005278b6  8b f0                        mov esi, eax
005278b8  eb 3a                        jmp short 0x5278f4
005278ba  8b cf                        mov ecx, edi
005278bc  8b d3                        mov edx, ebx
005278be  e8 b9 fe ff ff               call 0x52777c
005278c3  8b f0                        mov esi, eax
