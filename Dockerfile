# Slim CPU image that serves the trained model over FastAPI.
FROM python:3.11-slim

WORKDIR /app

# CPU-only torch keeps the image small; install deps first for layer caching.
RUN pip install --no-cache-dir \
    "torch>=2.2" --index-url https://download.pytorch.org/whl/cpu

COPY pyproject.toml README.md ./
COPY augur ./augur
RUN pip install --no-cache-dir -e . --no-deps && \
    pip install --no-cache-dir numpy pandas onnxruntime typer rich fastapi uvicorn pydantic

# Bake in a trained model so the container is demo-ready on `docker run`.
RUN augur gen-data --rows 1200 && augur train --data data/series.csv --quiet

EXPOSE 8000
CMD ["augur", "serve", "--host", "0.0.0.0", "--port", "8000"]
