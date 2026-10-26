# HANVO Admin

Staff dashboard for HANVO: platform overview, learner accounts, topics and their lessons, and subscription plans.
A Vite + React + TypeScript app over the backend's `/v1/admin/*` endpoints
(`backend/src/main/java/com/hanvo/api/admin/`).

## Run locally

```bash
# The API on :8080 first (see backend/README.md), then:
npm install
npm run dev          # http://localhost:5174, proxies /v1 to the API
```

Point the proxy at another API with `HANVO_API=https://… npm run dev`.

## Who can sign in

Admin sign-in uses Google Identity Services (OAuth 2.0 / OpenID Connect). Only verified Google emails in
the backend's `ADMIN_EMAILS` can access admin endpoints. Database roles and password sign-ins do not grant access.

1. Create a Google OAuth client with application type **Web application**.
2. Add `http://localhost:5174` to its **Authorized JavaScript origins** (add the deployed admin origin for production).
3. Set `VITE_GOOGLE_CLIENT_ID` in `admin/.env.local` to that client ID.
4. In `backend/.env.local`, include that ID in `GOOGLE_CLIENT_IDS` and set
   `ADMIN_EMAILS=you@example.com,other@example.com`.
5. Restart both servers after environment changes. From backend: `set -a; source .env.local; set +a; mvn spring-boot:run`.
   From admin: `npm run dev`.

An empty allowlist denies all admin access. Email matching ignores case and surrounding whitespace.
Allowlisted staff are created or linked on their first Google sign-in. Removing an email and restarting the
backend blocks existing admin sessions and their refresh tokens. No Google client secret is needed for this ID-token flow.
The server verifies Google's signature, issuer, audience, expiry and verified email before issuing an admin session.

Google setup reference: https://developers.google.com/identity/gsi/web/guides/display-button

The refresh token is kept in `sessionStorage`: reloading keeps you signed in, closing the tab signs you out.

## Build and deploy

```bash
npm run build        # type-checks, then writes static files to dist/
```

`dist/` is plain static files (routes use the URL hash, so no server rewrites are needed). If it's served from a
different origin than the API, build with `VITE_API_BASE_URL=https://api.example.com` and add the dashboard's origin
to the API's `CORS_ORIGINS`.

## Screens

| Screen | API |
|---|---|
| Overview: 7-day totals, 14-day chart, subscribers by plan, catalog coverage | `GET /v1/admin/overview` |
| Learners: search, suspend or restore, admin access, put on a plan or back to free | `/v1/admin/users` |
| Topics: list with lesson coverage per level; editor for the topic and each level's lesson | `/v1/admin/scenarios` |
| Plans: free tier (read-only, from server config) and paid plans | `/v1/admin/plans` |
