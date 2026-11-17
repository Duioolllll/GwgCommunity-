# Python 3.14가 준비된 작은 Linux 환경에서 시작한다.
FROM python:3.14-slim AS runtime
# 실행 중 임시 Python 파일을 만들지 않고 출력은 바로 보여 주며 앱 폴더를 찾게 한다.
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/pynext_app
# 이후 명령을 실행할 작업 폴더를 정한다.
WORKDIR /app/pynext_app
# 실행에 필요한 파일을 Docker 안으로 복사한다.
COPY pynext_app/requirements.txt ./requirements.txt
# 안내된 Python 도구를 설치하고 앱 전용 계정을 만든다.
RUN pip install --no-cache-dir -r requirements.txt && useradd --system --uid 10001 --no-create-home app
# 실행에 필요한 파일을 Docker 안으로 복사한다.
COPY pynext_app .
# 화면에 쓸 파일과 PyNext 실행 파일을 준비하고 앱 계정이 읽을 수 있게 한다.
RUN DJANGO_DEBUG=1 python manage.py collectstatic --noinput && DJANGO_DEBUG=1 pynext build --dir . && chown -R app:app static_collected .pynext
# 앱은 관리자 권한이 없는 전용 계정으로 실행한다.
USER app
# 앱이 컨테이너 안에서 8000번 포트로 요청을 받는다고 알린다.
EXPOSE 8000
# 컨테이너가 켜지면 웹 서버를 실행한다. 두 작업자가 요청을 나누어 처리한다.
CMD ["python", "serve.py", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
