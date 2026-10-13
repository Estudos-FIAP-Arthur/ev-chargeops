from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.domain import ChargingSession, calculate_invoices, cluster_usage_profiles, detect_anomalies
from app.store import (
    DEFAULT_DB_PATH,
    connect,
    find_user_by_rfid,
    find_vehicle,
    initialize,
    insert_session,
    list_sessions,
    list_units,
    list_users,
    list_vehicles,
    seed_demo,
)

TARIFF_KWH = 1.25
MAINTENANCE_FEE = 35.0


class SimulatedSessionIn(BaseModel):
    rfid_tag: str = Field(min_length=1)
    vehicle_id: str = Field(min_length=1)
    start: datetime
    end: datetime
    kwh_delivered: float = Field(gt=0)
    status: str = Field(pattern="^(concluida|interrompida)$")


def create_app(db_path: str | Path = DEFAULT_DB_PATH) -> FastAPI:
    app = FastAPI(title="EV ChargeOps", version="0.1.0")
    app.state.db_path = db_path

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    with connect(db_path) as connection:
        initialize(connection)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "ev-chargeops"}

    @app.post("/seed")
    def seed() -> dict[str, int]:
        with connect(app.state.db_path) as connection:
            return seed_demo(connection)

    @app.get("/units")
    def units() -> dict[str, list[dict]]:
        with connect(app.state.db_path) as connection:
            return {
                "units": [_serialize(item) for item in list_units(connection)],
                "users": [_serialize(item) for item in list_users(connection)],
                "vehicles": [_serialize(item) for item in list_vehicles(connection)],
            }

    @app.get("/sessions")
    def sessions() -> dict[str, list[dict]]:
        with connect(app.state.db_path) as connection:
            return {"sessions": [_serialize(item) for item in list_sessions(connection)]}

    @app.post("/sessions/simulate", status_code=status.HTTP_201_CREATED)
    def simulate_session(payload: SimulatedSessionIn) -> dict[str, dict]:
        with connect(app.state.db_path) as connection:
            user = find_user_by_rfid(connection, payload.rfid_tag)
            if user is None:
                raise HTTPException(status_code=404, detail="RFID nao cadastrado")
            vehicle = find_vehicle(connection, payload.vehicle_id)
            if vehicle is None or vehicle.unit_id != user.unit_id:
                raise HTTPException(status_code=422, detail="Veiculo nao pertence a unidade do RFID")

            session = ChargingSession(
                id=f"sim-{uuid4()}",
                unit_id=user.unit_id,
                user_id=user.id,
                vehicle_id=vehicle.id,
                rfid_tag=user.rfid_tag,
                start=payload.start,
                end=payload.end,
                kwh_delivered=payload.kwh_delivered,
                status=payload.status,
            )
            insert_session(connection, session)
            return {"session": _serialize(session)}

    @app.get("/invoices/{period}")
    def invoices(period: str) -> dict[str, object]:
        with connect(app.state.db_path) as connection:
            invoice_rows = calculate_invoices(
                list_units(connection),
                list_sessions(connection),
                tariff_kwh=TARIFF_KWH,
                maintenance_fee=MAINTENANCE_FEE,
                period=period,
            )
            return {"period": period, "invoices": [_serialize(item) for item in invoice_rows]}

    @app.get("/insights")
    def insights() -> dict[str, object]:
        with connect(app.state.db_path) as connection:
            sessions_rows = list_sessions(connection)
            users_rows = list_users(connection)
            return {
                "anomalies": detect_anomalies(sessions_rows),
                "profiles": cluster_usage_profiles(users_rows, sessions_rows),
            }

    return app


def _serialize(item) -> dict:
    payload = asdict(item)
    for key, value in list(payload.items()):
        if isinstance(value, datetime):
            payload[key] = value.isoformat()
    return payload
