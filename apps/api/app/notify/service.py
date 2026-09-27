"""Notification dispatch and device registration service."""

from datetime import UTC, datetime
from typing import Any

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.domain.jobs import validate_expo_push_token
from app.identity.models import User
from app.notify.models import NotificationChannel, NotificationLog, NotificationStatus, UserDevice

logger = structlog.get_logger(__name__)


async def register_device(
    session: AsyncSession,
    user_id: str,
    push_token: str,
    platform: str = "ios",
) -> UserDevice:
    """Register or reactivate an Expo push notification token for a user."""
    clean_token = push_token.strip()
    if not validate_expo_push_token(clean_token):
        raise ValueError(f"Invalid Expo push token format: {clean_token}")

    # Check for existing device with this token
    stmt = select(UserDevice).where(UserDevice.push_token == clean_token)
    result = await session.execute(stmt)
    device = result.scalar_one_or_none()

    if device:
        device.user_id = user_id
        device.platform = platform
        device.is_active = True
        device.updated_at = datetime.now(UTC)
    else:
        device = UserDevice(
            user_id=user_id,
            push_token=clean_token,
            platform=platform,
            is_active=True,
        )
        session.add(device)

    await session.commit()
    await session.refresh(device)
    return device


async def unregister_device(
    session: AsyncSession,
    user_id: str,
    push_token: str,
) -> bool:
    """Deactivate a registered push token."""
    clean_token = push_token.strip()
    stmt = select(UserDevice).where(
        UserDevice.user_id == user_id,
        UserDevice.push_token == clean_token,
    )
    result = await session.execute(stmt)
    device = result.scalar_one_or_none()

    if not device:
        return False

    device.is_active = False
    device.updated_at = datetime.now(UTC)
    await session.commit()
    return True


async def get_user_devices(
    session: AsyncSession,
    user_id: str,
    active_only: bool = True,
) -> list[UserDevice]:
    """Retrieve registered devices for a user."""
    stmt = select(UserDevice).where(UserDevice.user_id == user_id)
    if active_only:
        stmt = stmt.where(UserDevice.is_active.is_(True))
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def send_expo_push_notifications(
    tokens: list[str],
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Send push notifications via Expo Push API with batching and error handling."""
    settings = get_settings()
    if not tokens:
        return []

    messages = [
        {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        for token in tokens
        if validate_expo_push_token(token)
    ]

    if not messages:
        return []

    results: list[dict[str, Any]] = []
    # Expo recommends chunks of up to 100 messages
    chunk_size = 100
    chunks = [messages[i : i + chunk_size] for i in range(0, len(messages), chunk_size)]

    async with httpx.AsyncClient(timeout=10.0) as client:
        for chunk in chunks:
            try:
                response = await client.post(
                    settings.EXPO_PUSH_URL,
                    json=chunk,
                    headers={
                        "Accept": "application/json",
                        "Accept-Encoding": "gzip, deflate",
                        "Content-Type": "application/json",
                    },
                )
                if response.status_code == 200:
                    results.append({"status": "ok", "count": len(chunk), "data": response.json()})
                else:
                    logger.warning(
                        "expo_push_failed", status=response.status_code, text=response.text
                    )
                    results.append({"status": "error", "code": response.status_code})
            except Exception as e:  # noqa: BLE001
                logger.error("expo_push_exception", error=str(e))
                results.append({"status": "error", "exception": str(e)})

    return results


async def send_email(
    to_email: str,
    subject: str,
    text_content: str,
    html_content: str | None = None,
) -> bool:
    """Send transactional email via Resend or log to console."""
    settings = get_settings()

    if settings.EMAIL_PROVIDER.lower() == "resend" and settings.RESEND_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": settings.EMAIL_FROM,
                        "to": [to_email],
                        "subject": subject,
                        "text": text_content,
                        "html": html_content or f"<pre>{text_content}</pre>",
                    },
                )
                return resp.status_code in (200, 201)
        except Exception as e:  # noqa: BLE001
            logger.error("email_send_exception", to=to_email, error=str(e))
            return False

    # Default / Development: log transactional email
    logger.info(
        "console_email_dispatched",
        to=to_email,
        subject=subject,
        preview=text_content[:80],
    )
    return True


async def dispatch_user_notification(
    session: AsyncSession,
    user_id: str,
    event_type: str,  # "kickoff", "reminders", "results"
    title: str,
    body: str,
    email_subject: str | None = None,
    email_body: str | None = None,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Dispatch email and/or push notification according to user communication preferences."""
    stmt = select(User).options(selectinload(User.communication_settings)).where(User.id == user_id)
    user_res = await session.execute(stmt)
    user = user_res.scalar_one_or_none()
    if not user or not user.is_active:
        return {"status": "skipped", "reason": "user_inactive_or_not_found"}

    prefs = user.communication_settings
    # Default to True if no preferences set
    push_allowed = True
    email_allowed = True

    if prefs:
        if event_type == "kickoff":
            push_allowed = prefs.push_kickoff
            email_allowed = prefs.email_kickoff
        elif event_type == "reminders":
            push_allowed = prefs.push_reminders
            email_allowed = prefs.email_reminders
        elif event_type == "results":
            push_allowed = prefs.push_results
            email_allowed = prefs.email_results

    dispatched = {"push": False, "email": False}

    # Handle Push
    if push_allowed:
        devices = await get_user_devices(session, user_id, active_only=True)
        tokens = [d.push_token for d in devices]
        if tokens:
            await send_expo_push_notifications(tokens, title=title, body=body, data=data)
            push_log = NotificationLog(
                user_id=user_id,
                channel=NotificationChannel.PUSH,
                event_type=event_type,
                title=title,
                body=body,
                status=NotificationStatus.SENT,
            )
            session.add(push_log)
            dispatched["push"] = True
        else:
            push_log = NotificationLog(
                user_id=user_id,
                channel=NotificationChannel.PUSH,
                event_type=event_type,
                title=title,
                body=body,
                status=NotificationStatus.SKIPPED,
            )
            session.add(push_log)

    # Handle Email
    if email_allowed and user.email:
        final_subject = email_subject or title
        final_body = email_body or body
        email_ok = await send_email(user.email, final_subject, final_body)
        email_log = NotificationLog(
            user_id=user_id,
            channel=NotificationChannel.EMAIL,
            event_type=event_type,
            title=final_subject,
            body=final_body,
            status=NotificationStatus.SENT if email_ok else NotificationStatus.FAILED,
        )
        session.add(email_log)
        dispatched["email"] = email_ok

    await session.commit()
    return dispatched


async def get_user_notifications(
    session: AsyncSession,
    user_id: str,
    limit: int = 50,
) -> list[NotificationLog]:
    """Fetch user's recent notifications history."""
    stmt = (
        select(NotificationLog)
        .where(NotificationLog.user_id == user_id)
        .order_by(NotificationLog.created_at.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
