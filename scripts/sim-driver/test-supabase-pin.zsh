#!/bin/zsh
# Checks require_supabase_cli with no simulator: sim's functions are loaded
# over a fake repo whose .mise.toml carries a pin, with a stub supabase on
# PATH printing the version each case sets (DW-449).
# Run: zsh scripts/sim-driver/test-supabase-pin.zsh
emulate zsh
SIM=${0:A:h}/sim
TMP=$(mktemp -d)
trap 'rm -rf $TMP' EXIT
failed=0

mkdir -p $TMP/bin $TMP/repo
print -rl -- '[tools]' 'node = "24"' 'supabase = "2.122.0"' >$TMP/repo/.mise.toml
# The real CLI prints its version on stdout and its update notice on stderr.
cat >$TMP/bin/supabase <<'STUB'
#!/bin/zsh -f
[[ $1 == --version ]] || exit 9
[[ -n ${STUB_FAILS:-} ]] && exit 1
print -r -- $STUB_VERSION
print -u2 -- "A new version of Supabase CLI is available: v3.0.0"
STUB
chmod +x $TMP/bin/supabase

# CASE VERSION WANT_EXIT WANT_STDERR [VAR=VALUE...]
check() {
  local name=$1 version=$2 want=$3 match=$4 code=0
  shift 4
  (
    for v in "$@"; do export $v; done
    export STUB_VERSION=$version PATH=$TMP/bin:$PATH
    eval "$(sed '/^# ---- main/,$d' $SIM)"
    REPO=$TMP/repo
    require_supabase_cli
  ) >$TMP/out 2>$TMP/err || code=$?
  local -a why
  (( code == want )) || why+="exit $code, wanted $want"
  [[ -z $match ]] || grep -q -- "$match" $TMP/err || why+="stderr lacks '$match'"
  if (( $#why )); then
    print -r -- "FAIL $name: ${(j:; :)why}"
    sed 's/^/  stderr: /' $TMP/err
    failed=1
  else
    print -r -- "ok   $name"
  fi
}

check pinned     2.122.0 0 ''
check homebrew-3 3.0.0   1 'supabase CLI 3.0.0 in .*, but .mise.toml pins 2.122.0'
check older      2.117.0 1 'pins 2.122.0'
check broken     2.122.0 1 'no working supabase CLI' STUB_FAILS=1
exit $failed
