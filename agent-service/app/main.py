import json
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.config import Settings
from app.models import ReasonRequest, ReasonResponse
from app.providers import Provider
from app.security import RequestGuard

logger = logging.getLogger("b2brain.agent")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False


def create_app(settings: Settings | None = None, provider: Provider | None = None) -> FastAPI:
    config = settings or Settings.from_env()
    reasoning = provider or Provider(config)
    guard = RequestGuard(config)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        if not config.valid():
            raise RuntimeError("Invalid agent configuration; check environment variable names.")
        yield

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/ready")
    async def ready() -> JSONResponse:
        available = await reasoning.ready()
        if config.environment == "production" and time.time() - guard.started < 121:
            available = False
        return JSONResponse(
            {"status": "ready" if available else "unavailable"},
            status_code=200 if available else 503,
        )

    @app.post("/v1/reason", response_model=ReasonResponse)
    async def reason(request: Request) -> ReasonResponse:
        if request.headers.get("content-type", "").split(";")[0] != "application/json":
            raise HTTPException(415, "JSON required")
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 32768:
                raise HTTPException(413, "Request too large")
        request_id = guard.verify(request, bytes(body))
        try:
            data = ReasonRequest.model_validate_json(body)
            if data.requestId != request_id:
                raise ValueError("Request mismatch")
        except (ValidationError, ValueError):
            raise HTTPException(422, "Invalid reasoning contract") from None
        try:
            result = await reasoning.reason(data)
        except ValueError:
            logger.warning(json.dumps({"event": "reasoning_failed", "requestId": request_id}))
            raise HTTPException(503, "Reasoning unavailable; use TypeScript fallback") from None
        logger.info(
            json.dumps(
                {
                    "event": "reasoning_completed",
                    "requestId": request_id,
                    "source": result.providerUsage.source,
                }
            )
        )
        return result

    return app


app = create_app()
