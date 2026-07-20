"""Public application form routes — no login required."""
import json
from datetime import datetime
from flask import Blueprint, render_template, request, flash, redirect, url_for
from ..extensions import db, csrf
from ..models import ApplicationForm, ApplicationResponse

apply_bp = Blueprint('apply', __name__)


@apply_bp.route('/apply/<token>', methods=['GET', 'POST'])
@csrf.exempt
def fill_form(token):
    """Public page where applicants fill out their application form."""
    resp = ApplicationResponse.query.filter_by(token=token).first_or_404()
    form = ApplicationForm.query.get_or_404(resp.form_id)
    fields = json.loads(form.fields_json or '[]')

    # Already submitted
    if resp.is_submitted:
        return render_template('apply_done.html', form=form, resp=resp)

    errors = {}
    if request.method == 'POST':
        answers = {}
        for field in fields:
            name = field['name']
            ftype = field.get('type', 'text')

            if ftype == 'checkbox':
                val = 'yes' if request.form.get(name) else ''
            else:
                val = request.form.get(name, '').strip()

            answers[name] = val

            # Validate required
            if field.get('required') and not val:
                errors[name] = f'{field["label"]} is required'

        if not errors:
            resp.answers_json = json.dumps(answers)
            resp.applicant_name = answers.get('full_name', resp.applicant_name)
            resp.submitted_at = datetime.utcnow()
            db.session.commit()
            return render_template('apply_done.html', form=form, resp=resp)

    return render_template('apply_form.html',
        form=form,
        resp=resp,
        fields=fields,
        errors=errors,
        values=request.form if request.method == 'POST' else {},
    )
