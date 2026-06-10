from enum import Enum


class SurgeryStatus(str, Enum):
    scheduled = "scheduled"
    in_rpa = "in_rpa"
    ready_for_room = "ready_for_room"
    in_room = "in_room"
    room_released = "room_released"
    completed = "completed"


class EventType(str, Enum):
    rpa_entry = "rpa_entry"
    rpa_exit = "rpa_exit"
    room_entry = "room_entry"
    room_exit = "room_exit"
    cc_exit = "cc_exit"
