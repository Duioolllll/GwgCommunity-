# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 컴프리헨션: `tracked`의 각 `p`를 순회한다. `p and ((Path(p).name == '.env' or Path(p).name.startswith('.env.')) and Path(p).name != '.env.example' or Path(p).suffix in {'.pem', '.key', '.p12', '.pfx'} or Path(p).name in {'id_rsa', 'id_ed25519'})`가 참인 항목만 포함한다.
# - 단락 평가 `p and ((Path(p).name == '.env' or Path(p).name.startswith('.env.')) and Path(p).name != '.env.example' or Path(p).suffix in {'.pem', '.key', '.p12', '.pfx'} or Path(p).name in {'id_rsa', 'id_ed25519'})`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `(Path(p).name == '.env' or Path(p).name.startswith('.env.')) and Path(p).name != '.env.example' or Path(p).suffix in {'.pem', '.key', '.p12', '.pfx'} or Path(p).name in {'id_rsa', 'id_ed25519'}`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `(Path(p).name == '.env' or Path(p).name.startswith('.env.')) and Path(p).name != '.env.example'`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `Path(p).name == '.env' or Path(p).name.startswith('.env.')`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
"""Check tracked production paths without reading private environment files."""
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
private = [p for p in tracked if p and (
    (Path(p).name == '.env' or Path(p).name.startswith('.env.')) and Path(p).name != '.env.example'
    or Path(p).suffix in {'.pem', '.key', '.p12', '.pfx'}
    or Path(p).name in {'id_rsa', 'id_ed25519'}
)]
assert not private, f'Private files tracked: {private}'
# Search actual commands and configuration, excluding archived source and prose.
paths = ['Dockerfile', '.github/workflows', 'deploy', 'python_app']
pattern = r'(^FROM[[:space:]]+node:|(^|[[:space:]"/])(npm|pnpm|npx|corepack|node|next)[[:space:]]+(run|install|build|start|dev|test|[[:alnum:]_./-]+\.js)|setup-node|pnpm/action-setup|packageManager)'
r = subprocess.run(['git', 'grep', '-n', '-I', '-E', pattern, '--', *paths, ':!*.md', ':!python_app/tests/check_runtime.py'], cwd=root, text=True, capture_output=True)
assert r.returncode in (0, 1), r.stderr
assert not r.stdout, 'Production JavaScript dependency found:\n' + r.stdout
print('Tracked secrets and production command dependency checks: PASS')
