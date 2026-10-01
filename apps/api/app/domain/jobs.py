"""Pure domain functions for background jobs, notifications, and scheduled policies.

Zero framework dependencies (no FastAPI, no SQLAlchemy).
"""

import re
from datetime import datetime, timedelta


def is_match_auto_confirmable(
    status: str,
    submitted_at: datetime,
    current_time: datetime,
    auto_confirm_hours: int = 48,
) -> bool:
    """Evaluate whether an unconfirmed submitted match has exceeded the dispute window."""
    if status.lower() != "submitted":
        return False
    cutoff = submitted_at + timedelta(hours=auto_confirm_hours)
    return current_time >= cutoff


def is_player_inactive(
    last_activity_at: datetime | None,
    season_start_at: datetime,
    current_time: datetime,
    inactive_threshold_days: int = 7,
) -> bool:
    """Evaluate whether a player has had no match activity within the threshold days."""
    reference_point = last_activity_at or season_start_at
    cutoff = reference_point + timedelta(days=inactive_threshold_days)
    return current_time >= cutoff


def validate_expo_push_token(token: str) -> bool:
    """Validate whether a push token matches Expo's standard token format."""
    if not token or not isinstance(token, str):
        return False
    # Format: ExponentPushToken[...] or ExpoPushToken[...]
    pattern = r"^(ExponentPushToken|ExpoPushToken)\[[a-zA-Z0-9_\-]+\]$"
    return bool(re.match(pattern, token.strip()))


def format_kickoff_notification(
    division_name: str,
    program_title: str,
    player_name: str,
    opponents: list[dict[str, str]],
) -> dict[str, str]:
    """Format kickoff broadcast notification payload for a division participant."""
    opponent_count = len(opponents)
    push_title = f"🎾 Kickoff: {division_name}"
    push_body = (
        f"Hi {player_name}! Your division is live with {opponent_count} players. "
        "Open the app to view your roster and schedule your first match."
    )
    email_subject = f"Accra Tennis Kickoff: {program_title} - {division_name}"

    opponent_lines = []
    for opp in opponents:
        name = opp.get("name", "Unknown Player")
        phone = opp.get("phone", "No phone provided")
        email = opp.get("email", "No email provided")
        rating = opp.get("rating", "3.5")
        opponent_lines.append(f"• {name} (NTRP {rating}) — Phone: {phone}, Email: {email}")

    roster_text = "\n".join(opponent_lines) if opponent_lines else "No opponents found."

    email_text = f"""Hello {player_name},

Welcome to the new season of Accra Flex Tennis League!
Your division ({division_name}) is officially underway.

Here is your division roster and contact details:
{roster_text}

Rules Reminder:
1. Contact opponents to agree on court location, date, and surface.
2. The winner reports the score in the app immediately after the match.
3. Opponents have 48 hours to confirm or dispute the reported score.

Have great matches!
Accra Flex Tennis League Team
"""
    return {
        "push_title": push_title,
        "push_body": push_body,
        "email_subject": email_subject,
        "email_body": email_text,
    }


def format_inactive_nudge(
    player_name: str,
    division_name: str,
    days_inactive: int,
) -> dict[str, str]:
    """Format weekly inactive player nudge notification."""
    push_title = "🎾 Time for your next tennis match!"
    push_body = (
        f"Hi {player_name}, it has been {days_inactive} days since your last match in {division_name}. "
        "Reach out to an opponent and book a court today!"
    )
    email_subject = f"Friendly Reminder: Book your next flex match in {division_name}"
    email_text = f"""Hello {player_name},

We noticed it has been {days_inactive} days since your last match in {division_name}.

Playing regular matches keeps your rhythm sharp and ensures all division matches are completed before the playoff deadline!

Check out your division roster in the app, contact an opponent, and book an Accra court this week.

Best regards,
Accra Flex Tennis League Team
"""
    return {
        "push_title": push_title,
        "push_body": push_body,
        "email_subject": email_subject,
        "email_body": email_text,
    }


def format_auto_confirm_notification(
    winner_name: str,
    loser_name: str,
    score_summary: str,
) -> dict[str, str]:
    """Format match score auto-confirmation notification."""
    push_title = "✅ Match Score Confirmed"
    push_body = (
        f"Match confirmed: {winner_name} def. {loser_name} ({score_summary}). Standings updated!"
    )
    email_subject = f"Match Confirmed: {winner_name} vs {loser_name}"
    email_text = f"""Hello,

The 48-hour dispute window has closed and the match score has been auto-confirmed:

Winner: {winner_name}
Opponent: {loser_name}
Score: {score_summary}

Division standings have been updated accordingly.

Accra Flex Tennis League Team
"""
    return {
        "push_title": push_title,
        "push_body": push_body,
        "email_subject": email_subject,
        "email_body": email_text,
    }


def format_backup_filename(market_slug: str, timestamp: datetime) -> str:
    """Format timestamped and sanitized encrypted backup filename for R2 storage."""
    clean_slug = re.sub(r"[^a-zA-Z0-9_\-]", "_", market_slug.lower())
    ts_str = timestamp.strftime("%Y%m%d_%H%M%S")
    return f"backup_{clean_slug}_{ts_str}.sql.gz.enc"
