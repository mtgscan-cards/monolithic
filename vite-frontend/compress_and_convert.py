import os
from pathlib import Path

# Path to the PNG image directory
IMG_DIR = Path("C:/Users/jaked/Documents/vite-web-app/vite-frontend/public/cards/imgs/cards")

# Find and delete all .png files in the directory
deleted = 0
for png_file in IMG_DIR.glob("*.png"):
    try:
        png_file.unlink()
        print(f"🗑️ Deleted: {png_file.name}")
        deleted += 1
    except Exception as e:
        print(f"⚠️ Error deleting {png_file.name}: {e}")

print(f"✅ Finished. Deleted {deleted} PNG files.")