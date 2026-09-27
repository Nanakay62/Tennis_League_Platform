"""Pydantic schemas for administrative actions."""

from typing import Any

from pydantic import BaseModel, Field


class BulkPlacementRequest(BaseModel):
    division_id: str = Field(..., description="Target division ID for placement")
    user_ids: list[str] = Field(..., description="List of user IDs to place into division")


class TransferPlayerRequest(BaseModel):
    user_id: str = Field(..., description="User ID to transfer")
    from_division_id: str = Field(..., description="Current division ID")
    to_division_id: str = Field(..., description="Target division ID")
    reason: str = Field(..., description="Administrative reason for transfer")


class ResolveDisputeRequest(BaseModel):
    dispute_id: str = Field(..., description="Match dispute ID")
    resolution: str = Field(..., description="Resolution: 'resolved_upheld' or 'resolved_changed'")
    admin_notes: str = Field(..., description="Reasoning and notes for dispute resolution")
    corrected_sets: list[dict[str, Any]] | None = Field(
        default=None, description="Optional corrected sets if resolution is resolved_changed"
    )


class ManageStrikeRequest(BaseModel):
    strike_id: str = Field(..., description="Discipline strike ID")
    action: str = Field(..., description="'confirm', 'dismiss', or 'appeal'")
    reason: str = Field(..., description="Administrative reason for action")


class VoidMatchRequest(BaseModel):
    match_id: str = Field(..., description="Match ID to void")
    reason: str = Field(..., description="Administrative reason for voiding match")


class AdminActionResponse(BaseModel):
    status: str
    message: str
    audit_id: str
