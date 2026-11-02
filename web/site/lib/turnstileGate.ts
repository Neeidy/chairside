/**
 * The live panel's send gate, as pure functions so it can be tested without a browser.
 *
 * WHY IT EXISTS (DATE-PHRASING R4, 2026-11-02): the panel answered a send without a token with "We couldn't verify this
 * browser. Please reload the page and try again." A token is single-use, so there is a short gap after EVERY send while
 * the next one is minted — and a visitor who typed "yes" inside that gap got the reload sentence although nothing was
 * blocked (the owner's run; the engine never saw that send). The same sentence also stayed in the log after a transient
 * Turnstile error that Cloudflare's retry then cleared.
 *
 * THE RULE: the blocked notice is shown only while NO valid token can be obtained — the Turnstile script could not load
 * or render (`unavailable`, nothing to retry), or Turnstile failed and so did our retries — and it goes away as soon as a
 * token arrives. A missing token alone only disables the send button; the draft stays in the box and can be sent once
 * the next token arrives. A wait that never ends (a reset whose callback never comes) is said after VERIFY_STUCK_MS,
 * as the snippet has said it since 6c (`index.ts`, VERIFY_STUCK_MS) — the review of this fix found the site had no
 * such exit (`code-reviewer`, R4).
 */
export type TurnstileState = 'loading' | 'ready' | 'error' | 'unavailable';

/** Retries after the first failure before the panel says it cannot verify (the panel's own reset, 2.5 s apart). */
export const TURNSTILE_MAX_RETRIES = 2;
/** How long a wait for a token may last before the panel says it is still waiting (the snippet's value). */
export const VERIFY_STUCK_MS = 20000;

export const BLOCKED_PLACEHOLDER = "Couldn't verify this browser — reload to try again";
export const RETRYING_PLACEHOLDER = 'Verification is having trouble — retrying…';
export const STUCK_PLACEHOLDER = 'Still verifying — reload the page';
export const DEFAULT_PLACEHOLDER = 'Type a message…';

export interface ComposerGate {
  /** A token is in hand: a send can go out. */
  canSend: boolean;
  /** No token can be obtained: the blocked notice is on screen. */
  blocked: boolean;
  /** A wait for a token has outlasted VERIFY_STUCK_MS: the still-checking notice is on screen. */
  stuck: boolean;
  placeholder: string;
}

/** No token can be obtained: the script could not load or render, or Turnstile failed and so did our retries. */
export function isBlocked(hasToken: boolean, state: TurnstileState, errors: number, maxRetries: number = TURNSTILE_MAX_RETRIES): boolean {
  return !hasToken && (state === 'unavailable' || (state === 'error' && errors > maxRetries));
}

/** `errors` counts consecutive Turnstile failures (a success resets it); `stuckTimedOut` is the panel's stuck timer. */
export function composerGate(hasToken: boolean, state: TurnstileState, errors: number, stuckTimedOut = false,
  maxRetries: number = TURNSTILE_MAX_RETRIES): ComposerGate {
  const blocked = isBlocked(hasToken, state, errors, maxRetries);
  const stuck = !hasToken && !blocked && stuckTimedOut;
  const placeholder = blocked ? BLOCKED_PLACEHOLDER
    : stuck ? STUCK_PLACEHOLDER
    : !hasToken && state === 'error' ? RETRYING_PLACEHOLDER
    : DEFAULT_PLACEHOLDER;
  return { canSend: hasToken, blocked, stuck, placeholder };
}

/** Whether the panel should reset the widget once more after this failure (never after `unavailable`). */
export function shouldRetry(state: TurnstileState, errors: number, maxRetries: number = TURNSTILE_MAX_RETRIES): boolean {
  return state === 'error' && errors >= 1 && errors <= maxRetries;
}

/**
 * Whether the panel is WAITING for a token and the stuck timer should run: Turnstile has been rendered (before that
 * the timer would measure how long the visitor took to open the panel — the snippet's first attempt made exactly that
 * mistake), no token is in hand, no block is already on screen, and no interactive challenge is up (a visitor solving
 * the checkbox is not stuck — telling them to reload would throw the challenge away). A failure being retried COUNTS:
 * a retry's reset whose callback never comes is a stall like any other (`code-reviewer` R4 re-review, R1); every reset
 * re-arms the timer, so the 20 s run from the latest one.
 */
export function waitingForToken(rendered: boolean, hasToken: boolean, blocked: boolean, interactive: boolean): boolean {
  return rendered && !hasToken && !blocked && !interactive;
}
