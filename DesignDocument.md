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

### Backend Deployment

* **Target:** Production server (self-hosted)
* **Triggered by:** Manual `workflow_dispatch` on the `prod` branch
* **Runner:** `prod-runner` (self-hosted)
* **Steps:**

  ```bash
  git pull origin prod
  docker-compose down
  docker-compose up -d --build
  ```
* **Deploys:**

  * Flask API
  * PostgreSQL
  * Background jobs (e.g. `scryfall_update.py`)
  * Mounts volumes for card data and database

---

### Frontend Deployment

* **Target:** Cloudflare Pages
* **Triggered by:** Manual `workflow_dispatch` on the `main` branch
* **Runner:** GitHub-hosted runner
* **Steps:**

  * GitHub Actions builds the frontend with Vite
  * Output is deployed to Cloudflare Pages via:

    * Native GitHub → Cloudflare Pages integration, **or**
    * `wrangler pages deploy dist` if using a CLI-based flow
* **Deploys:**

  * Static frontend assets
  * Hosted globally via Cloudflare's CDN

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
graph LR

%% === CLIENT (LEFT) ===
User["User"]
SPA["SPA (React + Vite)"]
Worker["WebWorker (OpenCV + TF.js)"]
Model["Keypoint regression (Card ROI)"]
FrontendHost["Cloudflare Pages"]

User --> SPA --> Worker --> Model
SPA -->|Static Assets| FrontendHost

%% === BACKEND API ===
API["Flask API: /auth /collections /infer /search"]
Utils["utils.py (CORS, JWT, SIFT)"]
API --> Utils

SPA -->|REST API| API

%% === DATABASE ===
PG[(PostgreSQL DB)]
Pool["pg_pool.py"]
API --> Pool --> PG

%% === BACKGROUND JOB ===
ScryfallJob["scryfall_update.py"]
ScryfallJob -->|Import Cards| PG

%% === EXTERNAL ===
OAuthGoogle["Google OAuth"]
OAuthGitHub["GitHub OAuth"]
hCaptcha["hCaptcha"]
Scryfall["Scryfall API"]

API --> OAuthGoogle
API --> OAuthGitHub
API --> hCaptcha
ScryfallJob --> Scryfall

%% === CI/CD + INFRA (RIGHT) ===
CI["GitHub Actions"]
Runner["Self-Hosted Runner (Backend)"]
RunnerCF["GitHub-Hosted Runner (Frontend)"]
Compose["Docker Compose"]
Maint["backup.sh + import_cards.py"]

CI --> Runner --> Compose
CI -->|Push to main| RunnerCF -->|Deploy| FrontendHost
Compose --> API
Compose --> PG
Maint --> PG

%% === STYLES ===
classDef client fill:#5dade2,stroke:#1b4f72,color:#000;
classDef backend fill:#ffd966,stroke:#7d6608,color:#000;
classDef db fill:#f5b041,stroke:#873600,color:#000;
classDef external fill:#bb8fce,stroke:#512e5f,color:#000;
classDef infra fill:#aab7b8,stroke:#2c3e50,color:#000;
classDef frontend fill:#58d68d,stroke:#145a32,color:#000;

class User,SPA,Worker,Model,FrontendHost client;
class API,Utils backend;
class Pool,PG db;
class OAuthGoogle,OAuthGitHub,hCaptcha,Scryfall external;
class CI,Runner,RunnerCF,Compose,Maint infra;
```
