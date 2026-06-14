# SPlit — Shared Expenses App

A full-stack shared expenses application (a Splitwise clone) built with a modern React, Node.js, and Prisma stack, using Supabase (PostgreSQL) as the database.

## Tech Stack

| Layer     | Technology                                    |
|-----------|-----------------------------------------------|
| Frontend  | React 18 + Vite + React Router v6 + Tailwind CSS |
| Backend   | Node.js + Express.js + Prisma ORM             |
| Database  | Supabase (PostgreSQL)                         |
| Auth      | JWT (access token in-memory, refresh token in httpOnly cookie) |
| CSV Parse | papaparse                                     |
| Currency  | Open Exchange Rates API (cached daily in DB)  |

---

## Project Structure

```
SPlit Project/
├── server/                   # Express + Prisma backend
│   ├── prisma/schema.prisma  # All DB models
│   ├── src/
│   │   ├── index.js          # App entry point
│   │   ├── lib/prisma.js     # Prisma singleton
│   │   ├── middleware/       # auth.js, errorHandler.js
│   │   ├── routes/           # auth, groups, expenses, balances, settlements, import
│   │   └── services/         # splitCalculator, balanceService, currencyService, anomalyDetector, importService
│   └── sample-data/expenses-sample.csv
├── client/                   # Vite + React frontend
│   └── src/
│       ├── context/AuthContext.jsx
│       ├── lib/api.js
│       ├── components/       # Navbar, BalanceCard, SimplifiedDebts, ExpenseCard, AnomalyCard, MemberList, SplitEditor
│       └── pages/            # 10 pages
├── README.md
├── SCOPE.md
├── DECISIONS.md
└── AI_USAGE.md
```

---

## Environment Variables

### Server (`server/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string (pgBouncer/Transaction mode, port 6543) |
| `DIRECT_URL` | Supabase direct connection (Session mode, port 5432) — required for Prisma migrations |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens (15m expiry) |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens (7d expiry) |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL (default: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (default: `7d`) |
| `PORT` | Server port (default: `5000`) |
| `CLIENT_URL` | Frontend URL for CORS (default: `http://localhost:5173`) |
| `OPEN_EXCHANGE_RATES_APP_ID` | Free API key from openexchangerates.org |

Copy `server/.env.example` → `server/.env` and fill in your values.

### Client (`client/.env`)

```env
VITE_API_URL=http://localhost:5000/api
```

Vite's dev server proxies `/api` to `localhost:5000` automatically — no env var needed in development.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone & Install

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment

```bash
cp server/.env.example server/.env
# Fill in DATABASE_URL, DIRECT_URL, JWT secrets, and OPEN_EXCHANGE_RATES_APP_ID
```

### 3. Run Database Migrations

```bash
cd server
npm run db:generate   # generate Prisma client
npm run db:migrate    # apply migrations to Supabase
```

### 4. Run Locally

In two terminals:

```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
```

Open http://localhost:5173

---

## API Overview

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns access token |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke refresh token |
| GET | `/api/auth/user-by-email` | Find user by email |
| GET | `/api/groups` | List groups for current user |
| POST | `/api/groups` | Create group |
| GET | `/api/groups/:id` | Group detail |
| PUT | `/api/groups/:id` | Update group name |
| POST | `/api/groups/:id/members` | Add member |
| DELETE | `/api/groups/:id/members/:uid` | Remove member (soft) |
| GET | `/api/groups/:id/expenses` | List expenses |
| POST | `/api/groups/:id/expenses` | Create expense |
| GET | `/api/expenses/:id` | Expense detail |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Soft delete expense |
| GET | `/api/groups/:id/balances` | Balances + simplified debts |
| GET | `/api/groups/:id/settlements` | List settlements |
| POST | `/api/groups/:id/settlements` | Record settlement |
| POST | `/api/import/upload` | Upload CSV + detect anomalies |
| GET | `/api/import/:sessionId` | Get import session + anomalies |
| PUT | `/api/import/:sessionId/anomalies/:id` | Resolve anomaly |
| POST | `/api/import/:sessionId/execute` | Execute approved imports |
| GET | `/api/import/:sessionId/report` | Get import report |

---

## Testing the Import

Use the provided sample CSV at `server/sample-data/expenses-sample.csv` which contains all 13 anomaly types for testing the import pipeline.

---

## Deployment

### Backend → Render / Railway

1. Set all environment variables in the dashboard
2. Build command: `npm install && npm run db:generate`
3. Start command: `node src/index.js`

### Frontend → Vercel

1. Set root directory to `client`
2. Build command: `npm run build`
3. Set `VITE_API_URL` to your Render backend URL
4. Add Vercel rewrite rule: `{ source: "/api/(.*)", destination: "https://your-backend.render.com/api/$1" }`

---

## Deployed URLs

- **Frontend**: _TBD after deployment_
- **Backend**: _TBD after deployment_
