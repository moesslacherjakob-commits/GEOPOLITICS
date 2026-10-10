# Desk: ECONOMY4YOU — markets, money, economy, global

Channel @ECONOMY4YOU · Monday–Friday · post 14:45 Vienna (before the US open) · YouTube category NEWS_POLITICS · accent green. The general run is `desks/PLAYBOOK.md`; this file covers what is specific to the economy desk.

## Where to look (last 24 h)
Story selection and facts come from newspapers, wire services and TV broadcasters:
- **Daily market roundups:** Reuters "Morning Bid" column, CNBC "5 things to know before the stock market opens", Bloomberg "Five Things to Start Your Day", AP and Reuters market wraps, TheStreet / Yahoo Finance live market blogs (for exact closes)
- **Outlets:** Reuters (Markets, Business), AP Business, Bloomberg, CNBC, Financial Times, The Wall Street Journal, BBC Business, Axios, The Washington Post (AP market tables), DW Business, Nikkei Asia
- **Official data (to support, not to pick the story):** central-bank statements (Fed, ECB, BoJ, BoE, PBoC), statistics offices (BLS for CPI and jobs, Eurostat), IEA/OPEC for oil, company filings and press releases (as the company's claim)

Search queries with today's date, e.g. "stock market today <Month D, YYYY>", "Morning Bid <date>", "oil prices <date>", "Fed <date>", "earnings <company> <date>".

## How to pick
The story is the **biggest market move of the last 24 h that can be explained as cause → effect in three steps**. Score on: number of major outlets leading with it · size of the move (index, sector, currency, commodity, megacap) · a clear cause · global relevance.
Typical winners: central-bank decisions and surprises · inflation or jobs data that moved markets · oil or gas spikes and crashes · a sector sell-off triggered by one deal or ruling · megacap earnings that moved the whole index · currency or bond-market stress · trade/tariff decisions with immediate market impact.
Avoid: single small-cap or penny stocks, crypto pumps, rumours, "stock X could double" stories, personal-finance tips.
On Mondays the "last 24 h" window covers the weekend plus Friday's close; on a market holiday pick the most important economy story instead.

## Desk rules
- **No investment advice.** Never say or imply buy, sell, hold, "opportunity", price targets or predictions. Analyst views only as attributed quotes ("Bernstein says…").
- **Numbers exact, with a timestamp:** "closed down 13.3 percent on Friday", "Brent at 103 dollars on Friday morning". Use closing values when available; label intraday numbers as intraday. When outlets differ, use the later figure and name its source, or leave it out.
- Company statements are claims ("SpaceX says…"). Reported but unconfirmed deal terms are attributed ("about 8 billion dollars, according to The Wall Street Journal").
- Explain the mechanism in plain words (what spectrum is, why yields move with inflation) — stable background knowledge is fine.
- The disclaimer with "not financial advice" is appended automatically; keep "NOT FINANCIAL ADVICE" in the end-scene sources line too.

## Chart data
The Default environment's network only reaches package registries and GitHub, so market-data APIs can't be called from the shell. Use WebFetch (it runs outside the sandbox) on a page that shows the values, e.g. an outlet's market table, a stooq.com or Yahoo Finance history page, or a FRED series page.
- A `chart` is allowed only when you have the actual data points from such a page **and** the last value matches a figure in a news article (within rounding). Put the data page in the scene's `source`.
- Otherwise do not draw a curve: use `ticker` (moves), `counter` (one big number), `bars` (comparison) or `chain` (mechanism) with numbers from the articles.
- Never interpolate, smooth or invent data points.

## Visual grammar
- **Hook:** `globe` on the country or region behind the move, `chip` "MARKETS · <DATE>", `headline` (2 lines, second in `accent`). For a pure numbers story a `counter` right after the hook works too.
- **Fact blocks:** pick per story —
  - `ticker` for the day's moves (2–6 rows; 3 rows render large)
  - `chart` for a trend (yield, oil, index over days or weeks) with `events` marking the trigger, `band` for "this week", `change` for the move
  - `chain` for the cause → effect explanation (oil ↑ → inflation ↑ → rates ↑ → stocks ↓), `dir: up/down` on the steps
  - `counter` for one headline number (deal size, market value lost), `bars` for comparisons, `quote` for one short attributed quote
  - `map` with `tag`/`callout`/`arc` when geography matters (oil routes, factories, trade partners, regulators)
- **End:** globe, two punchlines, sources line ending with "NOT FINANCIAL ADVICE".
- Section names like THE DEAL · THE SELL-OFF · THE THREAT / THE NUMBER · THE CAUSE · WHAT'S NEXT. Vary scene mixes day to day.

## Upload
- Title ≤ 60 characters + ` #shorts`, factual ("SpaceX Bought Airwaves. Phone Giants Sold Off").
- Description: 2–3 sentences with the key numbers, then `Sources: …`, then hashtags (`#stocks #markets` + company/topic). The desk disclaimer (incl. "not financial advice") is appended automatically.
- Tags: `markets`, `stocks`, `economy`, `news` + companies, tickers, topic.
