"""Jagajanin prototype — seed the tele-specialist console with a realistic, busy caseload.

    python3 server.py --seed      # replaces earlier seeded cases, keeps real ones

Five Puskesmas over the last three days: most visits routine, a handful that need a
specialist, some already validated and confirmed by the midwife. Timestamps are relative to
now, so waiting times and overdue flags look live. Every seeded case is fictional and is
marked "seeded"; its sweep videos are the synthetic clips in data/demo-sweeps/.

assess() below mirrors rules.js so the seeded findings match what the phone would produce.
"""

import random
import time
from datetime import date, timedelta

CONF_MIN, GA_GAP, TERM, EFW_LOW = 0.80, 2, 36, 0.85
EFW_MEDIAN_G = {20: 331, 21: 399, 22: 478, 23: 568, 24: 670, 25: 785, 26: 913, 27: 1055, 28: 1210, 29: 1379,
                30: 1559, 31: 1751, 32: 1953, 33: 2162, 34: 2377, 35: 2595, 36: 2813, 37: 3028, 38: 3236,
                39: 3435, 40: 3619}

PUSKESMAS = [("Puskesmas Ondera", "Bidan Sari"), ("Puskesmas Tegalrejo", "Bidan Wulan"),
             ("Puskesmas Cibeber", "Bidan Rina"), ("Puskesmas Wonosari", "Bidan Dewi"),
             ("Puskesmas Sidomulyo", "Bidan Lestari")]
FACILITY = {"rsud": ("RSUD Kabupaten", 32, 55), "klinik": ("Klinik Sp.OG dr. Rahma", 18, 35),
            "rsup": ("RSUP Provinsi", 110, 150)}
DOCTOR = "dr. Aditya, Sp.OG (demo)"
MIN = 60_000
HOUR = 60 * MIN


def assess(visit, scan, ga_dates):
    f = []
    add = lambda lvl, key, src, **x: f.append({"level": lvl, "key": key, "src": src, **x})
    for s in visit["signs"]:
        add("rujuk", "sign_" + s, "clinical")
    sys_, dia = visit["bpSys"], visit["bpDia"]
    if sys_ >= 160 or dia >= 110:
        add("rujuk", "bp_severe", "clinical", detail=f"{sys_}/{dia}")
    elif sys_ >= 140 or dia >= 90:
        add("rujuk", "bp_high", "clinical", detail=f"{sys_}/{dia}")
    if visit["age"] >= 35:
        add("hati", "age_high", "clinical", detail=visit["age"])
    elif visit["age"] < 20:
        add("hati", "age_low", "clinical", detail=visit["age"])
    if scan:
        p = lambda k: scan[k]
        sure = lambda k: scan[k]["conf"] >= CONF_MIN
        unsure = lambda k: add("unsure", "unsure_" + k, "ai", conf=p(k)["conf"])
        if sure("viability"):
            add("ok", "viable", "ai", conf=p("viability")["conf"])
        else:
            unsure("viability")
        if sure("fetusCount"):
            n = p("fetusCount")["value"]
            add("rujuk" if n > 1 else "ok", "multiple" if n > 1 else "singleton", "ai", conf=p("fetusCount")["conf"],
                **({"detail": n} if n > 1 else {}))
        else:
            unsure("fetusCount")
        if sure("placenta"):
            prev = p("placenta")["value"] == "previa"
            add("rujuk" if prev else "ok", "previa" if prev else "placenta_ok", "ai", conf=p("placenta")["conf"])
        else:
            unsure("placenta")
        ga_ai = p("gaWeeks")["value"] if sure("gaWeeks") else None
        ga_ref = ga_dates if ga_dates is not None else ga_ai
        if sure("presentation"):
            if p("presentation")["value"] != "cephalic":
                late = ga_ref is not None and ga_ref >= TERM
                add("rujuk" if late else "hati", "malpresentation_term" if late else "malpresentation_early", "ai",
                    conf=p("presentation")["conf"], detail=p("presentation")["value"])
            else:
                add("ok", "cephalic", "ai", conf=p("presentation")["conf"])
        else:
            unsure("presentation")
        if ga_ai is not None:
            if abs(ga_ai - ga_dates) > GA_GAP:
                add("hati", "ga_mismatch", "ai", conf=p("gaWeeks")["conf"], detail=f"{ga_ai} vs {ga_dates}")
            else:
                add("ok", "ga_consistent", "ai", conf=p("gaWeeks")["conf"], detail=ga_ai)
        else:
            unsure("gaWeeks")
        if sure("efwKg"):
            med = EFW_MEDIAN_G[min(40, max(20, int(ga_ref)))]
            low = p("efwKg")["value"] * 1000 < med * EFW_LOW
            add("hati" if low else "ok", "efw_low" if low else "efw_ok", "ai", conf=p("efwKg")["conf"], detail=p("efwKg")["value"])
        else:
            unsure("efwKg")
    has = lambda lvl: any(x["level"] == lvl for x in f)
    outcome = "rujuk" if has("rujuk") else "unsure" if has("unsure") else "hati" if has("hati") else "aman"
    urgent = any(x["key"] in ("no_heartbeat", "sign_bleeding", "sign_convulsion", "bp_severe") for x in f)
    return outcome, urgent, f


def make_case(rng, now, kind, waited_ms, validated=None, override=None, reason=""):
    """kind picks the clinical picture; waited_ms is how long ago the case reached the console."""
    pk, mw = rng.choice(PUSKESMAS)
    ga = round(rng.uniform(24, 38), 1)
    age = rng.randint(21, 33)
    bp = (rng.choice([105, 110, 112, 115, 118, 120, 122, 125]), rng.choice([68, 70, 72, 75, 78, 80]))
    signs, scanned = [], True
    c = lambda lo, hi: round(rng.uniform(lo, hi), 2)
    efw_for = lambda g, r=1.0: round(EFW_MEDIAN_G[min(40, max(20, int(g)))] * r * rng.uniform(0.95, 1.08) / 1000, 2)
    scan = {"quality": {"ok": True, "score": c(0.86, 0.97)}, "viability": {"value": "present", "conf": c(0.97, 0.995)},
            "presentation": {"value": "cephalic", "conf": c(0.88, 0.97)}, "placenta": {"value": "normal", "conf": c(0.88, 0.97)},
            "fetusCount": {"value": 1, "conf": c(0.93, 0.99)}, "gaWeeks": {"value": None, "conf": c(0.84, 0.93)},
            "efwKg": {"value": None, "conf": c(0.82, 0.9)}}
    ga_ai = round(ga)
    efw_ratio = 1.0
    if kind == "older":
        age = rng.randint(35, 41)
    elif kind == "young":
        age = rng.randint(17, 19)
    elif kind == "breech_early":
        ga = round(rng.uniform(26, 33), 1); ga_ai = round(ga)
        scan["presentation"] = {"value": "breech", "conf": c(0.84, 0.94)}
    elif kind == "breech_term":
        ga = round(rng.uniform(36.2, 38.5), 1); ga_ai = round(ga)
        scan["presentation"] = {"value": rng.choice(["breech", "transverse"]), "conf": c(0.86, 0.94)}
    elif kind == "efw_low":
        efw_ratio = 0.76
    elif kind == "ga_mismatch":
        ga_ai = round(ga) + 3
    elif kind == "previa":
        ga = round(rng.uniform(28, 35), 1); ga_ai = round(ga)
        scan["placenta"] = {"value": "previa", "conf": c(0.86, 0.93)}
    elif kind == "twins":
        ga = round(rng.uniform(24, 32), 1); ga_ai = round(ga)
        scan["fetusCount"] = {"value": 2, "conf": c(0.88, 0.94)}
    elif kind == "bp_high":
        bp = (rng.choice([142, 145, 148, 150]), rng.choice([92, 94, 96]))
    elif kind == "urgent":
        signs = ["bleeding"]
        ga = round(rng.uniform(30, 35), 1); ga_ai = round(ga)
        scan["placenta"] = {"value": "previa", "conf": c(0.87, 0.92)}
    elif kind == "unsure":
        for k in rng.sample(["presentation", "placenta", "gaWeeks", "efwKg"], 2):
            scan[k]["conf"] = c(0.55, 0.74)
        scan["quality"]["score"] = c(0.66, 0.76)
    elif kind == "noscan":
        scanned, scan = False, None
        signs = [rng.choice(["headache_vision", "swelling_face_hands", "reduced_movement"])]
    if scan:
        scan["gaWeeks"]["value"] = ga_ai
        scan["efwKg"]["value"] = efw_for(ga, efw_ratio)

    visit = {"id": f"Ny. {rng.choice('ADEFHIKLMNPRSTUWY')}.{rng.choice('ADEFHIKLMNPRSTUWY')}.", "age": age,
             "hpht": (date.fromtimestamp(now / 1000) - timedelta(days=round(ga * 7))).isoformat(),
             "bpSys": bp[0], "bpDia": bp[1], "signs": signs}
    outcome, urgent, findings = assess(visit, scan, ga)
    final = override or ("rujuk" if outcome == "unsure" else outcome)
    received = now - waited_ms
    cid = "JJ-" + "".join(rng.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8)) + "-" + \
          "".join(rng.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(4))
    case = {
        "caseId": cid, "id": visit["id"], "at": received - rng.randint(3, 150) * MIN, "visit": visit, "scan": scan,
        "findings": findings, "aiOutcome": outcome, "final": final, "urgent": urgent,
        "reason": reason if override else "",
        "midwife": mw, "puskesmas": pk, "scanned": scanned, "gaDates": ga,
        "videos": [1, 2, 3, 4, 5, 6] if scanned else [], "uploaded": [1, 2, 3, 4, 5, 6] if scanned else [],
        "synced": True, "receivedAt": received, "validation": None, "seeded": True,
    }
    if validated:
        decision, resp_ms = validated
        fac = None
        timing = None
        if decision == "rujuk":
            timing = "emergency" if urgent else "scheduled"
            fid = "rsud" if any(f["key"] in ("previa", "multiple", "malpresentation_term", "bp_high", "sign_bleeding", "bp_severe")
                                for f in findings) else "klinik"
            name, km, mins = FACILITY[fid]
            fac = {"id": fid, "name": name, "km": km, "min": mins}
        at = received + resp_ms
        case["validation"] = {"doctor": DOCTOR, "decision": decision, "timing": timing, "date": None, "facility": fac,
                              "actions": [], "note": "", "at": at,
                              "ackAt": at + rng.randint(4, 40) * MIN if at + 45 * MIN < now else None, "doneActions": []}
    return case


def seed(cases, n_seed=7):
    """Return cases with earlier seeded entries replaced by a fresh, time-relative set."""
    rng = random.Random(n_seed)
    now = int(time.time() * 1000)
    out = {k: v for k, v in cases.items() if not v.get("seeded")}
    m = lambda a, b: rng.randint(a, b) * MIN
    pending = [
        ("urgent", m(5, 8)),
        ("breech_term", m(64, 80)), ("bp_high", m(38, 46)), ("twins", m(14, 22)),
        ("unsure", m(140, 170), "hati"), ("unsure", m(80, 100), "hati"),
        *[(k, rng.randint(1, 20) * HOUR + m(0, 59)) for k in
          ["older", "breech_early", "efw_low", "ga_mismatch", "young", "older", "breech_early", "older"]],
        *[("normal", rng.randint(2, 40) * HOUR + m(0, 59)) for _ in range(6)],
    ]
    done = []
    for _ in range(26):
        done.append(("normal", rng.randint(3, 70) * HOUR, ("aman", rng.randint(2, 30) * HOUR)))
    for k in ["older", "breech_early", "efw_low", "ga_mismatch", "young", "older", "breech_early", "older", "efw_low"]:
        done.append((k, rng.randint(3, 70) * HOUR, ("hati", rng.randint(2, 20) * HOUR)))
    for k in ["previa", "twins", "breech_term", "bp_high", "previa", "urgent", "twins", "noscan"]:
        done.append((k, rng.randint(4, 70) * HOUR, ("rujuk", rng.randint(8, 38) * MIN)))
    for _ in range(3):
        done.append(("unsure", rng.randint(4, 70) * HOUR, ("rescan", rng.randint(30, 110) * MIN)))
    done.append(("older", rng.randint(5, 60) * HOUR, ("rujuk", rng.randint(20, 50) * MIN), "rujuk",
                 "Ibu mengeluh nyeri perut dan cemas, minta dirujuk"))  # midwife escalated
    done.append(("normal", rng.randint(5, 60) * HOUR, ("hati", rng.randint(2, 9) * HOUR), "hati", "Riwayat keguguran 2x"))

    rescan_later = "Ibu belum bisa ke RS minggu ini — scan ulang di kunjungan berikut"
    for kind, waited, *ov in pending:
        c = make_case(rng, now, kind, waited, override=ov[0] if ov else None, reason=rescan_later)
        out[c["caseId"]] = c
    for kind, waited, val, *ov in done:
        if val[1] >= waited:  # validation must land before now
            val = (val[0], waited // 2)
        c = make_case(rng, now, kind, waited, validated=val, override=ov[0] if ov else None, reason=ov[1] if ov else "")
        out[c["caseId"]] = c
    return out
