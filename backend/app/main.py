from contextlib import asynccontextmanager

from botocore.exceptions import ClientError
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.errors import aws_client_error_handler, unhandled_exception_handler
from app.logging_setup import configure_logging
from app.routers import metadata, queries, settings as settings_router
from app.version import __version__

configure_logging()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="AthQL", version=__version__, lifespan=lifespan)

app.add_exception_handler(ClientError, aws_client_error_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(metadata.router, prefix="/api")
app.include_router(queries.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "version": __version__}
