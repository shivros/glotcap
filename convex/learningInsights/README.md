# Learning Insights

This folder holds the normalization, scoring, and rule configuration used to
summarize recurring correction patterns into learning insights.

## Files

- `rules.ts`: Canonical rule list (extend here to add patterns).
- `normalization.ts`: Normalizes correction data and applies rules.
- `scoring.ts`: Recency-weighted scoring helpers.

## How to extend rules

1. Add a new rule in `rules.ts` with a clear `pattern`, short `canonical` label,
   and broad `category` (category can evolve).
2. Keep canonical labels short (2–4 words).
3. Prefer high-signal patterns; avoid rules that trigger on common filler words.

## Notes

- Scoring is computed at query time, so changing half-life does not require
  database updates.
- Insights are generated only at session end, and only for repeated issues.
