# [mtgscan.cards](https://mtgscan.cards) Monolithic

A very simple web app for scanning and organizing MTG cards.

[![DeepWiki docs](https://deepwiki.com/badge.svg)](https://deepwiki.com/mtgscan-cards/monolithic) [![MDD](https://img.shields.io/badge/Master%20Design%20Document-018EF5?logo=readme&logoColor=fff)](DesignDocument.md)

[![Deploy Frontend](https://github.com/mtgscan-cards/monolithic/actions/workflows/deploy-frontend-prod.yml/badge.svg)](https://github.com/mtgscan-cards/monolithic/actions/workflows/deploy-frontend-prod.yml)


[![Deploy Backend](https://github.com/mtgscan-cards/monolithic/actions/workflows/deploy-backend-prod.yml/badge.svg)](https://github.com/mtgscan-cards/monolithic/actions/workflows/deploy-backend-prod.yml)

## Stack

* **Frontend**: Vite + React w/ TypeScript
* **Backend**: Python Flask
* **Database**: PostgreSQL (via `pg_pool`)
* **Deployment**: Docker Compose, Gunicorn, Static Site Host
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

#### Backend (`/core-backend-service/.env`)

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

FLASK_ENV=development
LOG_FILE_PATH=/app/logs/app.log
LOG_LEVEL=INFO

INFER_SERVICE_URL=http://descriptor-infer-service:5001
```

#### Backend (`/inference-service/.env`)

```env
POSTGRES_USER=mtguser
POSTGRES_PASSWORD=mtgpass
POSTGRES_DB=mtgdb
POSTGRES_HOST=mtg-db
POSTGRES_PORT=5432

# Scheduler & Redis lock support
REDIS_HOST=mtg-redis

# Optional log config
LOG_FILE_PATH=/app/logs/app.log
LOG_LEVEL=INFO

HF_UPLOAD_TOKEN=hf_xxxx
```

### 3. Deployment

```bash
docker-compose up --build
```

```bash
cd /vite-frontend
npm run dev
```

* **Backend**: [http://localhost:5000](http://localhost:5000)
* **Frontend**: [http://localhost:5173](http://localhost:5173)

---


## LICENSE

This Project: `mtgscan-cards/monolithic` Is
Licensed under the GNU General Public License v3.0
See [LICENSE](../LICENSE) for details.