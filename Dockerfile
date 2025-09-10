FROM python:3.11-slim

# Install system dependencies for LibreOffice and PDF generation
RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create directory structure
RUN mkdir -p /app/app /app/frontend

# Copy backend files
COPY backend/app/main.py /app/app/main.py
COPY backend/app/generator.py /app/app/generator.py
COPY backend/app/pdf-converter.py /app/app/pdf_converter.py

# Create empty __init__.py
RUN touch /app/app/__init__.py

# Copy frontend files
COPY frontend/index.html /app/frontend/index.html
COPY frontend/styles.css /app/frontend/style.css
COPY frontend/script.js /app/frontend/script.js

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]