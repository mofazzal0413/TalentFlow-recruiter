"""Experience tenure calculations for evaluation."""

from __future__ import annotations

from typing import Any


def compute_experience_years(experience: list[dict[str, Any]]) -> tuple[int, list[str]]:
    """
    Return total years and uncertainty notes.
    Uses sum of role years with overlap warning when total looks inflated.
    """
    flags: list[str] = []
    if not experience:
        return 0, flags

    years_list = [max(0, int(item.get("years", 0) or 0)) for item in experience]
    total = sum(years_list)
    max_role = max(years_list)

    if len(experience) > 1 and total > max_role + 8:
        flags.append(
            f"Experience total ({total} yrs) may include overlap — verify employment dates",
        )

    if max_role > 0 and total == 0:
        total = max_role

    return total, flags
