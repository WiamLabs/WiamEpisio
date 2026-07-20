"""
SQLAlchemy models that map to the bot's existing PostgreSQL tables.
No new tables are created for users/content/genres — we reuse the bot's tables.
New web-only tables use the 'w_' prefix.
"""
from datetime import datetime, timedelta
from flask_login import UserMixin
from .extensions import db


# ---------------------------------------------------------------------------
# BOT'S EXISTING TABLES (read/write, mapped as-is)
# ---------------------------------------------------------------------------

class User(db.Model, UserMixin):
    """Maps to the bot's existing 'users' table."""
    __tablename__ = 'users'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    wiam_id = db.Column('telegram_id', db.BigInteger, unique=True, nullable=True)
    username = db.Column(db.Text, unique=True, nullable=True)
    first_name = db.Column(db.Text)
    last_name = db.Column(db.Text)
    role = db.Column(db.Text, default='user')
    creator_application_status = db.Column(db.Text, default='none')
    creator_approval_scheduled = db.Column(db.DateTime, nullable=True)
    date_joined = db.Column(db.DateTime, default=datetime.utcnow)
    last_active = db.Column(db.DateTime, default=datetime.utcnow)
    source = db.Column(db.Text, default='private')
    status = db.Column(db.Text, default='active')
    google_id = db.Column(db.Text, unique=True, nullable=True)
    email = db.Column(db.Text, nullable=True)
    phone = db.Column(db.Text, nullable=True)
    password_hash = db.Column(db.Text, nullable=True)
    email_verified = db.Column(db.Boolean, default=False)
    two_factor_enabled = db.Column(db.Boolean, default=False)
    two_factor_secret = db.Column(db.Text, nullable=True)
    auth_provider = db.Column(db.Text, default='email')  # email | google | both
    onboarding_completed = db.Column(db.Boolean, default=True)  # False for new Google/email signups
    registration_completed = db.Column(db.Boolean, default=True)  # False until mobile finishes avatar/profile tail
    bio = db.Column(db.Text, nullable=True)
    date_of_birth = db.Column(db.Date, nullable=True)
    dob_visible = db.Column(db.Boolean, default=False)
    pronouns = db.Column(db.Text, nullable=True)  # he/him, she/her, they/them
    show_pronouns = db.Column(db.Boolean, default=False)
    avatar_url = db.Column(db.Text, nullable=True)
    account_region = db.Column(db.Text, nullable=True)
    # Notification preferences
    notif_new_chapter = db.Column(db.Boolean, default=True)
    notif_new_follower = db.Column(db.Boolean, default=True)
    notif_comments = db.Column(db.Boolean, default=True)
    notif_likes = db.Column(db.Boolean, default=True)
    notif_mentions = db.Column(db.Boolean, default=True)
    notif_announcements = db.Column(db.Boolean, default=True)
    notif_coins = db.Column(db.Boolean, default=True)
    notif_elite = db.Column(db.Boolean, default=True)
    notif_email = db.Column(db.Boolean, default=False)
    notif_push = db.Column(db.Boolean, default=True)
    notif_sound = db.Column(db.Text, default='chime')  # chime, bell, drop, ping, marimba
    # Privacy settings
    privacy_profile_visible = db.Column(db.Boolean, default=True)
    privacy_show_reading_activity = db.Column(db.Boolean, default=True)
    privacy_show_library = db.Column(db.Boolean, default=True)
    privacy_show_favorites = db.Column(db.Boolean, default=False)
    # Premium subscription fields
    premium_status = db.Column(db.Text, default='none')           # none | active | expired | trial
    premium_expires_at = db.Column(db.DateTime, nullable=True)
    premium_started_at = db.Column(db.DateTime, nullable=True)
    premium_plan = db.Column(db.Text, nullable=True)              # monthly
    premium_provider = db.Column(db.Text, nullable=True)          # paystack | manual | admin_grant
    premium_credits_balance = db.Column(db.Integer, default=0)
    premium_credits_cycle_start = db.Column(db.DateTime, nullable=True)
    premium_credits_cycle_end = db.Column(db.DateTime, nullable=True)
    trial_used = db.Column(db.Boolean, default=False)
    # Creator Pro subscription (separate from reader WiamPremium)
    creator_pro_status = db.Column(db.Text, default='none')       # none | active | expired | trial | grace
    creator_pro_plan = db.Column(db.Text, nullable=True)          # monthly | yearly
    creator_pro_started_at = db.Column(db.DateTime, nullable=True)
    creator_pro_expires_at = db.Column(db.DateTime, nullable=True)
    creator_pro_provider = db.Column(db.Text, nullable=True)      # paystack | iap_apple | iap_google | admin_grant
    creator_pro_grace_until = db.Column(db.DateTime, nullable=True)  # 7-14 day grace after expiry
    creator_pro_trial_used = db.Column(db.Boolean, default=False)
    # Referral / Ambassador
    referral_code = db.Column(db.Text, nullable=True)
    referred_by = db.Column(db.BigInteger, nullable=True)
    # Money Ecosystem v5
    refund_count = db.Column(db.Integer, default=0)
    risk_score = db.Column(db.Integer, default=0)          # 0-100, higher = riskier
    account_frozen = db.Column(db.Boolean, default=False)  # founder can freeze
    # v6-IAP: Growth features
    welcome_bonus_claimed = db.Column(db.Boolean, default=False)
    last_daily_reward = db.Column(db.DateTime, nullable=True)
    daily_reward_streak = db.Column(db.Integer, default=0)
    # Team account system — dedicated work accounts created by Founder
    is_team_account = db.Column(db.Boolean, default=False)   # True = locked to team dashboard only
    team_role_slug = db.Column(db.Text, nullable=True)       # e.g. 'moderator', 'editor' — the assigned team role
    team_created_by = db.Column(db.Integer, nullable=True)   # user.id of founder who created this account
    team_created_at = db.Column(db.DateTime, nullable=True)  # when the team account was provisioned
    # WIAMid secure login — rotating 12-char ID used as password
    team_wiam_id_hash = db.Column(db.Text, nullable=True)    # bcrypt hash of current WIAMid
    team_personal_email = db.Column(db.Text, nullable=True)  # applicant's real email (for ID delivery)
    team_id_issued_at = db.Column(db.DateTime, nullable=True)
    team_id_expires_at = db.Column(db.DateTime, nullable=True)

    def get_id(self):
        """Flask-Login uses this to identify the user in the session."""
        return str(self.id)

    @property
    def display_name(self):
        name = self.first_name or ''
        if self.last_name:
            name += f' {self.last_name}'
        return name.strip() or self.username or self.email or f'User {self.id}'

    @property
    def is_creator(self):
        r = (self.role or '').lower()
        if r in ('creator', 'founder'):
            return True
        # Legacy: some rows were marked approved without role=creator; web + mobile must agree.
        if (getattr(self, 'creator_application_status', None) or '').lower() == 'approved':
            return True
        return False

    @property
    def is_admin(self):
        if self.role == 'founder':
            return True
        return self.has_role('admin') or self.has_role('overall_boss')

    @property
    def is_founder(self):
        return self.role == 'founder'

    def set_password(self, password):
        from werkzeug.security import generate_password_hash
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        from werkzeug.security import check_password_hash
        return check_password_hash(self.password_hash, password)

    def has_permission(self, perm_key):
        """Check if user has a specific permission via any of their RBAC roles.
        Founders always have all permissions."""
        if self.role == 'founder':
            return True
        from sqlalchemy import text
        row = db.session.execute(text(
            "SELECT 1 FROM w_user_roles ur "
            "JOIN w_role_permissions rp ON rp.role_id = ur.role_id "
            "JOIN w_permissions p ON p.id = rp.permission_id "
            "WHERE ur.user_id = :uid AND p.key = :pkey LIMIT 1"
        ), {'uid': self.id, 'pkey': perm_key}).fetchone()
        return row is not None

    def has_role(self, role_name):
        """Check if user has a specific RBAC role."""
        if self.role == 'founder' and role_name == 'founder':
            return True
        from sqlalchemy import text
        row = db.session.execute(text(
            "SELECT 1 FROM w_user_roles ur "
            "JOIN w_roles r ON r.id = ur.role_id "
            "WHERE ur.user_id = :uid AND r.name = :rname LIMIT 1"
        ), {'uid': self.id, 'rname': role_name}).fetchone()
        return row is not None

    def get_roles(self):
        """Return list of role names for this user."""
        roles = []
        r = (self.role or '').lower()
        if r == 'founder':
            roles.append('founder')
            roles.append('creator')
        elif r == 'creator':
            roles.append('creator')
        elif (getattr(self, 'creator_application_status', None) or '').lower() == 'approved':
            roles.append('creator')
        from sqlalchemy import text
        rows = db.session.execute(text(
            "SELECT r.name FROM w_user_roles ur "
            "JOIN w_roles r ON r.id = ur.role_id "
            "WHERE ur.user_id = :uid"
        ), {'uid': self.id}).fetchall()
        roles.extend(r[0] for r in rows if r[0] not in roles)
        return roles

    def get_permissions(self):
        """Return set of permission keys for this user."""
        if self.role == 'founder':
            from sqlalchemy import text
            rows = db.session.execute(text(
                "SELECT key FROM w_permissions"
            )).fetchall()
            return {r[0] for r in rows}
        from sqlalchemy import text
        rows = db.session.execute(text(
            "SELECT DISTINCT p.key FROM w_user_roles ur "
            "JOIN w_role_permissions rp ON rp.role_id = ur.role_id "
            "JOIN w_permissions p ON p.id = rp.permission_id "
            "WHERE ur.user_id = :uid"
        ), {'uid': self.id}).fetchall()
        return {r[0] for r in rows}

    @property
    def is_team_member(self):
        """True if user is founder or has any RBAC role."""
        if self.role == 'founder':
            return True
        try:
            from sqlalchemy import text
            row = db.session.execute(text(
                "SELECT 1 FROM w_user_roles WHERE user_id = :uid LIMIT 1"
            ), {'uid': self.id}).fetchone()
            return row is not None
        except Exception:
            db.session.rollback()
            return False

    def __repr__(self):
        return f'<User {self.id} {self.username}>'


class VerificationCode(db.Model):
    """Email verification codes and password reset tokens."""
    __tablename__ = 'w_verification_codes'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=True)
    email = db.Column(db.Text, nullable=False)
    code = db.Column(db.Text, nullable=False)
    purpose = db.Column(db.Text, nullable=False)  # register, reset, two_factor
    is_used = db.Column(db.Boolean, default=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def is_expired(self):
        return datetime.utcnow() > self.expires_at


class Content(db.Model):
    """Maps to the bot's existing 'content' table (books/stories)."""
    __tablename__ = 'content'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.Text, nullable=False)
    type = db.Column(db.Text, default='book')
    content = db.Column(db.Text)
    preview = db.Column(db.Text)
    author = db.Column(db.Text)
    description = db.Column(db.Text)
    genre = db.Column(db.Text)
    cover_file_id = db.Column(db.Text)
    pdf_file_id = db.Column(db.Text)
    status = db.Column(db.Text, default='draft')
    price = db.Column(db.Float, default=0.0)
    price_buy_now = db.Column(db.Float)
    price_1_day = db.Column(db.Float)
    price_2_days = db.Column(db.Float)
    price_3_days = db.Column(db.Float)
    price_4_days = db.Column(db.Float)
    price_5_days = db.Column(db.Float)
    price_30_days = db.Column(db.Float)
    views = db.Column(db.Integer, default=0)
    creator_wiam_id = db.Column('creator_telegram_id', db.BigInteger)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    deleted_at = db.Column(db.DateTime)
    source = db.Column(db.Text, default='web')
    allow_download = db.Column(db.Boolean, default=True)
    generated_pdf_file_id = db.Column(db.Text)
    published_at = db.Column(db.DateTime)
    # Monetization tier flags
    is_apex = db.Column(db.Boolean, default=False)
    apex_contract_status = db.Column(db.Text, default='none')  # none | offered | signed | active | ended
    # Editorial review tracking
    review_status = db.Column(db.Text, default='unreviewed')  # unreviewed | under_review | approved | rejected | revision_requested
    review_score = db.Column(db.Integer, nullable=True)
    last_reviewed_at = db.Column(db.DateTime, nullable=True)
    reviewed_by = db.Column(db.BigInteger, nullable=True)
    algorithm_weight = db.Column(db.Integer, default=1)  # 1=creator, 0=classic/seeded
    ai_verified = db.Column(db.Boolean, default=False)
    introduction = db.Column(db.Text, nullable=True)  # Optional author's note / introduction
    # WiamEpisio — Content is the universal Series/Show entity for novels + drama
    format = db.Column(db.Text, default='novel')  # novel | drama | anime
    trailer_url = db.Column(db.Text, nullable=True)
    poster_url = db.Column(db.Text, nullable=True)
    total_episodes = db.Column(db.Integer, default=0)
    free_episode_count = db.Column(db.Integer, default=5)  # product law: first N free
    # Catalog shelves (Wiam Origin replaces Apex; VIP / Anime shelves)
    catalog_shelf = db.Column(db.Text, default='standard')  # standard | origin | vip | anime
    is_wiam_origin = db.Column(db.Boolean, default=False)   # platform-owned / signed exclusive
    is_vip_series = db.Column(db.Boolean, default=False)
    # Completeness — no half series may go live
    planned_episode_count = db.Column(db.Integer, default=0)  # creator declares full length
    is_series_complete = db.Column(db.Boolean, default=False)  # all planned eps ready
    # Story shape — creator chooses at create time
    # series = one complete story (no seasons) · season = Season N of a longer show (submit season-by-season)
    structure_mode = db.Column(db.Text, default='series')  # series | season
    season_number = db.Column(db.Integer, default=1)
    show_group_key = db.Column(db.Text, nullable=True)  # links Season 1/2/3 of same show
    # Season/series lock — creator confirms full unit; edits only via revision request when live
    season_locked = db.Column(db.Boolean, default=False)
    season_locked_at = db.Column(db.DateTime, nullable=True)
    season_locked_by = db.Column(db.BigInteger, nullable=True)
    rights_confirmed = db.Column(db.Boolean, default=False)
    banner_url = db.Column(db.Text, nullable=True)
    # Full-season QC (trailer + every episode + cover/banner) — website/founder publishes
    season_qc_status = db.Column(db.Text, default='none')  # none|pending|queued|passed|failed|needs_changes
    # Structured Needs-Changes list for creator UI (JSON array)
    review_change_items = db.Column(db.Text, default='[]')
    submitted_for_review_at = db.Column(db.DateTime, nullable=True)
    # Trailer (critical surface — Series detail top + home featured)
    trailer_storage_key = db.Column(db.Text, nullable=True)
    trailer_hls_url = db.Column(db.Text, nullable=True)
    trailer_poster_url = db.Column(db.Text, nullable=True)
    trailer_duration_seconds = db.Column(db.Integer, default=0)
    trailer_qa_status = db.Column(db.Text, default='none')  # none|pending|passed|failed|needs_review
    trailer_qa_score = db.Column(db.Float, nullable=True)
    trailer_qa_checked_at = db.Column(db.DateTime, nullable=True)
    # Coin pricing band (episodes inherit unless overridden)
    coin_band = db.Column(db.Text, default='standard')  # standard | premium | origin | vip
    # Soft rankings (replaces ultra-hard WiamElite Hall of Fame)
    ranking_score = db.Column(db.Float, default=0.0)
    ranking_updated_at = db.Column(db.DateTime, nullable=True)

    PUBLISHED_STATUSES = ['ongoing', 'complete', 'approved', 'published']

    @property
    def is_published(self):
        return self.status in self.PUBLISHED_STATUSES

    @property
    def is_deleted(self):
        return self.deleted_at is not None

    @property
    def is_featured(self):
        return FeaturedBook.query.filter_by(content_id=self.id).first() is not None

    @property
    def creator(self):
        if self.creator_wiam_id:
            return User.query.filter_by(wiam_id=self.creator_wiam_id).first()
        return None

    @property
    def cover_url(self):
        if self.cover_file_id:
            if self.cover_file_id.startswith('ext_'):
                return self.cover_file_id[4:]
            if self.cover_file_id.startswith('dbimg_'):
                return f'/img/{self.cover_file_id[6:]}'
            if self.cover_file_id.startswith('web_'):
                return f'/creator/studio/covers/{self.cover_file_id[4:]}'
            return f'/api/cover/{self.cover_file_id}'
        return '/static/img/default_cover.png'

    @property
    def favorite_count(self):
        return Favorite.query.filter_by(content_id=self.id).count()

    @property
    def rating_count(self):
        return Rating.query.filter_by(content_id=self.id).count()

    @property
    def avg_rating(self):
        from sqlalchemy import func as _fn
        result = db.session.query(_fn.avg(Rating.rating)).filter_by(content_id=self.id).scalar()
        return round(float(result), 1) if result else 0.0

    @property
    def chapter_count(self):
        return WebBookContent.query.filter_by(content_id=self.id, status='published').count()

    def __repr__(self):
        return f'<Content {self.id} {self.title}>'


class Genre(db.Model):
    """Maps to the bot's existing 'genres' table."""
    __tablename__ = 'genres'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, unique=True, nullable=False)

    def __repr__(self):
        return f'<Genre {self.name}>'


class Favorite(db.Model):
    """Maps to the bot's existing 'favorites' table."""
    __tablename__ = 'favorites'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    content_id = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Access(db.Model):
    """Maps to the bot's existing 'access' table (user's library)."""
    __tablename__ = 'access'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    content_id = db.Column(db.Integer, nullable=False)
    access_type = db.Column(db.Text, default='permanent')
    start_date = db.Column(db.DateTime, default=datetime.utcnow)
    end_date = db.Column(db.DateTime)
    status = db.Column(db.Text, default='active')


class Order(db.Model):
    """Maps to the bot's existing 'orders' table."""
    __tablename__ = 'orders'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    content_id = db.Column(db.Integer, nullable=False)
    chat_id = db.Column(db.BigInteger)
    status = db.Column(db.Text, default='awaiting_payment')
    reference_code = db.Column(db.Text)
    payment_method = db.Column(db.Text, default='momo')
    access_type = db.Column(db.Text, default='permanent')
    rent_days = db.Column(db.Integer)
    price = db.Column(db.Float)
    proof_file_id = db.Column(db.Text)


class FeaturedBook(db.Model):
    """Maps to the bot's existing 'featured_books' table."""
    __tablename__ = 'featured_books'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, unique=True, nullable=False)
    featured_at = db.Column(db.DateTime, default=datetime.utcnow)
    featured_by = db.Column(db.BigInteger, nullable=False)


# ---------------------------------------------------------------------------
# BOT'S EXISTING TABLES (additional mappings)
# ---------------------------------------------------------------------------

class CreatorProfile(db.Model):
    """Maps to the bot's existing 'creator_profiles' table."""
    __tablename__ = 'creator_profiles'
    __table_args__ = {'extend_existing': True}

    wiam_id = db.Column('telegram_id', db.BigInteger, primary_key=True)
    pen_name = db.Column(db.Text, nullable=False)
    bio = db.Column(db.Text)
    country = db.Column(db.Text)
    profile_pic_file_id = db.Column(db.Text)
    primary_format = db.Column(db.Text, default='text')  # video | text | audio | hybrid — onboarding only
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def avatar_url(self):
        if self.profile_pic_file_id:
            return f'/api/cover/{self.profile_pic_file_id}'
        return None

    def __repr__(self):
        return f'<CreatorProfile {self.pen_name}>'


class Follow(db.Model):
    """Maps to the bot's existing 'follows' table."""
    __tablename__ = 'follows'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    creator_id = db.Column(db.BigInteger, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Rating(db.Model):
    """Maps to the bot's existing 'ratings' table."""
    __tablename__ = 'ratings'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    content_id = db.Column(db.Integer, nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)


class CommissionSettings(db.Model):
    """Maps to the bot's existing 'commission_settings' table."""
    __tablename__ = 'commission_settings'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True, default=1)
    enabled = db.Column(db.Boolean, default=False)
    rate = db.Column(db.Float, default=0.30)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)


class PlatformFeeSettings(db.Model):
    """Maps to the bot's existing 'platform_fee_settings' table."""
    __tablename__ = 'platform_fee_settings'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True, default=1)
    fee_rate = db.Column(db.Float, default=0.05)
    fee_cycle_months = db.Column(db.Integer, default=5)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# WEB-ONLY TABLES (new, created by db.create_all())
# ---------------------------------------------------------------------------

class WebSession(db.Model):
    """Stores login sessions for the web app."""
    __tablename__ = 'w_sessions'

    id = db.Column(db.Integer, primary_key=True)
    wiam_id = db.Column('telegram_id', db.BigInteger, nullable=False, index=True)
    token = db.Column(db.Text, unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<WebSession {self.wiam_id}>'


class Review(db.Model):
    """Web-only: written reviews for books."""
    __tablename__ = 'w_reviews'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    content_id = db.Column(db.Integer, nullable=False, index=True)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def like_count(self):
        return ReviewLike.query.filter_by(review_id=self.id).count()

    def __repr__(self):
        return f'<Review user={self.user_id} book={self.content_id}>'


class ReviewLike(db.Model):
    """Likes on reviews/comments."""
    __tablename__ = 'w_review_likes'

    id = db.Column(db.Integer, primary_key=True)
    review_id = db.Column(db.Integer, nullable=False, index=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('review_id', 'user_id', name='uq_review_like'),
        {'extend_existing': True},
    )


class WebBookContent(db.Model):
    """Stores book content written in the Writing Studio, per chapter."""
    __tablename__ = 'w_book_content'

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, nullable=False, index=True)
    chapter_number = db.Column(db.Integer, default=1)
    chapter_title = db.Column(db.Text, nullable=False, default='Chapter 1')
    body = db.Column(db.Text, nullable=False, default='')
    word_count = db.Column(db.Integer, default=0)
    status = db.Column(db.Text, default='draft')        # draft | published
    is_locked = db.Column(db.Boolean, default=False)     # paid chapter (coin unlock)
    chapter_price = db.Column(db.Float, default=0.0)     # price if locked
    is_premium_locked = db.Column(db.Boolean, default=False)  # requires premium credit to unlock
    unlock_cost_credits = db.Column(db.Integer, default=1)    # credits needed (default 1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Push 3 — first-publish timestamp; powers "since last chapter" creator
    # analytics + the scheduled-publish queue (Push 8).
    published_at = db.Column(db.DateTime, nullable=True)
    # Push 7 (Studio V2) — optional scheduling + grouping. All nullable so
    # existing rows keep working without a migration.
    scheduled_publish_at = db.Column(db.DateTime, nullable=True)
    arc_id = db.Column(db.Integer, nullable=True)         # FK -> w_arcs.id (logical, not enforced for safety)
    content_kind = db.Column(db.Text, nullable=True)       # 'chapter' | 'episode' | 'part' | 'scene' | 'extra' | 'side' | 'alt_ending'
    content_unit_label = db.Column(db.Text, nullable=True) # creator-chosen display label override
    is_extra = db.Column(db.Boolean, default=False)        # bonus / behind-the-scenes flag

    __table_args__ = (
        db.UniqueConstraint('content_id', 'chapter_number', name='uq_book_chapter'),
        db.Index('ix_book_content_scheduled', 'scheduled_publish_at'),
        db.Index('ix_book_content_arc', 'arc_id'),
    )

    def __repr__(self):
        return f'<WebBookContent book={self.content_id} ch={self.chapter_number}>'


class ReadingProgress(db.Model):
    """Tracks where each reader left off in a book."""
    __tablename__ = 'w_reading_progress'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    content_id = db.Column(db.Integer, nullable=False)
    current_chapter = db.Column(db.Integer, default=1)
    current_position = db.Column(db.Integer, default=0)
    current_paragraph = db.Column(db.Integer, default=0)
    total_chapters = db.Column(db.Integer, default=1)
    last_read_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'content_id', name='uq_user_book_progress'),
    )

    def __repr__(self):
        return f'<ReadingProgress user={self.user_id} book={self.content_id}>'


class ChapterComment(db.Model):
    """A reader's comment on a specific chapter."""
    __tablename__ = 'w_chapter_comments'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    content_id = db.Column(db.Integer, nullable=False, index=True)
    chapter_number = db.Column(db.Integer, nullable=False)
    text = db.Column(db.Text, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def user(self):
        return User.query.filter_by(wiam_id=self.user_id).first()

    @property
    def like_count(self):
        return ChapterCommentLike.query.filter_by(comment_id=self.id).count()

    def __repr__(self):
        return f'<ChapterComment id={self.id} ch={self.chapter_number}>'


class ChapterCommentLike(db.Model):
    """Like on a chapter comment."""
    __tablename__ = 'w_chapter_comment_likes'

    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, nullable=False, index=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('comment_id', 'user_id', name='uq_chapter_comment_like'),
        {'extend_existing': True},
    )


class ChapterLike(db.Model):
    """A reader's like on a chapter (one per user per chapter)."""
    __tablename__ = 'w_chapter_likes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    content_id = db.Column(db.Integer, nullable=False)
    chapter_number = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'content_id', 'chapter_number', name='uq_chapter_like'),
        {'extend_existing': True},
    )


class ChapterVote(db.Model):
    """A reader's vote on a chapter (upvote=1, downvote=-1)."""
    __tablename__ = 'w_chapter_votes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    content_id = db.Column(db.Integer, nullable=False)
    chapter_number = db.Column(db.Integer, nullable=False)
    value = db.Column(db.Integer, default=1)  # 1 or -1
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'content_id', 'chapter_number', name='uq_chapter_vote'),
        {'extend_existing': True},
    )


class ParagraphReaction(db.Model):
    """Emoji reaction on a specific paragraph within a chapter."""
    __tablename__ = 'w_paragraph_reactions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    content_id = db.Column(db.Integer, nullable=False, index=True)
    chapter_number = db.Column(db.Integer, nullable=False)
    paragraph_index = db.Column(db.Integer, nullable=False)
    emoji = db.Column(db.Text, nullable=False)              # ❤️ 😂 😭 😡 😮 🔥
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'content_id', 'chapter_number', 'paragraph_index',
                            name='uq_para_reaction'),
        {'extend_existing': True},
    )


class ParagraphComment(db.Model):
    """Comment or reply on a specific paragraph within a chapter."""
    __tablename__ = 'w_paragraph_comments'

    id = db.Column(db.Integer, primary_key=True)
    parent_id = db.Column(db.Integer, nullable=True, index=True)   # NULL = top-level
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    content_id = db.Column(db.Integer, nullable=False, index=True)
    chapter_number = db.Column(db.Integer, nullable=False)
    paragraph_index = db.Column(db.Integer, nullable=False)
    text = db.Column(db.Text, nullable=False)
    like_count = db.Column(db.Integer, default=0)
    is_deleted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def user(self):
        return User.query.filter_by(wiam_id=self.user_id).first()

    @property
    def replies(self):
        return ParagraphComment.query.filter_by(
            parent_id=self.id, is_deleted=False
        ).order_by(ParagraphComment.created_at).all()


class ParagraphCommentLike(db.Model):
    """Like on a paragraph comment."""
    __tablename__ = 'w_paragraph_comment_likes'

    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, nullable=False, index=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('comment_id', 'user_id', name='uq_para_comment_like'),
        {'extend_existing': True},
    )


class ReaderPreferences(db.Model):
    """User reading preferences (theme, font size, font family, line spacing)."""
    __tablename__ = 'w_reader_preferences'

    user_id = db.Column(db.BigInteger, primary_key=True)
    theme = db.Column(db.Text, default='light')
    font_size = db.Column(db.Text, default='medium')
    font_family = db.Column(db.Text, default='serif')
    line_spacing = db.Column(db.Text, default='normal')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<ReaderPreferences user={self.user_id}>'


class Announcement(db.Model):
    """Founder announcements — banner on web + notification + channel post."""
    __tablename__ = 'w_announcements'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.Text, nullable=False)
    message = db.Column(db.Text, nullable=False, default='')
    type = db.Column(db.Text, default='info')           # info | update | promo
    audience = db.Column(db.Text, default='all')         # all | creators | specific
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Announcement {self.id} {self.title[:30]}>'


class Notification(db.Model):
    """In-app notifications for users."""
    __tablename__ = 'w_notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    type = db.Column(db.Text, nullable=False)       # new_book, order_update, access_expiry, follow, system
    title = db.Column(db.Text, nullable=False)
    message = db.Column(db.Text, nullable=False, default='')
    link = db.Column(db.Text)                        # URL to navigate to
    is_read = db.Column(db.Boolean, default=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Notification {self.id} user={self.user_id} type={self.type}>'


class PushSubscription(db.Model):
    """Browser push notification subscriptions."""
    __tablename__ = 'w_push_subscriptions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    endpoint = db.Column(db.Text, nullable=False)
    p256dh = db.Column(db.Text, nullable=False)
    auth = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ExpoPushToken(db.Model):
    """Expo push notification tokens for native mobile apps."""
    __tablename__ = 'w_expo_push_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    token = db.Column(db.Text, nullable=False, unique=True)
    device_name = db.Column(db.Text, nullable=True)
    platform = db.Column(db.String(10), nullable=True)   # ios | android
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TrialDeviceFingerprint(db.Model):
    """Track trial usage by device fingerprint hash for anti-abuse."""
    __tablename__ = 'w_trial_device_fingerprints'

    id = db.Column(db.Integer, primary_key=True)
    device_hash = db.Column(db.String(128), nullable=False, unique=True, index=True)
    first_user_id = db.Column(db.BigInteger, nullable=True, index=True)
    last_user_id = db.Column(db.BigInteger, nullable=True, index=True)
    trial_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmailJob(db.Model):
    """Queued email jobs processed by the background email worker."""
    __tablename__ = 'w_email_jobs'

    id = db.Column(db.Integer, primary_key=True)
    to_email = db.Column(db.String(255), nullable=False, index=True)
    subject = db.Column(db.Text, nullable=False)
    html_body = db.Column(db.Text, nullable=False)
    priority = db.Column(db.Integer, default=2, index=True)  # 1=urgent (verification), 2=normal (bulk)
    status = db.Column(db.String(20), default='pending', index=True)  # pending, sending, sent, failed, cancelled
    error = db.Column(db.Text, nullable=True)
    attempts = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    sent_at = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f'<EmailJob {self.id} to={self.to_email} status={self.status}>'


class ReadingStreak(db.Model):
    """Track daily reading activity for streak/goal system."""
    __tablename__ = 'w_reading_streaks'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    date = db.Column(db.Date, nullable=False)
    minutes_read = db.Column(db.Integer, default=0)
    pages_read = db.Column(db.Integer, default=0)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'date', name='uq_streak_user_date'),
    )


class Bookmark(db.Model):
    """User bookmarks and highlights within books."""
    __tablename__ = 'w_bookmarks'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    content_id = db.Column(db.Integer, nullable=False)
    chapter_id = db.Column(db.Integer)
    position = db.Column(db.Text)          # JSON: {paragraph, offset} or page number
    highlight_text = db.Column(db.Text)    # selected text, if highlight
    note = db.Column(db.Text)              # user note
    color = db.Column(db.Text, default='yellow')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Shelf(db.Model):
    """Custom user shelves / reading lists."""
    __tablename__ = 'w_shelves'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    name = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, default='')
    is_public = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ShelfItem(db.Model):
    """Books added to a user shelf."""
    __tablename__ = 'w_shelf_items'

    id = db.Column(db.Integer, primary_key=True)
    shelf_id = db.Column(db.Integer, db.ForeignKey('w_shelves.id', ondelete='CASCADE'), nullable=False)
    content_id = db.Column(db.Integer, nullable=False)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('shelf_id', 'content_id', name='uq_shelf_content'),
    )


class UserLibrary(db.Model):
    """Explicit user library — books the reader chose to add to their shelf."""
    __tablename__ = 'w_user_library'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    content_id = db.Column(db.Integer, nullable=False)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'content_id', name='uq_user_library'),
    )


class BookCollection(db.Model):
    """Admin/founder curated book collections."""
    __tablename__ = 'w_collections'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, default='')
    cover_url = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class CollectionItem(db.Model):
    """Books in a curated collection."""
    __tablename__ = 'w_collection_items'

    id = db.Column(db.Integer, primary_key=True)
    collection_id = db.Column(db.Integer, db.ForeignKey('w_collections.id', ondelete='CASCADE'), nullable=False)
    content_id = db.Column(db.Integer, nullable=False)
    sort_order = db.Column(db.Integer, default=0)

    __table_args__ = (
        db.UniqueConstraint('collection_id', 'content_id', name='uq_coll_content'),
    )


class SectionSettings(db.Model):
    """Per-section visibility & admin-manage toggles for curated home page sections."""
    __tablename__ = 'w_section_settings'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    section_key = db.Column(db.Text, unique=True, nullable=False)   # e.g. 'wiam_top_picks'
    label = db.Column(db.Text, nullable=False)                      # display name
    is_active = db.Column(db.Boolean, default=False)                # section visible on home?
    admin_can_manage = db.Column(db.Boolean, default=False)         # admins allowed to manage?
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Known section keys
    WIAM_TOP_PICKS = 'wiam_top_picks'
    COLLECTIONS = 'collections'
    FEATURED = 'featured'
    PREMIUM_EXCLUSIVES = 'premium_exclusives'

    DEFAULTS = [
        {'section_key': 'wiam_top_picks', 'label': 'Wiam Top Picks', 'is_active': False, 'admin_can_manage': False},
        {'section_key': 'collections', 'label': 'Collections', 'is_active': False, 'admin_can_manage': False},
        {'section_key': 'featured', 'label': 'Featured Books', 'is_active': False, 'admin_can_manage': False},
        {'section_key': 'premium_exclusives', 'label': 'Premium Exclusives', 'is_active': False, 'admin_can_manage': False},
    ]

    @classmethod
    def get_all(cls):
        """Return all section settings, creating defaults if missing."""
        existing = {s.section_key: s for s in cls.query.all()}
        changed = False
        for d in cls.DEFAULTS:
            if d['section_key'] not in existing:
                s = cls(**d)
                db.session.add(s)
                existing[d['section_key']] = s
                changed = True
        if changed:
            db.session.commit()
        return [existing[d['section_key']] for d in cls.DEFAULTS]

    @classmethod
    def get(cls, section_key):
        """Get a single section setting by key."""
        s = cls.query.filter_by(section_key=section_key).first()
        if not s:
            default = next((d for d in cls.DEFAULTS if d['section_key'] == section_key), None)
            if default:
                s = cls(**default)
                db.session.add(s)
                db.session.commit()
        return s


class BookSection(db.Model):
    """Admin-created dynamic book sections for the HomeScreen.
    Each section defines filters (genre, min views, min rating, sort order)
    that the platform uses to automatically populate the section with matching books."""
    __tablename__ = 'w_book_sections'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.Text, nullable=False)                       # e.g. "Love Box", "Dark Thrillers"
    description = db.Column(db.Text, nullable=True)                  # optional subtitle
    icon = db.Column(db.Text, default='Sparkles')                    # lucide icon name
    genre_filter = db.Column(db.Text, nullable=True)                 # genre name filter (exact or null=any)
    min_views = db.Column(db.Integer, default=0)                     # minimum views threshold
    min_rating = db.Column(db.Float, default=0.0)                    # minimum avg rating
    min_chapters = db.Column(db.Integer, default=0)                  # minimum chapter count
    status_filter = db.Column(db.Text, nullable=True)                # ongoing | complete | null=any published
    sort_by = db.Column(db.Text, default='views')                    # views | rating | created_at | random
    max_books = db.Column(db.Integer, default=12)                    # how many books to show
    display_order = db.Column(db.Integer, default=0)                 # position on the home screen
    is_active = db.Column(db.Boolean, default=True)                  # toggle visibility
    created_by = db.Column(db.BigInteger, nullable=True)             # user who created this section
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def fetch_books(self):
        """Query books matching this section's filters."""
        q = Content.query.filter(
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at.is_(None),
        )
        if self.genre_filter:
            q = q.filter(Content.genre.ilike(f'%{self.genre_filter}%'))
        if self.min_views and self.min_views > 0:
            q = q.filter(Content.views >= self.min_views)
        if self.min_chapters and self.min_chapters > 0:
            from sqlalchemy import func as _fn
            # Subquery for chapter count
            sub = db.session.query(
                WebBookContent.content_id,
                _fn.count(WebBookContent.id).label('ch_count')
            ).filter(WebBookContent.status == 'published').group_by(
                WebBookContent.content_id
            ).having(_fn.count(WebBookContent.id) >= self.min_chapters).subquery()
            q = q.join(sub, Content.id == sub.c.content_id)
        if self.status_filter:
            q = q.filter(Content.status == self.status_filter)

        # Sorting
        if self.sort_by == 'rating':
            q = q.order_by(Content.views.desc().nullslast())  # fallback; real rating sort below
        elif self.sort_by == 'created_at':
            q = q.order_by(Content.created_at.desc())
        elif self.sort_by == 'random':
            from sqlalchemy.sql.expression import func as sqlfunc
            q = q.order_by(sqlfunc.random())
        else:  # views (default)
            q = q.order_by(Content.views.desc().nullslast())

        books = q.limit(self.max_books or 12).all()

        # Post-filter by rating if needed (avg_rating is a property, not a column)
        if self.min_rating and self.min_rating > 0:
            books = [b for b in books if (b.avg_rating or 0) >= self.min_rating]

        # Sort by rating if requested (since it's a property)
        if self.sort_by == 'rating':
            books.sort(key=lambda b: b.avg_rating or 0, reverse=True)

        return books

    def __repr__(self):
        return f'<BookSection {self.id} "{self.title}">'


class ShareEvent(db.Model):
    """Tracks when users share a book (for trending score)."""
    __tablename__ = 'w_share_events'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    content_id = db.Column(db.Integer, nullable=False, index=True)
    platform = db.Column(db.Text, default='unknown')  # whatsapp, twitter, facebook, copy_link, etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<ShareEvent user={self.user_id} book={self.content_id}>'


class StickerGift(db.Model):
    """Gift stickers sent between users on stories."""
    __tablename__ = 'w_sticker_gifts'

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.BigInteger, nullable=False, index=True)
    recipient_id = db.Column(db.BigInteger, nullable=False, index=True)
    content_id = db.Column(db.Integer, nullable=False, index=True)
    sticker_key = db.Column(db.Text, nullable=False)       # e.g. 'balloon', 'cake', 'heart'
    coin_cost = db.Column(db.Integer, nullable=False)
    message = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def sender(self):
        return User.query.filter_by(wiam_id=self.sender_id).first()

    @property
    def recipient(self):
        return User.query.filter_by(wiam_id=self.recipient_id).first()


class GiftBook(db.Model):
    """Gift a book to another user."""
    __tablename__ = 'w_gifts'

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.BigInteger, nullable=False)
    recipient_id = db.Column(db.BigInteger)           # null if unclaimed
    recipient_code = db.Column(db.Text, unique=True)   # claim code
    content_id = db.Column(db.Integer, nullable=False)
    message = db.Column(db.Text, default='')
    is_claimed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    claimed_at = db.Column(db.DateTime)


# ---------------------------------------------------------------------------
# PLATFORM CONFIG (replaces old Commission / PlatformFee for coin system)
# ---------------------------------------------------------------------------

class PlatformConfig(db.Model):
    """Single-row platform-wide settings for the coin & subscription system."""
    __tablename__ = 'w_platform_config'

    id = db.Column(db.Integer, primary_key=True, default=1)
    creator_revenue_pct = db.Column(db.Float, default=0.50)       # 50% of coin spend goes to creator
    elite_price_ghs = db.Column(db.Float, default=25.0)           # GH₵25/month
    premium_price_ghs = db.Column(db.Float, default=20.0)         # GH₵20/month
    elite_creator_pct = db.Column(db.Float, default=0.60)         # 60% of sub pool to Elite creators
    min_payout_ghs = db.Column(db.Float, default=15.0)            # minimum GH₵15 for auto-payout
    # Feature flags — control monetization without redeploy
    ff_premium_enabled = db.Column(db.Boolean, default=False)          # master switch for premium paywall
    ff_elite_paywall_enabled = db.Column(db.Boolean, default=False)    # require premium to read Elite content
    ff_apex_paywall_enabled = db.Column(db.Boolean, default=False)     # require premium to read Apex content
    ff_monthly_unlocks_enabled = db.Column(db.Boolean, default=False)  # enable monthly credit system
    ff_ad_free_premium_enabled = db.Column(db.Boolean, default=False)  # ad-free for premium users
    ff_premium_badge_enabled = db.Column(db.Boolean, default=True)     # show premium badge on profiles
    # Premium credits config
    premium_monthly_unlock_credits = db.Column(db.Integer, default=10) # credits granted each billing cycle
    # Payroll
    payroll_enabled = db.Column(db.Boolean, default=True)              # global toggle for team payroll
    # Google Ads
    ads_enabled = db.Column(db.Boolean, default=False)                 # master switch for Google Ads
    ads_client_id = db.Column(db.Text, default='')                     # Google AdSense publisher ID (ca-pub-XXXX)
    # Auth Gates — block login / registration independently
    auth_login_blocked = db.Column(db.Boolean, default=False)
    auth_registration_blocked = db.Column(db.Boolean, default=False)
    auth_login_blocked_until = db.Column(db.DateTime, nullable=True)   # auto-unblock date/time
    auth_registration_blocked_until = db.Column(db.DateTime, nullable=True)
    auth_login_blocked_message = db.Column(db.Text, default='Login is temporarily disabled. Please try again later.')
    auth_registration_blocked_message = db.Column(db.Text, default='Registration is temporarily closed. Please try again later.')
    auth_gate_updated_by = db.Column(db.BigInteger, nullable=True)     # wiam_id of who toggled
    auth_gate_updated_at = db.Column(db.DateTime, nullable=True)
    # WiamEpisio — Founder toggles
    ff_trailer_quality_gate = db.Column(db.Boolean, default=False)  # ON = check trailer asset
    ff_require_complete_series = db.Column(db.Boolean, default=True)  # ON = no half series live
    ff_vip_enabled = db.Column(db.Boolean, default=False)
    # Full-season QC pipeline (trailer + EVERY episode + cover) — Founder ON/OFF
    ff_season_quality_pipeline = db.Column(db.Boolean, default=True)  # master switch
    ff_season_qc_technical = db.Column(db.Boolean, default=True)      # ffprobe / aspect / duration
    ff_season_qc_visual = db.Column(db.Boolean, default=True)         # blur / light / stability
    ff_season_qc_audio = db.Column(db.Boolean, default=True)          # loudness / dialogue
    ff_season_qc_vmaf = db.Column(db.Boolean, default=True)           # Netflix VMAF (needs ffmpeg+libvmaf)
    ff_season_qc_ssim = db.Column(db.Boolean, default=True)
    ff_season_qc_scenedetect = db.Column(db.Boolean, default=True)
    ff_season_qc_vad = db.Column(db.Boolean, default=True)
    ff_season_qc_phash = db.Column(db.Boolean, default=True)
    ff_season_qc_watermark = db.Column(db.Boolean, default=True)
    ff_season_qc_blackdetect = db.Column(db.Boolean, default=True)
    ff_season_qc_integrity = db.Column(db.Boolean, default=True)      # duplicate / watermark heuristics
    ff_season_qc_auto_reject_poor = db.Column(db.Boolean, default=True)
    ff_season_qc_auto_clear_good = db.Column(db.Boolean, default=False)  # when ON, good+excellent skip human
    # After trust-tier SLA (72/48/24/12h) with no founder action: Good→publish, else Needs Changes
    ff_season_qc_sla_auto_decide = db.Column(db.Boolean, default=True)
    money_base_currency = db.Column(db.Text, default='USD')  # ledger display base
    vip_daily_stipend_coins = db.Column(db.Integer, default=30)
    vip_unlock_discount_pct = db.Column(db.Float, default=25.0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    @classmethod
    def get(cls):
        """Get or create the singleton config row."""
        cfg = cls.query.get(1)
        if not cfg:
            cfg = cls(id=1)
            db.session.add(cfg)
            db.session.commit()
        return cfg

    @property
    def is_login_blocked(self):
        """True if login is currently blocked (respects scheduled unblock)."""
        if not self.auth_login_blocked:
            return False
        if self.auth_login_blocked_until and datetime.utcnow() >= self.auth_login_blocked_until:
            return False
        return True

    @property
    def is_registration_blocked(self):
        """True if registration is currently blocked (respects scheduled unblock)."""
        if not self.auth_registration_blocked:
            return False
        if self.auth_registration_blocked_until and datetime.utcnow() >= self.auth_registration_blocked_until:
            return False
        return True

    def __repr__(self):
        return f'<PlatformConfig creator={self.creator_revenue_pct} elite_price={self.elite_price_ghs}>'


# ---------------------------------------------------------------------------
# COIN SYSTEM TABLES (Phase 2)
# ---------------------------------------------------------------------------

class CoinBalance(db.Model):
    """Tracks each user's current coin balance."""
    __tablename__ = 'w_coin_balances'

    user_id = db.Column(db.BigInteger, primary_key=True)
    balance = db.Column(db.Integer, nullable=False, default=0)
    total_purchased = db.Column(db.Integer, nullable=False, default=0)
    total_spent = db.Column(db.Integer, nullable=False, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<CoinBalance user={self.user_id} bal={self.balance}>'


class CoinTransaction(db.Model):
    """Log of all coin transactions — purchases, chapter unlocks, tips, etc."""
    __tablename__ = 'w_coin_transactions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    type = db.Column(db.Text, nullable=False)          # purchase | unlock | tip | refund | bonus
    amount = db.Column(db.Integer, nullable=False)      # positive = credit, negative = debit
    balance_after = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text, default='')
    reference = db.Column(db.Text, index=True)          # Paystack reference for purchases
    content_id = db.Column(db.Integer)                  # story id (for unlocks/tips)
    chapter_id = db.Column(db.Integer)                  # chapter id (for unlocks)
    recipient_id = db.Column(db.BigInteger)             # creator id (for tips/unlocks — payout tracking)
    store = db.Column(db.Text)                              # v6-IAP: 'apple' | 'google' | 'paystack' | None
    store_transaction_id = db.Column(db.Text)               # v6-IAP: Apple/Google transaction ID
    rate_limit_flag = db.Column(db.Boolean, default=False)  # v5: flagged by rate limiter
    dispute_status = db.Column(db.Text)                     # v5: None | disputed | refunded | resolved
    ledger_tx_group = db.Column(db.Text)                    # v5: link to LedgerEntry.tx_group
    voice_story_id = db.Column(db.Integer, nullable=True)   # WiamVox paid unlocks / tips (no book content_id)
    voice_moment_id = db.Column(db.Integer, nullable=True)    # WiamVox tip on a specific moment
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<CoinTransaction {self.id} user={self.user_id} {self.type} {self.amount}>'


class CoinPackage(db.Model):
    """Available coin packages for purchase."""
    __tablename__ = 'w_coin_packages'

    id = db.Column(db.Integer, primary_key=True)
    coins = db.Column(db.Integer, nullable=False)       # e.g. 100
    price_ghs = db.Column(db.Float, nullable=False)     # e.g. 5.00
    price_usd_cents = db.Column(db.Integer, default=0)  # v6-IAP: e.g. 499 = $4.99
    bonus_coins = db.Column(db.Integer, default=0)      # e.g. 0, 20, 50
    label = db.Column(db.Text, default='')              # e.g. "Starter", "Popular", "Best Value"
    store_product_id = db.Column(db.Text)               # v6-IAP: e.g. 'wiamcoins_550'
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)

    @property
    def total_coins(self):
        return self.coins + self.bonus_coins

    @property
    def price_pesewas(self):
        """Paystack expects amount in pesewas (smallest unit)."""
        return int(self.price_ghs * 100)

    @property
    def price_usd(self):
        """USD price as float (e.g. 4.99)."""
        return (self.price_usd_cents or 0) / 100.0

    def __repr__(self):
        return f'<CoinPackage {self.coins} coins = GHS {self.price_ghs}>'


# ---------------------------------------------------------------------------
# CHAPTER UNLOCK + MONETIZATION TABLES (Phase 3)
# ---------------------------------------------------------------------------

class PremiumCreditsLedger(db.Model):
    """Audit log for premium monthly credit grants and spends."""
    __tablename__ = 'w_premium_credits_ledger'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    type = db.Column(db.Text, nullable=False)           # grant | spend | adjust
    amount = db.Column(db.Integer, nullable=False)       # positive for grant, negative for spend
    balance_after = db.Column(db.Integer, nullable=False, default=0)
    reason = db.Column(db.Text, default='')              # e.g. monthly_grant, unlock_chapter:123
    related_chapter_id = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<PremiumCreditsLedger user={self.user_id} {self.type} {self.amount}>'


class ChapterUnlock(db.Model):
    """Records which chapters a user has unlocked (paid for)."""
    __tablename__ = 'w_chapter_unlocks'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    content_id = db.Column(db.Integer, nullable=False)
    chapter_number = db.Column(db.Integer, nullable=False)
    coins_spent = db.Column(db.Integer, nullable=False, default=0)
    creator_id = db.Column(db.BigInteger, nullable=False)
    unlock_method = db.Column(db.Text, default='coins')  # coins | premium_credit | rewarded_ad | free | admin_grant
    transaction_id = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'content_id', 'chapter_number', name='uq_user_chapter_unlock'),
    )

    def __repr__(self):
        return f'<ChapterUnlock user={self.user_id} book={self.content_id} ch={self.chapter_number}>'


class PremiumReferral(db.Model):
    """Tracks premium referrals — referrer gets bonus credits when referee subscribes."""
    __tablename__ = 'w_premium_referrals'

    id = db.Column(db.Integer, primary_key=True)
    referrer_id = db.Column(db.BigInteger, nullable=False, index=True)
    referee_id = db.Column(db.BigInteger, nullable=False, index=True)
    referral_code = db.Column(db.Text, nullable=False, index=True)
    status = db.Column(db.Text, default='pending')   # pending | converted | expired
    bonus_credits = db.Column(db.Integer, default=0)  # credits awarded to referrer
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    converted_at = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.UniqueConstraint('referrer_id', 'referee_id', name='uq_referral_pair'),
    )

    def __repr__(self):
        return f'<PremiumReferral {self.referrer_id}->{self.referee_id} {self.status}>'


class MonetizationStatus(db.Model):
    """Tracks whether a creator is eligible to lock chapters and earn coins."""
    __tablename__ = 'w_monetization_status'

    creator_id = db.Column(db.BigInteger, primary_key=True)
    is_eligible = db.Column(db.Boolean, default=False)
    eligible_since = db.Column(db.DateTime)
    revoked_at = db.Column(db.DateTime)
    revoke_reason = db.Column(db.Text)
    # Cached requirement values (updated by eligibility check)
    cached_account_age_days = db.Column(db.Integer, default=0)
    cached_story_count = db.Column(db.Integer, default=0)
    cached_max_chapters = db.Column(db.Integer, default=0)
    cached_total_readers = db.Column(db.Integer, default=0)
    cached_followers = db.Column(db.Integer, default=0)
    cached_avg_rating = db.Column(db.Float, default=0.0)
    cached_rating_count = db.Column(db.Integer, default=0)
    cached_violations_60d = db.Column(db.Integer, default=0)
    cached_trust_score = db.Column(db.Integer, default=50)
    last_checked = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<MonetizationStatus creator={self.creator_id} eligible={self.is_eligible}>'


class CreatorEarnings(db.Model):
    """Monthly aggregated earnings per creator (coins earned from unlocks + tips)."""
    __tablename__ = 'w_creator_earnings'

    id = db.Column(db.Integer, primary_key=True)
    creator_id = db.Column(db.BigInteger, nullable=False, index=True)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    coins_from_unlocks = db.Column(db.Integer, default=0)
    coins_from_tips = db.Column(db.Integer, default=0)
    total_coins = db.Column(db.Integer, default=0)
    ghs_value = db.Column(db.Float, default=0.0)        # total_coins * COIN_TO_GHS
    creator_share_ghs = db.Column(db.Float, default=0.0) # 50% of ghs_value
    is_paid = db.Column(db.Boolean, default=False)
    rolled_over = db.Column(db.Boolean, default=False)   # below minimum, rolled to next month
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('creator_id', 'year', 'month', name='uq_creator_month_earnings'),
    )

    def __repr__(self):
        return f'<CreatorEarnings creator={self.creator_id} {self.year}-{self.month} {self.total_coins} coins>'


class CreatorPayout(db.Model):
    """Record of each payout sent to a creator."""
    __tablename__ = 'w_creator_payouts'

    id = db.Column(db.Integer, primary_key=True)
    creator_id = db.Column(db.BigInteger, nullable=False, index=True)
    amount_ghs = db.Column(db.Float, nullable=False)
    total_coins = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    provider = db.Column(db.Text, default='')              # MTN | Vodafone | AirtelTigo
    status = db.Column(db.Text, default='pending')       # pending | processing | sent | failed
    paystack_transfer_code = db.Column(db.Text)
    paystack_reference = db.Column(db.Text)
    failure_reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)

    def __repr__(self):
        return f'<CreatorPayout creator={self.creator_id} GHS {self.amount_ghs} {self.status}>'


class CreatorPayoutSettings(db.Model):
    """Creator's payout preferences (Mobile Money details)."""
    __tablename__ = 'w_creator_payout_settings'

    creator_id = db.Column(db.BigInteger, primary_key=True)
    provider = db.Column(db.Text, default='MTN')          # MTN | Vodafone | AirtelTigo
    account_number = db.Column(db.Text, default='')       # Mobile Money number
    account_name = db.Column(db.Text, default='')         # Name on account
    paystack_recipient_code = db.Column(db.Text)           # cached Paystack transfer recipient
    is_verified = db.Column(db.Boolean, default=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<CreatorPayoutSettings creator={self.creator_id} {self.provider}>'


class CreatorWithdrawal(db.Model):
    """Self-service withdrawal requests from creators."""
    __tablename__ = 'w_creator_withdrawals'

    id = db.Column(db.Integer, primary_key=True)
    creator_id = db.Column(db.BigInteger, nullable=False, index=True)
    amount_ghs = db.Column(db.Float, nullable=False)
    provider = db.Column(db.Text, default='MTN')          # MTN | Vodafone | AirtelTigo
    account_number = db.Column(db.Text, default='')
    account_name = db.Column(db.Text, default='')
    status = db.Column(db.Text, default='pending')         # pending | processing | sent | failed | cancelled
    paystack_reference = db.Column(db.Text)
    paystack_transfer_code = db.Column(db.Text)
    failure_reason = db.Column(db.Text)
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    processed_at = db.Column(db.DateTime)

    def __repr__(self):
        return f'<CreatorWithdrawal creator={self.creator_id} GHS {self.amount_ghs} {self.status}>'


# ---------------------------------------------------------------------------
# CREATOR SUBSCRIPTIONS (readers subscribe to creators for perks)
# ---------------------------------------------------------------------------

class CreatorSubTier(db.Model):
    """Subscription tiers offered by a creator."""
    __tablename__ = 'w_creator_sub_tiers'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    creator_id = db.Column(db.BigInteger, nullable=False, index=True)
    name = db.Column(db.Text, nullable=False, default='Supporter')
    description = db.Column(db.Text, default='')
    price_ghs = db.Column(db.Float, nullable=False, default=5.0)
    billing_period = db.Column(db.Text, default='monthly')  # monthly | yearly
    yearly_price_ghs = db.Column(db.Float, nullable=True)   # yearly price (if offered)
    # Perk flags
    perk_subscriber_posts = db.Column(db.Boolean, default=True)     # subscriber-only bulletin posts
    perk_early_access_hours = db.Column(db.Integer, default=0)      # hours before public release
    perk_badge = db.Column(db.Boolean, default=True)                # subscriber badge on comments
    perk_author_notes = db.Column(db.Boolean, default=False)        # behind-the-scenes notes
    perk_no_ads = db.Column(db.Boolean, default=True)               # no ads on creator's content
    perk_priority_comments = db.Column(db.Boolean, default=False)   # pinned comments
    # Status
    is_active = db.Column(db.Boolean, default=True)
    paused_reason = db.Column(db.Text, nullable=True)  # creator_premium_expired | manual
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<CreatorSubTier {self.id} creator={self.creator_id} "{self.name}" GHS{self.price_ghs}>'


class CreatorSubscription(db.Model):
    """A reader's active subscription to a creator."""
    __tablename__ = 'w_creator_subscriptions'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    subscriber_id = db.Column(db.BigInteger, nullable=False, index=True)  # reader user.id
    creator_id = db.Column(db.BigInteger, nullable=False, index=True)     # creator user.id
    tier_id = db.Column(db.Integer, db.ForeignKey('w_creator_sub_tiers.id'), nullable=False)
    status = db.Column(db.String(20), default='active')  # active | paused | cancelled | expired
    paused_reason = db.Column(db.Text, nullable=True)     # subscriber_premium_expired | creator_premium_expired
    auto_renew = db.Column(db.Boolean, default=True)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)
    cancelled_at = db.Column(db.DateTime, nullable=True)
    paystack_sub_code = db.Column(db.String(100), nullable=True)
    paystack_reference = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    tier = db.relationship('CreatorSubTier', backref='subscriptions', lazy='joined')

    @property
    def is_valid(self):
        if self.status not in ('active',):
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True

    def __repr__(self):
        return f'<CreatorSubscription {self.id} sub={self.subscriber_id}->creator={self.creator_id} {self.status}>'


class CreatorSubEarning(db.Model):
    """Monthly earnings from creator subscriptions."""
    __tablename__ = 'w_creator_sub_earnings'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    creator_id = db.Column(db.BigInteger, nullable=False, index=True)
    subscriber_id = db.Column(db.BigInteger, nullable=False)
    subscription_id = db.Column(db.Integer, db.ForeignKey('w_creator_subscriptions.id'), nullable=False)
    amount_ghs = db.Column(db.Float, nullable=False)
    creator_share_ghs = db.Column(db.Float, nullable=False)      # 70%
    platform_share_ghs = db.Column(db.Float, nullable=False)     # 30%
    period_start = db.Column(db.DateTime, nullable=False)
    period_end = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.Text, default='pending')  # pending | cleared | paid
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<CreatorSubEarning {self.id} creator={self.creator_id} GHS{self.amount_ghs} {self.status}>'


# ---------------------------------------------------------------------------
# READING LISTS (user-curated collections of books)
# ---------------------------------------------------------------------------

class ReadingList(db.Model):
    """A user-curated reading list / shelf."""
    __tablename__ = 'w_reading_lists'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    name = db.Column(db.Text, nullable=False, default='My List')
    description = db.Column(db.Text, default='')
    is_public = db.Column(db.Boolean, default=True)
    cover_book_id = db.Column(db.Integer, nullable=True)  # first book used as cover
    item_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = db.relationship('ReadingListItem', backref='reading_list', lazy='dynamic',
                            cascade='all, delete-orphan')

    def __repr__(self):
        return f'<ReadingList {self.id} user={self.user_id} "{self.name}" ({self.item_count} items)>'


class ReadingListItem(db.Model):
    """A book in a reading list."""
    __tablename__ = 'w_reading_list_items'
    __table_args__ = (
        db.UniqueConstraint('list_id', 'content_id', name='uq_reading_list_item'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey('w_reading_lists.id', ondelete='CASCADE'), nullable=False, index=True)
    content_id = db.Column(db.Integer, nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    note = db.Column(db.Text, default='')  # optional personal note
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<ReadingListItem list={self.list_id} content={self.content_id}>'


class RevenueRule(db.Model):
    """Configurable revenue split rules per tier."""
    __tablename__ = 'w_revenue_rules'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    rule_type = db.Column(db.Text, nullable=False)  # DEFAULT, ELITE, APEX, SPECIAL_CREATOR, SPECIAL_BOOK
    target_id = db.Column(db.BigInteger, nullable=True)  # creator_id or book_id for SPECIAL_ types
    creator_share_pct = db.Column(db.Float, nullable=False, default=50.0)
    platform_share_pct = db.Column(db.Float, nullable=False, default=50.0)
    effective_from = db.Column(db.DateTime, default=datetime.utcnow)
    effective_to = db.Column(db.DateTime, nullable=True)
    created_by = db.Column(db.BigInteger, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Hierarchy: SPECIAL_BOOK > SPECIAL_CREATOR > APEX > ELITE > DEFAULT
    RULE_PRIORITY = {
        'SPECIAL_BOOK': 5,
        'SPECIAL_CREATOR': 4,
        'APEX': 3,
        'ELITE': 2,
        'DEFAULT': 1,
    }

    @staticmethod
    def get_creator_share(creator_id, book_id=None, is_elite=False, is_apex=False):
        """Get the effective creator share percentage for a given context."""
        now = datetime.utcnow()
        # Check SPECIAL_BOOK first
        if book_id:
            rule = RevenueRule.query.filter(
                RevenueRule.rule_type == 'SPECIAL_BOOK',
                RevenueRule.target_id == book_id,
                RevenueRule.effective_from <= now,
                db.or_(RevenueRule.effective_to == None, RevenueRule.effective_to >= now),
            ).first()
            if rule:
                return rule.creator_share_pct
        # SPECIAL_CREATOR
        rule = RevenueRule.query.filter(
            RevenueRule.rule_type == 'SPECIAL_CREATOR',
            RevenueRule.target_id == creator_id,
            RevenueRule.effective_from <= now,
            db.or_(RevenueRule.effective_to == None, RevenueRule.effective_to >= now),
        ).first()
        if rule:
            return rule.creator_share_pct
        # APEX
        if is_apex:
            rule = RevenueRule.query.filter(
                RevenueRule.rule_type == 'APEX',
                RevenueRule.effective_from <= now,
                db.or_(RevenueRule.effective_to == None, RevenueRule.effective_to >= now),
            ).first()
            if rule:
                return rule.creator_share_pct
        # ELITE
        if is_elite:
            rule = RevenueRule.query.filter(
                RevenueRule.rule_type == 'ELITE',
                RevenueRule.effective_from <= now,
                db.or_(RevenueRule.effective_to == None, RevenueRule.effective_to >= now),
            ).first()
            if rule:
                return rule.creator_share_pct
        # DEFAULT
        rule = RevenueRule.query.filter(
            RevenueRule.rule_type == 'DEFAULT',
            RevenueRule.effective_from <= now,
            db.or_(RevenueRule.effective_to == None, RevenueRule.effective_to >= now),
        ).first()
        if rule:
            return rule.creator_share_pct
        return 50.0  # hardcoded fallback

    def __repr__(self):
        return f'<RevenueRule {self.rule_type} creator={self.creator_share_pct}%>'


# ---------------------------------------------------------------------------
# MONEY ECOSYSTEM v5 — Double-Entry Ledger + System Wallets
# ---------------------------------------------------------------------------

class LedgerEntry(db.Model):
    """Double-entry ledger — every financial event has a debit and credit row."""
    __tablename__ = 'w_ledger_entries'

    id = db.Column(db.Integer, primary_key=True)
    tx_group = db.Column(db.Text, nullable=False, index=True)  # UUID linking debit+credit pair
    account_type = db.Column(db.Text, nullable=False)           # user | creator | platform_revenue | platform_cash | platform_loss
    account_id = db.Column(db.BigInteger, nullable=False, index=True)  # user_id or 0 for system accounts
    entry_type = db.Column(db.Text, nullable=False)             # debit | credit
    amount = db.Column(db.Integer, nullable=False)              # always positive
    currency = db.Column(db.Text, default='coins')              # coins | GHS
    balance_after = db.Column(db.Integer, nullable=False)       # running balance for this account
    description = db.Column(db.Text, default='')
    reference = db.Column(db.Text, index=True)                  # Paystack ref, chapter unlock id, etc.
    event_type = db.Column(db.Text, nullable=False)             # purchase | unlock | tip | refund | payout | adjustment | cash_in
    metadata_json = db.Column(db.Text, default='{}')            # extra context as JSON
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.BigInteger)                       # who initiated (user_id or founder_id)

    def __repr__(self):
        return f'<Ledger {self.id} {self.entry_type} {self.amount} {self.account_type}:{self.account_id}>'


class SystemWallet(db.Model):
    """System-level wallet balances — tracks platform revenue, cash, and losses."""
    __tablename__ = 'w_system_wallets'

    account_type = db.Column(db.Text, primary_key=True)  # platform_revenue | platform_cash | platform_loss
    balance_coins = db.Column(db.Integer, default=0)
    balance_ghs = db.Column(db.Float, default=0.0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<SystemWallet {self.account_type} coins={self.balance_coins} GHS={self.balance_ghs}>'


class RefundRequest(db.Model):
    """Tracks refund/dispute requests with fraud protection."""
    __tablename__ = 'w_refund_requests'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    original_tx_id = db.Column(db.Integer, nullable=False)      # CoinTransaction.id being refunded
    amount_coins = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.Text, default='')
    status = db.Column(db.Text, default='pending')              # pending | approved | rejected | auto_approved
    resolution_note = db.Column(db.Text, default='')
    resolved_by = db.Column(db.BigInteger)                      # founder/admin who resolved
    creator_deducted = db.Column(db.Integer, default=0)         # coins deducted from creator earnings
    platform_absorbed = db.Column(db.Integer, default=0)        # coins absorbed by platform_loss
    ledger_tx_group = db.Column(db.Text)                        # linked ledger entries
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)

    def __repr__(self):
        return f'<Refund {self.id} user={self.user_id} {self.amount_coins} coins {self.status}>'


class FraudAlert(db.Model):
    """Fraud detection alerts — rate limit violations, suspicious patterns."""
    __tablename__ = 'w_fraud_alerts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    alert_type = db.Column(db.Text, nullable=False)             # rate_limit | rapid_spend | cash_mismatch | suspicious_pattern
    severity = db.Column(db.Text, default='low')                # low | medium | high | critical
    description = db.Column(db.Text, default='')
    metadata_json = db.Column(db.Text, default='{}')
    is_resolved = db.Column(db.Boolean, default=False)
    resolved_by = db.Column(db.BigInteger)
    resolved_note = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)

    def __repr__(self):
        return f'<FraudAlert {self.id} user={self.user_id} {self.alert_type} {self.severity}>'


class Report(db.Model):
    """User-submitted reports for content, users, comments, or payments."""
    __tablename__ = 'w_reports'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    reporter_user_id = db.Column(db.BigInteger, nullable=False, index=True)
    target_type = db.Column(db.Text, nullable=False)   # BOOK, CHAPTER, COMMENT, USER, PAYMENT
    target_id = db.Column(db.BigInteger, nullable=False)
    category = db.Column(db.Text, default='other')      # spam, harassment, hate, plagiarism, nsfw, other
    description = db.Column(db.Text, default='')
    status = db.Column(db.Text, default='OPEN')          # OPEN, IN_REVIEW, RESOLVED, DISMISSED
    assigned_to = db.Column(db.BigInteger, nullable=True)
    resolution_notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f'<Report #{self.id} {self.target_type}:{self.target_id} {self.status}>'


class TeamCompPlan(db.Model):
    """Internal team compensation plan tracking per role."""
    __tablename__ = 'w_team_comp_plans'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    role_name = db.Column(db.Text, nullable=False)
    plan_type = db.Column(db.Text, default='MONTHLY')  # MONTHLY, PER_TASK, COMMISSION, HYBRID
    base_amount = db.Column(db.Float, default=0.0)
    currency = db.Column(db.Text, default='GHS')
    commission_pct = db.Column(db.Float, default=0.0)
    notes = db.Column(db.Text, default='')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<TeamCompPlan {self.role_name} {self.plan_type} {self.base_amount} {self.currency}>'


# ---------------------------------------------------------------------------
# AUTOMATED MODERATION TABLES (Phase 4)
# ---------------------------------------------------------------------------

class BannedWord(db.Model):
    """Banned words and phrases for automated content scanning."""
    __tablename__ = 'w_banned_words'

    id = db.Column(db.Integer, primary_key=True)
    word = db.Column(db.Text, nullable=False, unique=True)
    category = db.Column(db.Text, default='general')   # general | sexual | hate | spam | violence
    severity = db.Column(db.Integer, default=1)         # 1=low 2=medium 3=high (auto-reject)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<BannedWord "{self.word}" cat={self.category} sev={self.severity}>'


class ContentReport(db.Model):
    """User reports on stories or chapters."""
    __tablename__ = 'w_content_reports'

    id = db.Column(db.Integer, primary_key=True)
    reporter_id = db.Column(db.BigInteger, nullable=False, index=True)
    content_id = db.Column(db.Integer, nullable=False, index=True)
    chapter_number = db.Column(db.Integer)               # null = report on whole story
    reason = db.Column(db.Text, nullable=False)           # inappropriate | plagiarism | spam | hate | other
    details = db.Column(db.Text, default='')
    status = db.Column(db.Text, default='pending')        # pending | reviewed | dismissed | actioned
    reviewed_by = db.Column(db.BigInteger)
    reviewed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('reporter_id', 'content_id', 'chapter_number', name='uq_user_report'),
    )

    def __repr__(self):
        return f'<ContentReport #{self.id} story={self.content_id} reason={self.reason}>'


class ContentFlag(db.Model):
    """Tracks flagged/hidden content status (auto-escalation from reports or scanning)."""
    __tablename__ = 'w_content_flags'

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, nullable=False, index=True)
    chapter_number = db.Column(db.Integer)                # null = whole story flagged
    flag_type = db.Column(db.Text, default='report')      # report | scan | manual
    status = db.Column(db.Text, default='flagged')         # flagged | hidden | cleared | restored
    report_count = db.Column(db.Integer, default=0)
    scan_matches = db.Column(db.Text, default='')          # comma-separated matched banned words
    scan_severity = db.Column(db.Integer, default=0)       # highest severity from scan
    actioned_by = db.Column(db.BigInteger)                 # founder/admin who reviewed
    action_note = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('content_id', 'chapter_number', name='uq_content_flag'),
    )

    def __repr__(self):
        return f'<ContentFlag story={self.content_id} ch={self.chapter_number} status={self.status}>'


class ModerationLog(db.Model):
    """Audit log of all moderation actions."""
    __tablename__ = 'w_moderation_log'

    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.BigInteger, nullable=False)    # who performed the action (0=system)
    action = db.Column(db.Text, nullable=False)             # flag | hide | restore | clear | warn | ban
    target_type = db.Column(db.Text, nullable=False)        # story | chapter | user
    target_id = db.Column(db.Integer, nullable=False)       # content_id or user wiam_id
    chapter_number = db.Column(db.Integer)
    reason = db.Column(db.Text, default='')
    details = db.Column(db.Text, default='')                # JSON or text with extra info
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<ModerationLog #{self.id} {self.action} {self.target_type}={self.target_id}>'


class EliteStory(db.Model):
    """Tracks stories that have achieved WiamElite status — ultra-hard V2."""
    __tablename__ = 'w_elite_stories'

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, nullable=False, unique=True, index=True)
    promoted_at = db.Column(db.DateTime, default=datetime.utcnow)
    demoted_at = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    # Cached metrics
    total_reads = db.Column(db.Integer, default=0)
    unique_readers = db.Column(db.Integer, default=0)
    avg_rating = db.Column(db.Float, default=0.0)
    total_ratings = db.Column(db.Integer, default=0)
    completion_rate = db.Column(db.Float, default=0.0)
    active_readers_30d = db.Column(db.Integer, default=0)
    chapter_count = db.Column(db.Integer, default=0)
    total_votes = db.Column(db.Integer, default=0)
    # V2 metrics
    total_words = db.Column(db.Integer, default=0)
    total_shares = db.Column(db.Integer, default=0)
    paid_reads = db.Column(db.Integer, default=0)
    paid_read_ratio = db.Column(db.Float, default=0.0)
    reader_return_rate = db.Column(db.Float, default=0.0)
    creator_followers = db.Column(db.Integer, default=0)
    # Sustained qualification tracking
    consecutive_months_qualified = db.Column(db.Integer, default=0)
    first_qualified_at = db.Column(db.DateTime)
    # Elite benefits
    coin_multiplier = db.Column(db.Float, default=3.0)
    creator_revenue_pct = db.Column(db.Float, default=0.60)
    # Verified badge for creator
    verified_badge_expires = db.Column(db.DateTime)
    # Streak tracking
    elite_streak_days = db.Column(db.Integer, default=0)
    last_checked = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def story(self):
        return Content.query.get(self.content_id)

    @property
    def elite_months(self):
        if self.promoted_at and self.is_active:
            return max(0, (datetime.utcnow() - self.promoted_at).days // 30)
        return 0

    def __repr__(self):
        return f'<EliteStory content={self.content_id} active={self.is_active}>'


class EliteSubscription(db.Model):
    """Reader subscription for WiamElite content access."""
    __tablename__ = 'w_elite_subscriptions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    plan = db.Column(db.String(20), default='monthly')  # monthly
    amount_ghs = db.Column(db.Float, default=25.0)
    amount_usd_cents = db.Column(db.Integer, default=0)      # v6-IAP: USD price in cents
    status = db.Column(db.String(20), default='active')  # active, cancelled, expired
    store = db.Column(db.String(20))                         # v6-IAP: 'apple' | 'google' | 'paystack'
    store_product_id = db.Column(db.String(100))             # v6-IAP: e.g. 'wiamelite_monthly'
    store_transaction_id = db.Column(db.String(200))         # v6-IAP: original transaction ID
    rc_subscriber_id = db.Column(db.String(200))             # v6-IAP: RevenueCat app_user_id
    paystack_sub_code = db.Column(db.String(100))
    paystack_email_token = db.Column(db.String(100))
    paystack_reference = db.Column(db.String(100))   # initial payment reference
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)
    cancelled_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def is_valid(self):
        """Active OR within 3-day grace period after expiry."""
        if self.status not in ('active', 'cancelled'):
            return False
        if self.expires_at:
            grace = self.expires_at + timedelta(days=3)
            if datetime.utcnow() > grace:
                return False
        return True

    def __repr__(self):
        return f'<EliteSubscription user={self.user_id} status={self.status}>'


class EliteReadLog(db.Model):
    """Tracks chapter reads for Elite books — used for revenue distribution."""
    __tablename__ = 'w_elite_read_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    content_id = db.Column(db.Integer, nullable=False, index=True)
    chapter_number = db.Column(db.Integer, nullable=False)
    source = db.Column(db.String(20), default='subscription')  # subscription, coin_unlock
    coins_spent = db.Column(db.Integer, default=0)
    read_at = db.Column(db.DateTime, default=datetime.utcnow)
    read_duration_sec = db.Column(db.Integer, default=0)

    def __repr__(self):
        return f'<EliteReadLog user={self.user_id} book={self.content_id} ch={self.chapter_number}>'


# ---------------------------------------------------------------------------
# WIAM PREMIUM SUBSCRIPTION (Phase 4 — Reader subscription)
# ---------------------------------------------------------------------------

class PremiumSubscription(db.Model):
    """Reader subscription for WiamPremium benefits."""
    __tablename__ = 'w_premium_subscriptions'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    plan = db.Column(db.String(20), default='monthly')
    amount_ghs = db.Column(db.Float, default=20.0)
    amount_usd_cents = db.Column(db.Integer, default=0)      # v6-IAP: USD price in cents
    status = db.Column(db.String(20), default='active')  # active, cancelled, expired
    store = db.Column(db.String(20))                         # v6-IAP: 'apple' | 'google' | 'paystack'
    store_product_id = db.Column(db.String(100))             # v6-IAP: e.g. 'wiampremium_plus'
    store_transaction_id = db.Column(db.String(200))         # v6-IAP: original transaction ID
    store_receipt = db.Column(db.Text)                       # v6-IAP: store receipt data (backup)
    rc_subscriber_id = db.Column(db.String(200))             # v6-IAP: RevenueCat app_user_id
    paystack_sub_code = db.Column(db.String(100))
    paystack_email_token = db.Column(db.String(100))
    paystack_reference = db.Column(db.String(100))
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)
    cancelled_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def is_valid(self):
        if self.status not in ('active', 'cancelled'):
            return False
        if self.expires_at:
            grace = self.expires_at + timedelta(days=3)
            if datetime.utcnow() > grace:
                return False
        return True

    def __repr__(self):
        return f'<PremiumSubscription user={self.user_id} status={self.status}>'


# ---------------------------------------------------------------------------
# TEAM PAYROLL (Automatic worker payments via Paystack)
# ---------------------------------------------------------------------------

class TeamPayroll(db.Model):
    """Monthly payroll record for WiamApp team members."""
    __tablename__ = 'w_team_payroll'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    role_name = db.Column(db.Text, nullable=False)
    amount_ghs = db.Column(db.Float, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Text, default='pending')  # pending | processing | sent | failed | skipped
    provider = db.Column(db.Text, default='MTN')
    account_number = db.Column(db.Text, default='')
    account_name = db.Column(db.Text, default='')
    paystack_transfer_code = db.Column(db.Text)
    paystack_reference = db.Column(db.Text)
    failure_reason = db.Column(db.Text)
    approved_by = db.Column(db.BigInteger)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)

    def __repr__(self):
        return f'<TeamPayroll user={self.user_id} {self.role_name} GHS {self.amount_ghs} {self.status}>'


class TeamPayrollSettings(db.Model):
    """Payment settings for each team member (MoMo details)."""
    __tablename__ = 'w_team_payroll_settings'
    __table_args__ = {'extend_existing': True}

    user_id = db.Column(db.BigInteger, primary_key=True)
    role_name = db.Column(db.Text, nullable=False)
    monthly_salary_ghs = db.Column(db.Float, default=0.0)
    provider = db.Column(db.Text, default='MTN')
    account_number = db.Column(db.Text, default='')
    account_name = db.Column(db.Text, default='')
    paystack_recipient_code = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)  # founder can toggle off
    is_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<TeamPayrollSettings user={self.user_id} {self.role_name} GHS {self.monthly_salary_ghs}>'


# ---------------------------------------------------------------------------
# P7 PROGRAMS — Reader & Creator engagement
# ---------------------------------------------------------------------------

class StoryChallenge(db.Model):
    """Weekly/monthly writing challenges for creators."""
    __tablename__ = 'w_story_challenges'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, default='')
    challenge_type = db.Column(db.Text, default='weekly')  # weekly | monthly | special
    theme = db.Column(db.Text, default='')
    genre = db.Column(db.Text, default='')
    min_words = db.Column(db.Integer, default=1000)
    min_chapters = db.Column(db.Integer, default=1)
    coin_reward = db.Column(db.Integer, default=50)
    badge_name = db.Column(db.Text, default='')
    starts_at = db.Column(db.DateTime, nullable=False)
    ends_at = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.BigInteger)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<StoryChallenge {self.title} {self.challenge_type}>'


class ChallengeEntry(db.Model):
    """Creator entry into a story challenge."""
    __tablename__ = 'w_challenge_entries'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    challenge_id = db.Column(db.Integer, nullable=False, index=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    content_id = db.Column(db.Integer)  # FK to Content (story submitted)
    status = db.Column(db.Text, default='joined')  # joined | submitted | completed | winner
    word_count = db.Column(db.Integer, default=0)
    submitted_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<ChallengeEntry challenge={self.challenge_id} user={self.user_id}>'


class GiftSubscription(db.Model):
    """Gift a premium subscription to another user."""
    __tablename__ = 'w_gift_subscriptions'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.BigInteger, nullable=False, index=True)
    recipient_id = db.Column(db.BigInteger, nullable=False, index=True)
    plan = db.Column(db.Text, default='premium')  # premium | elite
    duration_months = db.Column(db.Integer, default=1)
    amount_ghs = db.Column(db.Float, default=20.0)
    status = db.Column(db.Text, default='pending')  # pending | paid | active | expired
    paystack_reference = db.Column(db.Text)
    message = db.Column(db.Text, default='')
    activated_at = db.Column(db.DateTime)
    expires_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<GiftSubscription sender={self.sender_id} → recipient={self.recipient_id}>'


class CreatorMilestone(db.Model):
    """Achievement badges earned by creators."""
    __tablename__ = 'w_creator_milestones'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    milestone_key = db.Column(db.Text, nullable=False)
    milestone_name = db.Column(db.Text, nullable=False)
    milestone_icon = db.Column(db.Text, default='bi-trophy')
    milestone_color = db.Column(db.Text, default='#d4a843')
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<CreatorMilestone user={self.user_id} {self.milestone_key}>'


class ReaderBadge(db.Model):
    """Achievement badges earned by readers for reading milestones."""
    __tablename__ = 'w_reader_badges'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'badge_key', name='uq_reader_badge'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    badge_key = db.Column(db.Text, nullable=False)
    badge_name = db.Column(db.Text, nullable=False)
    badge_icon = db.Column(db.Text, default='star')
    badge_color = db.Column(db.Text, default='#d4a843')
    badge_description = db.Column(db.Text, default='')
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<ReaderBadge user={self.user_id} {self.badge_key}>'


class Referral(db.Model):
    """Referral tracking for WiamAmbassador program."""
    __tablename__ = 'w_referrals'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    referrer_id = db.Column(db.BigInteger, nullable=False, index=True)
    referred_id = db.Column(db.BigInteger, nullable=False, index=True)
    referral_code = db.Column(db.Text, nullable=False)
    status = db.Column(db.Text, default='signed_up')  # signed_up | active_reader | premium_convert
    coins_earned = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Referral {self.referrer_id} → {self.referred_id}>'


# ---------------------------------------------------------------------------
# WIAM BULLETIN (Creator → Follower announcement channel)
# ---------------------------------------------------------------------------

class BulletinPost(db.Model):
    """A post in a creator's Bulletin feed. Only creators can post."""
    __tablename__ = 'w_bulletin_posts'

    id = db.Column(db.Integer, primary_key=True)
    creator_id = db.Column(db.BigInteger, nullable=False, index=True)
    type = db.Column(db.String(20), default='text')  # text | book_share
    text_content = db.Column(db.Text, default='')
    content_id = db.Column(db.Integer, nullable=True)  # FK to content (book_share only)
    is_pinned = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def creator(self):
        return User.query.filter_by(wiam_id=self.creator_id).first()

    @property
    def creator_profile(self):
        return CreatorProfile.query.get(self.creator_id)

    @property
    def book(self):
        if self.content_id:
            return Content.query.get(self.content_id)
        return None

    @property
    def shared_book(self):
        return self.book

    @property
    def reactions_summary(self):
        """Return dict of {emoji: count} for this post."""
        rows = db.session.query(
            BulletinReaction.emoji,
            db.func.count(BulletinReaction.id)
        ).filter_by(post_id=self.id).group_by(BulletinReaction.emoji).all()
        return {emoji: count for emoji, count in rows}

    @property
    def total_reactions(self):
        return BulletinReaction.query.filter_by(post_id=self.id).count()

    def __repr__(self):
        return f'<BulletinPost id={self.id} creator={self.creator_id} type={self.type}>'


class BulletinFollow(db.Model):
    """Separate follow for Bulletin — reader must explicitly subscribe."""
    __tablename__ = 'w_bulletin_follows'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'creator_id', name='uq_bulletin_follow'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    creator_id = db.Column(db.BigInteger, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<BulletinFollow user={self.user_id} creator={self.creator_id}>'


class BulletinReaction(db.Model):
    """A reader's emoji reaction to a BulletinPost."""
    __tablename__ = 'w_bulletin_reactions'

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, nullable=False, index=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    emoji = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('post_id', 'user_id', 'emoji', name='uq_bulletin_reaction'),
        {'extend_existing': True},
    )

    def __repr__(self):
        return f'<BulletinReaction post={self.post_id} user={self.user_id} emoji={self.emoji}>'


class ApplicationForm(db.Model):
    """Application forms that can be sent to candidates via email."""
    __tablename__ = 'w_application_forms'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    form_type = db.Column(db.Text, nullable=False)  # creator, engineer, admin, editor, moderator, marketing, translator
    title = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, default='')
    fields_json = db.Column(db.Text, default='[]')  # JSON array of field definitions
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)


class ApplicationResponse(db.Model):
    """Submitted application form responses."""
    __tablename__ = 'w_application_responses'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    form_id = db.Column(db.Integer, nullable=False, index=True)
    form_type = db.Column(db.Text, nullable=False)
    applicant_email = db.Column(db.Text, nullable=False)
    applicant_name = db.Column(db.Text, default='')
    answers_json = db.Column(db.Text, default='{}')  # JSON dict of field_name: answer
    status = db.Column(db.Text, default='pending')  # pending, reviewed, accepted, rejected
    reviewer_notes = db.Column(db.Text, default='')
    token = db.Column(db.Text, nullable=False, unique=True, index=True)  # unique link token
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    submitted_at = db.Column(db.DateTime, nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    email_verified = db.Column(db.Boolean, default=False)  # must verify email before submission counts

    @property
    def is_submitted(self):
        return self.submitted_at is not None


class TeamIdHistory(db.Model):
    """Audit trail for every WIAMid ever issued to a team member."""
    __tablename__ = 'w_team_id_history'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    wiam_id_hash = db.Column(db.Text, nullable=False)
    issued_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expired_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)


class Feedback(db.Model):
    """User feedback submissions."""
    __tablename__ = 'w_feedback'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    user_name = db.Column(db.Text, default='')
    user_email = db.Column(db.Text, default='')
    category = db.Column(db.Text, default='general')
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.Text, default='new')  # new, read, resolved
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reply = db.Column(db.Text, nullable=True)
    replied_by = db.Column(db.BigInteger, nullable=True)
    replied_at = db.Column(db.DateTime, nullable=True)


class UserWarning(db.Model):
    """Formal warnings issued to creators or team members."""
    __tablename__ = 'w_user_warnings'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    target_role = db.Column(db.Text, nullable=False, default='creator')  # creator | team
    category = db.Column(db.Text, nullable=False, default='general')
    message = db.Column(db.Text, nullable=False)
    severity = db.Column(db.Text, default='warning')  # notice | warning | strike
    issued_by = db.Column(db.BigInteger, nullable=False)
    acknowledged = db.Column(db.Boolean, default=False)
    acknowledged_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class UserGenrePreference(db.Model):
    """User's preferred genres (selected during onboarding)."""
    __tablename__ = 'w_user_genre_prefs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    genre_id = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'genre_id', name='uq_user_genre_pref'),
        {'extend_existing': True},
    )


class ImageStore(db.Model):
    """Persistent image storage in PostgreSQL."""
    __tablename__ = 'w_images'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.LargeBinary, nullable=False)
    content_type = db.Column(db.Text, nullable=False, default='image/jpeg')
    filename = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# WIAMBOT — Unmatched Message Logging
# (Old DB intent system removed — hardcoded knowledge base used instead)
# ---------------------------------------------------------------------------

class BotUnmatchedMessage(db.Model):
    """Messages that couldn't be matched — sent to training queue."""
    __tablename__ = 'w_bot_unmatched'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_message = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.BigInteger, nullable=True)
    assigned_intent_id = db.Column(db.Integer, nullable=True)
    resolved = db.Column(db.Boolean, default=False)
    resolved_by = db.Column(db.BigInteger, nullable=True)
    resolved_intent = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# WIAMBOT V2 — Wiam Apex Contract Gatekeeper
# ---------------------------------------------------------------------------

class ApexSubmission(db.Model):
    """Wiam Apex contract submission with scoring."""
    __tablename__ = 'w_apex_submissions'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    pen_name = db.Column(db.Text, default='')
    email = db.Column(db.Text, default='')
    country = db.Column(db.Text, default='')
    title = db.Column(db.Text, nullable=False)
    genre = db.Column(db.Text, default='')
    logline = db.Column(db.Text, default='')
    synopsis = db.Column(db.Text, default='')
    chapter_1 = db.Column(db.Text, default='')
    chapter_2 = db.Column(db.Text, default='')
    outline = db.Column(db.Text, default='')
    posting_commitment = db.Column(db.Text, default='')
    originality_declaration = db.Column(db.Boolean, default=False)
    # Scoring
    total_score = db.Column(db.Integer, default=0)
    score_breakdown = db.Column(db.Text, default='{}')
    flags = db.Column(db.Text, default='[]')
    strengths = db.Column(db.Text, default='[]')
    weaknesses = db.Column(db.Text, default='[]')
    max_similarity = db.Column(db.Float, default=0.0)
    # Status: draft, submitted, rejected, pending_review, revision_requested, signed
    status = db.Column(db.Text, default='draft')
    admin_notes = db.Column(db.Text, default='')
    reviewed_by = db.Column(db.BigInteger, nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# EDITOR STUDIO — Editorial Review System
# ---------------------------------------------------------------------------

class EditorialNote(db.Model):
    """Internal notes editors leave on stories or chapters."""
    __tablename__ = 'w_editorial_notes'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    editor_user_id = db.Column(db.BigInteger, nullable=False, index=True)
    content_id = db.Column(db.Integer, nullable=False, index=True)
    chapter_number = db.Column(db.Integer, nullable=True)  # NULL = book-level note
    note_text = db.Column(db.Text, nullable=False)
    note_type = db.Column(db.Text, default='feedback')  # feedback | internal | revision_request
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def editor(self):
        return User.query.filter_by(wiam_id=self.editor_user_id).first()

    def __repr__(self):
        return f'<EditorialNote #{self.id} book={self.content_id} by={self.editor_user_id}>'


class ReviewQueue(db.Model):
    """Tracks stories submitted for editorial review."""
    __tablename__ = 'w_review_queue'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, nullable=False, index=True)
    creator_id = db.Column(db.BigInteger, nullable=False)
    submission_type = db.Column(db.Text, default='publish')  # publish | monetization | elite | apex
    status = db.Column(db.Text, default='pending')  # pending | in_review | approved | rejected | revision_requested
    assigned_to = db.Column(db.BigInteger, nullable=True)  # editor user wiam_id
    bot_score = db.Column(db.Integer, nullable=True)
    bot_feedback_json = db.Column(db.Text, nullable=True)
    editor_score = db.Column(db.Integer, nullable=True)
    editor_feedback = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    reviewed_by = db.Column(db.BigInteger, nullable=True)

    @property
    def story(self):
        return Content.query.get(self.content_id)

    @property
    def creator(self):
        return User.query.filter_by(wiam_id=self.creator_id).first()

    @property
    def assigned_editor(self):
        if self.assigned_to:
            return User.query.filter_by(wiam_id=self.assigned_to).first()
        return None

    def __repr__(self):
        return f'<ReviewQueue #{self.id} book={self.content_id} status={self.status}>'


class AuditLog(db.Model):
    """Audit trail for all team/editorial actions."""
    __tablename__ = 'w_audit_log'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    actor_user_id = db.Column(db.BigInteger, nullable=False, index=True)
    action = db.Column(db.Text, nullable=False)  # e.g. STORY_APPROVED, STORY_REJECTED, NOTE_ADDED
    target_type = db.Column(db.Text, nullable=False)  # BOOK, CHAPTER, USER
    target_id = db.Column(db.Integer, nullable=True)
    details_json = db.Column(db.Text, default='{}')
    ip_address = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def actor(self):
        return User.query.filter_by(wiam_id=self.actor_user_id).first()

    def __repr__(self):
        return f'<AuditLog #{self.id} {self.action} by={self.actor_user_id}>'


# ---------------------------------------------------------------------------
# RBAC — Role-Based Access Control
# ---------------------------------------------------------------------------

class Role(db.Model):
    """Named roles that can be assigned to users (e.g. editor, moderator)."""
    __tablename__ = 'w_roles'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, unique=True, nullable=False)       # e.g. 'editor'
    display_name = db.Column(db.Text, nullable=False)             # e.g. 'Editor'
    description = db.Column(db.Text, default='')
    is_system = db.Column(db.Boolean, default=False)              # True = cannot be deleted
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Role {self.name}>'


class Permission(db.Model):
    """Granular permissions (e.g. content.manage, review.approve)."""
    __tablename__ = 'w_permissions'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.Text, unique=True, nullable=False)         # e.g. 'content.manage'
    description = db.Column(db.Text, default='')
    category = db.Column(db.Text, default='general')              # grouping key for UI

    def __repr__(self):
        return f'<Permission {self.key}>'


class RolePermission(db.Model):
    """Many-to-many: which permissions each role has."""
    __tablename__ = 'w_role_permissions'
    __table_args__ = (
        db.UniqueConstraint('role_id', 'permission_id', name='uq_role_perm'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey('w_roles.id', ondelete='CASCADE'), nullable=False, index=True)
    permission_id = db.Column(db.Integer, db.ForeignKey('w_permissions.id', ondelete='CASCADE'), nullable=False, index=True)


class UserRole(db.Model):
    """Many-to-many: which roles each user has."""
    __tablename__ = 'w_user_roles'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'role_id', name='uq_user_role'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    role_id = db.Column(db.Integer, db.ForeignKey('w_roles.id', ondelete='CASCADE'), nullable=False, index=True)
    assigned_by = db.Column(db.BigInteger, nullable=True)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def role(self):
        return Role.query.get(self.role_id)

    @property
    def user(self):
        return User.query.get(self.user_id)

    def __repr__(self):
        return f'<UserRole user={self.user_id} role={self.role_id}>'


# ---------------------------------------------------------------------------
# PLATFORM SETTINGS & FEATURE FLAGS
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# CLASSIC SEED SYSTEM (temporary — removable)
# ---------------------------------------------------------------------------

class ClassicBook(db.Model):
    """Public-domain classic novels fetched from Project Gutenberg via Gutendex API."""
    __tablename__ = 'w_classics_books'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.Text, nullable=False)
    author = db.Column(db.Text, nullable=False, default='Unknown')
    gutenberg_id = db.Column(db.Integer, unique=True, nullable=False)
    description = db.Column(db.Text, default='')
    cover_image = db.Column(db.Text, default='')
    language = db.Column(db.Text, default='en')
    genre = db.Column(db.Text, default='Fiction')
    word_count = db.Column(db.Integer, default=0)
    status = db.Column(db.Text, default='draft')      # draft | published
    source = db.Column(db.Text, default='gutenberg')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    published_at = db.Column(db.DateTime, nullable=True)
    views = db.Column(db.Integer, default=0)
    likes = db.Column(db.Integer, default=0)
    rating = db.Column(db.Float, default=0.0)
    rating_count = db.Column(db.Integer, default=0)
    content_id = db.Column(db.Integer, nullable=True)  # links to mirrored Content record

    chapters = db.relationship('ClassicChapter', backref='book', lazy='dynamic',
                               cascade='all, delete-orphan',
                               order_by='ClassicChapter.chapter_number')

    @property
    def chapter_count(self):
        return ClassicChapter.query.filter_by(book_id=self.id).count()

    @property
    def published_chapter_count(self):
        """Chapters that are released (publish_date <= now)."""
        return ClassicChapter.query.filter(
            ClassicChapter.book_id == self.id,
            ClassicChapter.publish_date <= datetime.utcnow()
        ).count()

    @property
    def cover_url(self):
        if self.cover_image:
            return self.cover_image
        return '/static/img/default_cover.png'

    def __repr__(self):
        return f'<ClassicBook {self.id} {self.title}>'


class ClassicChapter(db.Model):
    """Individual chapter of a classic book."""
    __tablename__ = 'w_classics_chapters'
    __table_args__ = (
        db.UniqueConstraint('book_id', 'chapter_number', name='uq_classic_book_chapter'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('w_classics_books.id', ondelete='CASCADE'), nullable=False, index=True)
    chapter_number = db.Column(db.Integer, nullable=False)
    chapter_title = db.Column(db.Text, default='')
    content = db.Column(db.Text, nullable=False, default='')
    word_count = db.Column(db.Integer, default=0)
    publish_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def is_released(self):
        if self.publish_date is None:
            return False
        return datetime.utcnow() >= self.publish_date

    def __repr__(self):
        return f'<ClassicChapter book={self.book_id} ch={self.chapter_number}>'


class ClassicFetchLog(db.Model):
    """Log of Gutenberg book fetch attempts to prevent duplicates and aid debugging."""
    __tablename__ = 'w_classics_fetch_log'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    gutenberg_id = db.Column(db.Integer, nullable=False, index=True)
    title = db.Column(db.Text, default='')
    fetched_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.Text, default='fetched')   # fetched | skipped | error
    reason_skipped = db.Column(db.Text, default='')

    def __repr__(self):
        return f'<ClassicFetchLog gutenberg={self.gutenberg_id} {self.status}>'


class PlatformSetting(db.Model):
    """Key-value settings for platform configuration."""
    __tablename__ = 'w_platform_settings'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.Text, unique=True, nullable=False)
    value_json = db.Column(db.Text, default='null')
    value_type = db.Column(db.Text, default='string')  # string | int | bool | json
    description = db.Column(db.Text, default='')
    updated_by = db.Column(db.BigInteger, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def value(self):
        import json as _json
        try:
            return _json.loads(self.value_json)
        except Exception:
            return self.value_json

    def set_value(self, val):
        import json as _json
        self.value_json = _json.dumps(val)

    def __repr__(self):
        return f'<PlatformSetting {self.key}={self.value_json}>'


class MagicBox(db.Model):
    """Weekly loot crate earned by completing reading/creator goals."""
    __tablename__ = 'w_magic_boxes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    tier = db.Column(db.Text, default='bronze')          # bronze / silver / gold / diamond
    week_start = db.Column(db.Date, nullable=False)       # Monday of the earning week
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)
    opened_at = db.Column(db.DateTime, nullable=True)     # None = still sealed
    source = db.Column(db.Text, default='reader')         # reader / creator

    # Goals snapshot at earn-time
    goals_met = db.Column(db.Text, default='')            # comma-separated goal keys

    __table_args__ = (
        db.UniqueConstraint('user_id', 'week_start', 'source', name='uq_magic_box_user_week_src'),
        {'extend_existing': True},
    )

    def __repr__(self):
        return f'<MagicBox {self.id} tier={self.tier} user={self.user_id}>'


class MagicBoxReward(db.Model):
    """Individual reward item inside an opened magic box."""
    __tablename__ = 'w_magic_box_rewards'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    box_id = db.Column(db.Integer, db.ForeignKey('w_magic_boxes.id'), nullable=False)
    reward_type = db.Column(db.Text, nullable=False)      # coins / streak_shield / badge / xp_boost
    reward_key = db.Column(db.Text, default='')            # e.g. badge key or boost duration
    reward_label = db.Column(db.Text, default='')          # human-friendly label
    quantity = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<MagicBoxReward {self.id} type={self.reward_type} qty={self.quantity}>'


# ---------------------------------------------------------------------------
# AD IMPRESSIONS — Google AdMob revenue tracking & creator share
# ---------------------------------------------------------------------------

class AdImpression(db.Model):
    """Log each ad impression for revenue tracking and creator revenue share."""
    __tablename__ = 'w_ad_impressions'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=True)          # viewer (nullable for logged-out)
    book_id = db.Column(db.Integer, nullable=True)             # content being viewed (nullable for home/browse)
    creator_id = db.Column(db.BigInteger, nullable=True)       # creator of the book (auto-filled from book)
    ad_type = db.Column(db.Text, nullable=False)               # banner | interstitial | rewarded
    placement = db.Column(db.Text, nullable=False)             # home | browse | book_detail | reader | comments | studio
    attribution = db.Column(db.Text, default='platform_only')  # creator_share | platform_only
    estimated_revenue_usd = db.Column(db.Float, default=0.0)   # estimated CPM-based revenue
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<AdImpression {self.id} {self.ad_type} {self.placement} book={self.book_id}>'


class FeatureFlag(db.Model):
    """Feature flags — enable/disable features platform-wide."""
    __tablename__ = 'w_feature_flags'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.Text, unique=True, nullable=False)
    is_enabled = db.Column(db.Boolean, default=True)
    description = db.Column(db.Text, default='')
    updated_by = db.Column(db.BigInteger, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<FeatureFlag {self.key}={self.is_enabled}>'


# ---------------------------------------------------------------------------
# WIAMVOX — voice stories (separate from book `content`; shared users / wallet)
# ---------------------------------------------------------------------------

class VoiceStory(db.Model):
    """A published or draft voice story (one creator, many moments)."""
    __tablename__ = 'w_voice_stories'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    creator_wiam_id = db.Column(db.BigInteger, nullable=False, index=True)
    title = db.Column(db.Text, nullable=False, default='Untitled')
    description = db.Column(db.Text, default='')
    cover_url = db.Column(db.Text, nullable=True)
    emotion_tag = db.Column(db.Text, default='')
    status = db.Column(db.Text, nullable=False, default='draft')  # draft | published | deleted
    is_locked = db.Column(db.Boolean, default=False)
    unlock_price_coins = db.Column(db.Integer, nullable=True)
    listen_count = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    published_at = db.Column(db.DateTime, nullable=True)

    moments = db.relationship(
        'VoiceMoment', backref='story', lazy='dynamic',
        order_by='VoiceMoment.sort_order',
        cascade='all, delete-orphan',
    )

    def __repr__(self):
        return f'<VoiceStory {self.id} {self.status} creator={self.creator_wiam_id}>'


class VoiceMoment(db.Model):
    """Single audio clip inside a voice story."""
    __tablename__ = 'w_voice_moments'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    story_id = db.Column(db.Integer, db.ForeignKey('w_voice_stories.id', ondelete='CASCADE'), nullable=False, index=True)
    audio_url = db.Column(db.Text, nullable=False)
    duration_seconds = db.Column(db.Float, default=0.0)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class VoiceMomentLike(db.Model):
    __tablename__ = 'w_voice_moment_likes'
    __table_args__ = (
        db.UniqueConstraint('moment_id', 'user_id', name='uq_voice_moment_like'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    moment_id = db.Column(db.Integer, db.ForeignKey('w_voice_moments.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class VoiceMomentComment(db.Model):
    __tablename__ = 'w_voice_moment_comments'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    moment_id = db.Column(db.Integer, db.ForeignKey('w_voice_moments.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    text = db.Column(db.Text, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class VoiceStorySave(db.Model):
    __tablename__ = 'w_voice_story_saves'
    __table_args__ = (
        db.UniqueConstraint('story_id', 'user_id', name='uq_voice_story_save'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    story_id = db.Column(db.Integer, db.ForeignKey('w_voice_stories.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class VoiceStoryUnlock(db.Model):
    """User paid unlock for a locked voice story."""
    __tablename__ = 'w_voice_story_unlocks'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'story_id', name='uq_voice_story_unlock_user_story'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    story_id = db.Column(db.Integer, db.ForeignKey('w_voice_stories.id', ondelete='CASCADE'), nullable=False, index=True)
    coins_spent = db.Column(db.Integer, nullable=False, default=0)
    creator_wiam_id = db.Column(db.BigInteger, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class VoiceListenDayBucket(db.Model):
    """At most one listen count increment per story per identity per UTC day."""
    __tablename__ = 'w_voice_listen_day_buckets'
    __table_args__ = (
        db.UniqueConstraint('story_id', 'bucket_key', name='uq_voice_listen_day_bucket'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    story_id = db.Column(db.Integer, db.ForeignKey('w_voice_stories.id', ondelete='CASCADE'), nullable=False, index=True)
    bucket_key = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class VoiceListenProgress(db.Model):
    """Per-user resume position for a voice story (continue listening)."""
    __tablename__ = 'w_voice_listen_progress'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'story_id', name='uq_voice_listen_progress_user_story'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    story_id = db.Column(db.Integer, db.ForeignKey('w_voice_stories.id', ondelete='CASCADE'), nullable=False, index=True)
    moment_id = db.Column(db.Integer, db.ForeignKey('w_voice_moments.id', ondelete='SET NULL'), nullable=True)
    position_seconds = db.Column(db.Float, nullable=False, default=0.0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class VoiceListenPresence(db.Model):
    """Ephemeral device/session row for live listener counts (HTTP heartbeat)."""
    __tablename__ = 'w_voice_listen_presence'
    __table_args__ = (
        db.UniqueConstraint('story_id', 'client_id', name='uq_voice_listen_presence_story_client'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    story_id = db.Column(db.Integer, db.ForeignKey('w_voice_stories.id', ondelete='CASCADE'), nullable=False, index=True)
    client_id = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.BigInteger, nullable=True, index=True)
    last_seen_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class VoiceStoryRoomMessage(db.Model):
    """Story-scoped room messages (polled until WebSocket)."""
    __tablename__ = 'w_voice_room_messages'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    story_id = db.Column(db.Integer, db.ForeignKey('w_voice_stories.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.BigInteger, nullable=False, index=True)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


# ---------------------------------------------------------------------------
# BOOK POPULARITY SCORE — denormalized score per book, recomputed lazily.
# Powers the new Home dedupe (Push 4): every rail (spotlight / pulse / stream /
# latest / top_rated) reads from this table instead of recomputing on every
# request. Cross-section dedupe is enforced in the home_feed handler so a
# given book never appears in more than one rail; ranking inside each rail
# uses ``score`` as the primary key. ``recompute_if_stale`` (in
# ``services/popularity.py``) refreshes the table at most once per interval.
# ---------------------------------------------------------------------------
class BookPopularityScore(db.Model):
    __tablename__ = 'w_book_popularity'
    __table_args__ = (
        db.Index('ix_book_popularity_score', 'score'),
        db.Index('ix_book_popularity_view_score', 'view_score'),
        db.Index('ix_book_popularity_rating_score', 'rating_score'),
        db.Index('ix_book_popularity_freshness_score', 'freshness_score'),
        {'extend_existing': True},
    )

    content_id = db.Column(db.Integer, primary_key=True)
    score = db.Column(db.Float, default=0.0, nullable=False)
    view_score = db.Column(db.Float, default=0.0, nullable=False)
    rating_score = db.Column(db.Float, default=0.0, nullable=False)
    favorite_score = db.Column(db.Float, default=0.0, nullable=False)
    freshness_score = db.Column(db.Float, default=0.0, nullable=False)
    chapter_score = db.Column(db.Float, default=0.0, nullable=False)
    recent_views_30d = db.Column(db.Integer, default=0)
    total_views = db.Column(db.Integer, default=0)
    rating_count = db.Column(db.Integer, default=0)
    avg_rating = db.Column(db.Float, default=0.0)
    favorite_count = db.Column(db.Integer, default=0)
    chapter_count = db.Column(db.Integer, default=0)
    age_days = db.Column(db.Integer, default=0)
    computed_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f'<BookPopularityScore content={self.content_id} score={self.score:.3f}>'


# ---------------------------------------------------------------------------
# ANALYTICS EVENTS — append-only event log feeding popularity scores,
# creator analytics, home-feed dedupe signals, and tracking dashboards.
# Every engagement signal (view, like, comment, rating, follow, share, push,
# search, home_impression, home_click) writes one row here in addition to
# bumping its denormalized counter, so we never lose history.
# user_id is ALWAYS User.id (PK) — never wiam_id — to kill the legacy split.
# ---------------------------------------------------------------------------
class AnalyticsEvent(db.Model):
    __tablename__ = 'w_analytics_events'
    __table_args__ = (
        db.Index('ix_analytics_events_type_created', 'event_type', 'created_at'),
        db.Index('ix_analytics_events_content_created', 'content_id', 'created_at'),
        db.Index('ix_analytics_events_user_created', 'user_id', 'created_at'),
        {'extend_existing': True},
    )

    id = db.Column(db.BigInteger, primary_key=True)
    event_type = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, nullable=True)        # User.id (PK) — never wiam_id
    content_id = db.Column(db.Integer, nullable=True)
    chapter_number = db.Column(db.Integer, nullable=True)
    section_key = db.Column(db.Text, nullable=True)        # 'trending', 'top_picks', 'genre:romance'…
    metadata_json = db.Column(db.Text, nullable=True)      # JSON blob for extras (≤4 KB)
    client = db.Column(db.Text, nullable=True)             # 'web' | 'mobile' | 'bot' | 'unknown'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f'<AnalyticsEvent {self.id} {self.event_type} user={self.user_id} content={self.content_id}>'


# ---------------------------------------------------------------------------
# WIAMSTUDIO V2 — Universe / Series / Arc / Pro / CreatorSettings / AISuggestion
#
# Push 7 introduces the optional creator-first hierarchy. Existing Content
# rows keep working unchanged; books can be loosely grouped into arcs,
# linked to a Series, and Series stacked under a Universe. Nothing is
# required — solo creators ignore everything below.
# ---------------------------------------------------------------------------

class Universe(db.Model):
    """Top-level container holding multiple StoryBundles. Optional."""
    __tablename__ = 'w_universes'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    creator_wiam_id = db.Column(db.BigInteger, nullable=False, index=True)
    title = db.Column(db.Text, nullable=False)
    slug = db.Column(db.Text, nullable=True, index=True)
    description = db.Column(db.Text, default='')
    cover_url = db.Column(db.Text, nullable=True)
    accent_color = db.Column(db.Text, nullable=True)  # hex, optional
    visibility = db.Column(db.Text, default='public')  # public | unlisted | private
    is_locked = db.Column(db.Boolean, default=False)
    unlock_price_coins = db.Column(db.Integer, nullable=True)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f'<Universe {self.id} {self.title!r}>'


class StoryBundle(db.Model):
    """Ordered list of books (legacy Studio V2). Not a drama Series — see Episode.

    Renamed from Series/w_series so \"Series\" means drama-only in product + schema.
    """
    __tablename__ = 'w_story_bundles'
    __table_args__ = (
        db.Index('ix_story_bundle_creator', 'creator_wiam_id'),
        db.Index('ix_story_bundle_universe', 'universe_id'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    creator_wiam_id = db.Column(db.BigInteger, nullable=False)
    universe_id = db.Column(db.Integer, db.ForeignKey('w_universes.id', ondelete='SET NULL'), nullable=True)
    title = db.Column(db.Text, nullable=False)
    slug = db.Column(db.Text, nullable=True, index=True)
    description = db.Column(db.Text, default='')
    cover_url = db.Column(db.Text, nullable=True)
    accent_color = db.Column(db.Text, nullable=True)
    visibility = db.Column(db.Text, default='public')
    is_locked = db.Column(db.Boolean, default=False)
    unlock_price_coins = db.Column(db.Integer, nullable=True)
    sort_order = db.Column(db.Integer, default=0)
    status = db.Column(db.Text, default='ongoing')  # ongoing | complete | hiatus | archived
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f'<StoryBundle {self.id} {self.title!r}>'


class StoryBundleItem(db.Model):
    """Many-to-many link between StoryBundle and Content (a book) with reading order."""
    __tablename__ = 'w_story_bundle_items'
    __table_args__ = (
        db.UniqueConstraint('story_bundle_id', 'content_id', name='uq_story_bundle_content'),
        db.Index('ix_story_bundle_items_bundle', 'story_bundle_id'),
        db.Index('ix_story_bundle_items_content', 'content_id'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    story_bundle_id = db.Column(db.Integer, db.ForeignKey('w_story_bundles.id', ondelete='CASCADE'), nullable=False)
    content_id = db.Column(db.Integer, nullable=False)
    sort_order = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Arc(db.Model):
    """A grouping of consecutive WebBookContent chapters inside one story.

    Lets creators slice a long book into "Arc 1: The Awakening", "Arc 2:
    The Reckoning"… without renumbering chapters. Pure metadata.
    """
    __tablename__ = 'w_arcs'
    __table_args__ = (
        db.Index('ix_arcs_content', 'content_id'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, nullable=False)
    title = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, default='')
    sort_order = db.Column(db.Integer, default=0, nullable=False)
    start_chapter = db.Column(db.Integer, nullable=True)
    end_chapter = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class StudioProSubscription(db.Model):
    """Active Pro entitlement for a creator (RevenueCat / IAP / founder grant)."""
    __tablename__ = 'w_studio_pro_subscriptions'
    __table_args__ = (
        db.Index('ix_studio_pro_user', 'user_id'),
        db.Index('ix_studio_pro_status', 'status'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    plan = db.Column(db.Text, default='monthly')        # monthly | yearly | lifetime | founder
    status = db.Column(db.Text, default='active')       # active | canceled | expired | grace
    source = db.Column(db.Text, default='manual')       # manual | revenuecat_ios | revenuecat_android | stripe | founder_grant
    revenuecat_user_id = db.Column(db.Text, nullable=True)
    started_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    current_period_end = db.Column(db.DateTime, nullable=True)
    canceled_at = db.Column(db.DateTime, nullable=True)
    raw_receipt_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    @property
    def is_active(self):
        if self.status not in ('active', 'grace'):
            return False
        if self.current_period_end and self.current_period_end < datetime.utcnow():
            return self.plan == 'lifetime' or self.plan == 'founder' or self.status == 'grace'
        return True


class CreatorSettings(db.Model):
    """Per-creator preferences for WiamStudio V2 (tool visibility, beta flags…)."""
    __tablename__ = 'w_creator_settings'
    __table_args__ = (
        db.UniqueConstraint('user_id', name='uq_creator_settings_user'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    default_unit_label = db.Column(db.Text, default='chapter')   # chapter | episode | part | scene | custom
    show_universes = db.Column(db.Boolean, default=False)
    show_series = db.Column(db.Boolean, default=False)  # legacy column; prefer show_story_bundles
    show_story_bundles = db.Column(db.Boolean, default=False)
    show_arcs = db.Column(db.Boolean, default=False)
    show_scheduling = db.Column(db.Boolean, default=True)
    show_premium_lock = db.Column(db.Boolean, default=True)
    show_ai_tools = db.Column(db.Boolean, default=True)
    beta_studio_v2 = db.Column(db.Boolean, default=False)
    has_seen_v2_tour = db.Column(db.Boolean, default=False)
    notif_scheduled_publish = db.Column(db.Boolean, default=True)
    ai_waitlist = db.Column(db.Boolean, default=False)  # Push 11 — AI Coming Soon waitlist opt-in
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class AISuggestion(db.Model):
    """Future home for AI writing suggestions (Phase 2 — schema only for now)."""
    __tablename__ = 'w_ai_suggestions'
    __table_args__ = (
        db.Index('ix_ai_suggestions_user_kind', 'user_id', 'kind'),
        db.Index('ix_ai_suggestions_content', 'content_id'),
        {'extend_existing': True},
    )

    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    content_id = db.Column(db.Integer, nullable=True)
    chapter_number = db.Column(db.Integer, nullable=True)
    kind = db.Column(db.Text, nullable=False)            # writing_continue | reminder | recommendation | summary
    prompt = db.Column(db.Text, nullable=True)
    output = db.Column(db.Text, nullable=True)
    status = db.Column(db.Text, default='queued')         # queued | succeeded | failed | dismissed
    cost_tokens = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    completed_at = db.Column(db.DateTime, nullable=True)


# ---------------------------------------------------------------------------
# WIAMEPISIO — Episode / Watch / Video (Phase 1)
# Drama Series = Content(format='drama'). Episodes live here (not WebBookContent).
# ---------------------------------------------------------------------------

class Episode(db.Model):
    """Video episode under a drama Series (Content with format='drama')."""
    __tablename__ = 'w_episodes'
    __table_args__ = (
        db.UniqueConstraint('content_id', 'episode_number', name='uq_episode_number'),
        db.Index('ix_episodes_content', 'content_id'),
        db.Index('ix_episodes_publish', 'published', 'publish_at'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, nullable=False)
    episode_number = db.Column(db.Integer, nullable=False, default=1)
    title = db.Column(db.Text, nullable=False, default='Episode 1')
    synopsis = db.Column(db.Text, default='')
    video_url = db.Column(db.Text, nullable=True)  # provider asset id / internal ref — not public CDN
    hls_manifest_url = db.Column(db.Text, nullable=True)
    poster_url = db.Column(db.Text, nullable=True)
    trailer_url = db.Column(db.Text, nullable=True)
    duration_seconds = db.Column(db.Integer, default=0)
    transcode_status = db.Column(db.Text, default='queued')  # queued|processing|ready|failed
    subtitle_tracks = db.Column(db.Text, nullable=True)  # JSON string
    dub_tracks = db.Column(db.Text, nullable=True)
    is_free = db.Column(db.Boolean, default=False)  # explicit override; free-first-N still server law
    unlock_price_coins = db.Column(db.Integer, default=10)
    publish_at = db.Column(db.DateTime, nullable=True)
    published = db.Column(db.Boolean, default=False)
    view_count = db.Column(db.Integer, default=0)
    avg_watch_pct = db.Column(db.Float, default=0.0)
    # Probe meta from creator upload (feeds full-season QC)
    upload_probe_json = db.Column(db.Text, default='{}')
    asset_qc_status = db.Column(db.Text, default='none')  # none|pending|passed|failed|borderline
    asset_qc_band = db.Column(db.Text, nullable=True)  # excellent|good|borderline|poor
    # Creator marks episode final (distinct from "file present") before season lock
    is_final = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f'<Episode content={self.content_id} ep={self.episode_number}>'


class WatchProgress(db.Model):
    """Mirrors ReadingProgress for video episodes."""
    __tablename__ = 'w_watch_progress'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'episode_id', name='uq_user_episode_watch'),
        db.Index('ix_watch_progress_user', 'user_id'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    episode_id = db.Column(db.Integer, nullable=False)
    seconds_watched = db.Column(db.Integer, default=0)
    completed = db.Column(db.Boolean, default=False)
    last_watched_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class EpisodeUnlock(db.Model):
    """Mirrors ChapterUnlock for video episodes."""
    __tablename__ = 'w_episode_unlocks'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'episode_id', name='uq_user_episode_unlock'),
        db.Index('ix_episode_unlocks_user', 'user_id'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    episode_id = db.Column(db.Integer, nullable=False)
    content_id = db.Column(db.Integer, nullable=False)
    coins_spent = db.Column(db.Integer, nullable=False, default=0)
    creator_id = db.Column(db.BigInteger, nullable=False)
    unlock_method = db.Column(db.Text, default='coins')  # coins | free | premium | rewarded_ad | admin_grant
    transaction_id = db.Column(db.Integer, nullable=True)
    unlocked_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class VideoAsset(db.Model):
    """Provider-agnostic video asset metadata for an episode."""
    __tablename__ = 'w_video_assets'
    __table_args__ = (
        db.Index('ix_video_assets_episode', 'episode_id'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    episode_id = db.Column(db.Integer, nullable=False)
    original_upload_url = db.Column(db.Text, nullable=True)
    processed_renditions = db.Column(db.Text, nullable=True)  # JSON
    storage_provider = db.Column(db.Text, default='stub')  # stub | cloudflare | …
    storage_key = db.Column(db.Text, nullable=True)
    checksum = db.Column(db.Text, nullable=True)
    size_bytes = db.Column(db.BigInteger, default=0)
    status = db.Column(db.Text, default='pending')  # pending|processing|ready|failed
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class CreatorVideoUploadJob(db.Model):
    """Tracks creator episode upload / transcode jobs."""
    __tablename__ = 'w_creator_video_upload_jobs'
    __table_args__ = (
        db.Index('ix_video_upload_jobs_creator', 'creator_id'),
        db.Index('ix_video_upload_jobs_episode', 'episode_id'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    creator_id = db.Column(db.BigInteger, nullable=False)
    episode_id = db.Column(db.Integer, nullable=True)
    content_id = db.Column(db.Integer, nullable=True)  # for trailer uploads (no episode)
    asset_kind = db.Column(db.Text, default='episode')  # episode | trailer
    upload_status = db.Column(db.Text, default='pending')
    transcode_job_id = db.Column(db.Text, nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class SeasonQualityJob(db.Model):
    """Full-season QC job: trailer + every episode + cover/banner (Founder-toggled pipeline)."""
    __tablename__ = 'w_season_quality_jobs'
    __table_args__ = (
        db.Index('ix_season_qc_jobs_content', 'content_id'),
        db.Index('ix_season_qc_jobs_status', 'status'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Text, default='queued')  # queued|running|passed|failed|borderline|needs_changes
    overall_band = db.Column(db.Text, nullable=True)  # excellent|good|borderline|poor
    overall_score = db.Column(db.Float, default=0.0)
    assets_total = db.Column(db.Integer, default=0)
    assets_passed = db.Column(db.Integer, default=0)
    assets_failed = db.Column(db.Integer, default=0)
    assets_borderline = db.Column(db.Integer, default=0)
    summary_json = db.Column(db.Text, default='{}')
    failure_reasons = db.Column(db.Text, default='')
    founder_decision = db.Column(db.Text, nullable=True)  # approved|changes_required|null
    founder_note = db.Column(db.Text, default='')
    decided_by = db.Column(db.BigInteger, nullable=True)
    decided_at = db.Column(db.DateTime, nullable=True)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class SeasonAssetQualityReport(db.Model):
    """Per-asset QC inside a season job (trailer OR episode)."""
    __tablename__ = 'w_season_asset_quality_reports'
    __table_args__ = (
        db.Index('ix_season_asset_qc_job', 'job_id'),
        db.Index('ix_season_asset_qc_episode', 'episode_id'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, nullable=False)
    content_id = db.Column(db.Integer, nullable=False)
    asset_kind = db.Column(db.Text, nullable=False)  # trailer | episode | cover | banner
    episode_id = db.Column(db.Integer, nullable=True)
    episode_number = db.Column(db.Integer, nullable=True)
    status = db.Column(db.Text, default='pending')  # pending|passed|failed|borderline
    band = db.Column(db.Text, nullable=True)  # excellent|good|borderline|poor
    score = db.Column(db.Float, default=0.0)
    checks_json = db.Column(db.Text, default='{}')
    failure_reasons = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class SeriesRevisionRequest(db.Model):
    """
    Wave 2 — LIVE series only. Legal / rights / factual corrections.
    Quality issues are NEVER allowed here (caught pre-publish).
    Scoped: one trailer or one episode; rest of series stays live.
    """
    __tablename__ = 'w_series_revision_requests'
    __table_args__ = (
        db.Index('ix_revision_req_content', 'content_id'),
        db.Index('ix_revision_req_status', 'status'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, nullable=False)
    requested_by = db.Column(db.BigInteger, nullable=False)
    target_kind = db.Column(db.Text, nullable=False)  # trailer | episode
    episode_id = db.Column(db.Integer, nullable=True)
    episode_number = db.Column(db.Integer, nullable=True)
    category = db.Column(db.Text, nullable=False)  # legal | rights | factual
    reason = db.Column(db.Text, nullable=False, default='')
    replacement_storage_key = db.Column(db.Text, nullable=True)
    replacement_meta_json = db.Column(db.Text, default='{}')
    status = db.Column(db.Text, default='pending')  # pending | approved | rejected
    reviewer_note = db.Column(db.Text, default='')
    decided_by = db.Column(db.BigInteger, nullable=True)
    decided_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class ContentFingerprint(db.Model):
    """Perceptual hashes for duplicate / stolen-content detection across the catalog."""
    __tablename__ = 'w_content_fingerprints'
    __table_args__ = (
        db.Index('ix_content_fp_content', 'content_id'),
        db.Index('ix_content_fp_episode', 'episode_id'),
        db.Index('ix_content_fp_phash', 'phash_value'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, nullable=False)
    episode_id = db.Column(db.Integer, nullable=True)
    asset_kind = db.Column(db.Text, default='episode')  # episode | trailer
    phash_value = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class TrailerQualityReport(db.Model):
    """Automated trailer QA (Founder can toggle gate ON/OFF)."""
    __tablename__ = 'w_trailer_quality_reports'
    __table_args__ = (
        db.Index('ix_trailer_qa_content', 'content_id'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Text, default='pending')  # pending|passed|failed|needs_review
    overall_score = db.Column(db.Float, default=0.0)
    checks_json = db.Column(db.Text, default='{}')  # resolution, audio, black_frames, mood, duration
    failure_reasons = db.Column(db.Text, default='')
    auto_checked = db.Column(db.Boolean, default=True)
    reviewed_by = db.Column(db.BigInteger, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class FeaturedTrailerSlot(db.Model):
    """Founder-curated featured trailers under Home chips (not auto-selected)."""
    __tablename__ = 'w_featured_trailer_slots'
    __table_args__ = (
        db.Index('ix_featured_trailer_slot', 'slot_key', 'is_active'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    slot_key = db.Column(db.Text, nullable=False)  # home_featured | origin | vip | anime | ranking
    content_id = db.Column(db.Integer, nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    curated_by = db.Column(db.BigInteger, nullable=True)
    note = db.Column(db.Text, default='')
    starts_at = db.Column(db.DateTime, nullable=True)
    ends_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class CoinPriceBand(db.Model):
    """Platform coin bands — series/episodes inherit unlock price from band."""
    __tablename__ = 'w_coin_price_bands'
    __table_args__ = ({'extend_existing': True},)

    id = db.Column(db.Integer, primary_key=True)
    band_key = db.Column(db.Text, nullable=False, unique=True)  # standard|premium|origin|vip
    label = db.Column(db.Text, default='')
    unlock_coins = db.Column(db.Integer, nullable=False, default=10)
    min_coins = db.Column(db.Integer, default=5)
    max_coins = db.Column(db.Integer, default=30)
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)


class FxRate(db.Model):
    """FX rates vs USD for local fiat display (coins stay platform currency)."""
    __tablename__ = 'w_fx_rates'
    __table_args__ = ({'extend_existing': True},)

    id = db.Column(db.Integer, primary_key=True)
    currency_code = db.Column(db.Text, nullable=False, unique=True)  # GHS, NGN, KES, EUR…
    rate_per_usd = db.Column(db.Float, nullable=False, default=1.0)  # 1 USD = N local
    symbol = db.Column(db.Text, default='')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class SeriesRankingSnapshot(db.Model):
    """Soft DramaBox-style rankings (not ultra-hard Elite thresholds)."""
    __tablename__ = 'w_series_ranking_snapshots'
    __table_args__ = (
        db.Index('ix_ranking_period', 'period_key', 'rank_position'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, nullable=False)
    period_key = db.Column(db.Text, nullable=False)  # daily | weekly | rising | genre:<name>
    rank_position = db.Column(db.Integer, nullable=False, default=0)
    score = db.Column(db.Float, default=0.0)
    metrics_json = db.Column(db.Text, default='{}')
    computed_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class EpisioCreatorApplication(db.Model):
    """Multi-step WiamEpisio creator apply (quality gate — not instant novel upgrade)."""
    __tablename__ = 'w_episio_creator_applications'
    __table_args__ = (
        db.Index('ix_episio_apply_user', 'user_id'),
        db.Index('ix_episio_apply_status', 'status'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    legal_name = db.Column(db.Text, default='')
    country = db.Column(db.Text, default='')
    phone = db.Column(db.Text, default='')
    channel_name = db.Column(db.Text, default='')
    bio = db.Column(db.Text, default='')
    genres_json = db.Column(db.Text, default='[]')
    pitch = db.Column(db.Text, default='')
    planned_episode_count = db.Column(db.Integer, default=20)
    sample_type = db.Column(db.Text, default='')  # clip | link | trailer
    sample_url = db.Column(db.Text, default='')
    rights_attested = db.Column(db.Boolean, default=False)
    complete_series_attested = db.Column(db.Boolean, default=False)
    status = db.Column(db.Text, default='pending')  # pending | accepted | rejected
    reviewer_note = db.Column(db.Text, default='')
    decided_by = db.Column(db.BigInteger, nullable=True)
    decided_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class SeriesReminder(db.Model):
    """Remind Me on Coming Soon / teaser series."""
    __tablename__ = 'w_series_reminders'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'content_id', name='uq_user_series_remind'),
        db.Index('ix_series_remind_content', 'content_id'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=False)
    content_id = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)