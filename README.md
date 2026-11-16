# GwgCommunity

광덕고 학생을 위한 비공식 커뮤니티. 현재 구현은 **PyNext 0.1.2 + Python 3.14 + Uvicorn + PostgreSQL**이다.
Market, Clubs, Finder, 가입·이메일 인증·초대, 이미지 검토·신고·관리자 기능을 제공한다.

실행 코드는 `pynext_app/`에 모았다. PyNext 파일 라우팅과 HTTP 처리에 기존 Django
업무·ORM·폼·템플릿·세션 라이브러리를 연결한다. Django 의존성은 유지하지만 Django
WSGI 서버는 실행하지 않는다. `python_app/`과 `next_engine/`은 이전 구현·복구·비교용이다.

- [설치와 실행](pynext_app/README.md)
- [배포와 복구](pynext_app/docs/OPERATIONS.md)
- [Next.js 대 PyNext 부하 테스트](pynext_app/benchmarks/RESULTS.md)

PyNext는 실험판이며 이 배포는 제작자가 요청한 검증 서비스다. 비밀값·DB 백업·업로드는 Git에 포함하지 않는다.

## 제출용 주석과 구현 현황

[제출 안내 및 구현 미반영 목록](docs/SUBMISSION.md)을 확인한다. 함수·조건·예외·반복·화면 분기의 설명은 각 소스에 포함되어 있다.
