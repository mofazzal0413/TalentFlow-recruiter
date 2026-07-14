"""Extract raw text from resume files (PDF, DOCX, TXT)."""

from __future__ import annotations

from pathlib import Path


def extract_text_from_file(path: Path) -> str:
    """Read resume text from a supported file format."""
    suffix = path.suffix.lower()

    if suffix == ".txt":
        return path.read_text(encoding="utf-8").strip()

    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as error:
            raise RuntimeError("pypdf is required for PDF extraction") from error

        reader = PdfReader(str(path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages).strip()

    if suffix == ".docx":
        try:
            from docx import Document
        except ImportError as error:
            raise RuntimeError("python-docx is required for DOCX extraction") from error

        document = Document(str(path))
        return "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text).strip()

    raise ValueError(f"Unsupported resume format: {suffix}")


def supported_suffixes() -> tuple[str, ...]:
    return (".txt", ".pdf", ".docx")
