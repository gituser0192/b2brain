import hashlib
import hmac
import re
import time
from collections import deque

from fastapi import HTTPException, Request

from app.config import Settings


class RequestGuard:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        # ponytail: single worker only; shared atomic nonce store before horizontal scaling.
        self.seen: dict[str, float] = {}
        self.calls: deque[float] = deque()
        # Fail closed for one replay window after restarts, when prior nonces were lost.
        self.started = time.time()

    def verify(self, request: Request, body: bytes) -> str:
        now = time.time()
        if self.settings.environment == "production" and request.url.scheme != "https":
            raise HTTPException(403, "Secure transport required")
        if not self.settings.valid():
            raise HTTPException(503, "Service unavailable")
        timestamp = request.headers.get("x-agent-timestamp", "")
        request_id = request.headers.get("x-agent-request-id", "")
        signature = request.headers.get("x-agent-signature", "")
        if not re.fullmatch(r"\d{10}", timestamp) or abs(now - int(timestamp)) > 60:
            raise HTTPException(401, "Invalid service authentication")
        if not re.fullmatch(
            r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", request_id
        ):
            raise HTTPException(401, "Invalid service authentication")
        expected = hmac.new(
            self.settings.secret.encode(),
            f"POST\n/v1/reason\n{timestamp}\n{request_id}\n".encode() + body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(401, "Invalid service authentication")
        if self.settings.environment == "production" and now - self.started < 121:
            raise HTTPException(503, "Service warming up")
        self.seen = {key: expiry for key, expiry in self.seen.items() if expiry > now}
        if request_id in self.seen:
            raise HTTPException(409, "Request already received")
        while self.calls and self.calls[0] < now - 60:
            self.calls.popleft()
        if len(self.calls) >= self.settings.rate_limit:
            raise HTTPException(429, "Service busy")
        self.calls.append(now)
        self.seen[request_id] = now + 121
        return request_id
