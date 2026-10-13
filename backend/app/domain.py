from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from statistics import mean


@dataclass(frozen=True)
class Unit:
    id: str
    name: str


@dataclass(frozen=True)
class User:
    id: str
    unit_id: str
    name: str
    rfid_tag: str


@dataclass(frozen=True)
class Vehicle:
    id: str
    unit_id: str
    plate: str
    model: str
    battery_kwh: float


@dataclass(frozen=True)
class ChargingSession:
    id: str
    unit_id: str
    user_id: str
    vehicle_id: str
    rfid_tag: str
    start: datetime
    end: datetime
    kwh_delivered: float
    status: str

    @property
    def duration_hours(self) -> float:
        return max((self.end - self.start).total_seconds() / 3600, 0)


@dataclass(frozen=True)
class Invoice:
    unit_id: str
    period: str
    energy_kwh: float
    tariff_kwh: float
    variable_total: float
    maintenance_fee: float
    total: float
    session_count: int


def calculate_invoices(
    units: list[Unit],
    sessions: list[ChargingSession],
    tariff_kwh: float,
    maintenance_fee: float,
    period: str,
) -> list[Invoice]:
    sessions_by_unit: dict[str, list[ChargingSession]] = defaultdict(list)
    for session in sessions:
        if session.start.strftime("%Y-%m") == period:
            sessions_by_unit[session.unit_id].append(session)

    invoices = []
    for unit in units:
        unit_sessions = sessions_by_unit[unit.id]
        energy = round(sum(session.kwh_delivered for session in unit_sessions), 2)
        variable_total = round(energy * tariff_kwh, 2)
        total = round(variable_total + maintenance_fee, 2)
        invoices.append(
            Invoice(
                unit_id=unit.id,
                period=period,
                energy_kwh=energy,
                tariff_kwh=tariff_kwh,
                variable_total=variable_total,
                maintenance_fee=maintenance_fee,
                total=total,
                session_count=len(unit_sessions),
            )
        )
    return invoices


def detect_anomalies(sessions: list[ChargingSession]) -> list[dict[str, str]]:
    by_user: dict[str, list[ChargingSession]] = defaultdict(list)
    for session in sessions:
        by_user[session.user_id].append(session)

    anomalies = []
    for user_sessions in by_user.values():
        ordered = sorted(user_sessions, key=lambda item: item.start)
        for index, session in enumerate(ordered):
            history = ordered[:index]
            if len(history) >= 3:
                average_kwh = mean(item.kwh_delivered for item in history)
                average_duration = mean(item.duration_hours for item in history)
                if session.kwh_delivered > average_kwh * 2.5:
                    anomalies.append(
                        {
                            "session_id": session.id,
                            "reason": "Consumo acima do historico do usuario",
                            "severity": "alta",
                        }
                    )
                    continue
                if session.duration_hours > max(average_duration * 2.5, 6):
                    anomalies.append(
                        {
                            "session_id": session.id,
                            "reason": "Duracao acima do historico do usuario",
                            "severity": "media",
                        }
                    )
                    continue

            if session.start.hour in {0, 1, 2, 3, 4}:
                anomalies.append(
                    {
                        "session_id": session.id,
                        "reason": "Horario atipico de inicio",
                        "severity": "baixa",
                    }
                )
    return anomalies


def cluster_usage_profiles(users: list[User], sessions: list[ChargingSession]) -> dict[str, dict[str, float | str]]:
    sessions_by_user: dict[str, list[ChargingSession]] = defaultdict(list)
    for session in sessions:
        sessions_by_user[session.user_id].append(session)

    profiles: dict[str, dict[str, float | str]] = {}
    for user in users:
        user_sessions = sessions_by_user[user.id]
        if not user_sessions:
            profiles[user.id] = {
                "name": user.name,
                "profile": "sem uso no periodo",
                "sessions": 0,
                "average_kwh": 0.0,
                "night_share": 0.0,
            }
            continue

        average_kwh = mean(session.kwh_delivered for session in user_sessions)
        night_sessions = [
            session for session in user_sessions if session.start.hour >= 20 or session.start.hour < 6
        ]
        night_share = len(night_sessions) / len(user_sessions)

        if len(user_sessions) >= 3 and average_kwh >= 18 and night_share >= 0.6:
            profile = "noturno intensivo"
        elif len(user_sessions) <= 1:
            profile = "ocasional"
        else:
            profile = "regular"

        profiles[user.id] = {
            "name": user.name,
            "profile": profile,
            "sessions": len(user_sessions),
            "average_kwh": round(average_kwh, 2),
            "night_share": round(night_share, 2),
        }
    return profiles
