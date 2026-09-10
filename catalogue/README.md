# Maintaining the service catalogue

- `issues.csv` owns canonical IDs, matching patterns, exclusions, priority, service availability, qualification notes, source-row references, and one positive matching example per issue.
- `questions.csv` owns question IDs, labels, and optional answer choices separated by `|`. Keep existing IDs stable to preserve saved answers. Blank choices mean a free-text answer.
- `Offered` means intake is supported, not automatic booking. Existing pricing and provider checks still apply. New scope requires operator review before scheduling.
- `Review first` requires operator scope/provider review. `Referral only` permits intake but blocks assignment and Instant Book.
- `legacy_flags` records the supplied matrix's unverified values. It does not determine licence requirements. No legal or credential verification is performed.
- Matching patterns are developer-maintained regular expressions. Broad standalone words such as `leak`, `loose`, and `patch` must not be used as service matches. Specific phrase rules outrank broad existing subjects; exclusions separate related services.
- Run `npm run catalogue:generate` after editing the CSVs. This validates the inputs and regenerates app data and the question table. Run `npm test` before publishing. Build and test both reject stale generated files.
- All 78 source rows are traceable in `source_rows`. The 81 final entries include the earlier symptom-specific issues and consolidate overlapping source categories. Source files in Downloads remain unchanged.
- Default referral-only services: roof repair, HVAC, water heaters, junk removal, irrigation, retaining walls, pipe/burst-pipe work, and sump/basement flooding. These are adjustable demo service policies, not claims about licensing.
