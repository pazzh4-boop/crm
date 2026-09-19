#!/usr/bin/env python3
"""Static server + mocked /being-api and /crm-control for screenshot testing."""
import http.server, json, os, sys, urllib.parse, socketserver, datetime

ROOT = os.path.abspath(sys.argv[1]); PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8766
TODAY = datetime.date(2026, 9, 19)
def d(days_ago): return (TODAY - datetime.timedelta(days=days_ago)).isoformat()

def perf(scale, days_ago_activity):
    return {
        "to": 12000*scale, "sport": 3000*scale, "casino": 6000*scale, "live": 1500*scale, "slots": 1000*scale, "instant": 500*scale,
        "ggr": 900*scale, "ggrSport": 200*scale, "ggrCasino": 500*scale, "ggrLive": 100*scale, "ggrSlots": 70*scale, "ggrInstant": 30*scale,
        "ngr": 700*scale, "ngrSport": 150*scale, "ngrCasino": 400*scale, "ngrLive": 80*scale, "ngrSlots": 50*scale, "ngrInstant": 20*scale,
        "bonus": 120*scale, "bonusRate": 13.3, "deposits": 2500*scale, "depositCount": 4*scale, "withdrawals": 1200*scale, "withdrawalCount": 1*scale,
        "lastActivityDate": d(days_ago_activity), "sourceLatestDate": d(1)
    }

def profile(scale, inactive):
    return {
        "performance": {"day": perf(scale*0.05, inactive), "7d": perf(scale*0.3, inactive), "30d": perf(scale, inactive), "12m": perf(scale*8, inactive)},
        "daily": {d(i): {"to": 300*scale, "ggr": 20*scale, "casino": 200*scale, "sport": 100*scale, "deposits": 50*scale, "withdrawals": 10*scale} for i in range(1, 15)},
        "playing": "Casino"
    }

CLIENTS = [
    {"clientId": "1001", "clientName": "Anna Petrova", "notes": f"{d(2)} — Called, wants sport bonus\n{d(9)} — Emailed about quest", "activeQuest": "Casino Turnover 5000 EUR | 2026-09-01", "bonusLog": "", "pinned": True, "followUpDate": d(-3), "lastContactDate": d(2), "reactivationProfile": profile(1.0, 3)},
    {"clientId": "1002", "clientName": "Boris Ivanov", "notes": "", "activeQuest": "", "bonusLog": "", "pinned": False, "followUpDate": "", "lastContactDate": d(20), "reactivationProfile": profile(2.5, 12)},
    {"clientId": "1003", "clientName": "Carla Mendes", "notes": f"{d(1)} — No answer", "activeQuest": "Sport Deposit 1000 EUR | 2026-09-10", "bonusLog": "", "pinned": False, "followUpDate": d(1), "lastContactDate": d(1), "reactivationProfile": profile(0.4, 1)},
    {"clientId": "1004", "clientName": "Dmitri Volkov", "notes": "", "activeQuest": "", "bonusLog": "", "pinned": True, "followUpDate": "", "lastContactDate": d(45), "reactivationProfile": profile(4.0, 40)},
    {"clientId": "1005", "clientName": "Elena Sokolova", "notes": "", "activeQuest": "", "bonusLog": "", "pinned": False, "followUpDate": d(5), "lastContactDate": d(6), "reactivationProfile": profile(0.8, 25)},
    {"clientId": "1006", "clientName": "Farid Aliyev", "notes": "", "activeQuest": "", "bonusLog": "", "pinned": False, "followUpDate": "", "lastContactDate": "", "reactivationProfile": profile(1.6, 70)},
]

def react_row(c, started, inactive, ngr, dep, emails, calls, offer, notes):
    return {
        "clientId": c["clientId"], "name": c["clientName"], "reactivationStartedAt": d(started), "daysInReactivation": started,
        "lastActivityDate": d(inactive), "lastContactDate": c["lastContactDate"], "daysInactive": inactive,
        "reactivationNgr": ngr, "depositAmount": dep, "previousWeekLog": [], "currentCommText": notes[0]["text"] if notes else "",
        "reactivationNotes": notes, "offerText": offer, "emails": emails, "calls": calls, "contactsTotal": emails + calls,
        "currentSheetName": "since 2026-09-01", "currentSheetDate": "2026-09-01", "playing": "Casino",
        "performance": c["reactivationProfile"]["performance"], "quest": {"name": "", "progress": 0},
        "reactivationTotals": {"deposits": dep, "ngr": ngr}
    }

def note(days_ago, text, current=True, idx=0):
    return {"date": d(days_ago), "time": "10:30", "text": text, "sheetName": "since 2026-09-01", "isCurrent": current, "sourceIndex": idx}

REACT_ROWS = [
    react_row(CLIENTS[1], 14, 12, 340.5, 1200, 2, 1, "6.5% BD + 15% Deposit + Quest", [note(1, "Called, will deposit on Friday", True, 0), note(6, "Emailed offer", True, 1)]),
    react_row(CLIENTS[3], 40, 40, -120.0, 0, 3, 3, "", [note(3, "No answer twice", True, 0)]),
    react_row(CLIENTS[4], 25, 25, 80.0, 300, 1, 0, "Quest Only Insurance", []),
    react_row(CLIENTS[5], 70, 70, 0, 0, 0, 0, "", []),
]

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
    def _json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status); self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path == "/crm-control": return self._json({"ok": True, "service": "mock", "status": "online"})
        if u.path == "/being-api":
            action = q.get("action", ["getClients"])[0]
            if action == "ping": return self._json({"ok": True, "version": "3.4", "service": "mock"})
            if action == "getClients": return self._json({"ok": True, "clients": CLIENTS})
            if action == "getReactivation": return self._json({"ok": True, "ready": True, "currentSheet": "since 2026-09-01", "currentSheetDate": "2026-09-01", "rows": REACT_ROWS, "archiveRows": REACT_ROWS})
            if action == "getClientFields": return self._json({"ok": True, "fields": {}})
            if action == "updatePinned": return self._json({"ok": True})
            return self._json({"ok": False, "error": "unknown action " + action}, 400)
        return super().do_GET()
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); self.rfile.read(n)
        return self._json({"ok": True, "verified": True, "confirmedChanges": {}})

class Server(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
print(f"serving {ROOT} on {PORT}", flush=True)
Server(("127.0.0.1", PORT), Handler).serve_forever()
