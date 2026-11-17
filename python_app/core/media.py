

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


# 이미지 형식과 크기를 확인하고 불필요한 정보를 빼서 다시 저장한다.
def sanitize(upload):


    # 사진이 비어 있거나 허용 크기를 넘으면 업로드를 거절한다.
    if not 0 < upload.size <= MAX_IMAGE_BYTES:
        raise ValidationError('이미지는 5MB 이하여야 합니다.')


    # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
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


    # 이 종류의 오류가 나면 “이미지 파일을 읽을 수 없습니다.” 오류로 처리를 중단한다.
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValidationError('이미지 파일을 읽을 수 없습니다.')


# 설정된 R2 계정으로 이미지 저장소에 연결할 준비를 한다.
def _client():
    import boto3
    from botocore.config import Config
    account = os.environ.get('R2_ACCOUNT_ID', '')


    # R2 계정 번호가 32자리의 올바른 형식인지 확인한다. 잘못된 주소로 파일을 보내지 않게 한다.
    if len(account) != 32 or any(ch not in '0123456789abcdefABCDEF' for ch in account):
        raise RuntimeError('R2_ACCOUNT_ID is invalid')
    return boto3.client('s3', endpoint_url=f'https://{account}.r2.cloudflarestorage.com', region_name='auto', aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'], aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'], config=Config(connect_timeout=5, read_timeout=15, retries={'max_attempts': 2}))


# 개발용 이미지의 안전한 현재 컴퓨터의 저장 경로를 만든다.
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


# 이미지를 R2에 저장하고 저장 위치를 돌려준다.
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


# 저장 경로에 해당하는 이미지 파일을 읽는다.
def get(key):


    # R2 보관함 설정이 있으면 Cloudflare R2를 사용하고, 없으면 개발용 로컬 폴더를 사용한다.
    if os.environ.get('R2_BUCKET_NAME'):
        response = _client().get_object(Bucket=os.environ['R2_BUCKET_NAME'], Key=key)
        return response['Body'].read(MAX_IMAGE_BYTES + 1)
    return _local_path(key).read_bytes()


# 더 이상 쓰지 않는 이미지 파일을 저장소에서 지운다.
def delete(key):


    # R2 보관함 설정이 있으면 Cloudflare R2를 사용하고, 없으면 개발용 로컬 폴더를 사용한다.
    if os.environ.get('R2_BUCKET_NAME'):
        _client().delete_object(Bucket=os.environ['R2_BUCKET_NAME'], Key=key)
    else:
        _local_path(key).unlink(missing_ok=True)
