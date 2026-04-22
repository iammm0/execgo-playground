FROM python:3.12-slim

WORKDIR /app
COPY app.py /app/app.py

RUN pip install --no-cache-dir pytest

EXPOSE 8080
CMD ["python", "/app/app.py"]
