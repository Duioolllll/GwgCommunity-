# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
import os
import time
import urllib.request

url = os.environ.get('GWG_BROWSER_URL', 'http://127.0.0.1:8000') + '/healthz/'
# 반복 `range(100)`: 각 항목을 `_`에 담아 Try 구문으로 이어지는 내부 처리를 실행한다. 항목이 없으면 본문을 건너뛴다. 정상 소진 시 SystemExit('Test server did not become ready') 예외를 발생시킨다.
for _ in range(100):
    # 예외 경계: 본문을 시도하고 `OSError` 발생 시 먼저 `time.sleep(0.1)`를 실행한다.
    try:
        with urllib.request.urlopen(url, timeout=1) as response:
            # 조건 분기 `response.status == 200`: 참이면 반복을 종료한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if response.status == 200:
                break
    except OSError:
        time.sleep(.1)
else:
    raise SystemExit('Test server did not become ready')
