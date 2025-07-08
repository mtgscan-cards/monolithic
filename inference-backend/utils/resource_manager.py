import os
import json
import faiss
import h5py
import logging
from filelock import FileLock
from utils.model_state import model_resources, model_lock

logger = logging.getLogger(__name__)

RESOURCE_DIR = "/app/resources"
LOCK_DIR = "/tmp/locks"
LOCK_PATH = os.path.join(LOCK_DIR, "resource_download.lock")

def _resource_files_exist():
    run_dir = os.path.join(RESOURCE_DIR, "run")
    return all(os.path.exists(os.path.join(run_dir, f)) for f in [
        "faiss_ivf.index",
        "candidate_features.h5",
        "id_map.json"
    ])

def download_and_extract_resources_once():
    os.makedirs(LOCK_DIR, exist_ok=True)
    with FileLock(LOCK_PATH, timeout=600):
        if not _resource_files_exist():
            logger.error("Resource files missing and auto-download not configured here.")
        else:
            logger.info("Resource files already present. Skipping download.")

def load_resources():
    download_and_extract_resources_once()

    run_dir = os.path.join(RESOURCE_DIR, "run")
    faiss_path = os.path.join(run_dir, "faiss_ivf.index")
    h5_path = os.path.join(run_dir, "candidate_features.h5")
    map_path = os.path.join(run_dir, "id_map.json")

    faiss_index = faiss.read_index(faiss_path)
    hf = h5py.File(h5_path, 'r')
    with open(map_path, 'r') as f:
        id_map = json.load(f)

    with model_lock:
        # Cleanly close old HDF5 if needed
        if model_resources.get("hdf5_file"):
            try:
                model_resources["hdf5_file"].close()
            except Exception as e:
                logger.warning(f"Error closing old HDF5: {e}")

        # Hot-swap model resources
        model_resources["faiss_index"] = faiss_index
        model_resources["hdf5_file"] = hf
        model_resources["id_map"] = id_map
        model_resources["reload_needed"] = False  # Clear reload flag

    logger.info("✅ Model resources loaded: FAISS ntotal=%d, ID map=%d, HDF5 groups=%d",
                faiss_index.ntotal, len(id_map), len(hf.keys()))

    # Watchdog should only start once, globally
    if not getattr(load_resources, "_watchdog_started", False):
        from utils.watchdog_monitor import start_model_file_watchdog
        start_model_file_watchdog()  # ✅ fixed: no argument passed
        load_resources._watchdog_started = True

    return faiss_index, hf, id_map
