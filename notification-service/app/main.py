from contextlib import asynccontextmanager
import hmac
import logging
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from redis.exceptions import RedisError
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import Settings
from .models import Event
from .store import NotificationStore

logger = logging.getLogger("taskflow.notifications")


class BodyLimitMiddleware:
    """Bound request buffering before the framework parses user-supplied JSON."""

    def __init__(self, app, limit: int = 16384):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > self.limit:
                return await JSONResponse({"error": "Request body too large"}, status_code=413)(scope, receive, send)
            if not message.get("more_body", False):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)


def create_app(settings: Settings | None = None, store: NotificationStore | None = None, client: httpx.AsyncClient | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        config = settings or Settings.from_env()
        redis = None
        app.state.settings = config
        if store is None:
            redis = Redis.from_url(config.redis_url, decode_responses=True, socket_timeout=2, socket_connect_timeout=2, max_connections=20)
            app.state.store = NotificationStore(redis)
        else:
            app.state.store = store
        app.state.http = client or httpx.AsyncClient(timeout=httpx.Timeout(2), follow_redirects=False)
        try:
            await app.state.store.ping()
            yield
        finally:
            if client is None:
                await app.state.http.aclose()
            if redis is not None:
                await redis.aclose()

    app = FastAPI(title="TaskFlow Notifications", version="0.1.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.add_middleware(BodyLimitMiddleware)

    @app.middleware("http")
    async def response_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        return JSONResponse({"error": str(exc.detail)}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse({"error": "Invalid request fields"}, status_code=400)

    @app.exception_handler(RedisError)
    async def redis_error(request: Request, exc: RedisError):
        logger.warning("Redis operation failed", extra={"error_type": type(exc).__name__})
        return JSONResponse({"error": "Notification storage unavailable"}, status_code=503)

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        logger.error("Unexpected notification error", extra={"error_type": type(exc).__name__})
        return JSONResponse({"error": "Notification service unavailable"}, status_code=503)

    async def authenticate(request: Request, authorization: str | None = Header(default=None)) -> str:
        if not authorization or not authorization.startswith("Bearer ") or not authorization[7:].strip():
            raise HTTPException(status_code=401, detail="Please sign in")
        try:
            response = await request.app.state.http.get(
                request.app.state.settings.auth_service_url + "/auth/me",
                headers={"Authorization": authorization},
            )
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Please sign in")
            if response.status_code != 200:
                raise HTTPException(status_code=503, detail="Authentication service unavailable")
            return str(UUID(response.json()["user"]["id"]))
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            raise HTTPException(status_code=503, detail="Authentication service unavailable") from None

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "notification-service"}

    @app.get("/ready")
    async def ready(request: Request):
        await request.app.state.store.ping()
        try:
            response = await request.app.state.http.get(request.app.state.settings.auth_service_url + "/ready")
            if response.status_code != 200:
                raise HTTPException(status_code=503, detail="Authentication service unavailable")
        except httpx.HTTPError:
            raise HTTPException(status_code=503, detail="Authentication service unavailable") from None
        return {"status": "ready", "service": "notification-service"}

    @app.post("/events", status_code=202)
    async def ingest(event: Event, request: Request, x_internal_key: str | None = Header(default=None)):
        expected = request.app.state.settings.internal_api_key
        if not x_internal_key or not hmac.compare_digest(x_internal_key.encode(), expected.encode()):
            raise HTTPException(status_code=401, detail="Invalid internal credentials")
        await request.app.state.store.ingest(event)
        return {"accepted": True}

    @app.get("/notifications")
    async def notifications(request: Request, user_id: str = Depends(authenticate)):
        return {"items": await request.app.state.store.list(user_id)}

    return app


app = create_app()
