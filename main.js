(() => {
  "use strict";

  const APP_VERSION = "1.5.6.2";
  const CRM_CONTROL_URL = "/crm-control";

  /*
    ==========================================================
    BEING GOOGLE SHEET CONNECTION
    ==========================================================

    The browser no longer calls Google Apps Script directly.
    All requests go to the local same-origin bridge started by START_CRM.bat.

    Put WEB APP URL + API KEY in being_config.json, not in main.js.
  */
  const BEING_GOOGLE_SHEET = Object.freeze({
    LOCAL_API_URL: "/being-api"
  });

  /*
    Waits between save attempts. A busy script lock, a cold Apps Script start
    and a slow spreadsheet all clear within a few seconds, so the ladder is
    short but real; after it, the save is confirmed against the sheet instead
    of being declared lost.
  */
  const BEING_SAVE_RETRY_DELAYS = Object.freeze([800, 2200, 5000]);


  /*
    BONUS HISTORY SOURCE CONTRACT
    - Bonus History does not consume Current Quest or Quest History.
    - Quest completion must never append a bonus-history row.
    - Future Bonus History data comes only from its dedicated Google Sheet source.
  */

  /*
    BEING DATA CONTRACT
    - Being is the daily contact/follow-up workspace.
    - Source fields per client: lastContactDate, followUpDate, note, pinned.
    - Current Quest name/progress are read from client.quest and are not duplicated.
    - Notes, dates and pinned state are synchronized with the Being Google Sheet source.
    - No browser persistence is used. The future external source remains the source of truth.
  */

  const PAGES = Object.freeze({
    YESTERDAY: "yesterday",
    DASHBOARD: "dashboard",
    CLIENTS: "clients",
    REACTIVATION: "reactivation",
    BEING: "being"
  });
  const VALID_PAGES = new Set(Object.values(PAGES));

  /*
    Quest tracking contract.
    When live Google Sheet data is connected, each mechanic will be routed
    to its own metric source instead of trying to parse the free-text condition.

    Turnover Insurance intentionally has its own source hook and is NOT
    treated as ordinary Turnover.
  */
  const QUEST_MECHANICS = Object.freeze({
    turnover: Object.freeze({
      label: "Turnover",
      trackingKey: "turnover"
    }),

    turnover_insurance: Object.freeze({
      label: "Turnover Insurance",
      trackingKey: "turnoverInsurance"
    }),

    net_loss: Object.freeze({
      label: "Net Loss",
      trackingKey: "netLoss"
    })
  });

  const DEFAULT_QUEST_MECHANIC = "turnover";

  /*
    Quest section contract.
    Some quests count only one vertical, so tracking is scoped to it.

    all    -> sheet 365 "Turnover, EUR"
    casino -> sheet 365 "Casino turnover EUR"
    sport  -> sheet 365 "Sport turnover eur"

    In the supplied 365 workbook Casino turnover + Sport turnover reconciles
    with the Turnover total to the last digit, so the combined section reads
    the authoritative total column instead of adding the two sections up.

    Turnover Insurance always validates against TOTAL GGR, whatever the
    section is: the insurance covers the client, not one vertical.

    Net Loss has no per-section source at all, so it is always combined.
  */
  const QUEST_SECTIONS = Object.freeze({
    all: Object.freeze({
      label: "Casino + Sport",
      suffix: "",
      turnoverField: "to"
    }),

    casino: Object.freeze({
      label: "Casino",
      suffix: " Casino",
      turnoverField: "casino"
    }),

    sport: Object.freeze({
      label: "Sport",
      suffix: " Sport",
      turnoverField: "sport"
    })
  });

  const DEFAULT_QUEST_SECTION = "all";

  /*
    Sheet 365 is denominated in EUR from end to end. A quest may still be
    agreed with the client in another currency, so the goal is entered and the
    progress is shown in the chosen one while every sum keeps coming out of the
    EUR source. Percent is a ratio, so it never depends on the currency.

    The rates are fixed on purpose. A quest agreed at one rate must not change
    its meaning overnight because the market moved. To refresh them edit perEur
    below and nothing else: no other place in the app reads a rate.

    perEur is how many units of the currency one EUR buys.
    Source: European Central Bank reference rates, 27.08.2026.
    USDC and USDT are pegged to USD one to one by house rule.
  */
  const QUEST_CURRENCIES = Object.freeze({
    EUR: Object.freeze({ label: "EUR", prefix: "€", perEur: 1 }),
    USD: Object.freeze({ label: "USD", prefix: "$", perEur: 1.1645 }),
    USDC: Object.freeze({ label: "USDC", prefix: "USDC ", perEur: 1.1645 }),
    USDT: Object.freeze({ label: "USDT", prefix: "USDT ", perEur: 1.1645 }),
    CAD: Object.freeze({ label: "CAD", prefix: "CA$", perEur: 1.6151 })
  });

  const DEFAULT_QUEST_CURRENCY = "EUR";

  /*
    An End Date left blank means "not filled in yet" and stops the tracking.
    A quest that runs until further notice says so explicitly instead, so the
    two cases stay distinguishable in the sheet and in the editor.
  */
  const QUEST_OPEN_END_TEXT = "no limit";

  /*
    Manual bonuses are a separate data domain for a SECOND Google Sheet that
    is not bound yet: Bonus History shows the profile totals over an empty list.
  */

  const YESTERDAY_TEST_DATA = {
    totals: { turnover: 1, ggr: 1, ngr: 1, bonuses: 1, depositsCount: 1, withdrawalsCount: 1 },
    players: Array.from({ length: 20 }, (_, index) => ({
      name: index === 0 ? "Client 01" : "Name",
      clientId: index === 0 ? "777792040" : "1",
      toDay: 1, toSport: 1, toCasino: 1, toInstant: 1, toLive: 1, toSlots: 1,
      bonusDay: 1,
      ggrDay: 1, ggrSport: 1, ggrCasino: 1, ggrInstant: 1, ggrLive: 1, ggrSlots: 1,
      ngrDay: 1, bonusRate30d: 1, bonusRate12m: 1
    }))
  };

  const createTestTopList = () => Array.from({ length: 5 }, (_, index) => ({
    name: index === 0 ? "Client 01" : "Name",
    clientId: index === 0 ? "777792040" : "1",
    value: 1
  }));
  const DASHBOARD_TEST_DATA = {
    metrics: {
      activeClients: 1,
      turnoverPreviousDay: 1,
      turnover30d: 1,
      averageDailyTurnover: 1,
      ggr30d: 1,
      ngr30d: 1,
      bonusRate30d: 1,
      bonusRate12m: 1
    },
    lists: {
      topTurnover7d: createTestTopList(),
      topPositiveNgr7d: createTestTopList(),
      topNegativeNgr7d: createTestTopList(),
      topTo30d: createTestTopList(),
      topPositiveNgr30d: createTestTopList(),
      topNegativeNgr30d: createTestTopList(),
      topTurnover12m: createTestTopList(),
      topPositiveNgr12m: createTestTopList(),
      topNegativeNgr12m: createTestTopList()
    }
  };


  /*
    REACTIVATION DATA CONTRACT
    --------------------------------------------
    Since-sheet fields read from getReactivation rows:
      clientId, name, daysInactive, reactivationStartedAt, lastActivityDate,
      lastContactDate, reactivationNgr, depositAmount, reactivationNotes,
      currentCommText, offerText, calls, emails, contactsTotal,
      currentSheetName, playing, performance, quest.name.

    contactLog is session state only: the sheet keeps counters, not entries,
    so Undo works until the page is reloaded.

    Mutations sent through the change handler (updateReactivation):
      client:add
      contact:add
      contact:undo
      plan:update
      comm:update

    No browser persistence.
  */
  const REACTIVATION_STATUS = Object.freeze({
    ACTIVE: "active",
    CATCH_UP: "catch_up",
    CALL_TWICE: "call_twice",
    PRE_SLEEP: "pre_sleep",
    SLEEPING: "sleeping",
    UNASSIGNED: "unassigned"
  });

  const REACTIVATION_STATUS_LABELS = Object.freeze({
    active: "Active",
    catch_up: "Catch Up",
    call_twice: "Call Twice",
    pre_sleep: "Pre-Sleep",
    sleeping: "Sleeping",
    unassigned: "—"
  });

  const makePerformancePeriod = () => ({
    to: { total: 1, casino: 1, liveCasino: 1, slots: 1, instant: 1 },
    ggr: { total: 1, casino: 1, liveCasino: 1, slots: 1, instant: 1 },
    ngr: { total: 1, casino: 1, liveCasino: 1, slots: 1, instant: 1 }
  });

  const CLIENTS_TEST_DATA = Array.from({ length: 1 }, (_, index) => ({
    _key: `test-${index + 1}`,
    name: "Name",
    clientId: "1",
    performance: { day: makePerformancePeriod(), "30d": makePerformancePeriod(), "12m": makePerformancePeriod() },
    whereHePlays: { sport: 1, casino: 1, liveCasino: 1, slots: 1, instant: 1 },
    quest: index === 0
      ? { name: "Turnover Insurance", progress: 20, mechanic: "turnover_insurance", start: "2026-08-19", end: "2026-08-21", conditions: [], reward: "" }
      : { name: "", progress: 0, mechanic: DEFAULT_QUEST_MECHANIC, start: "", end: "", conditions: [], reward: "" },
    questHistory: [],
    activity: { lastContact: "1", lastClientActivity: "1" },
    being: {
      lastContactDate: `2026-08-${String(Math.max(1, 14 - (index % 8))).padStart(2, "0")}`,
      followUpDate: `2026-08-${String(15 + (index % 6)).padStart(2, "0")}`,
      note: "",
      pinned: index < 2
    },
    bonuses: { total: 1, lastDate: "1", lastAmount: 1 }
  }));

  const dom = {
    app: document.getElementById("app"),
    reactivationPortalBack: document.getElementById("reactivationPortalBack"),
    appLoader: document.getElementById("appLoader"),
    appLoaderStatus: document.getElementById("appLoaderStatus"),
    appLoaderProgress: document.getElementById("appLoaderProgress"),
    appLoaderActions: document.getElementById("appLoaderActions"),
    appLoaderRetry: document.getElementById("appLoaderRetry"),
    appLoaderContinue: document.getElementById("appLoaderContinue"),
    mainMenu: document.getElementById("mainMenu"),
    menuButtons: Array.from(document.querySelectorAll(".main-menu__button")),
    mainMenuReturn: document.getElementById("mainMenuReturn"),
    menuDock: document.getElementById("menuShell"),
    menuDockToggle: document.getElementById("menuDockToggle"),
    menuDockCollapse: document.getElementById("menuDockCollapse"),
    mainMenuHome: document.getElementById("mainMenuHome"),
    pages: Array.from(document.querySelectorAll("[data-page-content]")),
    updateButton: document.getElementById("updateButton"),
    updateButtonText: document.querySelector("#updateButton .update-button__text"),
    localVersion: document.getElementById("localVersion"),
    dataUpdated: document.getElementById("dataUpdated"),
    versionNotification: document.getElementById("versionNotification"),
    versionNotificationText: document.getElementById("versionNotificationText"),
    versionNotificationClose: document.getElementById("versionNotificationClose"),
    exit: {
      button: document.getElementById("appExitButton")
    },
    quickNav: {
      popover: document.getElementById("clientQuickNav"),
      name: document.getElementById("clientQuickNavName"),
      clientId: document.getElementById("clientQuickNavId"),
      destinations: Array.from(document.querySelectorAll("[data-client-quick-destination]"))
    },

    yesterday: {
      turnover: document.getElementById("yesterdayTurnover"),
      ggr: document.getElementById("yesterdayGgr"),
      ngr: document.getElementById("yesterdayNgr"),
      bonuses: document.getElementById("yesterdayBonuses"),
      deposits: document.getElementById("yesterdayDeposits"),
      withdrawals: document.getElementById("yesterdayWithdrawals"),
      depositAmount: document.getElementById("yesterdayDepositAmount"),
      withdrawalAmount: document.getElementById("yesterdayWithdrawalAmount"),
      rows: document.getElementById("yesterdayPlayerRows"),
      sortButtons: Array.from(document.querySelectorAll("[data-yesterday-sort]"))
    },

    dashboard: {
      metricCards: Array.from(document.querySelectorAll("[data-dashboard-metric]")),
      listContainers: Array.from(document.querySelectorAll("[data-dashboard-list]"))
    },

    reactivation: {
      count: document.getElementById("reactivationCount"),
      search: document.getElementById("reactivationSearch"),
      stageFilters: Array.from(document.querySelectorAll("[data-reactivation-stage-filter]")),
      visibleCount: document.getElementById("reactivationVisibleCount"),
      clearFilters: document.getElementById("reactivationClearFilters"),
      totalClients: document.getElementById("reactivationTotalClients"),
      activeCount: document.getElementById("reactivationActiveCount"),
      catchUpCount: document.getElementById("reactivationCatchUpCount"),
      callTwiceCount: document.getElementById("reactivationCallTwiceCount"),
      preSleepCount: document.getElementById("reactivationPreSleepCount"),
      sleepingCount: document.getElementById("reactivationSleepingCount"),
      totalDeposits: document.getElementById("reactivationTotalDeposits"),
      totalNgr: document.getElementById("reactivationTotalNgr"),
      contactsTotal: document.getElementById("reactivationContactsTotal"),
      callsCount: document.getElementById("reactivationCallsCount"),
      emailsCount: document.getElementById("reactivationEmailsCount"),
      sortButtons: Array.from(document.querySelectorAll("[data-reactivation-sort]")),
      tableShell: document.querySelector("#page-reactivation .reactivation-table-shell"),
      rows: document.getElementById("reactivationRows"),
      empty: document.getElementById("reactivationEmpty"),
      card: {
        overlay: document.getElementById("reactivationCardOverlay"),
        modal: document.getElementById("reactivationCardModal"),
        backToBeing: document.getElementById("reactivationCardBackToBeing"),
        close: document.getElementById("reactivationCardClose"),
        name: document.getElementById("reactivationCardName"),
        clientId: document.getElementById("reactivationCardClientId"),
        stage: document.getElementById("reactivationCardStage"),
        playing: document.getElementById("reactivationCardPlaying"),
        started: document.getElementById("reactivationCardStarted"),
        lastActivity: document.getElementById("reactivationCardLastActivity"),
        period12mTo: document.getElementById("reactivationCard12mTo"),
        period12mGgr: document.getElementById("reactivationCard12mGgr"),
        period12mNgr: document.getElementById("reactivationCard12mNgr"),
        period12mBr: document.getElementById("reactivationCard12mBr"),
        ngrTotal: document.getElementById("reactivationCardNgrTotal"),
        depositsTotal: document.getElementById("reactivationCardDepositsTotal"),
        contactsTotal: document.getElementById("reactivationCardContactsTotal"),
        statsPeriodButtons: Array.from(document.querySelectorAll("[data-reactivation-stats-period]")),
        statsLastActivity: document.getElementById("reactivationStatsLastActivity"),
        statsGgr: document.getElementById("reactivationStatsGgr"),
        statsNgr: document.getElementById("reactivationStatsNgr"),
        statsBr: document.getElementById("reactivationStatsBr"),
        statsSportGgr: document.getElementById("reactivationStatsSportGgr"),
        statsCasinoGgr: document.getElementById("reactivationStatsCasinoGgr"),
        statsDeposits: document.getElementById("reactivationStatsDeposits"),
        statsWithdrawals: document.getElementById("reactivationStatsWithdrawals"),
        statsNetLoss: document.getElementById("reactivationStatsNetLoss"),
        statsTo: document.getElementById("reactivationStatsTo"),
        statsSlotsTo: document.getElementById("reactivationStatsSlotsTo"),
        statsInstantTo: document.getElementById("reactivationStatsInstantTo"),
        statsLiveTo: document.getElementById("reactivationStatsLiveTo"),
        period12mSport: document.getElementById("reactivationCard12mSport"),
        period12mCasino: document.getElementById("reactivationCard12mCasino"),
        period12mSlots: document.getElementById("reactivationCard12mSlots"),
        period12mLive: document.getElementById("reactivationCard12mLive"),
        period12mInstant: document.getElementById("reactivationCard12mInstant"),
        questName: document.getElementById("reactivationCardQuestName"),
        questProgress: document.getElementById("reactivationCardQuestProgress"),
        questFill: document.getElementById("reactivationCardQuestFill"),
        questOpen: document.getElementById("reactivationCardQuestOpen"),
        offerName: document.getElementById("reactivationOfferName"),
        offerRule: document.getElementById("reactivationOfferRule"),
        contactDate: document.getElementById("reactivationContactDate"),
        contactTime: document.getElementById("reactivationContactTime"),
        email: document.getElementById("reactivationCardEmail"),
        call: document.getElementById("reactivationCardCall"),
        emailCount: document.getElementById("reactivationCardEmailCount"),
        callCount: document.getElementById("reactivationCardCallCount"),
        contactTotal: document.getElementById("reactivationCardContactTotal"),
        contactLast: document.getElementById("reactivationCardContactLast"),
        contactUndo: document.getElementById("reactivationCardContactUndo"),
        sourceState: document.getElementById("reactivationContactSourceState"),
        bonusHistoryOpen: document.getElementById("reactivationBonusHistoryOpen"),
        toolRail: document.querySelector(".reactivation-work-toolrail"),
        toolNotes: document.getElementById("reactivationToolNotes"),
        toolOffer: document.getElementById("reactivationToolOffer"),
        toolHistory: document.getElementById("reactivationToolHistory"),
        notesPanel: document.getElementById("reactivationNotesPanel"),
        offerPanel: document.getElementById("reactivationOfferPanel"),
        noteHistoryPanel: document.getElementById("reactivationNoteHistoryPanel"),
        noteHistoryList: document.getElementById("reactivationNoteHistoryList"),
        offerBd: document.getElementById("reactivationOfferBd"),
        offerFb: document.getElementById("reactivationOfferFb"),
        offerToDeposit: document.getElementById("reactivationOfferToDeposit"),
        offerQuest: document.getElementById("reactivationOfferQuest"),
        offerSave: document.getElementById("reactivationOfferSave"),
        offerStatus: document.getElementById("reactivationOfferStatus"),
        offerCurrent: document.getElementById("reactivationOfferCurrent"),
        noteDate: document.getElementById("reactivationNoteDate"),
        noteText: document.getElementById("reactivationNoteText"),
        noteSave: document.getElementById("reactivationNoteSave"),
        noteStatus: document.getElementById("reactivationNoteStatus"),
        noteList: document.getElementById("reactivationNoteList"),
        notesCount: document.getElementById("reactivationNotesCount")
      }
    },

    being: {
      rows: document.getElementById("beingRows"),
      empty: document.getElementById("beingEmpty"),
      count: document.getElementById("beingCount"),
      questFilter: document.getElementById("beingQuestFilter"),
      searchShell: document.getElementById("beingSearchShell"),
      searchToggle: document.getElementById("beingSearchToggle"),
      search: document.getElementById("beingSearch"),
      card: {
        overlay: document.getElementById("beingCardOverlay"),
        modal: document.getElementById("beingCardModal"),
        name: document.getElementById("beingCardName"),
        clientId: document.getElementById("beingCardClientId"),
        backToReactivation: document.getElementById("beingCardBackToReactivation"),
        reactivation: document.getElementById("beingCardReactivation"),
        openReactivation: document.getElementById("beingCardOpenReactivation"),
        pin: document.getElementById("beingCardPin"),
        close: document.getElementById("beingCardClose"),
        lastContact: document.getElementById("beingCardLastContact"),
        lastContactToday: document.getElementById("beingCardLastContactToday"),
        followUp: document.getElementById("beingCardFollowUp"),
        questOpen: document.getElementById("beingCardQuestOpen"),
        questName: document.getElementById("beingCardQuestName"),
        questProgress: document.getElementById("beingCardQuestProgress"),
        questProgressFill: document.getElementById("beingCardQuestProgressFill"),
        noteDate: document.getElementById("beingNoteDate"),
        noteText: document.getElementById("beingNoteText"),
        noteSave: document.getElementById("beingNoteSave"),
        noteCancel: document.getElementById("beingNoteCancel"),
        noteList: document.getElementById("beingNoteList"),
        noteCount: document.getElementById("beingNoteCount"),
        done: document.getElementById("beingCardDone")
      }
    },

    clients: {
      panel: document.getElementById("clientsPanel"),
      directory: document.getElementById("clientsDirectory"),
      profileView: document.getElementById("clientProfileView"),
      profile: document.getElementById("clientProfile"),
      questView: document.getElementById("clientQuestView"),
      questDetail: document.getElementById("clientQuestDetail"),
      questOpen: document.getElementById("profileQuestOpen"),
      questBack: document.getElementById("clientQuestBack"),
      questBeingBack: document.getElementById("clientQuestBeingBack"),
      questReactivationBack: document.getElementById("clientQuestReactivationBack"),
      search: document.getElementById("clientsSearch"),
      grid: document.getElementById("clientsGrid"),
      empty: document.getElementById("clientsEmpty"),
      back: document.getElementById("clientProfileBack"),
      periodTabs: document.getElementById("profilePeriodTabs"),
      periodButtons: Array.from(document.querySelectorAll("[data-profile-period]")),
      performanceCells: Array.from(document.querySelectorAll("[data-performance]")),
      performanceTable: document.getElementById("profilePerformanceTable"),
      profileAvatar: document.getElementById("profileAvatar"),
      profileClientName: document.getElementById("profileClientName"),
      profileClientId: document.getElementById("profileClientId"),
      reactivationBadge: document.getElementById("profileReactivationBadge"),
      reactivationAdd: document.getElementById("profileReactivationAdd"),
      sportActivity: document.getElementById("profileSportActivity"),
      casinoActivity: document.getElementById("profileCasinoActivity"),
      liveCasinoActivity: document.getElementById("profileLiveCasinoActivity"),
      slotsActivity: document.getElementById("profileSlotsActivity"),
      instantActivity: document.getElementById("profileInstantActivity"),
      questName: document.getElementById("profileQuestName"),
      questProgressFill: document.getElementById("profileQuestProgressFill"),
      questProgressValue: document.getElementById("profileQuestProgressValue"),
      questStart: document.getElementById("profileQuestStart"),
      questEnd: document.getElementById("profileQuestEnd"),
      questDetailNameInput: document.getElementById("questDetailNameInput"),
      questNameSyncButton: document.getElementById("questNameSyncButton"),
      questMechanicSelect: document.getElementById("questMechanicSelect"),
      questSectionSelect: document.getElementById("questSectionSelect"),
      questCurrencySelect: document.getElementById("questCurrencySelect"),
      questGoalLabel: document.getElementById("questGoalLabel"),
      questGoalInput: document.getElementById("questGoalInput"),
      questDetailProgressValue: document.getElementById("questDetailProgressValue"),
      questDetailProgressFill: document.getElementById("questDetailProgressFill"),
      questProgressPrimaryLabel: document.getElementById("questProgressPrimaryLabel"),
      questProgressPrimaryValue: document.getElementById("questProgressPrimaryValue"),
      questProgressSecondary: document.getElementById("questProgressSecondary"),
      questProgressSecondaryValue: document.getElementById("questProgressSecondaryValue"),
      questProgressStatus: document.getElementById("questProgressStatus"),
      questDetailStartInput: document.getElementById("questDetailStartInput"),
      questDetailEndInput: document.getElementById("questDetailEndInput"),
      questEndNoLimitToggle: document.getElementById("questEndNoLimitToggle"),
      questEndNoLimitNote: document.getElementById("questEndNoLimitNote"),
      questEndField: document.getElementById("questDetailEndInput").closest(".quest-edit-field"),
      questConditionsInput: document.getElementById("questConditionsInput"),
      questRewardInput: document.getElementById("questRewardInput"),
      questEditButton: document.getElementById("questEditButton"),
      questSaveButton: document.getElementById("questSaveButton"),
      questCompleteButton: document.getElementById("questCompleteButton"),
      questCompleteButtonText: document.getElementById("questCompleteButtonText"),
      questHistoryOpen: document.getElementById("questHistoryOpen"),
      totalBonuses: document.getElementById("profileTotalBonuses"),
      lastBonusDate: document.getElementById("profileLastBonusDate"),
      lastBonusAmount: document.getElementById("profileLastBonusAmount"),
      bonusesOpen: document.getElementById("profileBonusesOpen")
    },

    questConfirm: {
      overlay: document.getElementById("questConfirmOverlay"),
      title: document.getElementById("questConfirmTitle"),
      text: document.getElementById("questConfirmText"),
      continueButton: document.getElementById("questConfirmContinue"),
      noButton: document.getElementById("questConfirmNo")
    },

    questHistory: {
      overlay: document.getElementById("questHistoryOverlay"),
      close: document.getElementById("questHistoryClose"),
      client: document.getElementById("questHistoryClient"),
      list: document.getElementById("questHistoryList")
    },

    bonusHistory: {
      overlay: document.getElementById("bonusHistoryOverlay"),
      close: document.getElementById("bonusHistoryClose"),
      client: document.getElementById("bonusHistoryClient"),
      total: document.getElementById("bonusHistoryTotal"),
      lastDate: document.getElementById("bonusHistoryLastDate"),
      lastAmount: document.getElementById("bonusHistoryLastAmount"),
      list: document.getElementById("bonusHistoryList")
    }
  };

  const VALID_PROFILE_PERIODS = new Set(["day", "30d", "12m"]);

  const state = {
    currentPage: null,
    opened: false,
    updating: false,
    appBootFinished: false,
    appBootFailed: false,
    clients: CLIENTS_TEST_DATA,
    clientsSource: "placeholder",
    clientQuery: "",
    selectedClient: null,
    profilePeriod: "day",
    searchFrame: 0,
    clientsRevision: 0,
    clientsRenderedRevision: -1,
    clientsRenderedQuery: null,
    yesterdayData: null,
    yesterdaySortKey: "ggrDay",
    yesterdaySortDirection: "desc",
    reactivationClients: [],
    reactivationSortKey: "performance.12m.bonusRate",
    reactivationSortDirection: "asc",
    reactivationQuery: "",
    reactivationSearchFrame: 0,
    reactivationStageFilter: "all",
    reactivationPortalOrigin: null,
    reactivationPortalReturning: false,
    reactivationSelectedId: null,
    reactivationCardOpen: false,
    beingReactivationOrigin: null,
    reactivationStatsPeriod: "30d",
    reactivationCardReturnFocus: null,
    reactivationContactPending: new Set(),
    reactivationWorkRenderedId: null,
    reactivationWorkTool: "notes",
    reactivationOfferDirty: false,
    reactivationNotePending: false,
    reactivationChangeHandler: null,
    reactivationSourceReady: false,
    reactivationActionSequence: 0,
    beingPinOrder: new Map(),
    beingQuestFilter: false,
    beingChangeHandler: null,
    beingCardOpen: false,
    beingCardClientKey: null,
    beingCardReturnFocus: null,
    reactivationBeingOrigin: null,
    beingNoteEditIndex: -1,
    beingSearchOpen: false,
    beingQuery: "",
    beingSearchFrame: 0,
    questSaveStatusTimer: 0,
    questSaveInProgress: false,
    questEditMode: false,
    questDraftBaseline: "",
    questConfirmOpen: false,
    questConfirmReturnFocus: null,
    questHistoryOpen: false,
    questHistoryReturnFocus: null,
    questNavigationOrigin: null,
    bonusHistoryOpen: false,
    bonusHistoryReturnFocus: null,
    bonusHistoryClientKey: null,
    quickNavOpen: false,
    quickNavReference: null,
    quickNavTargets: null,
    quickNavReturnFocus: null,
    pendingWrites: new Set(),
    dockOpen: false,
    windowCollapsed: false,
    // True only while the fold was taken to show the menu, so that closing
    // the menu gives the screen back and a deliberate collapse does not.
    dockFoldedScreen: false,
    exitInProgress: false,
    crmControlAvailable: false,
    crmHeartbeatTimer: 0
  };

  const numberFormatter = new Intl.NumberFormat("en-IE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const integerFormatter = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 });
  const normalizeNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };
  const normalizeOptionalNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const formatNumber = (value) => numberFormatter.format(normalizeNumber(value));
  const formatInteger = (value) => integerFormatter.format(Math.round(normalizeNumber(value)));
  const formatMoney = (value) => `€${formatNumber(value)}`;
  const formatRate = (value) => `${formatNumber(value)}%`;
  const formatOptionalMoney = (value) => value === null || value === undefined ? "—" : formatMoney(value);
  const formatOptionalRate = (value) => value === null || value === undefined ? "—" : formatRate(value);
  const formatOptionalInteger = (value) => value === null || value === undefined ? "—" : formatInteger(value);
  const formatOptionalNumber = (value) => value === null || value === undefined ? "—" : formatNumber(value);

  /*
    Writes for one client are chained so two quick clicks cannot race. The
    optimistic local state still flips immediately, exactly as before; only the
    requests are ordered, so the sheet ends up matching the last click instead
    of whichever response happened to arrive last.
  */
  const clientWriteQueues = new Map();

  function queueClientWrite(clientKey, run) {
    const key = String(clientKey || "");
    if (!key) return Promise.resolve(run());

    const previous = clientWriteQueues.get(key) || Promise.resolve();
    const next = previous.then(run, run);

    // The stored link swallows rejections so one failure cannot block the
    // queue; the caller still receives the real promise and its error.
    clientWriteQueues.set(key, next.catch(() => {}));

    return next;
  }


  /*
    The directory falls back to a single synthetic client when the local bridge
    is not configured. That state was tracked but never shown, so fabricated
    figures were indistinguishable from real ones. The Data Updated line says
    so instead of showing a date that does not exist.
  */
  function renderDataSourceState() {
    if (!dom.dataUpdated) return;

    const placeholder = state.clientsSource === "placeholder";
    dom.dataUpdated.classList.toggle("is-placeholder", placeholder);
    if (placeholder) dom.dataUpdated.textContent = "Placeholder data";

    syncSystemMeta();
  }

  /*
    The menu is exactly as wide as its buttons, and "Placeholder data" in a
    line of its own was pushing that width out to whatever the longest value
    happened to be. Only the version number is drawn now; the rest is the
    tooltip, and the version turns amber when the figures are not from the
    sheet - the warning is still there, it just does not resize the menu.
  */
  function syncSystemMeta() {
    const meta = dom.dataUpdated?.parentElement;
    if (!meta) return;

    const placeholder = state.clientsSource === "placeholder";
    meta.classList.toggle("is-placeholder", placeholder);
    meta.title = placeholder
      ? "Placeholder data - the local bridge is not connected, so these figures are not from the sheet."
      : `VIP CRM ${dom.localVersion?.textContent ?? ""} - data updated ${dom.dataUpdated.textContent}`;
  }


  function trackPendingWrite(operation) {
    const tracked = Promise.resolve(operation);
    state.pendingWrites.add(tracked);
    tracked.then(
      () => state.pendingWrites.delete(tracked),
      () => state.pendingWrites.delete(tracked)
    );
    return tracked;
  }

  function makeTextCell(text, className = "") {
    const cell = document.createElement("div");
    cell.className = `player-table__cell ${className}`.trim();
    cell.textContent = text;
    return cell;
  }

  function makeMoneyCell(value) {
    return makeTextCell(formatOptionalMoney(value), "is-money");
  }

  function createYesterdayPlayerRow(player) {
    const row = document.createElement("div");
    row.className = "player-table__row client-quick-nav-trigger";
    row.dataset.clientName = String(player?.name ?? "Name");
    row.dataset.clientId = String(player?.clientId ?? "");
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-haspopup", "dialog");
    row.setAttribute("aria-label", `Open destinations for ${row.dataset.clientName}`);
    row.append(
      makeTextCell(player.name ?? "Name"),
      makeTextCell(player.clientId ?? "ID"),
      makeMoneyCell(player.toDay), makeMoneyCell(player.toSport), makeMoneyCell(player.toCasino),
      makeMoneyCell(player.toInstant), makeMoneyCell(player.toLive), makeMoneyCell(player.toSlots),
      makeMoneyCell(player.bonusDay),
      makeMoneyCell(player.ggrDay), makeMoneyCell(player.ggrSport), makeMoneyCell(player.ggrCasino),
      makeMoneyCell(player.ggrInstant), makeMoneyCell(player.ggrLive), makeMoneyCell(player.ggrSlots),
      makeMoneyCell(player.ngrDay),
      makeTextCell(formatOptionalRate(player.bonusRate30d), "is-rate"),
      makeTextCell(formatOptionalRate(player.bonusRate12m), "is-rate")
    );
    return row;
  }

  /*
    Bonus Rate does not sort like the money columns, anywhere on the site.
    0% is the best result there is: nothing was paid out per unit of GGR.
    Climbing positives get steadily worse, and a negative rate means GGR itself
    went negative, which is worse than any positive rate however large.

    So the rank is the rate for positives, and the whole positive range plus
    the distance below zero for negatives. Ascending therefore reads
    0 -> 100 -> the negatives, nearest zero first; descending reverses it.

    Every table that offers a Bonus Rate column sorts through this.
  */
  const BONUS_RATE_NEGATIVE_RANK_BASE = 1e9;
  const BONUS_RATE_SORT_KEYS = Object.freeze([
    "bonusRate",
    "bonusRate30d",
    "bonusRate12m",
    "performance.12m.bonusRate"
  ]);

  function isBonusRateSortKey(key) {
    return BONUS_RATE_SORT_KEYS.indexOf(String(key)) >= 0;
  }

  function getBonusRateRank(value) {
    const rate = normalizeOptionalNumber(value);
    if (rate === null) return null;
    return rate >= 0 ? rate : BONUS_RATE_NEGATIVE_RANK_BASE - rate;
  }


  function compareYesterdayPlayers(left, right) {
    const key = state.yesterdaySortKey;
    const direction = state.yesterdaySortDirection === "asc" ? 1 : -1;
    const leftValue = left?.[key];
    const rightValue = right?.[key];
    const leftMissing = leftValue === null || leftValue === undefined || leftValue === "";
    const rightMissing = rightValue === null || rightValue === undefined || rightValue === "";

    // Missing values always stay at the bottom, independent of direction.
    if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;

    const numericColumn = key !== "name" && key !== "clientId";
    // Bonus Rate ranks by how good the figure is, not how large it is.
    const rank = (value) => isBonusRateSortKey(key)
      ? normalizeNumber(getBonusRateRank(value))
      : normalizeNumber(value);
    let result = numericColumn
      ? rank(leftValue) - rank(rightValue)
      : String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, {
          numeric: true,
          sensitivity: "base"
        });

    if (result === 0) {
      result = String(left?.name ?? "").localeCompare(String(right?.name ?? ""), undefined, {
        numeric: true,
        sensitivity: "base"
      });
    }
    return result * direction;
  }

  function updateYesterdaySortControls() {
    dom.yesterday.sortButtons.forEach((button) => {
      const active = button.dataset.yesterdaySort === state.yesterdaySortKey;
      button.classList.toggle("is-active", active);
      button.dataset.direction = active ? state.yesterdaySortDirection : "";
      button.setAttribute(
        "aria-sort",
        active
          ? (state.yesterdaySortDirection === "asc" ? "ascending" : "descending")
          : "none"
      );
    });
  }

  function setYesterdaySort(key) {
    if (!dom.yesterday.sortButtons.some(button => button.dataset.yesterdaySort === key)) return;
    if (state.yesterdaySortKey === key) {
      state.yesterdaySortDirection = state.yesterdaySortDirection === "desc" ? "asc" : "desc";
    } else {
      state.yesterdaySortKey = key;
      // Money reads best highest-first; Bonus Rate reads best at zero, so it
      // opens ascending the way the Reactivation column does.
      state.yesterdaySortDirection = isBonusRateSortKey(key) ? "asc" : "desc";
    }
    renderYesterday(state.yesterdayData);
  }

  function renderYesterday(data) {
    if (!data) return;
    state.yesterdayData = data;
    const totals = data.totals || {};
    dom.yesterday.turnover.textContent = formatNumber(totals.turnover);
    dom.yesterday.ggr.textContent = formatNumber(totals.ggr);
    dom.yesterday.ngr.textContent = formatNumber(totals.ngr);
    dom.yesterday.bonuses.textContent = formatNumber(totals.bonuses);
    dom.yesterday.deposits.textContent = formatOptionalInteger(totals.depositsCount);
    dom.yesterday.withdrawals.textContent = formatOptionalInteger(totals.withdrawalsCount);
    dom.yesterday.depositAmount.textContent = formatOptionalNumber(totals.depositAmount);
    dom.yesterday.withdrawalAmount.textContent = formatOptionalNumber(totals.withdrawalAmount);

    const fragment = document.createDocumentFragment();
    const players = Array.isArray(data.players)
      ? data.players.slice().sort(compareYesterdayPlayers)
      : [];
    for (const player of players) fragment.appendChild(createYesterdayPlayerRow(player));
    dom.yesterday.rows.replaceChildren(fragment);
    updateYesterdaySortControls();
  }

  function formatDashboardValue(value, format) {
    if (format === "integer") return formatInteger(value);
    if (format === "money") return formatMoney(value);
    if (format === "rate") return formatRate(value);
    return String(value ?? "");
  }

  function renderDashboardMetrics(metrics) {
    for (const card of dom.dashboard.metricCards) {
      const valueElement = card.querySelector(".dashboard-metric__value");
      if (!valueElement) continue;
      valueElement.textContent = formatDashboardValue(metrics?.[card.dataset.dashboardMetric], card.dataset.format);
    }
  }

  function createDashboardTopRow(item, index, format) {
    const row = document.createElement("div");
    row.className = "dashboard-top-table__row client-quick-nav-trigger";
    row.dataset.clientName = String(item?.name ?? "Name");
    row.dataset.clientId = String(item?.clientId ?? item?.clientID ?? "");
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-haspopup", "dialog");
    row.setAttribute("aria-label", `Open destinations for ${row.dataset.clientName}`);

    const rank = document.createElement("div");
    rank.className = "dashboard-top-table__cell dashboard-top-table__cell--rank";
    rank.textContent = String(index + 1);

    const player = document.createElement("div");
    player.className = "dashboard-top-table__cell";
    player.textContent = item?.name ?? "Name";

    const value = document.createElement("div");
    value.className = "dashboard-top-table__cell dashboard-top-table__cell--value";
    value.textContent = formatDashboardValue(item?.value, format);

    row.append(rank, player, value);
    return row;
  }

  function renderDashboardLists(lists) {
    for (const container of dom.dashboard.listContainers) {
      const source = Array.isArray(lists?.[container.dataset.dashboardList]) ? lists[container.dataset.dashboardList].slice(0, 5) : [];
      const fragment = document.createDocumentFragment();
      source.forEach((item, index) => fragment.appendChild(createDashboardTopRow(item, index, container.dataset.valueFormat || "money")));
      container.replaceChildren(fragment);
    }
  }

  function renderDashboard(data) {
    if (!data) return;
    renderDashboardMetrics(data.metrics || {});
    renderDashboardLists(data.lists || {});
  }

  function buildAnalyticsFrom365Clients(clients) {
    const rows = (Array.isArray(clients) ? clients : []).filter((client) =>
      client?.performance?.["12m"]?.sourceLatestDate
    );
    if (!rows.length) return null;

    const sum = (period, path) => rows.reduce(
      (total, client) => total + normalizeNumber(getNestedValue(client.performance?.[period] || {}, path)),
      0
    );
    const optionalSum = (period, path) => {
      const values = rows
        .map(client => normalizeOptionalNumber(getNestedValue(client.performance?.[period] || {}, path)))
        .filter(value => value !== null);
      return values.length ? values.reduce((total, value) => total + value, 0) : null;
    };
    const rate = (period) => {
      const ggr = sum(period, "ggr.total");
      const bonus = sum(period, "bonus");
      if (ggr) return bonus / ggr * 100;
      const values = rows.map(client => normalizeOptionalNumber(client.performance?.[period]?.bonusRate)).filter(value => value !== null);
      return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
    };
    const latestSourceDate = rows.reduce((latest, client) => {
      const value = client.performance?.["12m"]?.sourceLatestDate || "";
      return value > latest ? value : latest;
    }, "");
    const activeThreshold = latestSourceDate
      ? Date.parse(latestSourceDate + "T00:00:00Z") - 29 * 86400000
      : 0;
    const activeClients = rows.filter((client) => {
      const value = client.performance?.["12m"]?.lastActivityDate;
      const timestamp = value ? Date.parse(value + "T00:00:00Z") : NaN;
      return Number.isFinite(timestamp) && timestamp >= activeThreshold;
    }).length;

    const list = (period, path, direction = "desc", predicate = () => true) => rows
      .map((client) => ({
        name: client.name,
        clientId: client.clientId,
        value: normalizeNumber(getNestedValue(client.performance?.[period] || {}, path))
      }))
      .filter((item) => predicate(item.value))
      .sort((a, b) => direction === "asc" ? a.value - b.value : b.value - a.value)
      .slice(0, 5);

    const yesterday = {
      totals: {
        turnover: sum("day", "to.total"),
        ggr: sum("day", "ggr.total"),
        ngr: sum("day", "ngr.total"),
        bonuses: sum("day", "bonus"),
        depositsCount: optionalSum("day", "depositCount"),
        withdrawalsCount: optionalSum("day", "withdrawalCount"),
        depositAmount: optionalSum("day", "deposits"),
        withdrawalAmount: optionalSum("day", "withdrawals")
      },
      players: rows.map((client) => {
        const day = client.performance.day || {};
        return {
          name: client.name,
          clientId: client.clientId,
          toDay: day.to?.total,
          toSport: day.to?.sport,
          toCasino: day.to?.casino,
          toInstant: day.to?.instant,
          toLive: day.to?.liveCasino,
          toSlots: day.to?.slots,
          bonusDay: day.bonus,
          ggrDay: day.ggr?.total,
          ggrSport: day.ggr?.sport,
          ggrCasino: day.ggr?.casino,
          ggrInstant: day.ggr?.instant,
          ggrLive: day.ggr?.liveCasino,
          ggrSlots: day.ggr?.slots,
          ngrDay: day.ngr?.total,
          bonusRate30d: client.performance?.["30d"]?.bonusRate,
          bonusRate12m: client.performance?.["12m"]?.bonusRate
        };
      })
    };

    const dashboard = {
      metrics: {
        activeClients,
        turnoverPreviousDay: yesterday.totals.turnover,
        turnover30d: sum("30d", "to.total"),
        averageDailyTurnover: sum("30d", "to.total") / 30,
        ggr30d: sum("30d", "ggr.total"),
        ngr30d: sum("30d", "ngr.total"),
        bonusRate30d: rate("30d"),
        bonusRate12m: rate("12m")
      },
      lists: {
        topTurnover7d: list("7d", "to.total"),
        topPositiveNgr7d: list("7d", "ngr.total", "desc", value => value > 0),
        topNegativeNgr7d: list("7d", "ngr.total", "asc", value => value < 0),
        topTo30d: list("30d", "to.total"),
        topPositiveNgr30d: list("30d", "ngr.total", "desc", value => value > 0),
        topNegativeNgr30d: list("30d", "ngr.total", "asc", value => value < 0),
        topTurnover12m: list("12m", "to.total"),
        topPositiveNgr12m: list("12m", "ngr.total", "desc", value => value > 0),
        topNegativeNgr12m: list("12m", "ngr.total", "asc", value => value < 0)
      }
    };

    return { yesterday, dashboard };
  }

  function refreshAnalyticsFrom365() {
    const analytics = buildAnalyticsFrom365Clients(state.clients);
    if (!analytics) return false;
    renderYesterday(analytics.yesterday);
    renderDashboard(analytics.dashboard);
    return true;
  }

  function normalizeClientReference(reference = {}) {
    return {
      clientId: String(reference.clientId ?? "").trim(),
      name: String(reference.name ?? "").trim()
    };
  }

  /*
    A reference resolves only when it is unambiguous: two rows with the same
    ID (or the same name) are a question, not an answer. The scan stops at the
    second match instead of collecting every one.
  */
  function findUniqueClient(clients, predicate) {
    let found = null;
    for (const client of clients) {
      if (!predicate(client)) continue;
      if (found) return { unique: false, client: found };
      found = client;
    }
    return { unique: Boolean(found), client: found };
  }

  function findClientByReference(collection, reference) {
    const normalized = normalizeClientReference(reference);
    const clients = Array.isArray(collection) ? collection : [];
    const usableId = normalized.clientId && !/^client id$/i.test(normalized.clientId);
    const normalizedName = normalizeSearch(normalized.name);
    const idMatches = (client) => String(client?.clientId ?? "").trim() === normalized.clientId;
    const nameMatches = (client) => normalizeSearch(client?.name) === normalizedName;

    if (usableId) {
      const byId = findUniqueClient(clients, idMatches);
      if (byId.unique) return byId.client;

      // Several rows share the ID: the name decides, or nothing does.
      if (byId.client && normalizedName) {
        const exact = findUniqueClient(clients, (client) => idMatches(client) && nameMatches(client));
        return exact.unique ? exact.client : null;
      }
    }

    if (!normalizedName) return null;
    const byName = findUniqueClient(clients, nameMatches);
    return byName.unique ? byName.client : null;
  }

  function findWorkspaceClient(reference) {
    return findClientByReference(state.clients, reference);
  }

  function findReactivationClientByReference(reference) {
    return findClientByReference(state.reactivationClients, reference);
  }

  function getQuickNavReferenceFromTrigger(trigger) {
    return normalizeClientReference({
      clientId: trigger?.dataset?.clientId,
      name: trigger?.dataset?.clientName
    });
  }

  function positionClientQuickNav(trigger) {
    const anchor = trigger.getBoundingClientRect();
    const popover = dom.quickNav.popover;
    const margin = 8;
    const width = popover.offsetWidth || 286;
    const height = popover.offsetHeight || 96;
    const left = Math.max(
      margin,
      Math.min(window.innerWidth - width - margin, anchor.left + Math.min(26, anchor.width * 0.08))
    );
    const preferredTop = anchor.top - height - 7;
    const top = preferredTop >= margin
      ? preferredTop
      : Math.min(window.innerHeight - height - margin, anchor.bottom + 7);

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
  }

  function resolveQuickNavTargets(reference) {
    return {
      workspaceClient: findWorkspaceClient(reference),
      reactivationClient: findReactivationClientByReference(reference)
    };
  }

  function openClientQuickNav(trigger) {
    if (!trigger) return;

    const reference = getQuickNavReferenceFromTrigger(trigger);
    const targets = resolveQuickNavTargets(reference);
    const { workspaceClient, reactivationClient } = targets;

    state.quickNavOpen = true;
    state.quickNavReference = reference;
    state.quickNavTargets = targets;
    state.quickNavReturnFocus = trigger;

    dom.quickNav.name.textContent = reference.name || "Client";
    dom.quickNav.clientId.textContent = reference.clientId
      ? `ID: ${reference.clientId}`
      : "ID unavailable";

    dom.quickNav.destinations.forEach((button) => {
      const destination = button.dataset.clientQuickDestination;
      const available = destination === PAGES.REACTIVATION
        ? Boolean(reactivationClient)
        : Boolean(workspaceClient);
      button.disabled = !available;
      button.title = available ? `Open in ${button.textContent.trim()}` : "This client is not available in that section";
    });

    dom.quickNav.popover.classList.add("is-open");
    dom.quickNav.popover.setAttribute("aria-hidden", "false");
    positionClientQuickNav(trigger);

    const firstAvailable = dom.quickNav.destinations.find((button) => !button.disabled);
    window.requestAnimationFrame(() => firstAvailable?.focus({ preventScroll: true }));
  }

  function closeClientQuickNav({ restoreFocus = true } = {}) {
    if (!state.quickNavOpen) return;

    const target = state.quickNavReturnFocus;
    state.quickNavOpen = false;
    state.quickNavReference = null;
    state.quickNavTargets = null;
    state.quickNavReturnFocus = null;
    dom.quickNav.popover.classList.remove("is-open");
    dom.quickNav.popover.setAttribute("aria-hidden", "true");

    if (restoreFocus && target?.isConnected) {
      window.requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
  }

  function openQuickNavDestination(destination) {
    const reference = state.quickNavReference;
    if (!reference) return;

    // Resolved when the popover opened; looked up again only if a list was
    // replaced underneath it in the meantime.
    const stored = state.quickNavTargets;
    const stale = !stored
      || (stored.workspaceClient && !state.clients.includes(stored.workspaceClient))
      || (stored.reactivationClient && !state.reactivationClients.includes(stored.reactivationClient));
    const { workspaceClient, reactivationClient } = stale
      ? resolveQuickNavTargets(reference)
      : stored;
    closeClientQuickNav({ restoreFocus: false });

    if (destination === PAGES.REACTIVATION && reactivationClient) {
      openPage(PAGES.REACTIVATION);
      window.requestAnimationFrame(() => {
        openReactivationCard(reactivationClient.clientId, null);
      });
      return;
    }

    if (destination === PAGES.BEING && workspaceClient) {
      openPage(PAGES.BEING);
      window.requestAnimationFrame(() => openBeingCard(workspaceClient._key, null));
      return;
    }

    if (destination === PAGES.CLIENTS && workspaceClient) {
      openPage(PAGES.CLIENTS);
      openClientProfile(workspaceClient);
    }
  }

  function normalizeSearch(value) {
    return String(value ?? "").trim().toLocaleLowerCase();
  }

  function getFilteredClients() {
    const query = normalizeSearch(state.clientQuery);
    if (!query) return state.clients;
    return state.clients.filter((client) => normalizeSearch(client.name).includes(query) || normalizeSearch(client.clientId).includes(query));
  }

  /*
    One pass over the queue per list render instead of a linear search per
    row. The badge marks every ID on Reactivation with at least four inactive
    days, the same rule shouldShowReactivationMembership applies to one ID.
  */
  function getReactivationMembershipSet() {
    const ids = new Set();
    state.reactivationClients.forEach((client) => {
      if (Number.isFinite(client.daysInactive) && client.daysInactive >= 4) {
        ids.add(String(client.clientId));
      }
    });
    return ids;
  }

  function createClientCard(client, index = 0, membership = getReactivationMembershipSet()) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "client-card";
    card.dataset.clientKey = client._key;
    card.style.setProperty("--card-index", String(index));

    const name = document.createElement("div");
    name.className = "client-card__name";
    name.textContent = client.name || "Name";

    const id = document.createElement("div");
    id.className = "client-card__id";
    id.textContent = `ID: ${client.clientId ?? ""}`;

    card.append(name, id);

    if (membership.has(String(client.clientId ?? ""))) {
      const badge = document.createElement("span");
      badge.className = "reactivation-membership-badge reactivation-membership-badge--card";
      badge.textContent = "On Reactivation";
      card.appendChild(badge);
    }
    return card;
  }

  function renderClients(force = false) {
    const normalizedQuery = normalizeSearch(state.clientQuery);

    if (
      !force &&
      state.clientsRenderedRevision === state.clientsRevision &&
      state.clientsRenderedQuery === normalizedQuery
    ) {
      return;
    }

    const clients = getFilteredClients();
    const membership = getReactivationMembershipSet();
    const fragment = document.createDocumentFragment();

    clients.forEach((client, index) => {
      fragment.appendChild(createClientCard(client, index, membership));
    });

    dom.clients.grid.replaceChildren(fragment);
    dom.clients.empty.hidden = clients.length !== 0;

    state.clientsRenderedRevision = state.clientsRevision;
    state.clientsRenderedQuery = normalizedQuery;
  }

  function normalizeBeingPinned(value) {
    if (value === true) return true;

    if (
      value === false ||
      value === null ||
      value === undefined
    ) {
      return false;
    }

    const normalized = String(value)
      .trim()
      .toLowerCase();

    return [
      "true",
      "1",
      "yes",
      "y",
      "on",
      "pinned",
      "tak"
    ].includes(normalized);
  }

  function normalizeBeingDateValue(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";

    // Already ISO / ISO datetime.
    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
    if (iso) {
      return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
    }

    // Google Sheet display formats such as 15.08.2026, 15/08/2026, 15-08-2026.
    const dmy = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const year = Number(dmy[3]);

      // If first part cannot be a day but second can, accept US MM/DD/YYYY too.
      if (day <= 12 && month > 12) {
        return `${year}-${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}`;
      }

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    // YYYY.MM.DD / YYYY/MM/DD
    const ymd = raw.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
    if (ymd) {
      return `${ymd[1]}-${String(ymd[2]).padStart(2, "0")}-${String(ymd[3]).padStart(2, "0")}`;
    }

    return "";
  }

  function parseBeingDate(value) {
    const normalized = normalizeBeingDateValue(value);
    if (!normalized) return Number.POSITIVE_INFINITY;

    const [year, month, day] = normalized.split("-").map(Number);
    const timestamp = Date.UTC(year, month - 1, day);
    return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
  }

  function calculateReactivationInactiveDays(value) {
    const timestamp = parseBeingDate(value);
    if (!Number.isFinite(timestamp)) return null;

    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.floor((today - timestamp) / 86400000));
  }

  function getReactivationStatus(daysValue) {
    const value = normalizeOptionalNumber(daysValue);
    if (value === null) return REACTIVATION_STATUS.UNASSIGNED;
    const days = Math.max(0, Math.floor(value));
    if (days <= 2) return REACTIVATION_STATUS.ACTIVE;
    if (days <= 5) return REACTIVATION_STATUS.CATCH_UP;
    if (days <= 13) return REACTIVATION_STATUS.CALL_TWICE;
    // 14-30 used to fall through to UNASSIGNED, which is the "no days recorded"
    // bucket, so a month of silence rendered as a dash. It is its own stage now
    // and UNASSIGNED means only what its name says.
    if (days <= 30) return REACTIVATION_STATUS.PRE_SLEEP;
    return REACTIVATION_STATUS.SLEEPING;
  }

  function getReactivationStatusLabel(daysValue) {
    return REACTIVATION_STATUS_LABELS[getReactivationStatus(daysValue)] || "—";
  }

  function normalizeReactivationNote(entry, index = 0) {
    return {
      id: String(entry?.id ?? `reactivation-note-${index}`),
      date: normalizeBeingDateValue(entry?.date),
      text: String(entry?.text ?? "").trim(),
      sheetName: String(entry?.sheetName ?? "").trim(),
      isCurrent: Boolean(entry?.isCurrent)
    };
  }

  function compareReactivationNotes(a, b) {
    const dateCompare = String(b?.date ?? "").localeCompare(String(a?.date ?? ""));
    if (dateCompare) return dateCompare;

    if (Boolean(a?.isCurrent) !== Boolean(b?.isCurrent)) {
      return a?.isCurrent ? -1 : 1;
    }

    return String(b?.sheetName ?? "").localeCompare(String(a?.sheetName ?? ""));
  }

  function normalizeReactivationPerformancePeriod(source) {
    const period = source && typeof source === "object" ? source : {};
    const split = period.turnoverSplit && typeof period.turnoverSplit === "object"
      ? period.turnoverSplit
      : {};

    return {
      lastActivityDate: normalizeBeingDateValue(period.lastActivityDate ?? period.lastActivity),
      to: normalizeOptionalNumber(period.to),
      ggr: normalizeOptionalNumber(period.ggr),
      ngr: normalizeOptionalNumber(period.ngr),
      bonusRate: normalizeOptionalNumber(period.bonusRate),
      ggrSport: normalizeOptionalNumber(period.ggrSport ?? period.sportGgr),
      ggrCasino: normalizeOptionalNumber(period.ggrCasino ?? period.casinoGgr),
      ggrSlots: normalizeOptionalNumber(period.ggrSlots ?? period.slotsGgr),
      ngrSlots: normalizeOptionalNumber(period.ngrSlots ?? period.slotsNgr),
      ggrInstant: normalizeOptionalNumber(period.ggrInstant ?? period.instantGgr),
      ngrInstant: normalizeOptionalNumber(period.ngrInstant ?? period.instantNgr),
      ggrLive: normalizeOptionalNumber(period.ggrLive ?? period.liveGgr),
      ngrLive: normalizeOptionalNumber(period.ngrLive ?? period.liveNgr),
      ngrSport: normalizeOptionalNumber(period.ngrSport ?? period.sportNgr),
      ngrCasino: normalizeOptionalNumber(period.ngrCasino ?? period.casinoNgr),
      bonus: normalizeOptionalNumber(period.bonus),
      deposits: normalizeOptionalNumber(period.deposits),
      depositCount: normalizeOptionalNumber(period.depositCount),
      withdrawals: normalizeOptionalNumber(period.withdrawals),
      withdrawalCount: normalizeOptionalNumber(period.withdrawalCount),
      netLoss: deriveNetLoss(period.deposits, period.withdrawals),
      sourceLatestDate: normalizeBeingDateValue(period.sourceLatestDate),
      sport: normalizeOptionalNumber(period.sport ?? period.toSport ?? split.sport),
      casino: normalizeOptionalNumber(period.casino ?? period.toCasino ?? split.casino),
      slots: normalizeOptionalNumber(period.slots ?? period.toSlots ?? split.slots),
      live: normalizeOptionalNumber(period.live ?? period.liveCasino ?? period.toLive ?? split.live ?? split.liveCasino),
      instant: normalizeOptionalNumber(period.instant ?? period.toInstant ?? split.instant)
    };
  }

  function normalizeReactivationClient(source, index = 0) {
    const p30 = source?.performance?.["30d"] || {};
    const p12 = source?.performance?.["12m"] || {};
    const totals = source?.reactivationTotals || {};

    /*
      Level 1 of sheet 365 is the authoritative Last Activity: the since-sheets
      carry a hand-kept date that drifts. Whichever path built this client, the
      365 value wins when it exists.
    */
    const lastActivityDate =
      normalizeBeingDateValue(p12?.lastActivityDate) ||
      normalizeBeingDateValue(source?.lastActivityDate);
    const derivedInactiveDays = calculateReactivationInactiveDays(lastActivityDate);
    const suppliedInactiveDays = normalizeOptionalNumber(source?.daysInactive);

    return {
      clientId: String(source?.clientId ?? `reactivation-${index + 1}`),
      name: String(source?.name ?? "Name"),
      daysInactive: suppliedInactiveDays === null
        ? derivedInactiveDays
        : Math.max(0, Math.floor(suppliedInactiveDays)),
      reactivationStartedAt: normalizeBeingDateValue(source?.reactivationStartedAt),
      lastActivityDate,
      lastContactDate: normalizeBeingDateValue(source?.lastContactDate),
      reactivationNgr: normalizeOptionalNumber(source?.reactivationNgr ?? totals.ngr),
      depositAmount: normalizeOptionalNumber(source?.depositAmount ?? totals.deposits),
      contactsTotal: Math.max(0, Math.floor(normalizeNumber(source?.contactsTotal))),
      reactivationNotes: Array.isArray(source?.reactivationNotes)
        ? source.reactivationNotes
            .map(normalizeReactivationNote)
            .filter((entry) => entry.text)
            .sort(compareReactivationNotes)
        : [],
      currentCommText: String(source?.currentCommText ?? ""),
      offerText: String(source?.offerText ?? ""),
      currentSheetName: String(source?.currentSheetName ?? ""),
      playing: String(source?.playing ?? ""),
      performance: {
        "30d": normalizeReactivationPerformancePeriod(p30),
        "12m": normalizeReactivationPerformancePeriod(p12)
      },
      calls: Math.max(0, Math.floor(normalizeNumber(source?.calls))),
      emails: Math.max(0, Math.floor(normalizeNumber(source?.emails))),
      // Session-only: the sheet stores counters, not the entries behind them.
      contactLog: [],
      quest: {
        name: String(source?.quest?.name ?? "")
      }
    };
  }

  /*
    The current since-sheet is the only list: it drives the count, the stage
    chips and the Deposits / NGR / contact totals alike. The feed also carries
    archiveRows for everyone who ever entered Reactivation, but nothing on
    screen reads them, so they are not kept.
  */
  function setReactivationData(rows) {
    if (!Array.isArray(rows)) throw new TypeError("Reactivation data must be an array.");
    state.reactivationClients = dedupeReactivationClients(
      rows.map(normalizeReactivationClient)
    );
    renderReactivation();
    renderClients(true);
    renderBeing();

    if (state.selectedClient) renderProfile(state.selectedClient);
    if (state.beingCardOpen) renderBeingCard(getBeingCardClient());
  }

  function setReactivationChangeHandler(handler) {
    if (handler !== null && typeof handler !== "function") {
      throw new TypeError("Reactivation change handler must be a function or null.");
    }
    state.reactivationChangeHandler = handler;
  }

  function emitReactivationChange(payload) {
    if (typeof state.reactivationChangeHandler !== "function") return Promise.resolve(null);
    try {
      return trackPendingWrite(state.reactivationChangeHandler(payload));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  // state.reactivationClients is unique by ID from here on:
  // addWorkspaceClientToReactivation checks membership before it pushes.
  function dedupeReactivationClients(rows) {
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((client) => {
      const id = String(client?.clientId ?? "").trim();
      if (id && !map.has(id)) map.set(id, client);
    });
    return Array.from(map.values());
  }

  function isClientOnReactivation(clientId) {
    const id = String(clientId ?? "").trim();
    if (!id) return false;
    return state.reactivationClients.some(
      (client) => String(client?.clientId ?? "").trim() === id
    );
  }

  function shouldShowReactivationMembership(clientId) {
    const client = getReactivationClient(clientId);
    return Boolean(client && Number.isFinite(client.daysInactive) && client.daysInactive >= 4);
  }

  /**
   * Flattens a Being period into the shape Reactivation expects.
   *
   * Being nests turnover and GGR by vertical; Reactivation wants one number
   * per column. Missing figures stay null so the card shows a dash rather
   * than a zero it cannot back up.
   */
  function reactivationPeriodFromBeingPerformance(period) {
    const source = period && typeof period === "object" ? period : {};

    return {
      to: normalizeOptionalNumber(source.to?.total),
      ggr: normalizeOptionalNumber(source.ggr?.total),
      ngr: normalizeOptionalNumber(source.ngr?.total),
      bonusRate: normalizeOptionalNumber(source.bonusRate),
      sport: normalizeOptionalNumber(source.to?.sport),
      casino: normalizeOptionalNumber(source.to?.casino),
      slots: normalizeOptionalNumber(source.to?.slots),
      live: normalizeOptionalNumber(source.to?.liveCasino),
      instant: normalizeOptionalNumber(source.to?.instant),
      // Level 1 of sheet 365 — the authoritative Last Activity.
      lastActivityDate: normalizeBeingDateValue(source.lastActivityDate)
    };
  }


  function createReactivationClientFromWorkspace(client) {
    const p30 = reactivationPeriodFromBeingPerformance(client?.performance?.["30d"]);
    const p12 = reactivationPeriodFromBeingPerformance(client?.performance?.["12m"]);

    /*
      The client already carries a full 365 profile in Being, so the queue gets
      the real figures instead of the zeros this used to invent. Days inactive
      is left for normalizeReactivationClient to derive from Last Activity,
      which puts the row in its proper stage straight away.
    */
    return normalizeReactivationClient({
      clientId: String(client?.clientId ?? "").trim(),
      name: String(client?.name ?? "Name").trim() || "Name",
      daysInactive: null,
      lastActivityDate: p12.lastActivityDate || client?.activity?.lastClientActivity || "",
      reactivationStartedAt: getLocalTodayIso(),
      playing: "",
      performance: {
        "30d": p30,
        "12m": p12
      },
      calls: 0,
      emails: 0,
      quest: {
        name: String(client?.quest?.name ?? "")
      }
    });
  }

  function refreshReactivationMembershipViews(client) {
    renderClients(true);
    renderBeing();

    if (state.selectedClient?._key === client?._key) {
      renderProfile(client);
    }

    if (state.beingCardOpen && state.beingCardClientKey === client?._key) {
      renderBeingCard(client);
    }
  }

  async function addWorkspaceClientToReactivation(client) {
    const clientId = String(client?.clientId ?? "").trim();
    if (!clientId || isClientOnReactivation(clientId)) {
      if (client) refreshReactivationMembershipViews(client);
      return false;
    }

    const entry = createReactivationClientFromWorkspace(client);
    state.reactivationClients.push(entry);

    renderReactivation();
    refreshReactivationMembershipViews(client);

    try {
      await emitReactivationChange({
        action: "client:add",
        clientId,
        client: JSON.parse(JSON.stringify(entry))
      });
    } catch (error) {
      console.error("[Reactivation] client:add adapter failed; session entry kept:", error);
    }

    return true;
  }

  function getReactivationSortValue(client, key) {
    const name = String(key);

    if (name.startsWith("performance.12m.")) {
      const field = name.slice("performance.12m.".length);
      const raw = client?.performance?.["12m"]?.[field];
      return field === "bonusRate"
        ? getBonusRateRank(raw)
        : normalizeOptionalNumber(raw);
    }

    if (name === "lastActivityDate") {
      // Negated so "desc" reads newest first; a missing or unreadable date
      // is no value at all and sorts to the bottom either way.
      return client?.lastActivityDate
        ? normalizeOptionalNumber(-parseBeingDate(client.lastActivityDate))
        : null;
    }

    if (name === "reactivationNgr" || name === "depositAmount") {
      return normalizeOptionalNumber(client?.[name]);
    }

    return null;
  }

  /*
    Decorated once: the comparator used to recompute both sort values, dates
    included, on every comparison.
  */
  function sortReactivationClients(clients) {
    const direction = state.reactivationSortDirection === "desc" ? -1 : 1;
    const key = state.reactivationSortKey;

    return clients
      .map((client) => ({ client, value: getReactivationSortValue(client, key) }))
      .sort((a, b) => {
        if (a.value === null && b.value !== null) return 1;
        if (a.value !== null && b.value === null) return -1;
        if (a.value === null && b.value === null) {
          return String(a.client.clientId).localeCompare(String(b.client.clientId), undefined, { numeric: true });
        }

        if (a.value !== b.value) {
          return (a.value - b.value) * direction;
        }

        return String(a.client.clientId).localeCompare(
          String(b.client.clientId),
          undefined,
          { numeric: true, sensitivity: "base" }
        );
      })
      .map((item) => item.client);
  }

  function getReactivationFilteredClients() {
    const query = String(state.reactivationQuery || "").trim().toLocaleLowerCase();
    const stageFilter = state.reactivationStageFilter;

    // Narrow first, then order only what is left.
    const visible = state.reactivationClients.filter((client) => {
      const stageMatches = stageFilter === "all"
        || getReactivationStatus(client.daysInactive) === stageFilter;

      if (!stageMatches) return false;
      if (!query) return true;

      return `${client.clientId} ${client.name}`.toLocaleLowerCase().includes(query);
    });

    return sortReactivationClients(visible);
  }

  function setReactivationStageFilter(filter) {
    /*
      Built from the status list rather than typed out again: the hand-written
      copy went stale the moment Pre-Sleep was added, and an unlisted stage
      silently fell back to "all", which read as the chip throwing you to Total.
    */
    const validFilters = new Set(["all", ...Object.values(REACTIVATION_STATUS)]);

    state.reactivationStageFilter = validFilters.has(filter) ? filter : "all";
    renderReactivation();
  }

  function clearReactivationView() {
    state.reactivationQuery = "";
    state.reactivationStageFilter = "all";
    dom.reactivation.search.value = "";
    renderReactivation();
    dom.reactivation.search.focus();
  }

  function setReactivationSort(key) {
    if (!key) return;

    if (state.reactivationSortKey === key) {
      state.reactivationSortDirection =
        state.reactivationSortDirection === "asc" ? "desc" : "asc";
    } else {
      state.reactivationSortKey = key;
      state.reactivationSortDirection =
        key === "performance.12m.bonusRate" ? "asc" : "desc";
    }

    renderReactivation();
  }

  function renderReactivationSortControls() {
    const key = state.reactivationSortKey;
    const direction = state.reactivationSortDirection;

    dom.reactivation.sortButtons.forEach((button) => {
      const active = button.dataset.reactivationSort === key;
      button.classList.toggle("is-active", active);
      button.dataset.direction = active ? direction : "";
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

  }

  function renderReactivationViewControls(visibleCount, totalCount) {
    const viewIsFiltered = Boolean(String(state.reactivationQuery || "").trim())
      || state.reactivationStageFilter !== "all";

    dom.reactivation.stageFilters.forEach((button) => {
      const active = button.dataset.reactivationStageFilter === state.reactivationStageFilter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    dom.reactivation.visibleCount.textContent = viewIsFiltered
      ? `${formatInteger(visibleCount)} of ${formatInteger(totalCount)} visible`
      : `${formatInteger(visibleCount)} visible`;
    dom.reactivation.clearFilters.hidden = !viewIsFiltered;
  }

  function deriveReactivationPlaying(client) {
    const source = client?.performance?.["12m"] || {};
    const labels = {
      sport: "Sport",
      casino: "Casino",
      slots: "Slots",
      live: "Live",
      instant: "Instant"
    };

    let bestKey = "";
    let bestValue = -Infinity;

    Object.keys(labels).forEach((key) => {
      const value = normalizeNumber(source[key]);
      if (value > bestValue && value > 0) {
        bestValue = value;
        bestKey = key;
      }
    });

    return bestKey ? labels[bestKey] : String(client?.playing ?? "").trim() || "—";
  }

  /*
    Intentionally not wired up. Offers are assembled by hand in the BD / FB /
    TO Deposit / Quest editor; this is the template rule kept ready for the day
    that becomes automatic. Left in place on purpose, not overlooked.
  */
  function getReactivationOffer(brValue) {
    const br = normalizeNumber(brValue);

    if (br >= 0 && br <= 25) {
      return {
        name: "6.5% BD + 15% Deposit + Quest",
        rule: "BR 0–25 · 6.5% BD + deposit bonus 15% + quest.",
        research: false
      };
    }

    // The band runs from just above 25 to just below 60, so no BR between the
    // first and the last template falls through to Research Required.
    if (br > 25 && br < 60) {
      return {
        name: "2% BD + 10% Deposit + Quest Insurance",
        rule: "BR 25–60 · 2% BD + deposit bonus 10% + quest insurance.",
        research: false
      };
    }

    if (br >= 60) {
      return {
        name: "Quest Only Insurance",
        rule: "BR 60+ · quest insurance only.",
        research: false
      };
    }

    return {
      name: "Research Required",
      rule: "No automatic template is defined for this BR range.",
      research: true
    };
  }

  function compareReactivationContacts(a, b) {
    return `${b?.date || ""}T${b?.time || "00:00"}`
      .localeCompare(`${a?.date || ""}T${a?.time || "00:00"}`);
  }

  function getActiveReactivationContacts(client) {
    return (Array.isArray(client?.contactLog) ? client.contactLog : [])
      .filter((entry) => !entry.undone)
      .slice()
      .sort(compareReactivationContacts);
  }

  function getLastReactivationContact(client) {
    return getActiveReactivationContacts(client)[0] || null;
  }

  function getLastReactivationContactByType(client, type) {
    return getActiveReactivationContacts(client).find((entry) => entry.type === type) || null;
  }

  function formatReactivationLastContact(entry, fallbackDate = "") {
    if (!entry && fallbackDate) {
      return { title: `Last contact · ${formatBeingDate(fallbackDate)}`, meta: "Being" };
    }
    if (!entry) return { title: "No contact yet", meta: "—" };
    return {
      title: `${entry.type === "call" ? "Call" : "Email"} · ${formatBeingDate(entry.date)}`,
      meta: entry.time || "—"
    };
  }

  /*
    The compact stamp for the contact bar: MM/DD of the last contact plus its
    time when the entry carries one. A client whose only trace is the Being
    archive date has no time to show, so the bar shows the date alone.
  */
  function formatReactivationContactStamp(entry, fallbackDate = "") {
    const date = normalizeBeingDateValue(entry?.date) || normalizeBeingDateValue(fallbackDate);
    if (!date) return "\u2014";

    const [, month, day] = date.split("-");
    const stamp = `${month}/${day}`;
    const time = String(entry?.time ?? "").trim();
    return time ? `${stamp} \u00b7 ${time}` : stamp;
  }

  function getReactivationSummary() {

    const summary = {
      totalClients: 0, active: 0, catchUp: 0, callTwice: 0, preSleep: 0, sleeping: 0,
      deposits: 0, ngr: 0, contactsTotal: 0, calls: 0, emails: 0
    };

    state.reactivationClients.forEach((client) => {
      summary.totalClients += 1;

      const status = getReactivationStatus(client.daysInactive);
      if (status === REACTIVATION_STATUS.ACTIVE) summary.active += 1;
      if (status === REACTIVATION_STATUS.CATCH_UP) summary.catchUp += 1;
      if (status === REACTIVATION_STATUS.CALL_TWICE) summary.callTwice += 1;
      if (status === REACTIVATION_STATUS.PRE_SLEEP) summary.preSleep += 1;
      if (status === REACTIVATION_STATUS.SLEEPING) summary.sleeping += 1;
      summary.deposits += normalizeNumber(client?.depositAmount);
      summary.ngr += normalizeNumber(client?.reactivationNgr);
      summary.contactsTotal += Math.max(0, Math.floor(normalizeNumber(client.contactsTotal)));
      summary.calls += Math.max(0, Math.floor(normalizeNumber(client.calls)));
      summary.emails += Math.max(0, Math.floor(normalizeNumber(client.emails)));
    });

    return summary;
  }

  function getReactivationMailIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6.5h16v11H4zM4.5 7l7.5 6 7.5-6"
          fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
      </svg>
    `;
  }

  /*
    The undo arrow was the character U+21B6. It is better supported than the
    telephone glyph, but it is still a font's opinion of an icon sitting next
    to two drawn ones, at whatever weight that font happens to give it.
  */
  function getReactivationUndoIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8.5 7.5 5 11l3.5 3.5M5.4 11H14a4.6 4.6 0 0 1 0 9.2h-2.4"
          fill="none" stroke="currentColor" stroke-width="1.7"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  function getReactivationCallIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4.5l3 3-1.8 2.4c1.2 2.2 2.8 3.8 5 5l2.4-1.8 3 3-1.8 3c-.5.8-1.4 1.2-2.3 1-5.7-1.2-10-5.5-11.2-11.2-.2-.9.2-1.8 1-2.3L7 4.5Z"
          fill="none" stroke="currentColor" stroke-width="1.55"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  function createReactivationTextCell(text, className) {
    const cell = document.createElement("div");
    cell.className = className;
    cell.textContent = text;
    return cell;
  }

  function createReactivationRow(client) {
    const row = document.createElement("div");
    row.className = "reactivation-row";
    row.dataset.clientId = client.clientId;

    const period12m = client.performance?.["12m"] || {};
    const status = getReactivationStatus(client.daysInactive);
    row.dataset.stage = status;
    const pending = state.reactivationContactPending.has(String(client.clientId));
    const activeContacts = getActiveReactivationContacts(client);
    const lastEntry = activeContacts[0] || null;
    const lastEmail = activeContacts.find((entry) => entry.type === "email") || null;
    const lastCall = activeContacts.find((entry) => entry.type === "call") || null;
    const last = formatReactivationLastContact(lastEntry, client.lastContactDate);
    const clientCell = document.createElement("button");
    clientCell.type = "button";
    clientCell.className = "reactivation-client-cell reactivation-client-open";
    clientCell.dataset.reactivationOpen = "true";
    clientCell.setAttribute("aria-label", `Open Reactivation card for ${client.name}`);

    const name = document.createElement("span");
    name.className = "reactivation-client-name";
    name.textContent = client.name;

    const id = document.createElement("span");
    id.className = "reactivation-client-id";
    id.textContent = client.clientId;

    clientCell.append(name, id);

    const stage = document.createElement("div");
    stage.className = `reactivation-stage reactivation-stage--${status}`;

    const stageText = document.createElement("span");
    stageText.textContent = REACTIVATION_STATUS_LABELS[status] || "—";
    stage.appendChild(stageText);

    const contacts = document.createElement("div");
    contacts.className = "reactivation-contact-actions";

    const email = document.createElement("button");
    email.type = "button";
    email.className = "reactivation-contact-button";
    email.dataset.reactivationContact = "email";
    email.title = "Email";
    email.setAttribute("aria-label", `Add email contact for ${client.name}`);
    email.innerHTML = `${getReactivationMailIcon()}<strong>${formatInteger(client.emails)}</strong>`;
    email.disabled = pending;

    const call = document.createElement("button");
    call.type = "button";
    call.className = "reactivation-contact-button";
    call.dataset.reactivationContact = "call";
    call.title = "Call";
    call.setAttribute("aria-label", `Add call contact for ${client.name}`);
    call.innerHTML = `${getReactivationCallIcon()}<strong>${formatInteger(client.calls)}</strong>`;
    call.disabled = pending;

    const emailUndo = document.createElement("button");
    emailUndo.type = "button";
    emailUndo.className = "reactivation-contact-undo reactivation-contact-undo--type";
    emailUndo.dataset.reactivationUndoType = "email";
    emailUndo.innerHTML = getReactivationUndoIcon();
    emailUndo.title = "Undo latest mail";
    emailUndo.setAttribute("aria-label", `Undo latest mail for ${client.name}`);
    emailUndo.hidden = !lastEmail;
    emailUndo.disabled = pending;

    const callUndo = document.createElement("button");
    callUndo.type = "button";
    callUndo.className = "reactivation-contact-undo reactivation-contact-undo--type";
    callUndo.dataset.reactivationUndoType = "call";
    callUndo.innerHTML = getReactivationUndoIcon();
    callUndo.title = "Undo latest call";
    callUndo.setAttribute("aria-label", `Undo latest call for ${client.name}`);
    callUndo.hidden = !lastCall;
    callUndo.disabled = pending;

    contacts.append(email, emailUndo, call, callUndo);

    const lastCell = document.createElement("div");
    lastCell.className = "reactivation-last-contact";
    lastCell.dataset.contactType = lastEntry?.type || (client.lastContactDate ? "archive" : "none");

    const lastTitle = document.createElement("strong");
    lastTitle.textContent = last.title;
    const lastMeta = document.createElement("span");
    lastMeta.textContent = last.meta;
    lastCell.append(lastTitle, lastMeta);

    row.append(
      clientCell,
      stage,
      createReactivationTextCell(formatBeingDate(client.lastActivityDate), "reactivation-last-activity"),
      createReactivationTextCell(deriveReactivationPlaying(client), "reactivation-playing"),
      createReactivationTextCell(formatOptionalMoney(period12m.to), "reactivation-money"),
      createReactivationTextCell(formatOptionalMoney(period12m.ggr), "reactivation-money"),
      createReactivationTextCell(formatOptionalMoney(period12m.ngr), "reactivation-money"),
      createReactivationTextCell(formatOptionalRate(period12m.bonusRate), "reactivation-rate"),
      createReactivationTextCell(formatOptionalMoney(period12m.sport), "reactivation-money reactivation-money--split"),
      createReactivationTextCell(formatOptionalMoney(period12m.casino), "reactivation-money reactivation-money--split"),
      createReactivationTextCell(formatOptionalMoney(period12m.slots), "reactivation-money reactivation-money--split"),
      createReactivationTextCell(formatOptionalMoney(period12m.live), "reactivation-money reactivation-money--split"),
      createReactivationTextCell(formatOptionalMoney(period12m.instant), "reactivation-money reactivation-money--split"),
      contacts,
      lastCell
    );

    return row;
  }

  function renderReactivation() {
    const summary = getReactivationSummary();
    renderReactivationSortControls();

    dom.reactivation.count.textContent = `${formatInteger(summary.totalClients)} ${summary.totalClients === 1 ? "client" : "clients"}`;
    dom.reactivation.totalClients.textContent = formatInteger(summary.totalClients);
    dom.reactivation.activeCount.textContent = formatInteger(summary.active);
    dom.reactivation.catchUpCount.textContent = formatInteger(summary.catchUp);
    dom.reactivation.callTwiceCount.textContent = formatInteger(summary.callTwice);
    dom.reactivation.preSleepCount.textContent = formatInteger(summary.preSleep);
    dom.reactivation.sleepingCount.textContent = formatInteger(summary.sleeping);
    dom.reactivation.totalDeposits.textContent = formatMoney(summary.deposits);
    dom.reactivation.totalNgr.textContent = formatMoney(summary.ngr);
    dom.reactivation.contactsTotal.textContent = formatInteger(summary.contactsTotal);
    dom.reactivation.callsCount.textContent = formatInteger(summary.calls);
    dom.reactivation.emailsCount.textContent = formatInteger(summary.emails);

    const clients = getReactivationFilteredClients();
    renderReactivationViewControls(clients.length, summary.totalClients);
    const fragment = document.createDocumentFragment();
    clients.forEach((client) => fragment.appendChild(createReactivationRow(client)));

    dom.reactivation.rows.replaceChildren(fragment);
    dom.reactivation.empty.hidden = clients.length !== 0;
  }

  function getReactivationClient(clientId) {
    const id = String(clientId ?? "");
    return state.reactivationClients.find((client) => String(client.clientId) === id) || null;
  }

  function getReactivationLocalDateTime() {
    const now = new Date();
    return {
      date: getLocalTodayIso(),
      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    };
  }

  function createReactivationContact(type, options = {}) {
    const fallback = getReactivationLocalDateTime();
    const time = /^\d{2}:\d{2}$/.test(String(options.time ?? "")) ? String(options.time) : fallback.time;

    state.reactivationActionSequence += 1;

    return {
      id: `react-${Date.now()}-${state.reactivationActionSequence}`,
      type: type === "call" ? "call" : "email",
      date: normalizeBeingDateValue(options.date) || fallback.date,
      time,
      undone: false
    };
  }

  async function addReactivationContact(clientId, type, options = {}) {
    const client = getReactivationClient(clientId);
    if (!client || state.reactivationContactPending.has(String(clientId))) return;

    const entry = createReactivationContact(type, options);
    const previous = {
      calls: client.calls,
      emails: client.emails,
      contactsTotal: client.contactsTotal
    };
    client.contactLog.push(entry);

    if (entry.type === "call") client.calls += 1;
    else client.emails += 1;
    client.contactsTotal += 1;
    state.reactivationContactPending.add(String(clientId));


    renderReactivation();
    if (state.reactivationCardOpen) renderReactivationCard(client);

    try {
      const result = await emitReactivationChange({
        action: "contact:add",
        clientId: client.clientId,
        type: entry.type,
        entry: { ...entry },
        counters: { calls: client.calls, emails: client.emails, total: client.contactsTotal }
      });

      if (result?.counters) {
        client.calls = Math.max(0, Math.floor(normalizeNumber(result.counters.calls)));
        client.emails = Math.max(0, Math.floor(normalizeNumber(result.counters.emails)));
        client.contactsTotal = Math.max(0, Math.floor(normalizeNumber(result.counters.total)));
      }
      if (state.reactivationCardOpen) {
        dom.reactivation.card.sourceState.textContent =
          state.reactivationChangeHandler ? "Saved by source adapter" : "Archive hook ready";
      }
    } catch (error) {
      const index = client.contactLog.findIndex((item) => item.id === entry.id);
      if (index !== -1) client.contactLog.splice(index, 1);
      client.calls = previous.calls;
      client.emails = previous.emails;
      client.contactsTotal = previous.contactsTotal;
      console.error("[Reactivation] contact:add adapter failed:", error);
      if (state.reactivationCardOpen) dom.reactivation.card.sourceState.textContent = "Contact was not saved";
    } finally {
      state.reactivationContactPending.delete(String(clientId));
      renderReactivation();
      if (state.reactivationCardOpen && state.reactivationSelectedId === String(clientId)) {
        renderReactivationCard(client);
      }
    }
  }

  async function undoReactivationContact(clientId, entryId = null) {
    const client = getReactivationClient(clientId);
    if (!client || state.reactivationContactPending.has(String(clientId))) return;

    const target = entryId
      ? client.contactLog.find((entry) => entry.id === entryId)
      : getLastReactivationContact(client);

    if (!target) return;

    const targetIndex = client.contactLog.findIndex((entry) => entry.id === target.id);
    const previous = {
      calls: client.calls,
      emails: client.emails,
      contactsTotal: client.contactsTotal
    };
    client.contactLog.splice(targetIndex, 1);
    if (target.type === "call") client.calls = Math.max(0, client.calls - 1);
    else client.emails = Math.max(0, client.emails - 1);
    client.contactsTotal = Math.max(0, client.contactsTotal - 1);
    state.reactivationContactPending.add(String(clientId));


    renderReactivation();
    if (state.reactivationCardOpen) renderReactivationCard(client);

    try {
      const result = await emitReactivationChange({
        action: "contact:undo",
        clientId: client.clientId,
        type: target.type,
        entryId: target.id,
        counters: { calls: client.calls, emails: client.emails, total: client.contactsTotal }
      });

      if (result?.counters) {
        client.calls = Math.max(0, Math.floor(normalizeNumber(result.counters.calls)));
        client.emails = Math.max(0, Math.floor(normalizeNumber(result.counters.emails)));
        client.contactsTotal = Math.max(0, Math.floor(normalizeNumber(result.counters.total)));
      }
      if (state.reactivationCardOpen) {
        dom.reactivation.card.sourceState.textContent =
          state.reactivationChangeHandler ? "Undo saved by source adapter" : "Archive hook ready";
      }
    } catch (error) {
      client.contactLog.splice(targetIndex, 0, target);
      client.calls = previous.calls;
      client.emails = previous.emails;
      client.contactsTotal = previous.contactsTotal;
      console.error("[Reactivation] contact:undo adapter failed:", error);
      if (state.reactivationCardOpen) dom.reactivation.card.sourceState.textContent = "Undo was not saved";
    } finally {
      state.reactivationContactPending.delete(String(clientId));
      renderReactivation();
      if (state.reactivationCardOpen && state.reactivationSelectedId === String(clientId)) {
        renderReactivationCard(client);
      }
    }
  }

  function openReactivationBonusHistory() {
    const reactivationClient = getReactivationClient(state.reactivationSelectedId);
    const client = reactivationClient ? findWorkspaceClient(reactivationClient) : null;
    if (!client) return;
    openBonusHistory(client, dom.reactivation.card.bonusHistoryOpen);
  }

  function renderReactivationStatistics(client) {
    const periodKey = state.reactivationStatsPeriod === "12m" ? "12m" : "30d";
    const period = client.performance?.[periodKey] || {};

    dom.reactivation.card.statsPeriodButtons.forEach((button) => {
      const active = button.dataset.reactivationStatsPeriod === periodKey;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    dom.reactivation.card.statsLastActivity.textContent = formatBeingDate(
      period.lastActivityDate || client.lastActivityDate
    );
    dom.reactivation.card.statsTo.textContent = formatOptionalMoney(period.to);
    dom.reactivation.card.statsGgr.textContent = formatOptionalMoney(period.ggr);
    dom.reactivation.card.statsNgr.textContent = formatOptionalMoney(period.ngr);
    dom.reactivation.card.statsBr.textContent = formatOptionalRate(period.bonusRate);
    dom.reactivation.card.statsSportGgr.textContent = formatOptionalMoney(period.ggrSport);
    dom.reactivation.card.statsCasinoGgr.textContent = formatOptionalMoney(period.ggrCasino);
    dom.reactivation.card.statsDeposits.textContent = formatOptionalMoney(period.deposits);
    dom.reactivation.card.statsWithdrawals.textContent = formatOptionalMoney(period.withdrawals);
    dom.reactivation.card.statsNetLoss.textContent = formatOptionalMoney(period.netLoss);
    // Slots, Instant and Live carry turnover only: sheet 365 has no GGR or NGR
    // split for them, so those rows were a pair of permanent dashes.
    dom.reactivation.card.statsSlotsTo.textContent = formatOptionalMoney(period.slots);
    dom.reactivation.card.statsInstantTo.textContent = formatOptionalMoney(period.instant);
    dom.reactivation.card.statsLiveTo.textContent = formatOptionalMoney(period.live);
  }

  function renderReactivationCard(client) {
    const period12m = client.performance?.["12m"] || {};
    const questName = client.quest.name.trim();
    const workspaceClient = findWorkspaceClient(client);
    const questTracking = calculateQuestProgress(workspaceClient || client, client.quest);
    const progress = questTracking.percent ?? 0;
    const currentOfferText = String(client.offerText ?? "").trim();
    const lastAction = getLastReactivationContact(client);
    const contactPending = state.reactivationContactPending.has(String(client.clientId));

    dom.reactivation.card.name.textContent = client.name;
    dom.reactivation.card.name.disabled = !workspaceClient;
    dom.reactivation.card.name.title = workspaceClient
      ? `Open ${client.name} in Being`
      : "This ID is not available in Being";
    dom.reactivation.card.clientId.textContent = `ID: ${client.clientId}`;
    dom.reactivation.card.stage.textContent = client.daysInactive === null
      ? "Stage unavailable"
      : getReactivationStatusLabel(client.daysInactive);
    // Carries the same colour as the row the card was opened from.
    dom.reactivation.card.stage.dataset.stage = getReactivationStatus(client.daysInactive);

    // Offered only for the client this card was actually reached from.
    dom.reactivation.card.backToBeing.hidden = !(
      state.beingReactivationOrigin &&
      String(state.beingReactivationOrigin.clientId) === String(client.clientId)
    );

    dom.reactivation.card.playing.textContent = deriveReactivationPlaying(client);
    dom.reactivation.card.started.textContent = formatBeingDate(client.reactivationStartedAt);
    dom.reactivation.card.lastActivity.textContent = formatBeingDate(client.lastActivityDate);
    dom.reactivation.card.period12mTo.textContent = formatOptionalMoney(period12m.to);
    dom.reactivation.card.period12mGgr.textContent = formatOptionalMoney(period12m.ggr);
    dom.reactivation.card.period12mNgr.textContent = formatOptionalMoney(period12m.ngr);
    dom.reactivation.card.period12mBr.textContent = formatOptionalRate(period12m.bonusRate);
    dom.reactivation.card.ngrTotal.textContent = formatOptionalMoney(client.reactivationNgr);
    dom.reactivation.card.depositsTotal.textContent = formatOptionalMoney(client.depositAmount);
    dom.reactivation.card.contactsTotal.textContent = formatInteger(client.contactsTotal);

    renderReactivationStatistics(client);

    dom.reactivation.card.period12mSport.textContent = formatOptionalMoney(period12m.sport);
    dom.reactivation.card.period12mCasino.textContent = formatOptionalMoney(period12m.casino);
    dom.reactivation.card.period12mSlots.textContent = formatOptionalMoney(period12m.slots);
    dom.reactivation.card.period12mLive.textContent = formatOptionalMoney(period12m.live);
    dom.reactivation.card.period12mInstant.textContent = formatOptionalMoney(period12m.instant);

    dom.reactivation.card.questName.textContent = questName || "No Active Quest";
    dom.reactivation.card.questProgress.textContent = questTracking.percent === null
      ? "—"
      : `${formatNumber(progress)}%`;
    dom.reactivation.card.questFill.style.width = `${progress}%`;
    dom.reactivation.card.questOpen.disabled = !workspaceClient;
    dom.reactivation.card.questOpen.title = workspaceClient
      ? `Open Current Quest for ${client.name}`
      : "This client is not available in Clients data";

    dom.reactivation.card.offerName.textContent = currentOfferText || "No offer saved";
    dom.reactivation.card.offerRule.textContent = currentOfferText
      ? `${client.currentSheetName || "Newest since sheet"} · Offer`
      : "Open Offer in the Reactivation menu.";

    dom.reactivation.card.emailCount.textContent = formatInteger(client.emails);
    dom.reactivation.card.callCount.textContent = formatInteger(client.calls);
    dom.reactivation.card.contactTotal.textContent = formatInteger(client.contactsTotal);
    dom.reactivation.card.contactLast.textContent = formatReactivationContactStamp(
      lastAction,
      client.lastContactDate
    );
    dom.reactivation.card.email.disabled = contactPending;
    dom.reactivation.card.call.disabled = contactPending;
    dom.reactivation.card.contactUndo.hidden = !lastAction;
    dom.reactivation.card.contactUndo.disabled = contactPending || !lastAction;
    dom.reactivation.card.contactUndo.textContent = lastAction
      ? `Undo ${lastAction.type === "call" ? "Call" : "Mail"}`
      : "Undo";
    dom.reactivation.card.bonusHistoryOpen.disabled = !workspaceClient;
    dom.reactivation.card.bonusHistoryOpen.title = workspaceClient
      ? `Open Bonus History for ${client.name}`
      : "This client is not available in Clients data";

    renderReactivationWorkPanel(client);
  }

  function openReactivationCard(clientId, returnFocus = null) {
    const client = getReactivationClient(clientId);
    if (!client) return;

    state.reactivationSelectedId = String(client.clientId);
    state.reactivationCardOpen = true;
    state.reactivationStatsPeriod = "30d";
    state.reactivationCardReturnFocus = returnFocus || document.activeElement;

    const now = getReactivationLocalDateTime();
    dom.reactivation.card.contactDate.value = now.date;
    dom.reactivation.card.contactTime.value = now.time;
    dom.reactivation.card.sourceState.textContent =
      state.reactivationChangeHandler ? "Online source adapter connected" : "Archive hook ready";

    state.reactivationWorkRenderedId = null;
    state.reactivationWorkTool = "notes";
    state.reactivationOfferDirty = false;
    renderReactivationCard(client);

    dom.reactivation.card.overlay.classList.add("is-open");
    dom.reactivation.card.overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-reactivation-card-open");
    if ("inert" in dom.app) dom.app.inert = true;

    window.requestAnimationFrame(() => dom.reactivation.card.close.focus({ preventScroll: true }));
  }

  function closeReactivationCard({ restoreFocus = true } = {}) {
    if (!state.reactivationCardOpen) return;

    const target = state.reactivationCardReturnFocus;
    state.reactivationCardOpen = false;
    state.reactivationWorkRenderedId = null;
    state.reactivationWorkTool = "notes";
    state.reactivationOfferDirty = false;
    state.reactivationSelectedId = null;
    state.reactivationCardReturnFocus = null;

    dom.reactivation.card.overlay.classList.remove("is-open");
    dom.reactivation.card.overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-reactivation-card-open");
    if ("inert" in dom.app) dom.app.inert = false;

    if (restoreFocus && target?.isConnected) {
      window.requestAnimationFrame(() => target.focus?.({ preventScroll: true }));
    }
  }

  function formatBeingDate(value) {
    const normalized = normalizeBeingDateValue(value);
    if (!normalized) return "—";

    const [year, month, day] = normalized.split("-");
    return `${day}.${month}.${year}`;
  }

  function parseBeingNotes(value) {
    const text = String(value ?? "").trim();
    if (!text) return [];

    const entries = [];
    let current = null;

    text.split(/\r?\n/).forEach((line) => {
      // New persisted format in Being_Archive / Notes: YYYY-MM-DD: text.
      // The bracketed variant remains readable for notes saved by v1.5.4.24.
      const match = line.match(/^(?:\[(\d{4}-\d{2}-\d{2})\]|(\d{4}-\d{2}-\d{2}))\s*:?\s*(.*)$/);

      if (match) {
        current = {
          date: normalizeBeingDateValue(match[1] || match[2]),
          text: String(match[3] ?? "").trim()
        };
        if (current.text) entries.push(current);
        return;
      }

      // Only indented lines are a continuation of the dated note above.
      // A regular line is an older independent Notes entry and stays undated.
      if (current && /^\s+/.test(line) && line.trim()) {
        current.text = `${current.text} ${line.trim()}`.trim();
      } else if (line.trim()) {
        // Old Notes text has no date. Never invent one from Last Contact.
        entries.push({
          date: "",
          text: line.trim()
        });
      }
    });

    return entries
      .filter((entry) => entry.text)
      .sort((a, b) => {
        if (a.date && b.date) return String(b.date).localeCompare(String(a.date));
        if (a.date) return -1;
        if (b.date) return 1;
        return 0;
      });
  }

  function serializeBeingNotes(entries) {
    return (Array.isArray(entries) ? entries : [])
      .filter((entry) => String(entry?.text ?? "").trim())
      .sort((a, b) => {
        const aDate = normalizeBeingDateValue(a?.date);
        const bDate = normalizeBeingDateValue(b?.date);
        if (aDate && bDate) return bDate.localeCompare(aDate);
        if (aDate) return -1;
        if (bDate) return 1;
        return 0;
      })
      .map((entry) => {
        const date = normalizeBeingDateValue(entry?.date);
        const text = String(entry?.text ?? "")
          .replace(/\s+/g, " ")
          .trim();
        return date ? `${date}: ${text}` : text;
      })
      .join("\n");
  }

  /*
    Parsing the Notes cell is a regex pass plus a sort, and the Being list
    asked for it once per row on every render. The parse only changes when
    the cell text does, so the last result is kept per client and handed out
    as a copy: the composer edits the array it gets back.
  */
  const beingNotesCache = new Map();

  function getBeingNotes(client) {
    const key = client?._key;
    const note = String(client?.being?.note ?? "");
    if (!key) return parseBeingNotes(note);

    const cached = beingNotesCache.get(key);
    if (cached && cached.note === note) return cached.entries.slice();

    const entries = parseBeingNotes(note);
    beingNotesCache.set(key, { note, entries });
    return entries.slice();
  }

  function applySevenNoteViewport(list, entryCount) {
    if (!list) return;

    const previousFrame = Number(list.dataset.noteLimitFrame || 0);
    if (previousFrame) window.cancelAnimationFrame(previousFrame);

    const shouldScroll = Number(entryCount) > 7;
    list.classList.toggle("is-note-scroll-limited", shouldScroll);
    list.style.removeProperty("--note-seven-height");
    list.scrollTop = 0;

    if (!shouldScroll) {
      delete list.dataset.noteLimitFrame;
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const firstSeven = Array.from(
        list.querySelectorAll(".being-note-item, .reactivation-comm-item")
      ).slice(0, 7);
      const rowGap = Number.parseFloat(window.getComputedStyle(list).rowGap) || 0;
      const visibleHeight = firstSeven.reduce(
        (total, item) => total + item.getBoundingClientRect().height,
        rowGap * Math.max(0, firstSeven.length - 1)
      );

      list.style.setProperty("--note-seven-height", `${Math.ceil(visibleHeight)}px`);
      delete list.dataset.noteLimitFrame;
    });

    list.dataset.noteLimitFrame = String(frame);
  }

  function parseReactivationOffer(value) {
    const raw = String(value ?? "").trim();
    const result = { bd: "", fb: "", toDeposit: "", quest: "", raw };
    if (!raw) return result;

    raw.split(";").forEach((part) => {
      const match = part.match(/^\s*([^:]+)\s*:\s*(.*?)\s*$/);
      if (!match) return;
      const key = match[1].toLowerCase().replace(/\s+/g, " ").trim();
      const valueText = match[2] === "-" ? "" : match[2];
      if (key === "bd") result.bd = valueText;
      if (key === "fb") result.fb = valueText;
      if (key === "to deposit" || key === "1% to deposit") result.toDeposit = valueText;
      if (key === "quest") result.quest = valueText;
    });

    return result;
  }

  function serializeReactivationOffer() {
    const field = (value) => String(value ?? "").trim() || "-";
    return [
      `BD: ${field(dom.reactivation.card.offerBd.value)}`,
      `FB: ${field(dom.reactivation.card.offerFb.value)}`,
      `TO Deposit: ${field(dom.reactivation.card.offerToDeposit.value)}`,
      `Quest: ${field(dom.reactivation.card.offerQuest.value)}`
    ].join("; ");
  }

  function serializeReactivationCommEntries(entries) {
    return (Array.isArray(entries) ? entries : [])
      .filter((entry) => String(entry?.text ?? "").trim())
      .slice()
      .sort(compareReactivationNotes)
      .map((entry) => {
        const date = normalizeBeingDateValue(entry?.date) || getLocalTodayIso();
        const text = String(entry?.text ?? "").trim().replace(/\r?\n/g, "\n  ");
        return `${date}: ${text}`;
      })
      .join("\n");
  }

  function getReactivationNotes(client) {
    return (Array.isArray(client?.reactivationNotes) ? client.reactivationNotes : [])
      .map((entry, sourceIndex) => ({ ...entry, sourceIndex }))
      .filter((entry) => entry.text)
      .sort(compareReactivationNotes);
  }

  function getCurrentReactivationNotes(client) {
    return getReactivationNotes(client).filter((entry) => entry.isCurrent);
  }

  function getHistoricalReactivationNotes(client) {
    const seen = new Set();
    return getReactivationNotes(client).filter((entry) => {
      if (entry.isCurrent) return false;
      const key = [entry.sheetName, entry.date, entry.text]
        .map((value) => String(value ?? "").trim().toLowerCase())
        .join("\u0000");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /*
    Current notes and the history differ only in the modifier class, the
    delete button and the empty-state line, so one builder serves both.
  */
  function buildReactivationNoteList(entries, { history = false } = {}) {
    const fragment = document.createDocumentFragment();

    entries.forEach((entry) => {
      const item = document.createElement("article");
      item.className = history
        ? "reactivation-comm-item reactivation-comm-item--history"
        : "reactivation-comm-item";

      const body = document.createElement("div");
      body.className = "reactivation-comm-item__body";

      const text = document.createElement("strong");
      text.textContent = entry.text;

      const meta = document.createElement("span");
      meta.textContent = `${formatBeingDate(entry.date)} · ${entry.sheetName || "since"}`;

      body.append(text, meta);
      item.appendChild(body);

      if (!history) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.dataset.reactivationNoteDelete = String(entry.sourceIndex);
        remove.setAttribute("aria-label", `Delete Reactivation note from ${formatBeingDate(entry.date)}`);
        remove.textContent = "×";
        item.appendChild(remove);
      }

      fragment.appendChild(item);
    });

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "reactivation-comm-empty";
      empty.textContent = history
        ? "No notes in previous since sheets"
        : "No notes in the current since sheet";
      fragment.appendChild(empty);
    }

    return fragment;
  }

  function renderReactivationNotes(client) {
    const entries = getCurrentReactivationNotes(client);
    dom.reactivation.card.notesCount.textContent = formatInteger(entries.length);
    dom.reactivation.card.noteList.replaceChildren(buildReactivationNoteList(entries));
    applySevenNoteViewport(dom.reactivation.card.noteList, entries.length);
  }

  function renderReactivationNoteHistory(client) {
    const entries = getHistoricalReactivationNotes(client);
    dom.reactivation.card.noteHistoryList.replaceChildren(
      buildReactivationNoteList(entries, { history: true })
    );
  }

  async function commitReactivationComm(client, currentEntries, statusText) {
    const historical = client.reactivationNotes.filter((entry) => !entry.isCurrent);
    const nextCurrent = currentEntries.map((entry, index) => normalizeReactivationNote({
      ...entry,
      id: `${client.currentSheetName || "current"}-${Date.now()}-${index}`,
      sheetName: client.currentSheetName,
      isCurrent: true
    }, index));
    const value = serializeReactivationCommEntries(nextCurrent);
    const previous = {
      currentCommText: client.currentCommText,
      notes: client.reactivationNotes.slice(),
      offerText: client.offerText
    };

    client.currentCommText = value;
    client.reactivationNotes = historical.concat(nextCurrent).sort(compareReactivationNotes);
    renderReactivationNotes(client);
    renderReactivation();

    try {
      const result = await emitReactivationChange({
        action: "comm:update",
        clientId: client.clientId,
        value
      });
      client.currentCommText = String(result?.value ?? value);
      dom.reactivation.card.noteStatus.textContent = statusText || "Saved in current since sheet · COMM";
      return true;
    } catch (error) {
      client.currentCommText = previous.currentCommText;
      client.reactivationNotes = previous.notes;
      client.offerText = previous.offerText;
      renderReactivationNotes(client);
      renderReactivation();
      dom.reactivation.card.noteStatus.textContent = "Not saved · Reactivation Comm unchanged";
      console.error("[Reactivation] Comm save failed:", error);
      return false;
    }
  }

  async function saveReactivationNote() {
    const client = getReactivationClient(state.reactivationSelectedId);
    const text = String(dom.reactivation.card.noteText.value ?? "").trim();
    if (!client || !text || state.reactivationNotePending) {
      if (!text) dom.reactivation.card.noteText.focus({ preventScroll: true });
      return false;
    }

    const current = client.reactivationNotes.filter((entry) => entry.isCurrent);
    current.unshift({
      date: normalizeBeingDateValue(dom.reactivation.card.noteDate.value) || getLocalTodayIso(),
      text,
      sheetName: client.currentSheetName,
      isCurrent: true
    });

    state.reactivationNotePending = true;
    dom.reactivation.card.noteSave.disabled = true;
    dom.reactivation.card.noteStatus.textContent = "Saving to current since sheet…";
    const saved = await commitReactivationComm(client, current, "Saved in current since sheet · COMM");
    if (saved) dom.reactivation.card.noteText.value = "";
    state.reactivationNotePending = false;
    dom.reactivation.card.noteSave.disabled = false;
    return saved;
  }

  async function deleteReactivationNote(sourceIndex) {
    const client = getReactivationClient(state.reactivationSelectedId);
    const target = client?.reactivationNotes?.[sourceIndex];
    if (!client || !target?.isCurrent || state.reactivationNotePending) return false;

    const current = client.reactivationNotes.filter((entry, index) => entry.isCurrent && index !== sourceIndex);
    state.reactivationNotePending = true;
    dom.reactivation.card.noteStatus.textContent = "Removing from current since sheet…";
    const saved = await commitReactivationComm(client, current, "Note removed from current since sheet");
    state.reactivationNotePending = false;
    return saved;
  }

  function setReactivationWorkTool(nextTool, { toggle = true, focus = false } = {}) {
    const allowed = new Set(["notes", "offer", "history"]);
    const requested = allowed.has(nextTool) ? nextTool : "notes";
    const active = toggle && state.reactivationWorkTool === requested && requested !== "notes"
      ? "notes"
      : requested;
    state.reactivationWorkTool = active;

    const controls = [
      ["notes", dom.reactivation.card.toolNotes, dom.reactivation.card.notesPanel],
      ["offer", dom.reactivation.card.toolOffer, dom.reactivation.card.offerPanel],
      ["history", dom.reactivation.card.toolHistory, dom.reactivation.card.noteHistoryPanel]
    ];

    controls.forEach(([tool, button, panel]) => {
      const selected = tool === active;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-expanded", String(selected));
      panel.hidden = !selected;
    });

    if (!focus) return;
    window.requestAnimationFrame(() => {
      const target = active === "offer"
        ? dom.reactivation.card.offerBd
        : active === "notes"
          ? dom.reactivation.card.noteText
          : dom.reactivation.card.noteHistoryList.querySelector("article");
      target?.focus?.({ preventScroll: true });
    });
  }

  function renderReactivationWorkPanel(client, { force = false } = {}) {
    const id = String(client?.clientId ?? "");
    const changedClient = state.reactivationWorkRenderedId !== id;
    const offer = parseReactivationOffer(client?.offerText);


    if (force || changedClient || !state.reactivationOfferDirty) {
      dom.reactivation.card.offerBd.value = offer.bd;
      dom.reactivation.card.offerFb.value = offer.fb;
      dom.reactivation.card.offerToDeposit.value = offer.toDeposit;
      dom.reactivation.card.offerQuest.value = offer.quest;
      const parsedAnything = Boolean(offer.bd || offer.fb || offer.toDeposit || offer.quest);
      dom.reactivation.card.offerCurrent.hidden = !offer.raw || parsedAnything;
      dom.reactivation.card.offerCurrent.textContent = offer.raw ? `Current: ${offer.raw}` : "";
      dom.reactivation.card.offerStatus.textContent = "Ready";
      state.reactivationOfferDirty = false;
    }

    if (force || changedClient) {
      dom.reactivation.card.noteDate.value = getLocalTodayIso();
      dom.reactivation.card.noteText.value = "";
      dom.reactivation.card.noteStatus.textContent = `${client.currentSheetName || "Current since sheet"} · COMM only`;
    }

    renderReactivationNotes(client);
    renderReactivationNoteHistory(client);
    if (changedClient) setReactivationWorkTool("notes", { toggle: false });
    state.reactivationWorkRenderedId = id;
  }

  async function saveReactivationOffer() {
    const client = getReactivationClient(state.reactivationSelectedId);
    if (!client || state.reactivationNotePending) return false;

    /*
      The Offer Decision is a plan, not a contact note, so it is written to the
      PLAN column and no longer joins the COMM thread.
    */
    const value = serializeReactivationOffer();
    const previousOffer = client.offerText;

    state.reactivationNotePending = true;
    dom.reactivation.card.offerSave.disabled = true;
    dom.reactivation.card.offerStatus.textContent = "Saving Offer…";

    client.offerText = value;
    renderReactivation();

    try {
      const result = await emitReactivationChange({
        action: "plan:update",
        clientId: client.clientId,
        value
      });

      client.offerText = String(result?.value ?? value);
      state.reactivationOfferDirty = false;
      renderReactivationCard(client);
      dom.reactivation.card.offerCurrent.hidden = true;
      dom.reactivation.card.offerStatus.textContent = "Offer saved · PLAN";
      return true;
    } catch (error) {
      client.offerText = previousOffer;
      renderReactivation();
      renderReactivationCard(client);
      dom.reactivation.card.offerStatus.textContent = "Not saved · PLAN unchanged";
      console.error("[Reactivation] Offer save failed:", error);
      return false;
    } finally {
      state.reactivationNotePending = false;
      dom.reactivation.card.offerSave.disabled = false;
    }
  }

  function resetBeingNoteComposer() {
    state.beingNoteEditIndex = -1;
    dom.being.card.noteDate.value = getLocalTodayIso();
    dom.being.card.noteText.value = "";
    dom.being.card.noteSave.textContent = "Add";
    dom.being.card.noteCancel.hidden = true;
  }

  function setBeingNoteComposer(entry, index) {
    state.beingNoteEditIndex = index;
    dom.being.card.noteDate.value = normalizeBeingDateValue(entry?.date) || getLocalTodayIso();
    dom.being.card.noteText.value = String(entry?.text ?? "");
    dom.being.card.noteSave.textContent = "Save";
    dom.being.card.noteCancel.hidden = false;
    dom.being.card.noteText.focus({ preventScroll: true });
    dom.being.card.noteText.select();
  }

  function renderBeingNotes(client) {
    const entries = getBeingNotes(client);
    const fragment = document.createDocumentFragment();

    entries.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "being-note-item";
      item.classList.toggle("is-undated", !entry.date);

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "being-note-item__edit";
      edit.dataset.beingNoteEdit = String(index);
      edit.setAttribute("aria-label", entry.date ? `Edit note from ${formatBeingDate(entry.date)}` : "Edit note");

      const copy = document.createElement("strong");
      copy.textContent = entry.text;
      if (entry.date) {
        const date = document.createElement("span");
        date.textContent = formatBeingDate(entry.date);
        edit.append(date);
      }
      edit.append(copy);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "being-note-item__delete";
      remove.dataset.beingNoteDelete = String(index);
      remove.setAttribute("aria-label", entry.date ? `Delete note from ${formatBeingDate(entry.date)}` : "Delete note");
      remove.textContent = "×";

      item.append(edit, remove);
      fragment.appendChild(item);
    });

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "being-note-list__empty";
      empty.textContent = "No notes yet";
      fragment.appendChild(empty);
    }

    dom.being.card.noteCount.textContent = formatInteger(entries.length);
    dom.being.card.noteList.replaceChildren(fragment);
    applySevenNoteViewport(dom.being.card.noteList, entries.length);
  }

  async function saveBeingDatedNote() {
    const client = getBeingCardClient();
    if (!client) return;

    const noteText = String(dom.being.card.noteText.value ?? "").trim();
    if (!noteText) {
      dom.being.card.noteText.focus({ preventScroll: true });
      return;
    }

    const entries = getBeingNotes(client);
    const entry = {
      date: normalizeBeingDateValue(dom.being.card.noteDate.value) || getLocalTodayIso(),
      text: noteText
    };

    if (state.beingNoteEditIndex >= 0 && entries[state.beingNoteEditIndex]) {
      entries[state.beingNoteEditIndex] = entry;
    } else {
      entries.unshift(entry);
    }

    const previousNote = String(client?.being?.note ?? "");
    const nextNote = serializeBeingNotes(entries);
    updateBeingNote(client._key, nextNote);
    renderBeingNotes(client);
    resetBeingNoteComposer();
    renderBeing();

    try {
      await commitBeingNote(client._key);
      return true;
    } catch (error) {
      updateBeingNote(client._key, previousNote);
      renderBeingNotes(client);
      renderBeing();
      console.error("[Being] Dated note save failed:", error);
      return false;
    }
  }

  async function deleteBeingDatedNote(index) {
    const client = getBeingCardClient();
    if (!client) return;

    const entries = getBeingNotes(client);
    if (!entries[index]) return;

    const previousNote = String(client?.being?.note ?? "");
    entries.splice(index, 1);
    const nextNote = serializeBeingNotes(entries);
    updateBeingNote(client._key, nextNote);
    renderBeingNotes(client);
    resetBeingNoteComposer();
    renderBeing();

    try {
      await commitBeingNote(client._key);
    } catch (error) {
      updateBeingNote(client._key, previousNote);
      renderBeingNotes(client);
      renderBeing();
      console.error("[Being] Dated note delete failed:", error);
    }
  }

  function ensureBeingPinRank(client) {
    if (!client?.being?.pinned) return Number.POSITIVE_INFINITY;
    if (!state.beingPinOrder.has(client._key)) state.beingPinOrder.set(client._key, Math.random());
    return state.beingPinOrder.get(client._key);
  }

  /*
    Quest view of Being. The ordinary order answers "who do I contact next";
    this one answers "who finished, and who is closest to finishing", so it
    replaces the pinned / follow-up order rather than layering on top of it.

    Progress is read once per client: calculateQuestProgress walks the daily
    grid, and a comparator would otherwise call it O(n log n) times.
  */
  function getBeingQuestRanking(clients) {
    const ranking = new Map();

    clients.forEach((client) => {
      if (isQuestInactive(client)) return;
      const tracking = getClientQuestProgress(client);
      ranking.set(client._key, {
        completed: Boolean(tracking.completed),
        // A quest with no usable data sorts below every measured one instead
        // of tying with a genuine zero.
        percent: tracking.percent === null ? -1 : tracking.percent
      });
    });

    return ranking;
  }


  function getBeingSortedClients() {
    if (state.beingQuestFilter) {
      const withQuest = state.clients.filter((client) => !isQuestInactive(client));
      const ranking = getBeingQuestRanking(withQuest);

      return withQuest.sort((a, b) => {
        const aRank = ranking.get(a._key);
        const bRank = ranking.get(b._key);

        if (aRank.completed !== bRank.completed) return aRank.completed ? -1 : 1;
        if (aRank.percent !== bRank.percent) return bRank.percent - aRank.percent;

        return String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
      });
    }

    return state.clients.slice().sort((a, b) => {
      const aPinned = Boolean(a?.being?.pinned);
      const bPinned = Boolean(b?.being?.pinned);

      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      if (aPinned && bPinned) return ensureBeingPinRank(a) - ensureBeingPinRank(b);

      const aFollowUp = parseBeingDate(a?.being?.followUpDate);
      const bFollowUp = parseBeingDate(b?.being?.followUpDate);
      if (aFollowUp !== bFollowUp) return aFollowUp - bFollowUp;

      const aLast = parseBeingDate(a?.being?.lastContactDate);
      const bLast = parseBeingDate(b?.being?.lastContactDate);
      if (aLast !== bLast) return bLast - aLast;

      return String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
    });
  }

  function getBeingVisibleClients() {
    const query = normalizeSearch(state.beingQuery);
    const clients = getBeingSortedClients();
    if (!query) return clients;

    return clients.filter((client) =>
      normalizeSearch(client?.clientId).includes(query) ||
      normalizeSearch(client?.name).includes(query)
    );
  }

  function setBeingSearchOpen(open, { clear = false } = {}) {
    state.beingSearchOpen = Boolean(open);
    dom.being.searchShell.classList.toggle("is-open", state.beingSearchOpen);
    dom.being.searchToggle.setAttribute("aria-expanded", state.beingSearchOpen ? "true" : "false");

    if (clear) {
      dom.being.search.value = "";
      state.beingQuery = "";
      renderBeing();
    }

    if (state.beingSearchOpen) {
      window.requestAnimationFrame(() => dom.being.search.focus({ preventScroll: true }));
    } else {
      dom.being.searchToggle.focus({ preventScroll: true });
    }
  }

  function createBeingPinIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.innerHTML = '<path d="M8.5 3.5h7l-1 5 3 3v1.5H13v7l-1 1-1-1v-7H6.5v-1.5l3-3-1-5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>';
    return svg;
  }

  function createBeingRow(client, index, membership = getReactivationMembershipSet()) {
    const row = document.createElement("div");
    row.className = "being-row";
    row.classList.toggle("is-pinned", Boolean(client?.being?.pinned));
    row.dataset.clientKey = client._key;
    row.style.setProperty("--being-index", String(index));
    row.setAttribute("role", "row");
    row.tabIndex = 0;
    row.setAttribute("aria-label", `Open ${client?.name || "client"} card`);

    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "being-pin";
    pin.classList.toggle("is-active", Boolean(client?.being?.pinned));
    pin.dataset.beingPin = "true";
    pin.setAttribute("aria-pressed", client?.being?.pinned ? "true" : "false");
    pin.setAttribute("aria-label", client?.being?.pinned ? "Unpin client" : "Pin client");
    pin.title = client?.being?.pinned ? "Unpin client" : "Pin client";
    pin.appendChild(createBeingPinIcon());

    const clientCell = document.createElement("div");
    clientCell.className = "being-client";
    const name = document.createElement("div");
    name.className = "being-client__name";
    name.textContent = client?.name || "Name";
    const id = document.createElement("div");
    id.className = "being-client__id";
    id.textContent = `ID: ${client?.clientId ?? ""}`;
    clientCell.append(name, id);

    if (membership.has(String(client?.clientId ?? ""))) {
      const badge = document.createElement("span");
      badge.className = "reactivation-membership-badge reactivation-membership-badge--row";
      badge.textContent = "On Reactivation";
      clientCell.appendChild(badge);
    }

    const lastContact = document.createElement("div");
    lastContact.className = "being-date";
    lastContact.textContent = formatBeingDate(client?.being?.lastContactDate);

    const followUp = document.createElement("div");
    followUp.className = "being-date";
    followUp.textContent = formatBeingDate(client?.being?.followUpDate);

    const questCell = document.createElement("div");
    questCell.className = "being-quest";
    const questName = document.createElement("div");
    questName.className = "being-quest__name";
    const activeQuestName = String(client?.quest?.name ?? "").trim();
    questName.textContent = activeQuestName || "No Active Quest";
    questName.classList.toggle("is-empty", !activeQuestName);
    questCell.appendChild(questName);

    const questTracking = getClientQuestProgress(client);
    const progressValue = questTracking.percent ?? 0;
    const progress = document.createElement("div");
    progress.className = "being-progress";
    const progressTop = document.createElement("div");
    progressTop.className = "being-progress__top";
    progressTop.textContent = questTracking.percent === null
      ? "—"
      : `${formatNumber(progressValue)}%`;
    const progressTrack = document.createElement("div");
    progressTrack.className = "being-progress__track";
    const progressFill = document.createElement("div");
    progressFill.className = "being-progress__fill";
    progressFill.style.width = `${progressValue}%`;
    progressTrack.appendChild(progressFill);
    progress.append(progressTop, progressTrack);

    const noteEntries = getBeingNotes(client);
    const note = document.createElement("div");
    note.className = "being-note-preview";

    const noteText = document.createElement("span");
    noteText.textContent = noteEntries[0]?.text || "No notes";
    noteText.classList.toggle("is-empty", !noteEntries.length);
    note.appendChild(noteText);

    if (noteEntries.length > 1) {
      const noteCount = document.createElement("strong");
      noteCount.textContent = `+${noteEntries.length - 1}`;
      note.appendChild(noteCount);
    }

    row.append(pin, clientCell, lastContact, followUp, questCell, progress, note);
    return row;
  }


  // Local calendar date, no UTC shift: the day the user sees on the clock.
  function getLocalTodayIso() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getBeingCardClient() {
    if (!state.beingCardClientKey) return null;
    return state.clients.find((item) => item._key === state.beingCardClientKey) || null;
  }

  function updateBeingCardPinButton(client) {
    const pinned = Boolean(client?.being?.pinned);
    dom.being.card.pin.classList.toggle("is-active", pinned);
    dom.being.card.pin.setAttribute("aria-pressed", pinned ? "true" : "false");
    dom.being.card.pin.setAttribute("aria-label", pinned ? "Unpin client" : "Pin client");
    dom.being.card.pin.title = pinned ? "Unpin client" : "Pin client";
  }

  function openBeingQuest(clientKey) {
    const client = state.clients.find((item) => item._key === clientKey);
    if (!client) return;
    const reactivationBeingOrigin = state.reactivationBeingOrigin
      ? {
          ...state.reactivationBeingOrigin,
          reactivationPortalOrigin: state.reactivationBeingOrigin.reactivationPortalOrigin
            ? { ...state.reactivationBeingOrigin.reactivationPortalOrigin }
            : null
        }
      : null;

    // Commit the Being note before leaving the card, but do not write anywhere else.
    if (state.beingCardOpen) {
      closeBeingCard({
        restoreFocus: false,
        preserveReactivationOrigin: Boolean(reactivationBeingOrigin)
      });
    }

    openPage(PAGES.CLIENTS);
    state.questNavigationOrigin = {
      type: "being",
      clientKey: client._key,
      clientId: String(client.clientId ?? ""),
      reactivationBeingOrigin
    };
    openClientProfile(client, { preserveQuestOrigin: true });

    // Profile is painted first, then Current Quest becomes the active nested Client view.
    window.requestAnimationFrame(() => {
      openQuestDetail();
    });
  }

  function returnFromQuestToBeingCard() {
    const origin = state.questNavigationOrigin;
    if (origin?.type !== "being") return;
    const client = state.selectedClient;
    if (!client) return;

    // Navigation only. Quest edits remain controlled by the explicit Save action.
    openPage(PAGES.BEING);
    state.reactivationBeingOrigin = origin.reactivationBeingOrigin || null;
    state.questNavigationOrigin = null;

    window.requestAnimationFrame(() => {
      openBeingCard(client._key, null);
    });
  }

  function openReactivationQuest() {
    const reactivationClient = getReactivationClient(state.reactivationSelectedId);
    const client = reactivationClient ? findWorkspaceClient(reactivationClient) : null;
    if (!reactivationClient || !client) return;

    const savedPortalOrigin = state.reactivationPortalOrigin
      ? { ...state.reactivationPortalOrigin }
      : null;

    closeReactivationCard({ restoreFocus: false });
    openPage(PAGES.CLIENTS);
    state.questNavigationOrigin = {
      type: "reactivation",
      clientKey: client._key,
      clientId: String(reactivationClient.clientId),
      reactivationPortalOrigin: savedPortalOrigin
    };
    openClientProfile(client, { preserveQuestOrigin: true });

    window.requestAnimationFrame(() => openQuestDetail());
  }

  function returnFromQuestToReactivationCard() {
    const origin = state.questNavigationOrigin;
    if (origin?.type !== "reactivation") return;

    const reactivationClient = getReactivationClient(origin.clientId);
    if (!reactivationClient) return;

    const savedPortalOrigin = origin.reactivationPortalOrigin
      ? { ...origin.reactivationPortalOrigin }
      : null;

    openPage(PAGES.REACTIVATION);
    if (savedPortalOrigin) {
      state.reactivationPortalOrigin = savedPortalOrigin;
      enterReactivationPortal();
    }
    state.questNavigationOrigin = null;

    window.requestAnimationFrame(() => {
      openReactivationCard(reactivationClient.clientId, null);
    });
  }

  /**
   * Reactivation card -> back to the Being card you arrived from.
   *
   * Only the route that came from Being offers this. Opening the same client's
   * card from the Reactivation list has no Being card behind it, so the button
   * stays hidden there rather than inventing a destination.
   */
  function returnFromReactivationToBeing() {
    const origin = state.beingReactivationOrigin;
    if (!origin) return;
    if (String(origin.clientId) !== String(state.reactivationSelectedId)) return;

    const clientKey = String(origin.clientKey || "");
    state.beingReactivationOrigin = null;

    closeReactivationCard({ restoreFocus: false });
    openPage(PAGES.BEING);

    window.requestAnimationFrame(() => openBeingCard(clientKey, null));
  }


  function openBeingFromReactivation() {
    const reactivationClient = getReactivationClient(state.reactivationSelectedId);
    const client = reactivationClient ? findWorkspaceClient(reactivationClient) : null;
    if (!reactivationClient || !client) return;

    state.reactivationBeingOrigin = {
      clientId: String(reactivationClient.clientId),
      clientKey: client._key,
      reactivationPortalOrigin: state.reactivationPortalOrigin
        ? { ...state.reactivationPortalOrigin }
        : null
    };

    closeReactivationCard({ restoreFocus: false });
    openPage(PAGES.BEING);
    window.requestAnimationFrame(() => openBeingCard(client._key, null));
  }

  function returnFromBeingToReactivation() {
    const origin = state.reactivationBeingOrigin;
    if (!origin) return;

    const savedPortalOrigin = origin.reactivationPortalOrigin
      ? { ...origin.reactivationPortalOrigin }
      : null;
    const clientId = String(origin.clientId || "");

    closeBeingCard({ restoreFocus: false, preserveReactivationOrigin: true });
    openPage(PAGES.REACTIVATION);
    if (savedPortalOrigin) {
      state.reactivationPortalOrigin = savedPortalOrigin;
      enterReactivationPortal();
    }
    state.reactivationBeingOrigin = null;

    window.requestAnimationFrame(() => openReactivationCard(clientId, null));
  }

  /**
   * Being card -> that client's Reactivation card.
   *
   * Only offered when the ID is actually in the Reactivation queue, because
   * the card has nothing to show otherwise. Adding an ID stays the job of the
   * +R button next to it.
   */
  function openReactivationFromBeingCard() {
    const client = getBeingCardClient();
    const clientId = String(client?.clientId ?? "");
    if (!clientId || !getReactivationClient(clientId)) return;

    // Remembered so the Reactivation card can offer the way back.
    state.beingReactivationOrigin = { clientId, clientKey: client._key };

    closeBeingCard({ restoreFocus: false });
    // openPage enters the Reactivation portal on its own.
    openPage(PAGES.REACTIVATION);

    window.requestAnimationFrame(() => openReactivationCard(clientId, null));
  }


  function renderBeingCard(client) {
    if (!client) return;

    dom.being.card.name.textContent = client?.name || "Name";
    dom.being.card.clientId.textContent = `ID: ${client?.clientId ?? ""}`;
    const canReturnToReactivation = Boolean(
      state.reactivationBeingOrigin &&
      String(state.reactivationBeingOrigin.clientId) === String(client?.clientId ?? "")
    );
    dom.being.card.backToReactivation.hidden = !canReturnToReactivation;
    // The Reactivation card only exists for IDs that are in the queue.
    dom.being.card.openReactivation.hidden =
      canReturnToReactivation || !getReactivationClient(client?.clientId);
    dom.being.card.lastContact.value = normalizeBeingDateValue(client?.being?.lastContactDate);
    dom.being.card.followUp.value = normalizeBeingDateValue(client?.being?.followUpDate);
    resetBeingNoteComposer();
    renderBeingNotes(client);

    const inCurrentReactivationSheet = isClientOnReactivation(client?.clientId);
    const onReactivation = shouldShowReactivationMembership(client?.clientId);
    dom.being.card.reactivation.classList.toggle("is-active", onReactivation);
    dom.being.card.reactivation.hidden = inCurrentReactivationSheet && !onReactivation;
    dom.being.card.reactivation.disabled = inCurrentReactivationSheet;
    dom.being.card.reactivation.textContent = onReactivation ? "On R" : "+R";
    dom.being.card.reactivation.setAttribute(
      "aria-label",
      onReactivation ? "ID is on Reactivation" : "Add ID to Reactivation"
    );
    dom.being.card.reactivation.title = onReactivation
      ? "On Reactivation"
      : "Add to Reactivation";

    const questName = String(client?.quest?.name ?? "").trim();
    const questTracking = getClientQuestProgress(client);
    const progress = questTracking.percent ?? 0;

    dom.being.card.questName.textContent = questName || "No Active Quest";
    dom.being.card.questName.classList.toggle("is-empty", !questName);
    dom.being.card.questProgress.textContent = questTracking.percent === null
      ? "—"
      : `${formatNumber(progress)}%`;
    dom.being.card.questProgressFill.style.transform = `scaleX(${progress / 100})`;

    updateBeingCardPinButton(client);
  }

  function openBeingCard(clientKey, returnFocus = null) {
    const client = state.clients.find((item) => item._key === clientKey);
    if (!client) return;

    state.beingCardOpen = true;
    state.beingCardClientKey = client._key;
    state.beingCardReturnFocus = returnFocus || document.activeElement;
    renderBeingCard(client);

    dom.being.card.overlay.classList.add("is-open");
    dom.being.card.overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-being-card-open");

    if ("inert" in dom.app) dom.app.inert = true;

    window.requestAnimationFrame(() => {
      dom.being.card.noteText.focus({ preventScroll: true });
    });
  }

  function closeBeingCard({ restoreFocus = true, preserveReactivationOrigin = false } = {}) {
    if (!state.beingCardOpen) return;

    const clientKey = state.beingCardClientKey;

    // Dated notes are committed explicitly by Add / Save. Closing the card
    // must never replay the same Notes payload a second time.

    state.beingCardOpen = false;
    state.beingCardClientKey = null;
    if (!preserveReactivationOrigin) state.reactivationBeingOrigin = null;
    dom.being.card.overlay.classList.remove("is-open");
    dom.being.card.overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-being-card-open");

    if ("inert" in dom.app) dom.app.inert = false;

    renderBeing();

    const storedFocus = state.beingCardReturnFocus;
    state.beingCardReturnFocus = null;

    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        const liveRow = clientKey
          ? dom.being.rows.querySelector(`.being-row[data-client-key="${CSS.escape(clientKey)}"]`)
          : null;

        const target =
          liveRow ||
          (storedFocus && storedFocus.isConnected ? storedFocus : null);

        target?.focus?.({ preventScroll: true });
      });
    }
  }

  function updateBeingDate(clientKey, field, value) {
    if (!["lastContactDate", "followUpDate"].includes(field)) return false;

    const client = state.clients.find((item) => item._key === clientKey);
    if (!client) return false;

    const normalized = normalizeBeingDateValue(value);
    client.being = {
      ...(client.being || {}),
      [field]: normalized
    };

    emitBeingChange(client, { [field]: normalized });
    renderBeing();
    return true;
  }

  function renderBeing() {
    const clients = getBeingVisibleClients();
    const totalClients = state.clients.length;
    const membership = getReactivationMembershipSet();
    const fragment = document.createDocumentFragment();
    clients.forEach((client, index) => fragment.appendChild(createBeingRow(client, index, membership)));

    dom.being.rows.replaceChildren(fragment);
    dom.being.empty.hidden = clients.length !== 0;
    // Any narrowing shows "shown / total", the way the ID search already does.
    const narrowed = Boolean(state.beingQuery) || state.beingQuestFilter;
    dom.being.count.textContent = narrowed
      ? `${formatInteger(clients.length)} / ${formatInteger(totalClients)}`
      : `${formatInteger(totalClients)} ${totalClients === 1 ? "client" : "clients"}`;
  }

  function emitBeingChange(client, patch) {
    if (typeof state.beingChangeHandler !== "function" || !client) {
      return Promise.resolve(null);
    }

    try {
      return trackPendingWrite(
        queueClientWrite(client._key, () => state.beingChangeHandler({
          _key: client._key,
          clientId: client.clientId,
          ...patch
        }))
      ).catch((error) => {
        console.error("Being change handler failed:", error);
        throw error;
      });
    } catch (error) {
      console.error("Being change handler failed:", error);
      return Promise.reject(error);
    }
  }

  function setBeingChangeHandler(handler) {
    if (handler !== null && typeof handler !== "function") {
      throw new TypeError("Being change handler must be a function or null.");
    }
    state.beingChangeHandler = handler;
  }

  async function toggleBeingPin(clientKey) {
    const client = state.clients.find((item) => item._key === clientKey);
    if (!client) return;

    const previousPinned =
      Boolean(client?.being?.pinned);

    const nextPinned =
      !previousPinned;

    client.being = {
      ...(client.being || {}),
      pinned: nextPinned
    };

    if (nextPinned) {
      state.beingPinOrder.set(
        client._key,
        Math.random()
      );
    } else {
      state.beingPinOrder.delete(
        client._key
      );
    }

    renderBeing();

    if (
      state.beingCardOpen &&
      state.beingCardClientKey === client._key
    ) {
      updateBeingCardPinButton(client);
    }

    try {
      /*
       * PIN DOES NOT USE THE GENERIC POST CHANGE HANDLER.
       *
       * It uses the same GET path that already successfully loads
       * Being clients through the local PowerShell bridge.
       */
      const result = await trackPendingWrite(
        queueClientWrite(client._key, () => saveBeingPinDirect(client, nextPinned))
      );

      if (
        isBeingGoogleSheetConfigured() &&
        (
          !result ||
          Boolean(result.pinned) !== nextPinned
        )
      ) {
        throw new Error(
          "Google Sheet did not confirm Pinned."
        );
      }

    } catch (error) {
      client.being = {
        ...(client.being || {}),
        pinned: previousPinned
      };

      if (previousPinned) {
        state.beingPinOrder.set(
          client._key,
          Math.random()
        );
      } else {
        state.beingPinOrder.delete(
          client._key
        );
      }

      renderBeing();

      if (
        state.beingCardOpen &&
        state.beingCardClientKey === client._key
      ) {
        updateBeingCardPinButton(client);
      }

      console.error(
        "[Being] Direct pin save failed:",
        error
      );
    }
  }

  function updateBeingNote(clientKey, note) {
    const client = state.clients.find((item) => item._key === clientKey);
    if (!client) return;
    client.being = { ...(client.being || {}), note: String(note ?? "") };
  }

  function commitBeingNote(clientKey) {
    const client = state.clients.find((item) => item._key === clientKey);
    if (!client) return Promise.resolve(null);
    return emitBeingChange(client, { note: String(client?.being?.note ?? "") });
  }

  function createBeingPerformanceFromProfile(source) {
    const period = source && typeof source === "object" ? source : {};
    return {
      to: {
        total: normalizeOptionalNumber(period.to),
        sport: normalizeOptionalNumber(period.sport),
        casino: normalizeOptionalNumber(period.casino),
        liveCasino: normalizeOptionalNumber(period.live),
        slots: normalizeOptionalNumber(period.slots),
        instant: normalizeOptionalNumber(period.instant)
      },
      ggr: {
        total: normalizeOptionalNumber(period.ggr),
        sport: normalizeOptionalNumber(period.ggrSport),
        casino: normalizeOptionalNumber(period.ggrCasino),
        liveCasino: normalizeOptionalNumber(period.ggrLive),
        slots: normalizeOptionalNumber(period.ggrSlots),
        instant: normalizeOptionalNumber(period.ggrInstant)
      },
      ngr: {
        total: normalizeOptionalNumber(period.ngr),
        sport: normalizeOptionalNumber(period.ngrSport),
        casino: normalizeOptionalNumber(period.ngrCasino),
        liveCasino: normalizeOptionalNumber(period.ngrLive),
        slots: normalizeOptionalNumber(period.ngrSlots),
        instant: normalizeOptionalNumber(period.ngrInstant)
      },
      bonus: normalizeOptionalNumber(period.bonus),
      bonusRate: normalizeOptionalNumber(period.bonusRate),
      deposits: normalizeOptionalNumber(period.deposits),
      depositCount: normalizeOptionalNumber(period.depositCount),
      withdrawals: normalizeOptionalNumber(period.withdrawals),
      withdrawalCount: normalizeOptionalNumber(period.withdrawalCount),
      netLoss: deriveNetLoss(period.deposits, period.withdrawals),
      lastActivityDate: normalizeBeingDateValue(period.lastActivityDate),
      sourceLatestDate: normalizeBeingDateValue(period.sourceLatestDate)
    };
  }

  function normalizeQuestDaily(source) {
    const result = {};
    if (!source || typeof source !== "object" || Array.isArray(source)) return result;

    Object.entries(source).forEach(([rawDate, rawMetrics]) => {
      const date = normalizeBeingDateValue(rawDate);
      if (!date || !rawMetrics || typeof rawMetrics !== "object") return;
      const metrics = {};
      ["to", "ggr", "casino", "sport", "deposits", "withdrawals"].forEach((field) => {
        const value = normalizeOptionalNumber(rawMetrics[field]);
        if (value !== null) metrics[field] = value;
      });
      if (Object.keys(metrics).length) result[date] = metrics;
    });
    return result;
  }

  function inferQuestMechanicFromName(name, fallback = DEFAULT_QUEST_MECHANIC) {
    const normalizedName = String(name ?? "")
      .trim()
      .toLocaleLowerCase();

    const match = Object.entries(QUEST_MECHANICS).find(([, mechanic]) =>
      String(mechanic.label).toLocaleLowerCase() === normalizedName
    );

    if (match) return match[0];
    return QUEST_MECHANICS[fallback] ? fallback : DEFAULT_QUEST_MECHANIC;
  }

  /*
    Net Loss is built from Deposits and Withdrawals, which have no vertical
    split in any supplied source. It therefore ignores the stored section and
    always reports the combined one, so the card never claims a scope the
    numbers do not have.
  */
  function getEffectiveQuestSection(quest, mechanic = quest?.mechanic) {
    const resolvedMechanic = QUEST_MECHANICS[mechanic]
      ? mechanic
      : DEFAULT_QUEST_MECHANIC;

    if (resolvedMechanic === "net_loss") return DEFAULT_QUEST_SECTION;

    return QUEST_SECTIONS[quest?.section]
      ? quest.section
      : DEFAULT_QUEST_SECTION;
  }

  function isQuestSectionApplicable(mechanic) {
    const resolvedMechanic = QUEST_MECHANICS[mechanic]
      ? mechanic
      : DEFAULT_QUEST_MECHANIC;

    return resolvedMechanic !== "net_loss";
  }


  function getEffectiveQuestCurrency(quest) {
    const code = String(quest?.currency ?? "").trim().toUpperCase();
    return QUEST_CURRENCIES[code] ? code : DEFAULT_QUEST_CURRENCY;
  }


  function getQuestCurrencyConfig(currency) {
    return QUEST_CURRENCIES[currency] || QUEST_CURRENCIES[DEFAULT_QUEST_CURRENCY];
  }


  /**
   * Every figure in the 365 sheet is EUR, so conversion happens once, at the
   * edge, on the way to the screen. Nothing upstream of this knows about
   * currencies.
   */
  function convertEurToQuestCurrency(value, currency) {
    const amount = normalizeOptionalNumber(value);
    if (amount === null) return null;
    return amount * getQuestCurrencyConfig(currency).perEur;
  }


  function formatQuestMoney(value, currency) {
    return `${getQuestCurrencyConfig(currency).prefix}${formatNumber(value)}`;
  }


  function isQuestOpenEndedText(value) {
    return /^\s*no[\s_-]*limit\s*$/i.test(String(value ?? ""));
  }

  function parseQuestAmount(value) {
    const text = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
    const match = text.match(/(-?[\d.,]+)\s*([km])?/i);
    if (!match) return null;
    let numberText = match[1];
    if (numberText.includes(",") && numberText.includes(".")) {
      numberText = numberText.lastIndexOf(",") > numberText.lastIndexOf(".")
        ? numberText.replace(/\./g, "").replace(",", ".")
        : numberText.replace(/,/g, "");
    } else if (numberText.includes(",")) {
      numberText = numberText.replace(",", ".");
    }
    const valueNumber = Number(numberText);
    if (!Number.isFinite(valueNumber)) return null;
    const multiplier = match[2]?.toLowerCase() === "m"
      ? 1000000
      : match[2]?.toLowerCase() === "k" ? 1000 : 1;
    return valueNumber * multiplier;
  }

  function extractQuestTrackingMetadata(conditions, fallbackMechanic) {
    let mechanic = QUEST_MECHANICS[fallbackMechanic]
      ? fallbackMechanic
      : DEFAULT_QUEST_MECHANIC;
    // Cells written before sections existed carry no Tracking Section at all.
    // They keep counting both verticals, exactly as they did before.
    let section = DEFAULT_QUEST_SECTION;
    // Same for currency: a cell written before currencies existed is EUR.
    let currency = DEFAULT_QUEST_CURRENCY;
    let goal = null;
    const visibleConditions = [];

    (Array.isArray(conditions) ? conditions : []).forEach((condition) => {
      const text = String(condition ?? "").trim();
      const mechanicMatch = text.match(/^Tracking\s+Mechanic\s*:\s*([a-z_]+)$/i);
      if (mechanicMatch && QUEST_MECHANICS[mechanicMatch[1].toLowerCase()]) {
        mechanic = mechanicMatch[1].toLowerCase();
        return;
      }
      const sectionMatch = text.match(/^Tracking\s+Section\s*:\s*([a-z_+\s]+)$/i);
      if (sectionMatch) {
        const rawSection = sectionMatch[1].trim().toLowerCase().replace(/[\s+]+/g, "_");
        const resolvedSection = rawSection === "casino_sport" || rawSection === "sport_casino"
          ? "all"
          : rawSection;
        if (QUEST_SECTIONS[resolvedSection]) {
          section = resolvedSection;
          return;
        }
      }
      const currencyMatch = text.match(/^Tracking\s+Currency\s*:\s*([a-z]{3,4})$/i);
      if (currencyMatch && QUEST_CURRENCIES[currencyMatch[1].toUpperCase()]) {
        currency = currencyMatch[1].toUpperCase();
        return;
      }
      const goalMatch = text.match(/^Tracking\s+Goal\s*:\s*(.+)$/i);
      if (goalMatch) {
        goal = parseQuestAmount(goalMatch[1]);
        return;
      }
      visibleConditions.push(text);
      if (goal === null) {
        const legacyGoal = text.match(/(?:TO|Turnover|Net\s*Loss)\s*Goal\s*[:=-]?\s*(.+)/i);
        if (legacyGoal) goal = parseQuestAmount(legacyGoal[1]);
      }
    });

    return { mechanic, section, currency, goal, conditions: visibleConditions };
  }

  function parseActiveQuestCell(value, previousQuest = null) {
    const text = String(value ?? "").trim();
    if (!text || text === "-") return createEmptyQuest();

    const labels = [];
    const labelPattern = /(Quest\s*Name|Start\s*Date|End\s*Date|Quest\s*Conditions|Reward)\s*:\s*/gi;
    let match;

    while ((match = labelPattern.exec(text)) !== null) {
      labels.push({
        label: match[1].replace(/\s+/g, " ").toLocaleLowerCase(),
        valueStart: labelPattern.lastIndex,
        labelStart: match.index
      });
    }

    // Compatibility with old cells that contained only the quest title.
    if (!labels.length) {
      return {
        ...createEmptyQuest(),
        name: text,
        mechanic: inferQuestMechanicFromName(text, previousQuest?.mechanic),
        progress: normalizeNumber(previousQuest?.progress)
      };
    }

    const fields = {};
    labels.forEach((label, index) => {
      const nextStart = labels[index + 1]?.labelStart ?? text.length;
      fields[label.label] = text
        .slice(label.valueStart, nextStart)
        .replace(/^\s*;\s*/, "")
        .replace(/\s*;\s*$/, "")
        .trim();
    });

    const cleanField = (field) => {
      const fieldValue = String(fields[field] ?? "").trim();
      return fieldValue === "-" ? "" : fieldValue;
    };

    const name = cleanField("quest name");
    const conditionsText = cleanField("quest conditions");
    // "no limit" is a deliberate state, not a missing value: the quest runs
    // from its start date up to whatever the sheet currently reaches.
    const rawEndField = cleanField("end date");
    const openEnded = isQuestOpenEndedText(rawEndField);
    const rawEnd = openEnded ? "" : rawEndField;
    const previousName = String(previousQuest?.name ?? "").trim();
    const keepPreviousProgress = Boolean(name && previousName === name);

    const parsedConditions = conditionsText
      ? conditionsText
          .split(/\s*\|\s*|\r?\n/)
          .map((condition) => condition.trim())
          .filter(Boolean)
      : [];
    const metadata = extractQuestTrackingMetadata(
      parsedConditions,
      inferQuestMechanicFromName(
        name,
        keepPreviousProgress ? previousQuest?.mechanic : DEFAULT_QUEST_MECHANIC
      )
    );

    return {
      ...createEmptyQuest(),
      name,
      mechanic: metadata.mechanic,
      section: metadata.section,
      currency: metadata.currency,
      goal: metadata.goal,
      progress: keepPreviousProgress
        ? normalizeNumber(previousQuest?.progress)
        : 0,
      start: cleanField("start date"),
      end: rawEnd,
      openEnded,
      conditions: metadata.conditions,
      reward: cleanField("reward")
    };
  }

  function serializeActiveQuestCell(quest) {
    const field = (value) => String(value ?? "").trim() || "-";
    const mechanic = QUEST_MECHANICS[quest?.mechanic]
      ? quest.mechanic
      : DEFAULT_QUEST_MECHANIC;
    const trackingConditions = [
      `Tracking Mechanic: ${mechanic}`,
      `Tracking Section: ${getEffectiveQuestSection(quest, mechanic)}`,
      `Tracking Currency: ${getEffectiveQuestCurrency(quest)}`
    ];
    const goal = normalizeOptionalNumber(quest?.goal);
    if (goal !== null && goal > 0) trackingConditions.push(`Tracking Goal: ${goal}`);
    const conditions = trackingConditions.concat(Array.isArray(quest?.conditions)
      ? quest.conditions
          .map((condition) => String(condition ?? "").trim())
          .filter(Boolean)
      : []).join(" | ");

    return [
      `Quest Name: ${field(quest?.name)}`,
      `Start Date: ${field(quest?.start)}`,
      `End Date: ${quest?.openEnded ? QUEST_OPEN_END_TEXT : field(quest?.end)}`,
      `Quest Conditions: ${field(conditions)}`,
      `Reward: ${field(quest?.reward)}`
    ].join("; ");
  }

  function createClientFromBeingSource(source, index) {
    const clientId = String(source?.clientId ?? "").trim();
    const clientName = String(source?.clientName ?? "").trim();
    const activeQuest = parseActiveQuestCell(source?.activeQuest);

    const sourcePerformance = source?.reactivationProfile?.performance || {};
    const period12m = sourcePerformance["12m"] || {};

    return {
      _key: `being-sheet-${clientId || index + 1}`,
      name: clientName || "Name",
      clientId,
      performance: {
        day: createBeingPerformanceFromProfile(sourcePerformance.day),
        "7d": createBeingPerformanceFromProfile(sourcePerformance["7d"]),
        "30d": createBeingPerformanceFromProfile(sourcePerformance["30d"]),
        "12m": createBeingPerformanceFromProfile(sourcePerformance["12m"])
      },
      questDaily: normalizeQuestDaily(source?.reactivationProfile?.daily),
      whereHePlays: {
        sport: normalizeOptionalNumber(period12m.sport),
        casino: normalizeOptionalNumber(period12m.casino),
        liveCasino: normalizeOptionalNumber(period12m.live),
        slots: normalizeOptionalNumber(period12m.slots),
        instant: normalizeOptionalNumber(period12m.instant)
      },
      quest: {
        ...activeQuest
      },
      questHistory: [],
      activity: {
        lastContact: normalizeBeingDateValue(source?.lastContactDate),
        lastClientActivity: normalizeBeingDateValue(period12m.lastActivityDate)
      },
      being: {
        lastContactDate: normalizeBeingDateValue(source?.lastContactDate),
        followUpDate: normalizeBeingDateValue(source?.followUpDate),
        note: String(source?.note ?? ""),
        pinned: normalizeBeingPinned(source?.pinned),
        bonusLog: String(source?.bonusLog ?? "")
      },
      bonuses: {
        total: 0,
        lastDate: "",
        lastAmount: 0
      }
    };
  }

  function setBeingData(rows) {
    if (!Array.isArray(rows)) return false;

    const normalizedRows = rows
      .map((row) => ({
        ...row,
        clientId: String(row?.clientId ?? "").trim(),
        clientName: String(row?.clientName ?? "").trim(),
        note: String(row?.note ?? ""),
        activeQuest: String(row?.activeQuest ?? "").trim(),
        bonusLog: String(row?.bonusLog ?? ""),
        pinned: normalizeBeingPinned(row?.pinned),
        followUpDate: normalizeBeingDateValue(row?.followUpDate),
        lastContactDate: normalizeBeingDateValue(row?.lastContactDate),
        reactivationProfile: row?.reactivationProfile && typeof row.reactivationProfile === "object"
          ? row.reactivationProfile
          : { performance: {} }
      }))
      .filter((row) => row.clientId);

    /*
      Being_Archive owns the directory: every successful refresh replaces the
      full list, which keeps new and deleted IDs in sync. The rows become
      clients once, in createClientFromBeingSource, and setClients closes an
      open Being card and renders Clients and Being itself.
    */
    if (normalizedRows.length) {
      setClients(
        normalizedRows.map(createClientFromBeingSource),
        { source: "being-sheet" }
      );
    } else {
      // The sheet answered, but no row carried an ID: the directory stays.
      state.beingPinOrder.clear();
      renderBeing();

      if (state.beingCardOpen) {
        const openClient = getBeingCardClient();
        if (openClient) renderBeingCard(openClient);
        else closeBeingCard({ restoreFocus: false });
      }
    }

    refreshAnalyticsFrom365();
    return true;
  }

  function isBeingGoogleSheetConfigured() {
    return (
      /^https?:$/i.test(window.location.protocol) &&
      String(BEING_GOOGLE_SHEET.LOCAL_API_URL || "").trim().startsWith("/")
    );
  }

  /*
    One door to the local bridge. A call is GET with the action in the query
    or POST with it in the body, never cached and stamped with `_` so nothing
    replays an answer; a reply is JSON with ok:true, or an error text. What
    differs per call is only the message used when the reply carries none.
  */
  function beingApiUrl(action, params = {}) {
    const url = new URL(BEING_GOOGLE_SHEET.LOCAL_API_URL, window.location.origin);
    url.searchParams.set("action", action);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    url.searchParams.set("_", String(Date.now()));
    return url.toString();
  }

  async function fetchJson(url, init = {}) {
    const response = await fetch(url, { cache: "no-store", ...init });
    const data = await response.json().catch(() => null);
    return { response, data };
  }

  // describeError(response) supplies the fallback text; it can tell a
  // transport failure (response.ok false) from a script one (ok:false).
  async function apiRequest(url, init, describeError) {
    const { response, data } = await fetchJson(url, init);
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || describeError(response));
    }
    return data;
  }

  function apiGet(action, params, describeError) {
    return apiRequest(beingApiUrl(action, params), { method: "GET" }, describeError);
  }

  function apiPost(url, body, describeError, init = {}) {
    return apiRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      ...init
    }, describeError);
  }

  const bridgeHttpError = (response) => `Being local bridge HTTP ${response.status}`;

  async function fetchBeingGoogleSheetRows() {
    if (!isBeingGoogleSheetConfigured()) return [];

    const data = await apiGet("getClients", {}, (response) => response.ok
      ? "Being Google Sheet returned an error."
      : bridgeHttpError(response));

    const clients = Array.isArray(data.clients)
      ? data.clients
      : [];

    return clients.map((client) => ({
      clientId: String(client?.clientId ?? "").trim(),
      clientName: String(client?.clientName ?? "").trim(),
      note: String(client?.notes ?? ""),
      activeQuest: String(client?.activeQuest ?? "").trim(),
      bonusLog: String(client?.bonusLog ?? ""),
      pinned: normalizeBeingPinned(client?.pinned),
      followUpDate: normalizeBeingDateValue(client?.followUpDate),
      lastContactDate: normalizeBeingDateValue(client?.lastContactDate),
      reactivationProfile: client?.reactivationProfile && typeof client.reactivationProfile === "object"
        ? client.reactivationProfile
        : { performance: {} }
    }));
  }

  async function loadBeingFromGoogleSheet(options = {}) {
    const throwOnError =
      Boolean(options?.throwOnError);

    if (!isBeingGoogleSheetConfigured()) {
      const error = new Error(
        "Open CRM through START_CRM.bat. Google credentials are stored in being_config.json."
      );

      console.info(
        "[Being] " + error.message
      );

      if (throwOnError) {
        throw error;
      }

      return false;
    }

    try {
      const rows = await (options.request || fetchBeingGoogleSheetRows());

      if (!rows.length) {
        throw new Error("Google Sheet returned 0 clients. Check the ID column and deployment.");
      }

      setBeingData(rows);

      console.info(
        `[Being] Loaded ${rows.length} client${rows.length === 1 ? "" : "s"} from Google Sheet.`
      );

      return true;
    } catch (error) {
      console.error(
        "[Being] Google Sheet load failed:",
        error
      );

      if (throwOnError) {
        throw error;
      }

      return false;
    }
  }

  async function saveBeingPinDirect(client, pinned) {
    if (!isBeingGoogleSheetConfigured() || !client) {
      return null;
    }

    const clientId = String(client?.clientId ?? "").trim();

    if (!clientId) {
      throw new Error("ID is empty.");
    }

    const data = await apiGet(
      "updatePinned",
      { clientId, pinned: pinned ? "true" : "false" },
      (response) => response.ok ? "Google Sheet pin save failed." : bridgeHttpError(response)
    );

    if (
      !Object.prototype.hasOwnProperty.call(
        data,
        "pinned"
      )
    ) {
      throw new Error(
        "Apps Script did not return the saved Pinned value. Deploy Code.gs 3.4."
      );
    }

    const confirmedPinned =
      Boolean(data.pinned);

    if (confirmedPinned !== Boolean(pinned)) {
      throw new Error(
        `Pinned verification mismatch. Requested ${Boolean(pinned)}, received ${confirmedPinned}.`
      );
    }

    console.info(
      "[Being] Pinned cell confirmed:",
      {
        clientId,
        pinned: confirmedPinned,
        row: data.row,
        column: data.column,
        displayValue: data.displayValue
      }
    );

    return data;
  }

  async function saveBeingChangeToGoogleSheet(change) {
    if (!isBeingGoogleSheetConfigured()) return;

    const clientId = String(change?.clientId ?? "").trim();
    if (!clientId) return;

    const changes = {};

    if (Object.prototype.hasOwnProperty.call(change, "note")) {
      changes.notes = String(change.note ?? "");
    }

    if (Object.prototype.hasOwnProperty.call(change, "followUpDate")) {
      changes.followUpDate = String(change.followUpDate ?? "");
    }

    if (Object.prototype.hasOwnProperty.call(change, "lastContactDate")) {
      changes.lastContactDate = String(change.lastContactDate ?? "");
    }

    if (!Object.keys(changes).length) return;

    /*
      Every field this sends is an absolute value rather than a delta, so
      repeating the request cannot double-apply anything. That is what makes
      the retry ladder below safe.
    */
    const postChanges = () => apiPost(
      BEING_GOOGLE_SHEET.LOCAL_API_URL,
      { action: "updateClient", clientId, changes },
      (response) => response.ok ? "Being Google Sheet save failed." : bridgeHttpError(response)
    );

    let lastError = null;

    for (let attempt = 1; attempt <= BEING_SAVE_RETRY_DELAYS.length + 1; attempt++) {
      try {
        const data = await postChanges();
        console.info("[Being] Saved to Google Sheet:", clientId, changes);
        return data;
      } catch (error) {
        lastError = error;
        const delay = BEING_SAVE_RETRY_DELAYS[attempt - 1];
        if (delay === undefined) break;
        console.warn(`[Being] Save attempt ${attempt} failed, retrying:`, error);
        await new Promise((resolve) => window.setTimeout(resolve, delay));
      }
    }

    /*
      Every attempt reported a failure, which is not the same as the sheet not
      having the value: a reply lost on the way back looks exactly like a write
      that never happened. Ask the sheet what it holds before undoing anything
      on screen - this is what stopped saved notes from being rolled back.
    */
    const landed = await confirmBeingChangeLanded(clientId, changes);

    if (landed) {
      console.info("[Being] Save confirmed from the sheet after a failed reply:", clientId);
      return { ok: true, clientId, confirmedBySheet: true };
    }

    console.error("[Being] Google Sheet save failed:", lastError);
    throw lastError || new Error("Being Google Sheet save failed.");
  }

  /*
    Reads back the one row this save touched and answers a single question:
    does the sheet already hold what was sent? Only the fields that were sent
    are compared, and dates are compared as dates rather than as text.
  */
  async function confirmBeingChangeLanded(clientId, changes) {
    try {
      const { response, data } = await fetchJson(
        beingApiUrl("getClientFields", { clientId }),
        { method: "GET" }
      );
      if (!response.ok || !data?.ok || !data.fields) return false;

      const fields = data.fields;

      return Object.entries(changes).every(([key, value]) => {
        const actual = fields[key];
        if (key === "followUpDate" || key === "lastContactDate") {
          return normalizeBeingDateValue(actual) === normalizeBeingDateValue(value);
        }
        return String(actual ?? "").trim() === String(value ?? "").trim();
      });
    } catch (error) {
      console.warn("[Being] Could not confirm the save against the sheet:", error);
      return false;
    }
  }

  function connectBeingGoogleSheet() {
    if (!isBeingGoogleSheetConfigured()) {
      setBeingChangeHandler(null);
      return false;
    }

    setBeingChangeHandler(saveBeingChangeToGoogleSheet);
    return true;
  }

  async function fetchReactivationGoogleSheetState() {
    if (!isBeingGoogleSheetConfigured()) return null;

    return apiGet(
      "getReactivation",
      {},
      (response) => `Reactivation bridge HTTP ${response.status}`
    );
  }

  async function saveReactivationChangeToGoogleSheet(change) {
    if (!state.reactivationSourceReady) return null;

    return apiPost(
      BEING_GOOGLE_SHEET.LOCAL_API_URL,
      { action: "updateReactivation", mutation: change },
      (response) => `Reactivation save HTTP ${response.status}`
    );
  }

  async function loadReactivationFromGoogleSheet(request = fetchReactivationGoogleSheetState()) {
    try {
      const data = await request;

      if (!data?.ready) {
        state.reactivationSourceReady = false;
        setReactivationChangeHandler(null);
        console.info("[Reactivation] No current since-sheet is ready.");
        return false;
      }

      setReactivationData(Array.isArray(data.rows) ? data.rows : []);
      state.reactivationSourceReady = true;
      setReactivationChangeHandler(saveReactivationChangeToGoogleSheet);
      console.info(`[Reactivation] Loaded ${state.reactivationClients.length} IDs from its Sheet source.`);
      return true;
    } catch (error) {
      state.reactivationSourceReady = false;
      setReactivationChangeHandler(null);
      console.info("[Reactivation] Sheet adapter is not active yet:", error?.message || error);
      return false;
    }
  }

  /*
    Both sheets are asked for at once - each is a cold Apps Script call - and
    applied in the old order: Being first, because the Reactivation rows are
    matched against the directory it builds. A Being failure is the load
    failing; a Reactivation failure only leaves its adapter inactive.
  */
  async function loadSheetsFromGoogle(options = {}) {
    if (!isBeingGoogleSheetConfigured()) {
      return loadBeingFromGoogleSheet(options);
    }

    const reactivationRequest = fetchReactivationGoogleSheetState();
    // Reported when it is awaited below; without this the browser would flag
    // the rejection as unhandled while Being is still loading.
    reactivationRequest.catch(() => {});

    const loaded = await loadBeingFromGoogleSheet({
      ...options,
      request: fetchBeingGoogleSheetRows()
    });
    if (!loaded) return false;

    await loadReactivationFromGoogleSheet(reactivationRequest);
    return true;
  }

  function setAppLoaderState(status, progress) {
    if (dom.appLoaderStatus) {
      dom.appLoaderStatus.textContent = String(status || "");
    }

    if (dom.appLoaderProgress && Number.isFinite(Number(progress))) {
      const value = Math.max(0, Math.min(100, Number(progress)));
      dom.appLoaderProgress.style.transform = `scaleX(${value / 100})`;
    }
  }

  function hideAppLoader() {
    if (state.appBootFinished) return;

    state.appBootFinished = true;

    renderDataSourceState();

    if (!dom.appLoader) return;

    dom.appLoader.setAttribute("aria-busy", "false");
    dom.appLoader.classList.add("is-leaving");

    window.setTimeout(() => {
      dom.appLoader?.remove();
      // The window opens big enough to read the sync progress; once the CRM
      // is up it becomes the small object in the corner.
      applyWindowShape();
    }, 320);
  }

  function showAppLoaderFailure(message) {
    state.appBootFailed = true;

    setAppLoaderState(
      message || "Data sync failed",
      100
    );

    if (dom.appLoaderActions) {
      dom.appLoaderActions.hidden = false;
    }

    if (dom.appLoaderRetry) {
      dom.appLoaderRetry.disabled = false;
    }
  }

  function compareNumericVersions(a, b) {
    const left = String(a ?? "")
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);

    const right = String(b ?? "")
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);

    const length = Math.max(
      left.length,
      right.length
    );

    for (let index = 0; index < length; index += 1) {
      const x = left[index] || 0;
      const y = right[index] || 0;

      if (x > y) return 1;
      if (x < y) return -1;
    }

    return 0;
  }

  async function verifyBeingAppsScriptVersion() {
    const data = await apiGet("ping", {}, () => "Apps Script ping failed.");

    const requiredVersion = "3.4";
    const actualVersion =
      String(data.version ?? "0");

    if (
      compareNumericVersions(
        actualVersion,
        requiredVersion
      ) < 0
    ) {
      throw new Error(
        `Apps Script deployment is old (${actualVersion}). Deploy Code.gs ${requiredVersion}.`
      );
    }

    return data;
  }

  async function runBeingAppsScriptDiagnostic() {
    try {
      const data =
        await verifyBeingAppsScriptVersion();

      console.info(
        "[Being] Apps Script deployment:",
        data?.version || "unknown"
      );

      return {
        ok: true,
        version: data?.version || ""
      };
    } catch (error) {
      /*
       * IMPORTANT:
       * Deployment/version diagnostics must NEVER block
       * a working getClients feed.
       */
      console.warn(
        "[Being] Apps Script diagnostic warning:",
        error
      );

      return {
        ok: false,
        error
      };
    }
  }

  async function initializeApplication() {
    const minimumVisibleTime =
      new Promise((resolve) => {
        window.setTimeout(
          resolve,
          520
        );
      });

    state.appBootFailed = false;

    if (dom.appLoaderActions) {
      dom.appLoaderActions.hidden = true;
    }

    if (dom.appLoaderRetry) {
      dom.appLoaderRetry.disabled = true;
    }

    try {
      setAppLoaderState(
        "Starting application",
        12
      );

      if (
        !isBeingGoogleSheetConfigured()
      ) {
        throw new Error(
          "Open CRM through START_CRM.bat"
        );
      }

      /*
       * Version/deployment check is intentionally NON-BLOCKING.
       * A working getClients request is the source of truth
       * for whether the application can start.
       */
      setAppLoaderState(
        "Connecting to Google Sheet",
        34
      );

      runBeingAppsScriptDiagnostic();

      window.setTimeout(() => {
        if (
          !state.appBootFinished &&
          !state.appBootFailed
        ) {
          setAppLoaderState(
            "Syncing Being archive",
            68
          );
        }
      }, 180);

      const [, loaded] =
        await Promise.all([
          minimumVisibleTime,
          loadSheetsFromGoogle({
            throwOnError: true
          })
        ]);

      if (!loaded) {
        throw new Error(
          "Google Sheet returned no client data."
        );
      }

      setAppLoaderState(
        "Data loaded",
        100
      );

      await new Promise((resolve) => {
        window.setTimeout(
          resolve,
          180
        );
      });

      hideAppLoader();
      return true;

    } catch (error) {
      console.error(
        "[VIP CRM] Initial data load failed:",
        error
      );

      /*
       * Show the ACTUAL bridge / Apps Script error on screen.
       */
      showAppLoaderFailure(
        error?.message ||
        "Initial data load failed"
      );

      return false;
    }
  }

  /*
   * Net Loss is what the client actually left behind: deposits minus
   * withdrawals. It is derived rather than stored, so a period with neither
   * side has no net loss at all and shows a dash instead of a half-truth.
   */
  function deriveNetLoss(deposits, withdrawals) {
    const inflow = normalizeOptionalNumber(deposits);
    const outflow = normalizeOptionalNumber(withdrawals);
    if (inflow === null && outflow === null) return null;
    return (inflow ?? 0) - (outflow ?? 0);
  }

  function getNestedValue(object, path) {
    return path.split(".").reduce((current, key) => current?.[key], object);
  }

  function renderPerformance() {
    const client = state.selectedClient;
    if (!client) return;
    const periodData = client.performance?.[state.profilePeriod] || {};
    for (const cell of dom.clients.performanceCells) {
      cell.textContent = formatOptionalMoney(getNestedValue(periodData, cell.dataset.performance));
    }
  }

  function setProfilePeriod(period) {
    if (!VALID_PROFILE_PERIODS.has(period)) return;
    if (state.profilePeriod === period && state.selectedClient) {
      renderPerformance();
      return;
    }

    state.profilePeriod = period;

    for (const button of dom.clients.periodButtons) {
      const active = button.dataset.profilePeriod === period;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    }

    renderPerformance();

    if (
      dom.clients.performanceTable &&
      typeof dom.clients.performanceTable.animate === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      dom.clients.performanceTable.getAnimations().forEach((animation) => animation.cancel());

      dom.clients.performanceTable.animate(
        [
          { opacity: 0.68, transform: "translate3d(0, 3px, 0)" },
          { opacity: 1, transform: "translate3d(0, 0, 0)" }
        ],
        {
          duration: 170,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)"
        }
      );
    }
  }

  function createEmptyQuest() {
    return {
      name: "",
      progress: 0,
      mechanic: DEFAULT_QUEST_MECHANIC,
      section: DEFAULT_QUEST_SECTION,
      currency: DEFAULT_QUEST_CURRENCY,
      goal: null,
      start: "",
      end: "",
      openEnded: false,
      conditions: [],
      reward: ""
    };
  }

  function hasQuestContent(quest) {
    return Boolean(
      String(quest?.name ?? "").trim() ||
      String(quest?.start ?? "").trim() ||
      String(quest?.end ?? "").trim() ||
      normalizeOptionalNumber(quest?.goal) !== null ||
      String(quest?.reward ?? "").trim() ||
      (Array.isArray(quest?.conditions) && quest.conditions.some((value) => String(value ?? "").trim()))
    );
  }

  // v1.4.1: quest state is source-driven only.
  // Nothing is read from or written to browser storage.
  function isQuestInactive(client) {
    return !hasQuestContent(client?.quest);
  }

  function getEffectiveQuest(client) {
    return hasQuestContent(client?.quest)
      ? client.quest
      : createEmptyQuest();
  }

  // Quest state is source-driven only; this just guarantees the shape the
  // profile and the editor read, for a client built without one.
  function ensureClientQuestShape(client) {
    if (!client) return client;
    if (!client.quest || typeof client.quest !== "object") {
      client.quest = createEmptyQuest();
      invalidateQuestProgressCache();
    }
    if (!Array.isArray(client.questHistory)) {
      client.questHistory = [];
    }
    return client;
  }

  function showQuestSaveStatus(message) {
    window.clearTimeout(state.questSaveStatusTimer);

    const button = dom.clients.questSaveButton;
    if (!button) return;

    if (message === "Save failed") {
      button.setAttribute("title", "Save failed");
      button.setAttribute("aria-label", "Save failed");
    } else {
      button.setAttribute("title", "Save");
      button.setAttribute("aria-label", "Save quest changes");
    }

    state.questSaveStatusTimer = window.setTimeout(() => {
      if (dom.clients.questSaveButton) {
        dom.clients.questSaveButton.setAttribute("title", "Save");
        dom.clients.questSaveButton.setAttribute("aria-label", "Save quest changes");
      }
    }, 900);
  }

  function getQuestDraftFromInputs() {
    return {
      name: dom.clients.questDetailNameInput.value.trim(),
      mechanic: QUEST_MECHANICS[dom.clients.questMechanicSelect.value]
        ? dom.clients.questMechanicSelect.value
        : DEFAULT_QUEST_MECHANIC,
      section: QUEST_SECTIONS[dom.clients.questSectionSelect.value]
        ? dom.clients.questSectionSelect.value
        : DEFAULT_QUEST_SECTION,
      currency: QUEST_CURRENCIES[dom.clients.questCurrencySelect.value]
        ? dom.clients.questCurrencySelect.value
        : DEFAULT_QUEST_CURRENCY,
      goal: normalizeOptionalNumber(dom.clients.questGoalInput.value),
      start: dom.clients.questDetailStartInput.value.trim(),
      end: dom.clients.questDetailEndInput.value.trim(),
      openEnded: dom.clients.questEndNoLimitToggle.getAttribute("aria-pressed") === "true",
      conditions: dom.clients.questConditionsInput.value
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      reward: dom.clients.questRewardInput.value.trim()
    };
  }

  function serializeQuestDraft(draft) {
    return JSON.stringify({
      name: String(draft?.name ?? "").trim(),
      mechanic: QUEST_MECHANICS[draft?.mechanic]
        ? draft.mechanic
        : DEFAULT_QUEST_MECHANIC,
      // The effective section is serialized, so switching to Net Loss and back
      // cannot register as a pending edit while the selector sits disabled.
      section: getEffectiveQuestSection(draft, draft?.mechanic),
      currency: getEffectiveQuestCurrency(draft),
      goal: normalizeOptionalNumber(draft?.goal),
      start: String(draft?.start ?? ""),
      end: String(draft?.end ?? ""),
      openEnded: Boolean(draft?.openEnded),
      conditions: Array.isArray(draft?.conditions)
        ? draft.conditions.map((value) => String(value ?? "").trim()).filter(Boolean)
        : [],
      reward: String(draft?.reward ?? "")
    });
  }

  /*
    The section selector stays visible for Net Loss but is locked and forced
    back to the combined section, so the card cannot show a scope that has no
    source behind it.
  */
  function updateQuestSectionAvailability(readOnly = !state.questEditMode) {
    const mechanic = QUEST_MECHANICS[dom.clients.questMechanicSelect.value]
      ? dom.clients.questMechanicSelect.value
      : DEFAULT_QUEST_MECHANIC;
    const applicable = isQuestSectionApplicable(mechanic);

    if (!applicable) {
      dom.clients.questSectionSelect.value = DEFAULT_QUEST_SECTION;
    }

    dom.clients.questSectionSelect.disabled = readOnly || !applicable;
    dom.clients.questSectionSelect.title = applicable
      ? ""
      : "Net Loss has no per-section source and always counts Casino + Sport.";
  }


  function updateQuestGoalCurrencyLabel() {
    const currency = QUEST_CURRENCIES[dom.clients.questCurrencySelect.value]
      ? dom.clients.questCurrencySelect.value
      : DEFAULT_QUEST_CURRENCY;

    dom.clients.questGoalLabel.textContent = `Tracking Goal, ${currency}`;
  }


  /**
   * Applies the No limit state to the End Date field. The switch stays visible
   * in the locked view because it states a fact about the quest; it is only
   * made inert there.
   */
  function updateQuestEndAvailability(readOnly = !state.questEditMode) {
    const openEnded = dom.clients.questEndNoLimitToggle.getAttribute("aria-pressed") === "true";

    dom.clients.questEndField.classList.toggle("is-open-ended", openEnded);
    dom.clients.questEndNoLimitNote.hidden = !openEnded;
    dom.clients.questEndNoLimitToggle.disabled = readOnly;
    // readonly leaves the native picker reachable on several browsers, so the
    // locked state and the open-ended state both use disabled instead.
    dom.clients.questDetailEndInput.disabled = readOnly || openEnded;

    if (openEnded) dom.clients.questDetailEndInput.value = "";
  }


  function setQuestOpenEnded(openEnded) {
    dom.clients.questEndNoLimitToggle.setAttribute("aria-pressed", openEnded ? "true" : "false");
    updateQuestEndAvailability();
  }


  function toggleQuestOpenEnded() {
    if (!state.questEditMode) return;
    setQuestOpenEnded(dom.clients.questEndNoLimitToggle.getAttribute("aria-pressed") !== "true");
    updateQuestDirtyState();
  }

  function setQuestFieldsReadOnly(readOnly) {
    dom.clients.questDetailNameInput.readOnly = readOnly;
    dom.clients.questMechanicSelect.disabled = readOnly;
    updateQuestSectionAvailability(readOnly);
    dom.clients.questCurrencySelect.disabled = readOnly;
    dom.clients.questGoalInput.readOnly = readOnly;
    // Date inputs lock with disabled, not readonly: see updateQuestEndAvailability.
    dom.clients.questDetailStartInput.disabled = readOnly;
    updateQuestEndAvailability(readOnly);
    dom.clients.questConditionsInput.readOnly = readOnly;
    dom.clients.questRewardInput.readOnly = readOnly;
  }

  /*
    Progress depends on the mechanic, section, currency, goal and dates only.
    Name, conditions and reward are typed far more and change nothing in the
    tracking, so their keystrokes skip the walk over the daily grid.
  */
  function updateQuestDirtyState({ progress = true } = {}) {
    updateQuestSectionAvailability();
    if (progress && state.selectedClient) {
      renderQuestLiveProgress(state.selectedClient, getQuestDraftFromInputs());
    }
    const dirty =
      state.questEditMode &&
      serializeQuestDraft(getQuestDraftFromInputs()) !== state.questDraftBaseline;

    dom.clients.questView.classList.toggle("is-dirty", dirty);
    return dirty;
  }

  function setQuestEditMode(enabled) {
    state.questEditMode = Boolean(enabled);

    dom.clients.questView.classList.toggle("is-editing", state.questEditMode);
    dom.clients.questEditButton.classList.toggle("is-editing", state.questEditMode);
    dom.clients.questEditButton.setAttribute(
      "aria-label",
      state.questEditMode ? "Editing quest" : "Edit quest"
    );
    dom.clients.questEditButton.setAttribute(
      "title",
      state.questEditMode ? "Editing quest" : "Edit quest"
    );

    setQuestFieldsReadOnly(!state.questEditMode);

    // Completion always uses the last current quest state.
    // While editing, save first so history cannot capture stale values.
    if (state.questEditMode) {
      dom.clients.questCompleteButton.disabled = true;
    } else if (state.selectedClient) {
      renderQuestCompletionState(state.selectedClient);
    }

    if (state.questEditMode) {
      state.questDraftBaseline = serializeQuestDraft(getQuestDraftFromInputs());
      dom.clients.questView.classList.remove("is-dirty");

      window.requestAnimationFrame(() => {
        dom.clients.questDetailNameInput.focus({ preventScroll: true });
        dom.clients.questDetailNameInput.select();
      });
    } else {
      dom.clients.questView.classList.remove("is-dirty");
      dom.clients.questEditButton.blur();
    }
  }

  function enterQuestEditMode() {
    if (state.questEditMode) return;
    setQuestEditMode(true);
  }

  async function saveActiveQuestToGoogleSheet(client, draft) {
    if (!isBeingGoogleSheetConfigured()) {
      throw new Error("Open CRM through START_CRM.bat to save the quest.");
    }

    const clientId = String(client?.clientId ?? "").trim();
    if (!clientId) throw new Error("ID is empty.");

    const activeQuest = serializeActiveQuestCell(draft);
    const data = await apiPost(
      BEING_GOOGLE_SHEET.LOCAL_API_URL,
      { action: "updateActiveQuest", clientId, activeQuest },
      (response) => `Quest save failed (HTTP ${response.status}). Deploy Code.gs 3.4.`
    );

    const confirmedValue =
      typeof data.activeQuest === "string"
        ? data.activeQuest
        : typeof data?.client?.activeQuest === "string"
          ? data.client.activeQuest
          : null;

    if (confirmedValue === null) {
      throw new Error("Apps Script did not return the saved Active Quest cell.");
    }

    if (String(confirmedValue).trim() !== activeQuest) {
      throw new Error("Active Quest verification failed after write.");
    }

    return parseActiveQuestCell(confirmedValue, client?.quest);
  }

  async function saveQuestEdits() {
    const client = state.selectedClient;
    if (!client || !state.questEditMode || state.questSaveInProgress) return;

    const edits = getQuestDraftFromInputs();
    state.questSaveInProgress = true;
    dom.clients.questSaveButton.disabled = true;
    // Without this the button just goes quiet: the old status only changed a
    // title attribute, so a slow save was indistinguishable from a dead one.
    dom.clients.questSaveButton.classList.add("is-saving");
    dom.clients.questSaveButton.setAttribute("title", "Saving…");

    try {
      const confirmedQuest = await trackPendingWrite(
        saveActiveQuestToGoogleSheet(client, edits)
      );

      client.quest = {
        ...confirmedQuest,
        mechanic: QUEST_MECHANICS[edits.mechanic]
          ? edits.mechanic
          : confirmedQuest.mechanic
      };

      invalidateQuestProgressCache();

      renderProfile(client);
      state.questDraftBaseline = serializeQuestDraft(edits);
      dom.clients.questView.classList.remove("is-dirty");
      renderQuestDetail(client);
      setQuestEditMode(false);

      showQuestSaveStatus("Saved online");
    } catch (error) {
      console.error("Could not save quest edits:", error);
      showQuestSaveStatus("Save failed");
    } finally {
      state.questSaveInProgress = false;
      dom.clients.questSaveButton.disabled = false;
      dom.clients.questSaveButton.classList.remove("is-saving");
    }
  }

  function readQuestHistory(client) {
    const history = Array.isArray(client?.questHistory)
      ? client.questHistory
      : [];

    return history
      .filter((item) => item && typeof item === "object")
      .slice()
      .sort((a, b) => normalizeNumber(b.completedAt) - normalizeNumber(a.completedAt));
  }

  function writeQuestHistory(client, history) {
    if (!client) return;
    // Session/source object only. No browser persistence.
    client.questHistory = Array.isArray(history) ? history.slice() : [];
  }

  function getQuestSignature(quest) {
    const section = getEffectiveQuestSection(quest);
    const currency = getEffectiveQuestCurrency(quest);

    return JSON.stringify({
      name: String(quest?.name ?? "").trim(),
      mechanic: QUEST_MECHANICS[quest?.mechanic] ? quest.mechanic : DEFAULT_QUEST_MECHANIC,
      // Only a narrowed section joins the signature. The combined section is
      // left out so signatures recorded before sections existed keep matching
      // and already completed quests do not reopen.
      section: section === DEFAULT_QUEST_SECTION ? undefined : section,
      // Currency follows the same rule for the same reason: EUR is what every
      // quest written before currencies existed was denominated in.
      currency: currency === DEFAULT_QUEST_CURRENCY ? undefined : currency,
      goal: normalizeOptionalNumber(quest?.goal),
      start: String(quest?.start ?? "").trim(),
      end: String(quest?.end ?? "").trim(),
      // And again: false is the state every earlier quest was in.
      openEnded: quest?.openEnded ? true : undefined,
      reward: String(quest?.reward ?? "").trim()
    });
  }

  function isCurrentQuestCompleted(client) {
    if (!client) return false;
    const signature = getQuestSignature(getEffectiveQuest(client));
    return readQuestHistory(client).some((item) => item.signature === signature);
  }

  function parseQuestStartTimestamp(value) {
    const parsed = parseManualBonusDate(value);
    return Number.isFinite(parsed.timestamp) ? parsed.timestamp : null;
  }

  function calculateQuestCompletionDays(startValue, completedAt = Date.now()) {
    const startTimestamp = parseQuestStartTimestamp(startValue);
    if (!Number.isFinite(startTimestamp)) return null;

    const start = new Date(startTimestamp);
    const finish = new Date(completedAt);
    const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const finishDay = Date.UTC(finish.getFullYear(), finish.getMonth(), finish.getDate());
    if (finishDay < startDay) return 1;
    return Math.max(1, Math.floor((finishDay - startDay) / 86400000) + 1);
  }

  function formatQuestDuration(days) {
    if (!Number.isFinite(days)) return "—";
    return `${days} ${days === 1 ? "day" : "days"}`;
  }

  function renderQuestCompletionState(client) {
    const inactive = isQuestInactive(client);
    const completed = !inactive && isCurrentQuestCompleted(client);

    dom.clients.questCompleteButton.classList.toggle("is-completed", completed);
    dom.clients.questCompleteButton.classList.toggle("is-inactive", inactive);
    dom.clients.questCompleteButton.disabled = inactive || completed;
    dom.clients.questCompleteButtonText.textContent = inactive
      ? "No quest"
      : completed
        ? "Completed"
        : "Complete";
  }

  function syncQuestNameToMechanic() {
    const client = state.selectedClient;
    if (!client) return;

    if (!state.questEditMode) {
      setQuestEditMode(true);
    }

    const mechanic = QUEST_MECHANICS[dom.clients.questMechanicSelect.value]
      ? dom.clients.questMechanicSelect.value
      : DEFAULT_QUEST_MECHANIC;
    const mechanicName = QUEST_MECHANICS[mechanic].label;

    dom.clients.questDetailNameInput.value = mechanicName;

    updateQuestDirtyState();
  }

  function createQuestHistoryRow(item) {
    const row = document.createElement("div");
    row.className = "quest-history-row";

    const name = document.createElement("div");
    name.className = "quest-history-row__name";
    name.textContent = item.name || "Quest";

    const time = document.createElement("div");
    time.className = "quest-history-row__time";
    time.textContent = formatQuestDuration(item.days);

    const prize = document.createElement("div");
    prize.className = "quest-history-row__prize";
    prize.textContent = item.reward || "—";

    row.append(name, time, prize);
    return row;
  }

  function renderQuestHistory(client) {
    const history = readQuestHistory(client);
    dom.questHistory.client.textContent = `${client?.name || "Name"} · ID: ${client?.clientId ?? "1"}`;

    const fragment = document.createDocumentFragment();
    if (!history.length) {
      const empty = document.createElement("div");
      empty.className = "quest-history-empty";
      empty.textContent = "No completed quests yet";
      fragment.appendChild(empty);
    } else {
      history.forEach((item) => fragment.appendChild(createQuestHistoryRow(item)));
    }
    dom.questHistory.list.replaceChildren(fragment);
    dom.questHistory.list.scrollTop = 0;
  }

  function openQuestHistory() {
    const client = state.selectedClient;
    if (!client || state.questHistoryOpen) return;

    renderQuestHistory(client);
    state.questHistoryOpen = true;
    state.questHistoryReturnFocus = document.activeElement;
    dom.questHistory.overlay.classList.add("is-open");
    dom.questHistory.overlay.setAttribute("aria-hidden", "false");
    if ("inert" in dom.app) dom.app.inert = true;
    window.requestAnimationFrame(() => dom.questHistory.close.focus({ preventScroll: true }));
  }

  function closeQuestHistory({ restoreFocus = true } = {}) {
    if (!state.questHistoryOpen) return;
    state.questHistoryOpen = false;
    dom.questHistory.overlay.classList.remove("is-open");
    dom.questHistory.overlay.setAttribute("aria-hidden", "true");
    if ("inert" in dom.app) dom.app.inert = false;

    const returnFocus = state.questHistoryReturnFocus;
    state.questHistoryReturnFocus = null;
    if (restoreFocus && returnFocus?.focus) {
      window.requestAnimationFrame(() => returnFocus.focus({ preventScroll: true }));
    }
  }

  function openQuestCompletionConfirm(progress) {
    state.questConfirmOpen = true;
    state.questConfirmReturnFocus = document.activeElement;
    dom.questConfirm.text.textContent = `Quest progress is ${formatNumber(progress)}%. Are you sure you want to complete it now?`;
    dom.questConfirm.overlay.classList.add("is-open");
    dom.questConfirm.overlay.setAttribute("aria-hidden", "false");
    if ("inert" in dom.app) dom.app.inert = true;
    window.requestAnimationFrame(() => dom.questConfirm.continueButton.focus({ preventScroll: true }));
  }

  function closeQuestCompletionConfirm({ restoreFocus = true } = {}) {
    if (!state.questConfirmOpen) return;
    state.questConfirmOpen = false;
    dom.questConfirm.overlay.classList.remove("is-open");
    dom.questConfirm.overlay.setAttribute("aria-hidden", "true");
    if ("inert" in dom.app) dom.app.inert = false;

    const returnFocus = state.questConfirmReturnFocus;
    state.questConfirmReturnFocus = null;
    if (restoreFocus && returnFocus?.focus) {
      window.requestAnimationFrame(() => returnFocus.focus({ preventScroll: true }));
    }
  }

  async function completeCurrentQuest() {
    const client = state.selectedClient;
    if (
      !client ||
      isQuestInactive(client) ||
      isCurrentQuestCompleted(client) ||
      state.questSaveInProgress
    ) return;

    const quest = getEffectiveQuest(client);
    const completedAt = Date.now();
    const history = readQuestHistory(client);
    const entry = {
      id: `quest-${completedAt}-${Math.random().toString(36).slice(2, 8)}`,
      signature: getQuestSignature(quest),
      name: String(quest.name || QUEST_MECHANICS[quest.mechanic]?.label || "Quest"),
      mechanic: QUEST_MECHANICS[quest.mechanic] ? quest.mechanic : DEFAULT_QUEST_MECHANIC,
      goal: normalizeOptionalNumber(quest.goal),
      currency: getEffectiveQuestCurrency(quest),
      start: String(quest.start ?? ""),
      end: quest.openEnded ? QUEST_OPEN_END_TEXT : String(quest.end ?? ""),
      completedAt,
      completedDate: new Date(completedAt).toLocaleDateString("en-GB"),
      days: calculateQuestCompletionDays(quest.start, completedAt),
      reward: String(quest.reward ?? "").trim() || "—"
    };

    state.questSaveInProgress = true;
    dom.clients.questCompleteButton.disabled = true;

    try {
      const clearedQuest = await trackPendingWrite(
        saveActiveQuestToGoogleSheet(client, createEmptyQuest())
      );

      writeQuestHistory(client, [entry, ...history]);
      client.quest = clearedQuest;
      invalidateQuestProgressCache();

      renderProfile(client);
      renderQuestDetail(client);
      if (state.questHistoryOpen) renderQuestHistory(client);
      showQuestSaveStatus("Saved online");
    } catch (error) {
      console.error("Could not complete quest online:", error);
      showQuestSaveStatus("Save failed");
      renderQuestCompletionState(client);
    } finally {
      state.questSaveInProgress = false;
    }
  }

  function requestQuestCompletion() {
    const client = state.selectedClient;
    if (!client || isQuestInactive(client) || isCurrentQuestCompleted(client)) return;
    const quest = getEffectiveQuest(client);
    const tracking = calculateQuestProgress(client, quest);
    const progress = tracking.percent ?? 0;
    if (tracking.completed) {
      completeCurrentQuest();
      return;
    }
    openQuestCompletionConfirm(progress);
  }

  function parseManualBonusDate(value) {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return { display: value.toISOString().slice(0, 10), timestamp: value.getTime() };
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      let timestamp = null;

      if (value > 1e11) timestamp = value;
      else if (value > 1e9) timestamp = value * 1000;
      else if (value >= 20000 && value <= 100000) {
        timestamp = Date.UTC(1899, 11, 30) + value * 86400000;
      }

      if (timestamp !== null) {
        const date = new Date(timestamp);
        if (Number.isFinite(date.getTime())) {
          return { display: date.toISOString().slice(0, 10), timestamp: date.getTime() };
        }
      }
    }

    const text = String(value ?? "").trim();
    if (!text) return { display: "", timestamp: Number.NEGATIVE_INFINITY };

    const dmyMatch = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:\s+.*)?$/);
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      const year = Number(dmyMatch[3]);
      const timestamp = Date.UTC(year, month - 1, day);
      const date = new Date(timestamp);

      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      ) {
        return { display: text, timestamp };
      }
    }

    const parsed = Date.parse(text);
    return {
      display: text,
      timestamp: Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
    };
  }

  /*
    Bonus History is an independent data domain: it must never pull completed
    quests or rewards from Current Quest / Quest History. Its own sheet is not
    bound yet, so the summary shows the profile totals over an empty list.
  */
  function getManualBonusSummary(client) {
    return {
      total: normalizeNumber(client?.bonuses?.total),
      lastDate: client?.bonuses?.lastDate ?? "1",
      lastAmount: normalizeNumber(client?.bonuses?.lastAmount),
      records: []
    };
  }

  function createBonusHistoryRow(record) {
    const row = document.createElement("div");
    row.className = "bonus-history-row";

    const date = document.createElement("div");
    date.className = "bonus-history-row__date";
    date.textContent = record.date || "1";

    const name = document.createElement("div");
    name.className = "bonus-history-row__name";
    name.textContent = record.name || "Bonus Name";

    const amount = document.createElement("div");
    amount.className = "bonus-history-row__amount";
    amount.textContent = formatMoney(record.amount);

    row.append(date, name, amount);
    return row;
  }

  function renderBonusHistory(client) {
    const summary = getManualBonusSummary(client);

    dom.bonusHistory.client.textContent =
      `${client?.name || "Name"} · ID: ${client?.clientId ?? "1"}`;
    dom.bonusHistory.total.textContent = formatMoney(summary.total);
    dom.bonusHistory.lastDate.textContent = String(summary.lastDate);
    dom.bonusHistory.lastAmount.textContent = formatMoney(summary.lastAmount);

    const fragment = document.createDocumentFragment();
    const records = summary.records;

    // IMPORTANT:
    // Bonus History is an independent data domain.
    // It must NEVER pull completed quests or quest rewards from Current Quest / Quest History.
    // Later this list will be populated only by the dedicated bonus Google Sheet adapter.
    records.forEach((record) => {
      fragment.appendChild(createBonusHistoryRow(record));
    });

    if (!records.length) {
      const empty = document.createElement("div");
      empty.className = "bonus-history-empty";
      empty.textContent = "No bonus history";
      fragment.appendChild(empty);
    }

    dom.bonusHistory.list.replaceChildren(fragment);
    dom.bonusHistory.list.scrollTop = 0;
  }

  function openBonusHistory(client = state.selectedClient, returnFocus = document.activeElement) {
    if (!client || state.bonusHistoryOpen) return;

    renderBonusHistory(client);

    state.bonusHistoryOpen = true;
    state.bonusHistoryReturnFocus = returnFocus;
    state.bonusHistoryClientKey = client._key;

    dom.bonusHistory.overlay.classList.add("is-open");
    dom.bonusHistory.overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-bonus-modal-open");

    // The modal is outside #app, so inert blocks keyboard interaction with the CRM behind it.
    if (dom.app && "inert" in dom.app) dom.app.inert = true;
    if (state.reactivationCardOpen && "inert" in dom.reactivation.card.modal) {
      dom.reactivation.card.modal.inert = true;
    }
    if (state.beingCardOpen && "inert" in dom.being.card.modal) {
      dom.being.card.modal.inert = true;
    }

    window.requestAnimationFrame(() => {
      dom.bonusHistory.close.focus({ preventScroll: true });
    });
  }

  function closeBonusHistory({ restoreFocus = true } = {}) {
    if (!state.bonusHistoryOpen) return;

    state.bonusHistoryOpen = false;
    state.bonusHistoryClientKey = null;
    dom.bonusHistory.overlay.classList.remove("is-open");
    dom.bonusHistory.overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-bonus-modal-open");

    if (dom.app && "inert" in dom.app) {
      dom.app.inert = state.reactivationCardOpen || state.beingCardOpen;
    }
    if (state.reactivationCardOpen && "inert" in dom.reactivation.card.modal) {
      dom.reactivation.card.modal.inert = false;
    }
    if (state.beingCardOpen && "inert" in dom.being.card.modal) {
      dom.being.card.modal.inert = false;
    }

    const returnFocus = state.bonusHistoryReturnFocus;
    state.bonusHistoryReturnFocus = null;

    if (restoreFocus && returnFocus && typeof returnFocus.focus === "function") {
      window.requestAnimationFrame(() => {
        returnFocus.focus({ preventScroll: true });
      });
    }
  }

  function renderProfile(client) {
    dom.clients.profileAvatar.textContent = "1";
    dom.clients.profileClientName.textContent = client.name || "Name";
    dom.clients.profileClientId.textContent = `ID: ${client.clientId ?? ""}`;
    const inCurrentReactivationSheet = isClientOnReactivation(client.clientId);
    const onReactivation = shouldShowReactivationMembership(client.clientId);
    dom.clients.reactivationBadge.hidden = !onReactivation;
    dom.clients.reactivationAdd.hidden = inCurrentReactivationSheet;
    dom.clients.reactivationAdd.disabled = inCurrentReactivationSheet;
    dom.clients.sportActivity.textContent = formatOptionalMoney(client.whereHePlays?.sport);
    dom.clients.casinoActivity.textContent = formatOptionalMoney(client.whereHePlays?.casino);
    dom.clients.liveCasinoActivity.textContent = formatOptionalMoney(client.whereHePlays?.liveCasino);
    dom.clients.slotsActivity.textContent = formatOptionalMoney(client.whereHePlays?.slots);
    dom.clients.instantActivity.textContent = formatOptionalMoney(client.whereHePlays?.instant);

    const questInactive = isQuestInactive(client);
    const quest = getEffectiveQuest(client);
    const questTracking = calculateQuestProgress(client, quest);
    const progress = questInactive ? 0 : (questTracking.percent ?? 0);

    dom.clients.questName.textContent = questInactive
      ? "No Active Quest"
      : (quest.name || "Active Quest");
    dom.clients.questProgressFill.style.transform = `scaleX(${progress / 100})`;
    dom.clients.questProgressValue.textContent = questInactive || questTracking.percent === null
      ? "—"
      : `${formatNumber(progress)}%`;
    dom.clients.questStart.textContent = questInactive ? "—" : (quest.start ?? "1");
    dom.clients.questEnd.textContent = questInactive
      ? "—"
      : (quest.openEnded ? "No limit" : (quest.end ?? "1"));
    dom.clients.questOpen.classList.toggle("is-no-active-quest", questInactive);
    const bonusSummary = getManualBonusSummary(client);
    dom.clients.totalBonuses.textContent = formatMoney(bonusSummary.total);
    dom.clients.lastBonusDate.textContent = String(bonusSummary.lastDate);
    dom.clients.lastBonusAmount.textContent = formatMoney(bonusSummary.lastAmount);

    setProfilePeriod("day");
  }

  function setClientsView(view) {
    const directoryOpen = view === "directory";
    const profileOpen = view === "profile";
    const questOpen = view === "quest";
    const nestedOpen = profileOpen || questOpen;

    dom.clients.panel.classList.toggle("is-profile-mode", nestedOpen);

    dom.clients.directory.classList.toggle("is-view-active", directoryOpen);
    dom.clients.directory.setAttribute("aria-hidden", directoryOpen ? "false" : "true");
    if ("inert" in dom.clients.directory) dom.clients.directory.inert = !directoryOpen;

    dom.clients.profileView.classList.toggle("is-view-active", profileOpen);
    dom.clients.profileView.setAttribute("aria-hidden", profileOpen ? "false" : "true");
    if ("inert" in dom.clients.profileView) dom.clients.profileView.inert = !profileOpen;

    dom.clients.questView.classList.toggle("is-view-active", questOpen);
    dom.clients.questView.setAttribute("aria-hidden", questOpen ? "false" : "true");
    if ("inert" in dom.clients.questView) dom.clients.questView.inert = !questOpen;

  }

  /*
    Quest progress walks the whole daily grid, and the Being list asked for it
    once per row on every render - including every keystroke in the search box.
    The result only changes when quest data or the daily grid changes, so it is
    held until one of those does.

    Only the default path is cached. Calls that pass an explicit quest - a
    draft being edited, or the copy a Reactivation row carries - are computed
    directly, because their input is not the client's stored quest.
  */
  const questProgressCache = new Map();

  function invalidateQuestProgressCache() {
    questProgressCache.clear();
  }

  function getClientQuestProgress(client) {
    const key = client?._key;
    if (!key) return calculateQuestProgress(client, getEffectiveQuest(client));

    if (questProgressCache.has(key)) return questProgressCache.get(key);

    const tracking = calculateQuestProgress(client, getEffectiveQuest(client));
    questProgressCache.set(key, tracking);
    return tracking;
  }


  function calculateQuestProgress(client, quest = getEffectiveQuest(client)) {
    const mechanic = QUEST_MECHANICS[quest?.mechanic]
      ? quest.mechanic
      : DEFAULT_QUEST_MECHANIC;
    const section = getEffectiveQuestSection(quest, mechanic);
    const sectionConfig = QUEST_SECTIONS[section];
    const turnoverField = sectionConfig.turnoverField;
    const currency = getEffectiveQuestCurrency(quest);
    // The goal is entered in the quest currency and stays in it. Sheet sums
    // are converted up to meet it, so both sides of the comparison and both
    // sides of the readout speak the same currency.
    const goal = normalizeOptionalNumber(quest?.goal);
    const start = normalizeBeingDateValue(quest?.start);
    const openEnded = Boolean(quest?.openEnded);
    const end = openEnded ? "" : normalizeBeingDateValue(quest?.end);
    const daily = client?.questDaily && typeof client.questDaily === "object"
      ? client.questDaily
      : {};
    const result = {
      mechanic,
      section,
      sectionLabel: sectionConfig.label,
      currency,
      goal,
      start,
      end,
      openEnded,
      effectiveEnd: "",
      percent: null,
      completed: false,
      available: false,
      primaryLabel: mechanic === "net_loss"
        ? "NET LOSS"
        : `TO${sectionConfig.suffix}`,
      primaryValue: null,
      secondaryLabel: mechanic === "turnover_insurance" ? "GGR" : "",
      secondaryValue: null,
      status: openEnded ? "Set a start date and goal" : "Set dates and goal",
      tone: "muted"
    };

    if (!start) return result;
    if (!openEnded && !end) return result;
    if (!openEnded && start > end) {
      result.status = "End date is before start date";
      result.tone = "danger";
      return result;
    }
    if (goal === null || goal <= 0) {
      result.status = "Set a tracking goal";
      return result;
    }

    // Turnover Insurance deliberately requires TOTAL ggr next to the scoped
    // turnover: the GGR condition is never narrowed to the chosen section.
    const requiredFields = mechanic === "turnover"
      ? [turnoverField]
      : mechanic === "turnover_insurance"
        ? [turnoverField, "ggr"]
        // Net Loss needs deposits to mean anything; a client who never
        // withdrew has an empty withdrawal section, and that is a zero
        // outflow rather than missing data.
        : ["deposits"];
    const allRows = Object.values(daily);
    const fieldsAvailable = requiredFields.every(field =>
      allRows.some(row => normalizeOptionalNumber(row?.[field]) !== null)
    );
    // An open-ended quest is bounded on the left only: it counts every day the
    // sheet currently holds from the start date onwards.
    const selectedDates = Object.keys(daily)
      .filter(date => date >= start && (openEnded || date <= end))
      .sort();
    const selectedRows = selectedDates.map(date => daily[date]);

    if (!fieldsAvailable || !selectedRows.length) {
      result.status = section === DEFAULT_QUEST_SECTION
        ? "Data unavailable for this period"
        : `No ${sectionConfig.label} data for this period`;
      return result;
    }

    result.effectiveEnd = selectedDates[selectedDates.length - 1];

    const sum = (field) => selectedRows.reduce(
      (total, row) => total + (normalizeOptionalNumber(row?.[field]) ?? 0),
      0
    );
    const turnover = convertEurToQuestCurrency(sum(turnoverField), currency);
    const ggr = convertEurToQuestCurrency(sum("ggr"), currency);
    const deposits = convertEurToQuestCurrency(sum("deposits"), currency);
    const withdrawals = convertEurToQuestCurrency(sum("withdrawals"), currency);
    const current = mechanic === "net_loss" ? deposits - withdrawals : turnover;
    const basePercent = Math.max(0, Math.min(100, current / goal * 100));

    result.available = true;
    result.primaryValue = current;
    result.secondaryValue = mechanic === "turnover_insurance" ? ggr : null;
    result.completed = current >= goal && (mechanic !== "turnover_insurance" || ggr > 0);
    result.percent = mechanic === "turnover_insurance" && current >= goal && ggr <= 0
      ? 99
      : basePercent;

    if (result.completed) {
      result.status = "Completed";
      result.tone = "success";
    } else if (mechanic === "turnover_insurance" && ggr < 0) {
      result.status = current >= goal ? "TO reached · GGR is negative" : "GGR is negative";
      result.tone = "danger";
    } else if (mechanic === "turnover_insurance" && current >= goal && ggr === 0) {
      result.status = "TO reached · GGR must be positive";
      result.tone = "muted";
    } else if (openEnded) {
      result.status = `${formatNumber(result.percent)}% completed · up to ${result.effectiveEnd}`;
      result.tone = "muted";
    } else {
      result.status = `${formatNumber(result.percent)}% completed`;
      result.tone = "muted";
    }
    return result;
  }

  function renderQuestLiveProgress(client, quest) {
    const tracking = calculateQuestProgress(client, quest);
    const percent = tracking.percent ?? 0;
    dom.clients.questDetailProgressValue.textContent = tracking.percent === null
      ? "—"
      : `${formatNumber(tracking.percent)}%`;
    dom.clients.questDetailProgressFill.style.transform = `scaleX(${percent / 100})`;
    dom.clients.questDetailProgressFill.classList.toggle("is-success", tracking.tone === "success");
    dom.clients.questDetailProgressFill.classList.toggle("is-danger", tracking.tone === "danger");
    dom.clients.questProgressPrimaryLabel.textContent = tracking.primaryLabel;
    const money = (value) => formatQuestMoney(value, tracking.currency);
    dom.clients.questProgressPrimaryValue.textContent = tracking.available
      ? `${money(tracking.primaryValue)} / ${money(tracking.goal)}`
      : `— / ${tracking.goal > 0 ? money(tracking.goal) : "—"}`;
    const showSecondary = tracking.mechanic === "turnover_insurance";
    dom.clients.questProgressSecondary.hidden = !showSecondary;
    dom.clients.questProgressSecondaryValue.textContent = tracking.available
      ? money(tracking.secondaryValue)
      : "—";
    dom.clients.questProgressSecondaryValue.classList.toggle(
      "is-positive",
      tracking.available && tracking.secondaryValue > 0
    );
    dom.clients.questProgressSecondaryValue.classList.toggle(
      "is-negative",
      tracking.available && tracking.secondaryValue < 0
    );
    dom.clients.questProgressStatus.textContent = tracking.status;
    dom.clients.questProgressStatus.className = `quest-live-progress__status is-${tracking.tone}`;
    return tracking;
  }

  function renderQuestDetail(client) {
    const inactive = isQuestInactive(client);
    const quest = getEffectiveQuest(client);
    dom.clients.questDetailNameInput.value = inactive ? "" : (quest.name || "Active Quest");

    const mechanic = QUEST_MECHANICS[quest.mechanic]
      ? quest.mechanic
      : DEFAULT_QUEST_MECHANIC;

    dom.clients.questMechanicSelect.value = mechanic;
    dom.clients.questSectionSelect.value = getEffectiveQuestSection(quest, mechanic);
    updateQuestSectionAvailability();
    dom.clients.questCurrencySelect.value = getEffectiveQuestCurrency(quest);
    updateQuestGoalCurrencyLabel();
    dom.clients.questGoalInput.value = normalizeOptionalNumber(quest.goal) ?? "";
    renderQuestLiveProgress(client, quest);

    // Date inputs only accept ISO, so stored sheet formats are normalized here.
    dom.clients.questDetailStartInput.value = normalizeBeingDateValue(quest.start);
    setQuestOpenEnded(Boolean(quest.openEnded));
    dom.clients.questDetailEndInput.value = quest.openEnded
      ? ""
      : normalizeBeingDateValue(quest.end);

    const conditions = Array.isArray(quest.conditions)
      ? quest.conditions
      : [];

    dom.clients.questConditionsInput.value = conditions
      .map((condition) => String(condition ?? "").trim())
      .filter(Boolean)
      .join("\n");

    dom.clients.questRewardInput.value = String(quest.reward ?? "");

    state.questDraftBaseline = serializeQuestDraft(getQuestDraftFromInputs());

    if (inactive) {
      setQuestEditMode(true);
    } else {
      setQuestEditMode(false);
      renderQuestCompletionState(client);
    }
  }

  function openQuestDetail() {
    const client = state.selectedClient;
    if (!client) return;

    renderQuestDetail(client);
    const fromBeing = state.questNavigationOrigin?.type === "being";
    const fromReactivation = state.questNavigationOrigin?.type === "reactivation";
    dom.clients.questBeingBack.hidden = !fromBeing;
    dom.clients.questBeingBack.setAttribute("aria-hidden", fromBeing ? "false" : "true");
    dom.clients.questReactivationBack.hidden = !fromReactivation;
    dom.clients.questReactivationBack.setAttribute("aria-hidden", fromReactivation ? "false" : "true");
    dom.clients.questDetail.scrollTop = 0;

    window.requestAnimationFrame(() => {
      setClientsView("quest");
    });
  }

  function openQuestFromProfile() {
    const client = state.selectedClient;
    if (!client) return;
    state.questNavigationOrigin = {
      type: "profile",
      clientKey: client._key,
      clientId: String(client.clientId ?? "")
    };
    openQuestDetail();
  }

  function returnToClientProfile() {
    if (!state.selectedClient) {
      showClientsDirectory();
      return;
    }

    setQuestEditMode(false);
    state.questNavigationOrigin = null;
    dom.clients.questBeingBack.hidden = true;
    dom.clients.questBeingBack.setAttribute("aria-hidden", "true");
    dom.clients.questReactivationBack.hidden = true;
    dom.clients.questReactivationBack.setAttribute("aria-hidden", "true");

    window.requestAnimationFrame(() => {
      setClientsView("profile");
    });
  }

  function openClientProfile(client, { preserveQuestOrigin = false } = {}) {
    if (!client) return;

    if (!preserveQuestOrigin) state.questNavigationOrigin = null;
    state.selectedClient = ensureClientQuestShape(client);
    renderProfile(state.selectedClient);

    dom.clients.profile.scrollTop = 0;

    // Wait one frame so the freshly rendered data is painted,
    // then animate Directory -> Profile with transform + opacity only.
    window.requestAnimationFrame(() => {
      setClientsView("profile");
    });
  }

  function showClientsDirectory() {
    closeQuestCompletionConfirm({ restoreFocus: false });
    closeQuestHistory({ restoreFocus: false });
    closeBonusHistory({ restoreFocus: false });
    setClientsView("directory");
    state.selectedClient = null;
    state.questNavigationOrigin = null;
    dom.clients.questBeingBack.hidden = true;
    dom.clients.questBeingBack.setAttribute("aria-hidden", "true");
    dom.clients.questReactivationBack.hidden = true;
    dom.clients.questReactivationBack.setAttribute("aria-hidden", "true");
  }

  function normalizeClients(clients) {
    if (!Array.isArray(clients)) return [];

    return clients.map((client, index) => {
      const normalized = {
        ...client,
        _key: client?._key || `client-${String(client?.clientId ?? "")}-${index}`,
        being: {
          lastContactDate: client?.being?.lastContactDate ?? client?.activity?.lastContact ?? "",
          followUpDate: client?.being?.followUpDate ?? "",
          note: client?.being?.note ?? "",
          pinned: Boolean(client?.being?.pinned),
          bonusLog: client?.being?.bonusLog ?? ""
        }
      };

      return normalized;
    });
  }

  function setClients(clients, options = {}) {
    closeBeingCard({ restoreFocus: false });
    state.clients = normalizeClients(clients);
    invalidateQuestProgressCache();
    beingNotesCache.clear();
    state.clientsSource = String(options?.source || "placeholder");
    state.clientQuery = "";
    state.clientsRevision += 1;
    state.clientsRenderedQuery = null;
    state.beingPinOrder.clear();
    dom.clients.search.value = "";
    showClientsDirectory();
    renderClients(true);
    renderBeing();
  }

  /*
    There is no confirmation window any more, so progress and failure have to
    land somewhere the eye already goes: the status strip under the menu.
    Success is barely seen - the window closes - but a failure has to be
    readable, or a save that did not happen would look exactly like one that
    did.
  */
  function setExitStatus(message) {
    const text = String(message || "");
    if (!text || !dom.versionNotification) return;

    dom.versionNotificationText.textContent = text;
    dom.versionNotification.classList.add("is-visible");
  }

  async function sendCrmControl(action, { keepalive = false, payload = null } = {}) {
    const data = await apiPost(
      CRM_CONTROL_URL,
      payload ? { action, ...payload } : { action },
      (response) => `Local CRM control HTTP ${response.status}`,
      { keepalive }
    );

    state.crmControlAvailable = true;
    return data;
  }

  async function initializeCrmControl() {
    try {
      const { response, data } = await fetchJson(
        `${CRM_CONTROL_URL}?action=ping&_=${Date.now()}`,
        { method: "GET" }
      );
      state.crmControlAvailable = Boolean(response.ok && data?.ok);
    } catch {
      state.crmControlAvailable = false;
    }

    if (!state.crmControlAvailable || state.crmHeartbeatTimer) return;

    sendCrmControl("heartbeat", { keepalive: true }).catch(() => {});
    state.crmHeartbeatTimer = window.setInterval(() => {
      sendCrmControl("heartbeat", { keepalive: true }).catch(() => {});
    }, 3000);
  }

  async function waitForPendingWrites(timeoutMs = 15000) {
    const startedAt = Date.now();

    while (state.pendingWrites.size) {
      const remainingTime = timeoutMs - (Date.now() - startedAt);
      if (remainingTime <= 0) {
        throw new Error("Saving is taking too long. Check the Google Sheet connection and try again.");
      }

      const results = await new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          reject(new Error("Saving is taking too long. Check the Google Sheet connection and try again."));
        }, remainingTime);

        Promise.allSettled(Array.from(state.pendingWrites)).then((settled) => {
          window.clearTimeout(timer);
          resolve(settled);
        });
      });
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason || new Error("A pending save failed.");
    }
  }

  async function saveOpenEditorsBeforeExit() {
    if (state.questEditMode && updateQuestDirtyState()) {
      throw new Error("The open quest has unsaved edits. Save the quest first, then exit.");
    }

    if (state.beingCardOpen && String(dom.being.card.noteText.value ?? "").trim()) {
      const saved = await saveBeingDatedNote();
      if (!saved) throw new Error("The open dated note could not be saved.");
    }

    if (state.reactivationCardOpen && state.reactivationOfferDirty) {
      const saved = await saveReactivationOffer();
      if (!saved) throw new Error("The open Reactivation offer could not be saved.");
    }

    await waitForPendingWrites();
  }

  async function saveAndExitApplication() {
    if (state.exitInProgress) return;

    state.exitInProgress = true;
    dom.exit.button.disabled = true;
    setExitStatus("Saving…");

    try {
      await saveOpenEditorsBeforeExit();
      setExitStatus("Saved. Closing…");
      await sendCrmControl("shutdown", { keepalive: true });

      if (state.crmHeartbeatTimer) {
        window.clearInterval(state.crmHeartbeatTimer);
        state.crmHeartbeatTimer = 0;
      }

      window.setTimeout(() => window.close(), 90);
      window.setTimeout(() => {
        setExitStatus("Saved. You can close this window.");
      }, 900);
    } catch (error) {
      console.error("[VIP CRM] Safe exit failed:", error);
      state.exitInProgress = false;
      dom.exit.button.disabled = false;

      /*
        In the corner the window is masked down to the dock, so the strip the
        message lands on is outside it and would never be read. A save that
        did not happen is exactly the moment to take the screen back.
      */
      setWindowCollapsed(false);
      shapeWorkArea();

      setExitStatus(error?.message || "Could not save. CRM stays open.");
    }
  }

  /*
    The dock lives outside #app so the card overlays cannot mark it inert.
    That also puts it out of reach of `.app.app--page-open`, so the shell
    state is mirrored onto the document element for the stylesheet to read.
  */
  function syncShellState() {
    document.documentElement.dataset.shell =
      dom.app.classList.contains("app--reactivation-portal") ? "portal"
      : dom.app.classList.contains("app--page-open") ? "page"
      : "home";
  }

  /*
    THE WINDOW IS THE DOCK

    The bridge opens the CRM in its own application window rather than a tab,
    so the window itself can be the small object in the corner: 178x100 at
    0,0 - Chrome will not go smaller - holding nothing but the one button.
    Opening the menu grows the window to exactly the height the menu needs,
    and opening a screen takes the whole display, where full screen also
    removes the window frame the corner state cannot get rid of.

    In an ordinary tab resizeTo and moveTo are no-ops, so all of this simply
    does nothing there and the page behaves as before.
  */
  /*
    The margin is the same on every side of the dock, so the button sits in
    the middle of the corner panel rather than high and to the left: it is the
    dock's own offset from the top of the page, used again as the space left
    under it.
  */
  const DOCK_WINDOW = Object.freeze({ width: 178, restHeight: 100, minHeight: 100, margin: 6 });

  /*
    Window and menu take turns rather than moving together. Opening: the
    window grows first, then the menu comes down into the room it made.
    Closing: the menu goes away first, then the window shrinks behind it.
    One step apart is enough to read as two movements instead of a jump.
  */
  const DOCK_STEP = 220;
  let dockStepTimer = 0;

  /*
    RESHAPING

    Going from a full screen to a 162px strip makes the browser lay the whole
    page out again at the new width, and for a few frames the tables and the
    headings are crushed into a column. That is the noise seen while the
    window collapses - not a paint glitch, a real re-flow, and nothing that
    can be styled away. So it is not looked at: everything on the screen is
    faded out before the window changes and brought back once it has settled.
    The dock lives outside #app and stays through it.

    The hold covers the whole path: the fade out, the delay the fold already
    waits, and the resize itself.
  */
  const RESHAPE_SETTLE = 170;
  const RESHAPE_LIMIT = 900;
  let reshapeTimer = 0;
  let reshapeGuard = 0;
  let reshapeWatching = false;

  function endReshape() {
    window.clearTimeout(reshapeTimer);
    window.clearTimeout(reshapeGuard);
    if (reshapeWatching) {
      window.removeEventListener("resize", onReshapeResize);
      reshapeWatching = false;
    }
    delete document.documentElement.dataset.reshaping;
  }

  function onReshapeResize() {
    // Every resize restarts the clock; the screen comes back once they stop.
    window.clearTimeout(reshapeTimer);
    reshapeTimer = window.setTimeout(endReshape, RESHAPE_SETTLE);
  }

  function beginReshape() {
    document.documentElement.dataset.reshaping = "1";

    if (!reshapeWatching) {
      window.addEventListener("resize", onReshapeResize);
      reshapeWatching = true;
    }

    /*
      Waiting on the resizes themselves rather than on a fixed delay: a fold
      takes about 400ms end to end and a menu about 130, and holding the
      screen out for the longer of the two would make the shorter one feel
      like a stall. The guard is only there in case a resize never arrives.
    */
    window.clearTimeout(reshapeTimer);
    reshapeTimer = window.setTimeout(endReshape, RESHAPE_SETTLE * 2);
    window.clearTimeout(reshapeGuard);
    reshapeGuard = window.setTimeout(endReshape, RESHAPE_LIMIT);
  }

  /*
    Folding back to the corner waits for the screen to fade out first. Shrink
    the window while the screen is still painted and every table, tile and row
    is visibly dragged into the top-left corner on the way down.
  */
  const FOLD_DELAY = 300;
  let foldTimer = 0;

  /*
    Where the window stood before a screen took over the display. Null while
    the window is in the corner, which is also what says "not expanded".
  */
  let cornerSpot = null;

  function windowFrame() {
    return {
      x: Math.max(0, window.outerWidth - window.innerWidth),
      y: Math.max(0, window.outerHeight - window.innerHeight)
    };
  }

  function shapeCorner() {
    const frame = windowFrame();

    /*
      Ask the dock how tall it actually is rather than carrying a number that
      has to be edited every time a button is added. offsetTop/offsetHeight
      rather than the bounding box: the menu is measured while it is still
      closed, and the box would carry the transform it is closed with.

      The bar is two rows once Back and the menu button stack, which is why a
      fixed 100px was cutting the menu button in half.
    */
    const dockTop = dom.menuDock.getBoundingClientRect().top;
    const bar = dom.menuDock.querySelector(".menu-dock__bar");
    let bottom = bar
      ? dockTop + bar.offsetTop + bar.offsetHeight
      : DOCK_WINDOW.restHeight;

    if (state.dockOpen) {
      bottom = Math.max(bottom, dockTop + dom.mainMenu.offsetTop + dom.mainMenu.offsetHeight);
    }

    const height = Math.max(
      DOCK_WINDOW.minHeight,
      Math.round(bottom + DOCK_WINDOW.margin) + frame.y
    );

    /*
      The same treatment the height already got. resizeTo sets the outer
      window, so the frame has to be added or the page is handed a viewport
      narrower than the dock by however thick the border is - which is what
      pushed the content out over the buttons on the right.

      The content width is measured rather than assumed, for the same reason
      the height is: the dock is as wide as its widest row, and a constant
      goes stale the moment a button is added.
    */
    const bars = [bar, state.dockOpen ? dom.mainMenu : null].filter(Boolean);
    const contentRight = bars.reduce(
      (widest, element) => Math.max(widest, element.offsetLeft + element.offsetWidth),
      0
    );
    const width = Math.max(
      DOCK_WINDOW.width,
      Math.round(contentRight + DOCK_WINDOW.margin) + frame.x
    );

    beginReshape();

    /*
      Shrink first, then put the window back where it was picked up from.
      The other order would move a full-screen window to a corner position
      and only then shrink it, which drags the whole screen across the
      display on the way down.
    */
    try {
      window.resizeTo(width, height);
      if (cornerSpot) {
        window.moveTo(cornerSpot.x, cornerSpot.y);
        cornerSpot = null;
      }
    } catch { /* an ordinary tab refuses; nothing depends on it */ }
  }

  /*
    Opening a screen takes as much of the display as the screen actually uses.
    This is a resize rather than the Fullscreen API on purpose: in the
    application window the launcher opens, requestFullscreen sets
    document.fullscreenElement but the window itself never changes size, so
    the page would think it was full screen while still being 178px wide.
    Measured, not assumed.
  */
  /*
    A screen takes the whole work area on a landscape display, and the top
    half of a portrait one - a screen laid out in columns is unusable in a
    1125x1993 slot, and the bottom half of a tall monitor is out of the line
    of sight anyway. Nothing here measures the content: sizing the window to
    each screen in turn meant it changed shape on every step, which is exactly
    what it should not do. The only window that follows what is in it is the
    corner one.
  */
  function shapeWorkArea() {
    const availWidth = window.screen.availWidth;
    const availHeight = window.screen.availHeight;
    const portrait = availHeight > availWidth * 1.05;
    const height = portrait ? Math.round(availHeight / 2) : availHeight;

    beginReshape();

    /*
      Where the window sits in the corner is the user's business, so it is
      remembered before the screen takes the display and given back when the
      window folds again. availLeft/availTop rather than 0,0: they are the
      work area of the display this window is actually on, so a second
      monitor opens the screen on itself instead of throwing it to the first.
    */
    try {
      if (!cornerSpot) {
        cornerSpot = { x: window.screenX, y: window.screenY };
      }
      window.moveTo(window.screen.availLeft || 0, window.screen.availTop || 0);
      window.resizeTo(availWidth, height);
    } catch { /* an ordinary tab refuses; nothing depends on it */ }
  }

  function applyWindowShape() {
    if (state.opened && !state.windowCollapsed) shapeWorkArea();
    else shapeCorner();
  }

  /*
    QUICK COLLAPSE

    Home closes the screen; this only puts the window away. The screen stays
    exactly as it was - scroll position, open card, half-typed note - and the
    window drops to the corner object until it is asked back. Collapsing fades
    the screen out first for the same reason folding home does: shrink while
    it is still painted and the whole layout is visibly dragged into the
    corner on the way down.
  */
  function setWindowCollapsed(next) {
    const collapsed = Boolean(next);
    if (state.windowCollapsed === collapsed) return;

    state.windowCollapsed = collapsed;
    /*
      The cards, the quick nav and the quest dialogs all sit outside #app, so
      the state that hides them has to be on the document element, next to the
      shell state the dock already reads.
    */
    dom.app.classList.toggle("app--window-collapsed", collapsed);
    document.documentElement.dataset.collapsed = collapsed ? "true" : "false";
    dom.menuDock.dataset.collapsed = collapsed ? "true" : "false";
    dom.menuDockCollapse.setAttribute("aria-pressed", collapsed ? "true" : "false");

    const label = collapsed ? "Reopen the screen" : "Collapse to the corner";
    dom.menuDockCollapse.setAttribute("aria-label", label);
    dom.menuDockCollapse.title = label;

    window.clearTimeout(foldTimer);

    if (collapsed) {
      foldTimer = window.setTimeout(applyWindowShape, FOLD_DELAY);
      return;
    }

    // Coming back the other way the window goes first, so the screen has
    // somewhere to appear rather than being unfolded out of the corner.
    applyWindowShape();
  }

  function setActiveButton(page) {
    for (const button of dom.menuButtons) {
      const active = button.dataset.page === page;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  }

  function setActivePage(page) {
    closeClientQuickNav({ restoreFocus: false });
    /*
      The shell needs to know which screen is open: Reactivation already draws
      its own Back control, so the navigation cluster steps aside there
      instead of stacking on top of it.
    */
    dom.app.dataset.page = page || "";
    for (const element of dom.pages) {
      const active = element.dataset.pageContent === page;
      element.classList.toggle("is-active", active);
      element.setAttribute("aria-hidden", active ? "false" : "true");
      if ("inert" in element) element.inert = !active;
    }
  }

  function renderCurrentPage(page) {
    if (page === PAGES.YESTERDAY) {
      if (!refreshAnalyticsFrom365()) renderYesterday(YESTERDAY_TEST_DATA);
    }
    else if (page === PAGES.DASHBOARD) {
      if (!refreshAnalyticsFrom365()) renderDashboard(DASHBOARD_TEST_DATA);
    }
    else if (page === PAGES.CLIENTS) renderClients();
    else if (page === PAGES.REACTIVATION) renderReactivation();
    else if (page === PAGES.BEING) renderBeing();
  }

  function enterReactivationPortal() {
    if (!state.reactivationPortalOrigin) {
      state.reactivationPortalOrigin = {
        opened: state.opened,
        page: state.currentPage
      };
    }

    dom.app.classList.add("app--reactivation-portal");
    syncShellState();
    dom.app.scrollTop = 0;
    if (dom.reactivation.tableShell) dom.reactivation.tableShell.scrollLeft = 0;
    window.requestAnimationFrame(() => {
      dom.app.scrollTop = 0;
      if (dom.reactivation.tableShell) dom.reactivation.tableShell.scrollLeft = 0;
    });

    const originPage = state.reactivationPortalOrigin?.page;
    const originLabel = originPage
      ? originPage.charAt(0).toUpperCase() + originPage.slice(1)
      : "Main Menu";

    dom.reactivationPortalBack.title = `Back to ${originLabel}`;
    dom.reactivationPortalBack.setAttribute("aria-label", `Back to ${originLabel}`);
  }

  function leaveReactivationPortal() {
    if (state.reactivationPortalReturning) return;

    state.reactivationPortalReturning = true;

    window.setTimeout(() => {
      const origin = state.reactivationPortalOrigin || {
        opened: false,
        page: null
      };

      state.reactivationPortalOrigin = null;
      state.reactivationPortalReturning = false;
      dom.reactivationPortalBack.blur();
      dom.app.classList.remove("app--reactivation-portal");
      dom.app.scrollTop = 0;
      window.requestAnimationFrame(() => { dom.app.scrollTop = 0; });
      // Both ways out sync the shell state themselves.
      if (!origin.opened || !origin.page) {
        returnToMainMenu();
        return;
      }

      state.opened = true;
      state.currentPage = origin.page;

      dom.app.classList.add("app--page-open");
      syncShellState();
      setActiveButton(origin.page);
      setActivePage(origin.page);
      renderCurrentPage(origin.page);
    }, 140);
  }

  function openPage(page) {
    if (!VALID_PAGES.has(page)) return;

    if (page === PAGES.REACTIVATION && state.currentPage !== PAGES.REACTIVATION) {
      state.reactivationPortalOrigin = {
        opened: state.opened,
        page: state.currentPage
      };
    }

    if (!state.opened) {
      state.opened = true;
      dom.app.classList.add("app--page-open");
    }

    /*
      Picking a screen is asking to see it, so any fold is over - whether the
      menu took it or the collapse button did. Without this the window stayed
      in the corner and [data-collapsed] kept the screen hidden, so the menu
      closed onto an empty dock.
    */
    state.dockFoldedScreen = false;
    if (state.windowCollapsed) setWindowCollapsed(false);

    if (page === PAGES.CLIENTS) showClientsDirectory();

    if (state.currentPage !== page) {
      /*
        A card belongs to the screen it was opened from. The menu is reachable
        over an open card now, so switching screens with one open used to
        leave it floating above a screen it has nothing to do with.
      */
      if (state.beingCardOpen) closeBeingCard({ restoreFocus: false });
      if (state.reactivationCardOpen) closeReactivationCard({ restoreFocus: false });

      state.currentPage = page;
      setActiveButton(page);
      setActivePage(page);
      renderCurrentPage(page);
    }

    if (page === PAGES.REACTIVATION) {
      enterReactivationPortal();
    } else {
      dom.app.classList.remove("app--reactivation-portal");
      syncShellState();
    }

    window.clearTimeout(foldTimer);
    setWindowCollapsed(false);
    shapeWorkArea();
  }

  /*
    One Back for the whole app.

    Every screen used to grow its own return control - Back to Client Profile,
    Back to Being Card, Back to Reactivation Card, the portal arrow - and they
    stacked up in the corner like a folder trail. They still exist and still
    carry their own origin logic; they are simply not drawn any more, and this
    walks the same ladder from the top: whatever layer is open goes back one
    step, and the last step is the main menu.
  */
  const BACK_LADDER = Object.freeze([
    "#questConfirmNo",
    "#questHistoryClose",
    "#bonusHistoryClose",
    "#beingCardBackToReactivation",
    "#beingCardClose",
    "#reactivationCardBackToBeing",
    "#reactivationCardClose",
    "#clientQuestBeingBack",
    "#clientQuestReactivationBack",
    "#clientQuestBack",
    "#clientProfileBack",
    "#reactivationPortalBack"
  ]);

  /*
    These controls are hidden in CSS, so their computed display says nothing
    about whether the step exists. What decides it is the state they belong
    to: the hidden attribute the app already toggles, the view that owns them
    being the active one, and the overlay being open.
  */
  function isBackStepAvailable(element) {
    if (!element || element.hidden || element.disabled) return false;

    const view = element.closest(".client-profile-view, .client-quest-view, .clients-directory");
    if (view && !view.classList.contains("is-view-active")) return false;

    const overlay = element.closest(
      ".being-card-overlay, .reactivation-card-overlay,"
      + " .quest-confirm-overlay, .quest-history-overlay, .bonus-history-overlay"
    );
    if (overlay && !overlay.classList.contains("is-open")) return false;

    if (element.id === "reactivationPortalBack") {
      return dom.app.classList.contains("app--reactivation-portal");
    }

    return true;
  }

  /*
    What "where am I" means, as one comparable value. Back used to trust the
    ladder: if a step said it was available it was clicked and that was the
    end of it. When the step's own handler declined - a guard already running,
    an origin that had been cleared - nothing moved and the press did nothing.
    Back now checks: if the app is in the same place one frame later, it takes
    the next step down instead. A press always goes somewhere.
  */
  function navigationSignature() {
    const openViews = Array.from(
      document.querySelectorAll(".is-view-active, .is-open")
    ).map((element) => element.id || element.className).join("|");

    return [
      state.opened ? "1" : "0",
      state.currentPage || "-",
      state.reactivationPortalReturning ? "r" : "-",
      dom.app.className,
      openViews
    ].join("~");
  }

  function goBack() {
    goBackFrom(0, navigationSignature());
  }

  function goBackFrom(startIndex, before) {
    for (let index = startIndex; index < BACK_LADDER.length; index += 1) {
      const element = document.querySelector(BACK_LADDER[index]);
      if (!isBackStepAvailable(element)) continue;

      element.click();

      // The step may have declined; give it a frame, then look again.
      window.requestAnimationFrame(() => {
        if (navigationSignature() !== before) return;
        goBackFrom(index + 1, before);
      });
      return;
    }

    returnToMainMenu();
  }

  function returnToMainMenu() {
    /*
      state.opened alone is not proof of being home: a screen class can outlive
      the flag when a step is interrupted. Home is only a no-op when nothing is
      left standing.
    */
    if (
      !state.opened
      && !dom.app.classList.contains("app--page-open")
      && !dom.app.classList.contains("app--reactivation-portal")
    ) return;

    if (state.reactivationCardOpen) {
      closeReactivationCard({ restoreFocus: false });
    }

    state.reactivationPortalOrigin = null;
    state.reactivationPortalReturning = false;
    dom.app.classList.remove("app--reactivation-portal");
    syncShellState();
    dom.app.scrollTop = 0;
    window.requestAnimationFrame(() => { dom.app.scrollTop = 0; });

    // Close any nested Client Profile state first.
    showClientsDirectory();

    state.opened = false;
    state.currentPage = null;

    for (const button of dom.menuButtons) {
      button.classList.remove("is-active");
      button.removeAttribute("aria-current");
    }

    for (const page of dom.pages) {
      page.classList.remove("is-active");
      page.setAttribute("aria-hidden", "true");
      if ("inert" in page) page.inert = true;
    }

    // Removing this class drives the menu back to the centered home state
    // and reveals Update Data / version again.
    dom.app.classList.remove("app--page-open");
    delete dom.app.dataset.page;
    syncShellState();

    setWindowCollapsed(false);
    window.clearTimeout(foldTimer);
    foldTimer = window.setTimeout(applyWindowShape, FOLD_DELAY);
  }

  // The strip under the menu now carries only the exit status (setExitStatus).
  function hideVersionNotification() { dom.versionNotification.classList.remove("is-visible"); }

  async function updateData() {
    if (state.updating) return;
    state.updating = true;
    dom.updateButton.classList.add("is-loading");
    dom.updateButtonText.textContent = "Updating";

    try {
      // A refresh starts a clean strip: whatever the last exit attempt left
      // there is cleared.
      hideVersionNotification();

      if (isBeingGoogleSheetConfigured()) {
        // Yesterday and Dashboard are rebuilt from sheet 365 inside setBeingData.
        await loadSheetsFromGoogle({ throwOnError: true });
      } else {
        renderYesterday(YESTERDAY_TEST_DATA);
        renderDashboard(DASHBOARD_TEST_DATA);
        setClients(CLIENTS_TEST_DATA, { source: "placeholder" });
      }

      renderDataSourceState();

      dom.updateButtonText.textContent = "Updated";
    } catch (error) {
      console.error("Data update failed:", error);
      dom.updateButtonText.textContent = "Update Failed";
    } finally {
      dom.updateButton.classList.remove("is-loading");
      state.updating = false;
      window.setTimeout(() => {
        if (!state.updating) dom.updateButtonText.textContent = "Update Data";
      }, 1200);
    }
  }

  /*
    THE DOCK

    The CRM opens as one small window in the top-left corner holding a single
    button. Pressing it grows the compact menu underneath; picking a screen
    closes the menu again and the screen takes the whole viewport. Home puts
    the viewport back and the dock is all that is left. Nothing hovers, so
    nothing opens by accident while the pointer crosses the corner.
  */
  function paintDockOpen() {
    dom.menuDock.dataset.open = state.dockOpen ? "true" : "false";
    /*
      Opening: the shape grows with the menu, so the menu has room to come
      down into. Closing: the shape is left alone until the menu has gone,
      which the delayed applyWindowShape below takes care of - shrinking now
      would clip the menu halfway through its own exit.

      Only the corner window grows, and that has to be checked here rather
      than trusted from the caller. setDockOpen takes an early exit when the
      window is a screen - "nothing to wait for, it is already as large as it
      gets" - and that exit lands straight in this function, so an unguarded
      shapeCorner() pulled an open screen down to 178px and dropped it in the
      corner the moment the menu was opened over it.
    */
    const cornerWindow = !state.opened || state.windowCollapsed;
    if (state.dockOpen && cornerWindow) shapeCorner();
  }

  function setDockOpen(open) {
    const next = Boolean(open);
    if (state.dockOpen === next) return;

    state.dockOpen = next;
    dom.menuDockToggle.setAttribute("aria-expanded", next ? "true" : "false");
    dom.menuDockToggle.setAttribute("aria-label", next ? "Close menu" : "Open menu");
    window.clearTimeout(dockStepTimer);

    /*
      Asking for the menu from a screen asks for the menu as it looks when
      the app opens: the corner window with the buttons in it, and nothing
      else. So the screen folds away first rather than staying painted behind
      a window that is about to become 178px wide - which is what produced a
      full screen crushed into the dock, title clipped and menu sitting on
      top of the list.

      Folded, not closed: the screen keeps its scroll, its open card and its
      half-typed note, and comes back when the menu closes or when a screen
      is picked. A collapse the user asked for with the collapse button is
      left alone - only the one taken here is given back here.
    */
    if (next && state.opened && !state.windowCollapsed) {
      state.dockFoldedScreen = true;
      setWindowCollapsed(true);
    } else if (!next && state.dockFoldedScreen) {
      state.dockFoldedScreen = false;
      setWindowCollapsed(false);
    }

    // Only the corner window changes size; on a screen the window is already
    // as large as it gets, so there is nothing to wait for - unless the screen
    // has been collapsed away, in which case the corner window is back.
    const resizes = !state.opened || state.windowCollapsed;

    if (!resizes) {
      paintDockOpen();
      return;
    }

    if (next) {
      shapeCorner();
      dockStepTimer = window.setTimeout(paintDockOpen, DOCK_STEP);
      return;
    }

    paintDockOpen();
    /*
      applyWindowShape rather than shapeCorner: closing the menu by picking a
      screen leaves the app open, and that step has to leave the window large.
    */
    dockStepTimer = window.setTimeout(applyWindowShape, DOCK_STEP);
  }

  syncShellState();


  dom.menuDockToggle.addEventListener("click", () => setDockOpen(!state.dockOpen));

  dom.menuDockCollapse.addEventListener("click", () => {
    /*
      Cleared before the menu closes, not after: leaving it set would make
      closing the menu restore the screen a moment before this line folds it
      again, and the window would bounce out to full size and back.
    */
    const wanted = !state.windowCollapsed;
    state.dockFoldedScreen = false;
    setDockOpen(false);
    setWindowCollapsed(wanted);
  });

  dom.mainMenu.addEventListener("click", (event) => {
    const button = event.target.closest(".main-menu__button");
    if (!button) return;
    setDockOpen(false);
    openPage(button.dataset.page);
  });

  dom.mainMenuHome.addEventListener("click", () => {
    setDockOpen(false);
    returnToMainMenu();
  });

  // Outside the dock is a dismissal.
  document.addEventListener("pointerdown", (event) => {
    if (!state.dockOpen) return;
    if (dom.menuDock.contains(event.target)) return;
    setDockOpen(false);
  }, true);

  // Pressing it is the decision; there is nothing to confirm.
  dom.exit.button.addEventListener("click", saveAndExitApplication);

  dom.mainMenuReturn.addEventListener("click", goBack);

  dom.updateButton.addEventListener("click", updateData);
  dom.versionNotificationClose.addEventListener("click", hideVersionNotification);

  const clientQuickNavContainers = [dom.yesterday.rows, ...dom.dashboard.listContainers];
  clientQuickNavContainers.forEach((container) => {
    container.addEventListener("click", (event) => {
      const trigger = event.target.closest(".client-quick-nav-trigger");
      if (trigger) openClientQuickNav(trigger);
    });

    container.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      const trigger = event.target.closest(".client-quick-nav-trigger");
      if (!trigger) return;
      event.preventDefault();
      openClientQuickNav(trigger);
    });
  });

  dom.quickNav.popover.addEventListener("click", (event) => {
    const destination = event.target.closest("[data-client-quick-destination]");
    if (!destination || destination.disabled) return;
    openQuickNavDestination(destination.dataset.clientQuickDestination);
  });

  document.addEventListener("pointerdown", (event) => {
    if (!state.quickNavOpen) return;
    if (dom.quickNav.popover.contains(event.target)) return;
    if (event.target.closest(".client-quick-nav-trigger")) return;
    closeClientQuickNav({ restoreFocus: false });
  }, true);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.dockOpen) {
      setDockOpen(false);
    }
  }, true);

  window.addEventListener("beforeunload", (event) => {
    if (state.exitInProgress) return;

    const openBeingNoteChanged = state.beingCardOpen
      ? Boolean(String(dom.being.card.noteText.value ?? "").trim())
      : false;
    const openReactivationWorkChanged = state.reactivationCardOpen
      && (
        state.reactivationOfferDirty
        || Boolean(String(dom.reactivation.card.noteText.value ?? "").trim())
      );
    const unsavedQuest = state.questEditMode && updateQuestDirtyState();

    if (state.pendingWrites.size || openBeingNoteChanged || openReactivationWorkChanged || unsavedQuest) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  window.addEventListener("pagehide", () => {
    if (!state.crmControlAvailable || state.exitInProgress) return;

    try {
      navigator.sendBeacon(
        CRM_CONTROL_URL,
        JSON.stringify({ action: "window-closing" })
      );
    } catch {
    }
  });

  dom.reactivationPortalBack.addEventListener("click", () => {
    leaveReactivationPortal();
  });

  dom.reactivation.sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setReactivationSort(button.dataset.reactivationSort);
    });
  });

  dom.reactivation.stageFilters.forEach((button) => {
    button.addEventListener("click", () => {
      setReactivationStageFilter(button.dataset.reactivationStageFilter);
    });
  });

  dom.reactivation.search.addEventListener("input", () => {
    state.reactivationQuery = dom.reactivation.search.value;
    if (state.reactivationSearchFrame) window.cancelAnimationFrame(state.reactivationSearchFrame);
    state.reactivationSearchFrame = window.requestAnimationFrame(() => {
      state.reactivationSearchFrame = 0;
      renderReactivation();
    });
  });

  dom.reactivation.search.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dom.reactivation.search.value) {
      event.preventDefault();
      clearReactivationView();
    }
  });

  dom.reactivation.clearFilters.addEventListener("click", clearReactivationView);

  window.addEventListener("resize", () => {
    if (state.quickNavOpen && state.quickNavReturnFocus?.isConnected) {
      positionClientQuickNav(state.quickNavReturnFocus);
    }
  }, { passive: true });

  dom.reactivation.rows.addEventListener("click", (event) => {
    const row = event.target.closest(".reactivation-row");
    if (!row) return;

    const clientId = row.dataset.clientId;

    const undoType = event.target.closest("[data-reactivation-undo-type]");
    if (undoType) {
      const client = getReactivationClient(clientId);
      const entry = getLastReactivationContactByType(client, undoType.dataset.reactivationUndoType);
      if (entry) undoReactivationContact(clientId, entry.id);
      return;
    }

    const contact = event.target.closest("[data-reactivation-contact]");
    if (contact) {
      addReactivationContact(
        clientId,
        contact.dataset.reactivationContact,
        getReactivationLocalDateTime()
      );
      return;
    }

    openReactivationCard(
      clientId,
      event.target.closest("[data-reactivation-open]") || row
    );
  });


  dom.reactivation.card.close.addEventListener("click", () => closeReactivationCard());
  dom.reactivation.card.backToBeing.addEventListener("click", returnFromReactivationToBeing);
  dom.reactivation.card.name.addEventListener("click", openBeingFromReactivation);
  dom.reactivation.card.questOpen.addEventListener("click", openReactivationQuest);
  dom.reactivation.card.bonusHistoryOpen.addEventListener("click", openReactivationBonusHistory);
  dom.reactivation.card.statsPeriodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextPeriod = button.dataset.reactivationStatsPeriod === "12m" ? "12m" : "30d";
      if (state.reactivationStatsPeriod === nextPeriod) return;
      state.reactivationStatsPeriod = nextPeriod;
      const client = getReactivationClient(state.reactivationSelectedId);
      if (client) renderReactivationStatistics(client);
    });
  });
  dom.reactivation.card.toolRail.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reactivation-work-tool]");
    if (!button) return;
    setReactivationWorkTool(button.dataset.reactivationWorkTool, { focus: true });
  });
  [
    dom.reactivation.card.offerBd,
    dom.reactivation.card.offerFb,
    dom.reactivation.card.offerToDeposit,
    dom.reactivation.card.offerQuest
  ].forEach((field) => {
    field.addEventListener("input", () => {
      state.reactivationOfferDirty = true;
      dom.reactivation.card.offerStatus.textContent = "Unsaved";
    });
    field.addEventListener("change", () => {
      state.reactivationOfferDirty = true;
      dom.reactivation.card.offerStatus.textContent = "Unsaved";
    });
  });
  dom.reactivation.card.offerSave.addEventListener("click", () => {
    saveReactivationOffer();
  });
  dom.reactivation.card.noteSave.addEventListener("click", () => {
    saveReactivationNote();
  });
  dom.reactivation.card.noteText.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      saveReactivationNote();
    }
  });
  dom.reactivation.card.noteList.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-reactivation-note-delete]");
    if (!remove) return;
    deleteReactivationNote(Number(remove.dataset.reactivationNoteDelete));
  });

  dom.reactivation.card.overlay.addEventListener("click", (event) => {
    if (event.target === dom.reactivation.card.overlay) closeReactivationCard();
  });

  dom.reactivation.card.email.addEventListener("click", () => {
    if (!state.reactivationSelectedId) return;
    addReactivationContact(state.reactivationSelectedId, "email", {
      date: dom.reactivation.card.contactDate.value,
      time: dom.reactivation.card.contactTime.value
    });
  });

  dom.reactivation.card.call.addEventListener("click", () => {
    if (!state.reactivationSelectedId) return;
    addReactivationContact(state.reactivationSelectedId, "call", {
      date: dom.reactivation.card.contactDate.value,
      time: dom.reactivation.card.contactTime.value
    });
  });

  dom.reactivation.card.contactUndo.addEventListener("click", () => {
    if (!state.reactivationSelectedId) return;
    undoReactivationContact(state.reactivationSelectedId);
  });

  dom.being.rows.addEventListener("click", (event) => {
    const row = event.target.closest(".being-row");
    if (!row) return;

    const pin = event.target.closest("[data-being-pin]");
    if (pin) {
      toggleBeingPin(row.dataset.clientKey);
      return;
    }

    if (event.target.closest("button, input, textarea, select, a")) return;
    openBeingCard(row.dataset.clientKey, row);
  });

  dom.being.rows.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    if (event.target !== event.currentTarget && event.target.closest("button, input, textarea, select, a")) return;

    const row = event.target.closest(".being-row");
    if (!row) return;

    event.preventDefault();
    openBeingCard(row.dataset.clientKey, row);
  });

  dom.being.questFilter.addEventListener("click", () => {
    state.beingQuestFilter = !state.beingQuestFilter;
    dom.being.questFilter.setAttribute("aria-pressed", state.beingQuestFilter ? "true" : "false");
    renderBeing();
    dom.being.rows.scrollTop = 0;
  });

  dom.being.searchToggle.addEventListener("click", () => {
    if (state.beingSearchOpen) {
      setBeingSearchOpen(false, { clear: true });
    } else {
      setBeingSearchOpen(true);
    }
  });

  dom.being.search.addEventListener("input", () => {
    state.beingQuery = dom.being.search.value;
    if (state.beingSearchFrame) window.cancelAnimationFrame(state.beingSearchFrame);
    state.beingSearchFrame = window.requestAnimationFrame(() => {
      state.beingSearchFrame = 0;
      renderBeing();
    });
  });

  dom.being.card.questOpen.addEventListener("click", () => {
    const client = getBeingCardClient();
    if (client) openBeingQuest(client._key);
  });

  dom.being.card.backToReactivation.addEventListener("click", returnFromBeingToReactivation);
  dom.being.card.openReactivation.addEventListener("click", openReactivationFromBeingCard);

  dom.being.card.pin.addEventListener("click", () => {
    const client = getBeingCardClient();
    if (client) toggleBeingPin(client._key);
  });

  dom.being.card.reactivation.addEventListener("click", () => {
    const client = getBeingCardClient();
    if (client) addWorkspaceClientToReactivation(client);
  });

  dom.being.card.lastContact.addEventListener("change", () => {
    const client = getBeingCardClient();
    if (!client) return;
    updateBeingDate(client._key, "lastContactDate", dom.being.card.lastContact.value);
  });

  dom.being.card.lastContactToday.addEventListener("click", () => {
    const client = getBeingCardClient();
    if (!client) return;

    const today = getLocalTodayIso();
    dom.being.card.lastContact.value = today;
    updateBeingDate(client._key, "lastContactDate", today);
  });

  dom.being.card.followUp.addEventListener("change", () => {
    const client = getBeingCardClient();
    if (!client) return;
    updateBeingDate(client._key, "followUpDate", dom.being.card.followUp.value);
  });

  dom.being.card.noteSave.addEventListener("click", saveBeingDatedNote);
  dom.being.card.noteCancel.addEventListener("click", resetBeingNoteComposer);
  dom.being.card.noteText.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      saveBeingDatedNote().catch((error) => {
        console.error("[Being] Dated note action failed:", error);
      });
    }
  });
  dom.being.card.noteList.addEventListener("click", (event) => {
    const client = getBeingCardClient();
    if (!client) return;

    const edit = event.target.closest("[data-being-note-edit]");
    if (edit) {
      const index = Number(edit.dataset.beingNoteEdit);
      const entry = getBeingNotes(client)[index];
      if (entry) setBeingNoteComposer(entry, index);
      return;
    }

    const remove = event.target.closest("[data-being-note-delete]");
    if (remove) {
      deleteBeingDatedNote(Number(remove.dataset.beingNoteDelete));
    }
  });

  dom.being.card.close.addEventListener("click", () => closeBeingCard());
  dom.being.card.done.addEventListener("click", () => closeBeingCard());

  // Right click is a global quick-close gesture for the entire Being Client Card layer.
  // Capture phase is intentional: inner buttons, inputs, links and textareas never receive
  // the context-menu event, so right-click cannot trigger or interfere with card controls.
  dom.being.card.overlay.addEventListener("contextmenu", (event) => {
    if (!state.beingCardOpen) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    closeBeingCard();
  }, true);

  dom.clients.grid.addEventListener("click", (event) => {
    const card = event.target.closest(".client-card");
    if (!card) return;
    const client = state.clients.find((item) => item._key === card.dataset.clientKey);
    if (client) openClientProfile(client);
  });

  dom.clients.back.addEventListener("click", showClientsDirectory);
  dom.clients.reactivationAdd.addEventListener("click", () => {
    if (state.selectedClient) addWorkspaceClientToReactivation(state.selectedClient);
  });
  dom.clients.bonusesOpen.addEventListener("click", () => openBonusHistory());

  dom.bonusHistory.close.addEventListener("click", () => {
    closeBonusHistory();
  });

  dom.bonusHistory.overlay.addEventListener("click", (event) => {
    if (event.target === dom.bonusHistory.overlay) closeBonusHistory();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (state.bonusHistoryOpen) {
      event.preventDefault();
      closeBonusHistory();
      return;
    }

    if (state.quickNavOpen) {
      event.preventDefault();
      closeClientQuickNav();
      return;
    }

    if (state.reactivationCardOpen) {
      event.preventDefault();
      closeReactivationCard();
      return;
    }

    if (state.beingCardOpen) {
      event.preventDefault();
      closeBeingCard();
      return;
    }

    if (state.questConfirmOpen) {
      event.preventDefault();
      closeQuestCompletionConfirm();
      return;
    }
    if (state.questHistoryOpen) {
      event.preventDefault();
      closeQuestHistory();
      return;
    }

    if (state.beingSearchOpen) {
      event.preventDefault();
      setBeingSearchOpen(false, { clear: true });
    }
  });
  dom.clients.questOpen.addEventListener("click", openQuestFromProfile);
  dom.clients.questBack.addEventListener("click", returnToClientProfile);
  dom.clients.questBeingBack.addEventListener("click", returnFromQuestToBeingCard);
  dom.clients.questReactivationBack.addEventListener("click", returnFromQuestToReactivationCard);
  dom.clients.questEditButton.addEventListener("click", enterQuestEditMode);
  dom.clients.questSaveButton.addEventListener("click", saveQuestEdits);
  dom.clients.questNameSyncButton.addEventListener("click", syncQuestNameToMechanic);
  dom.clients.questCompleteButton.addEventListener("click", requestQuestCompletion);
  dom.clients.questHistoryOpen.addEventListener("click", openQuestHistory);

  dom.yesterday.sortButtons.forEach((button) => {
    button.addEventListener("click", () => setYesterdaySort(button.dataset.yesterdaySort));
  });

  dom.questConfirm.continueButton.addEventListener("click", () => {
    closeQuestCompletionConfirm({ restoreFocus: false });
    completeCurrentQuest();
  });
  dom.questConfirm.noButton.addEventListener("click", () => closeQuestCompletionConfirm());
  dom.questConfirm.overlay.addEventListener("click", (event) => {
    if (event.target === dom.questConfirm.overlay) closeQuestCompletionConfirm();
  });

  dom.questHistory.close.addEventListener("click", () => closeQuestHistory());
  dom.questHistory.overlay.addEventListener("click", (event) => {
    if (event.target === dom.questHistory.overlay) closeQuestHistory();
  });

  const questEditableFields = [
    dom.clients.questDetailNameInput,
    dom.clients.questMechanicSelect,
    dom.clients.questSectionSelect,
    dom.clients.questCurrencySelect,
    dom.clients.questGoalInput,
    dom.clients.questDetailStartInput,
    dom.clients.questDetailEndInput,
    dom.clients.questConditionsInput,
    dom.clients.questRewardInput
  ];

  const questProgressFields = new Set([
    dom.clients.questMechanicSelect,
    dom.clients.questSectionSelect,
    dom.clients.questCurrencySelect,
    dom.clients.questGoalInput,
    dom.clients.questDetailStartInput,
    dom.clients.questDetailEndInput
  ]);

  questEditableFields.forEach((field) => {
    const onEdit = () => updateQuestDirtyState({ progress: questProgressFields.has(field) });
    field.addEventListener("input", onEdit);
    field.addEventListener("change", onEdit);
  });

  dom.clients.questCurrencySelect.addEventListener("change", updateQuestGoalCurrencyLabel);
  dom.clients.questEndNoLimitToggle.addEventListener("click", toggleQuestOpenEnded);

  dom.clients.periodTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-profile-period]");
    if (button) setProfilePeriod(button.dataset.profilePeriod);
  });

  dom.clients.search.addEventListener("input", () => {
    state.clientQuery = dom.clients.search.value;
    if (state.searchFrame) window.cancelAnimationFrame(state.searchFrame);
    state.searchFrame = window.requestAnimationFrame(() => {
      state.searchFrame = 0;
      renderClients(false);
    });
  });

  dom.localVersion.textContent = APP_VERSION;

  // Connect save adapter, then keep the startup loader visible
  // until the first online Being sync finishes.
  connectBeingGoogleSheet();
  initializeCrmControl();
  initializeApplication();

  dom.appLoaderRetry?.addEventListener("click", () => {
    initializeApplication();
  });

  dom.appLoaderContinue?.addEventListener("click", () => {
    hideAppLoader();
  });

  /*
    Placeholder mode only: with no bridge the screens hold test figures, so
    they are drawn once the browser has idle time. Under the bridge the loader
    covers the UI until the sheet data has rendered every screen itself.
  */
  if (!isBeingGoogleSheetConfigured()) {
    const preRender = () => {
      renderYesterday(YESTERDAY_TEST_DATA);
      renderDashboard(DASHBOARD_TEST_DATA);
      renderClients(true);
      renderReactivation();
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(preRender, { timeout: 500 });
    } else {
      window.setTimeout(preRender, 40);
    }
  }
})();

