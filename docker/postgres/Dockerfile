FROM postgis/postgis:16-3.4

# postgis/postgis is built on the official postgres image, which already
# configures the apt.postgresql.org (pgdg) repository — so the pgvector
# package published there is directly installable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/*
