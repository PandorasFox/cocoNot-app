# CocoNot 🥥🚫

Real-time coconut ingredient detection. Point your camera at a product label — CocoNot scans for coconut-related keywords and barcodes, flags them, and optionally makes alarming geiger counter noises.

## Install

**iOS (TestFlight):** [testflight.apple.com/join/vWvjgcB5](https://testflight.apple.com/join/vWvjgcB5)

**Android:** Download the latest APK from [GitHub Actions](../../actions/workflows/android.yml) (click the latest run → Artifacts → `coconot.apk`)

## Build from source

```bash
# Android
./build android    # → dist/coconot.apk

# iOS (requires Xcode + signing)
./build ios        # → dist/CocoNot.xcarchive
```

Requires: Node 22+, JDK 21 (temurin), Android SDK, Xcode (iOS only).
