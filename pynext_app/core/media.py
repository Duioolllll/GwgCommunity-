# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
# 이미지 처리: 파일 크기·이미지 형식을 검사하고 재인코딩한 뒤 비공개 저장소에 저장하며 소유자·공개 심사 상태에 따라 조회한다.
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
# 파일 크기와 실제 사진 형식을 검사하고 새 이미지 파일로 다시 만든다.
def sanitize(upload):
    # 사진이 비어 있거나 허용 크기를 넘으면 업로드를 거절한다.
    if not 0 < upload.size <= MAX_IMAGE_BYTES:
        raise ValidationError('이미지는 5MB 이하여야 합니다.')
    # 사진을 읽거나 저장해 본다. 파일이 잘못되었거나 저장에 실패하면 아래에서 오류를 처리한다.
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            source = Image.open(upload)
            fmt = source.format
            # 허용한 실제 이미지 형식인지, 보낸 형식 정보와 일치하는지, 움직이는 사진은 아닌지 확인한다.
            if fmt not in FORMATS or FORMATS[fmt] != upload.content_type or getattr(source, 'n_frames', 1) != 1:
                raise ValidationError('JPEG, PNG, WebP 정지 이미지만 허용합니다.')
            # 가로와 세로를 곱한 픽셀 수가 너무 많으면 서버에 부담을 주므로 거절한다.
            if source.width * source.height > MAX_PIXELS:
                raise ValidationError('이미지 크기가 너무 큽니다.')
            source.load()
            clean = ImageOps.exif_transpose(source)
            # JPEG로 저장할 수 없는 색상 방식이면 일반 RGB 색상으로 바꾼다.
            if fmt == 'JPEG' and clean.mode not in ('RGB', 'L'):
                clean = clean.convert('RGB')
            result = io.BytesIO()
            clean.save(result, format=fmt)
            data = result.getvalue()
            # 사진을 다시 만든 뒤에도 파일이 너무 크면 저장하지 않는다.
            if len(data) > MAX_IMAGE_BYTES:
                raise ValidationError('처리된 이미지 크기가 너무 큽니다.')
            return data, FORMATS[fmt]
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValidationError('이미지 파일을 읽을 수 없습니다.')


# 계정 ID 형식을 검사하고 제한된 타임아웃을 가진 R2 클라이언트를 만든다.
# Cloudflare R2에 파일을 보내고 받을 연결을 만든다. R2는 이미지 파일 보관소다.
def _client():
    import boto3
    from botocore.config import Config
    account = os.environ.get('R2_ACCOUNT_ID', '')
    # R2 계정 번호가 32자리의 올바른 형식인지 확인한다. 잘못된 주소로 파일을 보내지 않게 한다.
    if len(account) != 32 or any(ch not in '0123456789abcdefABCDEF' for ch in account):
        raise RuntimeError('R2_ACCOUNT_ID is invalid')
    return boto3.client('s3', endpoint_url=f'https://{account}.r2.cloudflarestorage.com', region_name='auto', aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'], aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'], config=Config(connect_timeout=5, read_timeout=15, retries={'max_attempts': 2}))


# 개발 모드에서만 허용되는 비공개 이미지 저장 경로를 검증한다.
# 개발 중 사진을 저장할 안전한 폴더 경로를 정한다.
def _local_path(key):
    # 운영 환경에서는 개발용 로컬 사진 저장소를 사용하지 못하게 한다.
    if not settings.DEBUG:
        raise RuntimeError('Private local image storage is development-only')
    # 파일 이름이 지정한 비공개 폴더를 벗어나지 못하도록 검사한다.
    if not key.startswith('private/') or '/' in key[len('private/'):]:
        raise ValueError('invalid storage key')
    root = settings.BASE_DIR / 'private_uploads'
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    return root / key[len('private/'):]


# R2 또는 개발용 로컬 저장소에 비공개 이미지를 저장한다.
# 운영에서는 R2에, 개발 환경에서는 로컬 폴더에 사진을 저장한다.
def put(data, content_type):
    key = 'private/' + uuid.uuid4().hex
    # R2 보관함 설정이 있으면 Cloudflare R2를 사용하고, 없으면 개발용 로컬 폴더를 사용한다.
    if os.environ.get('R2_BUCKET_NAME'):
        _client().put_object(Bucket=os.environ['R2_BUCKET_NAME'], Key=key, Body=data, ContentType=content_type)
    else:
        path = _local_path(key)
        with path.open('xb') as file:
            file.write(data)
        path.chmod(0o600)
    return key


# 설정된 저장소에서 이미지 데이터를 읽는다.
# 보관된 사진 파일을 읽는다.
def get(key):
    # R2 보관함 설정이 있으면 Cloudflare R2를 사용하고, 없으면 개발용 로컬 폴더를 사용한다.
    if os.environ.get('R2_BUCKET_NAME'):
        response = _client().get_object(Bucket=os.environ['R2_BUCKET_NAME'], Key=key)
        return response['Body'].read(MAX_IMAGE_BYTES + 1)
    return _local_path(key).read_bytes()


# 설정된 저장소에서 이미지 데이터를 삭제한다.
# 보관된 사진 파일을 삭제한다.
def delete(key):
    # R2 보관함 설정이 있으면 Cloudflare R2를 사용하고, 없으면 개발용 로컬 폴더를 사용한다.
    if os.environ.get('R2_BUCKET_NAME'):
        _client().delete_object(Bucket=os.environ['R2_BUCKET_NAME'], Key=key)
    else:
        _local_path(key).unlink(missing_ok=True)
