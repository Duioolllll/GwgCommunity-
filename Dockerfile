FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY python_app/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt && useradd --system --uid 10001 --no-create-home app
COPY python_app /app/python_app
RUN DJANGO_DEBUG=1 python /app/python_app/manage.py collectstatic --noinput && chown -R app:app /app/python_app/static_collected
USER app
WORKDIR /app/python_app
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60"]
