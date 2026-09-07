# Vela — Product Requirements

**Version:** V1.0  
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

Plan supports:

- create
- edit
- archive
- restore
- history
- export

A Plan can contain multiple cities, countries/regions, currencies, Events, Ledger entries and members.

Country / Region is a destination dimension.

## 4. Members

Each Plan has its own members.

Example: Me, Dad, Mom, Child 1, Child 2.

Each member has a Plan-level default allocation ratio. The total must equal **100%** and can be edited.

Example:

| Member | Default |
|---|---:|
| Adult A | 30% |
| Adult B | 30% |
| Child A | 20% |
| Child B | 20% |

**Trip participation ≠ expense participation.** Being on the trip does not mean participating in every expense.

## 5. Ledger

### Core principle

**One Ledger = One real payment.**

Ledger is the source of truth. A real payment is one Ledger entry, e.g. `Hotel — MYR 600 — paid by Me — Maybank`.

Never split one real payment into multiple virtual payments merely to solve allocation.

### Required fields

At minimum:

- Date
- Usage Date (when different from payment date)
- Description
- Category
- Amount
- Currency
- Payer
- Account
- Event
- Allocation
- Final Settlement

## 6. Payment Date ≠ Usage Date

Payment Date and Usage Date are independent.

Example: pay ¥1000 on Mar 1 for a stay on Mar 10.

Bookings / prebooked payments remain ordinary Ledger entries with an additional Usage Date. There is no separate booking ledger.

## 7. Event / Item

**Event** groups related payments, e.g. `Kuala Lumpur Hotel` with Deposit, Balance and Refund.

**Item** may provide a finer level of organization when needed.

Event / Item are organizational structures and never change the fact that Ledger records real payments.

## 8. Category

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

## 9. Allocation

Allocation answers **who ultimately bears the expense**.

- **Payer:** who actually paid.
- **Allocation:** who ultimately bears the expense.

Do not create a complex “A paid for B” relationship model. Actual payer + allocation is sufficient.

## 10. Allocation Modes

Each expense selects participating members and one mode.

### Default

Use the Plan default ratios, re-normalized only among selected participants.

Example: Plan default A 50% / B 30% / C 20%; if only A+B participate, A 62.5% / B 37.5%.

### Split

Equal split among selected participants. Example: ¥300 / A+B+C → ¥100 each.

### Custom

Manually specify amount or percentage.

Custom allocation must equal the Ledger amount exactly. No residual such as ¥100 allocated as ¥99.99.

## 11. Allocation History Must Freeze

Once Allocation exists, later changes to Plan default ratios must not affect historical transactions.

Every Allocation stores the historical:

- mode
- participants
- percentages
- amounts

## 12. Multi-Currency

Vela does **not** provide an FX engine.

Trips may contain MYR / USD / SGD / THB / CNY and other currencies.

Ledger always preserves the original amount and original currency, e.g. `MYR 150.00`.

## 13. Final Settlement

Each Plan has a **Settlement Currency**, commonly CNY.

Final settlement values come from actual settlement, not guessed exchange rates.

Example: original MYR 150; actual final settlement ¥240 → Final Amount ¥240, Final Currency CNY.

## 14. Pending Settlement

A transaction is Pending when:

- Final Amount is missing, or
- Final Currency is missing, or
- Final Currency ≠ Plan Settlement Currency.

Pending transactions do not enter final Balance calculations.

Never guess an FX rate or automatically estimate RMB.

## 15. Multi-Currency Allocation Display

Original amount/currency is always the primary information.

Example:

`Me 40.00 MYR → ¥64.00`

MYR 40.00 is the original allocation; ¥64.00 is the known final settlement allocation.

If final settlement is unknown, show the original amount/currency only.

Do not put oversized Pending labels on every card. Prefer a **Show Pending** filter entry.

## 16. Final Allocation Calculation

When final settlement is known:

`allocationFinal = allocation.amount / ledger.amount × ledger.finalAmount`

Example:

Ledger = MYR 150; Allocation = A 40 / B 40 / C 70; Final Settlement = ¥240.

Therefore:

- A → ¥64
- B → ¥64
- C → ¥112

Original MYR allocation is never overwritten.

## 17. Balance

Balance has two distinct concepts.

### Allocation Result

Calculate what each person ultimately bore versus what each person actually paid. This yields each person's net position: who should receive and who should pay.

### Transfer Suggestions

Minimize settlement transfer count. Equivalent balances should be compressed into the smallest practical set of transfers rather than producing unnecessary chains.

## 18. Pending Filter

Balance provides:

- **Show Pending · N**
- **Show All**

Pending means:

- finalAmount missing
- finalCurrency missing
- finalCurrency ≠ Plan settlementCurrency

Pending transactions do not participate in final settleable Balance.

## 19. Refund

A refund is always a **new negative Ledger entry**. Never edit the original expense.

Example:

- Hotel +¥1000
- Hotel Refund -¥200

Both entries remain in history.

## 20. Account

Account represents where money comes from / goes out.

Examples:

- Cash
- Alipay
- WeChat Pay
- Bank Card
- Credit Card

Account and Payer are independent concepts.

## 21. Reflection

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

Different currencies must remain separate. Never combine MYR 10,000 + CNY 5,000 into one meaningless number.

Only transactions with explicit Final Settlement may contribute to settled totals in the Plan Settlement Currency.

## 22. Export

Vela must support **Excel export**.

### Overview

- Plan
- Dates
- Destinations
- Members
- Settlement currency
- Total

### Full Ledger

- Date
- Usage Date
- Description
- Category
- Event
- Amount
- Currency
- Payer
- Account
- Final Amount
- Final Currency

### Allocation Detail

For every expense:

- participant
- original allocation
- final allocation
- allocation mode

### Settlement

- paid
- borne
- balance
- suggested transfers

## 23. Personal Bill

A personal bill may be generated for one person.

It must not expose other people's personal Allocation details.

It should contain:

- Event
- Description
- Category
- Trip total
- This person's allocation

It must not expose a full person-by-person allocation breakdown to someone who should not see it.

## 24. Backup

Vela is **Local-first**. Core data is stored locally.

Must support:

- Export backup
- Import backup
- Restore data

Imported data must be structurally validated and must not blindly corrupt the existing database.

## 25. Data Architecture

Core relationship:

```text
PLAN
 │
 ├── Members
 ├── Events
 │    └── Items
 ├── Ledger
 │    └── Allocation
 ├── Balance
 └── Reflection / Export
```

Core data flow:

```text
Real Payment
      ↓
    Ledger
      ↓
  Allocation
      ↓
Final Settlement
      ↓
    Balance
      ↓
Transfer Suggestions
```

Core entities center on Plan, Member, Account, Category, Event, Item, Ledger and Allocation. Balance, Reflection and Export are derived from authoritative data and must not maintain contradictory copies.

## 26. Product Principles — Conflict Resolution Order

When requirements conflict, use this priority order:

1. **Ledger is fact.** One real payment = one Ledger entry.
2. **Allocation is the bearing relationship.** Payer ≠ bearer.
3. **Plan is the trip container.** Trip data is organized around Plan.
4. **Original amounts are immutable history.** Never rewrite original currency amounts.
5. **Never guess FX.** Unknown final settlement remains Pending.
6. **Historical allocations are frozen.** Changing defaults cannot change historical Allocation.
7. **Participation is expense-specific.** Trip participation ≠ expense participation.
8. **Refunds preserve history.** Refund = negative Ledger entry.
9. **Category is formal data.** It is not decorative metadata.
10. **Vela is independent from Carina.** No Carina product logic is to be imported into Vela.

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