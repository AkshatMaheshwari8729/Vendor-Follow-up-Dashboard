# Vendor Follow-up Dashboard

Phase 1 implementation of the **Macro Runner Section**.

## Project Structure

```text
/vendor-dashboard
  /frontend
    index.html
    style.css
    app.js
  /backend
    server.js
    /routes
    /controllers
    /services
    /uploads
```

## Backend Setup

1. Go to backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment:
   ```bash
   cp .env.example .env
   ```
4. Start backend:
   ```bash
   npm run start
   ```

## Frontend Setup

Frontend is now served directly by the backend. Open:

```text
http://localhost:3000
```

## Deploying Frontend to Netlify

Netlify hosts only static files, so deploy the `frontend/` directory and host backend separately (Render/Railway/VM).

1. Ensure your backend is deployed and reachable (example: `https://vendor-api.example.com`).
2. In Netlify, set publish directory to `frontend` (or use included `netlify.toml`).
3. Open the deployed page and set **Backend API Base URL** at the top of the dashboard.
4. Click **Save API URL**. It is stored in browser local storage.

If backend URL is missing or unreachable, uploads/runs will fail and logs will show a warning.

## API Endpoints

- `POST /upload-macro`
- `POST /analyze-macro`
- `POST /upload-inputs`
- `POST /run-macro`
- `GET /download/:fileId`

## Macro execution notes

- On Windows, macro execution uses PowerShell + Excel COM automation (`backend/scripts/run_macro.ps1`).
- On non-Windows environments, the backend creates a copy of the uploaded workbook as a development fallback.

## Security controls

- Upload extension validation.
- Upload file size limits.
- Basic suspicious macro pattern checks before execution.
