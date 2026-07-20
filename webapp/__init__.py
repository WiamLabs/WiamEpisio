import os
import logging
import threading
from flask import Flask, request
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_cors import CORS
from .extensions import db, login_manager, csrf, limiter
from .config import Config

log = logging.getLogger(__name__)


def _run_safe_migrations(app):
    """Run safe ALTER TABLE IF NOT EXISTS statements on startup.

    This ensures the database has all columns the models expect,
    even if the standalone migrate_db.py was never run.
    All statements are idempotent — safe to run every startup.
    """
    statements = [
        # content table — new columns
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'pdf'",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS allow_download BOOLEAN DEFAULT TRUE",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS generated_pdf_file_id TEXT",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP",
        # users table — status column
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'",
        # orders table — extra columns the bot's order_service may have added
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'permanent'",
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS rent_days INTEGER",
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS price REAL",
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS proof_file_id TEXT",
        # w_book_content — chapter-level publishing + locked chapters
        "ALTER TABLE w_book_content ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'",
        "ALTER TABLE w_book_content ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_book_content ADD COLUMN IF NOT EXISTS chapter_price REAL DEFAULT 0",
        # Google auth columns on users table
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'telegram'",
        "ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL",
        # Unique index on google_id (safe: CREATE INDEX IF NOT EXISTS)
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_id ON users (google_id) WHERE google_id IS NOT NULL",
        # follows table (created by bot, but ensure it exists)
        """CREATE TABLE IF NOT EXISTS follows (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            creator_id BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, creator_id)
        )""",
        # ratings table (created by bot, but ensure it exists)
        """CREATE TABLE IF NOT EXISTS ratings (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, content_id)
        )""",
        # featured_books table
        """CREATE TABLE IF NOT EXISTS featured_books (
            id SERIAL PRIMARY KEY,
            content_id INTEGER UNIQUE NOT NULL,
            featured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            featured_by BIGINT NOT NULL
        )""",
        # creator_profiles table
        """CREATE TABLE IF NOT EXISTS creator_profiles (
            telegram_id BIGINT PRIMARY KEY,
            pen_name TEXT NOT NULL,
            bio TEXT,
            country TEXT,
            profile_pic_file_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # F4: Announcements
        """CREATE TABLE IF NOT EXISTS w_announcements (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            post_to_channel BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # F6: Push subscriptions
        """CREATE TABLE IF NOT EXISTS w_push_subscriptions (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            endpoint TEXT NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # F7: Reading streaks
        """CREATE TABLE IF NOT EXISTS w_reading_streaks (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            date DATE NOT NULL,
            minutes_read INTEGER DEFAULT 0,
            pages_read INTEGER DEFAULT 0,
            UNIQUE(user_id, date)
        )""",
        # F8: Book collections
        """CREATE TABLE IF NOT EXISTS w_collections (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            cover_url TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS w_collection_items (
            id SERIAL PRIMARY KEY,
            collection_id INTEGER NOT NULL,
            content_id INTEGER NOT NULL,
            sort_order INTEGER DEFAULT 0,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(collection_id, content_id)
        )""",
        # F12: Bookmarks
        """CREATE TABLE IF NOT EXISTS w_bookmarks (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            chapter_id INTEGER,
            position TEXT,
            highlight_text TEXT,
            note TEXT,
            color TEXT DEFAULT 'yellow',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # Sticker Gifts
        """CREATE TABLE IF NOT EXISTS w_sticker_gifts (
            id SERIAL PRIMARY KEY,
            sender_id BIGINT NOT NULL,
            recipient_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            sticker_key TEXT NOT NULL,
            coin_cost INTEGER NOT NULL,
            message TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_sticker_gifts_sender ON w_sticker_gifts(sender_id)""",
        """CREATE INDEX IF NOT EXISTS idx_sticker_gifts_recipient ON w_sticker_gifts(recipient_id)""",
        """CREATE INDEX IF NOT EXISTS idx_sticker_gifts_content ON w_sticker_gifts(content_id)""",
        # F16: Gifts
        """CREATE TABLE IF NOT EXISTS w_gifts (
            id SERIAL PRIMARY KEY,
            sender_id BIGINT NOT NULL,
            recipient_id BIGINT,
            recipient_code TEXT UNIQUE,
            content_id INTEGER NOT NULL,
            message TEXT DEFAULT '',
            is_claimed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            claimed_at TIMESTAMP
        )""",
        # F18: Shelves
        """CREATE TABLE IF NOT EXISTS w_shelves (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            is_public BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS w_shelf_items (
            id SERIAL PRIMARY KEY,
            shelf_id INTEGER NOT NULL,
            content_id INTEGER NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(shelf_id, content_id)
        )""",
        # Web sessions
        """CREATE TABLE IF NOT EXISTS w_sessions (
            id SERIAL PRIMARY KEY,
            telegram_id BIGINT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # Reviews
        """CREATE TABLE IF NOT EXISTS w_reviews (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # Web book content (WiamStudio chapters)
        """CREATE TABLE IF NOT EXISTS w_book_content (
            id SERIAL PRIMARY KEY,
            content_id INTEGER NOT NULL,
            chapter_number INTEGER DEFAULT 1,
            chapter_title TEXT NOT NULL DEFAULT 'Chapter 1',
            body TEXT NOT NULL DEFAULT '',
            word_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'draft',
            is_locked BOOLEAN DEFAULT FALSE,
            chapter_price FLOAT DEFAULT 0.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(content_id, chapter_number)
        )""",
        # Reading progress
        """CREATE TABLE IF NOT EXISTS w_reading_progress (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            current_chapter INTEGER DEFAULT 1,
            current_position INTEGER DEFAULT 0,
            total_chapters INTEGER DEFAULT 1,
            last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, content_id)
        )""",
        # Reader preferences
        """CREATE TABLE IF NOT EXISTS w_reader_preferences (
            user_id BIGINT PRIMARY KEY,
            theme TEXT DEFAULT 'light',
            font_size TEXT DEFAULT 'medium',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # Notifications
        """CREATE TABLE IF NOT EXISTS w_notifications (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL DEFAULT '',
            link TEXT,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # Share events (for trending score)
        """CREATE TABLE IF NOT EXISTS w_share_events (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            platform TEXT DEFAULT 'unknown',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # Add created_at to favorites for trending algorithm
        """ALTER TABLE favorites ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP""",
        # Add missing columns to w_announcements
        """ALTER TABLE w_announcements ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info'""",
        """ALTER TABLE w_announcements ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT 'all'""",
        # Add missing column to w_collections
        """ALTER TABLE w_collections ADD COLUMN IF NOT EXISTS cover_url TEXT""",
        # Coin system (Phase 2)
        """CREATE TABLE IF NOT EXISTS w_coin_balances (
            user_id BIGINT PRIMARY KEY,
            balance INTEGER NOT NULL DEFAULT 0,
            total_purchased INTEGER NOT NULL DEFAULT 0,
            total_spent INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS w_coin_transactions (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            type TEXT NOT NULL,
            amount INTEGER NOT NULL,
            balance_after INTEGER NOT NULL,
            description TEXT DEFAULT '',
            reference TEXT,
            content_id INTEGER,
            chapter_id INTEGER,
            recipient_id BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON w_coin_transactions (user_id)""",
        """CREATE INDEX IF NOT EXISTS idx_coin_tx_ref ON w_coin_transactions (reference)""",
        """CREATE TABLE IF NOT EXISTS w_coin_packages (
            id SERIAL PRIMARY KEY,
            coins INTEGER NOT NULL,
            price_ghs REAL NOT NULL,
            bonus_coins INTEGER DEFAULT 0,
            label TEXT DEFAULT '',
            is_active BOOLEAN DEFAULT TRUE,
            sort_order INTEGER DEFAULT 0
        )""",
        # Chapter unlocks (Phase 3)
        """CREATE TABLE IF NOT EXISTS w_chapter_unlocks (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            chapter_number INTEGER NOT NULL,
            coins_spent INTEGER NOT NULL,
            creator_id BIGINT NOT NULL,
            transaction_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, content_id, chapter_number)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_ch_unlock_user ON w_chapter_unlocks (user_id)""",
        # Monetization status (Phase 3)
        """CREATE TABLE IF NOT EXISTS w_monetization_status (
            creator_id BIGINT PRIMARY KEY,
            is_eligible BOOLEAN DEFAULT FALSE,
            eligible_since TIMESTAMP,
            revoked_at TIMESTAMP,
            revoke_reason TEXT,
            cached_account_age_days INTEGER DEFAULT 0,
            cached_story_count INTEGER DEFAULT 0,
            cached_max_chapters INTEGER DEFAULT 0,
            cached_total_readers INTEGER DEFAULT 0,
            cached_followers INTEGER DEFAULT 0,
            cached_avg_rating REAL DEFAULT 0.0,
            cached_rating_count INTEGER DEFAULT 0,
            cached_violations_60d INTEGER DEFAULT 0,
            cached_trust_score INTEGER DEFAULT 50,
            last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # Creator earnings (Phase 3)
        """CREATE TABLE IF NOT EXISTS w_creator_earnings (
            id SERIAL PRIMARY KEY,
            creator_id BIGINT NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            coins_from_unlocks INTEGER DEFAULT 0,
            coins_from_tips INTEGER DEFAULT 0,
            total_coins INTEGER DEFAULT 0,
            ghs_value REAL DEFAULT 0.0,
            creator_share_ghs REAL DEFAULT 0.0,
            is_paid BOOLEAN DEFAULT FALSE,
            rolled_over BOOLEAN DEFAULT FALSE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(creator_id, year, month)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_creator_earnings_cid ON w_creator_earnings (creator_id)""",
        # Creator payouts (Phase 3)
        """CREATE TABLE IF NOT EXISTS w_creator_payouts (
            id SERIAL PRIMARY KEY,
            creator_id BIGINT NOT NULL,
            amount_ghs REAL NOT NULL,
            total_coins INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            provider TEXT DEFAULT '',
            status TEXT DEFAULT 'pending',
            paystack_transfer_code TEXT,
            paystack_reference TEXT,
            failure_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_creator_payouts_cid ON w_creator_payouts (creator_id)""",
        # Phase 3 migration: add provider column if missing
        """ALTER TABLE w_creator_payouts ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT ''""",
        # Creator payout settings (Phase 3)
        """CREATE TABLE IF NOT EXISTS w_creator_payout_settings (
            creator_id BIGINT PRIMARY KEY,
            provider TEXT DEFAULT 'MTN',
            account_number TEXT DEFAULT '',
            account_name TEXT DEFAULT '',
            is_verified BOOLEAN DEFAULT FALSE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # Add cached Paystack recipient code to payout settings
        "ALTER TABLE w_creator_payout_settings ADD COLUMN IF NOT EXISTS paystack_recipient_code TEXT",
        # Creator self-service withdrawal requests
        """CREATE TABLE IF NOT EXISTS w_creator_withdrawals (
            id SERIAL PRIMARY KEY,
            creator_id BIGINT NOT NULL,
            amount_ghs REAL NOT NULL,
            provider TEXT DEFAULT 'MTN',
            account_number TEXT DEFAULT '',
            account_name TEXT DEFAULT '',
            status TEXT DEFAULT 'pending',
            paystack_reference TEXT,
            paystack_transfer_code TEXT,
            failure_reason TEXT,
            requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_creator_withdrawals_cid ON w_creator_withdrawals (creator_id)""",
        # Banned words (Phase 4)
        """CREATE TABLE IF NOT EXISTS w_banned_words (
            id SERIAL PRIMARY KEY,
            word TEXT NOT NULL UNIQUE,
            category TEXT DEFAULT 'general',
            severity INTEGER DEFAULT 1,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # Content reports (Phase 4)
        """CREATE TABLE IF NOT EXISTS w_content_reports (
            id SERIAL PRIMARY KEY,
            reporter_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            chapter_number INTEGER,
            reason TEXT NOT NULL,
            details TEXT DEFAULT '',
            status TEXT DEFAULT 'pending',
            reviewed_by BIGINT,
            reviewed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(reporter_id, content_id, chapter_number)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_reports_content ON w_content_reports (content_id)""",
        """CREATE INDEX IF NOT EXISTS idx_reports_reporter ON w_content_reports (reporter_id)""",
        # Content flags (Phase 4)
        """CREATE TABLE IF NOT EXISTS w_content_flags (
            id SERIAL PRIMARY KEY,
            content_id INTEGER NOT NULL,
            chapter_number INTEGER,
            flag_type TEXT DEFAULT 'report',
            status TEXT DEFAULT 'flagged',
            report_count INTEGER DEFAULT 0,
            scan_matches TEXT DEFAULT '',
            scan_severity INTEGER DEFAULT 0,
            actioned_by BIGINT,
            action_note TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(content_id, chapter_number)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_flags_content ON w_content_flags (content_id)""",
        # Moderation log (Phase 4)
        """CREATE TABLE IF NOT EXISTS w_moderation_log (
            id SERIAL PRIMARY KEY,
            actor_id BIGINT NOT NULL,
            action TEXT NOT NULL,
            target_type TEXT NOT NULL,
            target_id INTEGER NOT NULL,
            chapter_number INTEGER,
            reason TEXT DEFAULT '',
            details TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_modlog_target ON w_moderation_log (target_type, target_id)""",
        # Section settings (curated home page sections)
        """CREATE TABLE IF NOT EXISTS w_section_settings (
            id SERIAL PRIMARY KEY,
            section_key TEXT UNIQUE NOT NULL,
            label TEXT NOT NULL,
            is_active BOOLEAN DEFAULT FALSE,
            admin_can_manage BOOLEAN DEFAULT FALSE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # WiamElite stories V2 (ultra-hard)
        """CREATE TABLE IF NOT EXISTS w_elite_stories (
            id SERIAL PRIMARY KEY,
            content_id INTEGER NOT NULL UNIQUE,
            promoted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            demoted_at TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            total_reads INTEGER DEFAULT 0,
            unique_readers INTEGER DEFAULT 0,
            avg_rating REAL DEFAULT 0.0,
            total_ratings INTEGER DEFAULT 0,
            completion_rate REAL DEFAULT 0.0,
            active_readers_30d INTEGER DEFAULT 0,
            chapter_count INTEGER DEFAULT 0,
            total_votes INTEGER DEFAULT 0,
            total_words INTEGER DEFAULT 0,
            total_shares INTEGER DEFAULT 0,
            paid_reads INTEGER DEFAULT 0,
            paid_read_ratio REAL DEFAULT 0.0,
            reader_return_rate REAL DEFAULT 0.0,
            creator_followers INTEGER DEFAULT 0,
            consecutive_months_qualified INTEGER DEFAULT 0,
            first_qualified_at TIMESTAMP,
            coin_multiplier REAL DEFAULT 3.0,
            creator_revenue_pct REAL DEFAULT 0.60,
            verified_badge_expires TIMESTAMP,
            elite_streak_days INTEGER DEFAULT 0,
            last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_elite_stories_active ON w_elite_stories (is_active)""",
        # V2 column additions (safe ALTER for existing tables)
        """DO $$ BEGIN ALTER TABLE w_elite_stories ADD COLUMN IF NOT EXISTS total_words INTEGER DEFAULT 0; EXCEPTION WHEN others THEN NULL; END $$""",
        """DO $$ BEGIN ALTER TABLE w_elite_stories ADD COLUMN IF NOT EXISTS total_shares INTEGER DEFAULT 0; EXCEPTION WHEN others THEN NULL; END $$""",
        """DO $$ BEGIN ALTER TABLE w_elite_stories ADD COLUMN IF NOT EXISTS paid_reads INTEGER DEFAULT 0; EXCEPTION WHEN others THEN NULL; END $$""",
        """DO $$ BEGIN ALTER TABLE w_elite_stories ADD COLUMN IF NOT EXISTS paid_read_ratio REAL DEFAULT 0.0; EXCEPTION WHEN others THEN NULL; END $$""",
        """DO $$ BEGIN ALTER TABLE w_elite_stories ADD COLUMN IF NOT EXISTS reader_return_rate REAL DEFAULT 0.0; EXCEPTION WHEN others THEN NULL; END $$""",
        """DO $$ BEGIN ALTER TABLE w_elite_stories ADD COLUMN IF NOT EXISTS creator_followers INTEGER DEFAULT 0; EXCEPTION WHEN others THEN NULL; END $$""",
        """DO $$ BEGIN ALTER TABLE w_elite_stories ADD COLUMN IF NOT EXISTS consecutive_months_qualified INTEGER DEFAULT 0; EXCEPTION WHEN others THEN NULL; END $$""",
        """DO $$ BEGIN ALTER TABLE w_elite_stories ADD COLUMN IF NOT EXISTS first_qualified_at TIMESTAMP; EXCEPTION WHEN others THEN NULL; END $$""",
        """DO $$ BEGIN ALTER TABLE w_elite_stories ADD COLUMN IF NOT EXISTS coin_multiplier REAL DEFAULT 3.0; EXCEPTION WHEN others THEN NULL; END $$""",
        """DO $$ BEGIN ALTER TABLE w_elite_stories ADD COLUMN IF NOT EXISTS creator_revenue_pct REAL DEFAULT 0.60; EXCEPTION WHEN others THEN NULL; END $$""",
        """DO $$ BEGIN ALTER TABLE w_elite_stories ADD COLUMN IF NOT EXISTS verified_badge_expires TIMESTAMP; EXCEPTION WHEN others THEN NULL; END $$""",
        """DO $$ BEGIN ALTER TABLE w_elite_stories ADD COLUMN IF NOT EXISTS elite_streak_days INTEGER DEFAULT 0; EXCEPTION WHEN others THEN NULL; END $$""",
        # WiamElite Subscriptions
        """CREATE TABLE IF NOT EXISTS w_elite_subscriptions (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            plan VARCHAR(20) DEFAULT 'monthly',
            amount_ghs REAL DEFAULT 25.0,
            status VARCHAR(20) DEFAULT 'active',
            paystack_sub_code VARCHAR(100),
            paystack_email_token VARCHAR(100),
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            cancelled_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_elite_sub_user ON w_elite_subscriptions (user_id, status)""",
        # Add paystack_reference column for tracking initial payment
        "ALTER TABLE w_elite_subscriptions ADD COLUMN IF NOT EXISTS paystack_reference VARCHAR(100)",
        # WiamElite Read Logs (revenue distribution)
        """CREATE TABLE IF NOT EXISTS w_elite_read_logs (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            chapter_number INTEGER NOT NULL,
            source VARCHAR(20) DEFAULT 'subscription',
            coins_spent INTEGER DEFAULT 0,
            read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            read_duration_sec INTEGER DEFAULT 0
        )""",
        """CREATE INDEX IF NOT EXISTS idx_elite_readlog_content ON w_elite_read_logs (content_id, read_at)""",
        """CREATE INDEX IF NOT EXISTS idx_elite_readlog_user ON w_elite_read_logs (user_id)""",
        # WiamBulletin — creator announcement channel
        """CREATE TABLE IF NOT EXISTS w_bulletin_posts (
            id SERIAL PRIMARY KEY,
            creator_id BIGINT NOT NULL,
            type VARCHAR(20) DEFAULT 'text',
            text_content TEXT DEFAULT '',
            content_id INTEGER,
            is_pinned BOOLEAN DEFAULT FALSE,
            is_deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_bulletin_posts_creator ON w_bulletin_posts (creator_id, created_at DESC)""",
        """CREATE TABLE IF NOT EXISTS w_bulletin_reactions (
            id SERIAL PRIMARY KEY,
            post_id INTEGER NOT NULL,
            user_id BIGINT NOT NULL,
            emoji VARCHAR(10) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(post_id, user_id, emoji)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_bulletin_reactions_post ON w_bulletin_reactions (post_id)""",
        # Auth system overhaul — new columns on users table
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT",
        # Unique indexes for email and phone (one account per email/phone)
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (email) WHERE email IS NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_phone ON users (phone) WHERE phone IS NOT NULL",
        # Verification codes table
        """CREATE TABLE IF NOT EXISTS w_verification_codes (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            purpose TEXT NOT NULL,
            is_used BOOLEAN DEFAULT FALSE,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_vcode_email ON w_verification_codes (email, purpose)""",
        # Review likes
        """CREATE TABLE IF NOT EXISTS w_review_likes (
            id SERIAL PRIMARY KEY,
            review_id INTEGER NOT NULL,
            user_id BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(review_id, user_id)
        )""",
        # BulletinFollow — explicit bulletin subscriptions
        """CREATE TABLE IF NOT EXISTS w_bulletin_follows (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            creator_id BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, creator_id)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_bulletin_follows_user ON w_bulletin_follows (user_id)""",
        # Chapter interactions: comments, likes, votes
        """CREATE TABLE IF NOT EXISTS w_chapter_comments (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            chapter_number INTEGER NOT NULL,
            text TEXT NOT NULL,
            is_deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_ch_comments_chapter ON w_chapter_comments (content_id, chapter_number)""",
        """CREATE TABLE IF NOT EXISTS w_chapter_comment_likes (
            id SERIAL PRIMARY KEY,
            comment_id INTEGER NOT NULL,
            user_id BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(comment_id, user_id)
        )""",
        """CREATE TABLE IF NOT EXISTS w_chapter_likes (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            chapter_number INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, content_id, chapter_number)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_ch_likes_chapter ON w_chapter_likes (content_id, chapter_number)""",
        """CREATE TABLE IF NOT EXISTS w_chapter_votes (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            chapter_number INTEGER NOT NULL,
            value INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, content_id, chapter_number)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_ch_votes_chapter ON w_chapter_votes (content_id, chapter_number)""",
        # Onboarding system
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT TRUE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_completed BOOLEAN DEFAULT TRUE""",
        """CREATE TABLE IF NOT EXISTS w_user_genre_prefs (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            genre_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, genre_id)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_user_genre_prefs_user ON w_user_genre_prefs (user_id)""",
        # Application forms system
        """CREATE TABLE IF NOT EXISTS w_application_forms (
            id SERIAL PRIMARY KEY,
            form_type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            fields_json TEXT DEFAULT '[]',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS w_application_responses (
            id SERIAL PRIMARY KEY,
            form_id INTEGER NOT NULL,
            form_type TEXT NOT NULL,
            applicant_email TEXT NOT NULL,
            applicant_name TEXT DEFAULT '',
            answers_json TEXT DEFAULT '{}',
            status TEXT DEFAULT 'pending',
            reviewer_notes TEXT DEFAULT '',
            token TEXT NOT NULL UNIQUE,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            submitted_at TIMESTAMP,
            reviewed_at TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_app_resp_form ON w_application_responses (form_id)""",
        """CREATE INDEX IF NOT EXISTS idx_app_resp_token ON w_application_responses (token)""",
        # Feedback table
        """CREATE TABLE IF NOT EXISTS w_feedback (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            user_name TEXT DEFAULT '',
            user_email TEXT DEFAULT '',
            category TEXT DEFAULT 'general',
            message TEXT NOT NULL,
            status TEXT DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_feedback_user ON w_feedback (user_id)""",
        """ALTER TABLE w_feedback ADD COLUMN IF NOT EXISTS reply TEXT""",
        """ALTER TABLE w_feedback ADD COLUMN IF NOT EXISTS replied_by BIGINT""",
        """ALTER TABLE w_feedback ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP""",
        # User warnings (role-specific)
        """CREATE TABLE IF NOT EXISTS w_user_warnings (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            target_role TEXT NOT NULL DEFAULT 'creator',
            category TEXT NOT NULL DEFAULT 'general',
            message TEXT NOT NULL,
            severity TEXT DEFAULT 'warning',
            issued_by BIGINT NOT NULL,
            acknowledged BOOLEAN DEFAULT FALSE,
            acknowledged_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_user_warnings_uid ON w_user_warnings (user_id)""",
        # Enhanced profile fields
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS age_confirmed_at TIMESTAMP""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS dob_visible BOOLEAN DEFAULT FALSE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_show_email BOOLEAN DEFAULT FALSE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_show_phone BOOLEAN DEFAULT FALSE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS pronouns TEXT""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS account_region TEXT""",
        # Notification preferences
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_new_chapter BOOLEAN DEFAULT TRUE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_new_follower BOOLEAN DEFAULT TRUE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_comments BOOLEAN DEFAULT TRUE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_likes BOOLEAN DEFAULT TRUE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_mentions BOOLEAN DEFAULT TRUE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_announcements BOOLEAN DEFAULT TRUE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_coins BOOLEAN DEFAULT TRUE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_elite BOOLEAN DEFAULT TRUE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_email BOOLEAN DEFAULT FALSE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_push BOOLEAN DEFAULT TRUE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_sound TEXT DEFAULT 'chime'""",
        # Privacy settings
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_profile_visible BOOLEAN DEFAULT TRUE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_show_reading_activity BOOLEAN DEFAULT TRUE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_show_library BOOLEAN DEFAULT TRUE""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_show_favorites BOOLEAN DEFAULT FALSE""",
        # Pronouns visibility toggle
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS show_pronouns BOOLEAN DEFAULT FALSE""",
        # Published timestamp for proper sorting of new releases
        """ALTER TABLE content ADD COLUMN IF NOT EXISTS published_at TIMESTAMP""",
        # Fix: restore all soft-deleted books (they should never have been deleted)
        """UPDATE content SET deleted_at = NULL WHERE deleted_at IS NOT NULL""",
        # Fix: link orphaned cover images to existing books
        """UPDATE content SET cover_file_id = 'dbimg_2' WHERE id = 3 AND cover_file_id IS NULL""",
        """UPDATE content SET cover_file_id = 'dbimg_3' WHERE id = 2 AND cover_file_id IS NULL""",
        """UPDATE content SET cover_file_id = 'dbimg_4' WHERE id = 1 AND cover_file_id IS NULL""",
        # Fix: auto-publish chapters for already-published books (one-time fix)
        """UPDATE w_book_content SET status='published'
           WHERE status='draft' AND body IS NOT NULL AND body != ''
           AND content_id IN (SELECT id FROM content WHERE status IN ('ongoing','complete','approved','published') AND deleted_at IS NULL)""",
        # Reader Experience: Paragraph reactions
        """CREATE TABLE IF NOT EXISTS w_paragraph_reactions (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            chapter_number INTEGER NOT NULL,
            paragraph_index INTEGER NOT NULL,
            emoji TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, content_id, chapter_number, paragraph_index)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_para_react_content ON w_paragraph_reactions(content_id, chapter_number)""",
        # Reader Experience: Paragraph comments (threaded)
        """CREATE TABLE IF NOT EXISTS w_paragraph_comments (
            id SERIAL PRIMARY KEY,
            parent_id INTEGER,
            user_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            chapter_number INTEGER NOT NULL,
            paragraph_index INTEGER NOT NULL,
            text TEXT NOT NULL,
            like_count INTEGER DEFAULT 0,
            is_deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_para_comment_content ON w_paragraph_comments(content_id, chapter_number)""",
        """CREATE INDEX IF NOT EXISTS idx_para_comment_parent ON w_paragraph_comments(parent_id)""",
        # Reader Experience: Paragraph comment likes
        """CREATE TABLE IF NOT EXISTS w_paragraph_comment_likes (
            id SERIAL PRIMARY KEY,
            comment_id INTEGER NOT NULL,
            user_id BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(comment_id, user_id)
        )""",
        # Reader Experience: Extra reader preference columns
        """ALTER TABLE w_reader_preferences ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'serif'""",
        """ALTER TABLE w_reader_preferences ADD COLUMN IF NOT EXISTS line_spacing TEXT DEFAULT 'normal'""",
        # Persistent image storage (avatars + covers survive deploys)
        """CREATE TABLE IF NOT EXISTS w_images (
            id SERIAL PRIMARY KEY,
            data BYTEA NOT NULL,
            content_type TEXT NOT NULL DEFAULT 'image/jpeg',
            filename TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # ===== Phase 4: WiamPremium Monetization =====
        # Feature flags on PlatformConfig
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_premium_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_elite_paywall_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_apex_paywall_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_monthly_unlocks_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_ad_free_premium_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_premium_badge_enabled BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS premium_monthly_unlock_credits INTEGER DEFAULT 10",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS premium_price_ghs FLOAT DEFAULT 20.0",
        # Premium subscription fields on users
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_status TEXT DEFAULT 'none'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_started_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_plan TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_provider TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_credits_balance INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_credits_cycle_start TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_credits_cycle_end TIMESTAMP",
        # Creator Pro subscription fields (separate from reader WiamPremium)
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_pro_status TEXT DEFAULT 'none'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_pro_plan TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_pro_started_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_pro_expires_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_pro_provider TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_pro_grace_until TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_pro_trial_used BOOLEAN DEFAULT FALSE",
        # Premium Credits Ledger
        """CREATE TABLE IF NOT EXISTS w_premium_credits_ledger (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            type TEXT NOT NULL,
            amount INTEGER NOT NULL,
            balance_after INTEGER NOT NULL DEFAULT 0,
            reason TEXT DEFAULT '',
            related_chapter_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_pcl_user ON w_premium_credits_ledger (user_id)""",
        # Content tier flags
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS is_apex BOOLEAN DEFAULT FALSE",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS apex_contract_status TEXT DEFAULT 'none'",
        # Chapter premium lock fields
        "ALTER TABLE w_book_content ADD COLUMN IF NOT EXISTS is_premium_locked BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_book_content ADD COLUMN IF NOT EXISTS unlock_cost_credits INTEGER DEFAULT 1",
        # Chapter unlock method tracking
        "ALTER TABLE w_chapter_unlocks ADD COLUMN IF NOT EXISTS unlock_method TEXT DEFAULT 'coins'",
        # Fix: books with non-published statuses — make them visible
        "UPDATE content SET status = 'ongoing' WHERE status IN ('pending', 'hidden') AND deleted_at IS NULL",
        "UPDATE content SET published_at = created_at WHERE published_at IS NULL AND status IN ('ongoing','complete','approved','published')",
        # B-02: Database indexes for query performance
        "CREATE INDEX IF NOT EXISTS idx_content_status ON content (status)",
        "CREATE INDEX IF NOT EXISTS idx_content_created_at ON content (created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_content_published_at ON content (published_at DESC NULLS LAST)",
        "CREATE INDEX IF NOT EXISTS idx_content_views ON content (views DESC NULLS LAST)",
        "CREATE INDEX IF NOT EXISTS idx_content_genre ON content (genre)",
        "CREATE INDEX IF NOT EXISTS idx_content_creator ON content (creator_telegram_id)",
        "CREATE INDEX IF NOT EXISTS idx_wbc_content_id ON w_book_content (content_id)",
        "CREATE INDEX IF NOT EXISTS idx_wbc_content_ch ON w_book_content (content_id, chapter_number)",
        "CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON w_reading_progress (user_id, content_id)",
        "CREATE INDEX IF NOT EXISTS idx_ratings_content ON ratings (content_id)",
        "CREATE INDEX IF NOT EXISTS idx_favorites_content ON favorites (content_id)",
        "CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites (user_id)",
        "CREATE INDEX IF NOT EXISTS idx_follows_creator ON follows (creator_id)",
        "CREATE INDEX IF NOT EXISTS idx_follows_user ON follows (user_id)",
        "CREATE INDEX IF NOT EXISTS idx_ch_likes_content ON w_chapter_likes (content_id, chapter_number)",
        "CREATE INDEX IF NOT EXISTS idx_ch_comments_content ON w_chapter_comments (content_id, chapter_number)",
        # WiamBot V1 — Intent-based Help Center
        """CREATE TABLE IF NOT EXISTS w_bot_intents (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            description TEXT DEFAULT '',
            keywords TEXT DEFAULT '',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS w_bot_intent_phrases (
            id SERIAL PRIMARY KEY,
            intent_id INTEGER NOT NULL,
            phrase TEXT NOT NULL,
            approved BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_bot_phrases_intent ON w_bot_intent_phrases (intent_id)""",
        """CREATE TABLE IF NOT EXISTS w_bot_intent_responses (
            id SERIAL PRIMARY KEY,
            intent_id INTEGER NOT NULL,
            part TEXT NOT NULL,
            text TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_bot_responses_intent ON w_bot_intent_responses (intent_id)""",
        """CREATE TABLE IF NOT EXISTS w_bot_unmatched (
            id SERIAL PRIMARY KEY,
            user_message TEXT NOT NULL,
            user_id BIGINT,
            assigned_intent_id INTEGER,
            resolved BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # Team Compensation Plans table
        """CREATE TABLE IF NOT EXISTS w_team_comp_plans (
            id SERIAL PRIMARY KEY,
            role_name TEXT NOT NULL,
            plan_type TEXT DEFAULT 'MONTHLY',
            base_amount REAL DEFAULT 0.0,
            currency TEXT DEFAULT 'GHS',
            commission_pct REAL DEFAULT 0.0,
            notes TEXT DEFAULT '',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # Reports / Disputes table
        """CREATE TABLE IF NOT EXISTS w_reports (
            id SERIAL PRIMARY KEY,
            reporter_user_id BIGINT NOT NULL,
            target_type TEXT NOT NULL,
            target_id BIGINT NOT NULL,
            category TEXT DEFAULT 'other',
            description TEXT DEFAULT '',
            status TEXT DEFAULT 'OPEN',
            assigned_to BIGINT,
            resolution_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_reports_status ON w_reports (status)""",
        """CREATE INDEX IF NOT EXISTS idx_reports_reporter ON w_reports (reporter_user_id)""",
        # Revenue Rules table (configurable revenue splits per tier)
        """CREATE TABLE IF NOT EXISTS w_revenue_rules (
            id SERIAL PRIMARY KEY,
            rule_type TEXT NOT NULL,
            target_id BIGINT,
            creator_share_pct REAL NOT NULL DEFAULT 50.0,
            platform_share_pct REAL NOT NULL DEFAULT 50.0,
            effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            effective_to TIMESTAMP,
            created_by BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_revenue_rules_type ON w_revenue_rules (rule_type)""",
        # Extra columns on existing monetization tables
        "ALTER TABLE w_creator_payouts ADD COLUMN IF NOT EXISTS approved_by BIGINT",
        "ALTER TABLE w_creator_payouts ADD COLUMN IF NOT EXISTS period_start DATE",
        "ALTER TABLE w_creator_payouts ADD COLUMN IF NOT EXISTS period_end DATE",
        "ALTER TABLE w_creator_payout_settings ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'GH'",
        # Training queue columns for w_bot_unmatched
        "ALTER TABLE w_bot_unmatched ADD COLUMN IF NOT EXISTS resolved_by BIGINT",
        "ALTER TABLE w_bot_unmatched ADD COLUMN IF NOT EXISTS resolved_intent TEXT",
        # Ensure is_approved column exists on intent phrases (training assigns with is_approved=TRUE)
        "ALTER TABLE w_bot_intent_phrases ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE",
        # WiamBot V2 — Wiam Apex Contract Gatekeeper
        """CREATE TABLE IF NOT EXISTS w_apex_submissions (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            pen_name TEXT DEFAULT '',
            email TEXT DEFAULT '',
            country TEXT DEFAULT '',
            title TEXT NOT NULL,
            genre TEXT DEFAULT '',
            logline TEXT DEFAULT '',
            synopsis TEXT DEFAULT '',
            chapter_1 TEXT DEFAULT '',
            chapter_2 TEXT DEFAULT '',
            outline TEXT DEFAULT '',
            posting_commitment TEXT DEFAULT '',
            originality_declaration BOOLEAN DEFAULT FALSE,
            total_score INTEGER DEFAULT 0,
            score_breakdown TEXT DEFAULT '{}',
            flags TEXT DEFAULT '[]',
            strengths TEXT DEFAULT '[]',
            weaknesses TEXT DEFAULT '[]',
            max_similarity FLOAT DEFAULT 0.0,
            status TEXT DEFAULT 'draft',
            admin_notes TEXT DEFAULT '',
            reviewed_by BIGINT,
            reviewed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_apex_user ON w_apex_submissions (user_id)""",
        """CREATE INDEX IF NOT EXISTS idx_apex_status ON w_apex_submissions (status)""",
        # ── Editor Studio ──
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'unreviewed'",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS review_score INTEGER",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS reviewed_by BIGINT",
        """CREATE TABLE IF NOT EXISTS w_editorial_notes (
            id SERIAL PRIMARY KEY,
            content_id INTEGER NOT NULL,
            editor_user_id BIGINT NOT NULL,
            note_type TEXT DEFAULT 'feedback',
            note_text TEXT NOT NULL,
            chapter_number INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_ednote_content ON w_editorial_notes (content_id)""",
        """CREATE TABLE IF NOT EXISTS w_review_queue (
            id SERIAL PRIMARY KEY,
            content_id INTEGER NOT NULL,
            creator_id BIGINT DEFAULT 0,
            submission_type TEXT DEFAULT 'publish',
            status TEXT DEFAULT 'pending',
            assigned_to BIGINT,
            bot_score INTEGER,
            bot_feedback_json TEXT,
            editor_score INTEGER,
            editor_feedback TEXT,
            reviewed_at TIMESTAMP,
            reviewed_by BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_rq_status ON w_review_queue (status)""",
        """CREATE INDEX IF NOT EXISTS idx_rq_content ON w_review_queue (content_id)""",
        """CREATE TABLE IF NOT EXISTS w_audit_log (
            id SERIAL PRIMARY KEY,
            actor_user_id BIGINT NOT NULL,
            action TEXT NOT NULL,
            target_type TEXT,
            target_id INTEGER,
            details_json TEXT DEFAULT '{}',
            ip_address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_audit_actor ON w_audit_log (actor_user_id)""",
        """CREATE INDEX IF NOT EXISTS idx_audit_target ON w_audit_log (target_type, target_id)""",
        # ── Platform Settings & Feature Flags ──
        """CREATE TABLE IF NOT EXISTS w_platform_settings (
            id SERIAL PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            value_json TEXT DEFAULT 'null',
            value_type TEXT DEFAULT 'string',
            description TEXT DEFAULT '',
            updated_by BIGINT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS w_feature_flags (
            id SERIAL PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            is_enabled BOOLEAN DEFAULT TRUE,
            description TEXT DEFAULT '',
            updated_by BIGINT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # ── Magic Box (Weekly Loot Crate) ──
        """CREATE TABLE IF NOT EXISTS w_magic_boxes (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            tier TEXT DEFAULT 'bronze',
            week_start DATE NOT NULL,
            earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            opened_at TIMESTAMP,
            source TEXT DEFAULT 'reader',
            goals_met TEXT DEFAULT '',
            UNIQUE(user_id, week_start, source)
        )""",
        """CREATE TABLE IF NOT EXISTS w_magic_box_rewards (
            id SERIAL PRIMARY KEY,
            box_id INTEGER NOT NULL REFERENCES w_magic_boxes(id),
            reward_type TEXT NOT NULL,
            reward_key TEXT DEFAULT '',
            reward_label TEXT DEFAULT '',
            quantity INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # ── RBAC — Role-Based Access Control ──
        """CREATE TABLE IF NOT EXISTS w_roles (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            description TEXT DEFAULT '',
            is_system BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS w_permissions (
            id SERIAL PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            description TEXT DEFAULT '',
            category TEXT DEFAULT 'general'
        )""",
        """CREATE TABLE IF NOT EXISTS w_role_permissions (
            id SERIAL PRIMARY KEY,
            role_id INTEGER NOT NULL REFERENCES w_roles(id) ON DELETE CASCADE,
            permission_id INTEGER NOT NULL REFERENCES w_permissions(id) ON DELETE CASCADE,
            UNIQUE(role_id, permission_id)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_role_perms_role ON w_role_permissions (role_id)""",
        """CREATE INDEX IF NOT EXISTS idx_role_perms_perm ON w_role_permissions (permission_id)""",
        """CREATE TABLE IF NOT EXISTS w_user_roles (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role_id INTEGER NOT NULL REFERENCES w_roles(id) ON DELETE CASCADE,
            assigned_by BIGINT,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, role_id)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_user_roles_user ON w_user_roles (user_id)""",
        """CREATE INDEX IF NOT EXISTS idx_user_roles_role ON w_user_roles (role_id)""",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS payroll_enabled BOOLEAN DEFAULT TRUE",
        # ── WiamPremium Subscriptions ──
        """CREATE TABLE IF NOT EXISTS w_premium_subscriptions (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            plan TEXT DEFAULT 'monthly',
            amount_ghs REAL DEFAULT 20.0,
            status TEXT DEFAULT 'active',
            paystack_sub_code TEXT,
            paystack_email_token TEXT,
            paystack_reference TEXT,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            cancelled_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_prem_sub_user ON w_premium_subscriptions (user_id)""",
        """CREATE INDEX IF NOT EXISTS idx_prem_sub_status ON w_premium_subscriptions (status)""",
        # ── Team Payroll ──
        """CREATE TABLE IF NOT EXISTS w_team_payroll (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            role_name TEXT NOT NULL,
            amount_ghs REAL NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            provider TEXT DEFAULT 'MTN',
            account_number TEXT DEFAULT '',
            account_name TEXT DEFAULT '',
            paystack_transfer_code TEXT,
            paystack_reference TEXT,
            failure_reason TEXT,
            approved_by BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_payroll_user ON w_team_payroll (user_id)""",
        """CREATE INDEX IF NOT EXISTS idx_payroll_period ON w_team_payroll (year, month)""",
        """CREATE TABLE IF NOT EXISTS w_team_payroll_settings (
            user_id BIGINT PRIMARY KEY,
            role_name TEXT NOT NULL,
            monthly_salary_ghs REAL DEFAULT 0.0,
            provider TEXT DEFAULT 'MTN',
            account_number TEXT DEFAULT '',
            account_name TEXT DEFAULT '',
            paystack_recipient_code TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            is_verified BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # ── P7 Programs ──
        """CREATE TABLE IF NOT EXISTS w_story_challenges (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            challenge_type TEXT DEFAULT 'weekly',
            theme TEXT DEFAULT '',
            genre TEXT DEFAULT '',
            min_words INTEGER DEFAULT 1000,
            min_chapters INTEGER DEFAULT 1,
            coin_reward INTEGER DEFAULT 50,
            badge_name TEXT DEFAULT '',
            starts_at TIMESTAMP NOT NULL,
            ends_at TIMESTAMP NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_by BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS w_challenge_entries (
            id SERIAL PRIMARY KEY,
            challenge_id INTEGER NOT NULL,
            user_id BIGINT NOT NULL,
            content_id INTEGER,
            status TEXT DEFAULT 'joined',
            word_count INTEGER DEFAULT 0,
            submitted_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_challenge_entries_ch ON w_challenge_entries (challenge_id)""",
        """CREATE INDEX IF NOT EXISTS idx_challenge_entries_user ON w_challenge_entries (user_id)""",
        """CREATE TABLE IF NOT EXISTS w_gift_subscriptions (
            id SERIAL PRIMARY KEY,
            sender_id BIGINT NOT NULL,
            recipient_id BIGINT NOT NULL,
            plan TEXT DEFAULT 'premium',
            duration_months INTEGER DEFAULT 1,
            amount_ghs REAL DEFAULT 20.0,
            status TEXT DEFAULT 'pending',
            paystack_reference TEXT,
            message TEXT DEFAULT '',
            activated_at TIMESTAMP,
            expires_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_gift_sub_sender ON w_gift_subscriptions (sender_id)""",
        """CREATE INDEX IF NOT EXISTS idx_gift_sub_recipient ON w_gift_subscriptions (recipient_id)""",
        """CREATE TABLE IF NOT EXISTS w_creator_milestones (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            milestone_key TEXT NOT NULL,
            milestone_name TEXT NOT NULL,
            milestone_icon TEXT DEFAULT 'bi-trophy',
            milestone_color TEXT DEFAULT '#d4a843',
            earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_milestones_user ON w_creator_milestones (user_id)""",
        """CREATE TABLE IF NOT EXISTS w_referrals (
            id SERIAL PRIMARY KEY,
            referrer_id BIGINT NOT NULL,
            referred_id BIGINT NOT NULL,
            referral_code TEXT NOT NULL,
            status TEXT DEFAULT 'signed_up',
            coins_earned INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON w_referrals (referrer_id)""",
        # Referral code on users table
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by BIGINT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE",
        """CREATE TABLE IF NOT EXISTS w_trial_device_fingerprints (
            id SERIAL PRIMARY KEY,
            device_hash TEXT NOT NULL UNIQUE,
            first_user_id BIGINT,
            last_user_id BIGINT,
            trial_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_trial_device_hash ON w_trial_device_fingerprints (device_hash)""",
        # ── Premium Referrals (PremiumReferral model) ──
        """CREATE TABLE IF NOT EXISTS w_premium_referrals (
            id SERIAL PRIMARY KEY,
            referrer_id BIGINT NOT NULL,
            referee_id BIGINT NOT NULL,
            referral_code TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            bonus_credits INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            converted_at TIMESTAMP,
            CONSTRAINT uq_referral_pair UNIQUE (referrer_id, referee_id)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_prem_ref_referrer ON w_premium_referrals (referrer_id)""",
        """CREATE INDEX IF NOT EXISTS idx_prem_ref_referee ON w_premium_referrals (referee_id)""",
        """CREATE INDEX IF NOT EXISTS idx_prem_ref_code ON w_premium_referrals (referral_code)""",
        # ── Classic Seed System (temporary — removable) ──
        """CREATE TABLE IF NOT EXISTS w_classics_books (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT NOT NULL DEFAULT 'Unknown',
            gutenberg_id INTEGER UNIQUE NOT NULL,
            description TEXT DEFAULT '',
            cover_image TEXT DEFAULT '',
            language TEXT DEFAULT 'en',
            genre TEXT DEFAULT 'Fiction',
            word_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'draft',
            source TEXT DEFAULT 'gutenberg',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            published_at TIMESTAMP,
            views INTEGER DEFAULT 0,
            likes INTEGER DEFAULT 0,
            rating REAL DEFAULT 0.0,
            rating_count INTEGER DEFAULT 0
        )""",
        """CREATE TABLE IF NOT EXISTS w_classics_chapters (
            id SERIAL PRIMARY KEY,
            book_id INTEGER NOT NULL REFERENCES w_classics_books(id) ON DELETE CASCADE,
            chapter_number INTEGER NOT NULL,
            chapter_title TEXT DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            word_count INTEGER DEFAULT 0,
            publish_date TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(book_id, chapter_number)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_classics_ch_book ON w_classics_chapters (book_id)""",
        """CREATE TABLE IF NOT EXISTS w_classics_fetch_log (
            id SERIAL PRIMARY KEY,
            gutenberg_id INTEGER NOT NULL,
            title TEXT DEFAULT '',
            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'fetched',
            reason_skipped TEXT DEFAULT ''
        )""",
        """CREATE INDEX IF NOT EXISTS idx_classics_log_gid ON w_classics_fetch_log (gutenberg_id)""",
        # ── Classic ↔ Content merge columns ──
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS algorithm_weight INTEGER DEFAULT 1",
        "ALTER TABLE w_classics_books ADD COLUMN IF NOT EXISTS content_id INTEGER",
        # ── Email queue ──
        """CREATE TABLE IF NOT EXISTS w_email_jobs (
            id SERIAL PRIMARY KEY,
            to_email VARCHAR(255) NOT NULL,
            subject TEXT NOT NULL,
            html_body TEXT NOT NULL,
            priority INTEGER DEFAULT 2,
            status VARCHAR(20) DEFAULT 'pending',
            error TEXT,
            attempts INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            sent_at TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS idx_email_jobs_status ON w_email_jobs (status)",
        "CREATE INDEX IF NOT EXISTS idx_email_jobs_priority ON w_email_jobs (priority)",
        "CREATE INDEX IF NOT EXISTS idx_email_jobs_to ON w_email_jobs (to_email)",
        # ── Protection System (Phase S12/S14) ──
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS ai_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reader_trust_score REAL DEFAULT 0.5",
        # ── WiamStudio S2: Optional story introduction ──
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS introduction TEXT",
        # ── User Library (explicit "Add to Library") ──
        """CREATE TABLE IF NOT EXISTS w_user_library (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            UNIQUE(user_id, content_id)
        )""",
        """CREATE INDEX IF NOT EXISTS idx_user_library_user ON w_user_library (user_id)""",
        """CREATE INDEX IF NOT EXISTS idx_user_library_content ON w_user_library (content_id)""",
        # Creator application & approval scheduling
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_application_status TEXT DEFAULT 'none'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_approval_scheduled TIMESTAMP",
        # Google Ads config
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ads_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ads_client_id TEXT DEFAULT ''",
        # ── Money Ecosystem v5 — Double-Entry Ledger ──
        """CREATE TABLE IF NOT EXISTS w_ledger_entries (
            id SERIAL PRIMARY KEY,
            tx_group TEXT NOT NULL,
            account_type TEXT NOT NULL,
            account_id BIGINT NOT NULL,
            entry_type TEXT NOT NULL,
            amount INTEGER NOT NULL,
            currency TEXT DEFAULT 'coins',
            balance_after INTEGER NOT NULL,
            description TEXT DEFAULT '',
            reference TEXT,
            event_type TEXT NOT NULL,
            metadata_json TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by BIGINT
        )""",
        """CREATE INDEX IF NOT EXISTS idx_ledger_tx_group ON w_ledger_entries (tx_group)""",
        """CREATE INDEX IF NOT EXISTS idx_ledger_account ON w_ledger_entries (account_type, account_id)""",
        """CREATE INDEX IF NOT EXISTS idx_ledger_ref ON w_ledger_entries (reference)""",
        """CREATE INDEX IF NOT EXISTS idx_ledger_event ON w_ledger_entries (event_type)""",
        """CREATE TABLE IF NOT EXISTS w_system_wallets (
            account_type TEXT PRIMARY KEY,
            balance_coins INTEGER DEFAULT 0,
            balance_ghs REAL DEFAULT 0.0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS w_refund_requests (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            original_tx_id INTEGER NOT NULL,
            amount_coins INTEGER NOT NULL,
            reason TEXT DEFAULT '',
            status TEXT DEFAULT 'pending',
            resolution_note TEXT DEFAULT '',
            resolved_by BIGINT,
            creator_deducted INTEGER DEFAULT 0,
            platform_absorbed INTEGER DEFAULT 0,
            ledger_tx_group TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_refund_user ON w_refund_requests (user_id)""",
        """CREATE INDEX IF NOT EXISTS idx_refund_status ON w_refund_requests (status)""",
        """CREATE TABLE IF NOT EXISTS w_fraud_alerts (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            alert_type TEXT NOT NULL,
            severity TEXT DEFAULT 'low',
            description TEXT DEFAULT '',
            metadata_json TEXT DEFAULT '{}',
            is_resolved BOOLEAN DEFAULT FALSE,
            resolved_by BIGINT,
            resolved_note TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP
        )""",
        """CREATE INDEX IF NOT EXISTS idx_fraud_user ON w_fraud_alerts (user_id)""",
        """CREATE INDEX IF NOT EXISTS idx_fraud_resolved ON w_fraud_alerts (is_resolved)""",
        # v5 columns on existing tables
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS refund_count INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_frozen BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_coin_transactions ADD COLUMN IF NOT EXISTS rate_limit_flag BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_coin_transactions ADD COLUMN IF NOT EXISTS dispute_status TEXT",
        "ALTER TABLE w_coin_transactions ADD COLUMN IF NOT EXISTS ledger_tx_group TEXT",
        # Seed system wallets
        """INSERT INTO w_system_wallets (account_type, balance_coins, balance_ghs)
           VALUES ('platform_revenue', 0, 0.0)
           ON CONFLICT (account_type) DO NOTHING""",
        """INSERT INTO w_system_wallets (account_type, balance_coins, balance_ghs)
           VALUES ('platform_cash', 0, 0.0)
           ON CONFLICT (account_type) DO NOTHING""",
        """INSERT INTO w_system_wallets (account_type, balance_coins, balance_ghs)
           VALUES ('platform_loss', 0, 0.0)
           ON CONFLICT (account_type) DO NOTHING""",
        # ── v6-IAP: Global In-App Purchase support (RevenueCat) ──
        # CoinTransaction — store tracking
        "ALTER TABLE w_coin_transactions ADD COLUMN IF NOT EXISTS store TEXT",
        "ALTER TABLE w_coin_transactions ADD COLUMN IF NOT EXISTS store_transaction_id TEXT",
        "CREATE INDEX IF NOT EXISTS idx_coin_tx_store_tid ON w_coin_transactions (store_transaction_id)",
        # CoinPackage — USD pricing + store product mapping
        "ALTER TABLE w_coin_packages ADD COLUMN IF NOT EXISTS price_usd_cents INTEGER DEFAULT 0",
        "ALTER TABLE w_coin_packages ADD COLUMN IF NOT EXISTS store_product_id TEXT",
        # EliteSubscription — IAP store fields
        "ALTER TABLE w_elite_subscriptions ADD COLUMN IF NOT EXISTS amount_usd_cents INTEGER DEFAULT 0",
        "ALTER TABLE w_elite_subscriptions ADD COLUMN IF NOT EXISTS store VARCHAR(20)",
        "ALTER TABLE w_elite_subscriptions ADD COLUMN IF NOT EXISTS store_product_id VARCHAR(100)",
        "ALTER TABLE w_elite_subscriptions ADD COLUMN IF NOT EXISTS store_transaction_id VARCHAR(200)",
        "ALTER TABLE w_elite_subscriptions ADD COLUMN IF NOT EXISTS rc_subscriber_id VARCHAR(200)",
        # PremiumSubscription — IAP store fields
        "ALTER TABLE w_premium_subscriptions ADD COLUMN IF NOT EXISTS amount_usd_cents INTEGER DEFAULT 0",
        "ALTER TABLE w_premium_subscriptions ADD COLUMN IF NOT EXISTS store VARCHAR(20)",
        "ALTER TABLE w_premium_subscriptions ADD COLUMN IF NOT EXISTS store_product_id VARCHAR(100)",
        "ALTER TABLE w_premium_subscriptions ADD COLUMN IF NOT EXISTS store_transaction_id VARCHAR(200)",
        "ALTER TABLE w_premium_subscriptions ADD COLUMN IF NOT EXISTS store_receipt TEXT",
        "ALTER TABLE w_premium_subscriptions ADD COLUMN IF NOT EXISTS rc_subscriber_id VARCHAR(200)",
        # Seed USD pricing into existing coin packages (if any exist)
        "UPDATE w_coin_packages SET price_usd_cents = 99,  store_product_id = 'wiamcoins_100'  WHERE coins = 100  AND price_usd_cents = 0",
        "UPDATE w_coin_packages SET price_usd_cents = 499, store_product_id = 'wiamcoins_550'  WHERE coins = 500  AND price_usd_cents = 0",
        "UPDATE w_coin_packages SET price_usd_cents = 999, store_product_id = 'wiamcoins_1200' WHERE coins = 1000 AND price_usd_cents = 0",
        "UPDATE w_coin_packages SET price_usd_cents = 1999,store_product_id = 'wiamcoins_2600' WHERE coins = 2000 AND price_usd_cents = 0",
        "UPDATE w_coin_packages SET price_usd_cents = 4999,store_product_id = 'wiamcoins_7000' WHERE coins = 5000 AND price_usd_cents = 0",
        # v6-IAP: Growth feature columns on users
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_bonus_claimed BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_reward TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_reward_streak INTEGER DEFAULT 0",
        # Team account system — dedicated work accounts for team members
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_team_account BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS team_role_slug TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS team_created_by INTEGER",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS team_created_at TIMESTAMP",
        # WIAMid secure team login — rotating 12-char ID
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS team_wiam_id_hash TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS team_personal_email TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id_issued_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id_expires_at TIMESTAMP",
        "ALTER TABLE w_application_responses ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE",
        """CREATE TABLE IF NOT EXISTS w_team_id_history (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            wiam_id_hash TEXT NOT NULL,
            issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
            expired_at TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE
        )""",
        "CREATE INDEX IF NOT EXISTS idx_tih_user ON w_team_id_history (user_id)",
        # v7: Expo Push Notifications for native mobile app
        """CREATE TABLE IF NOT EXISTS w_expo_push_tokens (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            token TEXT NOT NULL UNIQUE,
            device_name TEXT,
            platform VARCHAR(10),
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS idx_expo_push_user ON w_expo_push_tokens (user_id)",
        # ── Creator Subscriptions (readers subscribe to creators) ──
        """CREATE TABLE IF NOT EXISTS w_creator_sub_tiers (
            id SERIAL PRIMARY KEY,
            creator_id BIGINT NOT NULL,
            name TEXT NOT NULL DEFAULT 'Supporter',
            description TEXT DEFAULT '',
            price_ghs REAL NOT NULL DEFAULT 5.0,
            perk_subscriber_posts BOOLEAN DEFAULT TRUE,
            perk_early_access_hours INTEGER DEFAULT 0,
            perk_badge BOOLEAN DEFAULT TRUE,
            perk_author_notes BOOLEAN DEFAULT FALSE,
            perk_no_ads BOOLEAN DEFAULT TRUE,
            perk_priority_comments BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            paused_reason TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS idx_cst_creator ON w_creator_sub_tiers (creator_id)",
        "ALTER TABLE w_creator_sub_tiers ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly'",
        "ALTER TABLE w_creator_sub_tiers ADD COLUMN IF NOT EXISTS yearly_price_ghs REAL",
        """CREATE TABLE IF NOT EXISTS w_creator_subscriptions (
            id SERIAL PRIMARY KEY,
            subscriber_id BIGINT NOT NULL,
            creator_id BIGINT NOT NULL,
            tier_id INTEGER NOT NULL REFERENCES w_creator_sub_tiers(id),
            status VARCHAR(20) DEFAULT 'active',
            paused_reason TEXT,
            auto_renew BOOLEAN DEFAULT TRUE,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            cancelled_at TIMESTAMP,
            paystack_sub_code VARCHAR(100),
            paystack_reference VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS idx_csub_subscriber ON w_creator_subscriptions (subscriber_id)",
        "CREATE INDEX IF NOT EXISTS idx_csub_creator ON w_creator_subscriptions (creator_id)",
        "CREATE INDEX IF NOT EXISTS idx_csub_status ON w_creator_subscriptions (status)",
        """CREATE TABLE IF NOT EXISTS w_creator_sub_earnings (
            id SERIAL PRIMARY KEY,
            creator_id BIGINT NOT NULL,
            subscriber_id BIGINT NOT NULL,
            subscription_id INTEGER NOT NULL REFERENCES w_creator_subscriptions(id),
            amount_ghs REAL NOT NULL,
            creator_share_ghs REAL NOT NULL,
            platform_share_ghs REAL NOT NULL,
            period_start TIMESTAMP NOT NULL,
            period_end TIMESTAMP NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS idx_cse_creator ON w_creator_sub_earnings (creator_id)",
        "CREATE INDEX IF NOT EXISTS idx_cse_status ON w_creator_sub_earnings (status)",
        # Bulletin: subscriber-only posts + subscriber author notes on chapters
        "ALTER TABLE w_bulletin_posts ADD COLUMN IF NOT EXISTS is_subscriber_only BOOLEAN DEFAULT FALSE",
        "ALTER TABLE web_book_content ADD COLUMN IF NOT EXISTS subscriber_note TEXT",
        "ALTER TABLE web_book_content ADD COLUMN IF NOT EXISTS early_access_until TIMESTAMP",
        # ── Reading Lists ──
        """CREATE TABLE IF NOT EXISTS w_reading_lists (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            name TEXT NOT NULL DEFAULT 'My List',
            description TEXT DEFAULT '',
            is_public BOOLEAN DEFAULT TRUE,
            cover_book_id INTEGER,
            item_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS idx_rl_user ON w_reading_lists (user_id)",
        """CREATE TABLE IF NOT EXISTS w_reading_list_items (
            id SERIAL PRIMARY KEY,
            list_id INTEGER NOT NULL REFERENCES w_reading_lists(id) ON DELETE CASCADE,
            content_id INTEGER NOT NULL,
            sort_order INTEGER DEFAULT 0,
            note TEXT DEFAULT '',
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (list_id, content_id)
        )""",
        "CREATE INDEX IF NOT EXISTS idx_rli_list ON w_reading_list_items (list_id)",
        # ── Reader Badges ──
        """CREATE TABLE IF NOT EXISTS w_reader_badges (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            badge_key TEXT NOT NULL,
            badge_name TEXT NOT NULL,
            badge_icon TEXT DEFAULT 'star',
            badge_color TEXT DEFAULT '#d4a843',
            badge_description TEXT DEFAULT '',
            earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, badge_key)
        )""",
        "CREATE INDEX IF NOT EXISTS idx_rb_user ON w_reader_badges (user_id)",
        # ── Auth Gate — block login/registration independently ──
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS auth_login_blocked BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS auth_registration_blocked BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS auth_login_blocked_until TIMESTAMP",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS auth_registration_blocked_until TIMESTAMP",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS auth_login_blocked_message TEXT DEFAULT 'Login is temporarily disabled. Please try again later.'",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS auth_registration_blocked_message TEXT DEFAULT 'Registration is temporarily closed. Please try again later.'",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS auth_gate_updated_by BIGINT",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS auth_gate_updated_at TIMESTAMP",
        # ── WiamVox: voice stories (isolated from book content) ──
        "ALTER TABLE w_coin_transactions ADD COLUMN IF NOT EXISTS voice_story_id INTEGER",
        "ALTER TABLE w_coin_transactions ADD COLUMN IF NOT EXISTS voice_moment_id INTEGER",
        """CREATE TABLE IF NOT EXISTS w_voice_stories (
            id SERIAL PRIMARY KEY,
            creator_wiam_id BIGINT NOT NULL,
            title TEXT NOT NULL DEFAULT 'Untitled',
            description TEXT DEFAULT '',
            cover_url TEXT,
            emotion_tag TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'draft',
            is_locked BOOLEAN DEFAULT FALSE,
            unlock_price_coins INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            published_at TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS idx_voice_stories_creator ON w_voice_stories (creator_wiam_id)",
        "CREATE INDEX IF NOT EXISTS idx_voice_stories_status_pub ON w_voice_stories (status, published_at DESC)",
        """CREATE TABLE IF NOT EXISTS w_voice_moments (
            id SERIAL PRIMARY KEY,
            story_id INTEGER NOT NULL REFERENCES w_voice_stories(id) ON DELETE CASCADE,
            audio_url TEXT NOT NULL,
            duration_seconds REAL DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS idx_voice_moments_story ON w_voice_moments (story_id, sort_order)",
        """CREATE TABLE IF NOT EXISTS w_voice_moment_likes (
            id SERIAL PRIMARY KEY,
            moment_id INTEGER NOT NULL REFERENCES w_voice_moments(id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (moment_id, user_id)
        )""",
        "CREATE INDEX IF NOT EXISTS idx_voice_mlikes_moment ON w_voice_moment_likes (moment_id)",
        """CREATE TABLE IF NOT EXISTS w_voice_moment_comments (
            id SERIAL PRIMARY KEY,
            moment_id INTEGER NOT NULL REFERENCES w_voice_moments(id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL,
            text TEXT NOT NULL,
            is_deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS idx_voice_mcomments_moment ON w_voice_moment_comments (moment_id)",
        """CREATE TABLE IF NOT EXISTS w_voice_story_saves (
            id SERIAL PRIMARY KEY,
            story_id INTEGER NOT NULL REFERENCES w_voice_stories(id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (story_id, user_id)
        )""",
        "CREATE INDEX IF NOT EXISTS idx_voice_saves_user ON w_voice_story_saves (user_id)",
        """CREATE TABLE IF NOT EXISTS w_voice_story_unlocks (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            story_id INTEGER NOT NULL REFERENCES w_voice_stories(id) ON DELETE CASCADE,
            coins_spent INTEGER NOT NULL DEFAULT 0,
            creator_wiam_id BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, story_id)
        )""",
        "CREATE INDEX IF NOT EXISTS idx_voice_unlocks_story ON w_voice_story_unlocks (story_id)",
        "ALTER TABLE w_voice_stories ADD COLUMN IF NOT EXISTS listen_count INTEGER NOT NULL DEFAULT 0",
        """CREATE TABLE IF NOT EXISTS w_voice_listen_day_buckets (
            id SERIAL PRIMARY KEY,
            story_id INTEGER NOT NULL REFERENCES w_voice_stories(id) ON DELETE CASCADE,
            bucket_key TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (story_id, bucket_key)
        )""",
        "CREATE INDEX IF NOT EXISTS idx_voice_listen_day_story ON w_voice_listen_day_buckets (story_id)",
        """CREATE TABLE IF NOT EXISTS w_voice_listen_progress (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            story_id INTEGER NOT NULL REFERENCES w_voice_stories(id) ON DELETE CASCADE,
            moment_id INTEGER REFERENCES w_voice_moments(id) ON DELETE SET NULL,
            position_seconds REAL NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, story_id)
        )""",
        "CREATE INDEX IF NOT EXISTS idx_voice_listen_prog_user ON w_voice_listen_progress (user_id, updated_at)",
        """CREATE TABLE IF NOT EXISTS w_voice_listen_presence (
            id SERIAL PRIMARY KEY,
            story_id INTEGER NOT NULL REFERENCES w_voice_stories(id) ON DELETE CASCADE,
            client_id TEXT NOT NULL,
            user_id BIGINT,
            last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (story_id, client_id)
        )""",
        "CREATE INDEX IF NOT EXISTS idx_voice_presence_story_seen ON w_voice_listen_presence (story_id, last_seen_at)",
        """CREATE TABLE IF NOT EXISTS w_voice_room_messages (
            id SERIAL PRIMARY KEY,
            story_id INTEGER NOT NULL REFERENCES w_voice_stories(id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS idx_voice_room_story_created ON w_voice_room_messages (story_id, created_at DESC)",
        # Push 3 — Per-chapter first-publish timestamp (publish parity).
        "ALTER TABLE w_book_content ADD COLUMN IF NOT EXISTS published_at TIMESTAMP",
        # Push 4 — Per-book popularity score (denormalized, recomputed lazily).
        """CREATE TABLE IF NOT EXISTS w_book_popularity (
            content_id INTEGER PRIMARY KEY,
            score DOUBLE PRECISION DEFAULT 0 NOT NULL,
            view_score DOUBLE PRECISION DEFAULT 0 NOT NULL,
            rating_score DOUBLE PRECISION DEFAULT 0 NOT NULL,
            favorite_score DOUBLE PRECISION DEFAULT 0 NOT NULL,
            freshness_score DOUBLE PRECISION DEFAULT 0 NOT NULL,
            chapter_score DOUBLE PRECISION DEFAULT 0 NOT NULL,
            recent_views_30d INTEGER DEFAULT 0,
            total_views INTEGER DEFAULT 0,
            rating_count INTEGER DEFAULT 0,
            avg_rating DOUBLE PRECISION DEFAULT 0,
            favorite_count INTEGER DEFAULT 0,
            chapter_count INTEGER DEFAULT 0,
            age_days INTEGER DEFAULT 0,
            computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_book_popularity_score ON w_book_popularity (score DESC)",
        "CREATE INDEX IF NOT EXISTS ix_book_popularity_view_score ON w_book_popularity (view_score DESC)",
        "CREATE INDEX IF NOT EXISTS ix_book_popularity_rating_score ON w_book_popularity (rating_score DESC)",
        "CREATE INDEX IF NOT EXISTS ix_book_popularity_freshness_score ON w_book_popularity (freshness_score DESC)",
        # Push 1 — Analytics event log (deep tracking foundation)
        """CREATE TABLE IF NOT EXISTS w_analytics_events (
            id BIGSERIAL PRIMARY KEY,
            event_type TEXT NOT NULL,
            user_id INTEGER,
            content_id INTEGER,
            chapter_number INTEGER,
            section_key TEXT,
            metadata_json TEXT,
            client TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_analytics_events_type_created ON w_analytics_events (event_type, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS ix_analytics_events_content_created ON w_analytics_events (content_id, created_at DESC) WHERE content_id IS NOT NULL",
        "CREATE INDEX IF NOT EXISTS ix_analytics_events_user_created ON w_analytics_events (user_id, created_at DESC) WHERE user_id IS NOT NULL",

        # Push 7 — WiamStudio V2 schema (Universe / Series / Arc / Pro /
        # CreatorSettings / AISuggestion). All optional — existing creators
        # see no change unless they opt into V2 surfaces. Manual Supabase
        # snapshot was taken before deploying this migration; see
        # docs/AGENT_MEMORY.md for the snapshot id.
        """CREATE TABLE IF NOT EXISTS w_universes (
            id SERIAL PRIMARY KEY,
            creator_wiam_id BIGINT NOT NULL,
            title TEXT NOT NULL,
            slug TEXT,
            description TEXT DEFAULT '',
            cover_url TEXT,
            accent_color TEXT,
            visibility TEXT DEFAULT 'public',
            is_locked BOOLEAN DEFAULT FALSE,
            unlock_price_coins INTEGER,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_universes_creator ON w_universes (creator_wiam_id)",
        "CREATE INDEX IF NOT EXISTS ix_universes_slug ON w_universes (slug) WHERE slug IS NOT NULL",

        # WiamEpisio Phase 1 — rename legacy w_series → w_story_bundles FIRST (before CREATE)
        """DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'w_series')
               AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'w_story_bundles') THEN
                ALTER TABLE w_series RENAME TO w_story_bundles;
            END IF;
        END $$""",
        """DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'w_series_content')
               AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'w_story_bundle_items') THEN
                ALTER TABLE w_series_content RENAME TO w_story_bundle_items;
            END IF;
        END $$""",
        """DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name = 'w_story_bundle_items' AND column_name = 'series_id'
            ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name = 'w_story_bundle_items' AND column_name = 'story_bundle_id'
            ) THEN
                ALTER TABLE w_story_bundle_items RENAME COLUMN series_id TO story_bundle_id;
            END IF;
        END $$""",

        """CREATE TABLE IF NOT EXISTS w_story_bundles (
            id SERIAL PRIMARY KEY,
            creator_wiam_id BIGINT NOT NULL,
            universe_id INTEGER REFERENCES w_universes(id) ON DELETE SET NULL,
            title TEXT NOT NULL,
            slug TEXT,
            description TEXT DEFAULT '',
            cover_url TEXT,
            accent_color TEXT,
            visibility TEXT DEFAULT 'public',
            is_locked BOOLEAN DEFAULT FALSE,
            unlock_price_coins INTEGER,
            sort_order INTEGER DEFAULT 0,
            status TEXT DEFAULT 'ongoing',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_story_bundle_creator ON w_story_bundles (creator_wiam_id)",
        "CREATE INDEX IF NOT EXISTS ix_story_bundle_universe ON w_story_bundles (universe_id)",
        "CREATE INDEX IF NOT EXISTS ix_story_bundle_slug ON w_story_bundles (slug) WHERE slug IS NOT NULL",

        """CREATE TABLE IF NOT EXISTS w_story_bundle_items (
            id SERIAL PRIMARY KEY,
            story_bundle_id INTEGER NOT NULL REFERENCES w_story_bundles(id) ON DELETE CASCADE,
            content_id INTEGER NOT NULL,
            sort_order INTEGER DEFAULT 0 NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            CONSTRAINT uq_story_bundle_content UNIQUE (story_bundle_id, content_id)
        )""",
        "CREATE INDEX IF NOT EXISTS ix_story_bundle_items_bundle ON w_story_bundle_items (story_bundle_id)",
        "CREATE INDEX IF NOT EXISTS ix_story_bundle_items_content ON w_story_bundle_items (content_id)",

        # If both old and new tables existed somehow, skip; if rename left old empty names, OK.
        # After rename from w_series, ensure new indexes exist (CREATE IF NOT EXISTS above covers fresh installs).

        """CREATE TABLE IF NOT EXISTS w_arcs (
            id SERIAL PRIMARY KEY,
            content_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0 NOT NULL,
            start_chapter INTEGER,
            end_chapter INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_arcs_content ON w_arcs (content_id)",

        """CREATE TABLE IF NOT EXISTS w_studio_pro_subscriptions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            plan TEXT DEFAULT 'monthly',
            status TEXT DEFAULT 'active',
            source TEXT DEFAULT 'manual',
            revenuecat_user_id TEXT,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            current_period_end TIMESTAMP,
            canceled_at TIMESTAMP,
            raw_receipt_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_studio_pro_user ON w_studio_pro_subscriptions (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_studio_pro_status ON w_studio_pro_subscriptions (status)",

        """CREATE TABLE IF NOT EXISTS w_creator_settings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            default_unit_label TEXT DEFAULT 'chapter',
            show_universes BOOLEAN DEFAULT FALSE,
            show_series BOOLEAN DEFAULT FALSE,
            show_story_bundles BOOLEAN DEFAULT FALSE,
            show_arcs BOOLEAN DEFAULT FALSE,
            show_scheduling BOOLEAN DEFAULT TRUE,
            show_premium_lock BOOLEAN DEFAULT TRUE,
            show_ai_tools BOOLEAN DEFAULT TRUE,
            beta_studio_v2 BOOLEAN DEFAULT FALSE,
            has_seen_v2_tour BOOLEAN DEFAULT FALSE,
            notif_scheduled_publish BOOLEAN DEFAULT TRUE,
            ai_waitlist BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            CONSTRAINT uq_creator_settings_user UNIQUE (user_id)
        )""",
        # Push 11 — backfill column on existing creator_settings rows
        "ALTER TABLE w_creator_settings ADD COLUMN IF NOT EXISTS ai_waitlist BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_creator_settings ADD COLUMN IF NOT EXISTS show_story_bundles BOOLEAN DEFAULT FALSE",
        """UPDATE w_creator_settings SET show_story_bundles = COALESCE(show_story_bundles, show_series, FALSE)
           WHERE show_story_bundles IS DISTINCT FROM COALESCE(show_series, FALSE)""",

        """CREATE TABLE IF NOT EXISTS w_ai_suggestions (
            id BIGSERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            content_id INTEGER,
            chapter_number INTEGER,
            kind TEXT NOT NULL,
            prompt TEXT,
            output TEXT,
            status TEXT DEFAULT 'queued',
            cost_tokens INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            completed_at TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS ix_ai_suggestions_user_kind ON w_ai_suggestions (user_id, kind)",
        "CREATE INDEX IF NOT EXISTS ix_ai_suggestions_content ON w_ai_suggestions (content_id) WHERE content_id IS NOT NULL",

        # Push 7 — WebBookContent V2 columns (scheduling + grouping). All
        # nullable so legacy rows keep working with no backfill needed.
        "ALTER TABLE w_book_content ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMP",
        "ALTER TABLE w_book_content ADD COLUMN IF NOT EXISTS arc_id INTEGER",
        "ALTER TABLE w_book_content ADD COLUMN IF NOT EXISTS content_kind TEXT",
        "ALTER TABLE w_book_content ADD COLUMN IF NOT EXISTS content_unit_label TEXT",
        "ALTER TABLE w_book_content ADD COLUMN IF NOT EXISTS is_extra BOOLEAN DEFAULT FALSE",
        "CREATE INDEX IF NOT EXISTS ix_book_content_scheduled ON w_book_content (scheduled_publish_at) WHERE scheduled_publish_at IS NOT NULL",
        "CREATE INDEX IF NOT EXISTS ix_book_content_arc ON w_book_content (arc_id) WHERE arc_id IS NOT NULL",

        # WiamEpisio Phase 1 — Content drama fields + episode stack
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'novel'",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS trailer_url TEXT",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS poster_url TEXT",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS total_episodes INTEGER DEFAULT 0",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS free_episode_count INTEGER DEFAULT 5",
        "ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS primary_format TEXT DEFAULT 'text'",

        """CREATE TABLE IF NOT EXISTS w_episodes (
            id SERIAL PRIMARY KEY,
            content_id INTEGER NOT NULL,
            episode_number INTEGER NOT NULL DEFAULT 1,
            title TEXT NOT NULL DEFAULT 'Episode 1',
            synopsis TEXT DEFAULT '',
            video_url TEXT,
            hls_manifest_url TEXT,
            poster_url TEXT,
            trailer_url TEXT,
            duration_seconds INTEGER DEFAULT 0,
            transcode_status TEXT DEFAULT 'queued',
            subtitle_tracks TEXT,
            dub_tracks TEXT,
            is_free BOOLEAN DEFAULT FALSE,
            unlock_price_coins INTEGER DEFAULT 10,
            publish_at TIMESTAMP,
            published BOOLEAN DEFAULT FALSE,
            view_count INTEGER DEFAULT 0,
            avg_watch_pct REAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            CONSTRAINT uq_episode_number UNIQUE (content_id, episode_number)
        )""",
        "CREATE INDEX IF NOT EXISTS ix_episodes_content ON w_episodes (content_id)",
        "CREATE INDEX IF NOT EXISTS ix_episodes_publish ON w_episodes (published, publish_at)",

        """CREATE TABLE IF NOT EXISTS w_watch_progress (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            episode_id INTEGER NOT NULL,
            seconds_watched INTEGER DEFAULT 0,
            completed BOOLEAN DEFAULT FALSE,
            last_watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            CONSTRAINT uq_user_episode_watch UNIQUE (user_id, episode_id)
        )""",
        "CREATE INDEX IF NOT EXISTS ix_watch_progress_user ON w_watch_progress (user_id)",

        """CREATE TABLE IF NOT EXISTS w_episode_unlocks (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            episode_id INTEGER NOT NULL,
            content_id INTEGER NOT NULL,
            coins_spent INTEGER NOT NULL DEFAULT 0,
            creator_id BIGINT NOT NULL,
            unlock_method TEXT DEFAULT 'coins',
            transaction_id INTEGER,
            unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            CONSTRAINT uq_user_episode_unlock UNIQUE (user_id, episode_id)
        )""",
        "CREATE INDEX IF NOT EXISTS ix_episode_unlocks_user ON w_episode_unlocks (user_id)",

        """CREATE TABLE IF NOT EXISTS w_video_assets (
            id SERIAL PRIMARY KEY,
            episode_id INTEGER NOT NULL,
            original_upload_url TEXT,
            processed_renditions TEXT,
            storage_provider TEXT DEFAULT 'stub',
            storage_key TEXT,
            checksum TEXT,
            size_bytes BIGINT DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_video_assets_episode ON w_video_assets (episode_id)",

        """CREATE TABLE IF NOT EXISTS w_creator_video_upload_jobs (
            id SERIAL PRIMARY KEY,
            creator_id BIGINT NOT NULL,
            episode_id INTEGER,
            upload_status TEXT DEFAULT 'pending',
            transcode_job_id TEXT,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_video_upload_jobs_creator ON w_creator_video_upload_jobs (creator_id)",
        "CREATE INDEX IF NOT EXISTS ix_video_upload_jobs_episode ON w_creator_video_upload_jobs (episode_id)",

        # WiamEpisio Pre-HTML — catalog, trailer QA, rankings, FX, coin bands
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS catalog_shelf TEXT DEFAULT 'standard'",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS is_wiam_origin BOOLEAN DEFAULT FALSE",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS is_vip_series BOOLEAN DEFAULT FALSE",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS planned_episode_count INTEGER DEFAULT 0",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS is_series_complete BOOLEAN DEFAULT FALSE",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS structure_mode TEXT DEFAULT 'series'",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS season_number INTEGER DEFAULT 1",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS show_group_key TEXT",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS season_locked BOOLEAN DEFAULT FALSE",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS season_locked_at TIMESTAMP",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS season_locked_by BIGINT",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS rights_confirmed BOOLEAN DEFAULT FALSE",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS banner_url TEXT",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS season_qc_status TEXT DEFAULT 'none'",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS review_change_items TEXT DEFAULT '[]'",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMP",
        "ALTER TABLE w_episodes ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_quality_pipeline BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_qc_technical BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_qc_visual BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_qc_audio BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_qc_vmaf BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_qc_ssim BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_qc_scenedetect BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_qc_vad BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_qc_phash BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_qc_watermark BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_qc_blackdetect BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_qc_integrity BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_qc_auto_reject_poor BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_qc_auto_clear_good BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_season_qc_sla_auto_decide BOOLEAN DEFAULT TRUE",
        """CREATE TABLE IF NOT EXISTS w_content_fingerprints (
            id SERIAL PRIMARY KEY,
            content_id INTEGER NOT NULL,
            episode_id INTEGER,
            asset_kind TEXT DEFAULT 'episode',
            phash_value TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_content_fp_content ON w_content_fingerprints (content_id)",
        "CREATE INDEX IF NOT EXISTS ix_content_fp_phash ON w_content_fingerprints (phash_value)",
        """CREATE TABLE IF NOT EXISTS w_series_revision_requests (
            id SERIAL PRIMARY KEY,
            content_id INTEGER NOT NULL,
            requested_by BIGINT NOT NULL,
            target_kind TEXT NOT NULL,
            episode_id INTEGER,
            episode_number INTEGER,
            category TEXT NOT NULL,
            reason TEXT NOT NULL DEFAULT '',
            replacement_storage_key TEXT,
            replacement_meta_json TEXT DEFAULT '{}',
            status TEXT DEFAULT 'pending',
            reviewer_note TEXT DEFAULT '',
            decided_by BIGINT,
            decided_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_revision_req_content ON w_series_revision_requests (content_id)",
        "CREATE INDEX IF NOT EXISTS ix_revision_req_status ON w_series_revision_requests (status)",
        "ALTER TABLE w_episodes ADD COLUMN IF NOT EXISTS upload_probe_json TEXT DEFAULT '{}'",
        "ALTER TABLE w_episodes ADD COLUMN IF NOT EXISTS asset_qc_status TEXT DEFAULT 'none'",
        "ALTER TABLE w_episodes ADD COLUMN IF NOT EXISTS asset_qc_band TEXT",
        """CREATE TABLE IF NOT EXISTS w_season_quality_jobs (
            id SERIAL PRIMARY KEY,
            content_id INTEGER NOT NULL,
            status TEXT DEFAULT 'queued',
            overall_band TEXT,
            overall_score REAL DEFAULT 0,
            assets_total INTEGER DEFAULT 0,
            assets_passed INTEGER DEFAULT 0,
            assets_failed INTEGER DEFAULT 0,
            assets_borderline INTEGER DEFAULT 0,
            summary_json TEXT DEFAULT '{}',
            failure_reasons TEXT DEFAULT '',
            founder_decision TEXT,
            founder_note TEXT DEFAULT '',
            decided_by BIGINT,
            decided_at TIMESTAMP,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_season_qc_jobs_content ON w_season_quality_jobs (content_id)",
        "CREATE INDEX IF NOT EXISTS ix_season_qc_jobs_status ON w_season_quality_jobs (status)",
        """CREATE TABLE IF NOT EXISTS w_season_asset_quality_reports (
            id SERIAL PRIMARY KEY,
            job_id INTEGER NOT NULL,
            content_id INTEGER NOT NULL,
            asset_kind TEXT NOT NULL,
            episode_id INTEGER,
            episode_number INTEGER,
            status TEXT DEFAULT 'pending',
            band TEXT,
            score REAL DEFAULT 0,
            checks_json TEXT DEFAULT '{}',
            failure_reasons TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_season_asset_qc_job ON w_season_asset_quality_reports (job_id)",
        "CREATE INDEX IF NOT EXISTS ix_season_asset_qc_episode ON w_season_asset_quality_reports (episode_id)",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS trailer_storage_key TEXT",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS trailer_hls_url TEXT",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS trailer_poster_url TEXT",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS trailer_duration_seconds INTEGER DEFAULT 0",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS trailer_qa_status TEXT DEFAULT 'none'",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS trailer_qa_score REAL",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS trailer_qa_checked_at TIMESTAMP",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS coin_band TEXT DEFAULT 'standard'",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS ranking_score REAL DEFAULT 0",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS ranking_updated_at TIMESTAMP",

        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_trailer_quality_gate BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_require_complete_series BOOLEAN DEFAULT TRUE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS ff_vip_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS money_base_currency TEXT DEFAULT 'USD'",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS vip_daily_stipend_coins INTEGER DEFAULT 30",
        "ALTER TABLE w_platform_config ADD COLUMN IF NOT EXISTS vip_unlock_discount_pct REAL DEFAULT 25.0",

        "ALTER TABLE genres ADD COLUMN IF NOT EXISTS product TEXT DEFAULT 'legacy'",
        "ALTER TABLE genres ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0",
        "ALTER TABLE genres ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",

        """CREATE TABLE IF NOT EXISTS w_series_comments (
            id SERIAL PRIMARY KEY,
            content_id INTEGER NOT NULL,
            user_id BIGINT NOT NULL,
            body TEXT NOT NULL,
            parent_id INTEGER,
            is_deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_series_comments_content ON w_series_comments (content_id, created_at)",

        "ALTER TABLE w_creator_video_upload_jobs ADD COLUMN IF NOT EXISTS content_id INTEGER",
        "ALTER TABLE w_creator_video_upload_jobs ADD COLUMN IF NOT EXISTS asset_kind TEXT DEFAULT 'episode'",

        """CREATE TABLE IF NOT EXISTS w_trailer_quality_reports (
            id SERIAL PRIMARY KEY,
            content_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            overall_score REAL DEFAULT 0,
            checks_json TEXT DEFAULT '{}',
            failure_reasons TEXT DEFAULT '',
            auto_checked BOOLEAN DEFAULT TRUE,
            reviewed_by BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_trailer_qa_content ON w_trailer_quality_reports (content_id)",

        """CREATE TABLE IF NOT EXISTS w_featured_trailer_slots (
            id SERIAL PRIMARY KEY,
            slot_key TEXT NOT NULL,
            content_id INTEGER NOT NULL,
            sort_order INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            curated_by BIGINT,
            note TEXT DEFAULT '',
            badge_label TEXT DEFAULT '',
            media_mode TEXT DEFAULT 'trailer',
            starts_at TIMESTAMP,
            ends_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_featured_trailer_slot ON w_featured_trailer_slots (slot_key, is_active)",
        "ALTER TABLE w_featured_trailer_slots ADD COLUMN IF NOT EXISTS badge_label TEXT DEFAULT ''",
        "ALTER TABLE w_featured_trailer_slots ADD COLUMN IF NOT EXISTS media_mode TEXT DEFAULT 'trailer'",

        """CREATE TABLE IF NOT EXISTS w_coin_price_bands (
            id SERIAL PRIMARY KEY,
            band_key TEXT NOT NULL UNIQUE,
            label TEXT DEFAULT '',
            unlock_coins INTEGER NOT NULL DEFAULT 10,
            min_coins INTEGER DEFAULT 5,
            max_coins INTEGER DEFAULT 30,
            is_active BOOLEAN DEFAULT TRUE,
            sort_order INTEGER DEFAULT 0
        )""",

        """CREATE TABLE IF NOT EXISTS w_fx_rates (
            id SERIAL PRIMARY KEY,
            currency_code TEXT NOT NULL UNIQUE,
            rate_per_usd REAL NOT NULL DEFAULT 1.0,
            symbol TEXT DEFAULT '',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",

        """CREATE TABLE IF NOT EXISTS w_series_ranking_snapshots (
            id SERIAL PRIMARY KEY,
            content_id INTEGER NOT NULL,
            period_key TEXT NOT NULL,
            rank_position INTEGER NOT NULL DEFAULT 0,
            score REAL DEFAULT 0,
            metrics_json TEXT DEFAULT '{}',
            computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_ranking_period ON w_series_ranking_snapshots (period_key, rank_position)",

        # WiamEpisio Studio + Remind + Apply (E2E build)
        """CREATE TABLE IF NOT EXISTS w_episio_creator_applications (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            legal_name TEXT DEFAULT '',
            country TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            channel_name TEXT DEFAULT '',
            bio TEXT DEFAULT '',
            genres_json TEXT DEFAULT '[]',
            pitch TEXT DEFAULT '',
            planned_episode_count INTEGER DEFAULT 20,
            sample_type TEXT DEFAULT '',
            sample_url TEXT DEFAULT '',
            rights_attested BOOLEAN DEFAULT FALSE,
            complete_series_attested BOOLEAN DEFAULT FALSE,
            status TEXT DEFAULT 'pending',
            reviewer_note TEXT DEFAULT '',
            decided_by BIGINT,
            decided_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_episio_apply_user ON w_episio_creator_applications (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_episio_apply_status ON w_episio_creator_applications (status)",

        """CREATE TABLE IF NOT EXISTS w_episio_creator_invites (
            id SERIAL PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            created_by BIGINT,
            note TEXT DEFAULT '',
            max_uses INTEGER DEFAULT 1,
            use_count INTEGER DEFAULT 0,
            active BOOLEAN DEFAULT TRUE,
            expires_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_episio_invite_code ON w_episio_creator_invites (code)",

        """CREATE TABLE IF NOT EXISTS w_episio_creator_invite_redemptions (
            id SERIAL PRIMARY KEY,
            invite_id INTEGER NOT NULL,
            user_id BIGINT NOT NULL,
            redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            CONSTRAINT uq_episio_invite_user UNIQUE (invite_id, user_id)
        )""",

        """CREATE TABLE IF NOT EXISTS w_episio_creator_public_profiles (
            user_id BIGINT PRIMARY KEY,
            channel_name TEXT DEFAULT '',
            tagline TEXT DEFAULT '',
            bio TEXT DEFAULT '',
            country TEXT DEFAULT '',
            city TEXT DEFAULT '',
            website_url TEXT DEFAULT '',
            instagram TEXT DEFAULT '',
            tiktok TEXT DEFAULT '',
            youtube TEXT DEFAULT '',
            twitter_x TEXT DEFAULT '',
            facebook TEXT DEFAULT '',
            avatar_url TEXT DEFAULT '',
            banner_url TEXT DEFAULT '',
            genres_json TEXT DEFAULT '[]',
            contact_email_public TEXT DEFAULT '',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",

        """CREATE TABLE IF NOT EXISTS w_series_reminders (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            content_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            CONSTRAINT uq_user_series_remind UNIQUE (user_id, content_id)
        )""",
        "CREATE INDEX IF NOT EXISTS ix_series_remind_content ON w_series_reminders (content_id)",

        """CREATE TABLE IF NOT EXISTS w_watch_episode_rewards (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            episode_id INTEGER NOT NULL,
            coins INTEGER NOT NULL DEFAULT 2,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            CONSTRAINT uq_watch_ep_reward UNIQUE (user_id, episode_id)
        )""",
        "CREATE INDEX IF NOT EXISTS ix_watch_ep_reward_user ON w_watch_episode_rewards (user_id)",

        """CREATE TABLE IF NOT EXISTS w_ad_coin_claims (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            claim_date DATE NOT NULL,
            claim_count INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT uq_ad_coin_day UNIQUE (user_id, claim_date)
        )""",

        """CREATE TABLE IF NOT EXISTS w_series_finish_rewards (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            series_id INTEGER NOT NULL,
            coins INTEGER NOT NULL DEFAULT 15,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            CONSTRAINT uq_series_finish_user UNIQUE (user_id, series_id)
        )""",
        "CREATE INDEX IF NOT EXISTS ix_series_finish_user ON w_series_finish_rewards (user_id, created_at)",

        """CREATE TABLE IF NOT EXISTS w_friend_invite_bonuses (
            id SERIAL PRIMARY KEY,
            referrer_id BIGINT NOT NULL,
            referred_id BIGINT NOT NULL,
            coins INTEGER NOT NULL DEFAULT 20,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            CONSTRAINT uq_friend_invite_pair UNIQUE (referrer_id, referred_id)
        )""",
        "CREATE INDEX IF NOT EXISTS ix_friend_invite_referrer ON w_friend_invite_bonuses (referrer_id, created_at)",

        """CREATE TABLE IF NOT EXISTS w_genre_requests (
            id SERIAL PRIMARY KEY,
            creator_id BIGINT NOT NULL,
            name TEXT NOT NULL,
            note TEXT DEFAULT '',
            status TEXT DEFAULT 'pending',
            decided_by BIGINT,
            decided_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_genre_req_status ON w_genre_requests (status)",

        # Supabase advisor: public tables must have RLS (Flask owner role bypasses it)
        "ALTER TABLE IF EXISTS w_watch_episode_rewards ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE IF EXISTS w_ad_coin_claims ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE IF EXISTS w_series_finish_rewards ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE IF EXISTS w_friend_invite_bonuses ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE IF EXISTS w_genre_requests ENABLE ROW LEVEL SECURITY",
    ]
    engine = db.engine
    with engine.connect() as conn:
        for stmt in statements:
            try:
                conn.execute(db.text(stmt))
                conn.commit()
            except Exception as e:
                conn.rollback()
                log.warning("Migration skip: %s", str(e)[:120])


def create_app():
    app = Flask(
        __name__,
        template_folder=os.path.join(os.path.dirname(__file__), 'templates'),
        static_folder=os.path.join(os.path.dirname(__file__), 'static'),
    )
    app.config.from_object(Config)

    # Custom Jinja2 filters
    import json as _json
    app.jinja_env.filters['from_json'] = lambda s: _json.loads(s) if s else {}

    # ── Sentry error monitoring (B-04) ──
    _sentry_dsn = os.environ.get('SENTRY_DSN')
    if _sentry_dsn:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.flask import FlaskIntegration
            sentry_sdk.init(
                dsn=_sentry_dsn,
                integrations=[FlaskIntegration()],
                traces_sample_rate=0.1,
                send_default_pii=False,
                environment=os.environ.get('FLASK_ENV', 'production'),
            )
            log.info("Sentry error monitoring initialized")
        except Exception as e:
            log.warning("Sentry init failed: %s", e)

    # ── Cloudinary status (Push 1) ──
    # Loud startup line so production immediately tells us whether image
    # uploads will work or silently 500. Render env must have all three
    # CLOUDINARY_* keys for avatar / cover / inline-image upload to succeed.
    _cdn_name = (os.environ.get('CLOUDINARY_CLOUD_NAME') or '').strip()
    _cdn_key = (os.environ.get('CLOUDINARY_API_KEY') or '').strip()
    _cdn_secret = (os.environ.get('CLOUDINARY_API_SECRET') or '').strip()
    if _cdn_name and _cdn_key and _cdn_secret:
        log.info("Cloudinary configured: cloud_name=%s", _cdn_name)
    else:
        missing = [k for k, v in (
            ('CLOUDINARY_CLOUD_NAME', _cdn_name),
            ('CLOUDINARY_API_KEY', _cdn_key),
            ('CLOUDINARY_API_SECRET', _cdn_secret),
        ) if not v]
        log.warning(
            "Cloudinary NOT configured — image uploads will fail. Missing env: %s",
            ', '.join(missing) or 'unknown',
        )

    # Trust reverse proxy headers (X-Forwarded-For, -Proto, -Host)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    # Extensions
    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)
    limiter.init_app(app)

    # Register blueprints
    from .auth import auth_bp
    from .routes.home import home_bp
    from .routes.browse import browse_bp
    from .routes.book import book_bp
    from .routes.library import library_bp
    from .routes.api import api_bp
    from .routes.creator import creator_bp
    from .routes.profile import profile_bp
    from .routes.founder import founder_bp
    from .routes.admin_dash import admin_dash_bp
    from .routes.creator_dash import creator_dash_bp
    from .routes.studio import studio_bp
    from .routes.payment import payment_bp
    from .routes.notifications import notifications_bp
    from .routes.seo import seo_bp
    from .routes.bulletin import bulletin_bp
    from .routes.reader_api import reader_api
    from .routes.creator_sub import creator_sub_bp

    # EPISIO_SLIM=1 (default): skip heavy / non-Episio surfaces to keep boot light.
    # Set EPISIO_SLIM=0 on Render to re-enable Classics, Voice, WiamBot, Elite web, Programs, Gifts.
    # Tables are NEVER dropped — only route registration is skipped.
    _episio_slim = (os.environ.get('EPISIO_SLIM') or '1').strip().lower() in ('1', 'true', 'yes', 'on')

    app.register_blueprint(auth_bp)
    app.register_blueprint(home_bp)
    app.register_blueprint(browse_bp, url_prefix='/browse')
    app.register_blueprint(book_bp, url_prefix='/book')
    app.register_blueprint(library_bp, url_prefix='/library')
    app.register_blueprint(api_bp)
    app.register_blueprint(creator_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(founder_bp)
    app.register_blueprint(admin_dash_bp)
    app.register_blueprint(creator_dash_bp)
    app.register_blueprint(studio_bp)
    app.register_blueprint(payment_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(seo_bp)
    app.register_blueprint(bulletin_bp)
    app.register_blueprint(reader_api)
    app.register_blueprint(creator_sub_bp)

    from .routes.apply import apply_bp
    app.register_blueprint(apply_bp)

    from .routes.team import team_bp
    app.register_blueprint(team_bp)

    from .routes.editor_studio import editor_studio_bp
    app.register_blueprint(editor_studio_bp)

    from .routes.premium import premium_bp
    app.register_blueprint(premium_bp)

    from .routes.dashboard import dashboard_bp
    app.register_blueprint(dashboard_bp)

    from .routes.api_v1 import api_v1
    app.register_blueprint(api_v1)

    # WiamEpisio — drama Series / Episode / Watch + catalog
    from .routes.episode_api import episode_api
    app.register_blueprint(episode_api)
    from .routes.episio_catalog_api import episio_catalog_api
    app.register_blueprint(episio_catalog_api)
    from .routes.episio_studio_api import episio_studio_api
    app.register_blueprint(episio_studio_api)
    try:
        from .services.coin_pricing import ensure_default_bands
        from .services.currency_display import ensure_default_fx
        with app.app_context():
            ensure_default_bands()
            ensure_default_fx()
    except Exception as _seed_err:
        log.warning('Episio seed bands/fx skipped: %s', _seed_err)

    # Studio V2 (video/creator money path) — keep
    from .routes.studio_v2_api import studio_v2_bp
    app.register_blueprint(studio_v2_bp)

    if _episio_slim:
        log.info(
            'EPISIO_SLIM=on — not registering: gift, elite, wiambot, programs, voice, classics '
            '(set EPISIO_SLIM=0 to restore; DB tables untouched)'
        )
    else:
        from .routes.gift import gift_bp
        from .routes.elite import elite_bp
        from .routes.wiambot import bot_bp
        from .routes.programs import programs_bp
        from .routes.voice_api import voice_bp
        from .routes.classics import classics_bp
        app.register_blueprint(gift_bp)
        app.register_blueprint(elite_bp)
        app.register_blueprint(bot_bp)
        app.register_blueprint(programs_bp)
        app.register_blueprint(voice_bp)
        app.register_blueprint(classics_bp)

    # CORS: allow frontend to call /api/v1/*
    CORS(app, resources={r'/api/v1/*': {'origins': [
        'https://wiamapp.com',
        'https://www.wiamapp.com',
        'https://frontend-sigma-wheat-17.vercel.app',
        'http://localhost:3000',
    ]}})

    # ── Structured request logging + metrics (B-03 / B4.3) ──
    import uuid as _uuid
    import time as _time
    from collections import deque as _deque

    _metrics = {
        'latencies': _deque(maxlen=500),
        'status_counts': {'2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0},
        'total': 0,
    }

    @app.teardown_appcontext
    def _shutdown_session(exception=None):
        """Ensure DB session is cleaned up after every request to prevent InFailedSqlTransaction."""
        if exception:
            db.session.rollback()
        db.session.remove()

    @app.before_request
    def _ensure_clean_session():
        """Ensure DB session is clean at the start of every request."""
        try:
            db.session.execute(db.text('SELECT 1'))
        except Exception:
            db.session.rollback()

    @app.before_request
    def _attach_request_meta():
        request.wiam_start = _time.time()
        request.wiam_rid = _uuid.uuid4().hex[:12]

    @app.after_request
    def _security_headers(response):
        if request.is_secure or request.headers.get('X-Forwarded-Proto', '') == 'https':
            response.headers.setdefault(
                'Strict-Transport-Security', 'max-age=31536000; includeSubDomains'
            )
        return response

    @app.after_request
    def _log_request(response):
        try:
            from flask_login import current_user as _cu
            uid = getattr(_cu, 'id', None) if getattr(_cu, 'is_authenticated', False) else None
            latency_ms = round((_time.time() - getattr(request, 'wiam_start', _time.time())) * 1000)
            if request.endpoint and not request.endpoint.startswith('static'):
                log.info("req rid=%s user=%s %s %s %s %dms",
                         getattr(request, 'wiam_rid', '-'), uid,
                         request.method, request.path, response.status_code, latency_ms)
                _metrics['latencies'].append(latency_ms)
                _metrics['total'] += 1
                sc = response.status_code
                if sc < 300: _metrics['status_counts']['2xx'] += 1
                elif sc < 400: _metrics['status_counts']['3xx'] += 1
                elif sc < 500: _metrics['status_counts']['4xx'] += 1
                else: _metrics['status_counts']['5xx'] += 1
        except Exception:
            pass
        return response

    @app.after_request
    def _wiam_embed_cookie(response):
        """Persist embed=1 for Expo WebView so internal links stay in embedded layout (no duplicate footer/nav)."""
        from flask import request as _req
        if _req.args.get('embed') != '1':
            return response
        if _req.path.startswith('/static/') or _req.path.startswith('/api/'):
            return response
        if response.status_code and response.status_code >= 400:
            return response
        _secure = _req.is_secure or (_req.headers.get('X-Forwarded-Proto', '').lower() == 'https')
        response.set_cookie(
            'wiam_embed',
            '1',
            max_age=60 * 60 * 24 * 365,
            samesite='Lax',
            secure=bool(_secure),
            path='/',
            httponly=True,
        )
        return response

    @app.route('/api/metrics')
    def _serve_metrics():
        from flask_login import current_user as _cu
        if not (getattr(_cu, 'is_authenticated', False) and getattr(_cu, 'is_founder', False)):
            from flask import abort as _ab
            _ab(403)
        lats = sorted(_metrics['latencies']) if _metrics['latencies'] else [0]
        n = len(lats)
        from flask import jsonify as _jf
        return _jf({
            'total_requests': _metrics['total'],
            'status_counts': _metrics['status_counts'],
            'latency_p50_ms': lats[n // 2] if n else 0,
            'latency_p95_ms': lats[int(n * 0.95)] if n else 0,
            'latency_p99_ms': lats[int(n * 0.99)] if n else 0,
            'sample_size': n,
        })

    # Enforce banned / deactivated status on every request
    @app.before_request
    def enforce_account_status():
        from flask_login import current_user as _cu, logout_user as _lo
        if not _cu.is_authenticated:
            return
        if _cu.status == 'banned':
            _lo()
            from flask import flash as _fl, redirect as _redir, url_for as _uf
            _fl('Your account has been suspended. Contact support@wiamapp.com if you believe this is an error.', 'error')
            return _redir(_uf('auth.login'))
        if _cu.status == 'deactivated':
            _lo()
            from flask import flash as _fl, redirect as _redir, url_for as _uf
            _fl('Your account has been deactivated. Send feedback to the WiamApp team to reactivate — allow up to 24 hours for a response.', 'warning')
            return _redir(_uf('auth.login'))
        if _cu.status == 'deleted':
            _lo()
            from flask import flash as _fl, redirect as _redir, url_for as _uf
            _fl('This account has been deleted.', 'error')
            return _redir(_uf('auth.login'))

    # ── Rate Guard + Trust cache cleanup (runs at most once per 10 min) ──
    _rg_cache = {'last_run': 0}

    @app.before_request
    def _rate_guard_cleanup():
        import time as _t
        now = _t.time()
        if now - _rg_cache['last_run'] < 600:  # 10-minute cooldown
            return
        _rg_cache['last_run'] = now
        try:
            from .services.rate_guard import cleanup_stale_entries
            cleanup_stale_entries()
        except Exception:
            db.session.rollback()
        try:
            from .services.trust_engine import cleanup_trust_cache
            cleanup_trust_cache()
        except Exception:
            db.session.rollback()

    # ── Classic chapter release + delayed creator approvals (at most once per hour)
    # Must NOT run inline on the request thread: heavy DB work caused gateway 503s when
    # the first request after the cooldown was /founder or /team (many queries stacked).
    _classic_release_cache = {'last_run': 0}

    @app.before_request
    def _release_classic_chapters():
        import time as _t
        now = _t.time()
        if now - _classic_release_cache['last_run'] < 3600:  # 1 hour cooldown
            return
        _classic_release_cache['last_run'] = now

        def _run_async():
            try:
                with app.app_context():
                    try:
                        from .services.classics_service import release_due_classic_chapters
                        release_due_classic_chapters()
                    except Exception:
                        db.session.rollback()
                    try:
                        from .services.creator_approval import process_delayed_approvals
                        process_delayed_approvals()
                    except Exception:
                        db.session.rollback()
            except Exception:
                pass

        threading.Thread(target=_run_async, daemon=True).start()

    # Lock founder & team accounts to their dashboards — block reader frontend
    @app.before_request
    def enforce_team_account_isolation():
        from flask_login import current_user as _cu
        if not _cu.is_authenticated:
            return

        # ── Shared allowed endpoints (auth, static, API, basic profile) ──
        _shared = ('auth.', 'static', 'api_v1.', 'api.', '_serve_metrics',
                   'profile.my_profile', 'profile.update_profile',
                   'profile.upload_avatar', 'profile.serve_image',
                   'profile.account_safety', 'profile.my_warnings',
                   'notifications.')

        ep = request.endpoint or ''

        # ── Founder isolation ──
        # Under EPISIO_SLIM, do not lock founders to /founder/ — public Episio
        # must stay reachable, and a broken founder page must not trap the session.
        if getattr(_cu, 'is_founder', False) and not _episio_slim:
            founder_allowed = _shared + (
                'founder_dash.', 'team.', 'admin_dash.', 'editor_studio.',
                'apply.', 'home.',
            )
            for prefix in founder_allowed:
                if ep.startswith(prefix) or ep == prefix.rstrip('.'):
                    return
            from flask import redirect as _redir, url_for as _uf
            return _redir(_uf('founder_dash.overview'))

        # ── Team account isolation ──
        if getattr(_cu, 'is_team_account', False):
            team_allowed = _shared + (
                'team.', 'admin_dash.', 'editor_studio.', 'founder_dash.',
                'book.', 'browse.',
            )
            for prefix in team_allowed:
                if ep.startswith(prefix) or ep == prefix.rstrip('.'):
                    return
            from flask import redirect as _redir, url_for as _uf
            return _redir(_uf('team.dashboard'))

    # Enforce onboarding for new users (skip founder/team — they use dashboards)
    @app.before_request
    def enforce_onboarding():
        from flask_login import current_user as _cu
        if not _cu.is_authenticated:
            return
        if _cu.onboarding_completed:
            return
        if getattr(_cu, 'is_founder', False) or getattr(_cu, 'is_team_account', False):
            return
        # Allow these endpoints without onboarding
        allowed = ('auth.onboarding', 'auth.logout', 'static', 'profile.terms',
                    'profile.privacy_policy', 'profile.upload_avatar',
                    'profile.serve_image', 'apply.fill_form',
                    'auth.install_app', 'auth.install_app_complete')
        if request.endpoint in allowed:
            return
        from flask import redirect as _redir, url_for as _uf
        return _redir(_uf('auth.onboarding'))

    # Enforce PWA install gate for new users (skip founder/team — they use dashboards)
    @app.before_request
    def enforce_pwa_install():
        from flask_login import current_user as _cu
        from flask import session as _sess
        if not _cu.is_authenticated:
            return
        if getattr(_cu, 'is_founder', False) or getattr(_cu, 'is_team_account', False):
            return
        if not _sess.get('needs_pwa_install'):
            return
        allowed_pwa = ('auth.install_app', 'auth.install_app_complete',
                       'auth.logout', 'static')
        if request.endpoint in allowed_pwa:
            return
        from flask import redirect as _redir, url_for as _uf
        return _redir(_uf('auth.install_app'))

    # Template context processors
    from datetime import datetime as _dt

    @app.context_processor
    def inject_now():
        return {'now': _dt.utcnow}

    @app.context_processor
    def inject_safe_url_for():
        """url_for that returns '#' when endpoint is not registered (EPISIO_SLIM)."""
        from flask import url_for as _url_for
        from werkzeug.routing import BuildError as _BuildError

        def safe_url_for(endpoint, **values):
            try:
                return _url_for(endpoint, **values)
            except _BuildError:
                return '#'

        return {'safe_url_for': safe_url_for}

    @app.context_processor
    def inject_wiam_in_app():
        """True when page is loaded inside the Expo app WebView (embed query, cookie, or UA marker)."""
        from flask import request as _req
        _ua = _req.headers.get('User-Agent') or ''
        _in = (
            _req.args.get('embed') == '1'
            or _req.cookies.get('wiam_embed') == '1'
            or ('WiamAppMobile' in _ua)
        )
        return {'wiam_in_app': _in}

    # Per-user notif count cache (JS polls every 120s, so 60s staleness is fine)
    # Stored on app so routes can invalidate via current_app._notif_count_cache
    app._notif_count_cache = {}  # {uid: {'ts': float, 'count': int}}

    @app.context_processor
    def inject_notif_count():
        from flask_login import current_user as _cu
        if _cu.is_authenticated and _cu.id:
            import time as _t
            uid = _cu.wiam_id or _cu.id
            now = _t.time()
            cached = app._notif_count_cache.get(uid)
            if cached and now - cached['ts'] < 60:
                return {'unread_notif_count': cached['count']}
            from .models import Notification
            try:
                count = Notification.query.filter_by(
                    user_id=uid, is_read=False
                ).count()
                app._notif_count_cache[uid] = {'ts': now, 'count': count}
                return {'unread_notif_count': count}
            except Exception:
                # Transaction may be in failed state - return 0 and don't cache
                return {'unread_notif_count': 0}
        return {'unread_notif_count': 0}

    @app.context_processor
    def inject_coin_balance():
        from flask_login import current_user as _cu
        if _cu.is_authenticated and _cu.id:
            from .models import CoinBalance
            try:
                bal = CoinBalance.query.get(_cu.id)
                return {'coin_balance': bal.balance if bal else 0}
            except Exception:
                # Transaction may be in failed state - return 0
                return {'coin_balance': 0}
        return {'coin_balance': 0}

    @app.context_processor
    def inject_user_avatar():
        from flask_login import current_user as _cu
        if _cu.is_authenticated:
            # Check User.avatar_url first (set during registration/profile edit)
            if getattr(_cu, 'avatar_url', None):
                return {'user_avatar_url': _cu.avatar_url}
            # Fall back to CreatorProfile avatar
            if _cu.id:
                try:
                    from .models import CreatorProfile
                    cp = CreatorProfile.query.filter_by(wiam_id=_cu.wiam_id).first()
                    if cp and cp.avatar_url:
                        return {'user_avatar_url': cp.avatar_url}
                except Exception:
                    pass
        return {'user_avatar_url': None}

    @app.context_processor
    def inject_premium_status():
        from flask_login import current_user as _cu
        if _cu.is_authenticated:
            try:
                from .services.premium_service import is_premium_active
                from .models import PlatformConfig
                cfg = PlatformConfig.get()
                return {
                    'is_premium': is_premium_active(_cu),
                    'premium_credits': getattr(_cu, 'premium_credits_balance', 0) or 0,
                    'ff_premium_enabled': cfg.ff_premium_enabled,
                    'ff_premium_badge_enabled': cfg.ff_premium_badge_enabled,
                }
            except Exception:
                return {
                    'is_premium': False,
                    'premium_credits': 0,
                    'ff_premium_enabled': False,
                    'ff_premium_badge_enabled': False,
                }
        return {
            'is_premium': False,
            'premium_credits': 0,
            'ff_premium_enabled': False,
            'ff_premium_badge_enabled': False,
        }

    @app.context_processor
    def inject_team_flags():
        """Expose is_team_or_founder flag so base.html can strip reader UI."""
        from flask_login import current_user as _cu
        if _cu.is_authenticated:
            return {'is_team_or_founder': bool(getattr(_cu, 'is_founder', False) or getattr(_cu, 'is_team_account', False))}
        return {'is_team_or_founder': False}

    @app.context_processor
    def inject_user_rbac():
        from flask_login import current_user as _cu
        if _cu.is_authenticated:
            try:
                return {
                    'user_permissions': _cu.get_permissions(),
                    'user_roles': _cu.get_roles(),
                }
            except Exception:
                # Transaction may be in failed state - return defaults
                return {'user_permissions': set(), 'user_roles': []}
        return {'user_permissions': set(), 'user_roles': []}

    @app.context_processor
    def inject_warning_state():
        """Inject unacknowledged warnings and escalation status for modal/banners."""
        from flask_login import current_user as _cu
        ctx = {'unacked_warnings': [], 'escalation_level': None, 'strike_count': 0}
        if _cu.is_authenticated and _cu.id:
            try:
                from .models import UserWarning
                from datetime import timedelta
                cutoff_90 = _dt.utcnow() - timedelta(days=90)
                unacked = UserWarning.query.filter(
                    UserWarning.user_id == _cu.id,
                    UserWarning.acknowledged == False,
                    UserWarning.created_at >= cutoff_90,
                ).order_by(UserWarning.created_at.desc()).limit(5).all()
                ctx['unacked_warnings'] = unacked
                cutoff_365 = _dt.utcnow() - timedelta(days=365)
                strikes = UserWarning.query.filter(
                    UserWarning.user_id == _cu.id,
                    UserWarning.severity == 'strike',
                    UserWarning.created_at >= cutoff_365,
                ).count()
                ctx['strike_count'] = strikes
                if strikes >= 2:
                    ctx['escalation_level'] = 'critical'
                elif strikes >= 1:
                    ctx['escalation_level'] = 'high'
                elif unacked:
                    ctx['escalation_level'] = 'moderate'
            except Exception:
                pass
        return ctx

    # Announcement banner cache — global, refreshes every 5 min
    _ann_cache = {'ts': 0, 'ann': None}

    @app.context_processor
    def inject_announcement_banner():
        import time as _t
        now = _t.time()
        if now - _ann_cache['ts'] < 300:
            return {'active_announcement': _ann_cache['ann']}
        try:
            from .models import Announcement
            ann = Announcement.query.filter_by(is_active=True).order_by(
                Announcement.created_at.desc()
            ).first()
            _ann_cache['ts'] = now
            _ann_cache['ann'] = ann
            return {'active_announcement': ann}
        except Exception:
            return {'active_announcement': None}

    # ── Google Ads context (cached 5 min) ──
    _ads_cache = {'ts': 0, 'enabled': False, 'client_id': '', 'adfree': False}

    @app.context_processor
    def inject_ads_config():
        import time as _t
        now = _t.time()
        if now - _ads_cache['ts'] < 300:
            return {
                'g_ads_enabled': _ads_cache['enabled'],
                'g_ads_client_id': _ads_cache['client_id'],
                'g_ads_adfree_premium': _ads_cache['adfree'],
            }
        try:
            from .models import PlatformConfig
            cfg = PlatformConfig.get()
            _ads_cache['ts'] = now
            _ads_cache['enabled'] = bool(cfg.ads_enabled)
            _ads_cache['client_id'] = cfg.ads_client_id or ''
            _ads_cache['adfree'] = bool(cfg.ff_ad_free_premium_enabled)
            return {
                'g_ads_enabled': _ads_cache['enabled'],
                'g_ads_client_id': _ads_cache['client_id'],
                'g_ads_adfree_premium': _ads_cache['adfree'],
            }
        except Exception:
            return {'g_ads_enabled': False, 'g_ads_client_id': '', 'g_ads_adfree_premium': False}

    # ── Custom error pages ──────────────────────────────────────────
    _error_map = {
        400: ('Bad Request', "The request couldn't be understood. Please check what you sent and try again."),
        403: ('Access Denied', "You don't have permission to view this page. If you think this is a mistake, let us know below."),
        404: ('Page Not Found', "Oops! This page got lost in the story. It may have been moved or doesn't exist anymore."),
        405: ('Method Not Allowed', "This action isn't allowed here. Try going back and doing it differently."),
        500: ('Something Went Wrong', "Our servers stumbled while turning a page. We're working on it — try again in a moment."),
    }

    def _error_page(error, code):
        # Return JSON for API requests instead of HTML error pages
        if request.path.startswith('/api/'):
            db.session.rollback()
            from flask import jsonify as _jf
            return _jf({'error': _error_map.get(code, ('Error', 'Something unexpected happened.'))[1]}), code
        title, msg = _error_map.get(code, ('Error', 'Something unexpected happened.'))
        from flask import render_template as _rt
        return _rt('error.html', error_code=code, error_title=title, error_msg=msg), code

    # Handle CSRF errors gracefully — redirect back with flash instead of 400 page
    from flask_wtf.csrf import CSRFError
    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        from flask import flash as _fl, redirect as _redir, request as _req, url_for as _uf
        log.warning('CSRF error: %s — url=%s referrer=%s', e.description, _req.url, _req.referrer)
        _fl('Your session expired. Please try again.', 'warning')
        return _redir(_req.referrer or _uf('auth.login'))

    @app.errorhandler(400)
    def err400(e): return _error_page(e, 400)
    @app.errorhandler(403)
    def err403(e): return _error_page(e, 403)
    @app.errorhandler(404)
    def err404(e): return _error_page(e, 404)
    @app.errorhandler(405)
    def err405(e): return _error_page(e, 405)
    @app.errorhandler(500)
    def err500(e): return _error_page(e, 500)

    # Feedback endpoint for error pages
    @app.route('/api/error-feedback', methods=['POST'])
    @csrf.exempt
    def error_feedback():
        from flask import jsonify
        import json as _json
        data = request.get_json(silent=True) or {}
        msg = (data.get('message') or '').strip()[:1000]
        code = data.get('error_code', '?')
        url = (data.get('url') or '')[:500]
        if msg:
            log.info("ERROR FEEDBACK [%s] url=%s — %s", code, url, msg)
        return jsonify(ok=True)

    # Run safe migrations, then create web-only tables
    with app.app_context():
        from . import models  # noqa: F401
        _run_safe_migrations(app)
        db.create_all()
        _seed_coin_packages()
        _seed_genres()
        try:
            from .services.episio_genres import seed_episio_genres
            seed_episio_genres()
        except Exception:
            log.exception('seed_episio_genres failed')
        _seed_platform_settings()
        _seed_feature_flags()
        _seed_rbac()
        _seed_revenue_rules()
        _ensure_founder_accounts()
        _clear_founder_warnings()
        # WiamBot DB intents removed — hardcoded knowledge base used instead
        _seed_application_forms()
        _cleanup_soft_deleted_books()
        # Push 2 — auto-promote any reader stuck on the old "pending" rubric.
        try:
            _backfill_pending_creators()
        except Exception as e:
            log.warning("Backfill pending creators top-level skip: %s", str(e)[:160])
            db.session.rollback()
        # Push 7 — grant Studio Pro to every founder account so internal
        # team-mates always have full Studio V2 visibility for QA + dogfood.
        try:
            _grant_founder_pro()
        except Exception as e:
            log.warning("Founder Pro grant skip: %s", str(e)[:160])
            db.session.rollback()
        # One-time: mirror any already-published classics into Content table
        try:
            from .services.classics_service import migrate_existing_classics
            migrate_existing_classics()
        except Exception as e:
            log.warning("Classic migration skip: %s", str(e)[:120])
        # Ensure startup seeds don't leave a dirty session for the first request
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
        db.session.remove()

    # ─── QA runtime exception capture ─────────────────────────────────
    # Log every uncaught exception in a request to AuditLog so the QA
    # watchdog roll-up can alert on per-endpoint, per-exception-class
    # bug keys with the existing 1-hour dedup cadence. Uses Flask's
    # got_request_exception signal so this runs AFTER normal error
    # handlers and never alters the response sent to the user.
    from flask import got_request_exception
    from werkzeug.exceptions import HTTPException

    def _qa_capture_request_exception(_sender, exception=None, **_extra):
        try:
            if exception is None or isinstance(exception, HTTPException):
                return
            import json as _json
            import traceback as _tb
            from .models import AuditLog
            tb_text = _tb.format_exc(limit=12)
            try:
                endpoint = request.endpoint or request.path or 'unknown'
                method = request.method
                path = request.path
                ip = request.headers.get('X-Forwarded-For') or request.remote_addr
            except Exception:
                endpoint, method, path, ip = 'unknown', '', '', None
            details = {
                'endpoint': endpoint,
                'path': path,
                'method': method,
                'exception_class': type(exception).__name__,
                'exception_str': str(exception)[:500],
                'traceback': tb_text[-2000:],
            }
            try:
                db.session.add(AuditLog(
                    actor_user_id=0,
                    action='QA_RUNTIME_EXCEPTION',
                    target_type='QA',
                    target_id=None,
                    details_json=_json.dumps(details),
                    ip_address=ip,
                ))
                db.session.commit()
            except Exception:
                try:
                    db.session.rollback()
                except Exception:
                    pass
        except Exception:
            # Monitoring must never crash the app.
            pass

    got_request_exception.connect(_qa_capture_request_exception, app)

    # ── Push 4 — lazy popularity recompute ─────────────────────────────
    # Trigger on the home + recommendations endpoints only so we never
    # block a chapter read or studio save behind a refresh. The service
    # itself enforces a 30-minute minimum interval and a non-blocking
    # try-acquire on the global lock so concurrent requests don't pile up.
    _POPULARITY_TRIGGER_PATHS = (
        '/api/v1/home',
        '/api/v1/recommendations',
        '/api/v1/trending',
        '/api/v1/featured',
    )

    @app.before_request
    def _trigger_popularity_recompute():
        try:
            path = request.path or ''
        except Exception:
            return None
        if not any(path.startswith(p) for p in _POPULARITY_TRIGGER_PATHS):
            return None
        try:
            from .services.popularity import recompute_if_stale
            recompute_if_stale()
        except Exception as e:
            log.warning("popularity recompute trigger skipped: %s", str(e)[:160])
        return None

    _scheduled_publish_state = {'last_tick': 0.0}
    _SCHEDULED_PUBLISH_INTERVAL = 5 * 60  # seconds

    @app.before_request
    def _trigger_scheduled_publish_tick():
        """Lazy scheduler: at most every 5 minutes, on /api/v1/home or /studio
        traffic, promote chapters whose ``scheduled_publish_at`` has elapsed
        and fire ``notify_new_chapter`` for each.
        """
        try:
            path = request.path or ''
        except Exception:
            return None
        if not (path.startswith('/api/v1/') or path.startswith('/studio/')):
            return None
        import time
        now = time.time()
        if now - _scheduled_publish_state['last_tick'] < _SCHEDULED_PUBLISH_INTERVAL:
            return None
        _scheduled_publish_state['last_tick'] = now
        try:
            from .routes.studio_v2_api import publish_due_now
            n = publish_due_now()
            if n:
                log.info("scheduled-publish tick: published %d chapter(s)", n)
        except Exception as e:
            log.warning("scheduled-publish tick skipped: %s", str(e)[:160])
        return None

    return app


def _ensure_founder_accounts():
    """Ensure founder accounts exist with hashed passwords (idempotent).

    **Security**: All credentials are loaded from environment variables only.
    Set these on your hosting provider (e.g. Render):
        FOUNDER_EMAIL_1, FOUNDER_PASS_1, FOUNDER_NAME_1, FOUNDER_USER_1
        FOUNDER_EMAIL_2, FOUNDER_PASS_2, FOUNDER_NAME_2, FOUNDER_USER_2
    If a variable is missing the account is silently skipped.
    """
    import os, random
    from .models import User

    # ── Step 1: Demote any OLD founder accounts that are NOT in the env vars ──
    new_emails = set()
    for i in (1, 2, 3, 4):
        e = (os.environ.get(f'FOUNDER_EMAIL_{i}') or '').strip().lower()
        if e:
            new_emails.add(e)

    if new_emails:
        old_founders = User.query.filter(
            User.role == 'founder',
            ~User.email.in_(new_emails),
        ).all()
        for old in old_founders:
            old.role = 'reader'
            log.info("Demoted old founder account to reader: %s", old.email)
        if old_founders:
            db.session.commit()

    # ── Step 2: Create / update founder accounts from env vars ──
    for i in (1, 2, 3, 4):
        email = (os.environ.get(f'FOUNDER_EMAIL_{i}') or '').strip()
        password = (os.environ.get(f'FOUNDER_PASS_{i}') or '').strip()
        if not email or not password:
            continue

        full_name = (os.environ.get(f'FOUNDER_NAME_{i}') or 'Founder').strip()
        username = (os.environ.get(f'FOUNDER_USER_{i}') or email.split('@')[0]).strip()
        parts = full_name.split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ''

        user = User.query.filter_by(email=email).first()
        if user:
            if user.role != 'founder':
                user.role = 'founder'
            user.set_password(password)
            user.email_verified = True
            user.onboarding_completed = True
            db.session.commit()
            log.info("Updated founder account: %s", email)
        else:
            synthetic_tid = -random.randint(900000000, 999999999)
            while User.query.filter_by(wiam_id=synthetic_tid).first():
                synthetic_tid = -random.randint(900000000, 999999999)

            new_user = User(
                wiam_id=synthetic_tid,
                email=email,
                username=username,
                first_name=first_name,
                last_name=last_name,
                role='founder',
                email_verified=True,
                auth_provider='email',
                onboarding_completed=True,
                status='active',
            )
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.commit()
            log.info("Created founder account: %s", email)


def _clear_founder_warnings():
    """Remove all warnings/strikes for founder accounts — founders are exempt."""
    from .models import User, UserWarning
    founders = User.query.filter_by(role='founder').all()
    if not founders:
        return
    founder_ids = [f.id for f in founders] + [f.wiam_id for f in founders if f.wiam_id]
    deleted = UserWarning.query.filter(UserWarning.user_id.in_(founder_ids)).delete(synchronize_session=False)
    if deleted:
        db.session.commit()
        log.info("Cleared %d warnings/strikes from founder accounts", deleted)


def _cleanup_soft_deleted_books():
    """Permanently remove any soft-deleted books from the database to free space."""
    from .models import Content
    deleted = Content.query.filter(Content.deleted_at != None).all()
    if not deleted:
        return
    log.info("Cleaning up %d soft-deleted books from database...", len(deleted))
    from .routes.studio import _hard_delete_book
    for book in deleted:
        try:
            _hard_delete_book(book.id)
            log.info("  Permanently removed book id=%d title=%s", book.id, book.title)
        except Exception as e:
            log.warning("  Failed to clean up book id=%d: %s", book.id, e)
            db.session.rollback()
    log.info("Soft-deleted book cleanup complete.")


def _backfill_pending_creators():
    """Auto-promote every creator stuck at status='pending' under the new model.

    Push 2 of the deep-tracking + Home rebuild + WiamStudio V2 plan replaced
    the rubric-based application with a one-tap pen-name + terms gate. Anyone
    who applied under the old system is currently stranded with
    ``creator_application_status='pending'`` and no creator role / wiam_id /
    studio access. Rather than ask them to re-apply, we promote them on next
    boot — same outcome the new gate would have given them, without asking
    them to take action.

    Idempotent: re-running on subsequent boots is a no-op because there will
    be no pending rows after the first successful pass. Safe by design — only
    touches users whose status is exactly ``pending`` (manual ``approved`` or
    ``rejected`` decisions are left untouched).
    """
    from .models import User, CreatorProfile
    from .services.creator_activation import finalize_creator_upgrade
    from .services.notifications import notify_creator_welcome

    try:
        pending = User.query.filter(User.creator_application_status == 'pending').all()
    except Exception as exc:
        log.warning("Backfill pending creators: query skipped (%s)", exc)
        db.session.rollback()
        return

    if not pending:
        return

    log.info("Backfill: promoting %d pending applicant(s) under tiny-gate model", len(pending))

    promoted = 0
    for u in pending:
        try:
            cp = (
                CreatorProfile.query.filter_by(wiam_id=u.wiam_id).first()
                if u.wiam_id is not None
                else None
            )
            pen_hint = (cp.pen_name if cp and (cp.pen_name or '').strip() else None)
            finalize_creator_upgrade(u, pen_name_hint=pen_hint)
            db.session.commit()
            promoted += 1
            try:
                fresh = User.query.get(u.id)
                if fresh:
                    notify_creator_welcome(fresh)
            except Exception as nexc:
                log.warning("Backfill welcome notify skip user=%s: %s", u.id, nexc)
        except Exception as exc:
            log.warning("Backfill skip user=%s: %s", u.id, exc)
            db.session.rollback()

    log.info("Backfill: promoted %d / %d pending applicant(s) successfully", promoted, len(pending))


def _grant_founder_pro():
    """Push 7 — auto-grant Studio Pro to every founder account.

    Founders dogfood Studio V2 for QA and demos, so they should always
    have an active StudioProSubscription row regardless of payment. This
    helper is idempotent: it only inserts a row when no active one exists
    for that user. ``plan='founder'`` and ``source='founder_grant'`` keep
    these distinct from real paid subscriptions so revenue dashboards
    aren't muddied.
    """
    from .models import User, StudioProSubscription

    try:
        founders = User.query.filter(User.role == 'founder', User.status != 'deleted').all()
    except Exception as exc:
        log.warning("Founder Pro: query skipped (%s)", exc)
        db.session.rollback()
        return

    if not founders:
        return

    granted = 0
    for u in founders:
        try:
            existing = StudioProSubscription.query.filter_by(
                user_id=u.id, status='active'
            ).first()
            if existing:
                continue
            sub = StudioProSubscription(
                user_id=u.id,
                plan='founder',
                status='active',
                source='founder_grant',
            )
            db.session.add(sub)
            db.session.commit()
            granted += 1
        except Exception as exc:
            log.warning("Founder Pro skip user=%s: %s", u.id, exc)
            db.session.rollback()

    if granted:
        log.info("Founder Pro: granted to %d founder account(s)", granted)


def _seed_platform_settings():
    """Seed default platform settings for hybrid publishing (idempotent)."""
    import json as _json
    from .models import PlatformSetting
    defaults = {
        'min_chapters_required': (10, 'int', 'Minimum chapters required for monetization review'),
        'min_words_per_chapter': (1000, 'int', 'Minimum words per chapter for quality check'),
        'monetization_min_score': (75, 'int', 'Minimum bot score to approve monetization'),
        'elite_min_score': (80, 'int', 'Minimum bot score for Elite eligibility'),
        'apex_min_score': (90, 'int', 'Minimum bot score for Apex eligibility'),
        'max_resubmissions_per_month': (3, 'int', 'Max review resubmissions per book per month'),
        'engagement_score_weight': (25, 'int', 'Weight of engagement in bot scoring (0-25)'),
        'allow_unreviewed_publication': (True, 'bool', 'Allow instant publish without review (read-only, no monetization)'),
        'platform_name': ('WiamApp', 'string', 'Platform display name'),
        'support_email': ('support@wiamapp.com', 'string', 'Support email address'),
        'default_currency': ('GHS', 'string', 'Default currency code'),
        'maintenance_mode': (False, 'bool', 'Enable maintenance mode'),
        'maintenance_message': ('We are performing scheduled maintenance. Please check back soon.', 'string', 'Maintenance mode message'),
        'minimum_age': (13, 'int', 'Minimum user age requirement'),
        'max_chapters_per_day': (10, 'int', 'Max chapters a creator can publish per day'),
        'min_chapter_length': (200, 'int', 'Minimum chapter length in words'),
        'session_timeout_minutes': (1440, 'int', 'Session timeout in minutes'),
        'tip_minimum_coins': (10, 'int', 'Minimum coins for a tip'),
        'default_creator_share_pct': (50, 'int', 'Default creator revenue share %'),
        'elite_creator_share_pct': (55, 'int', 'Elite creator revenue share %'),
        'apex_creator_share_pct': (60, 'int', 'Apex creator revenue share %'),
        'minimum_payout_ghs': (10.0, 'string', 'Minimum payout threshold in GHS'),
        # Rate Guard limits (S5-S10, S20)
        'rate_comment_per_min': (5, 'int', 'Max comments per minute per user'),
        'rate_comment_per_hour': (20, 'int', 'Max comments per hour per user'),
        'rate_follow_per_hour': (30, 'int', 'Max follows per hour per user'),
        'rate_rating_per_hour': (10, 'int', 'Max ratings per hour per user'),
        'rate_book_create_per_day': (3, 'int', 'Max new books per day (untrusted creators)'),
        'rate_burst_threshold': (50, 'int', 'Total actions in burst window to trigger cooldown'),
        'rate_burst_window_min': (5, 'int', 'Burst detection window in minutes'),
        'rate_burst_cooldown_min': (5, 'int', 'Cooldown duration in minutes after burst'),
        'rate_registration_per_ip_per_hour': (5, 'int', 'Max account registrations per IP per hour'),
    }
    count = 0
    for key, (val, vtype, desc) in defaults.items():
        if not PlatformSetting.query.filter_by(key=key).first():
            db.session.add(PlatformSetting(
                key=key, value_json=_json.dumps(val), value_type=vtype, description=desc,
            ))
            count += 1
    if count:
        db.session.commit()
        log.info("Seeded %d platform settings", count)


def _seed_feature_flags():
    """Seed default feature flags (idempotent)."""
    from .models import FeatureFlag
    defaults = {
        'enable_smart_hybrid_model': (True, 'Smart Hybrid Publishing — instant publish, review for monetization'),
        'enable_bot_editorial': (True, 'WiamBot automated editorial review engine'),
        'require_review_for_monetization': (True, 'Require bot/editor review before enabling monetization'),
        'enable_creator_signup': (True, 'Allow new creator registrations'),
        'enable_elite': (True, 'WiamElite Hall of Fame feature'),
        'enable_apex': (True, 'Wiam Apex contract program'),
        'enable_premium': (False, 'WiamPremium subscription feature'),
        'enable_comments': (True, 'Chapter and book comments'),
        'enable_reactions': (True, 'Emoji reactions on paragraphs'),
        'enable_bulletin': (True, 'Creator Bulletin channels'),
        'enable_gifting': (True, 'Gift stickers feature'),
        'enable_push_notifications': (True, 'Web push notifications'),
        'enable_google_login': (True, 'Google OAuth login'),
        'enable_telegram_login': (False, 'Telegram login (legacy)'),
    }
    count = 0
    for key, (enabled, desc) in defaults.items():
        if not FeatureFlag.query.filter_by(key=key).first():
            db.session.add(FeatureFlag(key=key, is_enabled=enabled, description=desc))
            count += 1
    if count:
        db.session.commit()
        log.info("Seeded %d feature flags", count)


def _seed_rbac():
    """Seed default RBAC roles, permissions, and role→permission mappings (idempotent)."""
    from .models import Role, Permission, RolePermission

    # ── Define roles ──
    ROLES = [
        ('founder',      'Founder',      'Full platform access — cannot be deleted', True),
        ('overall_boss', 'Overall Boss', 'Second-in-command — near-founder access, oversees all teams', True),
        ('admin',        'Admin',        'Near-full access except platform settings & team config', True),
        ('team_lead',    'Team Lead',    'Leads a department — can manage their team members', True),
        ('editor',       'Editor',       'Content review, editorial notes, review queue', True),
        ('moderator',    'Moderator',    'Content moderation, reports, user bans', True),
        ('engineer',     'Engineer',     'Platform engineering, system monitoring, deployments', True),
        ('support',      'Support',      'User support, feedback, account management', True),
        ('marketing',    'Marketing',    'Announcements, collections, featured books', True),
        ('finance',      'Finance',      'Revenue, payouts, coin management', True),
        ('analyst',      'Analyst',      'Read-only analytics and stats', True),
        ('translator',   'Translator',   'Story translation, platform localisation', True),
        ('community_manager', 'Community Manager', 'Community engagement, events, social growth', True),
        ('qa_tester',    'QA Tester',    'Feature testing, bug reporting, quality assurance', True),
    ]

    # ── Define permissions ──
    PERMS = [
        # Users
        ('users.view',           'View user list and details',           'users'),
        ('users.manage',         'Edit user accounts',                   'users'),
        ('users.ban',            'Ban / suspend / deactivate users',     'users'),
        # Content
        ('content.view',         'View all content',                     'content'),
        ('content.manage',       'Edit / publish / unpublish content',   'content'),
        ('content.delete',       'Delete content permanently',           'content'),
        ('content.feature',      'Feature / unfeature books',            'content'),
        # Review
        ('review.view',          'View review queue',                    'review'),
        ('review.approve',       'Approve content for monetization',     'review'),
        ('review.reject',        'Reject content review',                'review'),
        ('review.override',      'Override bot decisions',               'review'),
        # Moderation
        ('moderation.view',      'View moderation dashboard',            'moderation'),
        ('moderation.action',    'Take moderation actions',              'moderation'),
        # Creators
        ('creators.view',        'View creator list and profiles',       'creators'),
        ('creators.manage',      'Manage creator applications & status', 'creators'),
        # Revenue
        ('revenue.view',         'View revenue dashboard',               'revenue'),
        ('revenue.manage',       'Manage revenue settings',              'revenue'),
        # Payouts
        ('payouts.view',         'View payout history',                  'payouts'),
        ('payouts.process',      'Process creator payouts',              'payouts'),
        # Announcements
        ('announcements.view',   'View announcements',                   'announcements'),
        ('announcements.manage', 'Create / edit / delete announcements', 'announcements'),
        # Collections
        ('collections.view',     'View curated collections',             'collections'),
        ('collections.manage',   'Create / edit curated collections',    'collections'),
        # Elite
        ('elite.view',           'View WiamElite dashboard',             'elite'),
        ('elite.manage',         'Promote / demote Elite stories',       'elite'),
        # Settings
        ('settings.view',        'View platform settings',               'settings'),
        ('settings.manage',      'Change platform settings & flags',     'settings'),
        # Team
        ('team.view',            'View team members',                    'team'),
        ('team.manage',          'Add / remove team roles',              'team'),
        # Analytics
        ('analytics.view',       'View platform analytics',              'analytics'),
        # Feedback
        ('feedback.view',        'View user feedback',                   'feedback'),
        ('feedback.manage',      'Respond to / resolve feedback',        'feedback'),
        # Bot
        ('bot.view',             'View WiamBot training data',           'bot'),
        ('bot.manage',           'Edit bot intents & responses',         'bot'),
        # Forms
        ('forms.view',           'View application forms',               'forms'),
        ('forms.manage',         'Create / send application forms',      'forms'),
        # Genres / Banned words
        ('genres.manage',        'Add / edit / delete genres',           'content'),
        ('banned_words.manage',  'Manage banned word list',              'moderation'),
    ]

    # ── Role → Permission mapping ──
    ROLE_PERMS = {
        'founder': '*',  # all permissions
        'admin': [
            'users.view', 'users.manage', 'users.ban',
            'content.view', 'content.manage', 'content.delete', 'content.feature',
            'review.view', 'review.approve', 'review.reject', 'review.override',
            'moderation.view', 'moderation.action',
            'creators.view', 'creators.manage',
            'revenue.view',
            'payouts.view',
            'announcements.view', 'announcements.manage',
            'collections.view', 'collections.manage',
            'elite.view', 'elite.manage',
            'analytics.view',
            'feedback.view', 'feedback.manage',
            'bot.view', 'bot.manage',
            'forms.view', 'forms.manage',
            'genres.manage', 'banned_words.manage',
        ],
        'editor': [
            'content.view', 'content.manage', 'content.feature',
            'review.view', 'review.approve', 'review.reject',
            'creators.view',
            'analytics.view',
            'feedback.view',
            'genres.manage',
            'collections.view',
        ],
        'moderator': [
            'users.view', 'users.ban', 'users.manage',
            'content.view', 'content.manage', 'content.delete',
            'moderation.view', 'moderation.action',
            'feedback.view', 'feedback.manage',
            'banned_words.manage',
            'analytics.view',
        ],
        'support': [
            'users.view', 'users.manage',
            'content.view',
            'feedback.view', 'feedback.manage',
            'creators.view',
            'analytics.view',
            'bot.view',
            'announcements.view',
        ],
        'marketing': [
            'users.view',
            'content.view', 'content.feature',
            'announcements.view', 'announcements.manage',
            'collections.view', 'collections.manage',
            'analytics.view',
            'elite.view',
            'creators.view',
        ],
        'finance': [
            'users.view',
            'revenue.view', 'revenue.manage',
            'payouts.view', 'payouts.process',
            'analytics.view',
            'creators.view',
            'elite.view',
        ],
        'analyst': [
            'users.view',
            'content.view',
            'creators.view',
            'revenue.view',
            'payouts.view',
            'analytics.view',
            'elite.view',
            'review.view',
            'moderation.view',
            'feedback.view',
        ],
        'engineer': [
            'users.view',
            'content.view', 'content.manage',
            'analytics.view',
            'settings.view', 'settings.manage',
            'bot.view', 'bot.manage',
            'feedback.view',
            'elite.view',
        ],
        'translator': [
            'content.view', 'content.manage',
            'analytics.view',
            'creators.view',
            'collections.view',
        ],
        'overall_boss': [
            'users.view', 'users.manage', 'users.ban',
            'content.view', 'content.manage', 'content.delete', 'content.feature',
            'review.view', 'review.approve', 'review.reject', 'review.override',
            'moderation.view', 'moderation.action',
            'creators.view', 'creators.manage',
            'revenue.view', 'revenue.manage',
            'payouts.view', 'payouts.process',
            'announcements.view', 'announcements.manage',
            'collections.view', 'collections.manage',
            'elite.view', 'elite.manage',
            'settings.view',
            'team.view', 'team.manage',
            'analytics.view',
            'feedback.view', 'feedback.manage',
            'bot.view', 'bot.manage',
            'forms.view', 'forms.manage',
            'genres.manage', 'banned_words.manage',
        ],
        'team_lead': [
            'users.view', 'users.manage',
            'content.view', 'content.manage', 'content.feature',
            'review.view', 'review.approve', 'review.reject',
            'moderation.view', 'moderation.action',
            'creators.view', 'creators.manage',
            'analytics.view',
            'feedback.view', 'feedback.manage',
            'team.view',
            'announcements.view', 'announcements.manage',
            'collections.view', 'collections.manage',
            'elite.view',
            'bot.view',
        ],
        'community_manager': [
            'users.view',
            'content.view',
            'creators.view',
            'analytics.view',
            'feedback.view', 'feedback.manage',
            'announcements.view',
            'collections.view',
            'elite.view',
        ],
        'qa_tester': [
            'users.view',
            'content.view',
            'analytics.view',
            'feedback.view',
            'settings.view',
            'elite.view',
            'bot.view',
        ],
    }

    # ── Seed roles ──
    role_map = {}
    changed = False
    for name, display, desc, is_sys in ROLES:
        r = Role.query.filter_by(name=name).first()
        if not r:
            r = Role(name=name, display_name=display, description=desc, is_system=is_sys)
            db.session.add(r)
            db.session.flush()
            changed = True
        role_map[name] = r.id

    # ── Seed permissions ──
    perm_map = {}
    for key, desc, cat in PERMS:
        p = Permission.query.filter_by(key=key).first()
        if not p:
            p = Permission(key=key, description=desc, category=cat)
            db.session.add(p)
            db.session.flush()
            changed = True
        perm_map[key] = p.id

    # ── Seed role→permission mappings ──
    for role_name, perms in ROLE_PERMS.items():
        rid = role_map.get(role_name)
        if not rid:
            continue
        perm_keys = list(perm_map.keys()) if perms == '*' else perms
        for pk in perm_keys:
            pid = perm_map.get(pk)
            if not pid:
                continue
            exists = RolePermission.query.filter_by(role_id=rid, permission_id=pid).first()
            if not exists:
                db.session.add(RolePermission(role_id=rid, permission_id=pid))
                changed = True

    if changed:
        db.session.commit()
        log.info("RBAC seeded: %d roles, %d permissions", len(ROLES), len(PERMS))


def _seed_revenue_rules():
    """Seed default revenue split rules (idempotent)."""
    from .models import RevenueRule
    if RevenueRule.query.count() == 0:
        defaults = [
            RevenueRule(rule_type='DEFAULT', creator_share_pct=50.0, platform_share_pct=50.0),
            RevenueRule(rule_type='ELITE', creator_share_pct=65.0, platform_share_pct=35.0),
            RevenueRule(rule_type='APEX', creator_share_pct=70.0, platform_share_pct=30.0),
        ]
        db.session.add_all(defaults)
        db.session.commit()
        log.info("Seeded %d default revenue rules", len(defaults))


def _seed_application_forms():
    """Auto-seed default application forms so the public careers page is unlocked."""
    from .models import ApplicationForm
    try:
        from .routes.founder import _DEFAULT_FORMS
    except Exception:
        log.warning("Could not import _DEFAULT_FORMS — skipping application form seed")
        return
    created = 0
    for fd in _DEFAULT_FORMS:
        existing = ApplicationForm.query.filter_by(form_type=fd['form_type']).first()
        if not existing:
            f = ApplicationForm(**fd)
            db.session.add(f)
            created += 1
    if created:
        db.session.commit()
        log.info("Seeded %d default application forms for careers page", created)


def _seed_genres():
    """Ensure default genres exist (idempotent)."""
    from .models import Genre
    if Genre.query.count() == 0:
        defaults = [
            'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
            'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller',
            'Historical', 'Slice of Life', 'Supernatural', 'Sports',
            'Psychological', 'Crime', 'Poetry', 'Non-Fiction',
        ]
        for name in defaults:
            db.session.add(Genre(name=name))
        db.session.commit()
        log.info("Seeded %d default genres", len(defaults))


def _seed_coin_packages():
    """Ensure default coin packages exist and prices are up-to-date (idempotent)."""
    from .models import CoinPackage
    EXPECTED = {
        100: {'price_ghs': 10.00, 'bonus_coins': 0, 'label': 'Starter', 'sort_order': 1},
        300: {'price_ghs': 25.00, 'bonus_coins': 20, 'label': 'Popular', 'sort_order': 2},
        500: {'price_ghs': 40.00, 'bonus_coins': 50, 'label': 'Best Value', 'sort_order': 3},
        1000: {'price_ghs': 70.00, 'bonus_coins': 100, 'label': 'Super Reader', 'sort_order': 4},
    }
    if CoinPackage.query.count() == 0:
        for coins, vals in EXPECTED.items():
            db.session.add(CoinPackage(coins=coins, **vals))
        db.session.commit()
        log.info("Seeded %d default coin packages", len(EXPECTED))
    else:
        updated = 0
        for coins, vals in EXPECTED.items():
            pkg = CoinPackage.query.filter_by(coins=coins).first()
            if pkg and pkg.price_ghs != vals['price_ghs']:
                pkg.price_ghs = vals['price_ghs']
                updated += 1
        if updated:
            db.session.commit()
            log.info("Updated %d coin package prices", updated)