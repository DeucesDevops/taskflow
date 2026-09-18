# syntax=docker/dockerfile:1
FROM python:3.13-slim-bookworm@sha256:ed86c82274b3c69b52fb5820f358f0bd7df0b603332063cb5c6e32bd220c3e6e AS dependencies
WORKDIR /build
COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip python -m venv /opt/venv && /opt/venv/bin/pip install --require-hashes -r requirements.txt
COPY app ./app
COPY tests ./tests
RUN /opt/venv/bin/python -m unittest discover -s tests -v

FROM python:3.13-slim-bookworm@sha256:ed86c82274b3c69b52fb5820f358f0bd7df0b603332063cb5c6e32bd220c3e6e AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/opt/venv/bin:$PATH"
WORKDIR /app
COPY --from=dependencies /opt/venv /opt/venv
COPY --from=dependencies --chown=65532:65532 /build/app ./app
USER 65532:65532
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=4)"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log", "--timeout-graceful-shutdown", "10"]
