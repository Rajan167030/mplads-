import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context
from geoalchemy2.alembic_helpers import include_object as geoalchemy2_include_object
from geoalchemy2.alembic_helpers import render_item as geoalchemy2_render_item
from pgvector.sqlalchemy import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.core.db import Base  # noqa: E402
from app.models import *  # noqa: E402,F401,F403 — registers all model classes on Base.metadata

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config
config.set_main_option("sqlalchemy.url", get_settings().database_url)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# PostGIS/pgvector-adjacent extensions create their own tables (spatial_ref_sys,
# topology, tiger geocoder) — never diff those in autogenerate.
_POSTGIS_MANAGED_TABLES = {
    "spatial_ref_sys",
    "topology",
    "layer",
    "us_gaz",
    "us_lex",
    "us_rules",
    "loader_platform",
    "loader_variables",
    "loader_lookuptables",
    "county",
    "county_lookup",
    "state",
    "state_lookup",
    "place",
    "place_lookup",
    "zip_lookup_base",
    "zip_lookup",
    "zip_state",
    "zip_state_loc",
    "cousub",
    "cousub_lookup",
    "edges",
    "addr",
    "addrfeat",
    "bg",
    "tabblock",
    "tabblock20",
    "tract",
    "faces",
    "featnames",
    "geocode_settings",
    "geocode_settings_default",
    "pagc_gaz",
    "pagc_lex",
    "pagc_rules",
    "secondary_unit_lookup",
    "street_type_lookup",
    "direction_lookup",
    "zcta5",
    "zip_lookup_all",
    "countysub_lookup",
}


def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table" and name in _POSTGIS_MANAGED_TABLES:
        return False
    return geoalchemy2_include_object(object, name, type_, reflected, compare_to)


def render_item(type_, obj, autogen_context):
    if type_ == "type" and isinstance(obj, Vector):
        autogen_context.imports.add("from pgvector.sqlalchemy import Vector")
        return f"Vector(dim={obj.dim})"
    return geoalchemy2_render_item(type_, obj, autogen_context)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        render_item=render_item,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            render_item=render_item,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
