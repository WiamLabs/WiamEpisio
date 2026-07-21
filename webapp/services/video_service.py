"""
Swappable video provider interface for WiamEpisio.

Set VIDEO_PROVIDER=stub|cloudflare (default stub).
Cloudflare Stream credentials (optional until wired):
  CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_TOKEN
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time
from typing import Any, Optional

log = logging.getLogger(__name__)

DEFAULT_TTL_SECONDS = 300


class VideoProvider:
    """Abstract provider — implement create_upload / playback / status."""

    name = 'base'

    def create_upload(
        self,
        *,
        episode_id: Optional[int] = None,
        creator_id: int,
        meta: Optional[dict] = None,
        content_id: Optional[int] = None,
        asset_kind: str = 'episode',
    ) -> dict:
        raise NotImplementedError

    def get_playback(self, *, storage_key: str, episode_id: Optional[int] = None) -> dict:
        raise NotImplementedError

    def sign_playback_url(
        self,
        *,
        storage_key: Optional[str] = None,
        episode_id: Optional[int] = None,
        hls_manifest_url: Optional[str] = None,
        ttl: int = DEFAULT_TTL_SECONDS,
    ) -> dict:
        raise NotImplementedError

    def get_status(self, *, storage_key: str) -> dict:
        raise NotImplementedError


class StubVideoProvider(VideoProvider):
    """Deterministic fake HLS + signed tokens for local/dev without a CDN account."""

    name = 'stub'

    def __init__(self):
        self._secret = (os.environ.get('VIDEO_STUB_SECRET') or 'wiam-episio-stub-secret').encode()

    def create_upload(
        self,
        *,
        episode_id: Optional[int] = None,
        creator_id: int,
        meta: Optional[dict] = None,
        content_id: Optional[int] = None,
        asset_kind: str = 'episode',
    ) -> dict:
        kind = (asset_kind or 'episode').strip().lower()
        if kind == 'trailer':
            key = f'stub:trailer:c{content_id or 0}:u{creator_id}'
        else:
            key = f'stub:ep:{episode_id or 0}:c:{creator_id}'
        return {
            'provider': self.name,
            'storage_key': key,
            'upload_url': f'https://stub.local/upload/{key}',
            'status': 'ready',  # stub is instantly ready
            'hls_manifest_url': f'https://stub.local/hls/{key}/master.m3u8',
            'asset_kind': kind,
        }

    def get_playback(self, *, storage_key: str, episode_id: Optional[int] = None) -> dict:
        eid = episode_id or 0
        return {
            'provider': self.name,
            'storage_key': storage_key,
            'hls_manifest_url': f'https://stub.local/hls/{storage_key or eid}/master.m3u8',
            'status': 'ready',
        }

    def sign_playback_url(
        self,
        *,
        storage_key: Optional[str] = None,
        episode_id: Optional[int] = None,
        hls_manifest_url: Optional[str] = None,
        ttl: int = DEFAULT_TTL_SECONDS,
    ) -> dict:
        exp = int(time.time()) + max(30, int(ttl))
        key = storage_key or f'stub:ep:{episode_id or 0}'
        base = hls_manifest_url or f'https://stub.local/hls/{key}/master.m3u8'
        payload = f'{key}:{exp}'.encode()
        token = hmac.new(self._secret, payload, hashlib.sha256).hexdigest()[:32]
        return {
            'provider': self.name,
            'manifest_url': f'{base}?token={token}&exp={exp}',
            'token': token,
            'expires_at': exp,
            'ttl_seconds': ttl,
        }

    def get_status(self, *, storage_key: str) -> dict:
        return {'provider': self.name, 'storage_key': storage_key, 'status': 'ready'}


class CloudflareStreamProvider(VideoProvider):
    """Cloudflare Stream — requires env credentials; falls back behavior via factory."""

    name = 'cloudflare'

    def __init__(self, account_id: str, api_token: str):
        self.account_id = account_id
        self.api_token = api_token
        self._secret = (os.environ.get('CLOUDFLARE_STREAM_SIGNING_KEY') or api_token[:32]).encode()

    def create_upload(
        self,
        *,
        episode_id: Optional[int] = None,
        creator_id: int,
        meta: Optional[dict] = None,
        content_id: Optional[int] = None,
        asset_kind: str = 'episode',
    ) -> dict:
        kind = (asset_kind or 'episode').strip().lower()
        if kind == 'trailer':
            key = f'cf:pending:trailer:{content_id or 0}'
        else:
            key = f'cf:pending:ep:{episode_id or 0}'
        log.info('CloudflareStream create_upload stubbed kind=%s episode=%s content=%s', kind, episode_id, content_id)
        return {
            'provider': self.name,
            'storage_key': key,
            'upload_url': None,
            'status': 'pending',
            'asset_kind': kind,
            'message': 'Configure Cloudflare Stream direct creator upload in Phase 2 Studio.',
        }

    def get_playback(self, *, storage_key: str, episode_id: Optional[int] = None) -> dict:
        # Cloudflare customer subdomain playback: https://customer-<code>.cloudflarestream.com/<uid>/manifest/video.m3u8
        uid = storage_key.replace('cf:', '').split(':')[-1] if storage_key else ''
        customer = (os.environ.get('CLOUDFLARE_STREAM_CUSTOMER_CODE') or 'CUSTOMER').strip()
        manifest = f'https://customer-{customer}.cloudflarestream.com/{uid}/manifest/video.m3u8' if uid else None
        return {
            'provider': self.name,
            'storage_key': storage_key,
            'hls_manifest_url': manifest,
            'status': 'ready' if uid and 'pending' not in storage_key else 'processing',
        }

    def sign_playback_url(
        self,
        *,
        storage_key: Optional[str] = None,
        episode_id: Optional[int] = None,
        hls_manifest_url: Optional[str] = None,
        ttl: int = DEFAULT_TTL_SECONDS,
    ) -> dict:
        exp = int(time.time()) + max(30, int(ttl))
        playback = self.get_playback(storage_key=storage_key or '', episode_id=episode_id)
        base = hls_manifest_url or playback.get('hls_manifest_url') or 'https://stub.local/missing.m3u8'
        payload = f'{storage_key or episode_id}:{exp}'.encode()
        token = hmac.new(self._secret, payload, hashlib.sha256).hexdigest()[:40]
        sep = '&' if '?' in base else '?'
        return {
            'provider': self.name,
            'manifest_url': f'{base}{sep}token={token}&exp={exp}',
            'token': token,
            'expires_at': exp,
            'ttl_seconds': ttl,
        }

    def get_status(self, *, storage_key: str) -> dict:
        return self.get_playback(storage_key=storage_key)


class CloudflareR2Provider(VideoProvider):
    """
    Cloudflare R2 (S3-compatible) for raw episode/trailer objects.
    Env (Martin sets on Render after creating bucket):
      CLOUDFLARE_ACCOUNT_ID
      CLOUDFLARE_R2_ACCESS_KEY_ID
      CLOUDFLARE_R2_SECRET_ACCESS_KEY
      CLOUDFLARE_R2_BUCKET
      CLOUDFLARE_R2_PUBLIC_BASE_URL  (optional public/custom domain)
    Requires boto3. Without it → factory falls back to stub.
    """

    name = 'r2'

    def __init__(self, account_id: str, access_key: str, secret_key: str, bucket: str):
        import boto3
        from botocore.config import Config as BotoConfig
        self.account_id = account_id
        self.bucket = bucket
        self.public_base = (os.environ.get('CLOUDFLARE_R2_PUBLIC_BASE_URL') or '').rstrip('/')
        endpoint = f'https://{account_id}.r2.cloudflarestorage.com'
        self._client = boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name='auto',
            config=BotoConfig(signature_version='s3v4'),
        )

    def create_upload(
        self,
        *,
        episode_id: Optional[int] = None,
        creator_id: int,
        meta: Optional[dict] = None,
        content_id: Optional[int] = None,
        asset_kind: str = 'episode',
    ) -> dict:
        kind = (asset_kind or 'episode').strip().lower()
        key = f'episio/{kind}/c{content_id or 0}/e{episode_id or 0}/u{creator_id}/{int(time.time())}.mp4'
        upload_url = self._client.generate_presigned_url(
            'put_object',
            Params={'Bucket': self.bucket, 'Key': key, 'ContentType': 'video/mp4'},
            ExpiresIn=3600,
        )
        public = f'{self.public_base}/{key}' if self.public_base else None
        return {
            'provider': self.name,
            'storage_key': key,
            'upload_url': upload_url,
            'upload_method': 'PUT',
            'status': 'pending',
            'hls_manifest_url': public,
            'asset_kind': kind,
            'note': 'PUT the MP4 to upload_url, then call complete-upload with width/height/duration.',
        }

    def get_playback(self, *, storage_key: str, episode_id: Optional[int] = None) -> dict:
        url = f'{self.public_base}/{storage_key}' if self.public_base and storage_key else None
        return {
            'provider': self.name,
            'storage_key': storage_key,
            'hls_manifest_url': url,
            'status': 'ready' if url else 'processing',
        }

    def sign_playback_url(
        self,
        *,
        storage_key: Optional[str] = None,
        episode_id: Optional[int] = None,
        hls_manifest_url: Optional[str] = None,
        ttl: int = DEFAULT_TTL_SECONDS,
    ) -> dict:
        exp = int(time.time()) + max(30, int(ttl))
        if hls_manifest_url:
            url = hls_manifest_url
        elif self.public_base and storage_key:
            url = f'{self.public_base}/{storage_key}'
        elif storage_key:
            url = self._client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': storage_key},
                ExpiresIn=ttl,
            )
        else:
            url = 'https://stub.local/missing.mp4'
        return {
            'provider': self.name,
            'manifest_url': url,
            'url': url,
            'token': None,
            'expires_at': exp,
            'ttl_seconds': ttl,
        }

    def get_status(self, *, storage_key: str) -> dict:
        return self.get_playback(storage_key=storage_key)

    def delete_object(self, *, storage_key: Optional[str] = None, public_url: Optional[str] = None) -> bool:
        """Best-effort R2 object delete by key or public URL under our base."""
        key = (storage_key or '').strip().lstrip('/')
        if not key and public_url and self.public_base and str(public_url).startswith(self.public_base):
            key = str(public_url)[len(self.public_base):].lstrip('/')
        if not key:
            return False
        try:
            self._client.delete_object(Bucket=self.bucket, Key=key)
            return True
        except Exception as exc:
            log.warning('R2 delete_object failed key=%s: %s', key, exc)
            return False


def get_video_service() -> VideoProvider:
    """Factory — VIDEO_PROVIDER=stub|r2|cloudflare."""
    choice = (os.environ.get('VIDEO_PROVIDER') or 'stub').strip().lower()
    if choice in ('r2', 'cloudflare_r2'):
        account = (os.environ.get('CLOUDFLARE_ACCOUNT_ID') or '').strip()
        access = (os.environ.get('CLOUDFLARE_R2_ACCESS_KEY_ID') or '').strip()
        secret = (os.environ.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY') or '').strip()
        bucket = (os.environ.get('CLOUDFLARE_R2_BUCKET') or '').strip()
        if account and access and secret and bucket:
            try:
                return CloudflareR2Provider(account, access, secret, bucket)
            except Exception as exc:
                log.warning('R2 provider init failed (%s) — using stub', exc)
        else:
            log.warning('VIDEO_PROVIDER=r2 but R2 env incomplete — using StubVideoProvider')
    if choice == 'cloudflare':
        account = (os.environ.get('CLOUDFLARE_ACCOUNT_ID') or '').strip()
        token = (os.environ.get('CLOUDFLARE_STREAM_TOKEN') or '').strip()
        if account and token:
            return CloudflareStreamProvider(account, token)
        log.warning('VIDEO_PROVIDER=cloudflare but credentials missing — using StubVideoProvider')
    return StubVideoProvider()
