# Build Productivity Vault for Android

The two Trusted Web Activity packages open `https://prod-vault-ten.vercel.app/`. `com.eliptr.productivityvault.test` is the private APK, and `com.eliptr.productivityvault` is the Play package. They can be installed side by side and can share site data when they use the same browser profile.

## Rebuild on Windows

Use PowerShell 7.4+, Node.js 22+, JDK 17, and the Android SDK with Platform Tools, `platforms;android-36`, `build-tools;35.0.0` for Gradle, and `build-tools;36.1.0` for APK signing. The Android wrapper supports Android 7.0 and later. From the repository root, install the pinned Bubblewrap CLI into the ignored build directory.

```powershell
npm install --prefix .android-build/bubblewrap --no-save @bubblewrap/cli@1.25.0
```

Place the existing PKCS#12 keystores in `.android-build/keys` as `vault-test.p12` and `vault-upload.p12`. Their aliases are `vault-test` and `vault-upload`. The build reads a Windows-encrypted `vault-test.password.xml` or `vault-upload.password.xml` from the same directory when present, or prompts for the keystore password. These XML files can be decrypted by the same Windows user on the same machine. Keep a separate secure backup of the keystores and their passwords.

The initial toolchain is in `.android-build/toolchain`. Set these paths to your own JDK and SDK locations if needed.

```powershell
$vaultJdk = (Get-ChildItem .android-build/toolchain -Directory -Filter 'jdk-17*' | Select-Object -First 1).FullName
$vaultSdk = (Resolve-Path .android-build/toolchain/sdk).Path
./android/build.ps1 test -JdkPath $vaultJdk -SdkPath $vaultSdk
./android/build.ps1 play -JdkPath $vaultJdk -SdkPath $vaultSdk
```

The files to distribute are `.android-build/artifacts/vault-test.apk` for the phone and `.android-build/artifacts/productivity-vault-play.aab` for Play Console. Increase `appVersionCode` in the relevant TWA configuration for each new Android release. The signing keys stay in the local build directory.

## Device and Play testing

1. Install `vault-test.apk` on a physical Android phone, for example with `adb install -r`. Use a test device or browser profile. If the profile already holds a vault, export a backup before testing restore.
2. Open **Vault Test** online and confirm it opens without Chrome's address bar. The production Digital Asset Links file must return HTTP 200 with the APK's signing certificate fingerprint.
3. After the online launch, turn off Wi-Fi and mobile data. Create and edit a sample record, close and reopen the app, and verify the record persists. Export and restore a backup using test data.
4. Once Play Console is available, create `com.eliptr.productivityvault`, upload the production AAB to an internal testing release, and obtain the SHA-256 app signing fingerprints from Play App Signing. Add them in a separate `com.eliptr.productivityvault` entry in `public/.well-known/assetlinks.json`, then deploy and verify the live file before rolling out the internal release. Use the Play App Signing fingerprints for this entry.
5. Install from the internal testing track and repeat the launch, offline, and backup checks before proceeding toward public release.
