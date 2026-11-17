

"""Check tracked production paths without reading private environment files."""
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')


# 목록의 각 항목을 살펴보고 뒤에 적힌 조건을 통과한 항목만 모은다.
# 여러 조건을 모두 만족해야 한다. 앞에서 만족하지 못하면 뒤 조건은 확인하지 않는다.
# 앞쪽 값이 비어 있으면 다음 후보를 사용한다. 값이 있으면 뒤쪽은 확인하지 않는다.
private = [p for p in tracked if p and (
    (Path(p).name == '.env' or Path(p).name.startswith('.env.')) and Path(p).name != '.env.example'
    or Path(p).suffix in {'.pem', '.key', '.p12', '.pfx'}
    or Path(p).name in {'id_rsa', 'id_ed25519'}
)]


# 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
assert not private, f'Private files tracked: {private}'

paths = ['Dockerfile', '.github/workflows', 'deploy', 'python_app']
pattern = r'(^FROM[[:space:]]+node:|(^|[[:space:]"/])(npm|pnpm|npx|corepack|node|next)[[:space:]]+(run|install|build|start|dev|test|[[:alnum:]_./-]+\.js)|setup-node|pnpm/action-setup|packageManager)'
r = subprocess.run(['git', 'grep', '-n', '-I', '-E', pattern, '--', *paths, ':!*.md', ':!python_app/tests/check_runtime.py'], cwd=root, text=True, capture_output=True)


# 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
assert r.returncode in (0, 1), r.stderr


# 테스트가 기대하는 조건을 만족하는지 확인한다. 맞지 않으면 실패로 알린다.
assert not r.stdout, 'Production JavaScript dependency found:\n' + r.stdout
print('Tracked secrets and production command dependency checks: PASS')
