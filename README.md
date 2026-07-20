# WiamApp

**Free novel reading platform** by WiamLabs. Readers discover and enjoy stories for free. Creators write, publish, and earn through coin tips and monetization.

## Architecture

| Component | Tech | Host |
|---|---|---|
| **Web App** | Python Flask + Jinja2 | Render (free tier) |
| **Database** | PostgreSQL | Supabase (managed Postgres) |
| **Telegram Bot** | python-telegram-bot | Same Render process |
| **Payments** | Paystack (Ghana) | — |
| **Email** | SMTP | — |

## Quick Start (Local Development)

### Prerequisites
- Python 3.12+
- PostgreSQL (or use Supabase / a managed Postgres provider)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/WiamLabs/WiamApp.git
cd WiamApp

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment variables
cp .env.example .env
# Edit .env with your values (see .env.example for documentation)

# 5. Run locally
python server.py
# App runs at http://localhost:8080
```

## Deployment (Render)

1. Push code to GitHub
2. Go to [dashboard.render.com](https://dashboard.render.com)
3. Create **New Web Service** → connect your repo
4. Settings:
   - **Environment**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Plan**: Free
5. Add environment variables (see `.env.example` for the full list)
6. Deploy

The `render.yaml` blueprint file is included for automated setup.

### Key Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string (production); set in Render dashboard |
| `BOT_TOKEN` | Yes | Telegram bot token from @BotFather |
| `APP_URL` | Yes | Public URL (e.g. `https://wiamapp.onrender.com`) |
| `FLASK_SECRET_KEY` | Yes | Session encryption key |
| `PAYSTACK_SECRET_KEY` | For payments | Paystack API secret key |
| `SMTP_HOST` | For email | SMTP server hostname |

See `.env.example` for the complete list with descriptions.

## Project Structure

```
WiamApp/
├── server.py              ← Production entrypoint (Flask + Bot)
├── bot.py                 ← Telegram bot (221KB, all handlers)
├── webapp/
│   ├── __init__.py        ← Flask app factory + migrations
│   ├── config.py          ← Configuration from env vars
│   ├── extensions.py      ← Flask extensions (DB, CSRF, etc.)
│   ├── models.py          ← SQLAlchemy database models
│   ├── auth.py            ← Authentication (email, Google OAuth)
│   ├── routes/            ← All web routes (22 files)
│   ├── services/          ← Business logic (16 files)
│   ├── templates/         ← Jinja2 HTML templates (139 files)
│   └── static/            ← CSS, JS, images
├── Dockerfile             ← Docker build config
├── render.yaml            ← Render deployment blueprint
├── requirements.txt       ← Python dependencies
└── .env.example           ← All environment variables documented
```

## Key Routes

| Route File | What It Handles |
|---|---|
| `home.py` | Landing page, home feed, trending |
| `book.py` | Book detail, reader, chapters, reviews |
| `studio.py` | Creator writing studio |
| `creator.py` | Creator profiles, follow/unfollow |
| `founder.py` | Founder dashboard, admin tools |
| `payment.py` | Paystack coin purchases, payouts |
| `team.py` | Team role dashboards |
| `elite.py` | WiamElite hall of fame |
| `auth (auth.py)` | Login, register, Google OAuth |

## License

Proprietary — WiamLabs. All rights reserved.
