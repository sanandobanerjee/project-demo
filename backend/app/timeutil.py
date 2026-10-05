from datetime import datetime,timezone

def utcnow()->datetime:
    # Used as a column default. Pass the function itself (not its result) so it
    # runs for every new row instead of once when the server starts.
    return datetime.now(timezone.utc)

def iso_utc(value:datetime|None)->str|None:
    """ISO-8601 string that always carries a UTC marker (...Z).

    SQLite drops timezone info, so stored datetimes come back naive. Without a
    marker a browser reads them as local time and shows the wrong clock time.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        value=value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00","Z")
