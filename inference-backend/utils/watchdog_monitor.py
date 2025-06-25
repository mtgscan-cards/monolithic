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

class ModelFileHandler(FileSystemEventHandler):
    def __init__(self, on_change_callback):
        super().__init__()
        self.on_change_callback = on_change_callback
        self.pending_changes = set()
        self.lock = threading.Lock()
        self.debounce_timer = None

    def _trigger_reload(self):
        with self.lock:
            changed_files = self.pending_changes.copy()
            self.pending_changes.clear()
        logger.info(f"Model files changed: {changed_files}. Triggering reload.")
        with model_lock:
            self.on_change_callback()

    def _debounce_reload(self):
        if self.debounce_timer:
            self.debounce_timer.cancel()
        self.debounce_timer = threading.Timer(0.25, self._trigger_reload)
        self.debounce_timer.start()

    def on_modified(self, event):
        if not event.is_directory and os.path.basename(event.src_path) in WATCHED_FILES:
            with self.lock:
                self.pending_changes.add(os.path.basename(event.src_path))
            self._debounce_reload()

    def on_created(self, event):
        self.on_modified(event)

    def on_moved(self, event):
        self.on_modified(event)

def start_model_file_watchdog(on_change_callback):
    event_handler = ModelFileHandler(on_change_callback)
    observer = Observer()
    observer.schedule(event_handler, path=MODEL_DIR, recursive=False)
    observer.start()
    logger.info(f"Watchdog started for model directory: {MODEL_DIR}")

    def monitor_loop():
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            observer.stop()
        observer.join()

    threading.Thread(target=monitor_loop, daemon=True).start()
