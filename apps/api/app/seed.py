"""Idempotent seed script to initialize the Accra market, regions, programs, and divisions."""

import asyncio
from datetime import date

from sqlalchemy import select

from app.catalog.models import Division, Program, ProgramStatus, ProgramType
from app.community.models import Court
from app.db import async_session_maker
from app.markets.models import Market, Region


async def seed_accra_market() -> None:
    """Seed Accra market, Accra/Tema regions, initial flex program, divisions, and courts."""
    async with async_session_maker() as session:
        # 1. Market: Accra
        stmt = select(Market).where(Market.slug == "accra")
        res = await session.execute(stmt)
        market = res.scalar_one_or_none()
        if not market:
            market = Market(
                name="Accra",
                slug="accra",
                timezone="Africa/Accra",
                currency="GHS",
                is_active=True,
            )
            session.add(market)
            await session.flush()
            print("Created market: Accra (Africa/Accra, GHS)")
        else:
            print("Market 'accra' already exists.")

        # 2. Regions: Accra and Tema
        reg_stmt = select(Region).where(Region.market_id == market.id)
        reg_res = await session.execute(reg_stmt)
        existing_regions = {r.name.lower(): r for r in reg_res.scalars().all()}

        for name in ["Accra", "Tema"]:
            if name.lower() not in existing_regions:
                reg = Region(market_id=market.id, name=name)
                session.add(reg)
                print(f"Created region: {name}")

        await session.flush()

        # 3. Program: Accra Fall Season 2026
        prog_stmt = select(Program).where(Program.slug == "accra-fall-2026")
        prog_res = await session.execute(prog_stmt)
        program = prog_res.scalar_one_or_none()
        if not program:
            program = Program(
                id="prog-accra-fall-2026",
                market_id=market.id,
                name="Accra Fall Season 2026",
                slug="accra-fall-2026",
                program_type=ProgramType.FLEX_SEASON,
                start_date=date(2026, 10, 1),
                end_date=date(2026, 11, 20),
                status=ProgramStatus.OPEN,
                price_cents=35000,  # GH₵ 350.00
                currency="GHS",
            )
            session.add(program)
            await session.flush()
            print("Created program: Accra Fall Season 2026")

            # 4. Divisions within Program
            div_comp = Division(
                id="div-comp-1",
                market_id=market.id,
                program_id=program.id,
                name="Competitive (3.5)",
                rating_band="3.5",
                playoff_min_wins=5,
                new_player_min_matches=6,
            )
            div_skilled = Division(
                id="div-skilled-1",
                market_id=market.id,
                program_id=program.id,
                name="Skilled (3.0)",
                rating_band="3.0",
                playoff_min_wins=5,
                new_player_min_matches=6,
            )
            session.add_all([div_comp, div_skilled])
            print("Created divisions: Competitive (3.5) & Skilled (3.0)")

        # 5. Sample Courts in Accra & Tema
        court_stmt = select(Court).where(Court.market_id == market.id)
        court_res = await session.execute(court_stmt)
        existing_courts = {c.slug for c in court_res.scalars().all()}

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
            if c.slug not in existing_courts:
                session.add(c)
                print(f"Created court: {c.name}")

        await session.commit()
        print("Database seeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed_accra_market())
