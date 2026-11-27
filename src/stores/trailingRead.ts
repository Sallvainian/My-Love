/**
 * One read in flight plus one trailing pass, per identity and pair.
 *
 * `dailyDaySlice` (`loadDailyDay`) and `dailyStreakSlice` (`loadCoupleStreak`)
 * read the server on many triggers at once (mount, a reconnect, a channel join,
 * a pick). A call never joins a read that began before it, because that read
 * may not see what the call is waiting on (a pick, a partner link, a
 * reconnect): it asks for one more read, started after the call. Calls that
 * arrive while a read runs share that one trailing pass.
 *
 * Each caller's promise settles when the pass that covers its call ends: the
 * call that starts a read gets that pass's promise and does not wait for the
 * trailing pass; a call that arrives mid-pass gets the trailing pass's. A caller
 * that awaits the read before it acts (Daily's claim gate waits on the mount's
 * read) is therefore never held back by a later trigger's re-read.
 *
 * A pass whose identity changed (`keyOf` answers another key) is not sent: the
 * calls waiting on it settle without a read.
 */

type Pass = {
  promise: Promise<void>;
  settle: () => void;
  fail: (error: unknown) => void;
};

const newPass = (): Pass => {
  let settle!: () => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<void>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, settle, fail };
};

export type TrailingRead = {
  /** Ask for a read that starts after this call; settles when that read ends. */
  call: () => Promise<void>;
};

/**
 * @param keyOf the current identity and pair, or `null` when nobody is signed
 *   in (a call then settles at once, no read). A call under another key than
 *   the running chain's starts its own chain; the old one, now stale, sends no
 *   trailing pass.
 * @param readOnce one read, given a function that says whether a trailing pass
 *   is waiting behind it; it handles its own failures.
 */
export const createTrailingRead = (
  keyOf: () => string | null,
  readOnce: (trailingRequested: () => boolean) => Promise<void>
): TrailingRead => {
  type Chain = { key: string; trailing: Pass | null };
  let chain: Chain | null = null;

  const run = async (mine: Chain, first: Pass): Promise<void> => {
    let pass: Pass | null = first;
    while (pass) {
      try {
        await readOnce(() => mine.trailing !== null);
        pass.settle();
      } catch (error) {
        pass.fail(error);
      }
      // No await between this check and clearing `chain`, so a call cannot slip
      // in after the last pass is decided and be left without one.
      const next: Pass | null = mine.trailing;
      mine.trailing = null;
      if (next && keyOf() === mine.key) {
        pass = next;
      } else {
        next?.settle();
        pass = null;
        if (chain === mine) chain = null;
      }
    }
  };

  return {
    call: () => {
      const key = keyOf();
      if (key === null) return Promise.resolve();
      if (chain?.key === key) {
        chain.trailing ??= newPass();
        return chain.trailing.promise;
      }
      const mine: Chain = { key, trailing: null };
      chain = mine;
      const first = newPass();
      void run(mine, first);
      return first.promise;
    },
  };
};
