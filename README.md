# Accra & Tema Flex Tennis League Platform

A cross-platform flex tennis league application (Web, iOS, Android) and administrative back office.

- **Stack:** Python 3.12 + FastAPI + SQLAlchemy 2 (async) + PostgreSQL + Procrastinate + SQLAdmin
- **Client:** Expo (React Native + Expo Router, TypeScript) for web, iOS, and Android from a single codebase
- **Default Market:** Accra (`Africa/Accra`, Currency: `GHS` in integer pesewas)

---

## Quickstart (Day 1 / Phase 0 & 1)

### 1. Requirements
- Python 3.12 (managed automatically via `uv`)
- Node.js LTS (v22+)
- Docker Desktop for Windows (Installer provided in `scripts/DockerDesktopInstaller.exe`)

### 2. Run All Quality Checks
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 check
```
This runs:
- Backend: Ruff format check, Ruff linter, Mypy type-checking, and Pytest (with Hypothesis invariant property tests)
- Client: TypeScript strict compilation (`tsc --noEmit`)

### 3. Start Backend API
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 api
```
- API live at: `http://localhost:8000`
- Interactive OpenAPI docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 4. Start Expo Mobile Client
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 mobile
```
- Press `w` to open in your browser (`http://localhost:8081`)
- Scan the terminal QR code with **Expo Go** on your iPhone or Android device on the same local network

---

## Repository Structure
```
tennis-league/
├── apps/
│   ├── api/                   # FastAPI backend & pure domain logic
│   │   ├── app/
│   │   │   ├── config.py      # Pydantic settings & league policies
│   │   │   ├── domain/        # Pure Python rules: scoring, standings
│   │   │   └── main.py        # App factory & routes
│   │   └── tests/             # Pytest unit & Hypothesis property tests
│   └── mobile/                # Expo universal client
│       ├── app/               # Expo Router screens (Home, Programs, Standings)
│       └── src/               # Design tokens, API client, components
├── docs/
│   └── adr/                   # Architectural Decision Records
├── scripts/                   # Developer scripts & Docker installer
├── .agent/skills/             # Antigravity project conventions & rules
├── .github/workflows/ci.yml   # CI quality gate
├── Makefile                   # Linux/CI targets
└── README.md
```

## Non-negotiable Rules
1. All sports league policies live in `apps/api/app/domain` as pure, framework-free functions.
2. Financials are stored in integer pesewas/cents (GHS). All dates/times are UTC in the database, displayed in `Africa/Accra`.
3. Strict market scoping: every query is scoped by `market_id`.
4. Opponent contact information is only visible to active, paid players in the same division.
