"""SQLAdmin back office configuration, role-based authentication, and model views."""

from fastapi import FastAPI
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from sqlalchemy import select
from starlette.requests import Request

from app.catalog.models import Division, Program
from app.community.models import Court
from app.config import get_settings
from app.db import async_session_maker, engine
from app.identity.models import PlayerProfile, User, UserRole
from app.identity.security import verify_password
from app.leagues.models import Enrollment
from app.markets.models import Market
from app.matches.models import AuditLog, Match, MatchDispute, Strike
from app.notify.models import NotificationLog, UserDevice
from app.playoffs.models import PlayoffBracket

settings = get_settings()


class AdminAuth(AuthenticationBackend):
    """Session-based authentication for SQLAdmin back office."""

    async def login(self, request: Request) -> bool:
        form = await request.form()
        email = str(form.get("username") or form.get("email") or "").strip()
        password = str(form.get("password") or "")

        if not email or not password:
            return False

        async with async_session_maker() as session:
            stmt = select(User).where(User.email == email)
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()

            if not user or not user.is_active:
                return False

            if not verify_password(password, user.hashed_password):
                return False

            # Role-based gating: Market Admin or Super Admin only
            if user.role not in (UserRole.MARKET_ADMIN, UserRole.SUPER_ADMIN):
                return False

            request.session.update(
                {
                    "admin_user_id": user.id,
                    "admin_email": user.email,
                    "admin_role": user.role,
                    "admin_market_id": user.market_id,
                }
            )
            return True

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        admin_id = request.session.get("admin_user_id")
        role = request.session.get("admin_role")
        return bool(admin_id and role in (UserRole.MARKET_ADMIN, UserRole.SUPER_ADMIN))


# ---------------------------------------------------------------------------
# SQLAdmin Model Views
# ---------------------------------------------------------------------------


class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.email, User.role, User.is_active, User.market_id, User.created_at]
    column_searchable_list = [User.email]
    column_filters = [User.role, User.is_active]
    name = "User"
    name_plural = "Users"
    icon = "fa-solid fa-users"


class PlayerProfileAdmin(ModelView, model=PlayerProfile):
    column_list = [
        PlayerProfile.display_name,
        PlayerProfile.rating,
        PlayerProfile.home_area,
        PlayerProfile.is_daytime,
        PlayerProfile.veteran_match_count,
        PlayerProfile.is_anonymized,
    ]
    column_searchable_list = [PlayerProfile.display_name, PlayerProfile.home_area]
    column_filters = [PlayerProfile.rating, PlayerProfile.is_daytime, PlayerProfile.is_anonymized]
    name = "Player Profile"
    name_plural = "Player Profiles"
    icon = "fa-solid fa-user-tag"


class MarketAdmin(ModelView, model=Market):
    column_list = [Market.name, Market.slug, Market.timezone, Market.currency, Market.is_active]
    name = "Market"
    name_plural = "Markets"
    icon = "fa-solid fa-earth-europe"


class ProgramAdmin(ModelView, model=Program):
    column_list = [
        Program.name,
        Program.program_type,
        Program.start_date,
        Program.end_date,
        Program.price_cents,
        Program.currency,
        Program.status,
    ]
    column_filters = [Program.program_type, Program.status]
    name = "Program"
    name_plural = "Programs"
    icon = "fa-solid fa-calendar-days"


class DivisionAdmin(ModelView, model=Division):
    column_list = [
        Division.name,
        Division.rating_band,
        Division.playoff_min_wins,
        Division.new_player_min_matches,
        Division.is_active,
    ]
    column_filters = [Division.rating_band, Division.is_active]
    name = "Division"
    name_plural = "Divisions"
    icon = "fa-solid fa-table-tennis-paddle-ball"


class EnrollmentAdmin(ModelView, model=Enrollment):
    column_list = [
        Enrollment.id,
        Enrollment.user_id,
        Enrollment.program_id,
        Enrollment.division_id,
        Enrollment.status,
        Enrollment.created_at,
    ]
    column_filters = [Enrollment.status]
    name = "Enrollment"
    name_plural = "Enrollments"
    icon = "fa-solid fa-clipboard-check"


class MatchAdmin(ModelView, model=Match):
    column_list = [
        Match.id,
        Match.division_id,
        Match.winner_id,
        Match.loser_id,
        Match.format,
        Match.outcome_type,
        Match.status,
        Match.played_at,
    ]
    column_filters = [Match.status, Match.format, Match.outcome_type]
    name = "Match"
    name_plural = "Matches"
    icon = "fa-solid fa-trophy"


class MatchDisputeAdmin(ModelView, model=MatchDispute):
    column_list = [
        MatchDispute.id,
        MatchDispute.match_id,
        MatchDispute.disputer_id,
        MatchDispute.status,
        MatchDispute.cooling_off_until,
        MatchDispute.created_at,
    ]
    column_filters = [MatchDispute.status]
    name = "Match Dispute"
    name_plural = "Match Disputes"
    icon = "fa-solid fa-hand-fist"


class StrikeAdmin(ModelView, model=Strike):
    column_list = [
        Strike.id,
        Strike.user_id,
        Strike.points,
        Strike.reason,
        Strike.status,
        Strike.calendar_year,
    ]
    column_filters = [Strike.status, Strike.calendar_year]
    name = "Discipline Strike"
    name_plural = "Discipline Strikes"
    icon = "fa-solid fa-triangle-exclamation"


class AuditLogAdmin(ModelView, model=AuditLog):
    """Immutable audit trail view satisfying Non-negotiable Rule 6."""

    column_list = [
        AuditLog.id,
        AuditLog.market_id,
        AuditLog.entity_type,
        AuditLog.entity_id,
        AuditLog.actor_id,
        AuditLog.action,
        AuditLog.reason,
        AuditLog.created_at,
    ]
    column_filters = [AuditLog.entity_type, AuditLog.action]
    column_searchable_list = [AuditLog.actor_id, AuditLog.reason]
    can_create = False
    can_edit = False
    can_delete = False
    name = "Audit Log"
    name_plural = "Audit Logs"
    icon = "fa-solid fa-scroll"


class CourtAdmin(ModelView, model=Court):
    column_list = [
        Court.name,
        Court.city,
        Court.surface,
        Court.num_courts,
        Court.has_lights,
        Court.is_indoor,
        Court.has_hitting_wall,
        Court.booking_url,
    ]
    column_filters = [Court.surface, Court.has_lights, Court.is_indoor, Court.has_hitting_wall]
    name = "Court"
    name_plural = "Courts"
    icon = "fa-solid fa-map-location-dot"


class PlayoffBracketAdmin(ModelView, model=PlayoffBracket):
    column_list = [
        PlayoffBracket.id,
        PlayoffBracket.division_id,
        PlayoffBracket.bracket_type,
        PlayoffBracket.bracket_size,
        PlayoffBracket.status,
    ]
    column_filters = [PlayoffBracket.bracket_type, PlayoffBracket.status]
    name = "Playoff Bracket"
    name_plural = "Playoff Brackets"
    icon = "fa-solid fa-sitemap"


class UserDeviceAdmin(ModelView, model=UserDevice):
    column_list = [
        UserDevice.id,
        UserDevice.user_id,
        UserDevice.platform,
        UserDevice.is_active,
        UserDevice.created_at,
    ]
    column_filters = [UserDevice.platform, UserDevice.is_active]
    name = "Push Device"
    name_plural = "Push Devices"
    icon = "fa-solid fa-mobile"


class NotificationLogAdmin(ModelView, model=NotificationLog):
    column_list = [
        NotificationLog.id,
        NotificationLog.user_id,
        NotificationLog.channel,
        NotificationLog.event_type,
        NotificationLog.title,
        NotificationLog.status,
        NotificationLog.created_at,
    ]
    column_filters = [NotificationLog.channel, NotificationLog.event_type, NotificationLog.status]
    can_create = False
    can_edit = False
    name = "Notification Log"
    name_plural = "Notification Logs"
    icon = "fa-solid fa-bell"


def setup_admin(app: FastAPI) -> Admin:
    """Mount SQLAdmin onto FastAPI application with authentication."""
    admin_auth = AdminAuth(secret_key=settings.SECRET_KEY)
    admin = Admin(
        app,
        engine,
        authentication_backend=admin_auth,
        title="Frankfurt Tennis League Admin",
        base_url="/admin",
    )

    admin.add_view(UserAdmin)
    admin.add_view(PlayerProfileAdmin)
    admin.add_view(MarketAdmin)
    admin.add_view(ProgramAdmin)
    admin.add_view(DivisionAdmin)
    admin.add_view(EnrollmentAdmin)
    admin.add_view(MatchAdmin)
    admin.add_view(MatchDisputeAdmin)
    admin.add_view(StrikeAdmin)
    admin.add_view(AuditLogAdmin)
    admin.add_view(CourtAdmin)
    admin.add_view(PlayoffBracketAdmin)
    admin.add_view(UserDeviceAdmin)
    admin.add_view(NotificationLogAdmin)

    return admin
