# 이미지 처리: 파일 크기·이미지 형식을 검사하고 재인코딩한 뒤 비공개 저장소에 저장하며 소유자·공개 심사 상태에 따라 조회한다.
# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 단락 평가 `len(account) != 32 or any((ch not in '0123456789abcdefABCDEF' for ch in account))`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `not key.startswith('private/') or '/' in key[len('private/'):]`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `fmt not in FORMATS or FORMATS[fmt] != upload.content_type or getattr(source, 'n_frames', 1) != 1`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `fmt == 'JPEG' and clean.mode not in ('RGB', 'L')`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 컴프리헨션: `account`의 각 `ch`를 순회한다.
"""Private, validated image storage. URLs always go through authorization."""
import io
import os
import uuid
import warnings
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 20_000_000
FORMATS = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'WEBP': 'image/webp'}


# 이미지 크기·형식·프레임 수를 검증하고 EXIF 방향을 적용해 메타데이터 없이 다시 인코딩한다.
# 기능 `sanitize`: If 구문으로 이어지는 내부 처리를 실행한다.
def sanitize(upload):
    # 조건 분기 `not 0 < upload.size <= MAX_IMAGE_BYTES`: 참이면 ValidationError('이미지는 5MB 이하여야 합니다.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not 0 < upload.size <= MAX_IMAGE_BYTES:
        raise ValidationError('이미지는 5MB 이하여야 합니다.')
    # 예외 경계: 본문을 시도하고 `(UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning)` 발생 시 ValidationError('이미지 파일을 읽을 수 없습니다.') 예외를 발생시킨다.
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            source = Image.open(upload)
            fmt = source.format
            # 조건 분기 `fmt not in FORMATS or FORMATS[fmt] != upload.content_type or getattr(source, 'n_frames', 1) != 1`: 참이면 ValidationError('JPEG, PNG, WebP 정지 이미지만 허용합니다.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if fmt not in FORMATS or FORMATS[fmt] != upload.content_type or getattr(source, 'n_frames', 1) != 1:
                raise ValidationError('JPEG, PNG, WebP 정지 이미지만 허용합니다.')
            # 조건 분기 `source.width * source.height > MAX_PIXELS`: 참이면 ValidationError('이미지 크기가 너무 큽니다.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if source.width * source.height > MAX_PIXELS:
                raise ValidationError('이미지 크기가 너무 큽니다.')
            source.load()
            clean = ImageOps.exif_transpose(source)
            # 조건 분기 `fmt == 'JPEG' and clean.mode not in ('RGB', 'L')`: 참이면 먼저 `clean = clean.convert('RGB')`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if fmt == 'JPEG' and clean.mode not in ('RGB', 'L'):
                clean = clean.convert('RGB')
            result = io.BytesIO()
            # Pillow does not carry EXIF or other source metadata unless passed explicitly.
            clean.save(result, format=fmt)
            data = result.getvalue()
            # 조건 분기 `len(data) > MAX_IMAGE_BYTES`: 참이면 ValidationError('처리된 이미지 크기가 너무 큽니다.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if len(data) > MAX_IMAGE_BYTES:
                raise ValidationError('처리된 이미지 크기가 너무 큽니다.')
            return data, FORMATS[fmt]
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValidationError('이미지 파일을 읽을 수 없습니다.')


# 기능 `_client`: Import 구문으로 이어지는 내부 처리를 실행한다.
def _client():
    import boto3
    from botocore.config import Config
    account = os.environ.get('R2_ACCOUNT_ID', '')
    # 조건 분기 `len(account) != 32 or any((ch not in '0123456789abcdefABCDEF' for ch in account))`: 참이면 RuntimeError('R2_ACCOUNT_ID is invalid') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if len(account) != 32 or any(ch not in '0123456789abcdefABCDEF' for ch in account):
        raise RuntimeError('R2_ACCOUNT_ID is invalid')
    return boto3.client('s3', endpoint_url=f'https://{account}.r2.cloudflarestorage.com', region_name='auto', aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'], aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'], config=Config(connect_timeout=5, read_timeout=15, retries={'max_attempts': 2}))


# 개발 모드에서만 허용되는 비공개 이미지 저장 경로를 검증한다.
# 기능 `_local_path`: If 구문으로 이어지는 내부 처리를 실행한다.
def _local_path(key):
    # 조건 분기 `not settings.DEBUG`: 참이면 RuntimeError('Private local image storage is development-only') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not settings.DEBUG:
        raise RuntimeError('Private local image storage is development-only')
    # 조건 분기 `not key.startswith('private/') or '/' in key[len('private/'):]`: 참이면 ValueError('invalid storage key') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not key.startswith('private/') or '/' in key[len('private/'):]:
        raise ValueError('invalid storage key')
    root = settings.BASE_DIR / 'private_uploads'
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    return root / key[len('private/'):]


# R2 또는 개발용 로컬 저장소에 비공개 이미지를 저장한다.
# 기능 `put`: 먼저 `key = 'private/' + uuid.uuid4().hex`로 상태 또는 조회 조건을 갱신한다.
def put(data, content_type):
    key = 'private/' + uuid.uuid4().hex
    # 조건 분기 `os.environ.get('R2_BUCKET_NAME')`: 참이면 먼저 `_client().put_object(Bucket=os.environ['R2_BUCKET_NAME'], Key=key, Body=data, ContentType=content_type)`를 실행한다. 거짓이면 먼저 `path = _local_path(key)`로 상태 또는 조회 조건을 갱신한다.
    if os.environ.get('R2_BUCKET_NAME'):
        _client().put_object(Bucket=os.environ['R2_BUCKET_NAME'], Key=key, Body=data, ContentType=content_type)
    else:
        path = _local_path(key)
        with path.open('xb') as file:
            file.write(data)
        path.chmod(0o600)
    return key


# 설정된 저장소에서 이미지 데이터를 읽는다.
# 기능 `get`: If 구문으로 이어지는 내부 처리를 실행한다.
def get(key):
    # 조건 분기 `os.environ.get('R2_BUCKET_NAME')`: 참이면 먼저 `response = _client().get_object(Bucket=os.environ['R2_BUCKET_NAME'], Key=key)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if os.environ.get('R2_BUCKET_NAME'):
        response = _client().get_object(Bucket=os.environ['R2_BUCKET_NAME'], Key=key)
        return response['Body'].read(MAX_IMAGE_BYTES + 1)
    return _local_path(key).read_bytes()


# 설정된 저장소에서 이미지 데이터를 삭제한다.
# 기능 `delete`: If 구문으로 이어지는 내부 처리를 실행한다.
def delete(key):
    # 조건 분기 `os.environ.get('R2_BUCKET_NAME')`: 참이면 먼저 `_client().delete_object(Bucket=os.environ['R2_BUCKET_NAME'], Key=key)`를 실행한다. 거짓이면 먼저 `_local_path(key).unlink(missing_ok=True)`를 실행한다.
    if os.environ.get('R2_BUCKET_NAME'):
        _client().delete_object(Bucket=os.environ['R2_BUCKET_NAME'], Key=key)
    else:
        _local_path(key).unlink(missing_ok=True)
