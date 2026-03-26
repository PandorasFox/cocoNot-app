#!/bin/sh
# Patch Capacitor community plugins for SPM / Capacitor 8 compatibility.
# Run via npm postinstall.

# --- image-to-text: ships without Package.swift, has mixed ObjC+Swift sources ---
ITT="node_modules/@capacitor-community/image-to-text/Package.swift"
if [ ! -f "$ITT" ]; then
cat > "$ITT" << 'EOF'
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorCommunityImageToText",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapacitorCommunityImageToText",
            targets: ["CapacitorCommunityImageToTextSwift", "CapacitorCommunityImageToTextObjC"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", "8.0.0"..<"9.0.0")
    ],
    targets: [
        .target(
            name: "CapacitorCommunityImageToTextSwift",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin",
            exclude: ["Info.plist", "Plugin.h", "Plugin.m"],
            sources: ["Plugin.swift"]
        ),
        .target(
            name: "CapacitorCommunityImageToTextObjC",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                "CapacitorCommunityImageToTextSwift"
            ],
            path: "ios/Plugin",
            exclude: ["Info.plist", "Plugin.swift"],
            sources: ["Plugin.m"],
            publicHeadersPath: "."
        )
    ]
)
EOF
echo "Patched image-to-text with Package.swift"
fi

# --- camera-preview: Pin range + product name fix for Capacitor 8 ---
CP="node_modules/@capacitor-community/camera-preview/Package.swift"
if [ -f "$CP" ]; then
  CHANGED=false
  if grep -q 'from: "7.0.0"' "$CP"; then
    sed -i '' 's/from: "7.0.0"/"7.0.0"..<"9.0.0"/' "$CP"
    CHANGED=true
  fi
  # Capacitor expects product name to match package name (no "Plugin" suffix)
  if grep -q 'name: "CapacitorCommunityCameraPreviewPlugin"' "$CP"; then
    sed -i '' 's/name: "CapacitorCommunityCameraPreviewPlugin"/name: "CapacitorCommunityCameraPreview"/' "$CP"
    CHANGED=true
  fi
  [ "$CHANGED" = true ] && echo "Patched camera-preview Package.swift for Capacitor 8 compatibility"
fi
