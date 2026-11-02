#!/bin/zsh
# Checks center's exit codes and restore with no simulator: sim's functions
# are loaded with ax, xcrun, the runner steps and sleep stubbed over a fake
# device kept in files, and cmd_center runs once per case in a subshell.
# An EXIT trap set in a function sees $? as 0 after exit, which once made a
# failed read exit 0, and nothing else catches that.
# Run: zsh scripts/sim-driver/test-center-exit.zsh
emulate zsh
zmodload zsh/system
SIM=${0:A:h}/sim
TMP=$(mktemp -d)
trap 'rm -rf $TMP' EXIT
failed=0

# CASE START_POSE START_ORIENT WANT_EXIT [VAR=VALUE...]: the variables pick
# the faults (READ_FAILS, UNFOLD_FAILS, FOLD_FAILS, SIGNAL=INT|TERM, sent at
# the first Home press, after the unfold). START_POSE none is a phone with no
# fold whose Device Hub has only Rotate Left (the iPhone 17): ax state shows
# no pose, and ax pose and ax rotate (Rotate Right) fail there.
check() {
  local name=$1 pose=$2 orient=$3 want=$4 dev=$TMP/$1
  shift 4
  mkdir -p $dev/work/logs
  print -rn -- $pose >$dev/pose
  print -rn -- $orient >$dev/orient
  : >$dev/calls
  local code=0
  (
    for v in "$@"; do typeset -g $v; done
    SIM_DRIVER_WORK=$dev/work
    eval "$(sed '/^# ---- main/,$d' $SIM)"
    UDID=fake SELF=$sysparams[pid]
    require_booted() { :; }
    ensure_runner() { :; }
    sleep() { :; }
    pkill() { print "pkill" >>$dev/calls; }
    xcrun() { print "xcrun $*" >>$dev/calls; }
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
    # A quarter turn: 1 to the right, -1 to the left.
    turn() {
      local -a turns=(portrait landscapeRight portraitUpsideDown landscapeLeft)
      print -rn -- ${turns[$(( (${turns[(i)$(<$dev/orient)]} - 1 + $1 + 4) % 4 + 1 ))]} >$dev/orient
    }
    ax() {
      case $1 in
        state)
          if [[ $(<$dev/pose) == none ]]; then
            print "iPhone 17"
          else
            print "iPhone Duo"; print "pose: $(<$dev/pose)"
          fi
          print "orientation: $(<$dev/orient)" ;;
        controls)
          print Home
          [[ $(<$dev/pose) == none ]] && print "Rotate Left" || print "Rotate Right" ;;
        rotate)
          print "rotate right" >>$dev/calls
          [[ $(<$dev/pose) == none ]] && return 1
          turn 1 ;;
        pose)
          print "pose $2" >>$dev/calls
          [[ $(<$dev/pose) == none ]] && return 1
          [[ $2 == open ]] && (( ${UNFOLD_FAILS:-0} )) && return 1
          [[ $2 == closed ]] && (( ${FOLD_FAILS:-0} )) && return 1
          [[ $2 == open ]] && print -rn -- unfolded >$dev/pose || print -rn -- $2 >$dev/pose ;;
        control)
          case $2 in
            'Rotate Left')
              print "rotate left" >>$dev/calls
              [[ $(<$dev/pose) == none ]] || return 1
              turn -1 ;;
            Home)
              if [[ -n ${SIGNAL:-} && ! -e $dev/signalled ]]; then
                : >$dev/signalled
                kill -$SIGNAL $SELF
              fi ;;
          esac ;;
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
  [[ $end == "$pose $orient" || -n ${(M)@:#FOLD_FAILS=1} ]] || why+="ended $end, started $pose $orient"
  (( folds <= 1 + ${#${(M)@:#FOLD_FAILS=1}} )) || why+="folded back $folds times"
  (( $(grep -c '^pkill' $dev/calls) <= 1 )) || why+="restore ran more than once"
  (( $(grep -c 'could not restore' $dev/err) <= 1 )) || why+="restore failure reported more than once"
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
# No failing-read case starts turned: when die's exit (nested below
# cmd_center) runs the EXIT trap, zsh ends the trap as soon as a function it
# calls returns, and here ax, xcrun and sleep are functions, so the restore
# stops at its first stubbed call.
check phone-landscape-left  none landscapeLeft  0
check phone-landscape-right none landscapeRight 0
check phone-sigint          none landscapeRight 130 SIGNAL=INT
exit $failed
