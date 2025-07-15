import os
import time
import threading
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from .model_state import model_lock, model_resources

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

MODEL_DIR = os.path.abspath("resources/run")
WATCHED_FILES = {
    "faiss_ivf.index",
    "candidate_features.h5",
    "id_map.json"
}

DEBOUNCE_SECONDS = 2.0  # Debounce delay to group rapid changes

class ModelFileHandler(FileSystemEventHandler):
    def __init__(self):
        super().__init__()
        self.lock = threading.Lock()
        self.debounce_timer = None
        self.last_mtimes = {}  # Track last modification times

    def _trigger_reload(self):
        logger.info("🔄 Watchdog marking reload_needed flag for next inference.")
        with model_lock:
            model_resources["reload_needed"] = True

    def _debounce_reload(self):
        with self.lock:
            if self.debounce_timer:
                self.debounce_timer.cancel()
            self.debounce_timer = threading.Timer(DEBOUNCE_SECONDS, self._trigger_reload)
            self.debounce_timer.start()

    def on_any_event(self, event):
        if event.is_directory:
            return
        fname = os.path.basename(event.src_path)
        if fname in WATCHED_FILES:
            try:
                current_mtime = os.path.getmtime(event.src_path)
                last_mtime = self.last_mtimes.get(fname)

                if last_mtime != current_mtime:
                    self.last_mtimes[fname] = current_mtime
                    logger.info(f"✅ Model file changed: {fname} (mtime updated). Requesting reload.")
                    self._debounce_reload()
                else:
                    logger.debug(f"ℹ️ Model file {fname} event detected, but mtime unchanged. Ignoring.")

            except FileNotFoundError:
                logger.warning(f"⚠️ File {event.src_path} not found during mtime check.")

def start_model_file_watchdog():
    handler = ModelFileHandler()
    observer = Observer()
    observer.schedule(handler, path=MODEL_DIR, recursive=False)
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
