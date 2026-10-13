from datetime import datetime

from app.domain import (
    ChargingSession,
    Unit,
    User,
    calculate_invoices,
    cluster_usage_profiles,
    detect_anomalies,
)


def dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


def test_calculates_invoice_with_variable_energy_and_fixed_fee():
    units = [Unit(id="u1", name="Apto 101")]
    sessions = [
        ChargingSession(
            id="s1",
            unit_id="u1",
            user_id="user-1",
            vehicle_id="car-1",
            rfid_tag="RFID-101",
            start=dt("2026-06-10T20:00:00-03:00"),
            end=dt("2026-06-10T22:00:00-03:00"),
            kwh_delivered=20.0,
            status="concluida",
        )
    ]

    invoices = calculate_invoices(units, sessions, tariff_kwh=1.2, maintenance_fee=35.0, period="2026-06")

    assert invoices[0].unit_id == "u1"
    assert invoices[0].energy_kwh == 20.0
    assert invoices[0].variable_total == 24.0
    assert invoices[0].total == 59.0


def test_interrupted_session_bills_delivered_kwh():
    units = [Unit(id="u1", name="Apto 101")]
    sessions = [
        ChargingSession(
            id="s1",
            unit_id="u1",
            user_id="user-1",
            vehicle_id="car-1",
            rfid_tag="RFID-101",
            start=dt("2026-06-12T08:00:00-03:00"),
            end=dt("2026-06-12T09:00:00-03:00"),
            kwh_delivered=6.5,
            status="interrompida",
        )
    ]

    invoices = calculate_invoices(units, sessions, tariff_kwh=1.0, maintenance_fee=20.0, period="2026-06")

    assert invoices[0].energy_kwh == 6.5
    assert invoices[0].total == 26.5


def test_unit_without_sessions_pays_fixed_fee_only():
    units = [Unit(id="u1", name="Apto 101"), Unit(id="u2", name="Apto 202")]
    sessions = [
        ChargingSession(
            id="s1",
            unit_id="u1",
            user_id="user-1",
            vehicle_id="car-1",
            rfid_tag="RFID-101",
            start=dt("2026-06-12T08:00:00-03:00"),
            end=dt("2026-06-12T09:00:00-03:00"),
            kwh_delivered=6.5,
            status="concluida",
        )
    ]

    invoices = calculate_invoices(units, sessions, tariff_kwh=1.0, maintenance_fee=20.0, period="2026-06")

    empty_invoice = next(invoice for invoice in invoices if invoice.unit_id == "u2")
    assert empty_invoice.energy_kwh == 0
    assert empty_invoice.total == 20.0


def test_detects_high_energy_anomaly_against_user_history():
    sessions = [
        ChargingSession(
            id=f"s{i}",
            unit_id="u1",
            user_id="user-1",
            vehicle_id="car-1",
            rfid_tag="RFID-101",
            start=dt(f"2026-06-0{i + 1}T21:00:00-03:00"),
            end=dt(f"2026-06-0{i + 1}T23:00:00-03:00"),
            kwh_delivered=10.0,
            status="concluida",
        )
        for i in range(4)
    ]
    sessions.append(
        ChargingSession(
            id="s-outlier",
            unit_id="u1",
            user_id="user-1",
            vehicle_id="car-1",
            rfid_tag="RFID-101",
            start=dt("2026-06-10T21:00:00-03:00"),
            end=dt("2026-06-11T05:00:00-03:00"),
            kwh_delivered=42.0,
            status="concluida",
        )
    )

    anomalies = detect_anomalies(sessions)

    assert anomalies == [
        {
            "session_id": "s-outlier",
            "reason": "Consumo acima do historico do usuario",
            "severity": "alta",
        }
    ]


def test_clusters_users_by_usage_profile():
    users = [
        User(id="user-1", unit_id="u1", name="Ana", rfid_tag="RFID-101"),
        User(id="user-2", unit_id="u2", name="Bruno", rfid_tag="RFID-202"),
    ]
    sessions = [
        ChargingSession(
            id=f"night-{i}",
            unit_id="u1",
            user_id="user-1",
            vehicle_id="car-1",
            rfid_tag="RFID-101",
            start=dt(f"2026-06-{10 + i}T22:00:00-03:00"),
            end=dt(f"2026-06-{11 + i}T02:00:00-03:00"),
            kwh_delivered=24.0,
            status="concluida",
        )
        for i in range(4)
    ]
    sessions.append(
        ChargingSession(
            id="day-1",
            unit_id="u2",
            user_id="user-2",
            vehicle_id="car-2",
            rfid_tag="RFID-202",
            start=dt("2026-06-15T14:00:00-03:00"),
            end=dt("2026-06-15T16:00:00-03:00"),
            kwh_delivered=8.0,
            status="concluida",
        )
    )

    profiles = cluster_usage_profiles(users, sessions)

    assert profiles["user-1"]["profile"] == "noturno intensivo"
    assert profiles["user-2"]["profile"] == "ocasional"
