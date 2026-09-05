FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 AGENT_ENV=production
WORKDIR /service
COPY pyproject.toml constraints.txt ./
COPY app ./app
RUN pip install --no-cache-dir -c constraints.txt . && useradd --uid 10001 --create-home agent
USER 10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
# One worker is required for process-local replay/rate protection. TLS at trusted ingress.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
