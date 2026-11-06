#Requires -Version 7.4
param(
    [Parameter(Mandatory)] [ValidateSet('test', 'play')] [string] $Variant,
    [Parameter(Mandatory)] [string] $JdkPath,
    [Parameter(Mandatory)] [string] $SdkPath
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$buildRoot = Join-Path (Split-Path $PSScriptRoot -Parent) '.android-build'
$jdk = (Resolve-Path -LiteralPath $JdkPath).Path
$sdk = (Resolve-Path -LiteralPath $SdkPath).Path
$cliRoot = Join-Path $buildRoot 'bubblewrap/node_modules/@bubblewrap/cli'
$cliPackage = Get-Content -Raw -LiteralPath (Join-Path $cliRoot 'package.json') | ConvertFrom-Json
if ($cliPackage.version -ne '1.25.0') {
    throw 'Install Bubblewrap CLI 1.25.0 as described in android/README.md.'
}
$cli = Join-Path $cliRoot 'bin/bubblewrap.js'
$manifestPath = Join-Path $PSScriptRoot "twa-$Variant.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$project = New-Item -ItemType Directory -Force -Path (Join-Path $buildRoot $Variant)
$artifacts = New-Item -ItemType Directory -Force -Path (Join-Path $buildRoot 'artifacts')
$configPath = Join-Path $project.FullName 'bubblewrap-config.json'
@{ jdkPath = $jdk; androidSdkPath = $sdk } | ConvertTo-Json | Set-Content -LiteralPath $configPath
Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $project.FullName 'twa-manifest.json')

$previousJavaHome = $env:JAVA_HOME
$previousAndroidHome = $env:ANDROID_HOME
$previousAndroidSdkRoot = $env:ANDROID_SDK_ROOT
Push-Location -LiteralPath $project.FullName
try {
    $keystore = (Resolve-Path -LiteralPath $manifest.signingKey.path).Path
    $passwordPath = [IO.Path]::ChangeExtension($keystore, '.password.xml')

    $env:JAVA_HOME = $jdk
    $env:ANDROID_HOME = $sdk
    $env:ANDROID_SDK_ROOT = $sdk
    node $cli update --skipVersionUpgrade --config $configPath
    # Use the generated wrapper with the current cmdline-tools SDK layout.
    $gradleTask = if ($Variant -eq 'test') { 'assembleRelease' } else { 'bundleRelease' }
    ./gradlew.bat --no-daemon $gradleTask

    $password = if (Test-Path -LiteralPath $passwordPath) {
        Import-Clixml -LiteralPath $passwordPath
    } else {
        Read-Host -AsSecureString "Keystore password for $($manifest.signingKey.alias)"
    }
    $env:VAULT_ANDROID_KEY_PASSWORD = [Net.NetworkCredential]::new('', $password).Password

    if ($Variant -eq 'test') {
        $apkSigner = Join-Path $sdk 'build-tools/36.1.0/apksigner.bat'
        & $apkSigner sign --ks $keystore --ks-key-alias $manifest.signingKey.alias `
            --ks-pass env:VAULT_ANDROID_KEY_PASSWORD --out vault-test.apk `
            app/build/outputs/apk/release/app-release-unsigned.apk
        & $apkSigner verify --print-certs vault-test.apk
        Copy-Item -LiteralPath 'vault-test.apk' -Destination $artifacts.FullName
    } else {
        $jarSigner = Join-Path $jdk 'bin/jarsigner.exe'
        & $jarSigner -keystore $keystore -storepass:env VAULT_ANDROID_KEY_PASSWORD `
            -signedjar productivity-vault-play.aab app/build/outputs/bundle/release/app-release.aab `
            $manifest.signingKey.alias
        & $jarSigner -verify productivity-vault-play.aab
        Copy-Item -LiteralPath 'productivity-vault-play.aab' -Destination $artifacts.FullName
    }
} finally {
    Remove-Item Env:VAULT_ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue
    $env:JAVA_HOME = $previousJavaHome
    $env:ANDROID_HOME = $previousAndroidHome
    $env:ANDROID_SDK_ROOT = $previousAndroidSdkRoot
    Pop-Location
}
