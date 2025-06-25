import os
import requests
import shutil

# Config
API_URL = 'http://localhost:5000/api/cards/random?limit=50'
FRONT_DIR = './vite-frontend/public/cards/imgs/cards'
CARD_BACK_SRC = './vite-frontend/public/img/Magic_card_back.png'
CARD_COUNT = 50

def download_image(url, dest_path):
    try:
        response = requests.get(url, stream=True, timeout=10)
        response.raise_for_status()
        with open(dest_path, 'wb') as f:
            for chunk in response.iter_content(8192):
                f.write(chunk)
        print(f"⬇️  Downloaded front → {dest_path}")
    except Exception as e:
        print(f"❌ Failed to download {url} → {dest_path}: {e}")

def copy_back_image(i):
    dest_path = os.path.join(FRONT_DIR, f"{i:03}-back.png")
    try:
        shutil.copyfile(CARD_BACK_SRC, dest_path)
        print(f"📎 Copied back → {dest_path}")
    except Exception as e:
        print(f"❌ Failed to copy back image → {dest_path}: {e}")

def main():
    if not os.path.isfile(CARD_BACK_SRC):
        print(f"❌ Missing back image file at: {CARD_BACK_SRC}")
        return

    os.makedirs(FRONT_DIR, exist_ok=True)

    print(f"🔍 Fetching {CARD_COUNT} random cards from {API_URL}")
    try:
        response = requests.get(API_URL)
        response.raise_for_status()
        results = response.json().get('results', [])
    except Exception as e:
        print(f"❌ Failed to fetch random cards: {e}")
        return

    if len(results) < CARD_COUNT:
        print(f"⚠️ Warning: only received {len(results)} cards")

    for i, card in enumerate(results[:CARD_COUNT]):
        front_url = card.get('image_uris', {}).get('png')
        if not front_url:
            print(f"⚠️ Skipping card missing front image: {card.get('name', 'Unknown')}")
            continue

        front_path = os.path.join(FRONT_DIR, f"{i:03}-front.png")
        download_image(front_url, front_path)
        copy_back_image(i)

    print("✅ All card face and back images updated.")

if __name__ == '__main__':
    main()
