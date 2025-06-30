# inference-backend/descriptor_update/upload_to_hf.py

import os
import zipfile
from datetime import datetime, timezone
from huggingface_hub import HfApi

def upload_descriptor_bundle_to_hf():
    hf_token = os.getenv("HF_UPLOAD_TOKEN")
    if not hf_token:
        print("❌ HF_UPLOAD_TOKEN not set. Skipping Hugging Face upload.")
        return

    api = HfApi(token=hf_token)
    repo_id = "JakeTurner616/mtg-cards-SIFT-Features"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    commit_message = f"Overwrite resources-nightly.zip ({today})"

    # Files to zip
    files_to_zip = [
        ("resources/run/candidate_features.h5", "candidate_features.h5"),
        ("resources/run/faiss_ivf.index", "faiss_ivf.index"),
        ("resources/run/id_map.json", "id_map.json"),
    ]

    zip_name = "resources-nightly.zip"
    with zipfile.ZipFile(zip_name, 'w', compression=zipfile.ZIP_DEFLATED) as zipf:
        for local_path, arcname in files_to_zip:
            if os.path.exists(local_path):
                zipf.write(local_path, arcname)
                print(f"✅ Added {arcname} to {zip_name}")
            else:
                print(f"⚠️ Skipped {local_path} (file not found)")

    # Upload, always to same path to overwrite
    api.upload_file(
        path_or_fileobj=zip_name,
        path_in_repo=zip_name,  # => resources-nightly.zip at repo root
        repo_id=repo_id,
        repo_type="dataset",
        commit_message=commit_message,
    )
    print(f"✅ Uploaded {zip_name} → Overwrites same path in Hugging Face repo.")

    # Local cleanup
    os.remove(zip_name)
    print("🧹 Cleaned up local zip file.")

if __name__ == "__main__":
    upload_descriptor_bundle_to_hf()
