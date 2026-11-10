"""Timezone helper — Asia/Ho_Chi_Minh with UTC fallback if zoneinfo unavailable.
Single source of truth for tz setup (was copy-pasted in generate_card.py,
generate_weekly.py, generate_monthly.py — see H3)."""
import time
from contextlib import contextmanager
from datetime import datetime, timezone


@contextmanager
def timed(label: str):
    """Print how long a pipeline step took — `[timing] fetch: 12.3s` in the job log."""
    start = time.perf_counter()
    try:
        yield
    finally:
        print(f"[timing] {label}: {time.perf_counter() - start:.1f}s")

try:
    import zoneinfo
    VN_TZ = zoneinfo.ZoneInfo("Asia/Ho_Chi_Minh")
except ImportError:
    VN_TZ = timezone.utc


def now_vn() -> datetime:
    """Current datetime in VN_TZ (or UTC fallback if zoneinfo unavailable)."""
    return datetime.now(VN_TZ)
