#!/bin/zsh
# Checks center's exit codes and restore with no simulator: sim's functions
# are loaded with ax, xcrun, pkill, sleep and the runner steps stubbed over a
# fake device kept in files, and cmd_center runs once per case in a subshell.
# An EXIT trap set in a function sees $? as 0 after exit, which once made a
# failed read exit 0, and nothing else catches that.
# ax, xcrun, pkill and sleep are scripts on PATH, not functions: when die's
# exit (nested below cmd_center) runs the EXIT trap, zsh ends the trap as soon
# as a function it calls directly returns, so function stubs would cut a
# failed read's restore short where the real commands do not.
# Run: zsh scripts/sim-driver/test-center-exit.zsh
emulate zsh
zmodload zsh/system
SIM=${0:A:h}/sim
TMP=$(mktemp -d)
trap 'rm -rf $TMP' EXIT
failed=0

# The stubs read the case's fake device from $DEV and its faults from the
# exported variables check sets.
mkdir $TMP/bin
print -r -- '#!/bin/zsh -f' >$TMP/bin/sleep
print -rl -- '#!/bin/zsh -f' 'print pkill >>$DEV/calls' >$TMP/bin/pkill
print -rl -- '#!/bin/zsh -f' 'print -r -- "xcrun $*" >>$DEV/calls' >$TMP/bin/xcrun
cat >$TMP/bin/ax <<'EOF'
#!/bin/zsh -f
# A quarter turn: 1 to the right, -1 to the left. TURN_BACK_FAILS refuses
# every turn once the read has run, so only the restore's turn back fails.
turn() {
  (( ${TURN_BACK_FAILS:-0} )) && grep -q '^read' $DEV/calls && return 1
  local -a turns=(portrait landscapeRight portraitUpsideDown landscapeLeft)
  print -rn -- ${turns[$(( (${turns[(i)$(<$DEV/orient)]} - 1 + $1 + 4) % 4 + 1 ))]} >$DEV/orient
}
case $1 in
  state)
    if [[ $(<$DEV/pose) == none ]]; then
      # ax 0.2.2 prints "pose: n/a" for a phone with no fold.
      print "iPhone 17"; print "pose: n/a"
    else
      print "iPhone Duo"; print "pose: $(<$DEV/pose)"
    fi
    print "orientation: $(<$DEV/orient)" ;;
  controls)
    print Home
    [[ $(<$DEV/pose) == none ]] && print "Rotate Left" || print "Rotate Right" ;;
  rotate)
    print "rotate right" >>$DEV/calls
    [[ $(<$DEV/pose) == none ]] && exit 1
    turn 1 ;;
  pose)
    print "pose $2" >>$DEV/calls
    [[ $(<$DEV/pose) == none ]] && exit 1
    [[ $2 == open ]] && (( ${UNFOLD_FAILS:-0} )) && exit 1
    [[ $2 == closed ]] && (( ${FOLD_FAILS:-0} )) && exit 1
    [[ $2 == open ]] && print -rn -- unfolded >$DEV/pose || print -rn -- $2 >$DEV/pose ;;
  control)
    case $2 in
      'Rotate Left')
        print "rotate left" >>$DEV/calls
        [[ $(<$DEV/pose) == none ]] || exit 1
        turn -1 ;;
      Home)
        if [[ -n ${SIGNAL:-} && ! -e $DEV/signalled ]]; then
          : >$DEV/signalled
          kill -$SIGNAL $SELF
        fi ;;
    esac ;;
esac
EOF
chmod +x $TMP/bin/*

# CASE START_POSE START_ORIENT WANT_EXIT [VAR=VALUE...]: the variables pick
# the faults (READ_FAILS, UNFOLD_FAILS, FOLD_FAILS, TURN_BACK_FAILS,
# SIGNAL=INT|TERM, sent at the first Home press, after the unfold).
# FOLD_FAILS and TURN_BACK_FAILS fail the restore, which must then say
# "could not restore" once. START_POSE none is a phone with no fold whose
# Device Hub has only Rotate Left (the iPhone 17): ax state shows "pose: n/a",
# and ax pose and ax rotate (Rotate Right) fail there.
check() {
  local name=$1 pose=$2 orient=$3 want=$4 dev=$TMP/$1
  shift 4
  mkdir -p $dev/work/logs
  print -rn -- $pose >$dev/pose
  print -rn -- $orient >$dev/orient
  : >$dev/calls
  local code=0
  (
    for v in "$@"; do export $v; done
    export DEV=$dev SELF=$sysparams[pid] PATH=$TMP/bin:$PATH
    SIM_DRIVER_WORK=$dev/work
    eval "$(sed '/^# ---- main/,$d' $SIM)"
    UDID=fake
    require_booted() { :; }
    ensure_runner() { :; }
    notify() {
      case $1 in
        front) print "front: dev.sallvain.mylove" ;;
        center)
          print "read $(<$dev/orient)" >>$dev/calls
          # The runner's lines as notify passes them on: a failed step's
          # come back from its log through finish_step.
          if (( ${READ_FAILS:-0} )); then
            print -l "NOTIFY note: tapped a cell" "NOTIFY read failed" >$WORK/logs/notify.log
            return 1
          fi
          print -l "note: tapped a cell" "warning: a summary cell" '[["Thread A"]]' ;;
      esac
    }
    cmd_center --host
  ) >$dev/out 2>$dev/err || code=$?
  local end="$(<$dev/pose) $(<$dev/orient)" folds=$(grep -c '^pose closed' $dev/calls)
  local -a why
  (( code == want )) || why+="exit $code, wanted $want"
  if [[ $pose == none ]]; then
    ! grep -q '^pose' $dev/calls || why+="posed a phone with no fold"
    ! grep -q '^rotate right' $dev/calls || why+="pressed Rotate Right on a phone with only Rotate Left"
  else
    grep -q '^pose open' $dev/calls || why+="never unfolded"
  fi
  local restore_fails=${#${(M)@:#(FOLD_FAILS|TURN_BACK_FAILS)=1}} reports=$(grep -c 'could not restore' $dev/err)
  # A failed fold leaves the pose open and a failed turn the orientation
  # wrong; whatever did not fail must still be back where it started.
  [[ -n ${(M)@:#FOLD_FAILS=1} || $(<$dev/pose) == $pose ]] || why+="ended $end, started $pose $orient"
  [[ -n ${(M)@:#TURN_BACK_FAILS=1} || $(<$dev/orient) == $orient ]] || why+="ended $end, started $pose $orient"
  (( folds <= 1 + ${#${(M)@:#FOLD_FAILS=1}} )) || why+="folded back $folds times"
  (( $(grep -c '^pkill' $dev/calls) <= 1 )) || why+="restore ran more than once"
  if (( restore_fails )); then
    (( reports == 1 )) || why+="restore failure reported $reports times, wanted once"
  else
    (( reports == 0 )) || why+="reported a restore failure with none"
  fi
  (( want != 0 )) || grep -q 'Thread A' $dev/out || why+="no groups on stdout"
  (( want != 0 )) || grep -qx 'read portrait' $dev/calls || why+="read in $(sed -n 's/^read //p' $dev/calls), not portrait"
  # Notes and warnings go to stderr: stdout carries only the JSON line.
  ! grep -q 'tapped a cell\|summary cell' $dev/out || why+="a note or warning on stdout"
  ! grep -q '^read' $dev/calls || grep -q 'tapped a cell' $dev/err || why+="the note never reached stderr"
  if (( $#why )); then
    print -r -- "FAIL $name: ${(j:; :)why}"
    sed 's/^/  stderr: /' $dev/err
    failed=1
  else
    print -r -- "ok   $name"
  fi
}

check success              closed portrait      0
check success-landscape    closed landscapeLeft 0
check read-fails           closed portrait      1 READ_FAILS=1
check unfold-fails         closed portrait      5 UNFOLD_FAILS=1
check restore-fails        closed portrait      1 FOLD_FAILS=1
check sigint-after-unfold  closed portrait    130 SIGNAL=INT
check sigterm-after-unfold closed landscapeLeft 143 SIGNAL=TERM
check sigint-restore-fails closed portrait    130 SIGNAL=INT FOLD_FAILS=1
check turn-back-fails      closed landscapeLeft 1 TURN_BACK_FAILS=1
# A failed read ends through die's exit, nested below cmd_center.
check read-fails-landscape       closed landscapeLeft 1 READ_FAILS=1
check read-fails-turn-back-fails closed landscapeLeft 1 READ_FAILS=1 TURN_BACK_FAILS=1
check read-fails-fold-fails      closed landscapeLeft 1 READ_FAILS=1 FOLD_FAILS=1
check phone-read-fails           none landscapeRight  1 READ_FAILS=1
check phone-landscape-left  none landscapeLeft  0
check phone-landscape-right none landscapeRight 0
check phone-sigint          none landscapeRight 130 SIGNAL=INT
exit $failed
