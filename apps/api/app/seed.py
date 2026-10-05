"""Idempotent seed script to initialize Accra and Tema markets, programs, divisions, players, and matches."""

import asyncio
import json
import logging
from datetime import UTC, date, datetime

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Division, Program, ProgramStatus, ProgramType
from app.community.models import Court
from app.config import get_settings
from app.db import async_session_maker
from app.identity.models import CommunicationPreference, PlayerProfile, User, UserRole
from app.identity.security import hash_password
from app.leagues.models import Enrollment, EnrollmentStatus
from app.markets.models import Market, Region
from app.matches.models import Match, MatchStatus

logger = logging.getLogger(__name__)
settings = get_settings()
SEED_LOCK_KEY = 726_001


async def seed_accra_and_tema_market(session: AsyncSession) -> None:
    """Seed Accra and Tema markets, programs, divisions, players, and standings with airtight guard."""
    # 0. PostgreSQL advisory transaction lock
    bind = session.get_bind()
    if bind and getattr(bind, "dialect", None) and bind.dialect.name == "postgresql":
        await session.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": SEED_LOCK_KEY})

    # 1. Primary guard: if programs or any seed user emails already exist, skip seed
    seed_emails = [
        "kwame@accratennis.com",
        "kofi@accratennis.com",
        "emmanuel@accratennis.com",
        "daniel@accratennis.com",
        "nana@tematennis.com",
        "yaw@tematennis.com",
        "kojo@tematennis.com",
        "samuel@tematennis.com",
    ]
    programs_count = (await session.execute(select(func.count(Program.id)))).scalar() or 0
    users_count = (
        await session.execute(select(func.count(User.id)).where(User.email.in_(seed_emails)))
    ).scalar() or 0
    if programs_count > 0 or users_count > 0:
        logger.info("Seed skipped: database already populated")
        return

    # 2. Market: Accra
    stmt = select(Market).where(Market.slug == "accra")
    res = await session.execute(stmt)
    market = res.scalar_one_or_none()
    if not market:
        market = Market(
            id="mkt-accra",
            name="Accra",
            slug="accra",
            timezone="Africa/Accra",
            currency="GHS",
            is_active=True,
        )
        session.add(market)
        await session.flush()

    # 3. Regions: Accra and Tema
    reg_stmt = select(Region).where(Region.market_id == market.id)
    reg_res = await session.execute(reg_stmt)
    existing_regions = {r.name.lower(): r for r in reg_res.scalars().all()}

    for name in ["Accra", "Tema"]:
        if name.lower() not in existing_regions:
            reg = Region(id=f"reg-{name.lower()}", market_id=market.id, name=name)
            session.add(reg)

    await session.flush()

    # 4. Programs: Accra Fall Season 2026 & Tema Fall Season 2026
    prog_accra = Program(
        id="prog-accra-fall-2026",
        market_id=market.id,
        name="Accra Fall Season 2026",
        slug="accra-fall-2026",
        region="Accra",
        program_type=ProgramType.FLEX_SEASON,
        start_date=date(2026, 10, 1),
        end_date=date(2026, 11, 20),
        status=ProgramStatus.OPEN,
        price_cents=35000,  # GH₵ 350.00
        currency="GHS",
    )
    prog_tema = Program(
        id="prog-tema-fall-2026",
        market_id=market.id,
        name="Tema Fall Season 2026",
        slug="tema-fall-2026",
        region="Tema",
        program_type=ProgramType.FLEX_SEASON,
        start_date=date(2026, 10, 1),
        end_date=date(2026, 11, 20),
        status=ProgramStatus.OPEN,
        price_cents=35000,  # GH₵ 350.00
        currency="GHS",
    )
    session.add_all([prog_accra, prog_tema])
    await session.flush()

    # 5. Divisions (city-scoped clean IDs)
    div_accra_comp = Division(
        id="div-accra-comp-1",
        market_id=market.id,
        program_id=prog_accra.id,
        name="Accra Competitive (3.5)",
        rating_band="3.5",
        playoff_min_wins=5,
        new_player_min_matches=3,
        gender_constraint="open",
        min_age=None,
    )
    div_accra_skilled = Division(
        id="div-accra-skilled-1",
        market_id=market.id,
        program_id=prog_accra.id,
        name="Accra Skilled (3.0)",
        rating_band="3.0",
        playoff_min_wins=5,
        new_player_min_matches=3,
        gender_constraint="open",
        min_age=None,
    )
    div_tema_comp = Division(
        id="div-tema-comp-1",
        market_id=market.id,
        program_id=prog_tema.id,
        name="Tema Competitive (3.5)",
        rating_band="3.5",
        playoff_min_wins=5,
        new_player_min_matches=3,
        gender_constraint="open",
        min_age=None,
    )
    div_tema_skilled = Division(
        id="div-tema-skilled-1",
        market_id=market.id,
        program_id=prog_tema.id,
        name="Tema Skilled (3.0)",
        rating_band="3.0",
        playoff_min_wins=5,
        new_player_min_matches=6,
        gender_constraint="open",
        min_age=None,
    )
    session.add_all([div_accra_comp, div_accra_skilled, div_tema_comp, div_tema_skilled])
    await session.flush()

    # 6. Sample Courts in Accra & Tema
    sample_courts = [
        Court(
            market_id=market.id,
            name="Accra Lawn Tennis Club",
            slug="accra-lawn-tennis-club",
            address="Liberation Road, Ridge",
            postal_code="GA-030-1024",
            city="Accra",
            latitude=5.5600,
            longitude=-0.1900,
            num_courts=6,
            surface="clay",
            has_lights=True,
            is_indoor=False,
            has_hitting_wall=True,
        ),
        Court(
            market_id=market.id,
            name="Ghana Tennis Club Adabraka",
            slug="ghana-tennis-club-adabraka",
            address="Barnes Road, Adabraka",
            postal_code="GA-076-4321",
            city="Accra",
            latitude=5.5532,
            longitude=-0.2051,
            num_courts=4,
            surface="hard",
            has_lights=True,
            is_indoor=False,
            has_hitting_wall=False,
        ),
        Court(
            market_id=market.id,
            name="Tema Country Club",
            slug="tema-country-club",
            address="Community 6, Central Park",
            postal_code="TT-045-8899",
            city="Tema",
            latitude=5.6820,
            longitude=-0.0120,
            num_courts=4,
            surface="hard",
            has_lights=True,
            is_indoor=False,
            has_hitting_wall=True,
        ),
    ]
    for c in sample_courts:
        existing = (await session.execute(select(Court.id).where(Court.slug == c.slug))).first()
        if not existing:
            session.add(c)
    await session.flush()

    # 7. Seed Players: 4 in Accra (including handicap-eligible pair) and 4 in Tema
    pw_hash = hash_password(settings.SEED_DEMO_PASSWORD or "Password123!")

    # Accra Players:
    # Kwame (4.0) & Kofi (3.0): Handicap pair with 6 confirmed matches each (gap 1.0 > 0.5)
    # veteran_match_count is strictly 0 so match counts derive from real matches
    accra_player_defs = [
        (
            "u-seed-kwame",
            "p-seed-kwame",
            "Kwame Mensah",
            "kwame@accratennis.com",
            "+233 24 111 2222",
            "4.0",
            "Accra",
            True,
            0,
        ),
        (
            "u-seed-kofi",
            "p-seed-kofi",
            "Kofi Boateng",
            "kofi@accratennis.com",
            "+233 24 222 3333",
            "3.0",
            "Accra",
            False,
            0,
        ),
        (
            "u-seed-emmanuel",
            "p-seed-emmanuel",
            "Emmanuel Osei",
            "emmanuel@accratennis.com",
            "+233 24 333 4444",
            "3.5",
            "Accra",
            True,
            0,
        ),
        (
            "u-seed-daniel",
            "p-seed-daniel",
            "Daniel Appiah",
            "daniel@accratennis.com",
            "+233 24 444 5555",
            "3.5",
            "Accra",
            False,
            0,
        ),
    ]

    for uid, pid, name, email, phone, rating, area, daytime, match_count in accra_player_defs:
        user = User(
            id=uid,
            market_id=market.id,
            email=email,
            hashed_password=pw_hash,
            role=UserRole.PLAYER,
            is_active=True,
        )
        profile = PlayerProfile(
            id=pid,
            user_id=uid,
            market_id=market.id,
            display_name=name,
            phone=phone,
            rating=rating,
            home_area=area,
            is_daytime=daytime,
            veteran_match_count=0,
            gender="male",
            birth_year=1990,
        )
        enrollment = Enrollment(
            id=f"enr-{pid}",
            market_id=market.id,
            program_id=prog_accra.id,
            division_id=div_accra_comp.id,
            user_id=uid,
            status=EnrollmentStatus.ACTIVE,
        )
        session.add_all([user, profile, enrollment, CommunicationPreference(user_id=uid)])

    # Tema Players:
    tema_player_defs = [
        (
            "u-seed-nana",
            "p-seed-nana",
            "Nana Osei",
            "nana@tematennis.com",
            "+233 24 555 6666",
            "3.5",
            "Tema",
            True,
            0,
        ),
        (
            "u-seed-yaw",
            "p-seed-yaw",
            "Yaw Asante",
            "yaw@tematennis.com",
            "+233 24 666 7777",
            "3.5",
            "Tema",
            False,
            0,
        ),
        (
            "u-seed-kojo",
            "p-seed-kojo",
            "Kojo Antwi",
            "kojo@tematennis.com",
            "+233 24 777 8888",
            "3.5",
            "Tema",
            True,
            0,
        ),
        (
            "u-seed-samuel",
            "p-seed-samuel",
            "Samuel Mensah",
            "samuel@tematennis.com",
            "+233 24 888 9999",
            "3.5",
            "Tema",
            False,
            0,
        ),
    ]

    for uid, pid, name, email, phone, rating, area, daytime, match_count in tema_player_defs:
        user = User(
            id=uid,
            market_id=market.id,
            email=email,
            hashed_password=pw_hash,
            role=UserRole.PLAYER,
            is_active=True,
        )
        profile = PlayerProfile(
            id=pid,
            user_id=uid,
            market_id=market.id,
            display_name=name,
            phone=phone,
            rating=rating,
            home_area=area,
            is_daytime=daytime,
            veteran_match_count=0,
            gender="male",
            birth_year=1988,
        )
        enrollment = Enrollment(
            id=f"enr-{pid}",
            market_id=market.id,
            program_id=prog_tema.id,
            division_id=div_tema_comp.id,
            user_id=uid,
            status=EnrollmentStatus.ACTIVE,
        )
        session.add_all([user, profile, enrollment, CommunicationPreference(user_id=uid)])

    await session.flush()

    # 8. Create real confirmed match records
    # Accra: Kwame has 5 wins & 1 loss (6 matches); Kofi has 5 wins & 1 loss (6 matches)
    # Both players achieve >= 5 wins (playoff qualification) and exactly 6 confirmed matches
    base_time = datetime(2026, 9, 15, 10, 0, tzinfo=UTC)
    sets_sample = json.dumps([{"winner": 6, "loser": 4}, {"winner": 6, "loser": 3}])

    accra_matches_def = [
        ("m-accra-1", "p-seed-kwame", "p-seed-emmanuel", "u-seed-kwame"),
        ("m-accra-2", "p-seed-kwame", "p-seed-daniel", "u-seed-kwame"),
        ("m-accra-3", "p-seed-kwame", "p-seed-kofi", "u-seed-kwame"),
        ("m-accra-4", "p-seed-kwame", "p-seed-emmanuel", "u-seed-kwame"),
        ("m-accra-5", "p-seed-kwame", "p-seed-daniel", "u-seed-kwame"),
        ("m-accra-6", "p-seed-kofi", "p-seed-kwame", "u-seed-kofi"),
        ("m-accra-7", "p-seed-kofi", "p-seed-emmanuel", "u-seed-kofi"),
        ("m-accra-8", "p-seed-kofi", "p-seed-daniel", "u-seed-kofi"),
        ("m-accra-9", "p-seed-kofi", "p-seed-emmanuel", "u-seed-kofi"),
        ("m-accra-10", "p-seed-kofi", "p-seed-daniel", "u-seed-kofi"),
        ("m-accra-11", "p-seed-emmanuel", "p-seed-daniel", "u-seed-emmanuel"),
        ("m-accra-12", "p-seed-emmanuel", "p-seed-daniel", "u-seed-emmanuel"),
    ]
    for mid, wid, lid, rep_id in accra_matches_def:
        m = Match(
            id=mid,
            market_id=market.id,
            division_id=div_accra_comp.id,
            winner_id=wid,
            loser_id=lid,
            format="best_of_three",
            outcome_type="played",
            sets_json=sets_sample,
            status=MatchStatus.CONFIRMED,
            reporter_id=rep_id,
            played_at=base_time,
        )
        session.add(m)

    # Tema: Nana has 5 wins & 1 loss (6 matches); Yaw has 5 wins & 1 loss (6 matches)
    tema_matches_def = [
        ("m-tema-1", "p-seed-nana", "p-seed-kojo", "u-seed-nana"),
        ("m-tema-2", "p-seed-nana", "p-seed-samuel", "u-seed-nana"),
        ("m-tema-3", "p-seed-nana", "p-seed-yaw", "u-seed-nana"),
        ("m-tema-4", "p-seed-nana", "p-seed-kojo", "u-seed-nana"),
        ("m-tema-5", "p-seed-nana", "p-seed-samuel", "u-seed-nana"),
        ("m-tema-6", "p-seed-yaw", "p-seed-nana", "u-seed-yaw"),
        ("m-tema-7", "p-seed-yaw", "p-seed-kojo", "u-seed-yaw"),
        ("m-tema-8", "p-seed-yaw", "p-seed-samuel", "u-seed-yaw"),
        ("m-tema-9", "p-seed-yaw", "p-seed-kojo", "u-seed-yaw"),
        ("m-tema-10", "p-seed-yaw", "p-seed-samuel", "u-seed-yaw"),
        ("m-tema-11", "p-seed-kojo", "p-seed-samuel", "u-seed-kojo"),
        ("m-tema-12", "p-seed-kojo", "p-seed-samuel", "u-seed-kojo"),
    ]
    for mid, wid, lid, rep_id in tema_matches_def:
        m = Match(
            id=mid,
            market_id=market.id,
            division_id=div_tema_comp.id,
            winner_id=wid,
            loser_id=lid,
            format="best_of_three",
            outcome_type="played",
            sets_json=sets_sample,
            status=MatchStatus.CONFIRMED,
            reporter_id=rep_id,
            played_at=base_time,
        )
        session.add(m)

    await session.flush()

    # 9. Dynamically compute and persist standings from matches & enrollments
    from app.matches.service import recalculate_division_standings

    await recalculate_division_standings(session, div_accra_comp.id)
    await recalculate_division_standings(session, div_tema_comp.id)

    await session.commit()
    logger.info("Guarded seeding completed: Accra and Tema initialized.")


async def seed_accra_market() -> None:
    """Entry point for manual or CLI invocation."""
    async with async_session_maker() as session:
        await seed_accra_and_tema_market(session)


if __name__ == "__main__":
    asyncio.run(seed_accra_market())
