# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
"""Compatibility entry point for Next.js versus PyNext (synthetic local DB only)."""
from compare_nextjs import main
# 조건 분기 `__name__ == '__main__'`: 참이면 먼저 `main()`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
if __name__ == "__main__":
    main()
