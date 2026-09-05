import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    environment: str = "development"
    secret: str = ""
    provider: str = "disabled"
    api_key: str = ""
    model: str = ""
    timeout: float = 10
    max_output_tokens: int = 700
    max_input_bytes: int = 16000
    failure_threshold: int = 3
    reset_seconds: int = 60
    rate_limit: int = 30

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            environment=os.getenv("AGENT_ENV", "development"),
            secret=os.getenv("PYTHON_AGENT_SERVICE_SECRET", ""),
            provider=os.getenv("AGENT_PROVIDER", "disabled"),
            api_key=os.getenv("OPENAI_API_KEY", ""),
            model=os.getenv("AGENT_MODEL", ""),
            timeout=float(os.getenv("AGENT_PROVIDER_TIMEOUT_SECONDS", "10")),
            max_output_tokens=int(os.getenv("AGENT_MAX_OUTPUT_TOKENS", "700")),
            max_input_bytes=int(os.getenv("AGENT_MAX_INPUT_BYTES", "16000")),
        )

    def valid(self) -> bool:
        return (
            len(self.secret) >= 32
            and self.provider in {"disabled", "fake", "openai"}
            and self.environment in {"development", "test", "production"}
            and 0 < self.timeout <= 30
            and 200 <= self.max_output_tokens <= 2000
            and 1000 <= self.max_input_bytes <= 32000
            and (self.provider != "openai" or bool(self.api_key and self.model))
        )
