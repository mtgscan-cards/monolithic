import os
import json
import requests
import zipfile
from tqdm import tqdm
import faiss
import h5py
from filelock import FileLock
import logging

logger = logging.getLogger(__name__)

RESOURCE_DIR = "/app/resources"
LOCK_DIR = "/tmp/locks"
LOCK_PATH = os.path.join(LOCK_DIR, "resource_download.lock")

def _resource_files_exist():
    run_dir = os.path.join(RESOURCE_DIR, "run")
    faiss_path = os.path.join(run_dir, "faiss_ivf.index")
    h5_path = os.path.join(run_dir, "candidate_features.h5")
    map_path = os.path.join(run_dir, "id_map.json")
    return all(os.path.exists(p) for p in [faiss_path, h5_path, map_path])

def download_and_extract_resources():
    run_dir = os.path.join(RESOURCE_DIR, "run")
    url = "https://huggingface.co/datasets/JakeTurner616/mtg-cards-SIFT-Features/resolve/main/resourcesV4.zip?download=true"
    zip_path = os.path.join(RESOURCE_DIR, "resources.zip")

    logger.info("Resource files missing. Downloading...")
    os.makedirs(RESOURCE_DIR, exist_ok=True)

    response = requests.get(url, stream=True)
    if response.status_code == 200:
        total_size = int(response.headers.get('content-length', 0))
        with open(zip_path, "wb") as f, tqdm(total=total_size, unit='B', unit_scale=True, desc="Downloading resources") as pbar:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    pbar.update(len(chunk))
        logger.info("Download complete. Extracting resources...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(RESOURCE_DIR)
        os.remove(zip_path)
        logger.info("Resources extracted to", RESOURCE_DIR)
    else:
        raise Exception(f"Failed to download resources. Status code: {response.status_code}")

def download_and_extract_resources_once():
    os.makedirs(LOCK_DIR, exist_ok=True)
    with FileLock(LOCK_PATH, timeout=600):
        if not _resource_files_exist():
            download_and_extract_resources()
        else:
            logger.info("Resource files already present. Skipping download.")

def load_resources():
    download_and_extract_resources_once()

    logger.info("Loading FAISS index and HDF5 features...")
    run_dir = os.path.join(RESOURCE_DIR, "run")
    faiss_path = os.path.join(run_dir, "faiss_ivf.index")
    h5_path = os.path.join(run_dir, "candidate_features.h5")
    map_path = os.path.join(run_dir, "id_map.json")

    assert os.path.exists(faiss_path), f"FAISS index missing at {faiss_path}"
    assert os.path.exists(h5_path), f"HDF5 file missing at {h5_path}"
    assert os.path.exists(map_path), f"id_map.json missing at {map_path}"

    faiss_index = faiss.read_index(faiss_path)
    hf = h5py.File(h5_path, 'r')
    with open(map_path, 'r') as f:
        id_map = json.load(f)

    logger.info("FAISS index ntotal:", faiss_index.ntotal)
    logger.info("ID map length:", len(id_map))
    logger.info("HDF5 groups loaded:", len(hf.keys()))
    
    assert len(id_map) == faiss_index.ntotal, "Mismatch between id_map and FAISS index"

    return faiss_index, hf, id_map