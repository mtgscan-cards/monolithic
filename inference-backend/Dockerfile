FROM python:3.13-slim-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

# Copy app code
COPY . .

# Expose port
EXPOSE 5000

# Start the app using Gunicorn w/ 1 woker initally for resource downloading then we can scale up
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:5000", "app:app"]
