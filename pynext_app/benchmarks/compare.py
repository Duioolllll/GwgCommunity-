# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
"""Compatibility entry point for Next.js versus PyNext (synthetic local DB only)."""
from compare_nextjs import main
# 다른 파일에서 불러올 때는 실행하지 않고, 이 파일을 직접 실행할 때만 아래 시작 코드를 실행한다.
if __name__ == "__main__":
    main()
