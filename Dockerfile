# Jagajanin prototype: stdlib-only Python server, seeded with the demo caseload on every start.
FROM python:3.12-slim
WORKDIR /app
COPY . .
ENV PYTHONUNBUFFERED=1
CMD ["python3", "server.py", "--seed"]
