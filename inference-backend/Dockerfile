FROM python:3.13-slim-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libpq-dev \
    htop \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create default logs directory (will be bind-mounted in prod)
RUN mkdir -p /app/logs

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

# Copy app code
COPY . .

# Expose port
EXPOSE 5000

# Start the app with logging to stdout/stderr and enable print() capture
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:5000", "--access-logfile", "-", "--error-logfile", "-", "--capture-output", "app:app"]