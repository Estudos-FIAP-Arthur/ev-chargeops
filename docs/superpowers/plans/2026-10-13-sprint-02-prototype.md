# Sprint 02 Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable Sprint 2 prototype for EV ChargeOps with backend, billing, AI insights, web dashboard, and Expo mobile app.

**Architecture:** Keep domain logic in pure Python functions, persist demo state in SQLite, expose use cases through FastAPI, and keep web/mobile clients as thin API consumers. GoodWe integration is represented by a synthetic ingestion endpoint keyed by RFID tag.

**Tech Stack:** Python 3, FastAPI, SQLite, pytest, static HTML/CSS/JS, Expo React Native.

**Spec:** `docs/superpowers/specs/2026-10-13-sprint-02-prototype-design.md`

## Global Constraints

- Session authentication is represented by `rfid_tag`; no account login is implemented.
- Billing formula is `kwh * tarifa_kwh + taxa_fixa`.
- Interrupted sessions bill delivered kWh normally.
- Units with no sessions still receive an invoice with the fixed maintenance fee.
- AI is a prototype based on deterministic/statistical rules, not a production ML pipeline.
- GoodWe SEMS is simulated because real credentials and response schema are external dependencies.

---

### Task 1: Domain Tests and Core Logic

**Files:**
- Create: `backend/tests/test_domain.py`
- Create: `backend/app/domain.py`
- Create: `backend/app/__init__.py`

**Interfaces:**
- Produces: `calculate_invoices(units, sessions, tariff_kwh, maintenance_fee, period)`
- Produces: `detect_anomalies(sessions)`
- Produces: `cluster_usage_profiles(users, sessions)`

- [ ] Write tests for invoice calculation, interrupted-session billing, fixed-fee-only invoices, anomaly detection, and profile clustering.
- [ ] Run `PYTHONPATH=backend pytest backend/tests/test_domain.py -v` and verify the module import fails before implementation.
- [ ] Implement dataclasses and pure functions in `backend/app/domain.py`.
- [ ] Run `PYTHONPATH=backend pytest backend/tests/test_domain.py -v` and verify all tests pass.

### Task 2: SQLite Store and API

**Files:**
- Create: `backend/app/store.py`
- Create: `backend/app/api.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/test_api.py`
- Create: `requirements.txt`

**Interfaces:**
- Consumes: domain functions from Task 1.
- Produces: FastAPI `app` with endpoints `/health`, `/seed`, `/units`, `/sessions`, `/sessions/simulate`, `/invoices/{period}`, and `/insights`.

- [ ] Write API tests for health, seeding, invoice generation, and simulated session ingestion by RFID.
- [ ] Run `PYTHONPATH=backend pytest backend/tests/test_api.py -v` and verify failures before API implementation.
- [ ] Implement SQLite setup, demo seed data, repository functions, and FastAPI routes.
- [ ] Run `PYTHONPATH=backend pytest backend/tests/test_api.py -v` and verify all tests pass.

### Task 3: Manager Web Dashboard

**Files:**
- Create: `web/index.html`
- Create: `web/styles.css`
- Create: `web/app.js`

**Interfaces:**
- Consumes: FastAPI endpoints from Task 2.
- Produces: A browser dashboard that seeds demo data and renders metrics, sessions, invoices, anomalies, and usage clusters.

- [ ] Implement static dashboard with resilient fetch helpers and empty/loading/error states.
- [ ] Verify markup contains the required sections with `rg -n "Sessões|Faturas|Anomalias|Perfis" web`.

### Task 4: Expo Mobile Prototype

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/app.json`
- Create: `mobile/App.js`

**Interfaces:**
- Consumes: FastAPI endpoints from Task 2.
- Produces: Expo app that selects a demo RFID user and displays individual session and invoice data.

- [ ] Implement Expo project metadata and React Native UI.
- [ ] Verify Expo files contain the API base URL setting and RFID selector with `rg -n "EXPO_PUBLIC_API_URL|rfid|Fatura" mobile`.

### Task 5: Documentation and Verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: setup and run instructions for backend, web dashboard, and Expo app.

- [ ] Add Sprint 2 prototype instructions to `README.md`.
- [ ] Run `PYTHONPATH=backend pytest backend/tests -v`.
- [ ] Run syntax checks for backend Python files.
- [ ] Run text checks for web and mobile prototype files.
