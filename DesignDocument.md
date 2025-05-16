# [mtgscan.cards](https://mtgscan.cards) – Monolithic Design Documentation

## Stack Overview

* **Frontend**: React + Vite (static SPA)
* **Backend**: Flask (JWT auth, FAISS descriptor matching, database search, collection management)
* **Database**: PostgreSQL (Users, Collections, Cards)
* **Auth**: OAuth (Google/GitHub), JWT (access + refresh cookies)
* **Deployment**: GitHub Actions → Self-hosted runner → Docker Compose
* **Networking**: TLS via Cloudflare DNS + NGINX Proxy Manager

---

## Deployment Workflow

Deployment to production is triggered manually via GitHub Actions (`workflow_dispatch`).

The self-hosted `prod-runner` performs the following:

```bash
git pull origin prod
docker-compose down
docker-compose up -d --build
```

---

## Backup Strategy

* The `cards` table is excluded from regular SQL dumps due to its size.
* Backup is performed manually using:

```bash
docker exec mtg-db pg_dump -U mtguser mtgdb --exclude-table=public.cards > backup/mtgdb_$(date +%F).sql
tar -czf backup/data_$(date +%F).tar.gz inference-backend/data
```

---

## Keypoint Regression System

This system detects the four corners of MTG cards in user-submitted or live webcam frames. It allows perspective rectification before descriptor-based backend matching.

* **Repo**: [simple-mtg-keypoint-regression](https://github.com/JakeTurner616/simple-mtg-keypoint-regression)
* **Export**: TensorFlow\.js model embedded in frontend

### Functionality

* Generates synthetic training data using Scryfall images with random:

  * Backgrounds
  * Perspective distortions
  * Scaling and rotation
* Trains on a ResNet-50-based heatmap regression architecture
* Outputs normalized (0–1024) card corner coordinates
* TensorFlow\.js model is used for in-browser inference

### Role in Production

```text
[Input Image or Webcam Frame]
        ↓
[Keypoint Prediction (TFJS in browser)]
        ↓
[Perspective-rectified ROI]
        ↓
[Descriptor Extraction + FAISS Matching (Backend)]
        ↓
[Matched Scryfall Card ID]
```

---

## Card Descriptor Matching System

The backend provides server-side card ID prediction using FAISS-based nearest-neighbor descriptor matching.

* **Repo \[`production` branch]**: [simple-mtg-feature-extraction](https://github.com/JakeTurner616/simple-mtg-feature-extraction/blob/production)
* **Model Files Hosted On**: [Hugging Face Dataset Page](https://huggingface.co/datasets/JakeTurner616/mtg-cards-SIFT-Features)

> Note: The descriptor resource bundle (`resourcesV4.zip`) is maintained and versioned via Hugging Face. The upstream GitHub project has transitioned from a prototype-style `main` branch to a minified `production` branch. The zipped archive size has been reduced by over 50%.

---

### Responsibilities

* Download card images from Scryfall to memory
* Preprocess (CLAHE → grayscale)
* Extract SIFT features and normalize with RootSIFT
* Store all descriptors into `HDF5` and `.npy` temp batches
* Build and train FAISS IVF-PQ index
* Predict cards using vector similarity searching

---

### Resources Used

| File                    | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `candidate_features.h5` | Stores descriptor + keypoint data per card                |
| `faiss_ivf.index`       | Trained FAISS index with IVF-PQ                           |
| `id_map.json`           | List of Scryfall card IDs aligned to descriptors in index |

These files are bundled and mounted as `resourcesV4.zip` during deployment.

---

### Extraction & Indexing Pipeline

1. **Read card metadata** from PostgreSQL
2. **Download and CLAHE-process** images
3. **Extract SIFT features + RootSIFT normalization**
4. **Batch features** into memory-efficient `.npy` temp files
5. **Store keypoints/descriptors** in `HDF5` using gzip compression
6. **Write mapping to `id_map.json`**
7. **Build FAISS index** if missing or incomplete

---

### Inference Flow

Backend exposes an internal function for top-K card ID prediction given a URL or ROI input image.

```text
Input: Rectified ROI (256x256) image
   ↓
CLAHE + RootSIFT Feature Extraction
   ↓
FAISS Search (kNN over IVF-PQ index)
   ↓
Return most frequent card ID among matches
```

#### Example Output

```json
{
  "input": "https://cards.scryfall.io/large/front/3/3/3394cefd.jpg",
  "top_prediction": "710160a6-43b4-4ba7-9dcd-93e01befc66f",
  "top_k_matches": [
    ["710160a6-43b4-4ba7-9dcd-93e01befc66f", 52],
    ["3a2c1d6e-9985-43f2-82d8-9cd64ccbb187", 11]
  ]
}
```



## Architecture Overview

```mermaid
graph TD

%% Auth
OAuth["OAuth (Google / GitHub)"]

%% API & Logic
Backend["Flask API (JWT, Search, FAISS Matching, Collections)"]
Scheduler["APScheduler (Daily Jobs)"]
Parser["Scryfall JSON Importer"]

%% Data
Database["PostgreSQL (Docker Volume)"]
ScryfallData["/data (Bulk JSON)"]

%% CI/CD
GitHub["GitHub Actions"]
Runner["Self-Hosted Runner (prod)"]

%% Infra
Nginx["NGINX Proxy Manager (Host-Level)"]
Docker["Docker Compose"]
Server["Hosted Server"]

%% User Flow
Frontend["Vite Frontend (SPA Static Site)"]
Frontend -->|API Calls| Backend
Frontend -->|OAuth Redirects| OAuth
OAuth --> Backend

%% Backend Links
Backend --> Database
Scheduler --> Database
Parser --> Database
Parser --> ScryfallData

%% CI/CD Flow
GitHub -->|workflow_dispatch| Runner
Runner -->|Pull + Deploy| Server
Server --> Docker --> Backend
Server --> Nginx --> Backend

%% Hosting
Frontend -->|Static| Cloudflare
```