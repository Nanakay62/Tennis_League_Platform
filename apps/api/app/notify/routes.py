"""FastAPI routes for device registration and notification history."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.identity.deps import get_current_user
from app.identity.models import User
from app.notify.schemas import DeviceResponse, NotificationHistoryItem, RegisterDeviceRequest
from app.notify.service import (
    get_user_devices,
    get_user_notifications,
    register_device,
    unregister_device,
)

router = APIRouter(prefix="", tags=["Notifications"])


@router.post("/devices", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def register_push_device(
    payload: RegisterDeviceRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Register or refresh an Expo push notification token for the current user."""
    try:
        device = await register_device(
            session=session,
            user_id=current_user.id,
            push_token=payload.push_token,
            platform=payload.platform,
        )
        return DeviceResponse(
            id=device.id,
            push_token=device.push_token,
            platform=device.platform,
            is_active=device.is_active,
            created_at=device.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(e))


@router.delete("/devices/{push_token}", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_push_device(
    push_token: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Deactivate a registered push token for the current user."""
    ok = await unregister_device(session=session, user_id=current_user.id, push_token=push_token)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")


@router.get("/devices", response_model=list[DeviceResponse])
async def list_user_devices(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """List active push notification devices for the current user."""
    devices = await get_user_devices(session=session, user_id=current_user.id, active_only=True)
    return [
        DeviceResponse(
            id=d.id,
            push_token=d.push_token,
            platform=d.platform,
            is_active=d.is_active,
            created_at=d.created_at,
        )
        for d in devices
    ]


@router.get("/notifications/history", response_model=list[NotificationHistoryItem])
async def list_user_notification_history(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieve recent notification history for the current user."""
    logs = await get_user_notifications(session=session, user_id=current_user.id)
    return [
        NotificationHistoryItem(
            id=l.id,
            channel=l.channel,
            event_type=l.event_type,
            title=l.title,
            body=l.body,
            status=l.status,
            created_at=l.created_at,
        )
        for l in logs
    ]


@router.post("/jobs/kickoff/{division_id}")
async def trigger_kickoff_broadcast(
    division_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Trigger kickoff broadcast notification job for a division."""
    from app.jobs import run_kickoff_broadcast

    res = await run_kickoff_broadcast(division_id=division_id, session=session)
    return res


@router.post("/jobs/nudges")
async def trigger_inactive_player_nudges(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Trigger weekly inactive player reminder job for user's market."""
    from app.jobs import run_inactive_player_nudges

    res = await run_inactive_player_nudges(market_id=current_user.market_id, session=session)
    return res


@router.post("/jobs/auto-confirm")
async def trigger_auto_confirm_matches(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Trigger match auto-confirmation job for user's market."""
    from app.jobs import run_auto_confirm_matches

    res = await run_auto_confirm_matches(market_id=current_user.market_id, session=session)
    return res


@router.post("/jobs/backup")
async def trigger_database_backup(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Trigger nightly database backup job."""
    from app.jobs import run_nightly_backup

    res = await run_nightly_backup(market_id=current_user.market_id, session=session)
    return res
