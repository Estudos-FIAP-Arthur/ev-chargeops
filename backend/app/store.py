from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

from app.domain import ChargingSession, Unit, User, Vehicle


DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "chargeops.db"


def connect(db_path: str | Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def initialize(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS units (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            unit_id TEXT NOT NULL REFERENCES units(id),
            name TEXT NOT NULL,
            rfid_tag TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS vehicles (
            id TEXT PRIMARY KEY,
            unit_id TEXT NOT NULL REFERENCES units(id),
            plate TEXT NOT NULL,
            model TEXT NOT NULL,
            battery_kwh REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS charging_sessions (
            id TEXT PRIMARY KEY,
            unit_id TEXT NOT NULL REFERENCES units(id),
            user_id TEXT NOT NULL REFERENCES users(id),
            vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
            rfid_tag TEXT NOT NULL,
            start TEXT NOT NULL,
            end TEXT NOT NULL,
            kwh_delivered REAL NOT NULL,
            status TEXT NOT NULL
        );
        """
    )
    connection.commit()


def seed_demo(connection: sqlite3.Connection) -> dict[str, int]:
    connection.executescript(
        """
        DELETE FROM charging_sessions;
        DELETE FROM vehicles;
        DELETE FROM users;
        DELETE FROM units;
        """
    )
    units = [
        ("unit-101", "Apto 101"),
        ("unit-202", "Apto 202"),
        ("unit-303", "Apto 303"),
    ]
    users = [
        ("user-101", "unit-101", "Ana Ribeiro", "RFID-101"),
        ("user-202", "unit-202", "Bruno Lima", "RFID-202"),
        ("user-303", "unit-303", "Carla Nunes", "RFID-303"),
    ]
    vehicles = [
        ("vehicle-101", "unit-101", "EVC1A01", "BYD Dolphin", 44.9),
        ("vehicle-202", "unit-202", "EVC2B02", "GWM Ora 03", 48.0),
        ("vehicle-303", "unit-303", "EVC3C03", "Volvo EX30", 51.0),
    ]
    sessions = [
        (
            "session-101-a",
            "unit-101",
            "user-101",
            "vehicle-101",
            "RFID-101",
            "2026-06-05T22:00:00-03:00",
            "2026-06-06T01:00:00-03:00",
            22.0,
            "concluida",
        ),
        (
            "session-101-b",
            "unit-101",
            "user-101",
            "vehicle-101",
            "RFID-101",
            "2026-06-09T21:30:00-03:00",
            "2026-06-10T00:30:00-03:00",
            24.0,
            "concluida",
        ),
        (
            "session-101-c",
            "unit-101",
            "user-101",
            "vehicle-101",
            "RFID-101",
            "2026-06-14T22:15:00-03:00",
            "2026-06-15T01:30:00-03:00",
            23.5,
            "concluida",
        ),
        (
            "session-101-d",
            "unit-101",
            "user-101",
            "vehicle-101",
            "RFID-101",
            "2026-06-18T22:00:00-03:00",
            "2026-06-19T02:00:00-03:00",
            25.0,
            "concluida",
        ),
        (
            "session-101-outlier",
            "unit-101",
            "user-101",
            "vehicle-101",
            "RFID-101",
            "2026-06-21T21:00:00-03:00",
            "2026-06-22T05:30:00-03:00",
            65.0,
            "concluida",
        ),
        (
            "session-202-a",
            "unit-202",
            "user-202",
            "vehicle-202",
            "RFID-202",
            "2026-06-12T10:00:00-03:00",
            "2026-06-12T12:00:00-03:00",
            9.5,
            "interrompida",
        ),
    ]

    connection.executemany("INSERT INTO units VALUES (?, ?)", units)
    connection.executemany("INSERT INTO users VALUES (?, ?, ?, ?)", users)
    connection.executemany("INSERT INTO vehicles VALUES (?, ?, ?, ?, ?)", vehicles)
    connection.executemany("INSERT INTO charging_sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", sessions)
    connection.commit()
    return {"units": len(units), "users": len(users), "vehicles": len(vehicles), "sessions": len(sessions)}


def ensure_demo_data(connection: sqlite3.Connection) -> None:
    row = connection.execute("SELECT COUNT(*) AS total FROM units").fetchone()
    if row["total"] == 0:
        seed_demo(connection)


def list_units(connection: sqlite3.Connection) -> list[Unit]:
    return [Unit(id=row["id"], name=row["name"]) for row in connection.execute("SELECT * FROM units ORDER BY id")]


def list_users(connection: sqlite3.Connection) -> list[User]:
    return [
        User(id=row["id"], unit_id=row["unit_id"], name=row["name"], rfid_tag=row["rfid_tag"])
        for row in connection.execute("SELECT * FROM users ORDER BY id")
    ]


def list_vehicles(connection: sqlite3.Connection) -> list[Vehicle]:
    return [
        Vehicle(
            id=row["id"],
            unit_id=row["unit_id"],
            plate=row["plate"],
            model=row["model"],
            battery_kwh=row["battery_kwh"],
        )
        for row in connection.execute("SELECT * FROM vehicles ORDER BY id")
    ]


def list_sessions(connection: sqlite3.Connection) -> list[ChargingSession]:
    return [
        _session_from_row(row)
        for row in connection.execute("SELECT * FROM charging_sessions ORDER BY start")
    ]


def find_user_by_rfid(connection: sqlite3.Connection, rfid_tag: str) -> User | None:
    row = connection.execute("SELECT * FROM users WHERE rfid_tag = ?", (rfid_tag,)).fetchone()
    if row is None:
        return None
    return User(id=row["id"], unit_id=row["unit_id"], name=row["name"], rfid_tag=row["rfid_tag"])


def find_vehicle(connection: sqlite3.Connection, vehicle_id: str) -> Vehicle | None:
    row = connection.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
    if row is None:
        return None
    return Vehicle(
        id=row["id"],
        unit_id=row["unit_id"],
        plate=row["plate"],
        model=row["model"],
        battery_kwh=row["battery_kwh"],
    )


def insert_session(connection: sqlite3.Connection, session: ChargingSession) -> None:
    connection.execute(
        """
        INSERT INTO charging_sessions (
            id, unit_id, user_id, vehicle_id, rfid_tag, start, end, kwh_delivered, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            session.id,
            session.unit_id,
            session.user_id,
            session.vehicle_id,
            session.rfid_tag,
            session.start.isoformat(),
            session.end.isoformat(),
            session.kwh_delivered,
            session.status,
        ),
    )
    connection.commit()


def _session_from_row(row: sqlite3.Row) -> ChargingSession:
    return ChargingSession(
        id=row["id"],
        unit_id=row["unit_id"],
        user_id=row["user_id"],
        vehicle_id=row["vehicle_id"],
        rfid_tag=row["rfid_tag"],
        start=datetime.fromisoformat(row["start"]),
        end=datetime.fromisoformat(row["end"]),
        kwh_delivered=row["kwh_delivered"],
        status=row["status"],
    )
