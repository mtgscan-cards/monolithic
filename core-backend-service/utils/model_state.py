# utils/model_state.py
# Centralized store for the current loaded model resources.

from threading import Lock

# Global lock for safe model access across threads (e.g. reload during watchdog)
model_lock = Lock()

# Loaded model resources (FAISS index, HDF5 file, ID map)
model_resources = {
    "faiss_index": None,
    "hdf5_file": None,
    "id_map": None
}