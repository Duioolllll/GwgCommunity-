FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/pynext_app
WORKDIR /app/pynext_app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd --system --uid 10001 --no-create-home app
COPY . .
RUN DJANGO_DEBUG=1 python manage.py collectstatic --noinput && DJANGO_DEBUG=1 pynext build --dir . && chown -R app:app static_collected .pynext
USER app
EXPOSE 8000
CMD ["python", "serve.py", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
