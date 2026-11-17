

from pathlib import Path
import os
import tempfile
from urllib.parse import urlsplit, unquote, parse_qs
from core.template_source import TEMPLATE_SOURCES

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.environ.get('DJANGO_DEBUG', '0') == '1'


# 개발 모드에서는 연습용 기본값을 사용할 수 있다. 운영 모드에서는 실제 설정값이 필요하다.
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'development-only-do-not-deploy' if DEBUG else '')


# 로그인 정보를 보호할 서버 비밀키를 설정하지 않았을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
if not SECRET_KEY:
    raise RuntimeError('DJANGO_SECRET_KEY is required outside development')
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')
INSTALLED_APPS = ['django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles', 'core']

MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'whitenoise.middleware.WhiteNoiseMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware', 'core.rate_limit.AuthenticationRateLimitMiddleware', 'core.middleware.PrivateResponseMiddleware', 'django.contrib.messages.middleware.MessageMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF = 'config.urls'

TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': False, 'OPTIONS': {'loaders': [('django.template.loaders.cached.Loader', [('django.template.loaders.locmem.Loader', TEMPLATE_SOURCES)])], 'context_processors': ['django.template.context_processors.request', 'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'config.wsgi.application'

_database_url = os.environ.get('DJANGO_DATABASE_URL')


# 운영용 데이터베이스 주소가 설정되어 있을 때 데이터베이스 주소를 연결에 필요한 항목으로 나눈다. 그렇지 않으면 아래의 세부 조건을 한 번 더 확인한다.
if _database_url:
    u = urlsplit(_database_url)


    # 데이터베이스 주소가 PostgreSQL 주소가 아닐 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
    if u.scheme not in ('postgres', 'postgresql'):
        raise RuntimeError('DJANGO_DATABASE_URL must be PostgreSQL')
    query = parse_qs(u.query)


    # 데이터베이스 주소에 허용하지 않은 추가 옵션이 들어 있을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
    if set(query) - {'sslmode'}:
        raise RuntimeError('Unsupported DJANGO_DATABASE_URL query parameter')
    sslmode = query.get('sslmode', [None])[0]


    # 암호화 연결 옵션이 허용된 선택지에 없을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
    if sslmode and sslmode not in ('disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'):
        raise RuntimeError('Invalid PostgreSQL sslmode')


    # 암호화 연결 방식이 지정되어 있으면 DB 연결에 함께 적용하고, 없으면 이 옵션을 생략한다.
    # 앞쪽 값이 비어 있으면 다음 후보를 사용한다. 값이 있으면 뒤쪽은 확인하지 않는다.
    DATABASES = {'default': {'ENGINE': 'django.db.backends.postgresql', 'NAME': unquote(u.path.lstrip('/')), 'USER': unquote(u.username or ''), 'PASSWORD': unquote(u.password or ''), 'HOST': u.hostname or '', 'PORT': u.port or 5432, 'CONN_MAX_AGE': 60, 'OPTIONS': {'sslmode': sslmode} if sslmode else {}}}


    # 테스트에서 사용할 데이터베이스 이름을 따로 지정했을 때 테스트에서 사용할 데이터베이스 이름을 지정한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
    if os.environ.get('DJANGO_TEST_DATABASE_NAME'):
        DATABASES['default']['TEST'] = {'NAME': os.environ['DJANGO_TEST_DATABASE_NAME']}
else:


    # 개발 모드가 아닐 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
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


# 개발 모드에서는 연습용 기본값을 사용할 수 있다. 운영 모드에서는 실제 설정값이 필요하다.
EMAIL_BACKEND = os.environ.get('DJANGO_EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.environ.get('SMTP_HOST', '')
EMAIL_PORT = int(os.environ.get('SMTP_PORT', '587'))
EMAIL_HOST_USER = os.environ.get('SMTP_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
EMAIL_USE_SSL = os.environ.get('SMTP_SSL', '0') == '1'


# 여러 조건을 모두 만족해야 한다. 앞에서 만족하지 못하면 뒤 조건은 확인하지 않는다.
EMAIL_USE_TLS = not EMAIL_USE_SSL and os.environ.get('SMTP_TLS', '1') == '1'
DEFAULT_FROM_EMAIL = os.environ.get('SMTP_FROM', 'noreply@localhost')


# 개발 모드에서는 연습용 기본값을 사용할 수 있다. 운영 모드에서는 실제 설정값이 필요하다.
INVITATION_SECRET = os.environ.get('DJANGO_INVITATION_SECRET', 'development-invitation-secret-not-for-production' if DEBUG else '')


# 초대 코드 보호용 비밀키가 32바이트보다 짧을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
if len(INVITATION_SECRET.encode()) < 32:
    raise RuntimeError('DJANGO_INVITATION_SECRET must contain at least 32 bytes')

SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG


# DJANGO_다른 사이트의 몰래 요청을 막는 확인값_TRUSTED_ORIGINS에 적은 주소들을 나누고 빈 항목은 제외한다. 이 주소에서 보낸 요청만 신뢰한다.
CSRF_TRUSTED_ORIGINS = [v for v in os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',') if v]


# DJANGO_TRUSTED_PROXY_IPS에 적은 앞단 서버 주소를 나누고 빈 항목과 공백을 제거한다.
TRUSTED_PROXY_IPS = [value.strip() for value in os.environ.get('DJANGO_TRUSTED_PROXY_IPS', '').split(',') if value.strip()]
STATICFILES_DIRS = []
STATIC_ROOT = BASE_DIR / 'static_collected'


# 앞단 서버가 알려 준 HTTPS 여부를 신뢰하도록 설정했을 때 필요한 값을 정한 뒤 아래 처리를 계속한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
if os.environ.get('DJANGO_TRUST_FORWARDED_PROTO') == '1':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = os.environ.get('DJANGO_SECURE_SSL_REDIRECT', '0') == '1'
SECURE_HSTS_SECONDS = int(os.environ.get('DJANGO_HSTS_SECONDS', '0'))
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
SESSION_COOKIE_HTTPONLY = True


# 운영 모드인데 서버 비밀키가 32바이트보다 짧을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
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
