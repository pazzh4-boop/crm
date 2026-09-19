VIP CRM â LATEST BUILD
CRM version: 1.5.6.2
Apps Script API: 3.4

INCLUDED
- index.html
- tokens.css
- main.css
- main.js
- being_config.json
- crm_server.ps1
- START_CRM.bat
- DIAGNOSE_CRM.bat
- START_CRM_HIDDEN.vbs
- Code.gs
- REACTIVATION_README.txt

READING THE LISTS (1.5.6.2)
- Column headers are opaque again. They stick to the top of their list, and
  a transparent sticky header lets the rows scroll straight through it.

- The KPI strips have their block back. Yesterday and Dashboard read their
  six and eight figures off one panel, the way Reactivation already did.

- Rows are tiles. A client list was one slab scored with lines; each row is
  now its own small surface with a gap instead of a rule between them.
  Notes and log entries stay as lines: they are prose, and a box around
  each one fights the text.

- The small end of both type scales is a quarter larger. At 7-11px a column
  of money is legible only if you lean in. The display steps are unchanged.
  The Reactivation columns were sized for the old type and are a quarter
  wider, so no figure is clipped; the shell scrolls as it always did.

- Every screen leaves the dock corner alone. The dock is fixed in the top
  left, and Reactivation was missing from the rule that reserves that
  space, so the back button sat on its panel. One clearance for all five.

- A control edge is its own token. On the new palette a divider-weight line
  was invisible around a button, which is why the pin, close and add
  buttons on the Being card looked like they had lost their outlines.

- The quest editor is a form, not scaffolding. Seven boxed inputs stacked
  in a column read as structure; they keep the rule under them and lose
  their boxes.

READABILITY AND FEWER BOXES (1.5.6.1)
- The ground is no longer pure black. Black with a 2.7% tile on it read as
  one surface on a real screen: the stage figures in Reactivation and the
  rows in Yesterday had nothing to sit against. The ground is #0B0C0E and
  the steps above it are wide enough to see - panel #15171A, raised #1F2226.

- A surface belongs to a group, not to every figure in it. The six stage
  readings share one panel instead of being six bricks in a row; the same
  for the performance strip, the blocks inside a client card and the KPI
  rows on Yesterday and Dashboard. What separates the figures is space and
  type. The three table shells became panels, so bright text sits on a
  surface rather than on near-black.

- The search field had two outlines: one on the wrapper and one on the
  input inside it. The wrapper is the field; the input no longer draws its
  own. Same for the note composer and the two other search boxes.

- The corner window was sized without its frame. shapeCorner added the
  frame thickness to the height but not to the width, so resizeTo asked for
  178px of outer window and the page was handed 162px of inner - and the
  dock ran out over the buttons on the right. The width is now measured
  from the widest dock row and the frame is added, the way the height
  already did it.

BLACK CONSOLE (1.5.6.0)
- New look, same app. No screen gained a control, lost a column or changed
  what it reads from the sheet. The bridge is untouched.

- One theme. The light palette is gone: 1,598 selectors, the toggle and its
  four functions. The moon button keeps its place in the dock so the column
  does not reflow, and is disabled and labelled as such rather than looking
  live and swallowing the click.

- One set of colour names. tokens.css holds the palette and loads first.
  The old ladder - fifteen steps of translucent white and sixteen opaque
  greys - is deleted, and its 1,343 call sites now read the new names. Six
  levels of text became three and six surfaces became three, on purpose:
  a step that small was never a rank.

- Colour means one thing. It is the lifecycle scale and nothing else:
  active, catch up, call twice, pre-sleep, sleeping, plus "pinned" in Being
  and negative money. The reactivation screen's separate cool-grey skin and
  the loose accent families - 100 uses over 27 tokens - are folded into it.
  Outside tokens.css there is no hardcoded hex left anywhere.

- The ground is flat black. The brushed-metal sweep behind the window is
  gone, and so is the glass: of eighteen backdrop-filter declarations,
  fifteen were `none !important` cancelling the other three.

- Tiles, not fences. One rule governed the look of every container in the
  build; it said "numbers with room around them, not cards" and drew a line
  between neighbours. It now draws a soft filled tile, and the dividers are
  gone. Radii are on a three-step scale - 159 declarations moved onto it.

- Fewer words. Gone: every eyebrow over a screen title, every description
  under one, the two hints on Reactivation, the sort caption, the "newest
  sheet" under each figure, the breadcrumbs over both client cards, the
  client name repeated under Work Menu, the bridge line in the Being card,
  and the period restated beside a panel that already has a period toggle.
  Buttons say one word: Complete, Open, History, Bonuses, Offer, Quest.

- Type: Archivo for headings, IBM Plex Sans for the interface, IBM Plex
  Mono for figures. Twenty font-family declarations that only restated the
  inherited face were deleted.

- Dead code removed as it appeared: 64 declarations that a later rule
  already overrode, 27 rules aimed at markup that no longer exists, six
  rules left with no selector at all, and five JS handles plus the
  functions that fed them.

- CSS is 3,168 lines shorter than 1.5.5.9 despite the new token file.

STILL ON THE LIST
- Client profile: initials in the avatar, segmented period control.
- Clients: search into the header, round tags for the badges.
- Dashboard: KPI grid pinned to 4x2, shorter section headings.
- Cards and modals at --r-l rather than --r-m.

THE MENU BUTTON GIVES BACK THE OPENING VIEW (1.5.5.9)
- Opening the menu from a screen used to leave the screen painted while the
  window shrank to the dock: a full screen crushed into 178px, title clipped,
  metric strip unreadable, menu sitting on top of the list.
- The menu now shows what it shows when the app starts - the corner window
  with the buttons in it and nothing behind them. The screen folds away
  first instead of being squeezed.
- Folded, not closed. Scroll position, an open client card and a half-typed
  note all survive; closing the menu brings the screen straight back, and so
  does picking a screen from the menu. The button of the folded screen stays
  lit, so it is clear what closing the menu returns to.
- A collapse you asked for with the collapse button is still yours: opening
  and closing the menu over it leaves it collapsed.
- Picking a screen while collapsed now actually opens it. It used to leave
  the window in the corner with the screen still hidden, so the menu closed
  onto an empty dock.
- Measured on every path that moves the window. Open a screen: 1920x1080.
  Menu over it: 178x439, screen folded. Close the menu: 1920x1080, screen
  back. Pick another screen: 1920x1080. Collapse: 178x100. Menu over the
  collapsed screen: 178x439. Close it: still 178x100. Restore: 1920x1080.

STYLESHEET PASS (1.5.5.8)
- No screen changes shape, colour or size in this build. Every edit below was
  checked by reading the computed style of all 2193 elements on all five
  screens in both themes, before and after; the only differences are the two
  that were meant to happen, and they are named at the end.

- Keyboard focus was invisible on the contact date and time fields. They clear
  their outline where they are defined and nothing gave one back, so a
  keyboard could land there with nothing on screen to say so. They now draw a
  ring. The note editor's focus cue was a tinted border on controls that have
  no border, and now draws a ring too.

- 389 declarations were removed. Each was already overridden further down by
  the same selector with the same weight, so none of them had ever taken
  effect. Three rules lost every declaration they had and went with them.

- Inactive screens no longer carry `pointer-events: none` on every descendant.
  The page and the three client sub-views already get `inert` from main.js,
  which blocks clicks, focus and screen readers rather than just clicks, and
  costs the engine nothing. Verified: on an inactive screen a control cannot
  be focused and cannot be reached by a click.

- The four animated progress bars scale instead of resize. Animating width
  relayouts the card on every frame; the loader did it while the app was
  starting and the thread was busy. The track already clips and rounds, so the
  picture is the same - measured exact at 0%, 25%, 50% and 100%.

- Styling by id is gone (seven rules). #reactivationActiveCount and its
  sleeping twin were the loudest: an id plus !important to set one colour.
  They now read the filter attribute the markup already carries, from the end
  of the last stylesheet, which is the ordinary way to have the final word.

- 128 !important flags were examined against every rule that could touch the
  same element; 37 turned out to be holding nothing off and were dropped. The
  rest stay, and that is the honest state of the file: they are load-bearing
  because the same selectors are declared over and over in later layers.

- Colour and spacing now come from tokens. 110 accent literals became 27
  named hues, 750 spacing literals became 18 steps. Values are unchanged -
  the tokens hold exactly what the rules already used.

- Two intended differences: the three progress fills report border-radius 0
  (the track rounds them now), and elements on inactive screens report
  pointer-events auto (inert does that job instead).

THE WINDOW IS THE PAGE'S AGAIN (1.5.5.7)
- The bridge no longer touches the shape of the window. No region, no
  position, no size - only the always-on-top flag stays. The page resizes
  itself with resizeTo, which is instant and cannot conflict with anything.
- Why it had to go: the bridge is one loop - accept a request, serve it, then
  look at the window. A save goes through it to Apps Script, and Invoke-
  WebRequest holds that loop for as long as Apps Script takes. The window
  could not change shape during those seconds, and the POST carrying the new
  shape sat unaccepted in the backlog. That is the bug where the CSS
  animation played and the window stayed big: the animation is in the page,
  the resize was across a blocked socket.
- Measured after the change: with the bridge deliberately blocked for 5.04s
  inside a proxied call, the window still collapsed from 1440x1256 to 178x100
  in 0.33s - and 0.30 of that is the fold delay that waits for the screen to
  fade out. Geometry and saving no longer share a channel.
- The frame is back. Clipping it away was SetWindowRgn on the bridge, so it
  went with the rest. The title bar and its three buttons are visible, and
  the X closes the window - the page still sends window-closing, so the
  server stops either way. Save & Exit remains the way that also saves.
- The window keeps the position you give it. In the corner it stays wherever
  it was dragged; opening a screen takes the work area of the display it is
  on (availLeft/availTop, so a second monitor opens on itself), and folding
  back puts it on the exact spot it came from. Nothing is pinned to 22,22 any
  more.
- The accept loop waits on the socket instead of polling it. It used to ask
  whether anything had arrived, sleep 100ms and ask again, so every request
  began with up to a tenth of a second of nothing. Poll returns the moment a
  connection lands.
- Gone with it: the mask protocol, the DPI ratio, the multi-monitor clamp and
  the -KeepBrowserFrame flag - all of them existed only to serve the clipped
  window. crm_server.ps1 lost about a third of its lines.
- Checked twice over five screens each: identical geometry every pass, no
  drift, no page errors; always-on-top still set (WS_EX_TOPMOST); quick
  collapse still returns to the screen it left.

SCALING AND A SECOND MONITOR (1.5.5.3 - 1.5.5.6)
- Superseded by the above and kept here only as a record. The exit
  confirmation was removed in 1.5.5.3 - the power button saves and exits, and
  Ctrl+L is gone with it. 1.5.5.4 to 1.5.5.6 chased the clipped window across
  display scaling: the page measured in CSS pixels and the bridge in whatever
  Windows handed it, which matched at 100% and not at 120%, and the frame
  hidden above the top edge landed on a monitor stacked above. None of that
  applies now that the bridge does no geometry.

ONE OUTLINE (1.5.5.2)
- The corner had two rings around the same thing: the plate drew a rounded
  border and the buttons drew their own 6px further in. Two outlines closing
  a gap that small read as a mistake rather than as depth.
- The plate keeps its fill and loses its border and radius. The buttons keep
  theirs - they are the part that gets pressed.

NOTHING RE-FLOWS IN VIEW (1.5.5.1)
- Rolled back to the 1.5.5.0 geometry: 6px around the button, rounded corners
  kept. Only the motion work is new.
- The noise while the window collapses was a real re-flow, not a paint
  glitch: a full screen laid out again at 162px crushes the tables and the
  headings into a column for a few frames. It cannot be styled away, so it is
  not looked at - the screen fades out before the window changes and comes
  back once the new size has settled. The dock lives outside #app and stays
  through it, so there is always something on screen.
- The screen comes back when the resizing stops, not on a fixed delay. A fold
  takes about 400ms end to end and a menu about 130; holding for the longer
  of the two would make the shorter one feel like a stall. Measured: menu
  hidden at 127ms and back at 463, a screen 149/814, collapse 469/845,
  expand 170/544. Every window resize in those happens while the screen is at
  zero opacity.
- The dock's own change of shape - a 59px bar on a screen becoming 150 in the
  corner - is animated rather than snapped, and it is the only thing moving
  while everything else is out. The menu column opens and closes on one
  movement reversed rather than two different ones.

THE DARK BAND WAS MINE (1.5.5.0)
- It was not a limit of the browser. The clipped window shows exactly the
  page and nothing else - measured: the region reads 8,31-170,112 in window
  coordinates, which is 24,24-186,105 on screen, precisely the 162x81 of page
  that was there. The dark band above the button was the 24px margin I had
  put in to centre it.
- The margin is 6 now, which is only what the button's rounded corners need
  so they are not cut by the edge of the window. The corner window went from
  162x81 of page to 162x45, with the bar 150x33 and 6px on every side.
- Everything else holds: menu 162x402, collapsed 162x82, a screen
  1920x1032 with the compact dock, and the panel still lands off the corner
  rather than flush against it.
- It can go to zero if the square corners are acceptable - then the window is
  the button and nothing else at all. Say the word.

CENTRED, PLAIN, OFF THE EDGE (1.5.4.99)
- The button sits in the middle of the corner panel. The dock's own offset is
  used again as the space on the other two sides, so the gaps come out
  20/20/24/24 instead of the button being pinned high and left. The horizontal
  pair works out at exactly the 162px of page Chrome's minimum leaves, which
  is why the width lands even without being told to.
- The texture is gone. At this size a cross-hatch reads as a stain rather than
  as metal - a panel this small has too little room for a pattern to be a
  surface. One quiet fill and one hairline, and the engraved name went with
  it.
- The panel is no longer flush against the corner: it lands at 24,24, so it
  reads as something placed there rather than as something that fell out of
  the edge of the display.
- Measured through every state: corner 162x81 page with 20/20/24/24 around
  the bar, menu 162x438, collapsed 162x118, collapsed with the menu 162x475,
  a screen 1920x1032 with the compact bar and the panel hidden.

WORTH KNOWING
- Centring the button inside a panel that is itself off the corner means the
  button is no longer at the same screen point as it is on a full screen,
  where the dock sits at 20,24 inside the page. The two cannot both be true:
  either the button holds one position everywhere, or the corner panel is
  centred and inset. This build chose the second.

THE CORNER USES ITS WIDTH (1.5.4.98)
- Where the empty strip came from: Chrome will not draw a window under 178px,
  16 of which are the frame the bridge clips, so the corner always has 162px
  of page. A 33px button left 109 of them looking like a window that failed
  to shrink.
- The dock takes the width instead. In the corner the menu button spans the
  panel - 122px, which is 162 less a 20px margin either side - and the menu
  keeps exactly that width when it comes down, so nothing changes shape
  sideways. On a screen the dock stays compact: a full-width bar there would
  be a banner across the top.
- 122 is a fixed number on purpose. Stretching the dock to the window edge
  would be circular - the window is sized from the dock, so a dock that fills
  the window keeps the window as wide as it already was. That is exactly what
  happened on the first attempt: the collapsed bar came out 1860px wide.
- Behind it all is an engraved plate: a cross-hatch at 10px spacing with the
  name down the right edge. Wide enough apart not to be the moire that a fine
  repeat over a whole screen produced in 1.5.4.88. Only in the corner.
- Measured through every state: corner 178x96 with a 122px bar, menu 178x453
  with the same 122, a screen 1936x1071 with the compact 59px bar, collapsed
  178x133, collapsed with the menu 178x490.

THE BUTTON STOPS MOVING (1.5.4.97)
- The hop had a plain cause: the dock was at two different points on screen
  depending on the state. On a screen it sat where the stylesheet puts it
  inside the page - 13,13 - while the corner window was positioned to land it
  at 12,96. Every step through the navigation moved it between those two.
  There is one point now, 20,24, in both, and the window position never
  changes at all: measured through open menu, pick a screen, open menu again,
  go home, the window stays at the same coordinates and only its size
  changes.
- The page no longer moves the window itself when the bridge is running. It
  says what shape it wants and the bridge sets position and size in one call.
  Doing both - page moves, bridge corrects a moment later - was a second,
  smaller hop on every action. One transition per action now: menu at +53ms,
  a screen at +124ms, home at +415ms once the screen has faded.
- 20 + the 59px dock = 79, and the screen headings clear 88, so nothing
  collides.

A NOTE ON STRAY WINDOWS
- While testing this I left a CRM window from an earlier run alive on the
  desktop, and spent a while treating it as a rendering bug. If a strip of
  dock buttons is ever visible with no server behind it, it is an old window,
  not a repaint artefact - it closes from Task Manager. The bridge itself
  cannot start twice: the second one exits on the port before it opens
  anything.

STEADY SHAPE, OFF THE CORNER (1.5.4.96)
- The corner window no longer jumps. The page now tells the bridge which
  rectangle of itself matters and where it should sit, and the bridge holds
  the window to it: the same rectangle in, the same window out, checked
  against what Windows actually granted rather than against what was asked
  for. Sizing the window from its own width was what made it walk - it grew
  by one frame on every pass.
- The button is off the corner: 12px from the left, 96 from the top.
- Corner 33px of dock in a 178x85 window, menu open 178x442, a screen
  1936x1071 giving the full 1920x1032 of work area, collapsed 178x122 - each
  measured through a full round trip and steady when measured again.
- The dock height is measured from the dock itself, so the menu button is no
  longer cut in half by a height left over from when the bar was one row.

KNOWN, NOT FIXED
- Clipping the window down to just the button did not work. The bridge sets a
  window region of exactly the button and Windows reports that region back
  correctly (GetWindowRgn returns the 33x33 box), but Chrome keeps painting
  the full content area anyway, so the ground around the button is still
  visible. Clipping the browser frame away works because that region matches
  the client area; a region smaller than it does not take effect. What is on
  screen is therefore the dock on its own small panel rather than a bare
  button.

NO BROWSER FRAME (1.5.4.95)
- The browser frame is gone: no title bar, no minimise/maximise/close, no
  border. What is on screen is the CRM and nothing else. Closing is Save &
  Exit; Alt+F4 still works if something goes wrong.
- How, since neither the window styles nor the Fullscreen API could remove it
  - both were tried and measured in earlier builds. Chrome draws its title bar
  inside the client area, but it renders the page into a child window of class
  Chrome_RenderWidgetHostHWND. The bridge clips the window region to exactly
  that child, which leaves the title bar, the buttons and the borders outside
  the visible window, and then shifts the window so the page starts in the
  corner.
- Chrome refuses to size a window past the work area, so the bridge also grows
  the window by the frame it is about to clip: the page asks for 1920x1032 and
  gets 1920x1032 of content rather than 1904x993 with a strip of desktop
  showing. It recognises its own result so it cannot grow the window by
  another frame on every pass.
- Re-applied whenever the page resizes itself, which is every time a screen
  opens, the menu is used or the window is collapsed. Measured through all of
  those: corner 178x100, menu open 178x455, a screen 1920x1032, collapsed
  178x135 - all with the page starting at 0,0.
- To keep the frame, start the server with -KeepBrowserFrame.
- Fixed with it: the corner window was cutting the menu button in half. Its
  height was a fixed 100px from when the dock was one row; it is measured from
  the dock now, so it follows whatever the dock is.

ALWAYS ON TOP (1.5.4.94)
- The CRM window now stays above other applications. It is a small window
  meant to sit in the corner while other things are worked in, and without
  this it went behind the first thing clicked.
- Windows owns the z-order, so this is the OS call for it - SetWindowPos with
  HWND_TOPMOST - made by the bridge, not by the page. A page cannot ask for
  this, which is why it had to live in crm_server.ps1.
- The bridge finds its own window by matching the browser profile path in the
  command line, so it never pins a window that is not the CRM. The flag is
  re-checked every two seconds and re-applied only if it has been lost:
  a window that resizes itself, which this one does every time a screen
  opens, can come back out of the topmost band. NOACTIVATE is set, so the
  window is never pulled to the front of attention while typing elsewhere.
- To turn it off, start the server with -NoAlwaysOnTop.
- Verified end to end by running the bridge itself against a test copy on a
  separate port and profile: the log printed "Window pinned above other
  applications" and the window's WS_EX_TOPMOST read true. Also checked that
  the flag survives the page resizing its own window, which it does.

GEOMETRY (1.5.4.93)
- The note field is a textarea, and a textarea does not centre its text the
  way an input does - it starts at the top of the box whatever the box is.
  Used as a single-line field it has to be told: its line is now exactly the
  26px of room inside the 28px box, so the text sits on the same line as the
  date beside it instead of riding high.
- The dock stacks. Back is first, the collapse tab sits beside it and is 22px
  wide instead of 16, and the menu button is under Back with the menu opening
  from beneath it. Everything in the dock is a tenth larger: buttons 33px,
  icons 17px. The headings clear 88px for it.
- Whole pixels down the vertical rhythm. The page padding was
  clamp(12px, 1vw, 20px), which is 19.2px on a 1920 display: every row below
  it then started on a fraction, and a hairline on a fraction is drawn as two
  grey half-pixels rather than one line. The padding is fixed at 16, the
  screen headings have a whole minimum height, rows have heights of their own
  rather than whatever their contents came to, and the Reactivation summary
  was 77.5px tall which put the whole list on a half pixel. Checked at 1125,
  1600 and 1920 wide: every row in Being, Yesterday and Reactivation now
  starts on a whole pixel.
- Two things found while measuring and worth naming: pinning the Yesterday
  table header to 28px clipped its sort controls, which need 32 - it has a
  minimum now, not a fixed height. And the counter on a contact button is a
  badge that deliberately overhangs the corner; widening the button to
  "contain" it was chasing a false reading, so that was undone.

ONE SHAPE PER STATE (1.5.4.92)
- Sizing the window to each screen in turn was wrong: it changed shape on
  every step, which is exactly what a window should not do. All of that
  machinery is gone - the leaf measuring, the settling passes, the refits on
  every view swap and every card.
- The only window that follows what is in it is the corner one: 178x100 with
  the menu shut, and exactly as tall as the menu with it open.
- A screen takes the whole work area on a landscape display and the top half
  of a portrait one. A screen laid out in columns is unusable in a 1125x1993
  slot, and the bottom half of a tall monitor is out of the line of sight.
  Portrait is read as a work area taller than it is wide by more than 5%.
- Kept from 1.5.4.91: the quest History button stays in the flow instead of
  pinned to the bottom of a full-height box, the Clients views are as tall as
  their content, the portrait column stacking, and the tracking-goal field
  starting on the same line as every other field.

THE WINDOW IS THE SIZE OF WHAT IS IN IT (1.5.4.91)
- On a tall screen a two-row list was sitting in a 1400px window with 1100px
  of nothing under it. The window now measures what is actually drawn and
  comes back to it. Measured on this display (1920x1032 work area): Being and
  Clients 1920x360, Yesterday 1920x395, Reactivation 1920x367, Dashboard
  1920x964, the client profile 1042x967, the quest 774x784. The corner window
  is unchanged at 178x100.
- Only leaves are measured. Every container on a screen is sized to its parent
  - a panel is width:100%, height:100% - so asking a container how big it is
  gives back the window. What is drawn is in the elements with no children:
  cells, labels, fields, icons. Three things had to be handled on top of that:
  a view being swapped out is still painted and is usually the widest, so it
  is skipped; a view that scrolls reports its leaves clipped to the window, so
  its scroll height is used instead; and a screen heading is a title pushed
  apart from a count, so its right edge is the window's edge whatever the
  window is - it counts for height, not for width.
- Width is decided once and then left alone. Re-deciding it every pass turns
  into a wobble: a form given 936px reflows and asks for 1011, which is given
  1027. Height keeps being refined, because it only falls as the layout
  settles.
- Nothing is pinned to the bottom of a full-height box any more. The quest
  History button was position:absolute; bottom:12px inside a height:100%
  view, which makes the content as tall as the window by definition - that
  alone was why the quest could never shrink.
- Portrait: below a 1:1 aspect ratio the three closing quest columns stack,
  and the metric rows go to two across with the divider moving with them.
- Tracking goal was the one field that started somewhere else - its label took
  a 1fr column and pushed the input to the right edge. Every field in the
  quest form now starts on the same line.

OUTLINES BACK, EVERYTHING TIGHTER (1.5.4.90)
- Clearing the boxes went one step too far: a field with no outline does not
  look like somewhere you can type. Every input has its outline back, the
  saved quest included, where the fields had been made deliberately invisible
  in 1.5.4.81 and turned out to be unreadable as a form. Nothing gets its fill
  back - an outline says "type here", a fill says "separate sheet".
- The quest block is outlined again and is not a billboard: 7px of padding
  instead of 10, and no more minimum height.
- Last contact and follow-up were taking a third of the card. Their fields are
  28px instead of 38, the card body and header lost four pixels of padding
  each, and the note list is sized for the row it actually has. The Being card
  went from 494px tall to 398 in the dark theme and 372 in the light one.
- Notes read as comments instead of chat bubbles. They were pill-shaped blocks
  aligned to one side - a messaging app, not a log. A note is now a date and a
  line of text on one row, with rows separated by the same hairline as every
  other list.
- One rule needed writing through .being-card-modal: the sweep that cleared
  every section inside a card matches the quest block as "... .being-card-modal
  section", which outranks a plain class - the block looked padded but had no
  border, because an unresolved border falls back to none.

CLEAN GROUND, LOOSE BUTTONS (1.5.4.89)
- The brushed grain is gone. A fine repeating rake across a full screen reads
  as ripple and is unpleasant to sit in front of for a shift. What is left is
  a slow travel between four close greys with one soft highlight - metal
  without the pattern.
- The dock lost its pane. There is no panel behind the buttons any more:
  what is in the corner is the buttons themselves, each its own small piece
  of glass, with the ground carrying straight through the gaps. Each one
  therefore carries more fill and a firmer outline than the pane did, because
  a button standing on its own over a list has nothing else separating it
  from what is underneath.
- The Client Profile and Current Quest headings clear the dock. They draw
  their own headers inside the Clients screen, so the 108px the page headings
  got in 1.5.4.87 never reached them and the title ran under the buttons.

BRUSHED SILVER (1.5.4.88)
- One ground for the whole window, and it is the thing you see: a diagonal
  sweep of close greys with a fine brushed grain raked across it and the light
  catching the top-left corner. Dark theme is graphite silver, light theme is
  pale silver. It sits on the document with background-attachment: fixed, so
  it is painted once - the render cost over the same five-screen tour is
  unchanged (1641ms against 1607ms before it).
- Everything above the ground is transparent. Screens, pages, the client
  directory, the profile and quest views, the reactivation panel: no fill at
  all. Controls kept their outline and lost their slab - fields, search boxes,
  pins, filters, contact buttons, the period toggle, all of them.
- A fill is left with exactly two jobs: saying where the pointer is, and
  saying what is selected. Focus is the outline going bright, not a box
  lighting up.
- Card headers were still strips laid on the card and are now part of it. The
  card, the dock and its menu keep a fill, thinner than before so the metal
  reads through them, because those are the only things that sit over the
  ground.
- Two things had to move with it: the four client views painted an opaque
  white over the metal in the light theme from rules written under the theme
  attribute, and the selected stage tile was white text on what is now a pale
  wash - the text goes dark with the fill, otherwise the selected tile is the
  one you cannot read.

NO SHEETS (1.5.4.87)
- The previous pass made the sheets transparent. They were still sheets: a
  panel with a fill, a border and a corner radius, holding tiles with a fill,
  a border and a corner radius, holding a table shell with a fill and a
  border, holding a header with a fill and a border. Four boxes deep on every
  screen, which is the notepad look no matter how faint each box is.
- So the boxes are gone. There is one surface - the window - and everything
  on it is separated by a hairline or by nothing. Screens and their panels
  draw no box at all; tiles in a row are told apart by the line to their left
  the way columns are; lists are a line under the header and a line under
  each row, with the zebra striping dropped. Measured: Yesterday and Dashboard
  now report zero filled or boxed elements, and what is left elsewhere is
  fields, buttons and status badges.
- A fill is left with exactly two jobs: saying where the pointer is, and
  saying what is selected.
- The same rule applies inside a card, which is where it was worst - the
  sections had become panes of their own inside the pane. They are laid out
  by their headings and the space between them now, with a hairline between
  neighbours. The two grids that still drew a box around every cell (activity
  and profitability, the offer block) keep their inner dividers and lost the
  outer box.
- The card, the dock and its menu keep a fill and blur, because those are the
  only things that genuinely sit over something else.
- The headings clear 108px for the dock instead of 84: the collapse tab added
  in 1.5.4.86 made the bar wider and the Reactivation title was running into
  it.

QUICK COLLAPSE (1.5.4.86)
- A third control in the dock bar, half the width of the other two, puts the
  window away without closing anything and brings it back the same way. Home
  ends the screen; this only hides it: the screen, its scroll position, an
  open card and a half-typed note are all exactly where they were when the
  window comes back. It appears only on a screen - in the main menu the window
  is already as small as it goes.
- The chevron points down to put the window away and up to bring it back, and
  the collapse fades the screen out first for the same reason folding home
  does. The cards, quick nav and quest dialogs sit outside #app, so the state
  that hides them is on the document element next to the shell state.
- Collapsed, the menu still opens and the window still grows to hold it;
  picking a screen from there expands the window again.
- A card now closes when the screen changes. The menu is reachable over an
  open card since the dock moved out of the app shell, so switching screens
  with one open used to leave it floating over a screen it had nothing to do
  with.

GLASS, AND TWO MOVEMENTS INSTEAD OF ONE (1.5.4.85)
- Folding back to the corner used to shrink the window while the screen was
  still painted, so every table, tile and row was visibly dragged into the
  top-left corner on the way down. The screen fades out first and the window
  folds 300ms later, once there is nothing left to drag.
- Window and menu now take turns. Opening: the window grows, and 220ms later
  the menu comes down into the room it made. Closing: the menu goes first and
  the window shrinks behind it. Measured in the real application window:
  178x100 -> 178x439 at +3ms, menu at +250ms; home at +2ms, fold at +363ms.
- The dark scale used to be five opaque greys - ground #1A1A1C, panel #202023,
  plate #26262A, hover #2C2C31, active #343439 - so every surface was a sheet
  laid on the sheet below it. The same five steps are degrees of transparency
  over the one ground now (93 fills), so a surface is the ground showing
  through rather than something covering it. The inset top highlights went
  with them: a one-pixel light edge along the top of a plate is exactly how a
  raised sheet is drawn.
- Real blur is spent only where something genuinely overlaps: the dock, its
  menu and the cards. Blurring the whole screen behind a scrim would cost a
  compositor pass over the entire display for no gain, so the scrims only
  tint and the card above them does the frosting.
- The menu is a fixed 40px wide instead of max-content: "Placeholder data" in
  the version line was stretching it to whatever the longest value happened to
  be, which is why the buttons and the menu did not line up. Only the version
  number is drawn now, and it turns amber with the full explanation in the
  tooltip when the bridge is not connected.
- The exit warning lost the "VIP CRM / Safe shutdown" kicker it was
  overlapping its own title with, and the paragraph about the Google Sheet.
  It is a question, one status line and two buttons - 268x133 where it was
  370x186 - and in the corner state the window makes room for it first, since
  it is larger than the window it grows out of.

THE WINDOW IS THE DOCK (1.5.4.84)
- The bridge now opens the CRM window at 0,0 sized 420x300 - big enough to
  read the sync progress - and the page shrinks it to 178x100 the moment the
  data is in. That is the smallest window Chrome will draw; the content area
  is 162x61 and holds the one button and nothing else.
- Opening the menu grows the window to exactly the height the menu measures
  (178x446 with the current nine items), so it is never clipped, and closing
  it drops back to 178x100. Opening a screen takes the whole work area
  (1920x1032 here); Home and Back put the window back in the corner.
- The browser frame cannot be removed while the window is small. This was
  tested, not assumed: requestFullscreen sets document.fullscreenElement in
  this application window but never resizes it, and stripping WS_CAPTION and
  WS_THICKFRAME through Win32 does not help either, because the title bar is
  drawn by Chrome inside the client area rather than by Windows. The one
  thing that does remove it is F11, which is a browser-level shortcut a page
  cannot trigger - press it in the window and the frame is gone until F11 is
  pressed again.
- Because the Fullscreen API is a no-op for this window, the work area is
  taken with a plain resize instead. In an ordinary browser tab resizeTo and
  moveTo do nothing, so the page behaves exactly as before there.

THE CORNER DOCK, AND WHY IT IS FASTER (1.5.4.83)
- The CRM now opens as one small window in the top-left corner holding a
  single button. Pressing it grows the compact menu underneath, whose border
  stops exactly where the buttons stop. Choosing a screen closes the menu and
  the screen takes the whole viewport; Home folds it back and the corner
  window is all that is left. Nothing opens on hover any more.
- There is a Main Menu button again. It is the house at the top of the menu,
  and it works from anywhere, including inside the Reactivation workspace.
- Back that did nothing is fixed, and there were two separate reasons for it.
  The card overlays mark the app shell inert while they are open, and Back
  lived inside that shell, so the press reached nothing at all - the dock now
  sits outside the shell and above every overlay. And when a step declined,
  the press stopped there; Back now checks one frame later whether anything
  actually moved and takes the next step down if it did not. It also walks the
  quest, quest-history and bonus-history dialogs, which it used to jump behind.
- Save and exit grows out of the button that asked for it instead of arriving
  from the top of the screen, and the Ctrl+L hint is gone from the button.
- Speed: the previous build set one duration on every element in the document
  with a universal rule. That is what made it heavy - the browser then had to
  evaluate a transition for every element on every style change. Both
  stylesheets now carry the same two values (240ms, one curve) in the
  declarations that actually animate. Measured over the same tour of all five
  screens with the CPU throttled 6x: style recalculation 3140ms -> 629ms,
  elements restyled 16791 -> 7713, total rendering work 4077ms -> 1607ms.
  Forty transitions had also picked up an accidental 240ms delay; they no
  longer have one.
- The screens got their width back: the left column reserved 176-208px for the
  menu that used to stand there. The dock needs 55, and only across the top.
- Dead code: the old shell (menu-shell, main-menu-return, system-panel and
  the classes that positioned them), 28 selectors for classes that exist in
  neither the markup nor the script, the two blur layers behind fully opaque
  fills, and the is-fast-reactivation-return / is-zipping state classes whose
  rules had already gone.

MOTION, EXIT, CLEANUP (1.5.4.82)
- Motion had four speeds at once - 760ms for the shell, 640ms for the menu,
  520ms for the page, 130-200ms for everything else - and two override layers
  shortening some of them again, so whatever moved next ran at a different
  speed from what moved last. Everything is 240ms on one curve now; the only
  exception is the progress bars at 420ms, where the sweep is the point.
  Reduced-motion drops it all to 1ms.
- Save & Exit no longer opens a window over a black scrim. A warning slides
  down from the top edge, the screen stays visible behind it, and it asks
  whether to go on.
- Update Data, the theme switch and the version line are one panel instead of
  three loose objects in the corner.
- Dead code: the navigation trigger the rail replaced is gone from the markup,
  and with it 22 rules and 38 selectors for parts that no longer exist, plus
  28 rules whose every declaration was already overridden. The resolved value
  of every surviving selector is unchanged.

ONE BACK, ONE RAIL (1.5.4.81)
- Every screen used to grow its own return control - Back to Client Profile,
  Back to Being Card, Back to Reactivation Card, the Reactivation arrow, the
  rail arrow - and they stacked in the corner like a folder trail. There is
  one arrow now. The old controls stay in the markup and keep their origin
  logic; the single Back walks that ladder from the top and the last step is
  the main menu.
- Collapsed the rail is one outlined arrow and nothing else. Hovering it (or
  reaching it with the keyboard) opens the column of icons underneath, the
  same on every screen including Reactivation.
- Reactivation carries the same icon set as the rest, and its own Back is
  gone. Its icon is now R+.
- Every screen keeps a 74px gutter for the rail, so nothing is covered.
- Edit fields lost their placeholders: no Enter reward, no Enter quest
  conditions, no Start date. Reward was also printed twice - the section
  title and the field label - and the label is gone.
- A saved quest reads as a record: fields drop their boxes outside edit mode
  and get them back when the pencil is pressed.

NAVIGATION, SECOND PASS (1.5.4.80)
- The trigger no longer sits on the Reactivation title: on that screen it
  drops under Back, and the panel keeps a 68px gutter so the popover opens
  into empty space instead of over the queue tiles and the list.
- The screens took back the corner the old rail held: page padding on the
  left goes from 176-208px to 88px, so the Being window is 91px wider.
- The power icon is centred like the rest; it was still using the row
  alignment from the main screen.
- Main screen: buttons are 184px, and Update Data, the theme toggle and the
  version line moved from the top right corner to the top left.

NAVIGATION (1.5.4.79)
- The menu no longer sits in the bottom-left corner of every screen. Two
  30px icons live at the top left instead: Back, and a trigger that opens a
  column of icon-only buttons downward on hover or keyboard focus.
- No labels on the navigation any more; each icon keeps a tooltip and an
  aria-label, and the current screen stays highlighted.
- On Reactivation the cluster gives up its own arrow and sits beside the Back
  control that screen already draws, which is what .app[data-page] is for.
- Main screen: buttons are 240px instead of the full 500px block, left of
  centre rather than across the middle, each with its icon.

COMPACT DENSITY (1.5.4.78)
- One pass over the whole app: less bulk, lighter plates, more ground showing.
- Main menu 59px buttons at 22px type -> 40px at 15px; collapsed rail buttons
  37px -> 30px and the rail itself 190px -> 158px wide.
- Page titles 38-46px at weight 900 -> 25-30px at 700; panel padding 16 -> 12.
- Being rows 65px -> 48px (the client id and its badge share one line now),
  Reactivation rows 54px -> 44px, table headers 34/40 -> 28/32.
- Metric tiles 86px -> 67px.
- List rows stopped being filled plates: the panel carries the fill and a row
  draws only its own hairline, so a list reads as one surface with lines on
  it rather than three fills stacked.
- Delete the block marked "v1.5.4.78 - COMPACT DENSITY" in reactivation-v30.css
  to go back to the previous density.

CONTACT BLOCK FIX (1.5.4.77)
- The Last-contact bar was landing in the controls column of the Contact
  strip, so it sat across the word CONTACT and squeezed the date, time and
  the two buttons into the 58px label column. All three children now state
  their own column and row; narrow widths stack them in source order.
- Found by screenshotting the card rather than measuring it: every DOM sweep
  had called that block clean.

GREY DARK (1.5.4.76)
- Second pass on the pilot. The graphite still read blue, the surfaces sat
  too dark, and every plate carried a gradient, an inset highlight and a
  shadow at once.
- One neutral grey scale, no hue in it, a step lighter throughout:
  ground #1A1A1C, panel #202023, plate and field #26262A, hover #2C2C31,
  active #343439. Hairlines are white at 7-14%.
- Main menu buttons are flat plates now: one fill, one soft hairline, a 10px
  corner, 600 weight at about half the old size. No gradient, no inset light,
  no shadow, and none on the rail either.
- Panels, rows, cards, tiles, modals and fields all take one flat value from
  that scale, so nothing has to be read through two layers.
- Light theme is untouched: every colour rule is scoped to dark.

NOTE SAVING (1.5.4.74)  —  REDEPLOY Code.gs, API 3.4
- A save is retried four times (immediately, +0.8s, +2.2s, +5s) instead of once.
  Every field it sends is an absolute value, so a repeat cannot double-apply.
- If all four still report a failure, the browser asks the sheet what the row
  actually holds (new GET action getClientFields) and keeps the note when the
  value is already there. A reply lost on the way back looked exactly like a
  failed write, and that is what produced "rolled back" on notes that were in
  fact saved.
- A real failure still rolls back and says so.
- Server: updateClient no longer reads the whole Being_Archive sheet to find
  its columns. The column map is cached against the header row and the client
  row is cached and confirmed by its own ID cell, so a save reads about twenty
  cells instead of the entire sheet.
- The script lock is now taken around the writes only, not around the lookup,
  so two saves no longer queue behind each other reading.
- After the flush the written cells are read back; a cell that did not take is
  written once more, and only then is the save reported as done.
- Bridge timeouts: POST 30s -> 120s, GET 30s -> 60s.
- Until Code.gs 3.4 is deployed the confirmation step simply fails and the old
  behaviour returns; nothing breaks.

LAST CONTACT (1.5.4.73)
- The Reactivation client card opens on a single Contact bar: date of the
  last contact (MM/DD, with its time when the entry carries one), mails,
  calls and the total.
- The counters moved into that bar. The Email and Call buttons below it keep
  logging contacts and the separate Total chip is gone, so each number is
  stated once.

STYLESHEET STATE (1.5.4.72)
- Both stylesheets were swept twice: 238 selectors whose class appears in
  neither index.html nor main.js were removed, then 340 rules whose every
  declaration was already overridden by a later rule with the same selector.
  The resolved value of every surviving selector is unchanged; the files are
  73 KB smaller and carry about 200 fewer !important declarations.
- Being table: the header now uses the row padding, so its column labels sit
  exactly over the values.
- Single-line labels no longer run line-height 1 against overflow: hidden,
  which was shaving the bottom of glyphs in metric values, card names and
  panel headings.
- Text contrast: no text in either theme sits below 3:1 against its own
  background, and no light-theme surface paints dark.

CURRENT FUNCTIONALITY
- Being and Clients load IDs from Being_Archive through the local bridge.
- Sheet 365 is the authoritative statistics source for Yesterday, Dashboard,
  Clients and Reactivation. Player Id is matched to Being_Archive Client ID.
- Player Id and Level 1 are read once from A:B. Wide daily sections are then
  mapped from row-1 titles and their repeated date ranges exactly as in the
  supplied 365 workbook.
- In every 365 metric block, Level 1 is Last Activity Date and the dated columns
  are aggregated into Last Day, 7D, 30D and a maximum of 12M.
- Exact 365 sections: GGR, NGR, Turnover, Deposit amount, Withdrawal amnt,
  Bonus Rate, Casino Turnover, Sport Turnover, Casino GGR, Sport GGR,
  Clear Bonus and sort by. Sections are found by their row-1 title, so the
  two new amount blocks are picked up wherever the export places them.
- Deposit and Withdrawal amounts are shown in Yesterday, in the Client Profile
  performance table and in the Reactivation card statistics. The Client Profile
  table and the Reactivation statistics also carry a derived Net Loss
  (deposits minus withdrawals) for the same period; the Yesterday tiles keep
  the amount with its operation count and no Net Loss tile.
- Net Loss quests count deposits minus withdrawals over the quest range. With
  no End Date the range runs from the start to the last day the sheet holds.
  A client who never withdrew counts as zero outflow rather than missing data.
- Monetary periods use SUM over their dated columns. Bonus Rate uses
  SUM(Clear Bonus) / SUM(GGR), reconciled against the workbook Total columns.
- Yesterday columns are independently sortable; GGR Day descending is the default.
- Lifetime is no longer used or displayed; all former maximum-period values are 12M.
- Active Quest continues to read and save in fixed Being_Archive column D.
- Active Quest now stores its mechanic, section and EUR goal inside the existing quest cell.
- Quest tracking is scoped by section: Casino, Sport or Casino + Sport.
  Casino reads Casino turnover EUR, Sport reads Sport turnover eur and
  Casino + Sport reads the Turnover total, which reconciles with the sum of both.
- Cells written before sections existed carry no Tracking Section and keep
  counting Casino + Sport, so no existing quest changes its meaning.
- Turnover Insurance always validates against TOTAL GGR, whatever the section is.
- Net Loss has no per-section source, so its section selector is locked on
  Casino + Sport.
- Quest goals carry a currency: EUR, USD, USDC, USDT or CAD. Sheet 365 stays
  EUR everywhere; the goal is entered and the progress is shown in the chosen
  currency, converted at a fixed rate held in QUEST_CURRENCIES in main.js.
- Rates are ECB reference rates of 27.08.2026: 1 EUR = 1.1645 USD = 1.6151 CAD.
  USDC and USDT track USD one to one. Edit perEur in main.js to refresh them.
- Percent completion is a ratio and never depends on the chosen currency, so
  Being, Clients and Reactivation progress bars are unaffected by it.
- Cells written before currencies existed carry no Tracking Currency and are
  read as EUR, so no existing quest changes its meaning.
- Quest Start and End Date are native date pickers. The quest cell keeps the
  unambiguous ISO form, 2026-08-01, while the field displays MM/DD/YYYY.
- START_CRM launches the browser with --lang=en-US, which pins that display
  format. Without the flag the picker follows the browser's own language.
- Stored sheet formats such as 15.08.2026 still read correctly and are
  rewritten as ISO the next time the quest is saved.
- Tracking Section and Tracking Currency share one row: Current Quest is a
  fixed, non-scrolling card and a stacked field did not fit its height budget.
- The card ends above the History button strip, so Quest Completed can no
  longer be pushed underneath it on a short window.
- End Date has a No limit switch. An open-ended quest counts every day the
  sheet holds from Start Date onwards and reports the day it reached.
- No limit is stored as "End Date: no limit" in the same quest cell. A blank
  End Date still means "not filled in yet" and still stops the tracking.
- Quest progress uses inclusive daily values from sheet 365 between Start and End:
  Turnover sums TO; Turnover Insurance requires its TO goal plus positive GGR;
  Net Loss calculates Deposits minus Withdrawals. Missing source metrics show â.
- Being has a Quests filter in its header. On, the list keeps only clients with
  an active quest and orders them completed first, then by descending progress;
  the pinned / follow-up order does not apply while it is on.
- Turning the filter off restores the ordinary order exactly: pinned first,
  then follow-up date, then last contact, then name.
- The filter combines with the ID search and survives a data refresh. The count
  reads "shown / total" while either narrowing is active.
- Being Notes remain in the existing Notes column and show newest notes first.
- Being Notes show at most seven entries before internal scrolling.
- Reactivation now reads live sheets named since DD.MM.YYYY in the same spreadsheet.
- The newest since-sheet is the current queue; Being/Clients show On Reactivation only at 4+ inactive days from D.
- In Reactivation Since comes from the oldest valid since-sheet containing the ID; no baseline date is imposed.
- Days and Stage come from Days no dep when present; otherwise they are calculated from Last Dep / Last Activity / the legacy Notes date field.
- Reactivation NGR (F) and Deposit Amount (G) come only from the newest since-sheet.
- Reactivation recognizes every supplied since-sheet layout by its exact row-1 labels: Days no dep, Last Dep, Notes-date, NGR/NGR August, Dep/Dep August, PREV ATTEMPTS, PLAN, COMM, Phone, Mail and Total.
- Current Reactivation Notes read Comm from the newest sheet and never use Being_Archive Notes.
- New Reactivation Notes append to COMM of the newest sheet; latest entries are first and seven fit before scrolling.
- Offer writes the structured BD / FB / TO Deposit / Quest line to the PLAN
  column, not to COMM. Rows saved before this still show their offer, because
  an empty PLAN falls back to the offer parsed out of COMM.
- The right panel opens current Reactivation Notes by default; Offer and Notes History are separate views.
- Notes History reads the chained Previous Attempts values from later sheets in newest-first chronology.
- Mail increments Mail + Total; Call increments Phone + Total in the newest sheet's detected layout.
- Mail and Call expose their own current-session Undo and remove an undone action from visible history.
- Undone/deleted actions are not stored as history records.
- Reactivation stages read as one ramp: Active green, Catch Up yellow, Call
  Twice orange, Pre-Sleep deep orange, Sleeping red. Unassigned stays neutral
  grey and now means only what it says: no days recorded at all.
- Pre-Sleep covers 14-30 days. That band used to fall through to Unassigned, so
  a month of silence rendered as a dash with no stage and no colour.
- Reactivation Last Activity comes from sheet 365 Level 1 whenever it exists;
  the since-sheet date is the fallback. Days inactive, and therefore the stage,
  follow the same source when the sheet supplies no Days no dep.
- An ID added to Reactivation from Being now carries its real 365 figures and
  its Last Activity across. It used to arrive with zeroed metrics, no date and
  no stage.
- Bonus Rate sorts by how good the rate is, not how large, in every table that
  offers the column: Yesterday 30D and 12M, and Reactivation 12M. 0% is the
  best result there is, so ascending reads 0 -> 100 -> the negative rates,
  nearest zero first; descending reverses it. Clicking a Bonus Rate column
  opens ascending, money columns still open descending.
- The Reactivation sort caption says best to worst for Bonus Rate rather than
  lowest to highest, which would describe the wrong thing.
- The stage chips accept every stage in the status list. Pre-Sleep used to be
  missing from the accepted set, so pressing it fell back to Total.
- Reactivation client card text runs from 9px to 17px. It had been squeezed to
  5-8px in places, smaller than anything else in the app.
- The Reactivation client card carries a Back to Being control when it was
  opened from the Being card, mirroring the R -> button that got you there. It
  sits outside the card, 10px above its top-left corner, over the backdrop.
- That control is reachable because the card overlay lives outside the inert
  app wrapper, and the card does not clip its own overflow.
- While the control is shown the card is trimmed to leave room for it, so it
  cannot end up off screen on a short window. Opening the card from the
  Reactivation list leaves the card at its full height.
- Activity & Profitability carries seven metrics: Last Activity, TO, GGR, NGR,
  BR, Sport GGR and Casino GGR.
- Casino Breakdown shows turnover only for Slots, Instant and Live. Sheet 365
  has no GGR or NGR split for those, so those rows were permanent dashes.
- The two statistics panels are re-proportioned for that change, so no value is
  wider than the cell holding it.
- The client card's tiles centre their content in whatever height they end up
  with, so a stretched block does not turn its extra height into dead air.
- The same four accents drive the summary chips, the table pills and the stage
  badge in the client card, so those three can never disagree.
- Contact is inset from Instant by 15px, taken from that column's own unused
  width, so the table total is unchanged.
- The left half of the Reactivation client card fills its panel: the tile strip
  keeps its size and the 12M Play, Statistics and Decision blocks share the
  surplus, instead of leaving ~200px empty at the bottom.
- The Being client card has an R -> button that opens that ID's Reactivation
  card. It is hidden when the ID is not in the queue; +R still does the adding.
- Reactivation table headers and their figures share one right edge. The sort
  chevron sits in a gutter of its own, driven by a single inset so the two
  cannot drift apart again.
- Sport and Casino are as wide as the 12M money columns; Slots, Live and
  Instant are narrower because sheet 365 has no source for them and they always
  render a dash. The table total is unchanged and still fits its 1502px shell.
- The sticky Client column inherits its row's background instead of painting a
  fixed one, so no band of a different shade runs down the names.
- Reactivation rows use only real mapped fields; unavailable performance fields show â.
- Reactivation Client Card is split into operational data plus a Notes / Offer / History panel.
- Offer Quest is a manual text field and never opens the global quest list.
- Clicking the Reactivation card name opens the same ID in Being; the Being card has a direct return route.
- START_CRM.bat launches the server hidden.
- Save & Exit waits for pending writes before shutting down the local server and CRM window.
- Ctrl + L opens the same Save & Exit confirmation.
- No localStorage persistence.
- Dark and light themes are driven by data-theme on the html element and a set
  of semantic CSS tokens. Dark is the default and its rules are untouched; the
  light theme is a separate override layer keyed on that attribute.
- The Dark / Light control sits to the left of the system panel in Main Menu
  only. It is absolutely positioned, so Update Data, Version and Data Updated
  keep their exact places and the panel does not change size.
- The theme is NOT persisted: the app keeps no browser storage, so every start
  opens in dark. Switching repaints through CSS only, so the open screen,
  scroll position, forms and notes survive it.
- The light theme covers every screen: Main Menu, Yesterday, Dashboard,
  Clients, Client Profile, Current Quest, Reactivation and Being, plus every
  modal, table, input, select, scrollbar and empty state.
- The light ground is a blue-to-cream wash on the app container; panels and
  cards sit on it in white with soft shadows and 12px corners.
- Buttons follow three shapes: solid blue for the primary action, white with a
  hairline for secondary, near-black for a selected state.
- Meaning colours are adapted, not replaced: pinned stays gold, positive green,
  negative red, and the stage ramp still runs green to red, each darkened for a
  white ground.

IMPORTANT â APPS SCRIPT UPDATE REQUIRED
The deployed /exec endpoint must report API version 3.3.

INSTALL / UPDATE
1. Replace the full Apps Script with Code.gs from this folder.
2. Save.
3. Run setupBeingApi() if required for this spreadsheet.
4. Optionally run setupReactivationApi() to verify since-sheet discovery.
5. Run setupBeing365CacheTrigger() once per spreadsheet. It installs an
   on-change trigger, so the 365 cache is retired whenever the sheet changes,
   whatever time the export is done. Authorize the script when Apps Script
   asks; installing it again is safe. removeBeing365CacheTrigger() undoes it.
6. Deploy -> Manage deployments -> Edit -> New version -> Deploy.
7. Keep the active /exec URL and API key in being_config.json.
8. Close the previous CRM process.
9. Start START_CRM.bat.
10. Confirm:
   http://127.0.0.1:8765/being-api?action=ping

Expected:
  {"ok":true,"service":"VIP CRM Being API","version":"3.3","status":"online"}

PERFORMANCE NOTES
- getClients_ is memoised for the length of one execution and cleared by every
  write, so the read-back verifications still see the sheet as it stands.
- No mutation rebuilds the whole client feed any more. updatePinned and
  updateClient confirm their own cell; adding an ID to Reactivation scans one
  column instead of building every client with their 365 statistics.
- Reactivation contact counters read and verify the row in one pass each,
  instead of twelve single-cell reads per increment.
- Quest progress is computed once per client and held until quest data or the
  daily grid changes, so re-rendering Being no longer walks the daily grid for
  every row.
- Writes for one client are queued, so two quick clicks cannot land out of
  order. Different clients still write in parallel.
- The local bridge caches being_config.json against its own write time rather
  than re-reading and re-parsing it on every proxied request.
- Data Updated reads "Placeholder data" when the bridge is not connected, so
  synthetic figures are never mistaken for sheet figures.

365 READ PERFORMANCE
- Only the header rows are scanned to discover the 365 layout.
- Only columns that feed a real metric are read, merged into as few contiguous
  ranges as possible. Bonus Rate is derived, "sort by" is not a metric and the
  Total columns carry no date, so none of them is read.
- Display values are fetched for the Player Id / Level 1 pair only.
- Finished profiles are cached for six hours, so getClients and getReactivation
  of one CRM start share a single pass over the sheet.
- After editing 365 by hand, run resetBeing365Cache() in the Apps Script editor
  or open:
    http://127.0.0.1:8765/being-api?action=clear365Cache
- The cache key carries the latest 365 date plus the row and column counts, so
  an ordinary export â one that appends a day and drops the oldest â retires
  the previous entry on its own, with no trigger involved.
- setupBeing365CacheTrigger() covers what the key cannot see: an export that is
  re-run, or values corrected inside the existing date window. It fires on any
  change to the spreadsheet, so it does not care when the export is done.
- The trigger ignores changes that follow one of the API's own writes within
  30 seconds. Without that it invalidated the cache on every note, pin and
  quest save, and the read-back inside the same mutation then re-scanned 365
  while still holding the script lock, which made saving slow enough to fail.
- updateActiveQuest returns the saved cell only. It no longer rebuilds the
  whole client, so a quest save never touches sheet 365 at all.
- removeBeing365CacheTrigger() uninstalls it. Without the trigger the cache
  still expires after six hours and still turns over on every new export day.

365 DIAGNOSTIC
After deployment open:
  http://127.0.0.1:8765/being-api?action=debug365
The response reports the detected client count, field coverage and one compact
sample for Day / 7D / 30D / 12M without exposing the complete client feed.

For the complete Reactivation data rules, read REACTIVATION_README.txt.
