#!/usr/bin/env python3
"""Create a minimal valid ICO file"""

import os
import struct

# ICO header
# 0-1: Reserved (0)
# 2-3: Type (1 = ICO)
# 4-5: Count (1 image)
ico_header = struct.pack('<HHH', 0, 1, 1)

# ICONDIRENTRY for 16x16 24-bit BMP
# 0: Width (16)
# 1: Height (16)
# 2: Colors (0 = >256)
# 3: Reserved (0)
# 4-5: Color planes (1)
# 6-7: Bits per pixel (24)
# 8-11: Size of image data
# 12-15: Offset to image data
dir_entry = struct.pack('<BBBBHHII', 16, 16, 0, 0, 1, 24, 0, 22)

# BMP header for 16x16 24-bit
bmp_header = struct.pack('<IiiHHIIiiII', 40, 16, 32, 1, 24, 0, 0, 0, 0, 0, 0)

# Pixel data (16x16 * 3 bytes = 768 bytes, but needs padding for 4-byte alignment)
# Each row: 16 pixels * 3 bytes = 48 bytes (already aligned)
row_size = 16 * 3
pixel_data = bytes([99, 102, 241] * 16)  # Blue row
pixel_data = pixel_data * 16  # 16 rows

# XOR mask (1 bit per pixel = 16 bits = 2 bytes per row, padded to 4 bytes = 4 bytes per row)
xor_mask = bytes([255, 255, 255, 255] * 16)  # All visible

# AND mask (same as XOR)
and_mask = bytes([0, 0, 0, 0] * 16)  # All not transparent

# Combine image data
image_data = bmp_header + pixel_data + xor_mask + and_mask

# Update size in dir_entry
dir_entry = struct.pack('<BBBBHHII', 16, 16, 0, 0, 1, 24, len(image_data), 22)

# Write ICO file
ico_path = 'E:/Self Built Web and Mobile Apps/Space Analyzer/src-tauri/icons/icon.ico'
os.makedirs(os.path.dirname(ico_path), exist_ok=True)

with open(ico_path, 'wb') as f:
    f.write(ico_header)
    f.write(dir_entry)
    f.write(image_data)

print(f'Created {ico_path} ({os.path.getsize(ico_path)} bytes)')
