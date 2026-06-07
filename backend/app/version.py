from pathlib import Path

_VERSION_FILE = Path(__file__).resolve().parents[2] / "VERSION"


def read_version() -> str:
    return _VERSION_FILE.read_text(encoding="utf-8").strip()


__version__ = read_version()
