#!/bin/zsh
# usage: notify.sh SIM_UDID STEP
# STEP: request | schedule | home | banner | badge | center. For banner, start
# this first and send `xcrun simctl push` once it prints "NOTE watching";
# TAPBANNER=1 taps the banner, BG=1 puts Settings in front first.
# Run `xcodegen generate` here first.
DIR=${0:A:h}
TEST_RUNNER_BG="${BG:-}" TEST_RUNNER_TAPBANNER="${TAPBANNER:-}" TEST_RUNNER_NSTEP="$2" xcodebuild test-without-building -project "$DIR/SimDriver.xcodeproj" -scheme RunnerUITests -destination "id=$1" -derivedDataPath "$DIR/dd" -only-testing:RunnerUITests/Notify/testStep 2>&1 | grep --line-buffered -E 'NOTE|TEST (SUCCEEDED|FAILED)|error:'
