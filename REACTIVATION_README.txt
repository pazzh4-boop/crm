VIP CRM v1.5.4.45 — LIVE REACTIVATION SHEET WORKSPACE

SOURCE
Reactivation uses every sheet in the existing Being spreadsheet whose name exactly matches:
  since DD.MM.YYYY

The newest matching sheet is the current Reactivation queue.
Only IDs from that newest sheet with at least 4 inactive days from D receive the On Reactivation marker in Being and Clients.
IDs are matched exactly against Being_Archive / Client ID. Duplicate IDs are ignored.

COLUMN MAP
Row 1 contains labels and data starts at row 2. Historical sheets use different
physical layouts, so each sheet is mapped independently from the exact supplied labels:
  ID; Last Dep / Last Activity; Days no dep; Notes (legacy date field);
  NGR / NGR August; Dep / Dep August; PREV ATTEMPTS; PLAN; COMM;
  Phone / Phone counter; Mail / Mail counter; Total / Contact total.
Missing PREV ATTEMPTS on the first/start sheet is valid and does not block the row.

HISTORICAL RULES
- In Reactivation Since is the oldest valid since-sheet where the ID exists.
- Days and Stage use Days no dep when available; otherwise they are calculated from Last Dep / Last Activity / the legacy Notes date field.
- NGR is read only from NGR or NGR August in the newest since-sheet.
- Deposits are read only from Dep, Dep August or Deposit Amount in the newest since-sheet.
- Current Notes show only Comm entries from the newest sheet.
- When a new since-sheet is created, the preceding sheet's Comm belongs in the new
  sheet's Previous Attempts and the new Comm starts empty.
- Notes History reads only this Previous Attempts chain, newest first and read-only.
- Historical Comm is not read a second time, so copied notes cannot duplicate.
- Reactivation Notes are completely separate from Being_Archive / Notes.

CURRENT-SHEET WRITES
- A free-form Reactivation note appends only to Comm of the newest sheet.
- Offer appends a structured entry to COMM and never overwrites earlier notes.
- Offer format:
    BD: value; FB: value; TO Deposit: value; Quest: value
- Mail increments Mail Counter and Contact Total.
- Call increments Phone Counter and Contact Total.
- Undo decrements the matching Phone/Mail counter and Total.
- Writes use a script lock, flush and cell readback verification.

UNDO SAFETY
- Undo appears only after a Mail or Call action made in the current CRM session.
- An undone action is removed completely from the in-session Reactivation History.
- No deleted or undone event is written to a history column or displayed later.
- Google Sheet stores only Phone/Mail/Total counters because no detailed event-log column was supplied.

CLIENT CARD
Click an ID row to open one technical dialog that is visually split into two panels.

Left panel:
- Playing (shown only when a real source exists)
- In Reactivation Since
- Last Activity
- newest-sheet Reactivation NGR
- newest-sheet Deposits
- Total Contacts
- 12M Turnover Split from sheet 365
- existing 30D / 12M Performance
- Current Quest and return route to Reactivation
- compact Mail / Call / Undo controls
- Bonus History button

Right Reactivation panel:
- Current Reactivation Notes open by default and use only newest-sheet Comm
- Offer opens the BD / FB / TO Deposit / manual Quest editor
- Notes History shows the chained Previous Attempts chronologically, newest first
- I WILL is not part of the current UI
- Clicking the client name opens the matching Being card; its return button restores
  the same Reactivation client card.

Being Notes remain completely separate in:
  Being_Archive -> Notes

Reactivation never reads or writes those Being Notes.

APPS SCRIPT
Required Apps Script API version:
  3.3

After replacing Code.gs:
1. Save the Apps Script project.
2. Run setupBeingApi() once if this script has not already been configured.
3. Optionally run setupReactivationApi() to validate the discovered since-sheets.
4. Deploy -> Manage deployments -> Edit -> New version -> Deploy.
5. Restart CRM.
6. Confirm:
   http://127.0.0.1:8765/being-api?action=ping

Expected version:
  3.3
REACTIVATION CLIENT CARD STATISTICS
-----------------------------------
Sheet 365 is the authoritative source. Player Id and Level 1 are shared in A:B;
row 1 contains wide metric sections and row 2 repeats dates inside each section:
  metric title; then Player Id | Level 1 | YYYY-MM-DD ...; then client rows.
Level 1 is Last Activity Date. Daily values are aggregated into Last Day, 7D,
30D and a maximum of 12M. No Lifetime period is read or displayed.

The card contains one shared 30 Days / 12 Months selector. It changes both:
  - Activity & Profitability: Last Activity, GGR, NGR, BR, Sport GGR, Casino GGR
  - Casino Breakdown: Slots, Instant and Live with separate GGR and NGR

Older optional statistics sheets are fallback-only and must have
an ID or Client ID header plus at least two supported metric headers. Period can
be supplied in one of three ways:
  - Period column values: 30D or 12M
  - 30D or 12M in the sheet name
  - 30D or 12M in each metric header

Supported metric header forms include:
  Last Activity / Last Activity Date, GGR, NGR, BR / Bonus Rate,
  Sport GGR / GGR Sport, Casino GGR / GGR Casino,
  Slots GGR / GGR Slots, Slots NGR / NGR Slots,
  Instant GGR / GGR Instant, Instant NGR / NGR Instant,
  Live GGR / GGR Live, Live NGR / NGR Live.

Being_Archive and every sheet named since DD.MM.YYYY are excluded from this
automatic statistics scan. Missing metrics are displayed as —, never as fake 0.
