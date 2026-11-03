# Signing and in-place updates

Android updates require the same application ID, the same signing certificate, and a higher versionCode.

Package ID: com.pocketledger.finance.

## GitHub Actions secrets
Add these under Settings → Secrets and variables → Actions:
- ANDROID_KEYSTORE_BASE64: Base64-encoded JKS file.
- ANDROID_KEYSTORE_PASSWORD: keystore password.
- ANDROID_KEY_ALIAS: alias (pocketledger).
- ANDROID_KEY_PASSWORD: private-key password.

PowerShell:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('.\\pocketledger-upload.jks')) | Set-Clipboard
```

The build workflow decodes the key only on the temporary runner, signs the APK, and uploads it as an artifact. The release workflow is separate and runs only after a v* tag is pushed.

Never commit the JKS file or passwords. Keep secure offline backups. If the key is lost, existing direct-APK installations cannot receive normal in-place updates signed with the original certificate.

For every release, preserve the package ID and key, increment android.versionCode, and update release notes. READ_SMS policy requirements must be reviewed separately before Google Play submission.
