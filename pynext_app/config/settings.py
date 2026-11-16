# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 단락 평가 `not EMAIL_USE_SSL and os.environ.get('SMTP_TLS', '1') == '1'`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `not DEBUG and len(SECRET_KEY.encode()) < 32`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `DEBUG`: 참일 때 `'development-only-do-not-deploy'`, 거짓일 때 `''`를 선택한다.
# - 단락 평가 `sslmode and sslmode not in ('disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full')`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `DEBUG`: 참일 때 `'django.core.mail.backends.console.EmailBackend'`, 거짓일 때 `'django.core.mail.backends.smtp.EmailBackend'`를 선택한다.
# - 조건식 `DEBUG`: 참일 때 `'development-invitation-secret-not-for-production'`, 거짓일 때 `''`를 선택한다.
# - 컴프리헨션: `os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',')`의 각 `v`를 순회한다. `v`가 참인 항목만 포함한다.
# - 컴프리헨션: `os.environ.get('DJANGO_TRUSTED_PROXY_IPS', '').split(',')`의 각 `value`를 순회한다. `value.strip()`가 참인 항목만 포함한다.
# - 단락 평가 `u.hostname or ''`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `u.port or 5432`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `sslmode`: 참일 때 `{'sslmode': sslmode}`, 거짓일 때 `{}`를 선택한다.
# - 단락 평가 `u.username or ''`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `u.password or ''`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
from pathlib import Path
import os
import tempfile
from urllib.parse import urlsplit, unquote, parse_qs
from core.template_source import TEMPLATE_SOURCES

# 운영 환경에서는 Django 비밀키를 필수로 요구한다.
BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.environ.get('DJANGO_DEBUG', '0') == '1'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'development-only-do-not-deploy' if DEBUG else '')
# 조건 분기 `not SECRET_KEY`: 참이면 RuntimeError('DJANGO_SECRET_KEY is required outside development') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
if not SECRET_KEY:
    raise RuntimeError('DJANGO_SECRET_KEY is required outside development')
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')
INSTALLED_APPS = ['django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles', 'core']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'whitenoise.middleware.WhiteNoiseMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware', 'core.rate_limit.AuthenticationRateLimitMiddleware', 'core.middleware.PrivateResponseMiddleware', 'django.contrib.messages.middleware.MessageMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware']
# URL names for templates and redirects; PyNext performs HTTP routing.
ROOT_URLCONF = 'config.urls'
# 템플릿은 디스크 파일이 아니라 Python 사전에서 읽는다.
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': False, 'OPTIONS': {'loaders': [('django.template.loaders.cached.Loader', [('django.template.loaders.locmem.Loader', TEMPLATE_SOURCES)])], 'context_processors': ['django.template.context_processors.request', 'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
# 운영 DB는 PostgreSQL URL만 허용하며 개발 모드에서는 SQLite를 대체 사용한다.
_database_url = os.environ.get('DJANGO_DATABASE_URL')
# 조건 분기 `_database_url`: 참이면 먼저 `u = urlsplit(_database_url)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 If 구문으로 이어지는 내부 처리를 실행한다.
if _database_url:
    u = urlsplit(_database_url)
    # 조건 분기 `u.scheme not in ('postgres', 'postgresql')`: 참이면 RuntimeError('DJANGO_DATABASE_URL must be PostgreSQL') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if u.scheme not in ('postgres', 'postgresql'):
        raise RuntimeError('DJANGO_DATABASE_URL must be PostgreSQL')
    query = parse_qs(u.query)
    # 조건 분기 `set(query) - {'sslmode'}`: 참이면 RuntimeError('Unsupported DJANGO_DATABASE_URL query parameter') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if set(query) - {'sslmode'}:
        raise RuntimeError('Unsupported DJANGO_DATABASE_URL query parameter')
    sslmode = query.get('sslmode', [None])[0]
    # 조건 분기 `sslmode and sslmode not in ('disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full')`: 참이면 RuntimeError('Invalid PostgreSQL sslmode') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if sslmode and sslmode not in ('disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'):
        raise RuntimeError('Invalid PostgreSQL sslmode')
    DATABASES = {'default': {'ENGINE': 'django.db.backends.postgresql', 'NAME': unquote(u.path.lstrip('/')), 'USER': unquote(u.username or ''), 'PASSWORD': unquote(u.password or ''), 'HOST': u.hostname or '', 'PORT': u.port or 5432, 'CONN_MAX_AGE': 60, 'OPTIONS': {'sslmode': sslmode} if sslmode else {}}}
    # 조건 분기 `os.environ.get('DJANGO_TEST_DATABASE_NAME')`: 참이면 먼저 `DATABASES['default']['TEST'] = {'NAME': os.environ['DJANGO_TEST_DATABASE_NAME']}`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if os.environ.get('DJANGO_TEST_DATABASE_NAME'):
        DATABASES['default']['TEST'] = {'NAME': os.environ['DJANGO_TEST_DATABASE_NAME']}
else:
    # 조건 분기 `not DEBUG`: 참이면 RuntimeError('DJANGO_DATABASE_URL is required outside development') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not DEBUG:
        raise RuntimeError('DJANGO_DATABASE_URL is required outside development')
    # Keep the generated development database outside the repository. Set
    # DJANGO_SQLITE_PATH when a different persistent location is required.
    default_sqlite_path = Path(tempfile.gettempdir()) / 'gwgcommunity-development.sqlite3'
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': os.environ.get('DJANGO_SQLITE_PATH', default_sqlite_path)}}
AUTH_PASSWORD_VALIDATORS = [{'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'}, {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'}, {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'}, {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'}]
AUTH_USER_MODEL = 'core.User'
LANGUAGE_CODE = 'ko-kr'
TIME_ZONE = 'Asia/Seoul'
USE_I18N = True
USE_TZ = True
STATIC_URL = '/static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LOGIN_URL = '/auth/login/'
LOGIN_REDIRECT_URL = '/me/'
LOGOUT_REDIRECT_URL = '/'
# 개발은 콘솔 메일, 운영은 별도 설정이 없으면 SMTP를 사용한다.
EMAIL_BACKEND = os.environ.get('DJANGO_EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.environ.get('SMTP_HOST', '')
EMAIL_PORT = int(os.environ.get('SMTP_PORT', '587'))
EMAIL_HOST_USER = os.environ.get('SMTP_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
EMAIL_USE_SSL = os.environ.get('SMTP_SSL', '0') == '1'
EMAIL_USE_TLS = not EMAIL_USE_SSL and os.environ.get('SMTP_TLS', '1') == '1'
DEFAULT_FROM_EMAIL = os.environ.get('SMTP_FROM', 'noreply@localhost')
INVITATION_SECRET = os.environ.get('DJANGO_INVITATION_SECRET', 'development-invitation-secret-not-for-production' if DEBUG else '')
# 조건 분기 `len(INVITATION_SECRET.encode()) < 32`: 참이면 RuntimeError('DJANGO_INVITATION_SECRET must contain at least 32 bytes') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
if len(INVITATION_SECRET.encode()) < 32:
    raise RuntimeError('DJANGO_INVITATION_SECRET must contain at least 32 bytes')
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
CSRF_TRUSTED_ORIGINS = [v for v in os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',') if v]

# Only trust X-Real-IP from explicitly configured reverse proxies that overwrite it.
TRUSTED_PROXY_IPS = [value.strip() for value in os.environ.get('DJANGO_TRUSTED_PROXY_IPS', '').split(',') if value.strip()]
STATICFILES_DIRS = []
STATIC_ROOT = BASE_DIR / 'static_collected'

# Only enable when the app is reachable solely through a proxy that overwrites this header.
# 조건 분기 `os.environ.get('DJANGO_TRUST_FORWARDED_PROTO') == '1'`: 참이면 먼저 `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
if os.environ.get('DJANGO_TRUST_FORWARDED_PROTO') == '1':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = os.environ.get('DJANGO_SECURE_SSL_REDIRECT', '0') == '1'
SECURE_HSTS_SECONDS = int(os.environ.get('DJANGO_HSTS_SECONDS', '0'))
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
SESSION_COOKIE_HTTPONLY = True
# 조건 분기 `not DEBUG and len(SECRET_KEY.encode()) < 32`: 참이면 RuntimeError('DJANGO_SECRET_KEY must contain at least 32 bytes') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
if not DEBUG and len(SECRET_KEY.encode()) < 32:
    raise RuntimeError('DJANGO_SECRET_KEY must contain at least 32 bytes')

# Fingerprinted CSS can be cached across page navigation and deployments.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# Bound network waits so unavailable external services do not occupy workers indefinitely.
EMAIL_TIMEOUT = int(os.environ.get('SMTP_TIMEOUT', '10'))
DATA_UPLOAD_MAX_MEMORY_SIZE = 22 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

SECURE_HSTS_INCLUDE_SUBDOMAINS = os.environ.get('DJANGO_HSTS_INCLUDE_SUBDOMAINS', '0') == '1'
SECURE_HSTS_PRELOAD = os.environ.get('DJANGO_HSTS_PRELOAD', '0') == '1'
