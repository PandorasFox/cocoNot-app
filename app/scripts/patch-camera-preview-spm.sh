#!/bin/sh
# Patch camera-preview Package.swift for Capacitor 8 compatibility.
# Run via npm postinstall.

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

exit 0
