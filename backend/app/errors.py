from __future__ import annotations

import logging
from typing import Any

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

from app.config import settings

logger = logging.getLogger("athql")

AWS_STATUS_MAP: dict[str, int] = {
    "AccessDenied": 403,
    "AccessDeniedException": 403,
    "UnauthorizedException": 401,
    "UnrecognizedClientException": 401,
    "InvalidSignatureException": 401,
    "ExpiredTokenException": 401,
    "InvalidClientTokenId": 401,
    "ResourceNotFoundException": 404,
    "EntityNotFoundException": 404,
    "DatabaseNotFoundException": 404,
    "TableNotFoundException": 404,
    "InvalidRequestException": 400,
    "ValidationException": 400,
    "InvalidInputException": 400,
    "ThrottlingException": 429,
    "TooManyRequestsException": 429,
}


def aws_error_details(exc: ClientError) -> dict[str, Any]:
    error = exc.response.get("Error", {})
    return {
        "code": error.get("Code", "Unknown"),
        "message": error.get("Message", str(exc)),
        "operation": exc.operation_name,
    }


def http_status_for_aws_error(code: str) -> int:
    return AWS_STATUS_MAP.get(code, 502)


def user_message_for_aws_error(details: dict[str, Any], *, context: str | None = None) -> str:
    code = details["code"]
    message = details["message"]
    operation = details.get("operation")
    profile = settings.aws_profile or "default"
    region = settings.aws_region

    prefix = context or "AWS request failed"
    if operation:
        prefix = f"{prefix} ({operation})"

    if code in {"AccessDenied", "AccessDeniedException"}:
        return (
            f"{prefix}: access denied. "
            f"Check IAM permissions for profile '{profile}' in {region}."
        )

    return f"{prefix}: {message} [{code}]"


def log_aws_error(exc: ClientError, *, context: str, request: Request | None = None) -> None:
    if not settings.debug:
        return

    details = aws_error_details(exc)
    msg = (
        f"{context}: AWS {details['operation']} failed — "
        f"{details['code']}: {details['message']}"
    )
    if request is not None:
        msg = f"{request.method} {request.url.path} — {msg}"

    logger.exception(msg)


def log_error(exc: Exception, *, context: str, request: Request | None = None) -> None:
    if not settings.debug:
        return

    if isinstance(exc, ClientError):
        log_aws_error(exc, context=context, request=request)
        return

    msg = context
    if request is not None:
        msg = f"{request.method} {request.url.path} — {context}"

    logger.exception("%s: %s", msg, exc)


def to_http_exception(
    exc: Exception,
    *,
    context: str,
    request: Request | None = None,
    default_status: int = 500,
) -> HTTPException:
    log_error(exc, context=context, request=request)

    if isinstance(exc, HTTPException):
        return exc

    if isinstance(exc, ClientError):
        details = aws_error_details(exc)
        status = http_status_for_aws_error(details["code"])
        detail = user_message_for_aws_error(details, context=context)
        return HTTPException(status_code=status, detail=detail)

    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))

    if isinstance(exc, BotoCoreError):
        detail = f"{context}: {exc}"
        return HTTPException(status_code=503, detail=detail)

    detail = str(exc) if settings.debug else "Internal server error"
    return HTTPException(status_code=default_status, detail=detail)


async def aws_client_error_handler(request: Request, exc: ClientError) -> JSONResponse:
    http_exc = to_http_exception(exc, context="AWS API error", request=request)
    return JSONResponse(status_code=http_exc.status_code, content={"detail": http_exc.detail})


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        raise exc
    http_exc = to_http_exception(exc, context="Request failed", request=request)
    return JSONResponse(status_code=http_exc.status_code, content={"detail": http_exc.detail})
