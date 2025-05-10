import os
import requests
import zipfile
import shutil
from tqdm import tqdm
import sqlite3
import pandas as pd
import faiss
import h5py
from filelock import FileLock, Timeout

RESOURCE_DIR = os.path.abspath("resources")
LOCK_DIR = "/tmp/locks"
LOCK_PATH = os.path.join(LOCK_DIR, "resource_download.lock")

def download_and_extract_resources():
    run_dir = os.path.join(RESOURCE_DIR, "run")
    if not os.path.exists(run_dir):
        os.makedirs(RESOURCE_DIR, exist_ok=True)
        url = "https://huggingface.co/datasets/JakeTurner616/mtg-cards-SIFT-Features/resolve/main/resourcesV3.zip?download=true"
        zip_path = os.path.join(RESOURCE_DIR, "resources.zip")
        print("Downloading resources...")
        response = requests.get(url, stream=True)
        if response.status_code == 200:
            total_size = int(response.headers.get('content-length', 0))
            with open(zip_path, "wb") as f, tqdm(total=total_size, unit='B', unit_scale=True, desc="Downloading resources") as pbar:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        pbar.update(len(chunk))
            print("Download complete. Extracting resources...")
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                members = zip_ref.infolist()
                common_prefix = os.path.commonprefix([m.filename for m in members])
                if common_prefix.endswith("/") or common_prefix.endswith("\\"):
                    for member in tqdm(members, desc="Extracting resources"):
                        member_path = member.filename
                        new_path = os.path.relpath(member_path, common_prefix)
                        target_path = os.path.join(RESOURCE_DIR, new_path)
                        if member.is_dir():
                            os.makedirs(target_path, exist_ok=True)
                        else:
                            os.makedirs(os.path.dirname(target_path), exist_ok=True)
                            with zip_ref.open(member) as source, open(target_path, "wb") as target:
                                shutil.copyfileobj(source, target)
                else:
                    for member in tqdm(members, desc="Extracting resources"):
                        zip_ref.extract(member, RESOURCE_DIR)
            os.remove(zip_path)
            print("Resources extracted to", RESOURCE_DIR)
        else:
            raise Exception(f"Failed to download resources. Status code: {response.status_code}")
    else:
        print("Resources already exist.")

def download_and_extract_resources_once():
    os.makedirs(LOCK_DIR, exist_ok=True)
    with FileLock(LOCK_PATH, timeout=600):
        download_and_extract_resources()

def load_resources():
    download_and_extract_resources_once()
    hf = h5py.File(os.path.join(RESOURCE_DIR, "run", "candidate_features.h5"), 'r')
    conn = sqlite3.connect(os.path.join(RESOURCE_DIR, "run", "card_database.db"))
    label_mapping = pd.read_sql_query("SELECT * FROM cards", conn)
    mapping_df = pd.read_sql_query("SELECT * FROM faiss_mapping", conn)
    conn.close()
    faiss_index = faiss.read_index(os.path.join(RESOURCE_DIR, "run", "faiss_ivf.index"))
    mapping_df = mapping_df.sort_values("faiss_index")
    index_to_card = mapping_df["scryfall_id"].tolist()
    print("Resources loaded.")
    return faiss_index, hf, label_mapping, index_to_card
