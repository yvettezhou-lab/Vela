# Vela — Product Requirements

**Version:** V1.2  
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

### Fixed navigation

**Home / Ledger / Balance / Reflection / Atelier**

### Visual language

Parchment / warm paper, ink / dark typography, muted gold, quiet and restrained, mobile-first, text-first, thin Lucide icons, no colorful financial SaaS dashboard.

## 3. Plan

Plan is the first-class object. One Plan represents one complete trip.

Lifecycle:

**Planning → Traveling → Settling → Completed**

Plan supports create, edit, archive, restore, history and export.

A Plan can contain multiple destinations, currencies, Events, Ledger entries and members.

Plan travel dates are **inclusive natural calendar days**. If the departure flight is on the 20th and the return-home landing flight is on the 30th, the Plan travel dates are **20–30 inclusive**. Flight times do not change this date range.

## 4. Members

Each Plan has its own members. Each member has a Plan-level default allocation ratio. The total must equal **100%**.

**Trip participation ≠ expense participation.**

## 5. Ledger

### Core principle

**One Ledger = One real payment.**

Never split one real payment into multiple virtual payments merely to solve allocation or daily display.

### Required fields

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

A Ledger entry may represent a service used on one day, continuously across several days, or on several discrete dates.

Examples:

- Coffee paid and consumed on Jul 20 → Usage Start = Jul 20, Usage End = Jul 20.
- Hotel paid on Jul 10 for Jul 20–23 → Payment Date = Jul 10, Usage Start = Jul 20, Usage End = Jul 23.
- A prepaid round-trip flight paid on Jul 10 for outbound Jul 20 and return Jul 30 → Usage Start = Jul 20, Usage End = Jul 30, with **Discrete Usage Dates = Jul 20 and Jul 30**.

### Discrete usage dates

Some services occur on multiple separated dates rather than continuously.

For discrete services, Vela stores explicit `usageDates`. Daily consumption, Prepaid remaining amounts, Reflection, Balance and Personal Bill use those explicit dates instead of averaging the payment across every calendar day between Usage Start and Usage End.

The default Quick Entry behavior for **Transport** with different Usage Start / End dates is discrete usage: the amount is represented on the departure and return dates only. This prevents a round-trip flight from being incorrectly spread across the entire trip.

Continuous services such as Accommodation remain continuous across their Usage Start / End range.

## 7. Prepaid vs Actual Consumption

This is a core Vela rule.

### Prepaid

A payment may be made before the service occurs. Such an entry is marked **Prepaid**.

While service dates have not occurred, the entry remains in **PRE-TRIP / Prepaid** and does not enter actual daily consumption totals.

### Actual consumption

When a usage date actually occurs, that date's share moves into the corresponding daily Ledger view while the original Ledger payment remains one record.

For a discrete round-trip flight, only the two flight dates become usage views. The days between the outbound and return flights are never treated as flight consumption days.

### Daily distribution

For a continuous multi-day service without explicit daily prices, the amount is distributed equally across its usage dates with cent-level rounding.

For a discrete service, the amount is distributed across its explicit usage dates.

### Unused future dates remain Prepaid

If only part of a service's usage dates has occurred, only occurred dates enter actual consumption. Remaining dates stay Prepaid.

## 8. Event / Item

Event groups related payments. Item provides finer organization. They never change the fact that Ledger records real payments.

## 9. Category

Default categories:

- Accommodation
- Food
- Transport
- Shopping
- Tickets
- Activities
- Communication
- Other

Category participates in Ledger, statistics, Excel export and Personal Bill.

## 10. Allocation

Allocation answers **who ultimately bears the expense**.

- **Payer:** who actually paid.
- **Allocation:** who ultimately bears the expense.

Historical allocation is frozen on the Ledger entry.

## 11. Allocation Modes

- **Default:** Plan default ratios, re-normalized among selected participants.
- **Split:** equal split.
- **Custom:** manually specified percentages/amounts totaling exactly 100% / the Ledger amount.

## 12. Multi-Currency

Vela does not provide an FX engine. Original amount and currency are preserved.

## 13. Final Settlement / Pending

A transaction is Pending when Final Amount is missing, Final Currency is missing, or Final Currency differs from Plan Settlement Currency.

Pending transactions do not enter final Balance calculations.

Never guess FX.

## 14. Balance

### Allocation Result

Calculate what each person ultimately bore versus what each person actually paid.

Only actualized usage participates in settlement. Future prepaid usage remains outside final settlement.

### Transfer Suggestions

Minimize practical settlement transfer count.

## 15. Refund

A refund is always a **new negative Ledger entry**. Never edit the original expense.

## 16. Account

Account represents the money source / destination and is independent from Payer.

## 17. Trip Readiness

During the **Planning** stage, Home provides a Trip Readiness check.

The check has three pre-departure checkpoints:

- **T−15 days**
- **T−7 days**
- **T−3 days**

At each checkpoint, Vela checks the current Plan data for:

1. **Accommodation coverage:** every Plan travel date has at least one Accommodation Ledger entry covering that date.
2. **Major transport closure:** a major Transport entry exists on the first travel date and another on the final travel date, forming an outbound / return transport closure.

Transport entries explicitly recorded as discrete usage dates are preferred for this closure check. Flight / train / rail / bus / ferry / coach / airline descriptions are also recognized as major transport indicators.

The check is advisory: it does not create fake Ledger entries or infer bookings that are not recorded.

## 18. Reflection

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

Different currencies remain separate. Only explicit Final Settlement contributes to settled totals in Plan Settlement Currency.

## 19. Export

Excel export preserves Payment Date, Usage Start / End, Prepaid status, actualized dates, original amount / currency, Payer, Account, Allocation and Final Settlement.

## 20. Personal Bill

A Personal Bill is a private view of one person's own allocation. Actual usage and future prepaid usage remain visually separated. It must not expose other people's personal allocation details.

## 21. Backup

Vela is Local-first. Support Export Backup, Import Backup and Restore with structural validation.

## 22. Data Architecture

```text
PLAN
 │
 ├── Members
 ├── Events
 │    └── Items
 ├── Ledger
 │    └── Allocation
 │
 ├── Continuous Usage / Discrete Usage Dates
 ├── Prepaid / Actual Usage View
 ├── Trip Readiness
 ├── Balance
 └── Reflection / Export
```

Critical rule:

```text
One real payment
      ↓
One Ledger entry
      ↓
Continuous usage range OR explicit discrete usage dates
      ↓
Historical Allocation
      ↓
Prepaid until actually used
      ↓
Actual usage view
      ↓
Final Settlement
      ↓
Balance
```

Derived daily views never create duplicate payments.

## 23. Product Principles — Conflict Resolution Order

1. **Ledger is fact.** One real payment = one Ledger entry.
2. **Allocation is the bearing relationship.** Payer ≠ bearer.
3. **Prepaid is not actual consumption.**
4. **Actual daily views are derived from the original Ledger.**
5. **Discrete services use explicit usage dates rather than artificial continuous averaging.**
6. **Plan is the trip container.**
7. **Original amounts are immutable history.**
8. **Never guess FX.**
9. **Historical allocations are frozen.**
10. **Participation is expense-specific.**
11. **Refunds preserve history.**
12. **Category is formal data.**
13. **Trip readiness is advisory and never invents missing bookings.**
14. **Vela is independent from Carina.**

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
