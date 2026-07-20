"""SEO routes — sitemap.xml, robots.txt, public book pages for indexing,
plus mobile-app verification files (.well-known/*) and the public account-
deletion landing page required by Google Play's User Data policy."""
import json
import os
from flask import Blueprint, Response, render_template, send_from_directory
from ..models import Content, Genre, User
from ..extensions import db

seo_bp = Blueprint('seo', __name__)

CANONICAL_DOMAIN = 'https://wiamapp.com'

# Android signing-key SHA-256 fingerprint(s) authorized to handle wiamapp.com
# deep links via Android App Links (autoVerify=true in WiamAppMobile/app.json).
#
# Populate by running, after the first EAS production build:
#     cd WiamAppMobile && npx eas-cli credentials -p android
# Copy the SHA-256 fingerprint(s) for the production keystore into the env var
# below (comma-separated; uppercase hex with colons, e.g. "AB:CD:...:EF").
#
# Until this env var is set the route returns an empty array, which is harmless
# (Android falls back to the browser disambiguation chooser).
ANDROID_SHA256_FINGERPRINTS_ENV = 'ANDROID_APP_SHA256_FINGERPRINTS'
ANDROID_PACKAGE_NAME = 'com.wiamapp.mobile'

# Apple universal-link config for iOS (mirror of assetlinks for Android).
# Populate by setting APPLE_TEAM_ID env var on Render once the Apple Developer
# account exists; until then the route returns the matching empty file.
APPLE_TEAM_ID_ENV = 'APPLE_TEAM_ID'
APPLE_BUNDLE_ID = 'com.wiamapp.mobile'


@seo_bp.route('/sw.js')
def service_worker():
    """Serve service worker from root scope so Safari & all browsers can use it."""
    static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')
    return send_from_directory(static_dir, 'sw.js',
                               mimetype='application/javascript',
                               max_age=0)


@seo_bp.route('/robots.txt')
def robots():
    """Serve robots.txt for search engines.

    Real auth paths are ``/login`` / ``/register`` (no ``/auth/`` prefix), so
    the previous ``Disallow: /auth/`` was a no-op. Studio, founder, admin
    and creator dashboards stay disallowed because they're login-walled and
    duplicate-content for crawlers.

    ``/team/`` was previously disallowed entirely, which also blocked
    ``/team/careers`` (the public hiring page). We now scope the rule to
    ``/team/admin`` only.
    """
    txt = f"""User-agent: *
Allow: /

# Login funnel (thin, duplicate of homepage CTA)
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /auth/google-callback

# Authenticated experiences
Disallow: /dashboard
Disallow: /profile
Disallow: /library/
Disallow: /notifications/
Disallow: /settings
Disallow: /wallet

# Creator / staff workspaces
Disallow: /creator/studio/
Disallow: /creator/dashboard/
Disallow: /founder/
Disallow: /admin/
Disallow: /team/admin/

# Internal / API paths
Disallow: /api/
Disallow: /internal/

Sitemap: {CANONICAL_DOMAIN}/sitemap.xml
"""
    return Response(txt, mimetype='text/plain')


@seo_bp.route('/sitemap.xml')
def sitemap():
    """Generate a dynamic sitemap with public pages and all published books."""
    base = CANONICAL_DOMAIN
    pages = []

    # Static pages — only public, indexable URLs that map to a real route.
    # `/elite` and `/become-creator` are login-walled, so we drop them. Real
    # auth URLs are `/login` / `/register` (no `/auth/` prefix).
    static_pages = [
        ('/', 'daily', '1.0'),
        ('/browse', 'daily', '0.9'),
        ('/about', 'monthly', '0.8'),
        ('/programs/', 'weekly', '0.7'),
        ('/programs/rising', 'weekly', '0.7'),
        ('/programs/challenges', 'weekly', '0.7'),
        ('/premium/', 'monthly', '0.7'),
        ('/premium/apex', 'monthly', '0.6'),
        ('/team/careers', 'weekly', '0.6'),
        ('/help', 'monthly', '0.6'),
        ('/community-guidelines', 'monthly', '0.5'),
        ('/privacy', 'monthly', '0.5'),
        ('/terms', 'monthly', '0.5'),
        ('/data-deletion', 'monthly', '0.4'),
    ]
    for url, freq, prio in static_pages:
        pages.append(f'  <url><loc>{base}{url}</loc><changefreq>{freq}</changefreq><priority>{prio}</priority></url>')

    # Genre pages
    try:
        genres = Genre.query.order_by(Genre.name).all()
        for g in genres:
            pages.append(f'  <url><loc>{base}/browse/genre/{g.name}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>')
    except Exception:
        pass

    # Published books
    try:
        _PUB = Content.PUBLISHED_STATUSES if hasattr(Content, 'PUBLISHED_STATUSES') else ['published', 'approved']
        books = Content.query.filter(
            Content.status.in_(_PUB),
            Content.deleted_at == None,
        ).order_by(Content.created_at.desc()).all()
        for b in books:
            date_str = b.created_at.strftime('%Y-%m-%d') if b.created_at else '2025-01-01'
            pages.append(f'  <url><loc>{base}/book/{b.id}</loc><lastmod>{date_str}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>')
    except Exception:
        pass

    # Creator profiles
    try:
        creators = User.query.filter(User.is_creator == True).all()
        for c in creators:
            pages.append(f'  <url><loc>{base}/creator/{c.wiam_id}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>')
    except Exception:
        pass

    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    xml += '\n'.join(pages)
    xml += '\n</urlset>'
    return Response(xml, mimetype='application/xml')


@seo_bp.route('/data-deletion')
def data_deletion():
    """Public, no-auth landing page describing how to delete a WiamApp account.

    Google Play's User Data policy requires a publicly accessible URL where
    users (and reviewers) can read about account deletion without first
    installing the app or signing in. The actual deletion happens in-app
    (Settings -> Account safety) or at /account/delete (auth-gated)."""
    return render_template('data_deletion.html')


@seo_bp.route('/.well-known/assetlinks.json')
def android_assetlinks():
    """Android App Links verification file.

    Required because WiamAppMobile/app.json sets `autoVerify: true` on the
    deep-link intent filter for wiamapp.com. Without this file (or with a
    fingerprint that does not match the installed APK's signing key), Android
    falls back to the browser-disambiguation chooser when the user taps a
    wiamapp.com/book/... or /creator/... link.

    Fingerprints come from the production keystore EAS manages -- run
    `npx eas-cli credentials -p android` after the first production build to
    get them, then set them on Render as ANDROID_APP_SHA256_FINGERPRINTS
    (comma-separated, uppercase hex with colons)."""
    raw = (os.environ.get(ANDROID_SHA256_FINGERPRINTS_ENV) or '').strip()
    fingerprints = [fp.strip() for fp in raw.split(',') if fp.strip()]

    if not fingerprints:
        # Empty array is the documented "no apps verified" response and
        # avoids serving a stale fingerprint that would silently break
        # link verification on every device.
        body = []
    else:
        body = [{
            'relation': [
                'delegate_permission/common.handle_all_urls',
            ],
            'target': {
                'namespace': 'android_app',
                'package_name': ANDROID_PACKAGE_NAME,
                'sha256_cert_fingerprints': fingerprints,
            },
        }]
    return Response(
        json.dumps(body, indent=2),
        mimetype='application/json',
        headers={'Cache-Control': 'public, max-age=300'},
    )


@seo_bp.route('/.well-known/apple-app-site-association')
def apple_aasa():
    """Apple Universal Links verification file (iOS counterpart of assetlinks).

    Activated once the Apple Developer account exists and APPLE_TEAM_ID is set
    on Render. Until then this returns a valid empty AASA so iOS clients don't
    cache a 404."""
    team_id = (os.environ.get(APPLE_TEAM_ID_ENV) or '').strip()
    if not team_id:
        body = {'applinks': {'apps': [], 'details': []}}
    else:
        body = {
            'applinks': {
                'apps': [],
                'details': [{
                    'appID': f'{team_id}.{APPLE_BUNDLE_ID}',
                    'paths': ['/book/*', '/creator/*'],
                }],
            },
        }
    return Response(
        json.dumps(body),
        mimetype='application/json',
        headers={'Cache-Control': 'public, max-age=300'},
    )
