FROM python:3.11-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast installs
RUN pip install uv

# Copy dependency manifest
COPY pyproject.toml .

# Install Python deps
RUN uv sync --frozen --system

# Copy application code
COPY app/ ./app/

# Create uploads dir
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 8000

# Run with uvicorn (prod: use gunicorn)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]