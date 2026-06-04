# AGENTS.md

## Project Overview

9Drive is a storage gateway web app. It connects multiple Google Drive accounts into one virtual storage dashboard. Users can authenticate, connect Drive accounts, track quota, upload files, manage virtual folders, preview/download/share files, and route uploads to a Drive account with enough free space.

## Repository Structure

- `backend/`: Express API, Prisma schema, MySQL access, auth, Google OAuth/Drive integration.
- `frontend/`: Vite React app, protected dashboard UI, Google connection flow, file/folder management.
- `docker-compose.yml`: MySQL, backend, and frontend services.
- `.env.docker.example`: Docker environment template.

## Requirements

- Node.js 20+
- npm
- MySQL
- Google Cloud project with Drive API enabled
- Google OAuth client ID and secret

## Backend

Stack:
- Express 5
- TypeScript
- Prisma
- MySQL
- Zod
- JWT bearer auth
- Busboy streaming uploads
- Google APIs client

Important files:
- `backend/src/server.ts`: server entrypoint.
- `backend/src/app.ts`: Express app and route mounting.
- `backend/src/config/env.ts`: environment validation.
- `backend/src/config/prisma.ts`: Prisma client.
- `backend/prisma/schema.prisma`: database schema.
- `backend/src/middleware/auth.middleware.ts`: bearer auth.
- `backend/src/middleware/error.middleware.ts`: error response handling.
- `backend/src/modules/**`: feature route modules.

Commands:
- `cd backend && npm run dev`: start development server.
- `cd backend && npm run build`: typecheck/build backend.
- `cd backend && npm run prisma:migrate`: run Prisma dev migration.
- `cd backend && npm run prisma:generate`: regenerate Prisma client.
- `cd backend && npm run seed:google-config`: store encrypted Google OAuth config.

Environment:
- `DATABASE_URL`
- `APP_PORT`
- `FRONTEND_URL`
- `JWT_ACCESS_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `ACCESS_TOKEN_TTL_SECONDS`
- `REFRESH_TOKEN_TTL_DAYS`
- `MAX_UPLOAD_BYTES`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Backend conventions:
- Put route logic under `backend/src/modules/<feature>/<feature>.routes.ts`.
- Mount new routers in `backend/src/app.ts`.
- Use `requireAuth` for authenticated routes.
- Use `AuthRequest` when accessing `req.user`.
- Validate request bodies/query params with Zod.
- Use Prisma from `backend/src/config/prisma.ts`.
- Return JSON errors with stable `code` and human-readable `message`.
- Pass unexpected errors to `next(error)`.
- Convert `bigint` values to strings before sending JSON responses.
- Keep provider-specific behavior in provider modules when possible.

Security rules:
- Never commit `.env` files or secrets.
- Never log access tokens, refresh tokens, OAuth client secrets, JWT secrets, or encryption keys.
- Google tokens are encrypted before database storage.
- App refresh tokens are hashed before database storage.
- Uploaded files must stream through backend to Google Drive; do not store uploaded files on disk.
- Keep CORS restricted by `FRONTEND_URL`.

Database rules:
- Change DB schema through Prisma schema and migrations.
- Do not hand-edit generated Prisma client files.
- After schema changes, run Prisma migration/generation and backend build.

## Frontend

Stack:
- React 19
- Vite 8
- TypeScript
- React Router
- Tailwind CSS v4
- lucide-react
- class-variance-authority
- clsx
- tailwind-merge

Important files:
- `frontend/src/main.tsx`: React entrypoint.
- `frontend/src/App.tsx`: routes.
- `frontend/src/layouts/DriveLayout.tsx`: authenticated app shell.
- `frontend/src/pages/**`: page-level screens.
- `frontend/src/components/drive/**`: drive-specific UI.
- `frontend/src/components/ui/**`: reusable UI primitives.
- `frontend/src/lib/api.ts`: API helper and formatting utilities.
- `frontend/src/lib/auth.ts`: local auth session storage.
- `frontend/src/style.css`: Tailwind import and global styles.

Commands:
- `cd frontend && npm run dev`: start Vite dev server.
- `cd frontend && npm run build`: typecheck/build frontend.
- `cd frontend && npm run preview`: preview production build.

Environment:
- `VITE_API_URL`: backend base URL. Vite embeds this at build time.

Frontend conventions:
- Use `@/*` imports for files under `frontend/src`.
- Keep route registration in `frontend/src/App.tsx`.
- Use `apiFetch` for normal JSON API calls.
- Use raw `fetch` or `XMLHttpRequest` only when response streaming/blob/progress requires it.
- Keep access/refresh token handling centralized in `frontend/src/lib/api.ts` and `frontend/src/lib/auth.ts`.
- Use existing `Button`, `Card`, and `Input` primitives before adding new UI primitives.
- Use `cn` from `frontend/src/lib/utils.ts` for conditional class names.
- Preserve current Tailwind visual style unless task explicitly asks redesign.
- Keep protected dashboard pages inside `ProtectedRoute` and `DriveLayout`.

## API Notes

Auth endpoints:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

Google accounts:
- `GET /connected-accounts/google/connect-url`
- `GET /connected-accounts/google/callback`
- `GET /connected-accounts`
- `POST /connected-accounts/:id/sync-quota`
- `DELETE /connected-accounts/:id`

Storage:
- `GET /storage/summary`

Folders:
- `GET /folders`
- `GET /folders/recent?limit=4`
- `POST /folders`
- `DELETE /folders/:id`

Files:
- `GET /files`
- `GET /files/:id`
- `PATCH /files/:id`
- `GET /files/:id/view-url`
- `GET /files/:id/download`
- `DELETE /files/:id`

Uploads:
- `POST /uploads`
- Content type: `multipart/form-data`
- Append metadata before `file`: `sizeBytes`, `fileName`, `mimeType`, optional `folderId`, then `file`.

## Docker

Commands:
- `docker compose up -d --build`: build and start MySQL, backend, frontend.
- `docker compose exec backend npm run seed:google-config`: seed Google config inside backend container.
- `docker compose logs -f backend`: backend logs.
- `docker compose logs -f frontend`: frontend logs.
- `docker compose logs -f mysql`: MySQL logs.
- `docker compose down`: stop services.
- `docker compose down -v`: stop services and remove DB volume.

Docker notes:
- Backend container runs `npx prisma migrate deploy` on startup.
- Frontend is served by nginx.
- Rebuild frontend when `VITE_API_URL` changes.

## Verification

Before finishing backend changes:
- `cd backend && npm run build`

Before finishing frontend changes:
- `cd frontend && npm run build`

Before finishing schema changes:
- `cd backend && npm run prisma:migrate`
- `cd backend && npm run build`

Manual smoke test:
- Register/login.
- Open Settings.
- Connect Google Drive.
- Verify connected account appears.
- Open Quota Tracker.
- Create folder in All Files.
- Upload file.
- Verify upload progress.
- Right-click file and test view/download/rename/move/delete where relevant.

## Agent Rules

- Prefer small, targeted changes.
- Preserve existing architecture and naming.
- Do not introduce new dependencies unless necessary.
- Do not commit secrets.
- Do not edit `node_modules`, build output, or generated Prisma client.
- Do not change auth/token storage behavior without explicit reason.
- Do not change Google OAuth scopes or redirect behavior without checking README and env requirements.
