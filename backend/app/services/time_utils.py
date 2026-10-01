from datetime import date, datetime, time, timedelta


def ranges_overlap(
    start1: time, end1: time, start2: time, end2: time
) -> bool:
    """True si dos rangos de tiempo se superponen."""
    return not (end1 <= start2 or end2 <= start1)


def time_to_minutes(t: time) -> int:
    """Convierte un time a minutos desde las 00:00."""
    return t.hour * 60 + t.minute


def minutes_to_time(minutes: int) -> time:
    """Convierte minutos desde las 00:00 a un time."""
    hours = minutes // 60
    mins = minutes % 60
    return time(hours, mins)


def generate_slots(
    start_time: time,
    end_time: time,
    slot_duration_minutes: int,
) -> list[tuple[time, time]]:
    """Genera todos los slots (start, end) entre start_time y end_time."""
    if slot_duration_minutes <= 0:
        return []

    start_min = time_to_minutes(start_time)
    end_min = time_to_minutes(end_time)
    slots = []

    current = start_min
    while current + slot_duration_minutes <= end_min:
        slot_start = minutes_to_time(current)
        slot_end = minutes_to_time(current + slot_duration_minutes)
        slots.append((slot_start, slot_end))
        current += slot_duration_minutes

    return slots


def is_past_datetime(target_date: date, target_time: time) -> bool:
    """True si la fecha + hora ya paso."""
    now = datetime.now()
    target = datetime.combine(target_date, target_time)
    return target < now
