"""Service layer for custom administrative actions with strict audit trail enforcement."""

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin_actions.schemas import (
    AdminActionResponse,
    BulkPlacementRequest,
    ManageStrikeRequest,
    ResolveDisputeRequest,
    TransferPlayerRequest,
    VoidMatchRequest,
)
from app.catalog.models import Division
from app.identity.models import User
from app.leagues.models import Enrollment, EnrollmentStatus
from app.matches.models import (
    AuditLog,
    DisputeStatus,
    Match,
    MatchDispute,
    MatchStatus,
    Strike,
    StrikeStatus,
)
from app.matches.service import recalculate_division_standings


async def execute_bulk_placement(
    session: AsyncSession,
    admin_user: User,
    req: BulkPlacementRequest,
) -> AdminActionResponse:
    """Place players into a division in bulk, logging an AuditLog row for each placement."""
    div = await session.get(Division, req.division_id)
    if not div:
        raise ValueError(f"Target division '{req.division_id}' not found.")

    placed_count = 0
    last_audit_id = ""

    for user_id in req.user_ids:
        # Find active enrollment for this user and program
        stmt = select(Enrollment).where(
            Enrollment.user_id == user_id,
            Enrollment.program_id == div.program_id,
        )
        res = await session.execute(stmt)
        enr = res.scalar_one_or_none()

        if enr:
            enr.division_id = div.id
            enr.status = EnrollmentStatus.PLACED_IN_DIVISION
        else:
            enr = Enrollment(
                market_id=div.market_id,
                program_id=div.program_id,
                division_id=div.id,
                user_id=user_id,
                status=EnrollmentStatus.PLACED_IN_DIVISION,
            )
            session.add(enr)

        # AuditLog entry (Non-negotiable Rule 6)
        audit = AuditLog(
            market_id=div.market_id,
            entity_type="placement",
            entity_id=user_id,
            actor_id=admin_user.id,
            action="player_placed_in_division",
            reason=f"Bulk placed into division '{div.name}'",
            changes_json=json.dumps({"division_id": div.id, "division_name": div.name}),
        )
        session.add(audit)
        await session.flush()
        last_audit_id = audit.id
        placed_count += 1

    await session.commit()
    return AdminActionResponse(
        status="ok",
        message=f"Successfully placed {placed_count} players into division '{div.name}'.",
        audit_id=last_audit_id,
    )


async def execute_transfer_player(
    session: AsyncSession,
    admin_user: User,
    req: TransferPlayerRequest,
) -> AdminActionResponse:
    """Transfer an enrolled player between divisions with audit log."""
    target_div = await session.get(Division, req.to_division_id)
    if not target_div:
        raise ValueError(f"Target division '{req.to_division_id}' not found.")

    stmt = select(Enrollment).where(
        Enrollment.user_id == req.user_id,
        Enrollment.division_id == req.from_division_id,
    )
    res = await session.execute(stmt)
    enr = res.scalar_one_or_none()
    if not enr:
        raise ValueError(f"Player enrollment in division '{req.from_division_id}' not found.")

    enr.division_id = target_div.id

    # Recalculate standings for both divisions
    await recalculate_division_standings(session, req.from_division_id)
    await recalculate_division_standings(session, target_div.id)

    # AuditLog entry
    audit = AuditLog(
        market_id=target_div.market_id,
        entity_type="placement",
        entity_id=req.user_id,
        actor_id=admin_user.id,
        action="player_transferred_division",
        reason=req.reason,
        changes_json=json.dumps(
            {
                "from_division_id": req.from_division_id,
                "to_division_id": target_div.id,
            }
        ),
    )
    session.add(audit)
    await session.commit()

    return AdminActionResponse(
        status="ok",
        message=f"Player transferred to '{target_div.name}'.",
        audit_id=audit.id,
    )


async def execute_resolve_dispute(
    session: AsyncSession,
    admin_user: User,
    req: ResolveDisputeRequest,
) -> AdminActionResponse:
    """Resolve a match dispute (upheld or corrected) and update standings."""
    dispute = await session.get(MatchDispute, req.dispute_id)
    if not dispute:
        raise ValueError(f"Dispute '{req.dispute_id}' not found.")

    match = await session.get(Match, dispute.match_id)
    if not match:
        raise ValueError("Disputed match record not found.")

    if req.resolution not in (DisputeStatus.RESOLVED_UPHELD, DisputeStatus.RESOLVED_CHANGED):
        raise ValueError(f"Invalid resolution '{req.resolution}'.")

    dispute.status = req.resolution
    dispute.admin_notes = req.admin_notes

    if req.resolution == DisputeStatus.RESOLVED_CHANGED and req.corrected_sets:
        match.sets_json = json.dumps(req.corrected_sets)

    match.status = MatchStatus.CONFIRMED

    # Live recalculation of standings
    await recalculate_division_standings(session, match.division_id)

    # AuditLog entry
    audit = AuditLog(
        market_id=match.market_id,
        entity_type="dispute",
        entity_id=dispute.id,
        actor_id=admin_user.id,
        action="dispute_resolved",
        reason=req.admin_notes,
        changes_json=json.dumps(
            {
                "resolution": req.resolution,
                "match_id": match.id,
                "corrected_sets": req.corrected_sets,
            }
        ),
    )
    session.add(audit)
    await session.commit()

    return AdminActionResponse(
        status="ok",
        message=f"Dispute resolved as '{req.resolution}'. Match confirmed and standings updated.",
        audit_id=audit.id,
    )


async def execute_manage_strike(
    session: AsyncSession,
    admin_user: User,
    req: ManageStrikeRequest,
) -> AdminActionResponse:
    """Confirm, appeal, or dismiss a discipline strike with audit trail."""
    strike = await session.get(Strike, req.strike_id)
    if not strike:
        raise ValueError(f"Strike '{req.strike_id}' not found.")

    action_lower = req.action.lower()
    if action_lower == "confirm":
        strike.status = StrikeStatus.CONFIRMED
    elif action_lower == "dismiss":
        strike.status = StrikeStatus.DISMISSED
    elif action_lower == "appeal":
        strike.status = StrikeStatus.APPEALED
    else:
        raise ValueError(
            f"Invalid strike action '{req.action}'. Expected confirm, dismiss, or appeal."
        )

    # AuditLog entry
    audit = AuditLog(
        market_id=strike.market_id,
        entity_type="strike",
        entity_id=strike.id,
        actor_id=admin_user.id,
        action=f"strike_{action_lower}",
        reason=req.reason,
        changes_json=json.dumps({"new_status": strike.status}),
    )
    session.add(audit)
    await session.commit()

    return AdminActionResponse(
        status="ok",
        message=f"Strike updated to status '{strike.status}'.",
        audit_id=audit.id,
    )


async def execute_void_match(
    session: AsyncSession,
    admin_user: User,
    req: VoidMatchRequest,
) -> AdminActionResponse:
    """Void a match result and recalculate standings live with required AuditLog."""
    match = await session.get(Match, req.match_id)
    if not match:
        raise ValueError(f"Match '{req.match_id}' not found.")

    match.status = MatchStatus.VOIDED

    # Recalculate standings without the voided match
    await recalculate_division_standings(session, match.division_id)

    # AuditLog entry (Non-negotiable Rule 6)
    audit = AuditLog(
        market_id=match.market_id,
        entity_type="match",
        entity_id=match.id,
        actor_id=admin_user.id,
        action="match_voided",
        reason=req.reason,
        changes_json=json.dumps({"status": MatchStatus.VOIDED}),
    )
    session.add(audit)
    await session.commit()

    return AdminActionResponse(
        status="ok",
        message="Match successfully voided and division standings updated.",
        audit_id=audit.id,
    )
