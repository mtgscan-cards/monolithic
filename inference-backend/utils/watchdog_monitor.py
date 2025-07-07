import os
import time
import threading
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from .model_state import model_lock

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

MODEL_DIR = os.path.abspath("resources/run")
WATCHED_FILES = {
    "faiss_ivf.index",
    "candidate_features.h5",
    "id_map.json"
}

DEBOUNCE_SECONDS = 2.0  # Wait this long after last change before triggering reload

class ModelFileHandler(FileSystemEventHandler):
    def __init__(self, on_change_callback):
        super().__init__()
        self.on_change_callback = on_change_callback
        self.pending_changes = set()
        self.lock = threading.Lock()
        self.debounce_timer = None

    def _all_files_ready(self):
        """
        Ensure all watched files exist in the MODEL_DIR before reloading.
        """
        return all(os.path.exists(os.path.join(MODEL_DIR, fname)) for fname in WATCHED_FILES)

    def _trigger_reload(self):
        with self.lock:
            changed_files = self.pending_changes.copy()
            self.pending_changes.clear()

        if not self._all_files_ready():
            logger.info(f"Model files changed: {changed_files}, but not all files are ready yet. Waiting...")
            return  # Wait for next debounce cycle

        logger.info(f"Model files changed: {changed_files}. All required files present. Triggering reload.")
        with model_lock:
            try:
                self.on_change_callback()
            except Exception as e:
                logger.error(f"❌ Reload callback failed: {e}")

    def _debounce_reload(self):
        if self.debounce_timer:
            self.debounce_timer.cancel()
        self.debounce_timer = threading.Timer(DEBOUNCE_SECONDS, self._trigger_reload)
        self.debounce_timer.start()

    def on_any_event(self, event):
        if event.is_directory:
            return
        fname = os.path.basename(event.src_path)
        if fname in WATCHED_FILES:
            with self.lock:
                self.pending_changes.add(fname)
            self._debounce_reload()

def start_model_file_watchdog(on_change_callback):
    """
    Starts the watchdog in a background daemon thread, watching for changes
    to model files and reloading only when all files are present and stable.
    """
    event_handler = ModelFileHandler(on_change_callback)
    observer = Observer()
    observer.schedule(event_handler, path=MODEL_DIR, recursive=False)
    observer.start()
    logger.info(f"✅ Watchdog started for model directory: {MODEL_DIR}")

    def monitor_loop():
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            observer.stop()
        observer.join()

    threading.Thread(target=monitor_loop, daemon=True).start()
