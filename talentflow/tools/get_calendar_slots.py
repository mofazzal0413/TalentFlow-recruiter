"""Find panel availability for interview scheduling."""

from __future__ import annotations

from typing import Any

from talentflow.tools._data import load_json


def get_calendar_slots(candidate_ids: list[str] | None = None) -> dict[str, Any]:
    """Calendar API mock — GET /availability."""
    calendar = load_json("calendar.json")
    free_blocks = calendar.get("free_blocks", [])

    proposed_slots = [
        block["start"].replace("T", " ").replace("-04:00", " ET") for block in free_blocks[:3]
    ]

    return {
        "panel": calendar.get("panel", []),
        "timezone": calendar.get("timezone"),
        "free_blocks": free_blocks,
        "busy_blocks": calendar.get("busy_blocks", []),
        "proposed_slots": proposed_slots,
        "candidate_ids": candidate_ids or [],
    }
