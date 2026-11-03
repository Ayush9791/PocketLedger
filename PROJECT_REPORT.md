# PocketLedger v0.1.0 Project Report

## Objective
Offline Android finance management for income, expenses, bank imports, tuition collections, budgets, and monthly reporting without a cloud backend.

## Architecture
- React Native + Expo SDK 54, JavaScript.
- SQLCipher encrypted SQLite in private app storage.
- Random DB key generated locally and stored via Expo SecureStore backed by Android Keystore.
- CSV import through Document Picker and Papa Parse.
- SMS inbox through a local Expo Android native module after user permission.
- Monetary values stored as integer paise.
- Tuition payments are also recorded as income transactions.
- Monthly budgets compare category limits with expense transactions.
- Reports provide monthly totals, six-month cash flow, expense categories, and tuition collection estimates.

## Feature status
| Feature | Implementation status |
|---|---|
| Dashboard and manual transactions | Source implemented |
| CSV import and preview | Source implemented; device testing pending |
| SMS inbox read and parser | Native source implemented; build/device testing pending |
| Tuition and partial payments | Source implemented |
| Budgets and progress | Source implemented |
| Reports and charts | Source implemented |
| SQLCipher encryption | Configured in source; native build verification pending |
| Encrypted backup/restore | Not included |

## Distribution
The direct APK requests READ_SMS. Google Play restricts this permission to eligible default SMS/Assistant handlers or approved exceptions. This build must not be assumed Play Store compliant.

## Validation
A successful GitHub Actions build and physical-device test are required before calling the APK ready. No release is published by the build-artifact workflow. Review the APK artifact first.
