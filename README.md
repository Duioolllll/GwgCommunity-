# GwgCommunity

광덕고 학생을 위한 비공식 커뮤니티 프로젝트입니다. Market, Clubs, Finder를 제공합니다. 현재 개발 중인 서비스는 **Python 3.12 + Django + PostgreSQL**로 구성하며, HTML과 CSS 소스도 Python 모듈(`python_app/core/template_source.py`)에 포함해 제공합니다.

기존 Next.js 코드는 로컬 `backups/nextjs-source-20261105/`에 보관했으며, 전환 전 커밋 전체의 소스 백업은 `backups/gwgcommunity-before-python-20261105.tar.gz`에 있습니다. 이 백업에는 DB, 이미지, 환경변수가 포함되지 않습니다.

## 로컬 실행

```sh
python3.12 -m venv .venv
.venv/bin/pip install -r python_app/requirements.txt
DJANGO_DEBUG=1 .venv/bin/python python_app/manage.py migrate
DJANGO_DEBUG=1 .venv/bin/python python_app/manage.py runserver 127.0.0.1:8000
```

브라우저에서 `http://127.0.0.1:8000`을 엽니다. 개발 모드에서는 저장소 밖 임시 경로에 SQLite를 자동 생성하고 확인 메일을 콘솔에 출력합니다. 운영 모드는 기본값이며, 개발 서버를 운영에 사용하지 않습니다. 개발 DB 위치를 직접 지정하려면 `DJANGO_SQLITE_PATH=/absolute/path/dev.sqlite3`를 사용합니다.

```sh
DJANGO_DEBUG=1 .venv/bin/python python_app/manage.py check
DJANGO_DEBUG=1 .venv/bin/python python_app/manage.py makemigrations --check --dry-run
DJANGO_DEBUG=1 .venv/bin/python python_app/manage.py test core
```

자세한 설정, 데이터 이전, 테스트 및 운영 전 확인은 [Python 앱 안내](python_app/README.md)와 [Python 전환 운영 가이드](docs/PYTHON_MIGRATION.md)를 참고하세요. `Dockerfile`과 CI의 기본 빌드 대상은 Django입니다. 기존 Next.js용 Compose 설정은 백업 폴더에 보관했습니다. Django에는 `deploy/compose.python.yaml`을 사용합니다.

실제 서비스 전환이나 학교 운영은 별도 환경 검증과 데이터 이전 후 진행해야 합니다.

## 병렬 Next.js 엔진

기존 Node.js + Next.js 구현은 `next_engine/`에 독립 엔진으로 복원되어 있습니다. Python 엔진과 데이터베이스·환경변수·빌드·테스트 파이프라인을 공유하지 않습니다. 자세한 실행 및 검증 명령은 [Next 엔진 안내](next_engine/README.md)를 참고하세요.
