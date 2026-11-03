# Changelog

## 0.1.0 candidate
- SQLCipher encrypted local SQLite and Android Keystore-backed key storage.
- Manual income/expense transactions and monthly dashboard.
- CSV bank-statement import with normalization, preview, and duplicate detection.
- Android SMS inbox import with local parsing, preview, and duplicate detection.
- Student records, partial tuition payments, and payment history.
- Monthly category budgets and overspending indicators.
- Monthly reports, six-month cash-flow bars, expense category breakdown.
- GitHub Actions build artifact and signed release workflows.

## Known limitations
- SMS parsing is heuristic and must be reviewed.
- READ_SMS policy eligibility must be reviewed before any Play Store submission.
- Encrypted export/restore, biometric app lock, and historical tuition fee revisions are not included.
- Android build and physical-device validation are pending.
