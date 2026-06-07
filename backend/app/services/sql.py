import sqlglot
from sqlglot.errors import ParseError


def format_sql(sql: str, dialect: str = "trino") -> str:
    try:
        return sqlglot.transpile(sql, read=dialect, write=dialect, pretty=True)[0]
    except ParseError as exc:
        raise ValueError(f"Unable to parse SQL: {exc}") from exc
