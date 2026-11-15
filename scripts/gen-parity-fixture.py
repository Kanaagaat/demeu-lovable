"""Print the Python engine oracle; run from any directory (stdlib only).

api/.venv/bin/python web/scripts/gen-parity-fixture.py > web/src/lib/__fixtures__/parity.json
"""
import importlib.util
import json
import sys
from datetime import datetime
from pathlib import Path

# Importing the reference must not write anything into api/.
sys.dont_write_bytecode = True
root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("reference_engine", root / "api/app/engine.py")
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)
assert engine.DATA == json.loads((root / "web/src/data/seed.json").read_text()), "Seed copies differ"

base = dict(name="Айдан", age=6, district="Бостандыкский", features=["РАС"],
            comm="Отдельные слова", react="Нужно время, чтобы привыкнуть",
            goals=["Речь", "Общение"], disability="В процессе")
cards = [
    base,
    dict(base, name="Демо-карточка 2", age=3, district="Алмалинский",
         features=[engine.UNKNOWN], goals=[], comm="Говорит фразами", react="Спокойно", disability="Нет"),
    dict(base, name="Демо-карточка 3", age=10, district="Турксибский", features=["ДЦП", "ЗПР / ЗРР"],
         goals=["Моторика", "Учёба", "Самостоятельность"], react="Бывают сильные реакции", disability="Да"),
    dict(base, name="Демо-карточка 4", age=18, district="Медеуский", features=[engine.UNKNOWN],
         goals=["Речь", "Поведение", "Общение", "Учёба"], comm="Жесты или карточки",
         react="Бывают сильные реакции", disability="Нет"),
]
filters = [
    {},
    dict(sort="near", max_minutes=20),
    dict(sort="cheap", price=["free", "5_10"], lang=["Казахский"]),
    dict(sort="rating", exp=["РАС", "ДЦП"], format=["Кабинет", "Онлайн"], verified=True),
    dict(sort="best", specialty=["Логопед", "Психолог"], group=False, district="Алмалинский", q="о"),
]
now = datetime.fromisoformat("2026-11-14T19:30:00+00:00")
profiles = engine.DATA["specialists"]
cases = []
for card in cards:
    for f in filters:
        items = engine.filter_and_rank(profiles, dict(f, kind="child"), card, now)
        cases.append(dict(card=card, filters=f,
                          match=[{k: row[k] for k in ("id", "score", "match", "reasons")} for row in items],
                          plan=engine.plan(card, profiles)))

list_filters = [dict(sort=s, district="Бостандыкский") for s in ["best", "near", "cheap", "rating"]]
list_filters += [dict(price=[p]) for p in ["free", "lt5", "5_10", "10_15", "gt15"]]
list_filters += [dict(kind="parent"), dict(q="АННА"), dict(specialty=["Логопед"]),
                 dict(exp=["РАС", "ДЦП"]), dict(format=["Онлайн"]), dict(format=["На дом"]),
                 dict(lang=["Казахский"]), dict(group=True), dict(group=False),
                 dict(verified=True), dict(verified=False), dict(district="Турксибский", max_minutes=0)]
list_cases = [dict(filters=f, items=engine.filter_and_rank(profiles, f, now=now)) for f in list_filters]
slot_cases = []
for instant in ["2026-11-14T19:30:00+00:00", "2026-11-16T10:00:00+00:00",
                "2026-12-31T19:00:00+00:00", "2028-02-28T20:00:00+00:00"]:
    for identifier in [1, 8, 101]:
        profile = next(s for s in profiles if s["id"] == identifier)
        dt = datetime.fromisoformat(instant)
        slot_cases.append(dict(now=instant, id=identifier, slots=engine.slots(profile, dt),
                               card=engine.card_view(profile, "Бостандыкский", dt)))

# Schema field order, as BookingRequest.shared.model_dump() produces it.
shared = dict(name="Демо ~ *", age=6, district="Бостандыкский", features=["РАС"], goals=["Речь"])
message = engine.booking_message(profiles[0], datetime.fromisoformat("2026-12-01T10:00:00+00:00"), "Онлайн", shared)
from urllib.parse import urlencode

print(json.dumps(dict(now=now.isoformat(), cases=cases, list_cases=list_cases, slot_cases=slot_cases,
                      booking=dict(shared=shared, message=message, wa_url="https://wa.me/?" + urlencode({"text": message}))),
                 ensure_ascii=False, indent=2))
