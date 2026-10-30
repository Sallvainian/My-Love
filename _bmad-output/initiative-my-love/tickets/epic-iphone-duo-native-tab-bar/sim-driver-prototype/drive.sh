#!/bin/zsh
# usage: drive.sh SIM_UDID ORIENT [TAP_X TAP_Y]
# ORIENT: portrait | landscapeLeft | landscapeRight | none. Taps are in page
# points, offset from the web view's origin. DUMP=1 prints the readout's text;
# TAP_FIELD=1 taps the first text field. Build once first, in this folder:
# `xcodegen generate`, then `xcodebuild build-for-testing -project
# SimDriver.xcodeproj -scheme RunnerUITests -destination id=SIM_UDID
# -derivedDataPath dd`.
DIR=${0:A:h}
TEST_RUNNER_DUMP="${DUMP:-}" TEST_RUNNER_TAP_FIELD="${TAP_FIELD:-}" TEST_RUNNER_ORIENT="$2" TEST_RUNNER_TAP_X="${3:-}" TEST_RUNNER_TAP_Y="${4:-}" xcodebuild test-without-building -project "$DIR/SimDriver.xcodeproj" -scheme RunnerUITests -destination "id=$1" -derivedDataPath "$DIR/dd" -only-testing:RunnerUITests/Drive/testDrive 2>&1 | grep --line-buffered -E 'DRIVE|TEST (SUCCEEDED|FAILED)|error'
