"""
Team Payroll Service — automatic monthly payments to WiamApp workers via Paystack Transfers.

Flow:
1. Founder configures team members' MoMo details in payroll settings.
2. Monthly payroll run creates pending records for each active worker.
3. Each pending record is sent to Paystack Transfer API (Mobile Money).
4. Founder can toggle payroll on/off globally, or per worker.
"""
import logging
import os
import requests as http_requests
from datetime import datetime

from ..extensions import db
from ..models import TeamPayroll, TeamPayrollSettings, User, CreatorWithdrawal, CreatorPayoutSettings

log = logging.getLogger(__name__)

PAYSTACK_SECRET = os.environ.get('PAYSTACK_SECRET_KEY', '')
PAYSTACK_BASE = 'https://api.paystack.co'


def _headers():
    return {
        'Authorization': f'Bearer {PAYSTACK_SECRET}',
        'Content-Type': 'application/json',
    }


# ---------------------------------------------------------------------------
# Paystack Transfer Recipient (create once per worker)
# ---------------------------------------------------------------------------

def create_transfer_recipient(settings: TeamPayrollSettings) -> str | None:
    """Create a Paystack transfer recipient for a team member's MoMo account.
    Returns recipient_code or None on failure.
    """
    if not PAYSTACK_SECRET:
        log.error('PAYSTACK_SECRET_KEY not configured')
        return None

    provider_map = {
        'MTN': 'mtn',
        'VODAFONE': 'vod',
        'AIRTELTIGO': 'atl',
    }
    bank_code = provider_map.get(settings.provider.upper(), 'mtn')

    payload = {
        'type': 'mobile_money',
        'name': settings.account_name or 'WiamApp Worker',
        'account_number': settings.account_number,
        'bank_code': bank_code,
        'currency': 'GHS',
    }

    try:
        resp = http_requests.post(
            f'{PAYSTACK_BASE}/transferrecipient',
            json=payload,
            headers=_headers(),
            timeout=15,
        )
        data = resp.json()
        if data.get('status'):
            code = data['data']['recipient_code']
            settings.paystack_recipient_code = code
            settings.is_verified = True
            settings.updated_at = datetime.utcnow()
            db.session.commit()
            log.info('Created transfer recipient %s for user %s', code, settings.user_id)
            return code
        else:
            log.error('Paystack recipient error: %s', data.get('message'))
            return None
    except Exception as e:
        log.error('Paystack recipient exception: %s', e)
        return None


# ---------------------------------------------------------------------------
# Initiate a single transfer
# ---------------------------------------------------------------------------

def send_transfer(payroll: TeamPayroll) -> bool:
    """Send a Paystack transfer for a single payroll record.
    Returns True on success, False on failure.
    """
    if not PAYSTACK_SECRET:
        payroll.status = 'failed'
        payroll.failure_reason = 'PAYSTACK_SECRET_KEY not configured'
        db.session.commit()
        return False

    # Get recipient code
    settings = TeamPayrollSettings.query.get(payroll.user_id)
    if not settings or not settings.paystack_recipient_code:
        payroll.status = 'failed'
        payroll.failure_reason = 'No Paystack recipient code'
        db.session.commit()
        return False

    amount_pesewas = int(payroll.amount_ghs * 100)
    reference = f'payroll_{payroll.user_id}_{payroll.year}_{payroll.month}_{payroll.id}'

    payload = {
        'source': 'balance',
        'amount': amount_pesewas,
        'recipient': settings.paystack_recipient_code,
        'reason': f'WiamApp Salary {payroll.role_name} — {payroll.month}/{payroll.year}',
        'reference': reference,
        'currency': 'GHS',
    }

    try:
        payroll.status = 'processing'
        payroll.paystack_reference = reference
        db.session.commit()

        resp = http_requests.post(
            f'{PAYSTACK_BASE}/transfer',
            json=payload,
            headers=_headers(),
            timeout=15,
        )
        data = resp.json()

        if data.get('status'):
            payroll.paystack_transfer_code = data['data'].get('transfer_code', '')
            payroll.status = 'sent'
            payroll.completed_at = datetime.utcnow()
            db.session.commit()
            log.info('Transfer sent: %s GHS %.2f', payroll.role_name, payroll.amount_ghs)
            return True
        else:
            payroll.status = 'failed'
            payroll.failure_reason = data.get('message', 'Unknown error')[:200]
            db.session.commit()
            log.error('Transfer failed: %s', data.get('message'))
            return False

    except Exception as e:
        payroll.status = 'failed'
        payroll.failure_reason = str(e)[:200]
        db.session.commit()
        log.error('Transfer exception: %s', e)
        return False


# ---------------------------------------------------------------------------
# Monthly payroll run
# ---------------------------------------------------------------------------

def generate_monthly_payroll(year: int, month: int, approved_by: int = None) -> list:
    """Create pending payroll records for all active workers for the given month.
    Returns list of created TeamPayroll records.
    """
    active_workers = TeamPayrollSettings.query.filter_by(is_active=True).all()
    created = []

    for settings in active_workers:
        # Skip if already exists for this period
        existing = TeamPayroll.query.filter_by(
            user_id=settings.user_id, year=year, month=month
        ).first()
        if existing:
            continue

        if settings.monthly_salary_ghs <= 0:
            continue

        record = TeamPayroll(
            user_id=settings.user_id,
            role_name=settings.role_name,
            amount_ghs=settings.monthly_salary_ghs,
            year=year,
            month=month,
            status='pending',
            provider=settings.provider,
            account_number=settings.account_number,
            account_name=settings.account_name,
            approved_by=approved_by,
        )
        db.session.add(record)
        created.append(record)

    db.session.commit()
    return created


def run_payroll(year: int, month: int) -> dict:
    """Execute all pending payroll transfers for the given month.
    Returns summary dict.
    """
    pending = TeamPayroll.query.filter_by(
        year=year, month=month, status='pending'
    ).all()

    results = {'sent': 0, 'failed': 0, 'total': len(pending)}

    for record in pending:
        success = send_transfer(record)
        if success:
            results['sent'] += 1
        else:
            results['failed'] += 1

    return results


def get_payroll_summary(year: int, month: int) -> dict:
    """Get summary stats for a payroll period."""
    records = TeamPayroll.query.filter_by(year=year, month=month).all()
    total = sum(r.amount_ghs for r in records)
    sent = sum(1 for r in records if r.status == 'sent')
    failed = sum(1 for r in records if r.status == 'failed')
    pending = sum(1 for r in records if r.status == 'pending')

    return {
        'records': records,
        'total_amount': total,
        'sent': sent,
        'failed': failed,
        'pending': pending,
        'count': len(records),
    }


# ===========================================================================
# Creator Withdrawal Processing
# ===========================================================================

def create_creator_recipient(settings: CreatorPayoutSettings) -> str | None:
    """Create a Paystack transfer recipient for a creator's MoMo account.
    Returns recipient_code or None on failure.
    """
    if not PAYSTACK_SECRET:
        log.error('PAYSTACK_SECRET_KEY not configured')
        return None

    provider_map = {
        'MTN': 'mtn',
        'VODAFONE': 'vod',
        'AIRTELTIGO': 'atl',
    }
    bank_code = provider_map.get(settings.provider.upper(), 'mtn')

    payload = {
        'type': 'mobile_money',
        'name': settings.account_name or 'WiamApp Creator',
        'account_number': settings.account_number,
        'bank_code': bank_code,
        'currency': 'GHS',
    }

    try:
        resp = http_requests.post(
            f'{PAYSTACK_BASE}/transferrecipient',
            json=payload,
            headers=_headers(),
            timeout=15,
        )
        data = resp.json()
        if data.get('status'):
            code = data['data']['recipient_code']
            settings.paystack_recipient_code = code
            settings.is_verified = True
            settings.updated_at = datetime.utcnow()
            db.session.commit()
            log.info('Created creator transfer recipient %s for creator %s', code, settings.creator_id)
            return code
        else:
            log.error('Creator recipient error: %s', data.get('message'))
            return None
    except Exception as e:
        log.error('Creator recipient exception: %s', e)
        return None


def send_creator_withdrawal(withdrawal: CreatorWithdrawal) -> bool:
    """Send a Paystack transfer for a single creator withdrawal.
    Returns True on success, False on failure.
    """
    if not PAYSTACK_SECRET:
        withdrawal.status = 'failed'
        withdrawal.failure_reason = 'PAYSTACK_SECRET_KEY not configured'
        db.session.commit()
        return False

    settings = CreatorPayoutSettings.query.get(withdrawal.creator_id)
    if not settings:
        withdrawal.status = 'failed'
        withdrawal.failure_reason = 'No payout settings found'
        db.session.commit()
        return False

    # Ensure we have a recipient code
    recipient_code = settings.paystack_recipient_code
    if not recipient_code:
        recipient_code = create_creator_recipient(settings)
        if not recipient_code:
            withdrawal.status = 'failed'
            withdrawal.failure_reason = 'Could not create Paystack transfer recipient'
            db.session.commit()
            return False

    amount_pesewas = int(withdrawal.amount_ghs * 100)
    reference = f'creator_wd_{withdrawal.creator_id}_{withdrawal.id}'

    payload = {
        'source': 'balance',
        'amount': amount_pesewas,
        'recipient': recipient_code,
        'reason': f'WiamApp Creator Withdrawal #{withdrawal.id}',
        'reference': reference,
        'currency': 'GHS',
    }

    try:
        withdrawal.status = 'processing'
        withdrawal.paystack_reference = reference
        db.session.commit()

        resp = http_requests.post(
            f'{PAYSTACK_BASE}/transfer',
            json=payload,
            headers=_headers(),
            timeout=15,
        )
        data = resp.json()

        if data.get('status'):
            withdrawal.paystack_transfer_code = data['data'].get('transfer_code', '')
            withdrawal.status = 'sent'
            withdrawal.processed_at = datetime.utcnow()
            db.session.commit()
            log.info('Creator withdrawal sent: creator %s GHS %.2f',
                     withdrawal.creator_id, withdrawal.amount_ghs)
            return True
        else:
            withdrawal.status = 'failed'
            withdrawal.failure_reason = data.get('message', 'Unknown error')[:200]
            db.session.commit()
            log.error('Creator withdrawal failed: %s', data.get('message'))
            return False

    except Exception as e:
        withdrawal.status = 'failed'
        withdrawal.failure_reason = str(e)[:200]
        db.session.commit()
        log.error('Creator withdrawal exception: %s', e)
        return False


def process_pending_withdrawals() -> dict:
    """Process all pending creator withdrawal requests.
    Returns summary dict.
    """
    pending = CreatorWithdrawal.query.filter_by(status='pending').order_by(
        CreatorWithdrawal.requested_at.asc()
    ).all()

    results = {'sent': 0, 'failed': 0, 'total': len(pending)}

    for wd in pending:
        success = send_creator_withdrawal(wd)
        if success:
            results['sent'] += 1
        else:
            results['failed'] += 1

    return results
