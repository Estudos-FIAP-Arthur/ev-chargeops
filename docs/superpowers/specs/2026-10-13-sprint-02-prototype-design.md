# Sprint 02 Prototype Design

## Goal

Build a runnable EV ChargeOps prototype that demonstrates the Sprint 1 architecture without depending on GoodWe SEMS credentials.

## Scope

The prototype includes a FastAPI backend, SQLite persistence, simulated charging sessions, billing/rateio, simple AI analysis, a web manager dashboard, and an Expo mobile app for the end user.

## Authentication Model

Sprint 1 describes authentication at the charging-session level: the GoodWe HCA G2 can identify a session by RFID card, SolarGo/SEMS+ app, or plug and charge. The prototype implements this as `rfid_tag` associated with users and synthetic sessions. It does not implement account login, passwords, or OAuth.

## Backend

The backend exposes HTTP endpoints for:

- health check
- seeding demo data
- listing units, users, vehicles, and charging sessions
- creating synthetic sessions by RFID tag
- generating monthly invoices
- returning operational insights with anomaly flags and usage clusters

SQLite is used so the project runs locally without PostgreSQL setup. The schema mirrors the Sprint 1 entities: unit, user, vehicle, charging session, and invoice.

## Billing

Invoice total is calculated as:

`total = sum(kwh_entregue for the unit in the period) * tarifa_kwh + taxa_fixa`

Interrupted sessions are billed for the kWh already delivered. Units with no sessions still pay the fixed maintenance fee.

## AI Prototype

The anomaly detector uses simple statistical rules suitable for a low-data prototype:

- kWh much higher than the user's historical average
- duration much longer than the user's historical average
- charge start during atypical hours

The clustering prototype groups users into plain-language usage profiles from aggregate features:

- nocturnal heavy users
- regular users
- occasional users

## Frontend

The web dashboard is a static manager view served separately during development. It consumes the FastAPI API and shows summary metrics, sessions, invoices, anomalies, and usage clusters.

The Expo app is a mobile user prototype. It shows the authenticated-user concept through a selected RFID tag, then displays that user's history and current invoice data from the same backend.

## Non-Goals

- Real GoodWe SEMS integration
- Real login/session management
- Payment gateway or split payment settlement
- Production database migrations
- Native mobile release builds
