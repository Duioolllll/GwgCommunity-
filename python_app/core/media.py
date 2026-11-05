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


def sanitize(upload):
    if not 0 < upload.size <= MAX_IMAGE_BYTES:
        raise ValidationError('이미지는 5MB 이하여야 합니다.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            source = Image.open(upload)
            fmt = source.format
            if fmt not in FORMATS or FORMATS[fmt] != upload.content_type or getattr(source, 'n_frames', 1) != 1:
                raise ValidationError('JPEG, PNG, WebP 정지 이미지만 허용합니다.')
            if source.width * source.height > MAX_PIXELS:
                raise ValidationError('이미지 크기가 너무 큽니다.')
            source.load()
            clean = ImageOps.exif_transpose(source)
            if fmt == 'JPEG' and clean.mode not in ('RGB', 'L'):
                clean = clean.convert('RGB')
            result = io.BytesIO()
            # Pillow does not carry EXIF or other source metadata unless passed explicitly.
            clean.save(result, format=fmt)
            data = result.getvalue()
            if len(data) > MAX_IMAGE_BYTES:
                raise ValidationError('처리된 이미지 크기가 너무 큽니다.')
            return data, FORMATS[fmt]
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValidationError('이미지 파일을 읽을 수 없습니다.')


def _client():
    import boto3
    account = os.environ.get('R2_ACCOUNT_ID', '')
    if len(account) != 32 or any(ch not in '0123456789abcdefABCDEF' for ch in account):
        raise RuntimeError('R2_ACCOUNT_ID is invalid')
    return boto3.client('s3', endpoint_url=f'https://{account}.r2.cloudflarestorage.com', region_name='auto', aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'], aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'])


def _local_path(key):
    if not settings.DEBUG:
        raise RuntimeError('Private local image storage is development-only')
    if not key.startswith('private/') or '/' in key[len('private/'):]:
        raise ValueError('invalid storage key')
    root = settings.BASE_DIR / 'private_uploads'
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    return root / key[len('private/'):]


def put(data, content_type):
    key = 'private/' + uuid.uuid4().hex
    if os.environ.get('R2_BUCKET_NAME'):
        _client().put_object(Bucket=os.environ['R2_BUCKET_NAME'], Key=key, Body=data, ContentType=content_type)
    else:
        path = _local_path(key)
        with path.open('xb') as file:
            file.write(data)
        path.chmod(0o600)
    return key


def get(key):
    if os.environ.get('R2_BUCKET_NAME'):
        response = _client().get_object(Bucket=os.environ['R2_BUCKET_NAME'], Key=key)
        return response['Body'].read(MAX_IMAGE_BYTES + 1)
    return _local_path(key).read_bytes()


def delete(key):
    if os.environ.get('R2_BUCKET_NAME'):
        _client().delete_object(Bucket=os.environ['R2_BUCKET_NAME'], Key=key)
    else:
        _local_path(key).unlink(missing_ok=True)
