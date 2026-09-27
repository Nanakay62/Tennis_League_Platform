"""Schemas for notification and device management."""

from datetime import datetime

from pydantic import BaseModel, Field


class RegisterDeviceRequest(BaseModel):
    push_token: str = Field(..., description="Expo push notification token")
    platform: str = Field(default="ios", description="Device platform (ios, android, web)")


class DeviceResponse(BaseModel):
    id: str
    push_token: str
    platform: str
    is_active: bool
    created_at: datetime


class NotificationHistoryItem(BaseModel):
    id: str
    channel: str
    event_type: str
    title: str
    body: str
    status: str
    created_at: datetime
