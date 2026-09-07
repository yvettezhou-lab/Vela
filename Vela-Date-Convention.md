# Vela — Trip Date Convention

## Plan Start / End Dates

Vela uses **inclusive calendar-day dates** for a Plan.

- `Start Date` = the calendar day on which the trip begins.
- `End Date` = the calendar day on which the trip ends.
- Both dates are included in the trip.
- The Plan does not interpret flight departure/arrival times to shorten the date range.

### Example

If the outbound flight departs on the **20th** at any time between `00:00–23:59`, and the return-home flight lands on the **30th** at any time between `00:00–23:59`, the Plan trip dates are:

**20–30**

That means the trip contains every calendar day from the 20th through the 30th, inclusive.

### Important distinction

Plan dates describe the **trip period**.

Ledger keeps two independent dates:

- **Payment Date** — when the money was actually paid.
- **Usage Date** — when the expense belongs to / was used during the trip.

A payment made before the trip can therefore belong to the trip through its Usage Date, and may also be marked as Planned / pre-trip purchase in the presentation layer.

No timezone or flight-time calculation should change the inclusive Plan date range.