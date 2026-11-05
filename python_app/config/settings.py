from pathlib import Path
import os
import tempfile
from urllib.parse import urlsplit, unquote, parse_qs
from core.template_source import TEMPLATE_SOURCES

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.environ.get('DJANGO_DEBUG', '0') == '1'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'development-only-do-not-deploy' if DEBUG else '')
if not SECRET_KEY:
    raise RuntimeError('DJANGO_SECRET_KEY is required outside development')
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')
INSTALLED_APPS = ['django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles', 'core']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'whitenoise.middleware.WhiteNoiseMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware', 'core.rate_limit.AuthenticationRateLimitMiddleware', 'django.contrib.messages.middleware.MessageMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF = 'config.urls'
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': False, 'OPTIONS': {'loaders': [('django.template.loaders.locmem.Loader', TEMPLATE_SOURCES)], 'context_processors': ['django.template.context_processors.request', 'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'config.wsgi.application'
_database_url = os.environ.get('DJANGO_DATABASE_URL')
if _database_url:
    u = urlsplit(_database_url)
    if u.scheme not in ('postgres', 'postgresql'):
        raise RuntimeError('DJANGO_DATABASE_URL must be PostgreSQL')
    query = parse_qs(u.query)
    if set(query) - {'sslmode'}:
        raise RuntimeError('Unsupported DJANGO_DATABASE_URL query parameter')
    sslmode = query.get('sslmode', [None])[0]
    if sslmode and sslmode not in ('disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'):
        raise RuntimeError('Invalid PostgreSQL sslmode')
    DATABASES = {'default': {'ENGINE': 'django.db.backends.postgresql', 'NAME': unquote(u.path.lstrip('/')), 'USER': unquote(u.username or ''), 'PASSWORD': unquote(u.password or ''), 'HOST': u.hostname or '', 'PORT': u.port or 5432, 'CONN_MAX_AGE': 60, 'OPTIONS': {'sslmode': sslmode} if sslmode else {}}}
    if os.environ.get('DJANGO_TEST_DATABASE_NAME'):
        DATABASES['default']['TEST'] = {'NAME': os.environ['DJANGO_TEST_DATABASE_NAME']}
else:
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
EMAIL_BACKEND = os.environ.get('DJANGO_EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.environ.get('SMTP_HOST', '')
EMAIL_PORT = int(os.environ.get('SMTP_PORT', '587'))
EMAIL_HOST_USER = os.environ.get('SMTP_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
EMAIL_USE_SSL = os.environ.get('SMTP_SSL', '0') == '1'
EMAIL_USE_TLS = not EMAIL_USE_SSL and os.environ.get('SMTP_TLS', '1') == '1'
DEFAULT_FROM_EMAIL = os.environ.get('SMTP_FROM', 'noreply@localhost')
INVITATION_SECRET = os.environ.get('DJANGO_INVITATION_SECRET', 'development-invitation-secret-not-for-production' if DEBUG else '')
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
if os.environ.get('DJANGO_TRUST_FORWARDED_PROTO') == '1':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = os.environ.get('DJANGO_SECURE_SSL_REDIRECT', '0') == '1'
SECURE_HSTS_SECONDS = int(os.environ.get('DJANGO_HSTS_SECONDS', '0'))
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
SESSION_COOKIE_HTTPONLY = True
if not DEBUG and len(SECRET_KEY.encode()) < 32:
    raise RuntimeError('DJANGO_SECRET_KEY must contain at least 32 bytes')
