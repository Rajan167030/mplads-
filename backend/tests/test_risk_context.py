import uuid

from app.risk.context import MIN_PEER_GROUP_SIZE, PeerGroupIndex


def _index_with(records: list[tuple]) -> PeerGroupIndex:
    index = PeerGroupIndex()
    index.by_district[("ROAD", "Karnataka", "Dharwad")] = records
    return index


def test_stats_for_excludes_the_querying_project_itself():
    # One extreme project (cost 1,000,000) plus MIN_PEER_GROUP_SIZE
    # otherwise-identical peers (cost 100) — enough that excluding the
    # extreme project's own record still leaves a valid peer group. Its own
    # value must not appear in the median it's judged against.
    ids = [uuid.uuid4() for _ in range(MIN_PEER_GROUP_SIZE + 1)]
    records = [(ids[0], 1_000_000.0, 100)] + [(pid, 100.0, 100) for pid in ids[1:]]
    index = _index_with(records)

    stats = index.stats_for("ROAD", "Karnataka", "Dharwad", ids[0])

    assert stats.cost_median == 100.0
    assert stats.n == MIN_PEER_GROUP_SIZE


def test_stats_for_falls_back_when_exclusion_drops_below_minimum():
    ids = [uuid.uuid4() for _ in range(MIN_PEER_GROUP_SIZE)]
    records = [(pid, 100.0 + i, 100) for i, pid in enumerate(ids)]
    index = _index_with(records)

    # Excluding one project leaves exactly MIN_PEER_GROUP_SIZE - 1 peers —
    # one short of the minimum — so no district-level stats should be
    # returned (no lower fallback tier is populated here, so None).
    assert index.stats_for("ROAD", "Karnataka", "Dharwad", ids[0]) is None


def test_stats_for_unrelated_project_id_uses_the_full_group():
    ids = [uuid.uuid4() for _ in range(MIN_PEER_GROUP_SIZE)]
    records = [(pid, 100.0, 100) for pid in ids]
    index = _index_with(records)

    stats = index.stats_for("ROAD", "Karnataka", "Dharwad", uuid.uuid4())

    assert stats.n == MIN_PEER_GROUP_SIZE
