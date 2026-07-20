"""
Founder AI Analytics — AI-powered insights for platform management.
Provides automated content analysis, user behavior patterns, and predictive analytics.
"""

import logging
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from sqlalchemy import func, and_
from ..extensions import db
from ..models import (
    User, Content, Rating, CoinTransaction,
    CreatorEarnings, UserWarning, ChapterComment, ParagraphComment
)

log = logging.getLogger(__name__)


def get_content_trends(days=30):
    """Analyze content trends using AI-like pattern detection."""
    try:
        # Recent content with engagement metrics
        recent_content = db.session.query(
            Content.id, Content.title, Content.genre, Content.status,
            func.count(Rating.id).label('rating_count'),
            func.avg(Rating.rating).label('avg_rating'),
            func.count(ChapterComment.id).label('comment_count'),
            func.count(CoinTransaction.id).label('coin_tips')
        ).filter(
            Content.created_at >= datetime.utcnow() - timedelta(days=days),
            Content.deleted_at == None
        ).join(Rating, Content.id == Rating.content_id).outerjoin(
            User, User.id == Rating.user_id
        ).outerjoin(ChapterComment, ChapterComment.content_id == Content.id).outerjoin(
            User, User.id == ChapterComment.user_id
        ).join(CoinTransaction, CoinTransaction.content_id == Content.id).outerjoin(
            User, User.id == CoinTransaction.user_id
        ).group_by(Content.id).order_by(Content.created_at.desc()).limit(100).all()
        
        if not recent_content:
            return {"trends": [], "insights": []}
        
        # Analyze patterns
        genres = Counter([c.genre for c in recent_content if c.genre])
        status_dist = Counter([c.status for c in recent_content])
        
        # Top performing content
        top_content = sorted(recent_content, key=lambda x: (
            (x.rating_count or 0) * 3 +
            (x.coin_tips or 0) * 2 +
            (x.comment_count or 0)
        ), reverse=True)[:10]
        
        # Engagement insights
        total_ratings = sum(c.rating_count or 0 for c in recent_content)
        total_tips = sum(c.coin_tips or 0 for c in recent_content)
        total_comments = sum(c.comment_count or 0 for c in recent_content)
        
        insights = [
            f"📈 {len(recent_content)} pieces of content analyzed",
            f"⭐ Top genre: {genres.most_common(1)[0] if genres else 'N/A'}",
            f"💰 {total_tips} total tips received",
            f"💬 {total_comments} total comments",
            f"📊 {total_ratings} total ratings"
        ]
        
        return {
            "trends": {
                "genres": dict(genres),
                "status_distribution": dict(status_dist),
                "avg_rating": sum(c.avg_rating or [] for c in recent_content) / len(recent_content) if recent_content else 0
            },
            "top_content": [
                {
                    "id": c.id,
                    "title": c.title,
                    "genre": c.genre,
                    "rating_count": c.rating_count or 0,
                    "avg_rating": round(c.avg_rating, 2) if c.avg_rating else 0,
                    "coin_tips": c.coin_tips or 0,
                    "comment_count": c.comment_count or 0,
                    "engagement_score": (c.rating_count or 0) * 3 + (c.coin_tips or 0) * 2 + (c.comment_count or 0)
                } for c in top_content
            ],
            "insights": insights
        }
        
    except Exception as e:
        log.error(f"Founder AI analytics error: {e}")
        return {"trends": {}, "insights": [], "error": str(e)}


def detect_content_issues(content_text, content_type='general'):
    """AI-powered content issue detection for founder review."""
    issues = []
    
    # Quality indicators
    if len(content_text) < 100:
        issues.append("Very short content")
    if content_text.count('.') > len(content_text) * 0.1:
        issues.append("Excessive punctuation")
    
    # Content safety patterns (simplified)
    suspicious_patterns = [
        "spam", "repeat", "copy", "duplicate",
        "clickbait", "misleading", "fake"
    ]
    
    text_lower = content_text.lower()
    for pattern in suspicious_patterns:
        if pattern in text_lower:
            issues.append(f"Potential {pattern}")
    
    # Engagement manipulation detection
    if content_type == 'comments' and len(content_text) < 10:
        issues.append("Low-effort comment")
    
    return issues


def get_user_behavior_analysis(user_id, days=30):
    """Analyze user behavior patterns for founder insights."""
    try:
        user = User.query.get(user_id)
        if not user:
            return {"error": "User not found"}
        
        # Recent activity
        recent_ratings = Rating.query.filter(
            Rating.user_id == user_id,
            Rating.created_at >= datetime.utcnow() - timedelta(days=days)
        ).count()
        
        recent_comments = (
            ChapterComment.query.filter(
                ChapterComment.user_id == user_id,
                ChapterComment.created_at >= datetime.utcnow() - timedelta(days=days)
            ).count()
            + ParagraphComment.query.filter(
                ParagraphComment.user_id == user_id,
                ParagraphComment.created_at >= datetime.utcnow() - timedelta(days=days)
            ).count()
        )
        
        recent_reports = UserWarning.query.filter(
            UserWarning.user_id == user_id,
            UserWarning.created_at >= datetime.utcnow() - timedelta(days=days)
        ).count()
        
        # Content creation patterns
        user_content = Content.query.filter(
            Content.user_id == user_id,
            Content.created_at >= datetime.utcnow() - timedelta(days=days)
        ).order_by(Content.created_at.desc()).limit(20).all()
        
        # Behavior analysis
        behavior_score = 0
        insights = []
        
        if recent_ratings > 50:
            behavior_score += 2
            insights.append("📊 Very active rater")
        
        if recent_comments > 100:
            behavior_score += 1
            insights.append("💬 Highly engaged commenter")
        
        if recent_reports > 3:
            behavior_score -= 3
            insights.append("⚠️ Multiple reports received")
        
        # Content quality patterns
        if user_content:
            avg_content_length = sum(len(c.title or '') + (c.description or '') for c in user_content) / len(user_content)
            if avg_content_length < 50:
                insights.append("📝 Creates minimal content")
            elif avg_content_length > 1000:
                insights.append("📚 Creates very long content")
        
        # Account age factor
        days_since_join = (datetime.utcnow() - user.date_joined).days if user.date_joined else 0
        if days_since_join < 7:
            behavior_score -= 1
            insights.append("🆕 Very new account")
        elif days_since_join > 365:
            behavior_score += 1
            insights.append("👤 Established user")
        
        trust_score = max(0, min(100, behavior_score))
        
        return {
            "user_id": user_id,
            "username": user.username,
            "behavior_score": behavior_score,
            "trust_score": trust_score,
            "recent_ratings": recent_ratings,
            "recent_comments": recent_comments,
            "recent_reports": recent_reports,
            "insights": insights
        }
        
    except Exception as e:
        log.error(f"User behavior analysis error: {e}")
        return {"error": str(e)}


def get_platform_health():
    """Overall platform health metrics for founder dashboard."""
    try:
        # Content metrics
        total_content = Content.query.count()
        published_content = Content.query.filter(
            Content.status.in_(Content.PUBLISHED_STATUSES)
        ).count()
        
        # User metrics
        total_users = User.query.count()
        active_users = User.query.filter(
            User.last_active >= datetime.utcnow() - timedelta(days=7)
        ).count()
        
        # Engagement metrics
        total_ratings = Rating.query.count()
        total_comments = ChapterComment.query.count() + ParagraphComment.query.count()
        total_tips = CoinTransaction.query.filter(
            CoinTransaction.type == 'tip'
        ).count()
        
        # Quality metrics
        avg_rating = db.session.query(func.avg(Rating.rating)).scalar() or 0
        
        health_score = 0
        if published_content > total_content * 0.5:
            health_score += 2
        
        if avg_rating >= 4.0:
            health_score += 2
        
        if total_users > 0 and active_users / total_users > 0.3:
            health_score += 1
        
        health_status = "Excellent" if health_score >= 4 else "Good" if health_score >= 3 else "Fair" if health_score >= 2 else "Needs Attention"
        
        return {
            "health_score": health_score,
            "health_status": health_status,
            "metrics": {
                "total_content": total_content,
                "published_content": published_content,
                "total_users": total_users,
                "active_users": active_users,
                "total_ratings": total_ratings,
                "total_comments": total_comments,
                "total_tips": total_tips,
                "avg_rating": round(avg_rating, 2)
            }
        }
        
    except Exception as e:
        log.error(f"Platform health error: {e}")
        return {"error": str(e)}
