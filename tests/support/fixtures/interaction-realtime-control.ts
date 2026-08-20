import { test as base } from '@playwright/test';

type PhoenixFrame = [
  joinRef: string | null,
  ref: string | null,
  topic: string,
  event: string,
  payload: unknown,
];

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

export type InteractionRealtimeControl = {
  mount: (userId: string) => Promise<void>;
  waitForFailureInjected: () => Promise<void>;
  allowRecovery: () => void;
  waitForRecoveryForwarded: () => Promise<void>;
};

type InteractionRealtimeFixtures = {
  interactionRealtimeControl: InteractionRealtimeControl;
};

const INTERACTION_TOPIC_PREFIX = 'realtime:incoming-interactions:';

function deferred(): Deferred {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function parsePhoenixFrame(message: string | Buffer): PhoenixFrame | null {
  if (typeof message !== 'string') return null;

  try {
    const parsed: unknown = JSON.parse(message);
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 5 ||
      (parsed[0] !== null && typeof parsed[0] !== 'string') ||
      (parsed[1] !== null && typeof parsed[1] !== 'string') ||
      typeof parsed[2] !== 'string' ||
      typeof parsed[3] !== 'string'
    ) {
      return null;
    }

    return parsed as PhoenixFrame;
  } catch {
    return null;
  }
}

function isInteractionJoin(frame: PhoenixFrame | null): frame is PhoenixFrame {
  return (
    frame !== null &&
    frame[2].startsWith(INTERACTION_TOPIC_PREFIX) &&
    frame[3] === 'phx_join'
  );
}

function isSuccessfulReplyFor(
  frame: PhoenixFrame | null,
  recoveryRefs: Set<string>
): frame is PhoenixFrame {
  if (
    frame === null ||
    frame[1] === null ||
    !frame[2].startsWith(INTERACTION_TOPIC_PREFIX) ||
    frame[3] !== 'phx_reply' ||
    !recoveryRefs.has(frame[1])
  ) {
    return false;
  }

  const payload = frame[4];
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'status' in payload &&
    payload.status === 'ok'
  );
}

/**
 * Controls only the interaction channel's Phoenix join replies. All other
 * traffic—including heartbeat and partner-mood channels—passes through.
 */
export const test = base.extend<InteractionRealtimeFixtures>({
  interactionRealtimeControl: async ({ page, baseURL }, use) => {
    const failureInjected = deferred();
    const recoveryForwarded = deferred();
    const recoveryRefs = new Set<string>();
    const heldRecoveryReplies: Array<{ send: () => void }> = [];
    let hasInjectedFailure = false;
    let recoveryAllowed = false;
    let hasForwardedRecovery = false;

    const markRecoveryForwarded = () => {
      if (hasForwardedRecovery) return;
      hasForwardedRecovery = true;
      recoveryForwarded.resolve();
    };

    const releaseRecovery = () => {
      recoveryAllowed = true;
      heldRecoveryReplies.splice(0).forEach(({ send }) => send());
    };

    // playwright-utils deviation: protocol-aware WebSocket control is not provided by @seontechnologies/playwright-utils.
    await page.routeWebSocket('**/realtime/v1/websocket**', (browserSocket) => {
      const serverSocket = browserSocket.connectToServer();

      browserSocket.onMessage((message) => {
        const frame = parsePhoenixFrame(message);

        if (isInteractionJoin(frame)) {
          const [joinRef, ref, topic] = frame;

          if (!hasInjectedFailure) {
            hasInjectedFailure = true;
            browserSocket.send(
              JSON.stringify([
                joinRef,
                ref,
                topic,
                'phx_reply',
                {
                  status: 'error',
                  response: { reason: 'TEA forced interaction subscription failure' },
                },
              ])
            );
            failureInjected.resolve();
            return;
          }

          if (ref !== null) recoveryRefs.add(ref);
        }

        serverSocket.send(message);
      });

      serverSocket.onMessage((message) => {
        const frame = parsePhoenixFrame(message);

        if (isSuccessfulReplyFor(frame, recoveryRefs)) {
          const forward = () => {
            browserSocket.send(message);
            markRecoveryForwarded();
          };

          if (recoveryAllowed) forward();
          else heldRecoveryReplies.push({ send: forward });
          return;
        }

        browserSocket.send(message);
      });
    });

    await use({
      mount: async (userId) => {
        const harnessUrl = new URL(
          '/tests/support/harnesses/interaction-realtime.html',
          baseURL ?? 'http://localhost:5173'
        );
        harnessUrl.searchParams.set('userId', userId);
        await page.goto(harnessUrl.href);
      },
      waitForFailureInjected: () => failureInjected.promise,
      allowRecovery: releaseRecovery,
      waitForRecoveryForwarded: () => recoveryForwarded.promise,
    });

    // Never leave a server reply held while the authenticated context closes.
    releaseRecovery();
  },
});
