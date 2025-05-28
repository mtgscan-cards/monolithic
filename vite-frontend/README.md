# Frontend – React + Vite + SWC

This is the frontend module of the monorepo. It leverages modern React (TypeScript), Vite, and SWC.

---

## Stack Overview

* **Framework**: React 18 (TypeScript)
* **Bundler**: [Vite](https://vitejs.dev/)
* **Compiler**: [SWC](https://swc.rs/)
* **State**: React Context + local state
* **Routing**: React Router v6
* **UI**: MUI (Material UI)
* **Camera + CV**: OpenCV.js + TensorFlow\.js (WebWorker)

---

### Install dependencies

```bash
npm install
```

### Start development server

```bash
npm run dev
```

---

## Environment Variables

Create a `.env` file with the following placeholder values set to match the development env:

```
VITE_HCAPTCHA_SITEKEY=1234-1234-1234-1234
VITE_GOOGLE_CLIENT_ID=4321-4321-4321-4321.apps.googleusercontent.com
VITE_API_URL=http://localhost:5000
VITE_GITHUB_APP_CLIENT_ID=0987654321
VITE_FRONTEND_URL=http://localhost:5173
```

---

## Deployment

This portion of the app is deployed via workflow dispatch:

* **Cloudflare Pages** (static assets)
* **GitHub Actions** (manual `workflow_dispatch` on `prod` branch)

---

## LICENSE

This project is licensed under the GNU General Public License v3.0.  
See the [LICENSE](../LICENSE) file for full details.