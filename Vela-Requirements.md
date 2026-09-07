# Vela — Product Requirements

**Version:** V1.1  
**Status:** Product baseline  
**Project:** Vela

> This is the authoritative product baseline for Vela. Vela is an independent travel expense management and multi-person settlement product. Carina requirements must not be imported into Vela.

## 1. Product Positioning

Vela is a travel expense management and multi-person settlement tool.

Core chain:

**Plan → Ledger → Allocation → Balance → Reflection / Export**

- **Plan:** complete container for one trip.
- **Ledger:** real payments; source of truth.
- **Allocation:** who ultimately bears each expense.
- **Balance:** calculates who paid more/less and settlement suggestions.
- **Reflection:** post-trip review and statistics.
- **Atelier:** settings, data management and backup.

Vela is not a generic personal-finance bookkeeping app.

## 2. UI / Design

### UI language

All visible UI is English.

Fixed bottom navigation, with fixed names and order:

**Home / Ledger / Balance / Reflection / Atelier**

### Visual language

Inspired by the restraint of Carina, but Vela remains a separate product:

- parchment / warm paper background
- ink / dark typography
- muted gold
- quiet, restrained, refined
- mobile-first
- no colorful dashboard
- no card overload
- text is the main character
- thin Lucide icons
- icons use muted gold / ink and remain secondary

The product should feel like a refined travel ledger, not financial SaaS.

## 3. Plan

Plan is the first-class object. One Plan represents one complete trip.

Lifecycle:

**Planning → Traveling → Settling → Completed**

Plan supports create, edit, archive, restore, history and export.

A Plan can contain multiple cities, countries/regions, currencies, Events, Ledger entries and members.

Country / Region is a destination dimension.

Plan travel dates are **inclusive natural calendar days**. If the departure flight is on the 20th and the return-home landing flight is on the 30th, the Plan travel dates are **20–30 inclusive**. Flight times do not change this date range.

## 4. Members

Each Plan has its own members.

Each member has a Plan-level default allocation ratio. The total must equal **100%** and can be edited.

**Trip participation ≠ expense participation.** Being on the trip does not mean participating in every expense.

## 5. Ledger

### Core principle

**One Ledger = One real payment.**

Ledger is the source of truth. A real payment is one Ledger entry.

Never split one real payment into multiple virtual payments merely to solve allocation or daily display.

### Required fields

At minimum:

- Payment Date
- Usage Start
- Usage End
- Description
- Category
- Amount
- Currency
- Payer
- Account
- Event
- Allocation
- Final Settlement

## 6. Payment Date ≠ Usage Period

Payment Date and usage period are independent.

A Ledger entry may represent a service used on one day or across several days.

Examples:

- Coffee paid and consumed on Jul 20 → Usage Start = Jul 20, Usage End = Jul 20.
- Hotel paid on Jul 10 for Jul 20–23 → Payment Date = Jul 10, Usage Start = Jul 20, Usage End = Jul 23.
- A prepaid round-trip flight can have a usage period spanning the outbound and return travel dates.

Bookings / prebooked payments remain ordinary Ledger entries. There is no separate booking ledger.

## 7. Prepaid vs Actual Consumption

This is a core Vela rule.

### Prepaid

A payment may be made before the service occurs. Such an entry is marked **Prepaid**.

While the service has not occurred, the entry remains in the **PRE-TRIP / Prepaid** area and does **not** enter actual daily consumption totals.

This preserves the distinction between:

- money already paid, and
- travel consumption that has actually occurred.

### Actual consumption

When a usage day has actually occurred, that day's share is moved into the corresponding daily Ledger view.

For a multi-day prepaid service, Vela may display one daily share per actual usage day while retaining **one original Ledger entry** underneath.

Example: prepaid hotel ¥1,500 for three nights:

```text
PREPAID before the trip
Hotel — ¥1,500 — Jul 20–23

After actual use begins
Jul 20   Hotel   ¥500
Jul 21   Hotel   ¥500
Jul 22   Hotel   ¥500
```

The three daily rows are **views of one Ledger payment**, not three payments.

### Unused future days remain Prepaid

If only part of a multi-day service has occurred, only the occurred days enter daily actual consumption. The remaining days stay Prepaid.

This is important because a future hotel stay, ticket or transport booking may still change, be cancelled, be refunded or have its price changed.

### Daily distribution

For a multi-day prepaid amount without a more specific actual daily price, the default display distribution is an equal daily split with cent-level rounding. This is a **daily consumption display**, not a creation of additional payments.

A future enhancement may allow explicit daily amounts when the real service has non-uniform daily prices.

### Discrete services

Do not force discrete multi-date services such as round-trip flights to be averaged across every calendar day merely for visual symmetry.

A round-trip flight should be represented according to its actual travel dates / legs where appropriate.

## 8. Event / Item

**Event** groups related payments, e.g. `Kuala Lumpur Hotel` with Deposit, Balance and Refund.

**Item** may provide a finer level of organization when needed.

Event / Item are organizational structures and never change the fact that Ledger records real payments.

## 9. Category

Category is a first-class data field, not a decorative UI tag.

Default categories:

- Accommodation
- Food
- Transport
- Shopping
- Tickets
- Activities
- Communication
- Other

Category participates in Ledger, statistics, Excel export and personal bill.

## 10. Allocation

Allocation answers **who ultimately bears the expense**.

- **Payer:** who actually paid.
- **Allocation:** who ultimately bears the expense.

Do not create a complex “A paid for B” relationship model.

For daily actual views, the original allocation is proportionally represented in each actual day. The underlying historical allocation remains attached to the single original Ledger entry.

## 11. Allocation Modes

Each expense selects participating members and one mode.

### Default

Use the Plan default ratios, re-normalized only among selected participants.

### Split

Equal split among selected participants.

### Custom

Manually specify amount or percentage. Custom allocation must equal the Ledger amount exactly.

## 12. Allocation History Must Freeze

Once Allocation exists, later changes to Plan default ratios must not affect historical transactions.

Every Allocation stores the historical mode, participants, percentages and amounts.

## 13. Multi-Currency

Vela does **not** provide an FX engine.

Ledger always preserves the original amount and original currency.

## 14. Final Settlement

Each Plan has a Settlement Currency, commonly CNY.

Final settlement values come from actual settlement, not guessed exchange rates.

## 15. Pending Settlement

A transaction is Pending when Final Amount is missing, Final Currency is missing, or Final Currency ≠ Plan Settlement Currency.

Pending transactions do not enter final Balance calculations.

Never guess an FX rate.

## 16. Multi-Currency Allocation Display

Original amount/currency is always primary.

Example: `Me 40.00 MYR → ¥64.00`.

If final settlement is unknown, show the original amount/currency only.

Prefer a **Show Pending** filter over oversized warnings on every card.

## 17. Final Allocation Calculation

When final settlement is known:

`allocationFinal = allocation.amount / ledger.amount × ledger.finalAmount`

Original currency allocation is never overwritten.

## 18. Balance

Balance has two distinct concepts.

### Allocation Result

Calculate what each person ultimately bore versus what each person actually paid.

For partially actualized prepaid multi-day entries, only the actualized portion participates in settlement calculations. Future prepaid usage remains outside final settlement until it actually occurs.

### Transfer Suggestions

Minimize practical settlement transfer count.

## 19. Pending Filter

Balance provides **Show Pending · N** / **Show All**.

Pending transactions do not participate in final settleable Balance.

## 20. Refund

A refund is always a **new negative Ledger entry**. Never edit the original expense.

## 21. Account

Account represents where money comes from / goes out.

Account and Payer are independent concepts.

## 22. Reflection

Reflection is the post-trip review.

Core dimensions:

- Total
- Category breakdown
- Destination
- Event
- Member
- Currency
- Pending settlement
- Personal spending / allocation
- Daily actual consumption
- Prepaid / not-yet-actual amounts

Daily statistics should use actualized usage days rather than counting future prepaid amounts as already consumed.

Different currencies remain separate. Only explicit Final Settlement contributes to settled totals in the Plan Settlement Currency.

## 23. Export

Vela supports Excel export.

The export must preserve:

- Payment Date
- Usage Start / End
- Prepaid status
- Actualized dates
- Original Amount / Currency
- Payer
- Account
- Allocation
- Final Settlement

## 24. Personal Bill

A personal bill is a private view of one person's own allocation.

It should show actual daily consumption clearly and keep future, not-yet-used prepaid amounts in a separate Prepaid area.

It must not expose other people's personal allocation details.

## 25. Backup

Vela is **Local-first**.

Must support Export Backup, Import Backup and Restore data.

Imported data must be structurally validated.

## 26. Data Architecture

```text
PLAN
 │
 ├── Members
 ├── Events
 │    └── Items
 ├── Ledger
 │    └── Allocation
 │
 ├── Prepaid / Actual Usage View
 │
 ├── Balance
 └── Reflection / Export
```

The critical rule is:

```text
One real payment
      ↓
One Ledger entry
      ↓
Historical Allocation
      ↓
Prepaid until actually used
      ↓
Actual daily consumption view
      ↓
Final Settlement
      ↓
Balance
```

Derived daily views must never create contradictory duplicate payments.

## 27. Product Principles — Conflict Resolution Order

When requirements conflict, use this priority order:

1. **Ledger is fact.** One real payment = one Ledger entry.
2. **Allocation is the bearing relationship.** Payer ≠ bearer.
3. **Prepaid is not actual consumption.** Future usage remains Prepaid until it occurs.
4. **Actual daily views are derived from the original Ledger.** They never create duplicate payments.
5. **Plan is the trip container.**
6. **Original amounts are immutable history.**
7. **Never guess FX.**
8. **Historical allocations are frozen.**
9. **Participation is expense-specific.**
10. **Refunds preserve history.**
11. **Category is formal data.**
12. **Vela is independent from Carina.**

## Final Project Boundary

```text
yvettezhou-lab/Vela
        ↓
      Vela

        ≠

yvettezhou-lab/sb1-ujdefmx6
        ↓
      Carina
```

Vela and Carina are completely separate projects. Vela must remain in `yvettezhou-lab/Vela`; Carina remains in `yvettezhou-lab/sb1-ujdefmx6`.
