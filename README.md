# PocketLedger

Offline-first Android personal finance manager. Records stay on the device; there is no backend, cloud database, analytics service, or transaction upload.

## v0.1 candidate features
- Dark dashboard and manual income/expense entries.
- CSV bank-statement import with debit/credit detection, preview, and duplicate detection.
- Android SMS inbox import with local parsing, preview, and duplicate detection.
- Tuition students, monthly fees, partial payments, and payment history.
- Monthly category budgets with progress and overspending indicators.
- Monthly reports, six-month cash-flow bars, expense category breakdown, and tuition estimates.
- SQLCipher-encrypted SQLite with a random database key stored using Android Keystore-backed SecureStore.

## Build
```bash
npm install
npx expo prebuild --platform android
npx expo run:android
```
SQLCipher requires a native build; Expo Go is not supported. The app refuses to open an unencrypted database.

## CSV import
Common headers include date, transaction date, amount, type, debit, credit, withdrawal, deposit, narration, remarks, description, reference, UTR, and transaction id. Accepted dates: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY. Review imports against the original bank statement.

## SMS privacy and distribution
SMS inbox access is user-initiated and parsed locally. The parser is heuristic; verify suggested transactions before importing. The direct APK requests READ_SMS. Google Play restricts SMS permissions to qualifying default SMS/Assistant handlers or approved exceptions. This APK is not represented as Play Store compliant.

## Encryption
SQLCipher encrypts the database file. SecureStore protects the random key using Android Keystore-backed storage. Uninstalling or clearing app data can destroy both records and key. Encrypted backup/restore is not included, so do not rely on this as the only copy of important financial records.

## GitHub Actions signing
Add repository secrets:
- ANDROID_KEYSTORE_BASE64
- ANDROID_KEYSTORE_PASSWORD
- ANDROID_KEY_ALIAS
- ANDROID_KEY_PASSWORD

The build workflow produces a signed APK artifact for inspection. It does not publish a GitHub Release. A separate tag-triggered workflow publishes only when a release tag is pushed. Never commit the keystore or passwords.

Keep package ID com.pocketledger.finance, the same signing key, and increase android.versionCode for every update. See SIGNING.md.
