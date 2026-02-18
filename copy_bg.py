#!/usr/bin/env python3
import shutil
import os

src = r'c:\Users\jeswi\AppData\Roaming\Code\User\globalStorage\github.copilot-chat\copilot-cli-images\1771405886916-uahjjbhx.png'
dest = r'c:\Users\jeswi\Desktop\summsa\background.jpg'

try:
    shutil.copy(src, dest)
    print("✓ background.jpg copied successfully!")
    if os.path.exists(dest):
        print("✓ File verified in destination")
except Exception as e:
    print(f"Error: {e}")
