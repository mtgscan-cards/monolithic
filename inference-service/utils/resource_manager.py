import os
import json
import faiss
import h5py
import logging
import requests
import zipfile
import tempfile
from filelock import FileLock
from utils.model_state import model_resources, model_lock

logger = logging.getLogger(__name__)

RESOURCE_DIR = "/app/resources"
RUN_DIR = os.path.join(RESOURCE_DIR, "run")
LOCK_DIR = "/tmp/locks"
LOCK_PATH = os.path.join(LOCK_DIR, "resource_download.lock")
HF_ZIP_URL = "https://huggingface.co/datasets/JakeTurner616/mtg-cards-SIFT-Features/resolve/main/resources-nightly.zip?download=true"

EXPECTED_FILES = [
    "faiss_ivf.index",
    "candidate_features.h5",
    "id_map.json"
]

def _resource_files_exist():
    exists = all(os.path.exists(os.path.join(RUN_DIR, f)) for f in EXPECTED_FILES)
    logger.debug(f"Checking for expected resource files in {RUN_DIR}: {EXPECTED_FILES} -> {exists}")
    return exists

import shutil

def _download_and_extract_zip():
    try:
        logger.info("🪵 Preparing to create temporary file for download...")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp_file:
            logger.info("✅ Temporary file created successfully, proceeding to download...")
            tmp_zip_path = tmp_file.name

            logger.info(f"⬇️ Starting descriptor resources download from Hugging Face: {HF_ZIP_URL}")
            response = requests.get(HF_ZIP_URL, stream=True, timeout=60)
            response.raise_for_status()

            total_downloaded = 0
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    tmp_file.write(chunk)
                    total_downloaded += len(chunk)
                    if total_downloaded % (1024 * 1024 * 10) < 8192:
                        logger.info(f"⬇️ Downloaded {total_downloaded / (1024 * 1024):.2f} MB so far...")

            tmp_file.flush()

        logger.info(f"📦 Download complete ({total_downloaded / (1024 * 1024):.2f} MB). Extracting resources...")

        with zipfile.ZipFile(tmp_zip_path, 'r') as zip_ref:
            extract_path = "/app/resources/tmp_extracted"
            os.makedirs(extract_path, exist_ok=True)
            zip_ref.extractall(extract_path)

        os.remove(tmp_zip_path)
        logger.info("✅ Extraction complete. Moving descriptor resources into /app/resources/run/.")

        os.makedirs(RUN_DIR, exist_ok=True)
        for filename in EXPECTED_FILES:
            src = os.path.join(extract_path, filename)
            dst = os.path.join(RUN_DIR, filename)
            if os.path.exists(src):
                shutil.move(src, dst)
                logger.info(f"✅ Moved {filename} to {dst}")
            else:
                logger.error(f"❌ Expected file {filename} not found in extracted ZIP.")

        shutil.rmtree(extract_path)
        logger.info("✅ Resource preparation complete.")

    except Exception as e:
        logger.error(f"❌ Failed to download or extract descriptor resources: {e}")
        raise RuntimeError(f"Descriptor resource download failed: {e}")


def download_and_extract_resources_once():
    os.makedirs(LOCK_DIR, exist_ok=True)
    with FileLock(LOCK_PATH, timeout=600):  # 10-minute lock for first-time initialization
        if _resource_files_exist():
            logger.info("✅ Descriptor resource files already present. Skipping Hugging Face download.")
            return
        logger.warning("⚠️ Descriptor resources missing. Attempting download from Hugging Face fallback.")
        try:
            _download_and_extract_zip()
        except Exception as e:
            logger.error(f"❌ Exception in _download_and_extract_zip: {e}", exc_info=True)
            raise

        if not _resource_files_exist():
            logger.error("❌ Resources still missing after extraction. Check archive structure.")
            raise RuntimeError("Descriptor resources missing after extraction.")
        logger.info("✅ Descriptor resources downloaded and extracted successfully.")

def load_resources():
    logger.info("🚀 Starting model resource loading...")
    download_and_extract_resources_once()

    faiss_path = os.path.join(RUN_DIR, "faiss_ivf.index")
    h5_path = os.path.join(RUN_DIR, "candidate_features.h5")
    map_path = os.path.join(RUN_DIR, "id_map.json")

    logger.info("📖 Loading FAISS index...")
    faiss_index = faiss.read_index(faiss_path)
    logger.info("📖 Loading HDF5 feature file...")
    hf = h5py.File(h5_path, 'r')
    logger.info("📖 Loading ID map JSON...")
    with open(map_path, 'r') as f:
        id_map = json.load(f)

    with model_lock:
        if model_resources.get("hdf5_file"):
            try:
                model_resources["hdf5_file"].close()
            except Exception as e:
                logger.warning(f"⚠️ Error closing old HDF5: {e}")

        model_resources["faiss_index"] = faiss_index
        model_resources["hdf5_file"] = hf
        model_resources["id_map"] = id_map
        model_resources["reload_needed"] = False

    logger.info(
        "✅ Model resources loaded successfully: FAISS ntotal=%d | ID map=%d entries | HDF5 groups=%d",
        faiss_index.ntotal,
        len(id_map),
        len(hf.keys())
    )

    if not getattr(load_resources, "_watchdog_started", False):
        from utils.watchdog_monitor import start_model_file_watchdog
        start_model_file_watchdog()
        load_resources._watchdog_started = True

    return faiss_index, hf, id_map
