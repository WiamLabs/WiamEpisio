"""Episio founder HTML control pages — registered onto founder_bp."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from flask import render_template, redirect, url_for, request, flash
from flask_login import current_user

from ..extensions import db
from ..models import (
    User, Content, Episode, CoinBalance, CoinTransaction, CoinPriceBand,
    PlatformConfig, PremiumSubscription, Genre,
)
from ..services import episio_founder as ef
from ..services.coin_pricing import ensure_default_bands, list_bands

log = logging.getLogger(__name__)


def register_episio_founder_pages(bp, founder_required):
    """Attach Episio founder routes to the main founder blueprint."""

    @bp.route('/episio')
    @founder_required
    def episio_hub():
        stats = ef.overview_stats()
        return render_template('founder/episio_hub.html', stats=stats, active='overview')

    # ── Series ──────────────────────────────────────────────────────────
    @bp.route('/episio/series')
    @founder_required
    def episio_series():
        status = (request.args.get('status') or '').strip() or None
        q = (request.args.get('q') or '').strip() or None
        rows = ef.list_drama_series(status=status, q=q)
        return render_template(
            'founder/episio_series.html',
            series_list=rows,
            status=status or '',
            q=q or '',
            active='series',
        )

    @bp.route('/episio/series/<int:series_id>', methods=['GET', 'POST'])
    @founder_required
    def episio_series_detail(series_id):
        series = Content.query.get_or_404(series_id)
        if request.method == 'POST':
            action = (request.form.get('action') or '').strip()
            try:
                if action == 'flags':
                    ef.set_series_flags(
                        series,
                        is_wiam_origin=request.form.get('is_wiam_origin') == 'on',
                        is_vip_series=request.form.get('is_vip_series') == 'on',
                        catalog_shelf=request.form.get('catalog_shelf') or series.catalog_shelf,
                        coin_band=request.form.get('coin_band') or series.coin_band,
                    )
                    flash('Series flags saved.', 'success')
                elif action == 'publish':
                    ef.publish_whole_unit(series, publish=True)
                    flash('Whole unit published (series + episodes).', 'success')
                elif action == 'unpublish':
                    ef.publish_whole_unit(series, publish=False)
                    flash('Whole unit unpublished.', 'success')
                else:
                    flash('Unknown action.', 'error')
            except Exception as e:
                log.exception('series detail action failed')
                flash(str(e)[:200], 'error')
            return redirect(url_for('founder_dash.episio_series_detail', series_id=series_id))

        episodes = ef.series_episodes(series_id)
        creator = None
        if series.creator_wiam_id:
            creator = User.query.filter(
                (User.wiam_id == series.creator_wiam_id) | (User.id == series.creator_wiam_id)
            ).first()
        qc_job = None
        try:
            from ..models import SeasonQualityJob
            qc_job = (
                SeasonQualityJob.query.filter_by(content_id=series_id)
                .order_by(SeasonQualityJob.id.desc())
                .first()
            )
        except Exception:
            db.session.rollback()
        return render_template(
            'founder/episio_series_detail.html',
            series=series,
            episodes=episodes,
            creator=creator,
            qc_job=qc_job,
            active='series',
        )

    # ── Invites ─────────────────────────────────────────────────────────
    @bp.route('/episio/invites', methods=['GET', 'POST'])
    @founder_required
    def episio_invites():
        if request.method == 'POST':
            action = request.form.get('action') or 'create'
            try:
                if action == 'revoke':
                    ef.revoke_invite(int(request.form.get('invite_id')))
                    flash('Invite revoked.', 'success')
                else:
                    inv = ef.create_invite(
                        created_by=current_user.wiam_id or current_user.id,
                        code=request.form.get('code'),
                        note=request.form.get('note') or '',
                        max_uses=request.form.get('max_uses') or 1,
                        expires_days=request.form.get('expires_days'),
                    )
                    flash(f'Invite created: {inv.code}', 'success')
            except Exception as e:
                flash(str(e)[:200], 'error')
            return redirect(url_for('founder_dash.episio_invites'))
        return render_template(
            'founder/episio_invites.html',
            invites=ef.list_invites(),
            active='invites',
        )

    # ── Applications ────────────────────────────────────────────────────
    @bp.route('/episio/applications', methods=['GET', 'POST'])
    @founder_required
    def episio_applications():
        if request.method == 'POST':
            try:
                ef.decide_application(
                    int(request.form.get('app_id')),
                    founder=current_user,
                    decision=request.form.get('decision'),
                    note=request.form.get('note') or '',
                )
                flash('Application updated.', 'success')
            except Exception as e:
                flash(str(e)[:200], 'error')
            return redirect(url_for('founder_dash.episio_applications', status=request.args.get('status') or 'pending'))
        status = request.args.get('status') or 'pending'
        return render_template(
            'founder/episio_applications.html',
            applications=ef.list_applications(status=status),
            status=status,
            active='applications',
        )

    # ── Featured ────────────────────────────────────────────────────────
    @bp.route('/episio/featured', methods=['GET', 'POST'])
    @founder_required
    def episio_featured():
        if request.method == 'POST':
            action = request.form.get('action') or 'add'
            try:
                if action == 'delete':
                    ef.delete_featured(int(request.form.get('slot_id')))
                    flash('Slot removed.', 'success')
                else:
                    ef.add_featured(
                        content_id=int(request.form.get('content_id')),
                        slot_key=request.form.get('slot_key') or 'home_featured',
                        sort_order=request.form.get('sort_order') or 0,
                        note=request.form.get('note') or '',
                        curated_by=current_user.wiam_id or current_user.id,
                    )
                    flash('Featured slot added.', 'success')
            except Exception as e:
                flash(str(e)[:200], 'error')
            return redirect(url_for('founder_dash.episio_featured'))
        slots = ef.list_featured()
        series_map = {}
        for s in slots:
            if s.content_id not in series_map:
                series_map[s.content_id] = Content.query.get(s.content_id)
        return render_template(
            'founder/episio_featured.html',
            slots=slots,
            series_map=series_map,
            active='featured',
        )

    # ── Coin bands ──────────────────────────────────────────────────────
    @bp.route('/episio/coin-bands', methods=['GET', 'POST'])
    @founder_required
    def episio_coin_bands():
        ensure_default_bands()
        if request.method == 'POST':
            band_key = (request.form.get('band_key') or '').lower()
            band = CoinPriceBand.query.filter_by(band_key=band_key).first()
            if not band:
                flash('Band not found.', 'error')
            else:
                if request.form.get('unlock_coins'):
                    band.unlock_coins = int(request.form.get('unlock_coins'))
                if request.form.get('min_coins'):
                    band.min_coins = int(request.form.get('min_coins'))
                if request.form.get('max_coins'):
                    band.max_coins = int(request.form.get('max_coins'))
                if request.form.get('label'):
                    band.label = request.form.get('label')
                band.is_active = request.form.get('is_active') == 'on'
                db.session.commit()
                flash(f'Band {band_key} saved.', 'success')
            return redirect(url_for('founder_dash.episio_coin_bands'))
        return render_template(
            'founder/episio_coin_bands.html',
            bands=list_bands(),
            active='coin_bands',
        )

    # ── Flags ───────────────────────────────────────────────────────────
    @bp.route('/episio/flags', methods=['GET', 'POST'])
    @founder_required
    def episio_flags():
        if request.method == 'POST':
            ef.save_flags(request.form.to_dict())
            flash('Product flags saved.', 'success')
            return redirect(url_for('founder_dash.episio_flags'))
        flags, cfg = ef.get_flags()
        return render_template(
            'founder/episio_flags.html',
            flags=flags,
            cfg=cfg,
            active='flags',
        )

    # ── Watcher detail ──────────────────────────────────────────────────
    @bp.route('/users/<int:user_id>')
    @founder_required
    def user_detail(user_id):
        user = User.query.get_or_404(user_id)
        bal = CoinBalance.query.get(user.id)
        unlocks = ef.user_unlocks(user)
        purchases = (
            CoinTransaction.query.filter(
                CoinTransaction.user_id.in_([user.id, user.wiam_id or -1]),
                CoinTransaction.type == 'purchase',
            )
            .order_by(CoinTransaction.id.desc())
            .limit(20)
            .all()
        )
        vip = (
            PremiumSubscription.query.filter(
                PremiumSubscription.user_id.in_([user.id, user.wiam_id or -1]),
                PremiumSubscription.status == 'active',
            )
            .order_by(PremiumSubscription.id.desc())
            .first()
        )
        ep_map = {}
        for u in unlocks:
            if u.episode_id not in ep_map:
                ep_map[u.episode_id] = Episode.query.get(u.episode_id)
        return render_template(
            'founder/user_detail.html',
            u=user,
            balance=bal.balance if bal else 0,
            unlocks=unlocks,
            purchases=purchases,
            vip=vip,
            ep_map=ep_map,
            active='users',
        )

    @bp.route('/users/<int:user_id>/coins', methods=['POST'])
    @founder_required
    def user_adjust_coins(user_id):
        try:
            delta = int(request.form.get('delta') or 0)
            reason = (request.form.get('reason') or 'founder_adjust')[:200]
            if delta == 0:
                flash('Delta cannot be 0.', 'error')
            else:
                new_bal = ef.adjust_coins(
                    user_id, delta,
                    reason=reason,
                    founder_id=current_user.wiam_id or current_user.id,
                )
                flash(f'Balance updated → {new_bal} coins.', 'success')
        except Exception as e:
            flash(str(e)[:200], 'error')
        return redirect(url_for('founder_dash.user_detail', user_id=user_id))

    @bp.route('/users/<int:user_id>/vip', methods=['POST'])
    @founder_required
    def user_vip_toggle(user_id):
        user = User.query.get_or_404(user_id)
        action = request.form.get('action')
        days = int(request.form.get('days') or 30)
        uid = user.wiam_id or user.id
        if action == 'grant':
            user.premium_status = 'active'
            user.premium_plan = request.form.get('plan') or 'vip'
            user.premium_provider = 'admin_grant'
            user.premium_started_at = user.premium_started_at or datetime.utcnow()
            user.premium_expires_at = datetime.utcnow() + timedelta(days=days)
            sub = PremiumSubscription(
                user_id=uid,
                plan=request.form.get('plan') or 'monthly',
                status='active',
                store='admin_grant',
                started_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(days=days),
            )
            db.session.add(sub)
            db.session.commit()
            flash(f'VIP granted for {days} days.', 'success')
        elif action == 'revoke':
            user.premium_status = 'cancelled'
            user.premium_expires_at = datetime.utcnow()
            PremiumSubscription.query.filter(
                PremiumSubscription.user_id == uid,
                PremiumSubscription.status == 'active',
            ).update({'status': 'cancelled', 'cancelled_at': datetime.utcnow()})
            db.session.commit()
            flash('VIP revoked.', 'success')
        else:
            flash('Unknown VIP action.', 'error')
        return redirect(url_for('founder_dash.user_detail', user_id=user_id))

    @bp.route('/users/<int:user_id>/studio-unlock', methods=['POST'])
    @founder_required
    def user_studio_unlock(user_id):
        user = User.query.get_or_404(user_id)
        ef.unlock_studio_for_user(user, request.form.get('channel_name') or '')
        flash('Studio unlocked for this account.', 'success')
        return redirect(url_for('founder_dash.user_detail', user_id=user_id))
