/************************************************************
 * VIP CRM / BEING GOOGLE SHEET API
 * v3.4 — exact 365 layout + day/7D/30D/12M + dated quest tracking
 *        + per-section daily turnover (Casino / Sport) for quest scoping
 *        + change-driven 365 cache reset (setupBeing365CacheTrigger)
 *
 * PRIMARY KEY:
 *   Client ID
 *
 * IMPORTANT:
 *   Only Client ID is mandatory for READ.
 *   Missing optional columns NEVER stop the entire client feed.
 *
 * Supported Last Contact headers:
 *   Last Contact Date
 *   Last Contact
 *   Data
 *   Date
 *
 * Supported Follow-up headers:
 *   Follow Up Date
 *   Follow-up Date
 *   Follow Up
 *   Follow-up
 ************************************************************/

const CONFIG = Object.freeze({
  SHEET_NAME: 'Being_Archive',
  STATISTICS_365_SHEET_NAME: '365',
  ACTIVE_QUEST_COLUMN: 4,
  EMPTY_ACTIVE_QUEST:
    'Quest Name: -; Start Date: -; End Date: -; Quest Conditions: -; Reward: -',

  REACTIVATION: Object.freeze({
    SHEET_PATTERN: /^since\s+(\d{2})\.(\d{2})\.(\d{4})$/i,
    // Historical since-sheets use several real layouts. Match only the exact
    // labels observed in those sheets; normalized whitespace/newlines are OK.
    HEADER_ALIASES: Object.freeze({
      clientId: Object.freeze(['ID', 'Client ID']),
      lastActivityDate: Object.freeze([
        'Last Activity Date',
        'Last Activity',
        'Last Dep',
        'Last Deposit',
        'Notes'
      ]),
      daysInactive: Object.freeze([
        'Days no dep',
        'Days no deposit',
        'Days without deposit'
      ]),
      ngr: Object.freeze(['NGR', 'NGR August']),
      depositAmount: Object.freeze([
        'Dep',
        'Dep August',
        'Deposit Amount',
        'Dep Amount'
      ]),
      previousAttempts: Object.freeze([
        'PREV ATTEMPTS',
        'Previous Attempts',
        'Previous Attempt'
      ]),
      plans: Object.freeze(['PLAN', 'Plans', 'Plan']),
      comm: Object.freeze(['COMM', 'Comment', 'Comments']),
      emails: Object.freeze(['Mail counter', 'Mail', 'Email counter', 'Emails']),
      calls: Object.freeze(['Phone counter', 'Phone', 'Call counter', 'Calls']),
      contactsTotal: Object.freeze(['Contact total', 'Total', 'Total Contacts', 'Contacts Total'])
    })
  }),

  HEADER_ALIASES: Object.freeze({
    clientId: Object.freeze([
      'Client ID'
    ]),

    clientName: Object.freeze([
      'Client Name',
      'Name'
    ]),

    notes: Object.freeze([
      'Notes',
      'Note'
    ]),

    activeQuest: Object.freeze([
      'Active Quest',
      'Current Quest'
    ]),

    bonusLog: Object.freeze([
      'Bonus Log',
      'Bonuses Log'
    ]),

    pinned: Object.freeze([
      'Pinned',
      'Pin'
    ]),

    followUpDate: Object.freeze([
      'Follow Up Date',
      'Follow-up Date',
      'Follow Up',
      'Follow-up'
    ]),

    lastContact: Object.freeze([
      'Last Contact Date',
      'Last Contact',
      'Data',
      'Date'
    ])
  }),

  OPTIONAL_REACTIVATION_ALIASES: Object.freeze({
    playing: Object.freeze(['Playing', 'Product', 'Preferred Product', 'Game Type']),
    to30d: Object.freeze(['TO 30D', 'Turnover 30D', 'TO Last 30 Days']),
    ggr30d: Object.freeze(['GGR 30D', 'GGR Last 30 Days']),
    ngr30d: Object.freeze(['NGR 30D', 'NGR Last 30 Days']),
    br30d: Object.freeze(['BR 30D', 'Bonus Rate 30D', 'BR Last 30 Days']),
    sport30d: Object.freeze(['TO Sport 30D', 'Sport TO 30D']),
    casino30d: Object.freeze(['TO Casino 30D', 'Casino TO 30D']),
    slots30d: Object.freeze(['TO Slots 30D', 'Slots TO 30D']),
    live30d: Object.freeze(['TO Live 30D', 'Live TO 30D']),
    instant30d: Object.freeze(['TO Instant 30D', 'Instant TO 30D']),
    to12m: Object.freeze(['TO 12M', 'Turnover 12M', 'TO Last 12 Months']),
    ggr12m: Object.freeze(['GGR 12M', 'GGR Last 12 Months']),
    ngr12m: Object.freeze(['NGR 12M', 'NGR Last 12 Months']),
    br12m: Object.freeze(['BR 12M', 'Bonus Rate 12M', 'BR Last 12 Months']),
    sport12m: Object.freeze(['TO Sport 12M', 'Sport TO 12M']),
    casino12m: Object.freeze(['TO Casino 12M', 'Casino TO 12M']),
    slots12m: Object.freeze(['TO Slots 12M', 'Slots TO 12M']),
    live12m: Object.freeze(['TO Live 12M', 'Live TO 12M']),
    instant12m: Object.freeze(['TO Instant 12M', 'Instant TO 12M'])
  }),

  CANONICAL_HEADERS: Object.freeze({
    clientId: 'Client ID',
    clientName: 'Client Name',
    notes: 'Notes',
    activeQuest: 'Active Quest',
    bonusLog: 'Bonus Log',
    pinned: 'Pinned',
    followUpDate: 'Follow Up Date',
    lastContact: 'Last Contact Date'
  })
});


/* =========================================================
   1. RUN ONCE AFTER REPLACING CODE
   ========================================================= */

function setupBeingApi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      'Open Apps Script from inside the Google Sheet and run setupBeingApi() again.'
    );
  }

  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.getActiveSheet();
  }

  if (!sheet) {
    throw new Error('Being sheet not found.');
  }

  /*
   * Header creation happens ONLY during manual setup.
   * Normal API reads never modify the sheet structure.
   */
  ensureActiveQuestColumn_(sheet);
  ensureHeaders_(sheet);

  const props = PropertiesService.getScriptProperties();
  let apiKey = props.getProperty('BEING_API_KEY');

  if (!apiKey) {
    apiKey = Utilities.getUuid().replace(/-/g, '');
  }

  props.setProperties({
    BEING_SPREADSHEET_ID: ss.getId(),
    BEING_SHEET_NAME: sheet.getName(),
    BEING_API_KEY: apiKey
  });
  resetSpreadsheetMemo_();

  formatSheet_(sheet);
  SpreadsheetApp.flush();
  invalidateClientsMemo_();

  const schema = inspectSchema_(sheet);

  console.log('========================================');
  console.log('VIP CRM BEING API READY');
  console.log('Spreadsheet ID: ' + ss.getId());
  console.log('Sheet: ' + sheet.getName());
  console.log('Client ID column: ' + schema.mapping.clientId);
  console.log('Client Name column: ' + schema.mapping.clientName);
  console.log('Notes column: ' + schema.mapping.notes);
  console.log('Pinned column: ' + schema.mapping.pinned);
  console.log('Follow-up column: ' + schema.mapping.followUpDate);
  console.log('Last Contact column: ' + schema.mapping.lastContact);
  console.log('API KEY: ' + maskSecret_(apiKey));
  console.log('========================================');

  return {
    ok: true,
    spreadsheetId: ss.getId(),
    sheetName: sheet.getName(),
    mapping: schema.mapping,
    apiKey: apiKey
  };
}


function setupReactivationApi() {
  const ss = getSpreadsheet_();
  const sheets = getReactivationSheets_(ss);

  if (!sheets.length) {
    throw new Error(
      'No Reactivation sheets found. Expected a sheet named since DD.MM.YYYY.'
    );
  }

  const currentSheet = sheets[sheets.length - 1].sheet;
  const currentSchema = inspectReactivationSheetSchema_(currentSheet);
  const currentColumns = {};
  Object.keys(currentSchema.map).forEach(key => {
    currentColumns[key] = reactivationColumnLetter_(currentSchema.map[key]);
  });

  return {
    ok: true,
    ready: true,
    currentSheet: sheets[sheets.length - 1].name,
    historicalSheets: sheets.map(item => item.name),
    baselineDate: sheets[0].isoDate,
    currentColumns: currentColumns,
    currentHeaders: currentSchema.headers
  };
}


/* =========================================================
   2. MANUAL DEBUG
   ========================================================= */

function debugBeingApi() {
  const sheet = getBeingSheet_();
  const schema = inspectSchema_(sheet);
  const clients = getClients_();

  const result = {
    ok: true,
    schema: schema,
    clientCount: clients.length,
    firstClients: clients.slice(0, 3)
  };

  console.log(JSON.stringify(result, null, 2));

  return result;
}


function debug365Statistics_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheets().find(item =>
    normalizeHeader_(item.getName()) === normalizeHeader_(CONFIG.STATISTICS_365_SHEET_NAME)
  );
  if (!sheet) return { ok: false, error: 'Sheet 365 was not found.' };

  const profiles = get365StatisticsProfiles_(ss);
  const ids = Object.keys(profiles);
  const coverage = {};
  ids.forEach(id => {
    const period = profiles[id].performance && profiles[id].performance['12m'] || {};
    Object.keys(period).forEach(field => {
      if (period[field] === null || period[field] === undefined) return;
      coverage[field] = (coverage[field] || 0) + 1;
    });
  });

  return {
    ok: true,
    sheetName: sheet.getName(),
    lastRow: sheet.getLastRow(),
    lastColumn: sheet.getLastColumn(),
    clientCount: ids.length,
    coverage: coverage,
    sample: ids.length ? {
      clientId: ids[0],
      performance: profiles[ids[0]].performance
    } : null
  };
}


function getBeingApiInfo() {
  const props = PropertiesService.getScriptProperties();

  const info = {
    spreadsheetId: props.getProperty('BEING_SPREADSHEET_ID'),
    sheetName: props.getProperty('BEING_SHEET_NAME'),
    apiKey: props.getProperty('BEING_API_KEY')
  };

  // The log is kept by Apps Script; only the return value carries the key.
  console.log(JSON.stringify(
    Object.assign({}, info, { apiKey: maskSecret_(info.apiKey) }),
    null,
    2
  ));
  return info;
}


function getReactivationFeed_() {
  const ss = getSpreadsheet_();
  const sheetEntries = getReactivationSheets_(ss);

  if (!sheetEntries.length) {
    return {
      ok: true,
      service: 'VIP CRM Reactivation Adapter',
      configured: false,
      ready: false,
      currentSheet: '',
      historicalSheets: [],
      baselineDate: '',
      rows: [],
      archiveRows: []
    };
  }

  const beingById = {};
  getClients_().forEach(client => {
    const id = cleanString_(client.clientId);
    if (id) beingById[id] = client;
  });
  const statisticsById = getReactivationStatisticsProfiles_(ss);

  const historyById = {};
  const latestSnapshotById = {};
  const lastSeenEntryById = {};
  const currentEntry = sheetEntries[sheetEntries.length - 1];
  // The current sheet is part of the history pass, so its rows are kept
  // rather than read a second time below.
  let currentRows = [];

  sheetEntries.forEach(entry => {
    const rows = readReactivationSheetRows_(entry.sheet);
    if (entry === currentEntry) currentRows = rows;
    const seenSheetIds = {};

    rows.forEach(row => {
      const id = row.clientId;
      if (!id || seenSheetIds[id]) return;
      seenSheetIds[id] = true;

      if (!historyById[id]) {
        historyById[id] = {
          firstSeenDate: entry.isoDate,
          previousWeekLog: [],
          reactivationNotes: []
        };
      }

      const history = historyById[id];
      history.firstSeenDate = history.firstSeenDate < entry.isoDate
        ? history.firstSeenDate
        : entry.isoDate;
      const previousEntry = lastSeenEntryById[id] || null;
      if (row.previousAttemptsText) {
        const sourceEntry = previousEntry || entry;
        history.previousWeekLog.push({
          date: sourceEntry.isoDate,
          sheetName: sourceEntry.name,
          text: row.previousAttemptsText
        });
        Array.prototype.push.apply(
          history.reactivationNotes,
          parseReactivationCommEntries_(
            row.previousAttemptsText,
            sourceEntry.isoDate,
            sourceEntry.name,
            false
          )
        );
      }

      lastSeenEntryById[id] = entry;
      latestSnapshotById[id] = {
        entry: entry,
        row: row
      };
    });
  });

  Object.keys(historyById).forEach(id => {
    historyById[id].previousWeekLog.sort((a, b) =>
      String(b.date).localeCompare(String(a.date))
    );
    historyById[id].reactivationNotes.sort(compareReactivationNotesNewestFirst_);
  });

  const seenCurrentIds = {};
  const rows = [];

  currentRows.forEach(row => {
    if (!row.clientId || seenCurrentIds[row.clientId]) return;
    seenCurrentIds[row.clientId] = true;
    rows.push(buildReactivationClient_(
      row.clientId,
      row,
      historyById[row.clientId],
      beingById[row.clientId],
      currentEntry,
      statisticsById[row.clientId]
    ));
  });

  const archiveRows = Object.keys(historyById).map(id => {
    const snapshot = latestSnapshotById[id];
    return buildReactivationClient_(
      id,
      snapshot ? snapshot.row : null,
      historyById[id],
      beingById[id],
      snapshot ? snapshot.entry : currentEntry,
      statisticsById[id]
    );
  });

  return {
    ok: true,
    service: 'VIP CRM Reactivation Adapter',
    configured: true,
    ready: true,
    currentSheet: currentEntry.name,
    currentSheetDate: currentEntry.isoDate,
    historicalSheets: sheetEntries.map(item => item.name),
    baselineDate: sheetEntries[0].isoDate,
    rows: rows,
    archiveRows: archiveRows
  };
}


function updateReactivation_(mutation) {
  if (!mutation || typeof mutation !== 'object') {
    throw new Error('Reactivation mutation is required.');
  }

  const action = cleanString_(mutation.action);
  const id = cleanString_(mutation.clientId);

  if (!id) {
    throw new Error('Reactivation ID is required.');
  }

  /*
    Every mutation serialises on one script lock. Ten seconds was short enough
    that a second save arriving during the first would give up and surface as a
    rollback; twenty still leaves room inside the bridge's own timeout.
  */
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const ss = getSpreadsheet_();
    const sheets = getReactivationSheets_(ss);

    if (!sheets.length) {
      throw new Error('No sheet named since DD.MM.YYYY was found.');
    }

    const current = sheets[sheets.length - 1];
    const sheet = current.sheet;
    const schema = inspectReactivationSheetSchema_(sheet);
    const clientIdIndex = requireReactivationColumn_(schema, 'clientId', 'ID');
    let rowNumber = findClientRow_(sheet, clientIdIndex + 1, id);

    if (action === 'client:add') {
      if (rowNumber) {
        return {
          ok: true,
          action: action,
          clientId: id,
          sheetName: current.name,
          row: rowNumber,
          duplicate: true
        };
      }

      /*
        Only existence in Being_Archive matters here, so one column is scanned
        instead of rebuilding every client with their 365 statistics.
      */
      const beingSheet = getBeingSheet_();
      const beingHeaders = beingSheet
        .getRange(1, 1, 1, Math.max(1, beingSheet.getLastColumn()))
        .getDisplayValues()[0];
      const beingIdIndex = findHeaderIndex_(beingHeaders, CONFIG.HEADER_ALIASES.clientId);
      requireColumn_(beingIdIndex, 'Client ID');
      const beingRow = findClientRow_(beingSheet, beingIdIndex + 1, id);
      if (!beingRow) {
        throw new Error('ID is not available in Being_Archive: ' + id);
      }

      rowNumber = Math.max(2, sheet.getLastRow() + 1);
      const idCell = sheet.getRange(rowNumber, clientIdIndex + 1);
      idCell.setNumberFormat('@');
      idCell.setValue(id);

      ['emails', 'calls', 'contactsTotal'].forEach(key => {
        const columnIndex = requireReactivationColumn_(schema, key, key);
        sheet.getRange(rowNumber, columnIndex + 1).setValue(0);
      });
      SpreadsheetApp.flush();
      invalidateClientsMemo_();

      if (cleanString_(idCell.getDisplayValue()) !== id) {
        throw new Error('Reactivation ID verification failed after write.');
      }

      return {
        ok: true,
        action: action,
        clientId: id,
        sheetName: current.name,
        row: rowNumber,
        duplicate: false
      };
    }

    if (!rowNumber) {
      throw new Error('ID is not present in current Reactivation sheet: ' + id);
    }

    /*
      The Offer Decision is a plan, not a contact note, so it has its own
      column. COMM keeps the running conversation.
    */
    if (action === 'plan:update') {
      const planIndex = requireReactivationColumn_(schema, 'plans', 'PLAN');
      return writeVerifiedReactivationText_(
        sheet,
        rowNumber,
        planIndex + 1,
        mutation.value,
        action,
        id,
        current.name
      );
    }

    if (action === 'comm:update') {
      const commIndex = requireReactivationColumn_(schema, 'comm', 'COMM');
      return writeVerifiedReactivationText_(
        sheet,
        rowNumber,
        commIndex + 1,
        mutation.value,
        action,
        id,
        current.name
      );
    }

    if (action === 'contact:add' || action === 'contact:undo') {
      const type = cleanString_(
        mutation.type || (mutation.entry && mutation.entry.type)
      ).toLowerCase() === 'call' ? 'call' : 'email';
      const emailIndex = requireReactivationColumn_(schema, 'emails', 'Mail');
      const callIndex = requireReactivationColumn_(schema, 'calls', 'Phone');
      const totalIndex = requireReactivationColumn_(schema, 'contactsTotal', 'Total');

      /*
        One pass over the row instead of six single-cell reads. The counters
        live in three columns that are not adjacent, so the row is read whole
        and only the three cells are written back; the rest of the row is left
        untouched, formulas and formatting included.
      */
      const counterWidth = Math.max(sheet.getLastColumn(), emailIndex + 1, callIndex + 1, totalIndex + 1);
      const counterRange = sheet.getRange(rowNumber, 1, 1, counterWidth);
      const counterRaw = counterRange.getValues()[0];
      const counterText = counterRange.getDisplayValues()[0];
      const readCounter = (index) =>
        Math.max(0, Math.floor(readReactivationNumber_(counterRaw[index], counterText[index])));

      const emailCell = sheet.getRange(rowNumber, emailIndex + 1);
      const callCell = sheet.getRange(rowNumber, callIndex + 1);
      const totalCell = sheet.getRange(rowNumber, totalIndex + 1);
      let emails = readCounter(emailIndex);
      let calls = readCounter(callIndex);
      let total = readCounter(totalIndex);
      const delta = action === 'contact:add' ? 1 : -1;

      if (type === 'call') {
        calls = Math.max(0, calls + delta);
      } else {
        emails = Math.max(0, emails + delta);
      }
      total = Math.max(0, total + delta);

      emailCell.setValue(emails);
      callCell.setValue(calls);
      totalCell.setValue(total);
      SpreadsheetApp.flush();
      invalidateClientsMemo_();

      // The same single pass is used to verify, instead of six more reads.
      const savedRaw = counterRange.getValues()[0];
      const savedText = counterRange.getDisplayValues()[0];
      const saved = [emailIndex, callIndex, totalIndex].map(index =>
        Math.max(0, Math.floor(readReactivationNumber_(savedRaw[index], savedText[index])))
      );

      if (saved[0] !== emails || saved[1] !== calls || saved[2] !== total) {
        throw new Error('Reactivation counter verification failed after write.');
      }

      return {
        ok: true,
        action: action,
        clientId: id,
        sheetName: current.name,
        row: rowNumber,
        type: type,
        counters: {
          emails: emails,
          calls: calls,
          total: total
        }
      };
    }

    throw new Error('Unknown Reactivation mutation: ' + action);
  } finally {
    lock.releaseLock();
  }
}


function getReactivationSheets_(ss) {
  return ss.getSheets()
    .map(sheet => {
      const name = cleanString_(sheet.getName());
      const match = name.match(CONFIG.REACTIVATION.SHEET_PATTERN);
      if (!match) return null;

      const year = Number(match[3]);
      const month = Number(match[2]);
      const day = Number(match[1]);
      const parsed = new Date(Date.UTC(year, month - 1, day));

      if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
      ) {
        return null;
      }

      const isoDate = match[3] + '-' + match[2] + '-' + match[1];
      return {
        sheet: sheet,
        name: name,
        isoDate: isoDate,
        sheetIndex: sheet.getIndex()
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const dateCompare = a.isoDate.localeCompare(b.isoDate);
      return dateCompare || a.sheetIndex - b.sheetIndex;
    });
}


/*
 * Optional statistics sources for the Reactivation client card.
 * The reader deliberately ignores Being_Archive and every since-sheet. It
 * discovers the two statistics domains by ID plus their metric headers, so
 * exact sheet names may be chosen later without another UI rebuild.
 *
 * Supported period conventions:
 *   - a Period column containing 30D / 12M;
 *   - 30D / 12M in the sheet name;
 *   - 30D / 12M appended to each metric header.
 */
function getReactivationStatisticsProfiles_(ss) {
  const profiles = {};
  const beingSheetName = cleanString_(getBeingSheet_().getName());
  const timezone = getSafeTimezone_();

  ss.getSheets().forEach(sheet => {
    const sheetName = cleanString_(sheet.getName());
    if (
      sheetName === beingSheetName ||
      normalizeHeader_(sheetName) === normalizeHeader_(CONFIG.STATISTICS_365_SHEET_NAME) ||
      CONFIG.REACTIVATION.SHEET_PATTERN.test(sheetName) ||
      sheet.getLastRow() < 2
    ) {
      return;
    }

    const lastColumn = Math.max(1, sheet.getLastColumn());
    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    const idIndex = findHeaderIndex_(headers, ['ID', 'Client ID']);
    if (idIndex < 0) return;

    const periodIndex = findHeaderIndex_(headers, ['Period', 'Range', 'Time Period']);
    const descriptors = headers.map((header, index) => {
      const field = parseReactivationStatisticField_(header);
      return field ? {
        index: index,
        field: field,
        period: detectReactivationStatisticPeriod_(header)
      } : null;
    }).filter(Boolean);

    // An ordinary ID sheet with one coincidental GGR column is not a card
    // statistics source. Both requested new sheets contain several metrics.
    if (descriptors.length < 2) return;

    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn);
    const rawRows = range.getValues();
    const displayRows = range.getDisplayValues();
    const sheetPeriod = detectReactivationStatisticPeriod_(sheetName);

    for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex++) {
      const id = readDisplayCell_(displayRows[rowIndex], idIndex);
      if (!id) continue;
      const rowPeriod = periodIndex >= 0
        ? detectReactivationStatisticPeriod_(readDisplayCell_(displayRows[rowIndex], periodIndex))
        : '';
      if (!profiles[id]) profiles[id] = { performance: { '30d': {}, '12m': {} } };

      descriptors.forEach(descriptor => {
        const period = descriptor.period || rowPeriod || sheetPeriod || '30d';
        const target = profiles[id].performance[period];
        if (descriptor.field === 'lastActivityDate') {
          const value = readDateCell_(rawRows[rowIndex], displayRows[rowIndex], descriptor.index, timezone);
          if (value) target.lastActivityDate = value;
          return;
        }
        const value = readOptionalSheetNumber_(rawRows[rowIndex], displayRows[rowIndex], descriptor.index);
        if (value !== null) target[descriptor.field] = value;
      });
    }
  });

  return profiles;
}


function detectReactivationStatisticPeriod_(value) {
  const text = normalizeHeader_(value);
  if (/\b(12m|12 month|12 months|year|yearly)\b/.test(text)) return '12m';
  if (/\b(30d|30 day|30 days|month|monthly)\b/.test(text)) return '30d';
  return '';
}


function parseReactivationStatisticField_(header) {
  let text = normalizeHeader_(header)
    .replace(/\b(last )?30 days?\b/g, '')
    .replace(/\b30d\b/g, '')
    .replace(/\b(last )?12 months?\b/g, '')
    .replace(/\b12m\b/g, '')
    .replace(/\b(monthly|yearly)\b/g, '')
    .trim();

  const aliases = {
    lastActivityDate: ['last activity date', 'last activity'],
    ggrSport: ['ggr sport', 'sport ggr'],
    ggrCasino: ['ggr casino', 'casino ggr'],
    ggrSlots: ['ggr slots', 'slots ggr'],
    ngrSlots: ['ngr slots', 'slots ngr'],
    ggrInstant: ['ggr instant', 'instant ggr'],
    ngrInstant: ['ngr instant', 'instant ngr'],
    ggrLive: ['ggr live', 'live ggr'],
    ngrLive: ['ngr live', 'live ngr'],
    bonusRate: ['br', 'bonus rate'],
    ggr: ['ggr'],
    ngr: ['ngr']
  };

  const keys = Object.keys(aliases);
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    if (aliases[key].some(alias => text === normalizeHeader_(alias))) return key;
  }
  return '';
}


function mergeReactivationProfiles_(baseProfile, statisticsProfile) {
  const base = baseProfile || {};
  const statistics = statisticsProfile || {};
  const basePerformance = base.performance || {};
  const statisticsPerformance = statistics.performance || {};

  return {
    playing: base.playing || '',
    daily: Object.assign({}, base.daily || {}, statistics.daily || {}),
    performance: {
      'day': Object.assign({}, basePerformance['day'] || {}, statisticsPerformance['day'] || {}),
      '7d': Object.assign({}, basePerformance['7d'] || {}, statisticsPerformance['7d'] || {}),
      '30d': Object.assign({}, basePerformance['30d'] || {}, statisticsPerformance['30d'] || {}),
      '12m': Object.assign({}, basePerformance['12m'] || {}, statisticsPerformance['12m'] || {})
    }
  };
}


/*
 * Sheet "365" has one shared client area in columns A:B and multiple daily
 * metric sections to the right. Real layout:
 *   row 1:        GGR | NGR | Turnover | Bonus Rate | Casino TO | ...
 *   row 2: ID | Level 1 | dates repeated inside every metric section
 *   row 3: Grand Total
 *   row 4+: clients
 *
 * Level 1 is treated as Last Activity Date. Daily columns are aggregated from
 * the latest available date in that block into day, 7D, 30D and max 12M.
 */
/**
 * Daily 365 metrics kept per date for Current Quest tracking.
 * A quest may be scoped to Casino, Sport or the combination of both, so the
 * per-section turnover columns are stored next to the totals.
 */
const QUEST_DAILY_FIELDS = Object.freeze([
  'to',
  'ggr',
  'casino',
  'sport',
  'deposits',
  'withdrawals'
]);


/**
 * 365 read strategy.
 *
 * The sheet is very wide: one dated column per day per metric section. Reading
 * it whole, twice, was the single most expensive operation in the API.
 *
 * Three things keep it cheap now:
 *   1. Only the header rows are scanned to discover the layout.
 *   2. Only the columns that feed a real metric are read, merged into as few
 *      contiguous blocks as possible. Bonus Rate is derived, "sort by" is not
 *      a metric and the Total columns hold no date, so none of them is read.
 *   3. Display values are fetched for the Player Id / Level 1 pair only.
 *      Dated cells are numbers, so their raw values are enough.
 *
 * The finished profiles are cached, so the getClients and getReactivation
 * requests of one CRM start share a single pass over the sheet.
 */
const STATISTICS_365_READ = Object.freeze({
  HEADER_SCAN_ROWS: 6,
  // Two columns separated by less than this are read as one block: one extra
  // round trip costs more than a few unused cells.
  MAX_COLUMN_GAP: 8
});

const STATISTICS_365_CACHE = Object.freeze({
  KEY_PREFIX: 'vipcrm365',
  GENERATION_PROPERTY: 'VIPCRM_365_CACHE_GENERATION',
  TTL_SECONDS: 21600,
  CHUNK_SIZE: 90000,
  MAX_CHUNKS: 40,

  // The export lands at no fixed time, so the reset reacts to the sheet
  // changing rather than to the clock.
  TRIGGER_HANDLER: 'onBeing365Change',

  // How long after one of this script's own writes an onChange is treated as
  // that write echoing back rather than a real edit to sheet 365.
  SELF_WRITE_PROPERTY: 'VIPCRM_365_LAST_SELF_WRITE',
  SELF_WRITE_WINDOW_MS: 30000
});

let memoized365Profiles_ = null;
let memoized365Signature_ = '';


function get365StatisticsProfiles_(ss) {
  const sheet = ss.getSheets().find(item =>
    normalizeHeader_(item.getName()) === normalizeHeader_(CONFIG.STATISTICS_365_SHEET_NAME)
  );
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 3) return {};

  const timezone = getSafeTimezone_();
  const layout = detect365Layout_(sheet, timezone);
  if (!layout) return {};

  const signature = [
    STATISTICS_365_CACHE.KEY_PREFIX,
    get365CacheGeneration_(),
    layout.lastRow,
    layout.lastColumn,
    layout.latestIsoDate,
    layout.descriptors.length
  ].join('|');

  if (memoized365Profiles_ && memoized365Signature_ === signature) {
    return memoized365Profiles_;
  }

  const cached = read365ProfilesCache_(signature);
  if (cached) {
    memoized365Profiles_ = cached;
    memoized365Signature_ = signature;
    return cached;
  }

  const profiles = build365StatisticsProfiles_(sheet, layout, timezone);
  memoized365Profiles_ = profiles;
  memoized365Signature_ = signature;
  write365ProfilesCache_(signature, profiles);
  return profiles;
}


/**
 * Reads the header rows only and works out where everything lives.
 */
function detect365Layout_(sheet, timezone) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const headerRows = Math.min(lastRow, STATISTICS_365_READ.HEADER_SCAN_ROWS);
  const headerRange = sheet.getRange(1, 1, headerRows, lastColumn);
  const headerRaw = headerRange.getValues();
  const headerDisplay = headerRange.getDisplayValues();

  let anchor = null;
  headerDisplay.some((row, rowIndex) => row.some((cell, columnIndex) => {
    const header = normalizeHeader_(cell);
    if (header !== 'player id' && header !== 'client id' && header !== 'id') return false;
    const levelHeader = normalizeHeader_(row[columnIndex + 1]);
    if (levelHeader && levelHeader !== 'level 1' && levelHeader !== 'last activity date') return false;
    anchor = { row: rowIndex, column: columnIndex };
    return true;
  }));
  if (!anchor) return null;

  const headerRowIndex = anchor.row;
  const idColumnIndex = anchor.column;
  const dateHeaderDisplay = headerDisplay[headerRowIndex];
  const dateHeaderRaw = headerRaw[headerRowIndex];

  let titleRowIndex = -1;
  let titlePositions = [];
  for (let rowIndex = headerRowIndex - 1; rowIndex >= Math.max(0, headerRowIndex - 3); rowIndex--) {
    const positions = headerDisplay[rowIndex]
      .map((value, column) => cleanString_(value) ? column : -1)
      .filter(column => column >= idColumnIndex + 2);
    const recognized = positions.filter(column => parse365MetricField_(headerDisplay[rowIndex][column]));
    if (recognized.length > titlePositions.length) {
      titleRowIndex = rowIndex;
      titlePositions = positions;
    }
  }
  if (titleRowIndex < 0 || !titlePositions.length) return null;

  const descriptors = [];
  titlePositions.forEach((startColumn, index) => {
    const title = cleanString_(headerDisplay[titleRowIndex][startColumn]);
    const field = parse365MetricField_(title);
    if (!field) return;
    // Bonus Rate is recomputed from Clear Bonus and GGR, so its 170-odd daily
    // columns are never read.
    if (field === 'bonusRate') return;
    const endColumn = index + 1 < titlePositions.length
      ? titlePositions[index + 1]
      : lastColumn;
    const dateColumns = [];
    for (let column = startColumn; column < endColumn; column++) {
      const isoDate = formatDateForApi_(dateHeaderRaw[column], dateHeaderDisplay[column], timezone);
      if (!isoDate) continue;
      const timestamp = Date.parse(isoDate + 'T00:00:00Z');
      if (isFinite(timestamp)) dateColumns.push({ index: column, isoDate: isoDate, timestamp: timestamp });
    }
    if (!dateColumns.length) return;
    descriptors.push({ title: title, field: field, dateColumns: dateColumns });
  });
  if (!descriptors.length) return null;

  let latestIsoDate = '';
  descriptors.forEach(descriptor => descriptor.dateColumns.forEach(item => {
    if (item.isoDate > latestIsoDate) latestIsoDate = item.isoDate;
  }));

  return {
    lastRow: lastRow,
    lastColumn: lastColumn,
    headerRowIndex: headerRowIndex,
    idColumnIndex: idColumnIndex,
    descriptors: descriptors,
    latestIsoDate: latestIsoDate
  };
}


/**
 * Turns the columns a metric actually needs into the smallest set of
 * contiguous ranges that still covers them.
 */
function merge365ColumnBlocks_(columnIndexes) {
  const sorted = columnIndexes.slice().sort((a, b) => a - b);
  const blocks = [];

  sorted.forEach(index => {
    const last = blocks[blocks.length - 1];
    if (last && index - last.end <= STATISTICS_365_READ.MAX_COLUMN_GAP) {
      if (index > last.end) last.end = index;
      return;
    }
    blocks.push({ start: index, end: index });
  });

  return blocks;
}


function build365StatisticsProfiles_(sheet, layout, timezone) {
  const firstDataRow = layout.headerRowIndex + 2;
  const rowCount = layout.lastRow - firstDataRow + 1;
  if (rowCount < 1) return {};

  const idColumnIndex = layout.idColumnIndex;
  const neededColumns = {};
  layout.descriptors.forEach(descriptor => descriptor.dateColumns.forEach(item => {
    neededColumns[item.index] = true;
  }));

  const blocks = merge365ColumnBlocks_(
    Object.keys(neededColumns).map(value => Number(value))
  );

  blocks.forEach(block => {
    block.values = sheet
      .getRange(firstDataRow, block.start + 1, rowCount, block.end - block.start + 1)
      .getValues();
  });

  // Column -> which block holds it and at which offset inside that block.
  const columnLocation = {};
  blocks.forEach((block, blockIndex) => {
    for (let column = block.start; column <= block.end; column++) {
      columnLocation[column] = { block: blockIndex, offset: column - block.start };
    }
  });

  // Player Id and Level 1 are the only cells whose formatting matters.
  const identityRange = sheet.getRange(firstDataRow, idColumnIndex + 1, rowCount, 2);
  const identityRaw = identityRange.getValues();
  const identityDisplay = identityRange.getDisplayValues();

  const readCell = function(rowIndex, columnIndex) {
    const location = columnLocation[columnIndex];
    if (!location) return null;
    return read365Number_(blocks[location.block].values[rowIndex][location.offset]);
  };

  // Period membership and the latest date depend on the descriptor only, so
  // they are worked out once here instead of once per client row.
  const descriptorPlans = layout.descriptors.map(descriptor => {
    const dateColumns = descriptor.dateColumns;
    const latestTimestamp = Math.max.apply(null, dateColumns.map(item => item.timestamp));
    return {
      field: descriptor.field,
      dateColumns: dateColumns,
      latestIsoDate: dateColumns.find(item => item.timestamp === latestTimestamp).isoDate,
      isQuestDaily: QUEST_DAILY_FIELDS.indexOf(descriptor.field) >= 0,
      periodColumns: {
        day: dateColumns.filter(item => item.timestamp === latestTimestamp),
        '7d': dateColumns.filter(item => item.timestamp >= latestTimestamp - 6 * 86400000),
        '30d': dateColumns.filter(item => item.timestamp >= latestTimestamp - 29 * 86400000),
        '12m': dateColumns.filter(item => item.timestamp >= latestTimestamp - 364 * 86400000)
      }
    };
  });

  const profiles = {};
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const id = cleanString_(identityDisplay[rowIndex][0]);
    const normalizedId = normalizeHeader_(id);
    if (!id || normalizedId === 'player id' || normalizedId === 'total' || normalizedId === 'grand total') continue;
    if (!profiles[id]) profiles[id] = createEmpty365Profile_();

    const lastActivityDate = formatDateForApi_(
      identityRaw[rowIndex][1],
      identityDisplay[rowIndex][1],
      timezone
    );

    descriptorPlans.forEach(descriptor => {
      const dateColumns = descriptor.dateColumns;
      const latestIsoDate = descriptor.latestIsoDate;
      const periodColumns = descriptor.periodColumns;

      // Current Quest needs real values for an arbitrary inclusive date range.
      // Missing metrics stay absent so unavailable data is never shown as zero.
      // 'casino' and 'sport' carry the per-section turnover a quest can be
      // scoped to. In the supplied 365 workbook casino + sport reconciles
      // exactly with the Turnover total, so the combined section keeps using
      // 'to' as its authoritative source.
      if (descriptor.isQuestDaily) {
        dateColumns.forEach(item => {
          const dailyValue = readCell(rowIndex, item.index);
          if (dailyValue === null) return;
          if (!profiles[id].daily[item.isoDate]) profiles[id].daily[item.isoDate] = {};
          add365MetricValue_(profiles[id].daily[item.isoDate], descriptor.field, dailyValue);
        });
      }

      Object.keys(periodColumns).forEach(period => {
        const target = profiles[id].performance[period];
        if (!target.sourceLatestDate || latestIsoDate > target.sourceLatestDate) {
          target.sourceLatestDate = latestIsoDate;
        }
        if (lastActivityDate) target.lastActivityDate = lastActivityDate;
        const values = periodColumns[period]
          .map(item => readCell(rowIndex, item.index))
          .filter(value => value !== null);
        if (!values.length) return;
        add365MetricValue_(
          target,
          descriptor.field,
          values.reduce((sum, item) => sum + item, 0)
        );
      });
    });
  }

  Object.keys(profiles).forEach(id => {
    Object.keys(profiles[id].performance).forEach(period => {
      const target = profiles[id].performance[period];
      // SUM(Clear Bonus) / SUM(GGR) reconciles with the workbook Total column.
      // Every computable result is kept, negative Bonus Rate included: a
      // negative GGR period with a paid bonus is real data, not an error.
      // Only a zero divisor has no result at all, and then the card shows a
      // dash instead of Infinity.
      if (
        typeof target.bonus === 'number' &&
        isFinite(target.bonus) &&
        typeof target.ggr === 'number' &&
        isFinite(target.ggr) &&
        target.ggr !== 0
      ) {
        target.bonusRate = target.bonus / target.ggr * 100;
      } else {
        delete target.bonusRate;
      }
    });
  });
  return profiles;
}


/**
 * Dated 365 cells are numbers. Text is still accepted so a manually typed
 * value does not silently disappear.
 */
function read365Number_(value) {
  if (typeof value === 'number') return isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const text = cleanString_(value);
  if (text === '') return null;
  return readReactivationNumber_(value, text);
}


/* =========================================================
   365 CACHE
   Best effort only. Any failure falls back to reading the sheet.
   ========================================================= */

function get365CacheGeneration_() {
  try {
    return PropertiesService
      .getScriptProperties()
      .getProperty(STATISTICS_365_CACHE.GENERATION_PROPERTY) || '1';
  } catch (error) {
    return '1';
  }
}


/**
 * Run from the editor after editing 365 by hand. The cache key carries a
 * generation counter, so bumping it retires every stored entry at once.
 */
function resetBeing365Cache() {
  memoized365Profiles_ = null;
  memoized365Signature_ = '';

  const properties = PropertiesService.getScriptProperties();
  const next = String((Number(get365CacheGeneration_()) || 1) + 1);
  properties.setProperty(STATISTICS_365_CACHE.GENERATION_PROPERTY, next);

  return { ok: true, generation: next };
}


/**
 * Marks the moment this script last wrote to the spreadsheet itself.
 *
 * Sheet 365 is written by the daily export only; the CRM writes to
 * Being_Archive and the since-sheets. The onChange trigger cannot tell which
 * sheet a web-app write touched, so the writes announce themselves instead.
 */
function markBeingSelfWrite_() {
  try {
    PropertiesService
      .getScriptProperties()
      .setProperty(STATISTICS_365_CACHE.SELF_WRITE_PROPERTY, String(Date.now()));
  } catch (error) {
    // A missed marker only costs one extra read, so it is never fatal.
  }
}


function isRecentBeingSelfWrite_() {
  try {
    const raw = PropertiesService
      .getScriptProperties()
      .getProperty(STATISTICS_365_CACHE.SELF_WRITE_PROPERTY);
    if (!raw) return false;

    const age = Date.now() - Number(raw);
    return isFinite(age) && age >= 0 && age < STATISTICS_365_CACHE.SELF_WRITE_WINDOW_MS;
  } catch (error) {
    return false;
  }
}


/**
 * Change-driven cache invalidation.
 *
 * The 365 export lands at no fixed time, so the reset is bound to the sheet
 * changing rather than to a clock.
 *
 * What it must NOT do is fire on the CRM's own writes. Every mutation ends by
 * reading the client back, and an invalidation here made that read miss the
 * cache and re-scan sheet 365 while the mutation still held the script lock.
 * That is what made saving a quest slow enough to look broken.
 *
 * The ordinary daily export is still caught for free without this trigger at
 * all: appending a day moves latestIsoDate, which is part of the cache key.
 */
function onBeing365Change() {
  if (isRecentBeingSelfWrite_()) return;
  resetBeing365Cache();
}


/**
 * Run once per spreadsheet from the editor. Installing twice is safe: the
 * previous trigger for this handler is removed first.
 */
function setupBeing365CacheTrigger() {
  const ss = getSpreadsheet_();
  const replaced = removeBeing365CacheTrigger().removed;

  ScriptApp.newTrigger(STATISTICS_365_CACHE.TRIGGER_HANDLER)
    .forSpreadsheet(ss)
    .onChange()
    .create();

  console.log('========================================');
  console.log('VIP CRM 365 CACHE AUTO-RESET INSTALLED');
  console.log('Fires on: any change to ' + ss.getName());
  console.log('Handler: ' + STATISTICS_365_CACHE.TRIGGER_HANDLER);
  console.log('Replaced triggers: ' + replaced);
  console.log('========================================');

  return { ok: true, spreadsheetId: ss.getId(), replaced: replaced };
}


function removeBeing365CacheTrigger() {
  let removed = 0;

  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() !== STATISTICS_365_CACHE.TRIGGER_HANDLER) return;
    ScriptApp.deleteTrigger(trigger);
    removed++;
  });

  return { ok: true, removed: removed };
}


function read365ProfilesCache_(signature) {
  try {
    const cache = CacheService.getScriptCache();
    const head = cache.get(signature);
    if (!head) return null;

    const chunkCount = Number(head);
    if (!isFinite(chunkCount) || chunkCount < 1) return null;

    const keys = [];
    for (let index = 0; index < chunkCount; index++) keys.push(signature + ':' + index);

    const parts = cache.getAll(keys);
    let text = '';
    for (let index = 0; index < chunkCount; index++) {
      const part = parts[signature + ':' + index];
      // A partially evicted entry is unusable, so the sheet is read instead.
      if (part === null || part === undefined) return null;
      text += part;
    }

    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}


function write365ProfilesCache_(signature, profiles) {
  try {
    const text = JSON.stringify(profiles);
    const chunkSize = STATISTICS_365_CACHE.CHUNK_SIZE;
    const chunkCount = Math.ceil(text.length / chunkSize);
    if (chunkCount < 1 || chunkCount > STATISTICS_365_CACHE.MAX_CHUNKS) return;

    const payload = {};
    for (let index = 0; index < chunkCount; index++) {
      payload[signature + ':' + index] = text.substr(index * chunkSize, chunkSize);
    }

    const cache = CacheService.getScriptCache();
    // Chunks first, head last: a half-written entry never advertises itself.
    cache.putAll(payload, STATISTICS_365_CACHE.TTL_SECONDS);
    cache.put(signature, String(chunkCount), STATISTICS_365_CACHE.TTL_SECONDS);
  } catch (error) {
    // Caching is an optimization, never a requirement.
  }
}


function createEmpty365Profile_() {
  return {
    daily: {},
    performance: { day: {}, '7d': {}, '30d': {}, '12m': {} }
  };
}


function parse365MetricField_(value) {
  const text = normalizeHeader_(value)
    .replace(/\b(eur|euro|%|percent|percentage|amount|total)\b/g, ' ')
    .replace(/[,():/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const has = function(pattern) { return pattern.test(text); };
  const product = has(/\b(sport|sports|sportsbook)\b/) ? 'Sport'
    : has(/\b(slots?|slot games?)\b/) ? 'Slots'
    : has(/\b(instant|instant games?)\b/) ? 'Instant'
    : has(/\b(live|live casino)\b/) ? 'Live'
    : has(/\bcasino\b/) ? 'Casino'
    : '';

  if (has(/\bggr\b/)) return product ? 'ggr' + product : 'ggr';
  if (has(/\bngr\b/)) return product ? 'ngr' + product : 'ngr';
  if (has(/\bbonus(es)?\b/) && has(/\b(rate|br)\b/)) return 'bonusRate';
  if (has(/\bbonus(es)?\b/)) return 'bonus';
  if (has(/\bdeposit(s)?\b/) && has(/\b(count|number|qty|quantity)\b/)) return 'depositCount';
  if (has(/\bwithdrawal(s)?\b/) && has(/\b(count|number|qty|quantity)\b/)) return 'withdrawalCount';
  if (has(/\bdeposit(s)?\b/)) return 'deposits';
  if (has(/\bwithdrawal(s)?\b/)) return 'withdrawals';
  if (has(/\b(to|turnover|bets?|betting)\b/)) {
    return product ? product.charAt(0).toLowerCase() + product.slice(1) : 'to';
  }

  // Every other spelling is already resolved by the pattern chain above;
  // only a bare "BR" carries neither "bonus" nor "rate".
  if (text === 'br') return 'bonusRate';
  return '';
}


function add365MetricValue_(target, field, value) {
  if (!isFinite(value)) return;
  if (target[field] == null) target[field] = value;
  else target[field] += value;
}


function inspectReactivationSheetSchema_(sheet) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(cleanString_);
  const normalizedHeaders = headers.map(normalizeHeader_);
  const map = {};

  Object.keys(CONFIG.REACTIVATION.HEADER_ALIASES).forEach(key => {
    map[key] = findHeaderIndex_(
      headers,
      CONFIG.REACTIVATION.HEADER_ALIASES[key],
      normalizedHeaders
    );
  });

  return {
    headers: headers,
    map: map,
    lastColumn: lastColumn
  };
}


function reactivationColumnLetter_(zeroBasedIndex) {
  if (!Number.isInteger(zeroBasedIndex) || zeroBasedIndex < 0) return null;
  let value = zeroBasedIndex + 1;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}


function requireReactivationColumn_(schema, key, label) {
  const index = schema && schema.map ? schema.map[key] : -1;
  if (!Number.isInteger(index) || index < 0) {
    const visibleHeaders = schema && Array.isArray(schema.headers)
      ? schema.headers.filter(Boolean).join(' | ')
      : '';
    throw new Error(
      'Reactivation column not found: ' + label +
      (visibleHeaders ? '. Headers: ' + visibleHeaders : '')
    );
  }
  return index;
}


function readReactivationSheetRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const schema = inspectReactivationSheetSchema_(sheet);
  const columns = schema.map;
  if (columns.clientId < 0) return [];
  const range = sheet.getRange(2, 1, lastRow - 1, schema.lastColumn);
  const rawRows = range.getValues();
  const displayRows = range.getDisplayValues();
  const timezone = getSafeTimezone_();
  const rows = [];

  for (let index = 0; index < rawRows.length; index++) {
    const raw = rawRows[index];
    const display = displayRows[index];
    const clientId = readDisplayCell_(display, columns.clientId);
    if (!clientId) continue;

    const lastActivity = readReactivationLastActivity_(
      raw,
      display,
      columns.lastActivityDate,
      columns.daysInactive,
      timezone
    );

    rows.push({
      clientId: clientId,
      lastActivityDate: lastActivity.date,
      daysInactive: lastActivity.days,
      ngr: readOptionalSheetNumber_(raw, display, columns.ngr),
      depositAmount: readOptionalSheetNumber_(raw, display, columns.depositAmount),
      previousAttemptsText: readDisplayCell_(display, columns.previousAttempts),
      plansText: readDisplayCell_(display, columns.plans),
      commText: readDisplayCell_(display, columns.comm),
      emails: readReactivationCounter_(raw, display, columns.emails),
      calls: readReactivationCounter_(raw, display, columns.calls),
      contactsTotal: readReactivationCounter_(raw, display, columns.contactsTotal)
    });
  }

  return rows;
}


function buildReactivationClient_(id, currentRow, history, beingClient, sheetEntry, statisticsProfile) {
  const source = currentRow || {};
  const aggregate = history || {
    firstSeenDate: sheetEntry.isoDate,
    previousWeekLog: [],
    reactivationNotes: []
  };
  const startedAt = aggregate.firstSeenDate || sheetEntry.isoDate;
  const questName = extractActiveQuestName_(beingClient && beingClient.activeQuest);
  // The daily 365 profile attached to Being is authoritative. Older optional
  // statistics sheets are retained only as a fallback for missing fields.
  const profile = mergeReactivationProfiles_(
    statisticsProfile || {},
    beingClient && beingClient.reactivationProfile || {}
  );
  const profileLastActivity = cleanString_(
    profile.performance && profile.performance['12m'] && profile.performance['12m'].lastActivityDate
  );
  const effectiveLastActivity = profileLastActivity || source.lastActivityDate || '';
  const historicalNotes = (aggregate.reactivationNotes || []).map(note => ({
    date: note.date,
    text: note.text,
    sheetName: note.sheetName,
    isCurrent: false
  }));
  const currentNotes = parseReactivationCommEntries_(
    source.commText,
    sheetEntry.isoDate,
    sheetEntry.name,
    true
  );
  const notes = historicalNotes.concat(currentNotes)
    .sort(compareReactivationNotesNewestFirst_);
  const latestOffer = findLatestReactivationOffer_(notes);

  return {
    clientId: id,
    name: cleanString_(beingClient && beingClient.clientName) || id,
    reactivationStartedAt: startedAt,
    daysInReactivation: daysSinceIsoDate_(startedAt),
    lastActivityDate: effectiveLastActivity,
    lastContactDate: cleanString_(beingClient && beingClient.lastContactDate),
    daysInactive: profileLastActivity ? daysSinceIsoDate_(profileLastActivity) : source.daysInactive,
    reactivationNgr: source.ngr,
    depositAmount: source.depositAmount,
    previousWeekLog: aggregate.previousWeekLog || [],
    currentCommText: source.commText || '',
    reactivationNotes: notes,
    /*
      The plan cell is where the Offer Decision lives now. Rows written before
      that fall back to the offer parsed out of COMM, so nothing already saved
      disappears from the card.
    */
    offerText: cleanString_(source.plansText) || latestOffer,
    emails: source.emails || 0,
    calls: source.calls || 0,
    contactsTotal: source.contactsTotal || 0,
    currentSheetName: sheetEntry.name,
    currentSheetDate: sheetEntry.isoDate,
    playing: cleanString_(profile.playing),
    performance: profile.performance || {},
    quest: {
      name: questName
    },
    reactivationTotals: {
      deposits: source.depositAmount,
      ngr: source.ngr
    }
  };
}


function extractActiveQuestName_(value) {
  const text = cleanString_(value);
  if (!text) return '';
  const match = text.match(/Quest Name\s*:\s*([^;]+)/i);
  const name = cleanString_(match ? match[1] : text);
  return name === '-' ? '' : name;
}


function readReactivationInactiveDays_(rawValue, displayValue) {
  const text = cleanString_(displayValue || rawValue);
  const match = text.match(/^-?\s*(\d{1,5})(?:\s*(?:day|days|дн(?:ей|я)?))?\s*$/i);
  if (!match) return null;

  const days = Number(match[1]);
  return isFinite(days) ? Math.max(0, Math.floor(days)) : null;
}


function readReactivationLastActivity_(rawRow, displayRow, dateIndex, daysIndex, timezone) {
  const hasDate = Number.isInteger(dateIndex) && dateIndex >= 0;
  const hasDays = Number.isInteger(daysIndex) && daysIndex >= 0;
  if (!hasDate && !hasDays) {
    return { date: '', days: null };
  }

  const date = hasDate
    ? readDateCell_(rawRow, displayRow, dateIndex, timezone)
    : '';
  const dayRawValue = hasDays && rawRow ? rawRow[daysIndex] : '';
  const dayDisplayValue = hasDays && displayRow ? displayRow[daysIndex] : '';
  let days = hasDays
    ? readReactivationInactiveDays_(dayRawValue, dayDisplayValue)
    : null;

  if (days === null && date) {
    days = daysSinceIsoDate_(date);
  }

  return {
    date: date || isoDateDaysAgo_(days),
    days: days
  };
}


function isoDateDaysAgo_(daysValue) {
  if (!isFinite(daysValue)) return '';
  const days = Math.max(0, Math.floor(Number(daysValue)));
  const now = new Date();
  const date = new Date(Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days
  ));
  return buildIsoDate_(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}


function readReactivationCounter_(rawRow, displayRow, index) {
  const value = readOptionalSheetNumber_(rawRow, displayRow, index);
  return value === null ? 0 : Math.max(0, Math.floor(value));
}


function normalizeReactivationNoteDate_(value, fallbackDate) {
  const text = cleanString_(value);
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return match[1] + '-' + match[2] + '-' + match[3];

  match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) return match[3] + '-' + match[2] + '-' + match[1];

  return fallbackDate || '';
}


function parseReactivationCommEntries_(value, fallbackDate, sheetName, isCurrent) {
  const text = String(value || '').trim();
  if (!text) return [];

  const entries = [];
  let current = null;

  text.split(/\r?\n/).forEach((line, index) => {
    const dated = line.match(
      /^\s*(?:\[(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})\]|(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4}))\s*:\s*(.*)$/
    );

    if (dated) {
      current = {
        date: normalizeReactivationNoteDate_(dated[1] || dated[2], fallbackDate),
        text: cleanString_(dated[3]),
        sheetName: sheetName,
        isCurrent: Boolean(isCurrent),
        order: index
      };
      if (current.text) entries.push(current);
      return;
    }

    if (current && /^\s+/.test(line) && cleanString_(line)) {
      current.text += '\n' + cleanString_(line);
      return;
    }

    const plain = cleanString_(line);
    if (!plain) return;
    current = {
      date: fallbackDate || '',
      text: plain,
      sheetName: sheetName,
      isCurrent: Boolean(isCurrent),
      order: index
    };
    entries.push(current);
  });

  return entries;
}


function compareReactivationNotesNewestFirst_(a, b) {
  const dateCompare = String(b && b.date || '').localeCompare(String(a && a.date || ''));
  if (dateCompare) return dateCompare;

  const sheetCompare = String(b && b.sheetName || '').localeCompare(String(a && a.sheetName || ''));
  if (sheetCompare) return sheetCompare;

  return Number(a && a.order || 0) - Number(b && b.order || 0);
}


function findLatestReactivationOffer_(notes) {
  const list = Array.isArray(notes) ? notes : [];
  const offer = list.find(note => {
    const text = cleanString_(note && note.text);
    return /(?:^|;)\s*BD\s*:/i.test(text) ||
      /(?:^|;)\s*FB\s*:/i.test(text) ||
      /(?:^|;)\s*(?:TO Deposit|1% to Deposit)\s*:/i.test(text) ||
      /(?:^|;)\s*Quest\s*:/i.test(text);
  });

  return cleanString_(offer && offer.text);
}


function daysSinceIsoDate_(isoDate) {
  const match = cleanString_(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 0;

  const start = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today - start) / 86400000));
}


function readReactivationNumber_(rawValue, displayValue) {
  if (typeof rawValue === 'number' && isFinite(rawValue)) return rawValue;

  let text = cleanString_(displayValue || rawValue)
    .replace(/\u00a0/g, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9,.-]/g, '');

  if (!text) return 0;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const decimals = text.length - lastComma - 1;
    text = decimals > 0 && decimals <= 2
      ? text.replace(',', '.')
      : text.replace(/,/g, '');
  }

  const value = Number(text);
  return isFinite(value) ? value : 0;
}


function readOptionalSheetNumber_(rawRow, displayRow, index) {
  if (!Number.isInteger(index) || index < 0) return null;

  const rawValue = rawRow ? rawRow[index] : '';
  const displayValue = displayRow ? displayRow[index] : '';
  if (cleanString_(displayValue || rawValue) === '') return null;

  return readReactivationNumber_(rawValue, displayValue);
}


function writeVerifiedReactivationText_(sheet, row, column, value, action, id, sheetName) {
  const target = cleanString_(value);
  const cell = sheet.getRange(row, column);
  cell.setNumberFormat('@');
  if (target) cell.setValue(target);
  else cell.clearContent();
  SpreadsheetApp.flush();
  invalidateClientsMemo_();

  const saved = cleanString_(cell.getDisplayValue());
  if (saved !== target) {
    throw new Error('Reactivation text verification failed after write.');
  }

  return {
    ok: true,
    action: action,
    clientId: id,
    sheetName: sheetName,
    row: row,
    value: saved
  };
}


/* =========================================================
   3. WEB APP GET
   ========================================================= */

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = String(params.action || 'ping').trim();

    if (action === 'ping') {
      return json_({
        ok: true,
        service: 'VIP CRM Being API',
        version: '3.4',
        status: 'online'
      });
    }

    authorize_(params.apiKey);

    switch (action) {
      case 'getClients':
        return json_({
          ok: true,
          clients: getClients_()
        });

      case 'updatePinned':
        return json_(
          updatePinned_(
            params.clientId,
            params.pinned
          )
        );

      case 'debugSchema':
        return json_({
          ok: true,
          schema: inspectSchema_(getBeingSheet_())
        });

      case 'debug365':
        return json_(debug365Statistics_());

      case 'clear365Cache':
        return json_(resetBeing365Cache());

      case 'getClientFields':
        return json_(getClientFields_(params.clientId));

      case 'getReactivation':
        return json_(getReactivationFeed_());

      default:
        return json_({
          ok: false,
          error: 'Unknown GET action: ' + action
        });
    }

  } catch (error) {
    return errorResponse_(error);
  }
}


/* =========================================================
   4. WEB APP POST
   ========================================================= */

function doPost(e) {
  try {
    const request = parsePostRequest_(e);
    authorize_(request.apiKey);

    const action = String(request.action || '').trim();

    // Every POST writes to the spreadsheet. Announcing it here is what keeps
    // the onChange cache trigger from mistaking our own write for an edit to
    // sheet 365, which used to cost a full re-scan on each save.
    markBeingSelfWrite_();

    switch (action) {
      case 'updateClient':
        return json_(
          updateClient_(
            request.clientId,
            request.changes || {}
          )
        );

      case 'updateActiveQuest':
        return json_(
          updateActiveQuest_(
            request.clientId,
            request.activeQuest
          )
        );

      case 'updateReactivation':
        return json_(
          updateReactivation_(request.mutation)
        );

      default:
        return json_({
          ok: false,
          error: 'Unknown POST action: ' + action
        });
    }

  } catch (error) {
    return errorResponse_(error);
  }
}


/* =========================================================
   5. READ ALL CLIENTS
   ========================================================= */

/*
  One execution never sees the sheet change under it unless this script is the
  one changing it, so the built feed is reused for the rest of the request.
  Every write clears it, which is what keeps the read-back verifications
  honest: they still see the sheet as it stands after the write.
*/
let memoizedClients_ = null;

function invalidateClientsMemo_() {
  memoizedClients_ = null;
}


function getClients_() {
  if (memoizedClients_) return memoizedClients_;

  const sheet = getBeingSheet_();
  const profiles365 = get365StatisticsProfiles_(sheet.getParent());

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);

  const range = sheet.getRange(
    1,
    1,
    lastRow,
    lastColumn
  );

  const values = range.getValues();
  const displayValues = range.getDisplayValues();
  const headers = displayValues[0];

  /*
   * IMPORTANT:
   * buildHeaderMap_ requires ONLY Client ID.
   * Every other field may be missing without killing the feed.
   */
  const map = buildHeaderMap_(
    headers,
    displayValues.slice(1)
  );

  if (map.clientId === -1) {
    throw new Error(
      'Missing required column: Client ID'
    );
  }

  const timezone = getSafeTimezone_();

  const clients = [];

  for (let i = 1; i < values.length; i++) {
    const clientId = readDisplayCell_(
      displayValues[i],
      map.clientId
    );

    if (!clientId) {
      continue;
    }

    clients.push({
      clientId: clientId,

      clientName: readDisplayCell_(
        displayValues[i],
        map.clientName
      ),

      notes: readDisplayCell_(
        displayValues[i],
        map.notes
      ),

      activeQuest: readDisplayCell_(
        displayValues[i],
        map.activeQuest
      ),

      bonusLog: readDisplayCell_(
        displayValues[i],
        map.bonusLog
      ),

      pinned: readBooleanCell_(
        values[i],
        displayValues[i],
        map.pinned
      ),

      followUpDate: readDateCell_(
        values[i],
        displayValues[i],
        map.followUpDate,
        timezone
      ),

      lastContactDate: readDateCell_(
        values[i],
        displayValues[i],
        map.lastContact,
        timezone
      ),

      reactivationProfile: {
        playing: readDisplayCell_(displayValues[i], map.playing),
        performance: {
          '30d': {
            to: readOptionalSheetNumber_(values[i], displayValues[i], map.to30d),
            ggr: readOptionalSheetNumber_(values[i], displayValues[i], map.ggr30d),
            ngr: readOptionalSheetNumber_(values[i], displayValues[i], map.ngr30d),
            bonusRate: readOptionalSheetNumber_(values[i], displayValues[i], map.br30d),
            sport: readOptionalSheetNumber_(values[i], displayValues[i], map.sport30d),
            casino: readOptionalSheetNumber_(values[i], displayValues[i], map.casino30d),
            slots: readOptionalSheetNumber_(values[i], displayValues[i], map.slots30d),
            live: readOptionalSheetNumber_(values[i], displayValues[i], map.live30d),
            instant: readOptionalSheetNumber_(values[i], displayValues[i], map.instant30d)
          },
          '12m': {
            to: readOptionalSheetNumber_(values[i], displayValues[i], map.to12m),
            ggr: readOptionalSheetNumber_(values[i], displayValues[i], map.ggr12m),
            ngr: readOptionalSheetNumber_(values[i], displayValues[i], map.ngr12m),
            bonusRate: readOptionalSheetNumber_(values[i], displayValues[i], map.br12m),
            sport: readOptionalSheetNumber_(values[i], displayValues[i], map.sport12m),
            casino: readOptionalSheetNumber_(values[i], displayValues[i], map.casino12m),
            slots: readOptionalSheetNumber_(values[i], displayValues[i], map.slots12m),
            live: readOptionalSheetNumber_(values[i], displayValues[i], map.live12m),
            instant: readOptionalSheetNumber_(values[i], displayValues[i], map.instant12m)
          }
        }
      }
    });
  }

  clients.forEach(client => {
    client.reactivationProfile = mergeReactivationProfiles_(
      client.reactivationProfile,
      profiles365[client.clientId] || {}
    );
  });


  memoizedClients_ = clients;
  return clients;
}


/* =========================================================
   6. DIRECT PIN UPDATE
   ========================================================= */

function updatePinned_(
  clientId,
  pinned
) {
  const id = cleanString_(
    clientId
  );

  if (!id) {
    throw new Error(
      'Client ID is required.'
    );
  }

  // Locating the row reads nothing that another save can invalidate, so it
  // happens before the lock rather than inside it.
  const sheet =
    getBeingSheet_();

  const lastColumn =
    Math.max(
      sheet.getLastColumn(),
      1
    );

  let headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0];

  const clientIdIndex =
    findHeaderIndex_(
      headers,
      CONFIG.HEADER_ALIASES.clientId
    );

  requireColumn_(
    clientIdIndex,
    'Client ID'
  );

  const row =
    resolveClientRow_(
      sheet,
      clientIdIndex + 1,
      id
    );

  if (!row) {
    throw new Error(
      'Client ID not found: ' + id
    );
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  try {

    /*
     * Unlike ordinary READ, the explicit pin action is allowed
     * to repair its own storage column. This guarantees that a
     * missing Pinned column cannot silently break persistence.
     */
    let pinnedIndex =
      findHeaderIndex_(
        headers,
        CONFIG.HEADER_ALIASES.pinned
      );

    if (pinnedIndex === -1) {
      pinnedIndex =
        ensurePinnedColumn_(sheet);

      headers =
        sheet
          .getRange(
            1,
            1,
            1,
            sheet.getLastColumn()
          )
          .getDisplayValues()[0];
    }

    const targetPinned =
      normalizeBoolean_(pinned);

    const cell =
      sheet.getRange(
        row,
        pinnedIndex + 1
      );

    cell.setValue(
      targetPinned
    );

    SpreadsheetApp.flush();
    invalidateClientsMemo_();

    /*
     * Read EXACTLY the same cell back after flush.
     * We do not infer success from the request payload.
     */
    const rawSavedValue =
      cell.getValue();

    const displaySavedValue =
      cell.getDisplayValue();

    const savedPinned =
      rawSavedValue === true ||
      (
        rawSavedValue !== false &&
        normalizeBoolean_(
          displaySavedValue
        )
      );

    if (
      Boolean(savedPinned) !==
      Boolean(targetPinned)
    ) {
      throw new Error(
        'Pinned verification failed after write.'
      );
    }

    /*
      The saved value is already read back from the cell above, so the whole
      client feed is not rebuilt here. Nothing downstream consumed it: the
      caller reads only ok and pinned.
    */
    return {
      ok: true,
      action: 'updatePinned',
      clientId: id,
      row: row,
      column:
        headers[pinnedIndex] ||
        CONFIG.CANONICAL_HEADERS.pinned,
      pinned: Boolean(savedPinned),
      displayValue:
        cleanString_(
          displaySavedValue
        )
    };


  } finally {
    lock.releaseLock();
  }
}


function ensurePinnedColumn_(
  sheet
) {
  const lastColumn =
    Math.max(
      sheet.getLastColumn(),
      1
    );

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0];

  const existing =
    findHeaderIndex_(
      headers,
      CONFIG.HEADER_ALIASES.pinned
    );

  if (existing !== -1) {
    return existing;
  }

  const newColumn =
    lastColumn + 1;

  sheet
    .getRange(
      1,
      newColumn
    )
    .setValue(
      CONFIG.CANONICAL_HEADERS.pinned
    );

  SpreadsheetApp.flush();
  invalidateClientsMemo_();

  return newColumn - 1;
}


/* =========================================================
   7. VERIFIED ACTIVE QUEST UPDATE — FIXED COLUMN D
   ========================================================= */

function updateActiveQuest_(
  clientId,
  activeQuest
) {
  const id = cleanString_(clientId);

  if (!id) {
    throw new Error('Client ID is required.');
  }

  const targetQuest =
    cleanString_(activeQuest) ||
    CONFIG.EMPTY_ACTIVE_QUEST;

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const sheet = getBeingSheet_();
    ensureActiveQuestColumn_(sheet);

    const lastColumn = Math.max(
      sheet.getLastColumn(),
      CONFIG.ACTIVE_QUEST_COLUMN
    );

    const headers = sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0];

    const clientIdIndex = findHeaderIndex_(
      headers,
      CONFIG.HEADER_ALIASES.clientId
    );

    requireColumn_(clientIdIndex, 'Client ID');

    const row = findClientRow_(
      sheet,
      clientIdIndex + 1,
      id
    );

    if (!row) {
      throw new Error('Client ID not found: ' + id);
    }

    const cell = sheet.getRange(
      row,
      CONFIG.ACTIVE_QUEST_COLUMN
    );

    cell.setNumberFormat('@');
    cell.setValue(targetQuest);
    SpreadsheetApp.flush();
    invalidateClientsMemo_();

    const savedQuest = cleanString_(
      cell.getDisplayValue()
    );

    if (savedQuest !== targetQuest) {
      throw new Error(
        'Active Quest verification failed after write.'
      );
    }

    return {
      ok: true,
      action: 'updateActiveQuest',
      clientId: id,
      row: row,
      // The saved cell is returned on its own on purpose. Rebuilding the whole
      // client here meant a full pass over sheet 365 on every quest save, and
      // it happened while this function still held the script lock.
      column: 'D',
      activeQuest: savedQuest
    };

  } finally {
    lock.releaseLock();
  }
}


/* =========================================================
   8. UPDATE CLIENT
   ========================================================= */

/* =========================================================
   BEING SHEET LOOKUP CACHE

   A save used to start by reading the whole Being_Archive sheet with
   getDisplayValues, only to work out which column holds Notes. On a sheet of
   any size that read is the slowest thing in the request, it happens while the
   script lock is held, and a slow save is exactly what surfaced in the browser
   as "rolled back".

   The layout of that sheet changes about never, so the resolved column map is
   cached against the header row itself: change a header and the key changes
   with it. The row of a client is cached the same way and confirmed with a
   single cell read before anything is written, so a stale row can never write
   to the wrong client.
   ========================================================= */

const BEING_LOOKUP_CACHE = Object.freeze({
  PREFIX: 'vipcrmBeingLookup',
  TTL_SECONDS: 21600
});


function beingCacheKey_(parts) {
  const text = BEING_LOOKUP_CACHE.PREFIX + '|' + parts.join('|');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text);
  return BEING_LOOKUP_CACHE.PREFIX + Utilities
    .base64EncodeWebSafe(digest)
    .replace(/=+$/, '');
}


function readBeingCache_(key) {
  try {
    const raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}


function writeBeingCache_(key, value) {
  try {
    CacheService.getScriptCache().put(
      key,
      JSON.stringify(value),
      BEING_LOOKUP_CACHE.TTL_SECONDS
    );
  } catch (error) {
    // A cache miss only costs a slower request, never a wrong one.
  }
}


/**
 * Column map for the Being sheet. Reads row 1, and the whole sheet only when
 * the map for that header row is not cached yet.
 */
function getBeingHeaderMap_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const key = beingCacheKey_(['headers', headers.join('\u0001')]);

  const cached = readBeingCache_(key);
  if (cached && typeof cached === 'object') {
    return { map: cached, headers: headers, lastColumn: lastColumn };
  }

  const lastRow = Math.max(sheet.getLastRow(), 1);
  const dataRows = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues()
    : [];

  const map = buildHeaderMap_(headers, dataRows);
  writeBeingCache_(key, map);
  return { map: map, headers: headers, lastColumn: lastColumn };
}


/**
 * Row of one client. The cached row is trusted only after its own ID cell
 * confirms it; anything else falls back to the full column scan.
 */
function resolveClientRow_(sheet, clientIdColumn, clientId) {
  const id = cleanString_(clientId);
  const key = beingCacheKey_(['row', sheet.getSheetId(), clientIdColumn, id]);
  const cachedRow = readBeingCache_(key);

  if (typeof cachedRow === 'number' && cachedRow >= 2 && cachedRow <= sheet.getLastRow()) {
    const candidate = cleanString_(
      sheet.getRange(cachedRow, clientIdColumn).getDisplayValue()
    );
    if (candidate === id) return cachedRow;
  }

  const row = findClientRow_(sheet, clientIdColumn, id);
  if (row) writeBeingCache_(key, row);
  return row;
}


/**
 * Reads back what was just written and reports the cells that did not take.
 * Apps Script writes are not guaranteed visible until flush, and a silent
 * partial write is the one failure the caller cannot detect on its own.
 */
function verifyWrittenCells_(sheet, row, expected) {
  const mismatched = [];
  if (!expected.length) return mismatched;

  // One read of the row up to the last written column, instead of one read
  // per cell while the script lock is held.
  const width = Math.max.apply(null, expected.map(item => item.column));
  const values = sheet.getRange(row, 1, 1, width).getDisplayValues()[0];

  expected.forEach(item => {
    const actual = cleanString_(values[item.column - 1]);
    const wanted = cleanString_(item.display);
    if (actual !== wanted) {
      mismatched.push({ column: item.column, field: item.field, actual: actual, expected: wanted });
    }
  });

  return mismatched;
}


/**
 * Read-only view of the fields a save can touch. The browser calls this to
 * find out whether a request whose reply never arrived actually landed, so a
 * saved note is never rolled back on screen.
 */
function getClientFields_(clientId) {
  const id = cleanString_(clientId);
  if (!id) throw new Error('Client ID is required.');

  const sheet = getBeingSheet_();
  const lookup = getBeingHeaderMap_(sheet);
  const map = lookup.map;
  requireColumn_(map.clientId, 'Client ID');

  const row = resolveClientRow_(sheet, map.clientId + 1, id);
  if (!row) throw new Error('Client ID not found: ' + id);

  const values = sheet
    .getRange(row, 1, 1, lookup.lastColumn)
    .getDisplayValues()[0];

  const read = function(index) {
    return index >= 0 && index < values.length ? cleanString_(values[index]) : '';
  };

  return {
    ok: true,
    clientId: id,
    row: row,
    fields: {
      notes: read(map.notes),
      followUpDate: read(map.followUpDate),
      lastContactDate: read(map.lastContact),
      activeQuest: read(map.activeQuest),
      bonusLog: read(map.bonusLog),
      pinned: normalizeBoolean_(read(map.pinned))
    }
  };
}


function updateClient_(clientId, changes) {
  const id = cleanString_(clientId);

  if (!id) {
    throw new Error('Client ID is required.');
  }

  if (!changes || typeof changes !== 'object') {
    throw new Error('Changes object is required.');
  }

  /*
    Everything that only reads happens before the lock is taken. The lock now
    covers the writes, the flush and the read-back, which is the only part that
    two simultaneous saves may not interleave. Holding it across the sheet scan
    was what made a second save wait out the first and time out.
  */
  const sheet = getBeingSheet_();
  const lookup = getBeingHeaderMap_(sheet);
  const map = lookup.map;

  requireColumn_(
    map.clientId,
    'Client ID'
  );

  const row = resolveClientRow_(
    sheet,
    map.clientId + 1,
    id
  );

  if (!row) {
    throw new Error(
      'Client ID not found: ' + id
    );
  }

  // Cells to read back after the flush, so a partial write cannot pass as done.
  const written = [];

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {

    if (
      Object.prototype.hasOwnProperty.call(
        changes,
        'notes'
      )
    ) {
      requireColumn_(
        map.notes,
        'Notes'
      );

      writeText_(
        sheet,
        row,
        map.notes + 1,
        changes.notes
      );

      written.push({
        field: 'notes',
        column: map.notes + 1,
        display: changes.notes
      });
    }


    /*
      Held so the pinned value can be confirmed from its own cell after the
      flush. Rebuilding the whole client feed just to read one boolean was the
      most expensive line in this function, and the caller never looked at it.
    */
    let pinnedCell = null;

    if (
      Object.prototype.hasOwnProperty.call(
        changes,
        'pinned'
      )
    ) {
      const pinnedIndex =
        map.pinned !== -1
          ? map.pinned
          : ensurePinnedColumn_(
              sheet
            );

      writeBoolean_(
        sheet,
        row,
        pinnedIndex + 1,
        changes.pinned
      );

      pinnedCell = sheet.getRange(row, pinnedIndex + 1);
    }


    if (
      Object.prototype.hasOwnProperty.call(
        changes,
        'followUpDate'
      )
    ) {
      requireColumn_(
        map.followUpDate,
        'Follow Up Date'
      );

      writeDate_(
        sheet,
        row,
        map.followUpDate + 1,
        changes.followUpDate
      );
    }


    if (
      Object.prototype.hasOwnProperty.call(
        changes,
        'lastContactDate'
      )
    ) {
      requireColumn_(
        map.lastContact,
        'Last Contact Date'
      );

      writeDate_(
        sheet,
        row,
        map.lastContact + 1,
        changes.lastContactDate
      );
    }


    if (
      Object.prototype.hasOwnProperty.call(
        changes,
        'clientName'
      )
    ) {
      requireColumn_(
        map.clientName,
        'Client Name'
      );

      writeText_(
        sheet,
        row,
        map.clientName + 1,
        changes.clientName
      );

      written.push({
        field: 'clientName',
        column: map.clientName + 1,
        display: changes.clientName
      });
    }


    if (
      Object.prototype.hasOwnProperty.call(
        changes,
        'activeQuest'
      )
    ) {
      requireColumn_(
        map.activeQuest,
        'Active Quest'
      );

      writeText_(
        sheet,
        row,
        map.activeQuest + 1,
        changes.activeQuest
      );

      written.push({
        field: 'activeQuest',
        column: map.activeQuest + 1,
        display: changes.activeQuest
      });
    }


    if (
      Object.prototype.hasOwnProperty.call(
        changes,
        'bonusLog'
      )
    ) {
      requireColumn_(
        map.bonusLog,
        'Bonus Log'
      );

      writeText_(
        sheet,
        row,
        map.bonusLog + 1,
        changes.bonusLog
      );

      written.push({
        field: 'bonusLog',
        column: map.bonusLog + 1,
        display: changes.bonusLog
      });
    }


    SpreadsheetApp.flush();
    invalidateClientsMemo_();

    /*
      Read the text cells back. A write that did not take is repeated once
      inside the same lock: the alternative is telling the browser a note was
      saved when the cell is still empty.
    */
    let mismatched = verifyWrittenCells_(sheet, row, written);

    if (mismatched.length) {
      mismatched.forEach(item => {
        const target = written.filter(entry => entry.column === item.column)[0];
        if (target) writeText_(sheet, row, target.column, target.display);
      });
      SpreadsheetApp.flush();
      mismatched = verifyWrittenCells_(sheet, row, written);
    }

    if (mismatched.length) {
      throw new Error(
        'Sheet did not accept the write for: ' +
        mismatched.map(item => item.field).join(', ')
      );
    }

    let confirmedPinned;
    if (pinnedCell) {
      const rawPinned = pinnedCell.getValue();
      confirmedPinned = rawPinned === true ||
        (rawPinned !== false &&
          normalizeBoolean_(cleanString_(pinnedCell.getDisplayValue())));
    }

    return {
      ok: true,
      clientId: id,
      row: row,
      verified: written.map(item => item.field),
      confirmedChanges: {
        pinned: confirmedPinned
      }
    };

  } finally {
    lock.releaseLock();
  }
}


/* =========================================================
   9. FIND CLIENT ROW
   ========================================================= */

function findClientRow_(
  sheet,
  clientIdColumn,
  clientId
) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const values = sheet
    .getRange(
      2,
      clientIdColumn,
      lastRow - 1,
      1
    )
    .getDisplayValues();

  const target = cleanString_(clientId);

  for (let i = 0; i < values.length; i++) {
    if (
      cleanString_(values[i][0]) === target
    ) {
      return i + 2;
    }
  }

  return null;
}


/* =========================================================
   10. WRITE HELPERS
   ========================================================= */

function writeText_(
  sheet,
  row,
  column,
  value
) {
  const cell = sheet.getRange(
    row,
    column
  );

  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    cell.clearContent();
    return;
  }

  cell.setNumberFormat('@');
  cell.setValue(String(value));
}


function normalizeBoolean_(
  value
) {
  if (value === true) {
    return true;
  }

  if (
    value === false ||
    value === null ||
    value === undefined
  ) {
    return false;
  }

  const text = cleanString_(value)
    .toLowerCase();

  return [
    'true',
    '1',
    'yes',
    'y',
    'on',
    'pinned',
    'tak'
  ].includes(text);
}


function writeBoolean_(
  sheet,
  row,
  column,
  value
) {
  const cell = sheet.getRange(
    row,
    column
  );

  cell.setValue(
    normalizeBoolean_(value)
  );
}


function writeDate_(
  sheet,
  row,
  column,
  value
) {
  const cell = sheet.getRange(
    row,
    column
  );

  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    cell.clearContent();
    return;
  }

  const normalized = normalizeDateText_(
    value
  );

  if (!normalized) {
    throw new Error(
      'Invalid date. Expected YYYY-MM-DD, received: ' +
      value
    );
  }

  const parts = normalized
    .split('-')
    .map(Number);

  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  const date = new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0
  );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(
      'Invalid calendar date: ' + value
    );
  }

  cell.setValue(date);
  cell.setNumberFormat('dd.MM.yyyy');
}


/* =========================================================
   11. HEADER SETUP
   ========================================================= */

function ensureActiveQuestColumn_(sheet) {
  if (!sheet) {
    throw new Error('Being sheet not found.');
  }

  const column = CONFIG.ACTIVE_QUEST_COLUMN;
  const cell = sheet.getRange(1, column);
  const currentHeader = cleanString_(cell.getDisplayValue());
  const isActiveQuestHeader = CONFIG.HEADER_ALIASES.activeQuest.some(
    alias => normalizeHeader_(alias) === normalizeHeader_(currentHeader)
  );

  if (currentHeader && !isActiveQuestHeader) {
    throw new Error(
      'Column D must be Active Quest. Current D1 header: ' +
      currentHeader
    );
  }

  if (!isActiveQuestHeader) {
    cell.setValue(CONFIG.CANONICAL_HEADERS.activeQuest);
    SpreadsheetApp.flush();
    invalidateClientsMemo_();
  }

  return column - 1;
}


function ensureHeaders_(sheet) {
  if (!sheet) {
    throw new Error(
      'Being sheet not found.'
    );
  }

  let lastColumn = Math.max(
    sheet.getLastColumn(),
    1
  );

  let headers = sheet
    .getRange(
      1,
      1,
      1,
      lastColumn
    )
    .getDisplayValues()[0]
    .map(cleanString_);

  Object.keys(
    CONFIG.HEADER_ALIASES
  ).forEach(key => {
    const aliases =
      CONFIG.HEADER_ALIASES[key];

    const existingIndex =
      findHeaderIndex_(
        headers,
        aliases
      );

    if (existingIndex !== -1) {
      return;
    }

    lastColumn++;

    const canonical =
      CONFIG.CANONICAL_HEADERS[key];

    sheet
      .getRange(
        1,
        lastColumn
      )
      .setValue(canonical);

    headers.push(canonical);
  });
}


/* =========================================================
   12. HEADER MAP
   ========================================================= */

function buildHeaderMap_(
  headers,
  dataRows
) {
  const normalizedHeaders =
    headers.map(normalizeHeader_);

  const map = {
    clientId: findHeaderIndex_(
      headers,
      CONFIG.HEADER_ALIASES.clientId,
      normalizedHeaders
    ),

    clientName: findHeaderIndex_(
      headers,
      CONFIG.HEADER_ALIASES.clientName,
      normalizedHeaders
    ),

    notes: findHeaderIndex_(
      headers,
      CONFIG.HEADER_ALIASES.notes,
      normalizedHeaders
    ),

    activeQuest: getActiveQuestColumnIndex_(headers, normalizedHeaders),

    bonusLog: findHeaderIndex_(
      headers,
      CONFIG.HEADER_ALIASES.bonusLog,
      normalizedHeaders
    ),

    pinned: findHeaderIndex_(
      headers,
      CONFIG.HEADER_ALIASES.pinned,
      normalizedHeaders
    ),

    followUpDate:
      findBestPopulatedHeaderIndex_(
        headers,
        CONFIG.HEADER_ALIASES.followUpDate,
        dataRows,
        normalizedHeaders
      ),

    lastContact:
      findBestPopulatedHeaderIndex_(
        headers,
        CONFIG.HEADER_ALIASES.lastContact,
        dataRows,
        normalizedHeaders
      )
  };

  Object.keys(CONFIG.OPTIONAL_REACTIVATION_ALIASES).forEach(key => {
    map[key] = findHeaderIndex_(
      headers,
      CONFIG.OPTIONAL_REACTIVATION_ALIASES[key],
      normalizedHeaders
    );
  });

  return map;
}


function getActiveQuestColumnIndex_(headers, normalizedHeaders) {
  const fixedIndex = CONFIG.ACTIVE_QUEST_COLUMN - 1;
  const fixedHeader = Array.isArray(headers)
    ? headers[fixedIndex]
    : '';

  const fixedMatches = CONFIG.HEADER_ALIASES.activeQuest.some(
    alias => normalizeHeader_(alias) === normalizeHeader_(fixedHeader)
  );

  if (fixedMatches) {
    return fixedIndex;
  }

  return findHeaderIndex_(
    headers,
    CONFIG.HEADER_ALIASES.activeQuest,
    normalizedHeaders
  );
}


function findHeaderIndex_(
  headers,
  aliases,
  normalizedHeaders
) {
  // Callers that resolve many aliases against one header row pass the
  // normalised row in, so it is computed once rather than per alias key.
  if (!normalizedHeaders) {
    normalizedHeaders =
      headers.map(normalizeHeader_);
  }

  for (
    let i = 0;
    i < aliases.length;
    i++
  ) {
    const wanted =
      normalizeHeader_(aliases[i]);

    const index =
      normalizedHeaders.indexOf(wanted);

    if (index !== -1) {
      return index;
    }
  }

  return -1;
}


/*
 * If multiple aliases exist at the same time,
 * prefer the first alias that actually contains data.
 *
 * Example:
 *   Last Contact Date = empty
 *   Data              = populated
 *
 * => Data is used instead of silently showing blanks.
 *
 * If all matching columns are empty,
 * normal alias priority is used.
 */
function findBestPopulatedHeaderIndex_(
  headers,
  aliases,
  dataRows,
  normalizedHeaders
) {
  if (!normalizedHeaders) {
    normalizedHeaders =
      headers.map(normalizeHeader_);
  }

  const candidates = [];

  aliases.forEach(alias => {
    const wanted =
      normalizeHeader_(alias);

    normalizedHeaders.forEach(
      (header, index) => {
        if (
          header === wanted &&
          !candidates.includes(index)
        ) {
          candidates.push(index);
        }
      }
    );
  });

  if (!candidates.length) {
    return -1;
  }

  if (
    Array.isArray(dataRows) &&
    dataRows.length
  ) {
    for (
      let i = 0;
      i < candidates.length;
      i++
    ) {
      const index = candidates[i];

      const hasData =
        dataRows.some(row =>
          cleanString_(
            row && row[index]
          ) !== ''
        );

      if (hasData) {
        return index;
      }
    }
  }

  return candidates[0];
}


function requireColumn_(
  index,
  label
) {
  if (
    !Number.isInteger(index) ||
    index < 0
  ) {
    throw new Error(
      'Column not found: ' + label
    );
  }
}


/* =========================================================
   13. READ HELPERS
   ========================================================= */

function readDisplayCell_(
  row,
  index
) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    !row
  ) {
    return '';
  }

  return cleanString_(row[index]);
}


function readBooleanCell_(
  rawRow,
  displayRow,
  index
) {
  if (
    !Number.isInteger(index) ||
    index < 0
  ) {
    return false;
  }

  const rawValue =
    rawRow
      ? rawRow[index]
      : false;

  if (
    rawValue === true ||
    rawValue === false
  ) {
    return rawValue;
  }

  const displayValue =
    displayRow
      ? displayRow[index]
      : '';

  return normalizeBoolean_(
    displayValue
  );
}


function readDateCell_(
  rawRow,
  displayRow,
  index,
  timezone
) {
  if (
    !Number.isInteger(index) ||
    index < 0
  ) {
    return '';
  }

  try {
    return formatDateForApi_(
      rawRow ? rawRow[index] : '',
      displayRow ? displayRow[index] : '',
      timezone
    );
  } catch (error) {
    /*
     * A malformed date must affect only that one field,
     * never the complete client list.
     */
    console.warn(
      'Being date parse failed:',
      error
    );

    return '';
  }
}


/* =========================================================
   14. SHEET FORMAT
   ========================================================= */

function formatSheet_(sheet) {
  const lastRow = Math.max(
    sheet.getLastRow(),
    1
  );

  const lastColumn = Math.max(
    sheet.getLastColumn(),
    1
  );

  const displayValues = sheet
    .getRange(
      1,
      1,
      lastRow,
      lastColumn
    )
    .getDisplayValues();

  const headers =
    displayValues[0];

  const map = buildHeaderMap_(
    headers,
    displayValues.slice(1)
  );

  sheet.setFrozenRows(1);

  const maxRow = Math.max(
    sheet.getMaxRows(),
    2
  );

  if (map.followUpDate !== -1) {
    sheet
      .getRange(
        2,
        map.followUpDate + 1,
        maxRow - 1,
        1
      )
      .setNumberFormat(
        'dd.MM.yyyy'
      );
  }

  if (map.lastContact !== -1) {
    sheet
      .getRange(
        2,
        map.lastContact + 1,
        maxRow - 1,
        1
      )
      .setNumberFormat(
        'dd.MM.yyyy'
      );
  }
}


/* =========================================================
   15. SCHEMA DEBUG
   ========================================================= */

function inspectSchema_(sheet) {
  const lastRow = Math.max(
    sheet.getLastRow(),
    1
  );

  const lastColumn = Math.max(
    sheet.getLastColumn(),
    1
  );

  const displayValues = sheet
    .getRange(
      1,
      1,
      lastRow,
      lastColumn
    )
    .getDisplayValues();

  const headers =
    displayValues[0];

  const map = buildHeaderMap_(
    headers,
    displayValues.slice(1)
  );

  const label = index => {
    if (
      !Number.isInteger(index) ||
      index < 0
    ) {
      return null;
    }

    return headers[index] || null;
  };

  return {
    headers: headers,

    mapping: {
      clientId:
        label(map.clientId),

      clientName:
        label(map.clientName),

      notes:
        label(map.notes),

      activeQuest:
        label(map.activeQuest),

      bonusLog:
        label(map.bonusLog),

      pinned:
        label(map.pinned),

      followUpDate:
        label(map.followUpDate),

      lastContact:
        label(map.lastContact)
    }
  };
}


function getSafeTimezone_() {
  if (!memoizedTimezone_) {
    memoizedTimezone_ = resolveSafeTimezone_();
  }
  return memoizedTimezone_;
}


function resolveSafeTimezone_() {
  /*
   * Spreadsheet timezone should normally be a string,
   * but date loading must never fail if Google returns
   * an unexpected value/settings state.
   */
  try {
    const ss = getSpreadsheet_();

    const spreadsheetTimezone =
      cleanString_(
        ss.getSpreadsheetTimeZone()
      );

    if (spreadsheetTimezone) {
      return String(
        spreadsheetTimezone
      );
    }
  } catch (error) {
    console.warn(
      'Spreadsheet timezone unavailable:',
      error
    );
  }


  try {
    const scriptTimezone =
      cleanString_(
        Session.getScriptTimeZone()
      );

    if (scriptTimezone) {
      return String(
        scriptTimezone
      );
    }
  } catch (error) {
    console.warn(
      'Script timezone unavailable:',
      error
    );
  }


  return 'Etc/GMT';
}


/* =========================================================
   16. GET SHEET
   ========================================================= */

/*
  One execution opens the workbook once. Spreadsheet and Sheet are live
  handles, so a value read through them after flush() is current; the
  timezone and the ID are plain strings. Like every global they last for one
  execution only.
*/
let memoizedSpreadsheetId_ = '';
let memoizedSpreadsheet_ = null;
let memoizedSpreadsheetOpenedId_ = '';
let memoizedBeingSheet_ = null;
let memoizedTimezone_ = '';


function resetSpreadsheetMemo_() {
  memoizedSpreadsheetId_ = '';
  memoizedSpreadsheet_ = null;
  memoizedSpreadsheetOpenedId_ = '';
  memoizedBeingSheet_ = null;
  memoizedTimezone_ = '';
}


function openSpreadsheet_(spreadsheetId) {
  if (memoizedSpreadsheet_ && memoizedSpreadsheetOpenedId_ === spreadsheetId) {
    return memoizedSpreadsheet_;
  }

  const ss = SpreadsheetApp.openById(spreadsheetId);
  memoizedSpreadsheet_ = ss;
  memoizedSpreadsheetOpenedId_ = spreadsheetId;
  return ss;
}


function getSpreadsheet_() {
  return openSpreadsheet_(getSpreadsheetId_());
}


function getBeingSheet_() {
  if (memoizedBeingSheet_) {
    return memoizedBeingSheet_;
  }

  const props =
    PropertiesService
      .getScriptProperties();

  const spreadsheetId =
    props.getProperty(
      'BEING_SPREADSHEET_ID'
    );

  const sheetName =
    props.getProperty(
      'BEING_SHEET_NAME'
    );

  if (!spreadsheetId) {
    throw new Error(
      'API is not configured. Run setupBeingApi() first.'
    );
  }

  const ss = openSpreadsheet_(spreadsheetId);

  const sheet =
    ss.getSheetByName(
      sheetName ||
      CONFIG.SHEET_NAME
    );

  if (!sheet) {
    throw new Error(
      'Sheet not found: ' +
      (
        sheetName ||
        CONFIG.SHEET_NAME
      )
    );
  }

  memoizedBeingSheet_ = sheet;
  return sheet;
}


function getSpreadsheetId_() {
  if (memoizedSpreadsheetId_) {
    return memoizedSpreadsheetId_;
  }

  const id =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        'BEING_SPREADSHEET_ID'
      );

  if (!id) {
    throw new Error(
      'Spreadsheet ID is not configured.'
    );
  }

  memoizedSpreadsheetId_ = id;
  return id;
}


/* =========================================================
   17. API AUTHORIZATION
   ========================================================= */

function authorize_(
  receivedKey
) {
  const expectedKey =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        'BEING_API_KEY'
      );

  if (!expectedKey) {
    throw new Error(
      'API key has not been created. Run setupBeingApi().'
    );
  }

  if (
    !receivedKey ||
    String(receivedKey) !==
      expectedKey
  ) {
    throw new Error(
      'Unauthorized.'
    );
  }
}


/* =========================================================
   18. PARSE POST
   ========================================================= */

function parsePostRequest_(e) {
  if (!e) {
    return {};
  }

  if (
    e.parameter &&
    e.parameter.payload
  ) {
    return JSON.parse(
      e.parameter.payload
    );
  }

  if (
    e.postData &&
    e.postData.contents
  ) {
    return JSON.parse(
      e.postData.contents
    );
  }

  return e.parameter || {};
}


/* =========================================================
   19. DATE NORMALIZATION
   API output is ALWAYS YYYY-MM-DD.
   ========================================================= */

function formatDateForApi_(
  rawValue,
  displayValue,
  timezone
) {
  /*
   * IMPORTANT:
   * Google Sheet display text is preferred first.
   *
   * Example:
   *   14.08.2026 -> 2026-08-14
   *
   * This avoids making a normal date-only field depend
   * on Spreadsheet / Script timezone settings.
   */
  const fromDisplay =
    normalizeDateText_(
      displayValue
    );

  if (fromDisplay) {
    return fromDisplay;
  }


  /*
   * Text/raw fallback.
   */
  const fromRaw =
    normalizeDateText_(
      rawValue
    );

  if (fromRaw) {
    return fromRaw;
  }


  /*
   * Real Google Sheet date object fallback.
   *
   * Timezone is guaranteed to be a STRING.
   * Even if a Google/Sheet timezone setting is unavailable,
   * getSafeTimezone_() returns Etc/GMT.
   *
   * One bad timezone/date can no longer stop getClients().
   */
  if (
    rawValue instanceof Date &&
    !isNaN(rawValue.getTime())
  ) {
    const safeTimezone =
      cleanString_(timezone) ||
      'Etc/GMT';

    try {
      return Utilities.formatDate(
        rawValue,
        String(safeTimezone),
        'yyyy-MM-dd'
      );
    } catch (error) {
      /*
       * Last-resort fallback.
       * Date-only cells are created at noon by our writer,
       * so this remains stable for values written by the CRM.
       */
      return buildIsoDate_(
        rawValue.getFullYear(),
        rawValue.getMonth() + 1,
        rawValue.getDate()
      );
    }
  }

  return '';
}

function normalizeDateText_(
  value
) {
  const text =
    cleanString_(value);

  if (!text) {
    return '';
  }


  // YYYY-MM-DD / ISO datetime.
  let match = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/
  );

  if (match) {
    return buildIsoDate_(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );
  }


  // DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY.
  match = text.match(
    /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/
  );

  if (match) {
    const first =
      Number(match[1]);

    const second =
      Number(match[2]);

    const year =
      Number(match[3]);

    /*
     * If second > 12 and first <= 12,
     * treat it as MM/DD/YYYY.
     * Otherwise default to DD/MM/YYYY.
     */
    if (
      first <= 12 &&
      second > 12
    ) {
      return buildIsoDate_(
        year,
        first,
        second
      );
    }

    return buildIsoDate_(
      year,
      second,
      first
    );
  }


  // YYYY.MM.DD / YYYY/MM/DD.
  match = text.match(
    /^(\d{4})[.\/](\d{1,2})[.\/](\d{1,2})$/
  );

  if (match) {
    return buildIsoDate_(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );
  }

  return '';
}


function buildIsoDate_(
  year,
  month,
  day
) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return '';
  }

  const date = new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0
  );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return '';
  }

  return (
    String(year)
      .padStart(4, '0') +
    '-' +
    String(month)
      .padStart(2, '0') +
    '-' +
    String(day)
      .padStart(2, '0')
  );
}


/* =========================================================
   20. HELPERS
   ========================================================= */

function cleanString_(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}


/**
 * First four characters of a secret, for logs that outlive the run.
 */
function maskSecret_(value) {
  const text = cleanString_(value);
  if (!text) return '';
  return text.slice(0, 4) + '…';
}


function normalizeHeader_(
  value
) {
  return cleanString_(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


/* =========================================================
   21. JSON
   ========================================================= */

function json_(data) {
  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


function errorResponse_(error) {
  console.error(error);

  return json_({
    ok: false,
    error:
      error &&
      error.message
        ? error.message
        : String(error)
  });
}
