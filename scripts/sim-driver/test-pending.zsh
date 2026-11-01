#!/bin/zsh
# Checks `sim pending`'s decoder (pending.py) and `sim schedule`'s validation
# with no simulator, against fixtures/UserNotifications: the host's
# Library.plist and its PendingNotifications.plist as the iOS 27 simulator
# wrote them after `sim schedule fixtures/host-requests.json`, plus
# fixtures/pending-empty.plist, the file after every request was removed.
# Cases that break an archive edit a copy of it with plistlib.
#
# Refreshing the fixtures (iOS changed the format, or this is another
# simulator), on a booted device with the host authorized:
#   1. sim permission allow --host
#   2. sim schedule scripts/sim-driver/fixtures/host-requests.json
#   3. D=<dataPath>/Library/UserNotifications, <dataPath> from
#      `xcrun simctl list devices -j` (the device's dataPath); the host's
#      folder is the value of dev.sallvain.simdriver.runner in
#      `python3 -I scripts/sim-driver/pending.py --raw $D/Library.plist`
#   4. rm -r scripts/sim-driver/fixtures/UserNotifications, then copy
#      $D/Library.plist to fixtures/UserNotifications/Library.plist and
#      $D/<host folder>/PendingNotifications.plist to
#      fixtures/UserNotifications/<host folder>/PendingNotifications.plist
#      (check first that Library.plist holds only bundle ids and folder UUIDs)
#   5. sim unschedule probe-interval probe-once probe-yearly, then copy that
#      same PendingNotifications.plist to fixtures/pending-empty.plist
# FOLDER below is read from the folder's name, so nothing else changes.
# Run: zsh scripts/sim-driver/test-pending.zsh
emulate zsh
TOOL=${0:A:h}
SIM=$TOOL/sim
TMP=$(mktemp -d)
trap 'rm -rf $TMP' EXIT
failed=0
HOST=dev.sallvain.simdriver.runner
FOLDER=${$(print -rl -- $TOOL/fixtures/UserNotifications/*(/:t))[1]}

# The three scheduled requests as pending.py prints them: the fixture's own
# JSON, compacted (its keys are already in the output's order).
node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))))' \
  $TOOL/fixtures/host-requests.json >$TMP/want-all
node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).filter((r) => r.identifier !== "probe-once")))' \
  $TOOL/fixtures/host-requests.json >$TMP/want-two

# want-all with FIELD blanked in every request (an empty body or threadId has
# no key in the archive and prints as "").
node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).map((r) => ({ ...r, [process.argv[2]]: "" }))))' \
  $TOOL/fixtures/host-requests.json body >$TMP/want-nobody
node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).map((r) => ({ ...r, [process.argv[2]]: "" }))))' \
  $TOOL/fixtures/host-requests.json threadId >$TMP/want-nothread
node -e 'const l = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); l[0].title += " (edited)"; console.log(JSON.stringify(l))' \
  $TOOL/fixtures/host-requests.json >$TMP/list-retitled

# Copies the fixtures to $TMP/NAME and prints that path.
fresh() {
  mkdir -p $TMP/$1
  cp -R $TOOL/fixtures/UserNotifications/. $TMP/$1/
  print -r -- $TMP/$1
}

# edit FILE KIND ARG...: rewrites FILE, a copy of a fixture archive.
#   drop-record ID           removes the record with that identifier
#   drop-key KEY             removes KEY from every record
#   reverse                  reverses the order of the records
#   rename-string FROM TO    changes a string anywhere in the archive
#   set-date ID KEY JSON     sets KEY (NS.second, say) to a JSON value in that
#                            record's TriggerDateComponents
#   set-key ID KEY JSON      sets the record's KEY to a JSON value
#   self-ref ID KEY          points the record's KEY back at the record itself
#   set-folder BUNDLE JSON   sets Library.plist's folder for BUNDLE
# A failed edit is a failed case: otherwise a case whose expected output is
# the unedited fixture's would pass on an edit that never happened.
edit() {
  python3 -I - "$@" <<'PY' || { print -r -- "FAIL edit $*"; failed=1; }
import json, plistlib, sys
path, kind, *args = sys.argv[1:]
archive = plistlib.load(open(path, "rb"))
objs = archive["$objects"]
ref = lambda u: objs[u.data]
# The root is the archived array (or, for Library.plist, dict).
root = ref(archive["$top"]["root"])
def named(rec):
    return {ref(k): i for i, k in enumerate(rec["NS.keys"])}
def records():
    return [ref(u) for u in root["NS.objects"]]
def ident(rec):
    return ref(rec["NS.objects"][named(rec)["AppNotificationIdentifier"]])
def swap(x, a, b):
    if isinstance(x, dict):
        return {k: swap(v, a, b) for k, v in x.items()}
    if isinstance(x, list):
        return [swap(v, a, b) for v in x]
    return b if x == a else x
if kind == "drop-record":
    root["NS.objects"] = [u for u in root["NS.objects"] if ident(ref(u)) != args[0]]
elif kind == "drop-key":
    for rec in records():
        i = named(rec)[args[0]]
        del rec["NS.keys"][i], rec["NS.objects"][i]
elif kind == "reverse":
    root["NS.objects"].reverse()
elif kind == "rename-string":
    archive["$objects"] = swap(objs, args[0], args[1])
elif kind == "set-date":
    rec = next(r for r in records() if ident(r) == args[0])
    ref(rec["NS.objects"][named(rec)["TriggerDateComponents"]])[args[1]] = json.loads(args[2])
elif kind == "set-key":
    rec = next(r for r in records() if ident(r) == args[0])
    objs.append(json.loads(args[2]))
    rec["NS.objects"][named(rec)[args[1]]] = plistlib.UID(len(objs) - 1)
elif kind == "self-ref":
    uid = next(u for u in root["NS.objects"] if ident(ref(u)) == args[0])
    rec = ref(uid)
    rec["NS.objects"][named(rec)[args[1]]] = uid
elif kind == "set-folder":
    i = named(root)[args[0]]
    objs[root["NS.objects"][i].data] = json.loads(args[1])
plistlib.dump(archive, open(path, "wb"), fmt=plistlib.FMT_BINARY)
PY
}

# NAME WANT_EXIT WANT_STDOUT DIR BUNDLE [STDERR_PATTERN...]: runs the decoder;
# WANT_STDOUT is a file holding the exact line, or - for no stdout at all.
check() {
  local name=$1 want=$2 out=$3 dir=$4 bundle=$5 code=0
  shift 5
  python3 -I $TOOL/pending.py $dir $bundle >$TMP/out 2>$TMP/err || code=$?
  local -a why
  (( code == want )) || why+="exit $code, wanted $want"
  if [[ $out == - ]]; then
    [[ ! -s $TMP/out ]] || why+="stdout was not empty: $(<$TMP/out)"
  else
    [[ "$(<$TMP/out)" == "$(<$out)" ]] || why+="stdout differs: $(<$TMP/out)"
  fi
  local pat
  for pat in "$@"; do
    grep -qF -- "$pat" $TMP/err || why+="stderr lacks '$pat'"
  done
  report $name $why
}

report() {
  local name=$1; shift
  if (( $# )); then
    print -r -- "FAIL $name: ${(j:; :)@}"
    sed 's/^/  stderr: /' $TMP/err
    failed=1
  else
    print -r -- "ok   $name"
  fi
}

print '[]' >$TMP/want-none

d=$(fresh three)
check three-requests 0 $TMP/want-all $d $HOST

d=$(fresh one-removed)
edit $d/$FOLDER/PendingNotifications.plist drop-record probe-once
check one-removed 0 $TMP/want-two $d $HOST

d=$(fresh absent-bundle)
check app-never-registered 0 $TMP/want-none $d dev.sallvain.never.registered dev.sallvain.never.registered

d=$(fresh no-file)
rm $d/$FOLDER/PendingNotifications.plist
check folder-without-pending-file 0 $TMP/want-none $d $HOST "PendingNotifications.plist does not exist"

d=$(fresh empty-archive)
cp $TOOL/fixtures/pending-empty.plist $d/$FOLDER/PendingNotifications.plist
check empty-archive 0 $TMP/want-none $d $HOST

d=$(fresh missing-key)
edit $d/$FOLDER/PendingNotifications.plist drop-key AppNotificationTitle
check record-missing-key 1 - $d $HOST "record 0 (probe-interval)" AppNotificationTitle

d=$(fresh missing-trigger-key)
edit $d/$FOLDER/PendingNotifications.plist drop-key TriggerRepeats
check record-missing-trigger-key 1 - $d $HOST TriggerRepeats

d=$(fresh missing-interval)
edit $d/$FOLDER/PendingNotifications.plist drop-key TriggerTimeInterval
check record-missing-interval 1 - $d $HOST "record 0 (probe-interval)" TriggerTimeInterval

# A key that is present but holds the wrong type is refused, not printed.
for bad in 'TriggerRepeats 1 bool' 'AppNotificationTitle 5 str' 'TriggerTimeInterval "3600" int'; do
  set -- ${(z)bad}
  d=$(fresh wrong-type-$1)
  edit $d/$FOLDER/PendingNotifications.plist set-key probe-interval $1 $2
  check record-$1-wrong-type 1 - $d $HOST "record 0 (probe-interval)" "key $1 is" "not $3"
done
for bad in 9.5 true; do
  d=$(fresh date-component-$bad)
  edit $d/$FOLDER/PendingNotifications.plist set-date probe-once NS.hour $bad
  check date-component-hour-$bad 1 - $d $HOST "record 1 (probe-once)" "date component hour" "not an integer"
done

d=$(fresh self-reference)
edit $d/$FOLDER/PendingNotifications.plist self-ref probe-once AppNotificationTitle
check archive-refers-to-itself 1 - $d $HOST "refers back to itself"

d=$(fresh unknown-trigger)
edit $d/$FOLDER/PendingNotifications.plist rename-string Calendar Mystery
check unknown-trigger-class 1 - $d $HOST "record 1 (probe-once)" "unknown trigger class Mystery"

d=$(fresh unreadable)
print -r -- 'not a plist' >$d/$FOLDER/PendingNotifications.plist
check unreadable-archive 1 - $d $HOST PendingNotifications.plist

d=$(fresh reversed)
edit $d/$FOLDER/PendingNotifications.plist reverse
check sorted-by-identifier 0 $TMP/want-all $d $HOST

d=$(fresh no-body)
edit $d/$FOLDER/PendingNotifications.plist drop-key AppNotificationMessage
check empty-body-has-no-key 0 $TMP/want-nobody $d $HOST

d=$(fresh no-thread)
edit $d/$FOLDER/PendingNotifications.plist drop-key SBSPushStoreNotificationThreadKey
check empty-thread-has-no-key 0 $TMP/want-nothread $d $HOST

d=$(fresh undefined-component)
edit $d/$FOLDER/PendingNotifications.plist set-date probe-once NS.second 9223372036854775807
check undefined-component-omitted 0 $TMP/want-all $d $HOST

d=$(fresh date-default-extras)
edit $d/$FOLDER/PendingNotifications.plist set-date probe-once NS.leapMonth 0
check default-extras-accepted 0 $TMP/want-all $d $HOST

d=$(fresh unknown-date-key)
edit $d/$FOLDER/PendingNotifications.plist set-date probe-once NS.bogus 1
check date-components-unknown-key 1 - $d $HOST "record 1 (probe-once)" "unknown key NS.bogus"

d=$(fresh wrong-date-class)
edit $d/$FOLDER/PendingNotifications.plist rename-string NSDateComponents NSFoo
check date-components-wrong-class 1 - $d $HOST "record 1 (probe-once)" "is class NSFoo"

for extra in 'timeZone 1' 'calendar 1' 'leapMonth 1' 'repeatedDay true'; do
  d=$(fresh date-extra-${extra% *})
  edit $d/$FOLDER/PendingNotifications.plist set-date probe-once NS.${extra% *} ${extra#* }
  check date-components-sets-${extra% *} 1 - $d $HOST "record 1 (probe-once)" "NS.${extra% *}"
done

d=$(fresh folder-slash)
edit $d/Library.plist set-folder $HOST "\"../$FOLDER\""
check library-folder-with-slash 1 - $d $HOST "folder for $HOST"

d=$(fresh folder-dot)
edit $d/Library.plist set-folder $HOST '".hidden"'
check library-folder-leading-dot 1 - $d $HOST "folder for $HOST"

d=$(fresh folder-number)
edit $d/Library.plist set-folder $HOST 5
check library-folder-not-a-string 1 - $d $HOST "folder for $HOST is 5"

d=$(fresh no-library)
rm $d/Library.plist
check missing-library-plist 1 - $d $HOST "Library.plist does not exist"

check missing-directory 1 - $TMP/no-such-directory $HOST "is not a directory"

# --raw prints an archive's generic form: the host's folder is in it.
code=0
python3 -I $TOOL/pending.py --raw $TOOL/fixtures/UserNotifications/Library.plist >$TMP/out 2>$TMP/err || code=$?
why=()
(( code == 0 )) || why+="exit $code, wanted 0"
grep -qF "\"$HOST\": \"$FOLDER\"" $TMP/out || why+="stdout lacks the host's folder"
report raw-dump $why

# sim schedule validates FILE before it looks for a device, so these need none.
# CASE FILE_CONTENT PATTERN: the file holds CONTENT; sim must exit 2, name the
# problem and have launched nothing.
refuse() {
  local name=$1 content=$2 pat=$3 code=0
  print -r -- $content >$TMP/schedule.json
  zsh $SIM schedule $TMP/schedule.json >$TMP/out 2>$TMP/err || code=$?
  local -a why
  (( code == 2 )) || why+="exit $code, wanted 2"
  grep -qF -- "$pat" $TMP/err || why+="stderr lacks '$pat'"
  [[ ! -s $TMP/out ]] || why+="stdout was not empty"
  grep -q 'simctl\|runner' $TMP/err && why+="got as far as the device"
  report $name $why
}

refuse schedule-not-json 'this is not json' 'not JSON'
refuse schedule-missing-field \
  '[{"identifier":"a","title":"t","body":"b","trigger":{"type":"interval","seconds":60,"repeats":false}}]' \
  'lacks a string threadId'
refuse schedule-missing-trigger-repeats \
  '[{"identifier":"a","title":"t","body":"b","threadId":"x","trigger":{"type":"interval","seconds":60}}]' \
  'boolean repeats'
refuse schedule-bad-component \
  '[{"identifier":"a","title":"t","body":"b","threadId":"x","trigger":{"type":"calendar","dateComponents":{"month":"June"},"repeats":true}}]' \
  'not an integer'
refuse schedule-empty-array '[]' 'non-empty array'
refuse schedule-zero-seconds \
  '[{"identifier":"a","title":"t","body":"b","threadId":"x","trigger":{"type":"interval","seconds":0,"repeats":false}}]' \
  'positive seconds'
refuse schedule-short-repeat \
  '[{"identifier":"a","title":"t","body":"b","threadId":"x","trigger":{"type":"interval","seconds":30,"repeats":true}}]' \
  'under 60 seconds'
refuse schedule-empty-title-and-body \
  '[{"identifier":"a","title":"","body":"","threadId":"x","trigger":{"type":"interval","seconds":60,"repeats":false}}]' \
  'empty title and body'
refuse schedule-duplicate-identifier \
  '[{"identifier":"a","title":"t","body":"b","threadId":"x","trigger":{"type":"interval","seconds":60,"repeats":false}},{"identifier":"a","title":"t","body":"b","threadId":"x","trigger":{"type":"interval","seconds":60,"repeats":false}}]' \
  'repeats identifier a'
refuse schedule-extra-key \
  '[{"identifier":"a","title":"t","body":"b","threadId":"x","sound":true,"trigger":{"type":"interval","seconds":60,"repeats":false}}]' \
  'unknown sound'
refuse schedule-unknown-trigger-type \
  '[{"identifier":"a","title":"t","body":"b","threadId":"x","trigger":{"type":"location","repeats":false}}]' \
  'not interval or calendar'
refuse schedule-unknown-component \
  '[{"identifier":"a","title":"t","body":"b","threadId":"x","trigger":{"type":"calendar","dateComponents":{"hour":9,"nanosecond":1},"repeats":true}}]' \
  'dateComponents has unknown nanosecond'
refuse schedule-unknown-trigger-key \
  '[{"identifier":"a","title":"t","body":"b","threadId":"x","trigger":{"type":"interval","seconds":60,"repeats":false,"leeway":1}}]' \
  'trigger has unknown leeway'
refuse schedule-trigger-not-object \
  '[{"identifier":"a","title":"t","body":"b","threadId":"x","trigger":60}]' \
  'lacks a trigger object'
code=0
zsh $SIM schedule $TMP/no-such-file >$TMP/out 2>$TMP/err || code=$?
(( code == 2 )) && grep -qF 'no schedule file' $TMP/err && print "ok   schedule-no-file" || { print "FAIL schedule-no-file: exit $code"; failed=1; }
code=0
zsh $SIM unschedule >$TMP/out 2>$TMP/err || code=$?
(( code == 2 )) && grep -qF 'unschedule takes one or more identifiers' $TMP/err && print "ok   unschedule-no-ids" || { print "FAIL unschedule-no-ids: exit $code"; failed=1; }
# Runs one of sim's functions (everything above its "---- main" marker) in a
# fresh zsh, with $SIM as $0 so the header finds its checkout; stdin passes.
sim_fn() { zsh -c 'eval "$(sed "/^# ---- main/,\$d" $0)"; "$@"' $SIM "$@"; }

# The shipped fixture is itself a schedule sim accepts: the validator prints
# it back compacted and refuses nothing.
sim_fn check_schedule $TOOL/fixtures/host-requests.json >$TMP/out 2>$TMP/err &&
  [[ "$(<$TMP/out)" == "$(<$TMP/want-all)" ]] && print "ok   schedule-accepts-fixture" || { print "FAIL schedule-accepts-fixture"; sed 's/^/  stderr: /' $TMP/err; failed=1; }

# NAME WANT_EXIT LIST MODE ARG: pending_satisfies on the pending list in LIST.
satisfies() {
  local name=$1 want=$2 code=0
  sim_fn pending_satisfies $4 $5 <$3 >$TMP/out 2>$TMP/err || code=$?
  local -a why
  (( code == want )) || why+="exit $code, wanted $want"
  report $name $why
}
node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).filter((r) => r.identifier === "probe-once")))' \
  $TOOL/fixtures/host-requests.json >$TMP/schedule-one.json
node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).reverse()))' \
  $TOOL/fixtures/host-requests.json >$TMP/schedule-reversed.json
satisfies wait-full-list 0 $TMP/want-all present $TOOL/fixtures/host-requests.json
# Other pending requests and the schedule file's order do not matter.
satisfies wait-extra-listed 0 $TMP/want-all present $TMP/schedule-one.json
satisfies wait-unordered-schedule 0 $TMP/want-all present $TMP/schedule-reversed.json
satisfies wait-partial-list 1 $TMP/want-two present $TOOL/fixtures/host-requests.json
satisfies wait-changed-title 1 $TMP/list-retitled present $TOOL/fixtures/host-requests.json
satisfies wait-removed-still-listed 1 $TMP/want-all absent '["probe-once"]'
satisfies wait-removed-gone 0 $TMP/want-two absent '["probe-once"]'

# pending's argument parsing, before any device lookup. A bundle id gets past
# it (whatever happens next depends on the machine's simulators).
# CASE WANT_EXIT ARG...: want 0 means "got past parsing", not "exited 0".
arguments() {
  local name=$1 want=$2 code=0
  shift 2
  zsh $SIM pending "$@" >$TMP/out 2>$TMP/err || code=$?
  local -a why
  if (( want == 2 )); then
    (( code == 2 )) || why+="exit $code, wanted 2"
    grep -qF 'pending takes [BUNDLE | --host]' $TMP/err || why+="stderr lacks the usage message"
  else
    grep -qF 'pending takes [BUNDLE | --host]' $TMP/err && why+="rejected a valid argument"
  fi
  report $name $why
}
arguments pending-accepts-bundle-id 0 com.example.app
arguments pending-accepts-host 0 --host
arguments pending-refuses-two-arguments 2 a b
arguments pending-refuses-host-and-bundle 2 --host x
arguments pending-refuses-bad-characters 2 bad/bundle
exit $failed
