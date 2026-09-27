"""FastAPI routes for custom administrative actions."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin_actions.schemas import (
    AdminActionResponse,
    BulkPlacementRequest,
    ManageStrikeRequest,
    ResolveDisputeRequest,
    TransferPlayerRequest,
    VoidMatchRequest,
)
from app.admin_actions.service import (
    execute_bulk_placement,
    execute_manage_strike,
    execute_resolve_dispute,
    execute_transfer_player,
    execute_void_match,
)
from app.db import get_db
from app.identity.deps import get_current_admin_user
from app.identity.models import User

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post(
    "/bulk-placement",
    response_model=AdminActionResponse,
    summary="Bulk place players into a division",
)
async def bulk_placement(
    req: BulkPlacementRequest,
    session: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
) -> AdminActionResponse:
    try:
        return await execute_bulk_placement(session, admin_user, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post(
    "/transfer-player",
    response_model=AdminActionResponse,
    summary="Transfer a player between divisions",
)
async def transfer_player(
    req: TransferPlayerRequest,
    session: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
) -> AdminActionResponse:
    try:
        return await execute_transfer_player(session, admin_user, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post(
    "/resolve-dispute",
    response_model=AdminActionResponse,
    summary="Resolve a match dispute and recalculate standings",
)
async def resolve_dispute(
    req: ResolveDisputeRequest,
    session: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
) -> AdminActionResponse:
    try:
        return await execute_resolve_dispute(session, admin_user, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post(
    "/manage-strike",
    response_model=AdminActionResponse,
    summary="Confirm, appeal, or dismiss a discipline strike",
)
async def manage_strike(
    req: ManageStrikeRequest,
    session: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
) -> AdminActionResponse:
    try:
        return await execute_manage_strike(session, admin_user, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post(
    "/void-match",
    response_model=AdminActionResponse,
    summary="Void a match result and update standings",
)
async def void_match(
    req: VoidMatchRequest,
    session: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
) -> AdminActionResponse:
    try:
        return await execute_void_match(session, admin_user, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
