# [mtgscan.cards](https://mtgscan.cards) Monolithic

A very simple web app for scanning and organizing MTG cards.

[![DeepWiki docs](https://deepwiki.com/badge.svg)](https://deepwiki.com/mtgscan-cards/monolithic) [![MDD](https://img.shields.io/badge/Master%20Design%20Document-018EF5?logo=readme&logoColor=fff)](DesignDocument.md) [![Frontend](https://img.shields.io/github/actions/workflow/status/mtgscan-cards/monolithic/deploy-frontend-prod.yml?branch=main&label=Frontend%20Deployment&logo=github)](https://github.com/mtgscan-cards/monolithic/actions/workflows/deploy-frontend-prod.yml)
[![Backend](https://img.shields.io/github/actions/workflow/status/mtgscan-cards/monolithic/deploy-backend-prod.yml?branch=prod&label=Backend%20Deployment&logo=github)](https://github.com/mtgscan-cards/monolithic/actions/workflows/deploy-backend-prod.yml)
## Stack

* **Frontend**: Vite + React
* **Backend**: Flask (modular, JWT-auth)
* **Database**: PostgreSQL (via `pg_pool`)
* **Deployment**: Docker Compose, Gunicorn, Static site hosting
* **CI/CD**: GitHub Actions + self-hosted runner

---

## Setup

### 1. Clone

```bash
git clone https://github.com/mtgscan-cards/monolithic.git
cd monolithic
```

### 2. Configure Environment Variables

#### Frontend (`/vite-frontend/.env`)

```env
VITE_HCAPTCHA_SITEKEY=1234-1234-1234-1234
VITE_GOOGLE_CLIENT_ID=4321-4321-4321-4321.apps.googleusercontent.com
VITE_API_URL=http://localhost:5000
VITE_GITHUB_APP_CLIENT_ID=0987654321
VITE_FRONTEND_URL=http://localhost:5173
```

#### Backend (`/inference-backend/.env`)

```env
POSTGRES_USER=dbuser
POSTGRES_PASSWORD=dbpass
POSTGRES_DB=mtgdb
POSTGRES_HOST=mtg-db
POSTGRES_PORT=5432

HCAPTCHA_SECRET=0x0000000000000000000000000000000000000000
FAILED_ATTEMPTS_THRESHOLD_BACKOFF=3
FAILED_ATTEMPTS_THRESHOLD_BAN=5
BACKOFF_DURATION=10
BAN_DURATION=300

GOOGLE_CLIENT_ID=123456.apps.googleusercontent.com
GITHUB_APP_CLIENT_ID=1234567
GITHUB_APP_CLIENT_SECRET=1234567

FRONTEND_URL=http://localhost:5173
REFRESH_TOKEN_EXPIRE_DAYS=30

JWT_SECRET=replace-this-with-a-secure-key
FLASK_SECRET_KEY=replace-this-with-a-secure-key
```

### 3. Deploy

```bash
docker compose up --build
```

```bash
cd /vite-frontend
npm run dev
```

* **Backend**: [http://localhost:5000](http://localhost:5000)
* **Frontend**: [http://localhost:5173](http://localhost:5173)

---

## Diagram

![System Diagram](https://www.mermaidchart.com/raw/dc4dca0c-b6f6-42e2-b2ef-1a04bf86788f?theme=dark&version=v0.1&format=svg)
