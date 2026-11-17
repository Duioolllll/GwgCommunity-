# 이 파일은 서버 실행에 필요한 설정을 읽는다.
from pathlib import Path
import os
import tempfile
from urllib.parse import urlsplit, unquote, parse_qs
from core.template_source import TEMPLATE_SOURCES

# 운영 환경에서는 Django 비밀키를 필수로 요구한다.
BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.environ.get('DJANGO_DEBUG', '0') == '1'
# 개발 모드에서만 시험용 기본 비밀키를 사용한다. 운영에서는 실제 비밀키를 따로 넣어야 한다.
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'development-only-do-not-deploy' if DEBUG else '')
# 서버 비밀키가 없으면 안전하게 실행할 수 없으므로 시작을 중단한다.
if not SECRET_KEY:
    raise RuntimeError('DJANGO_SECRET_KEY is required outside development')
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')
INSTALLED_APPS = ['django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles', 'core']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'whitenoise.middleware.WhiteNoiseMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware', 'core.rate_limit.AuthenticationRateLimitMiddleware', 'core.middleware.PrivateResponseMiddleware', 'django.contrib.messages.middleware.MessageMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF = 'config.urls'
# 템플릿은 디스크 파일이 아니라 Python 사전에서 읽는다.
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': False, 'OPTIONS': {'loaders': [('django.template.loaders.cached.Loader', [('django.template.loaders.locmem.Loader', TEMPLATE_SOURCES)])], 'context_processors': ['django.template.context_processors.request', 'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
# 운영 DB는 PostgreSQL URL만 허용하며 개발 모드에서는 SQLite를 대체 사용한다.
_database_url = os.environ.get('DJANGO_DATABASE_URL')
# 데이터베이스 주소가 있으면 PostgreSQL에 연결한다. 없으면 아래에서 개발용 실행인지 확인한다.
if _database_url:
    u = urlsplit(_database_url)
    # 운영 데이터베이스 접속 주소는 PostgreSQL 형식만 허용한다.
    if u.scheme not in ('postgres', 'postgresql'):
        raise RuntimeError('DJANGO_DATABASE_URL must be PostgreSQL')
    query = parse_qs(u.query)
    # 주소의 추가 설정에는 암호화 연결 방식만 허용한다.
    if set(query) - {'sslmode'}:
        raise RuntimeError('Unsupported DJANGO_DATABASE_URL query parameter')
    sslmode = query.get('sslmode', [None])[0]
    # 암호화 연결 설정값이 PostgreSQL에서 허용하는 값인지 확인한다.
    if sslmode and sslmode not in ('disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'):
        raise RuntimeError('Invalid PostgreSQL sslmode')
    # 암호화 연결 설정을 입력했을 때만 DB 연결 옵션에 넣는다.
    DATABASES = {'default': {'ENGINE': 'django.db.backends.postgresql', 'NAME': unquote(u.path.lstrip('/')), 'USER': unquote(u.username or ''), 'PASSWORD': unquote(u.password or ''), 'HOST': u.hostname or '', 'PORT': u.port or 5432, 'CONN_MAX_AGE': 60, 'OPTIONS': {'sslmode': sslmode} if sslmode else {}}}
    # 별도 시험용 데이터베이스 이름이 있으면 테스트는 그곳에서 실행한다.
    if os.environ.get('DJANGO_TEST_DATABASE_NAME'):
        DATABASES['default']['TEST'] = {'NAME': os.environ['DJANGO_TEST_DATABASE_NAME']}
else:
    # 운영 환경인데 데이터베이스 주소가 없으면 실행을 중단한다. 임시 SQLite 사용은 개발 중에만 허용한다.
    if not DEBUG:
        raise RuntimeError('DJANGO_DATABASE_URL is required outside development')
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
# 개발 중에는 메일 내용을 콘솔에 보여 주고, 운영에서는 SMTP 메일 서버로 보낸다.
EMAIL_BACKEND = os.environ.get('DJANGO_EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.environ.get('SMTP_HOST', '')
EMAIL_PORT = int(os.environ.get('SMTP_PORT', '587'))
EMAIL_HOST_USER = os.environ.get('SMTP_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
EMAIL_USE_SSL = os.environ.get('SMTP_SSL', '0') == '1'
EMAIL_USE_TLS = not EMAIL_USE_SSL and os.environ.get('SMTP_TLS', '1') == '1'
DEFAULT_FROM_EMAIL = os.environ.get('SMTP_FROM', 'noreply@localhost')
# 개발 모드에서만 시험용 기본 비밀키를 사용한다. 운영에서는 실제 비밀키를 따로 넣어야 한다.
INVITATION_SECRET = os.environ.get('DJANGO_INVITATION_SECRET', 'development-invitation-secret-not-for-production' if DEBUG else '')
# 초대 코드 비밀키가 32바이트보다 짧으면 충분히 길게 설정하도록 실행을 중단한다.
if len(INVITATION_SECRET.encode()) < 32:
    raise RuntimeError('DJANGO_INVITATION_SECRET must contain at least 32 bytes')
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
# 목록에서 필요한 조건에 맞는 항목만 골라 결과에 넣는다.
CSRF_TRUSTED_ORIGINS = [v for v in os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',') if v]

# 목록에서 필요한 조건에 맞는 항목만 골라 결과에 넣는다.
TRUSTED_PROXY_IPS = [value.strip() for value in os.environ.get('DJANGO_TRUSTED_PROXY_IPS', '').split(',') if value.strip()]
STATICFILES_DIRS = []
STATIC_ROOT = BASE_DIR / 'static_collected'

# 운영자가 명시적으로 허용했을 때만 중계 서버가 알려 준 HTTPS 여부를 사용한다.
if os.environ.get('DJANGO_TRUST_FORWARDED_PROTO') == '1':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = os.environ.get('DJANGO_SECURE_SSL_REDIRECT', '0') == '1'
SECURE_HSTS_SECONDS = int(os.environ.get('DJANGO_HSTS_SECONDS', '0'))
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
SESSION_COOKIE_HTTPONLY = True
# 운영 환경에서는 32바이트 이상의 긴 서버 비밀키를 요구한다.
if not DEBUG and len(SECRET_KEY.encode()) < 32:
    raise RuntimeError('DJANGO_SECRET_KEY must contain at least 32 bytes')

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

EMAIL_TIMEOUT = int(os.environ.get('SMTP_TIMEOUT', '10'))
DATA_UPLOAD_MAX_MEMORY_SIZE = 22 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

SECURE_HSTS_INCLUDE_SUBDOMAINS = os.environ.get('DJANGO_HSTS_INCLUDE_SUBDOMAINS', '0') == '1'
SECURE_HSTS_PRELOAD = os.environ.get('DJANGO_HSTS_PRELOAD', '0') == '1'
