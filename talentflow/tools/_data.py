"""Shared helpers for loading mock data files."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


def load_json(filename: str) -> Any:
    path = DATA_DIR / filename
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def save_json(filename: str, data: Any) -> None:
    path = DATA_DIR / filename
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)
        file.write("\n")
