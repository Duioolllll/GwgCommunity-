
import os
import time
import urllib.request

url = os.environ.get('GWG_BROWSER_URL', 'http://127.0.0.1:8000') + '/healthz/'


# 정해진 횟수만큼 아래 작업을 반복한다. 중간에 멈추지 않고 끝까지 확인하면 뒤의 else 작업도 실행한다.
for _ in range(100):


    # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
    try:
        with urllib.request.urlopen(url, timeout=1) as response:


            # 서버가 정상 응답을 보냈을 때 더 찾을 필요가 없으므로 반복을 끝낸다. 조건에 맞지 않으면 이 부분을 건너뛴다.
            if response.status == 200:
                break


    # 이 종류의 오류가 나면 필요한 저장·안내 작업을 실행한다.
    except OSError:
        time.sleep(.1)
else:
    raise SystemExit('Test server did not become ready')
