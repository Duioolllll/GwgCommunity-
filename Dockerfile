# PyNext 앱을 빌드하고 비루트 계정으로 실행하는 이미지다.
FROM python:3.14-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/pynext_app
WORKDIR /app/pynext_app
COPY pynext_app/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd --system --uid 10001 --no-create-home app
COPY pynext_app .
RUN DJANGO_DEBUG=1 python manage.py collectstatic --noinput && DJANGO_DEBUG=1 pynext build --dir . && chown -R app:app static_collected .pynext
USER app
EXPOSE 8000
CMD ["python", "serve.py", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
