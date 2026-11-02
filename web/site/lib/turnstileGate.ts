/**
 * The live panel's send gate, as a pure function so it can be tested without a browser.
 *
 * WHY IT EXISTS (DATE-PHRASING R4, 2026-11-02): the panel answered a send without a token with "We couldn't verify this
 * browser. Please reload the page and try again." A token is single-use, so there is a short gap after EVERY send while
 * the next one is minted — and a visitor who typed "yes" inside that gap got the reload sentence although nothing was
 * blocked (the owner's run; the engine never saw that send). The same sentence also stayed in the log after a transient
 * Turnstile error that Cloudflare's retry then cleared.
 *
 * THE RULE: the blocked notice is shown only while NO valid token can be obtained — Turnstile has failed, and so have
 * our retries — and it goes away as soon as a token arrives. A missing token alone only disables the send button; the
 * draft stays in the box and goes out with the next token.
 */
export type TurnstileState = 'loading' | 'ready' | 'error';

/** Retries after the first failure before the panel says it cannot verify (the panel's own reset, 2.5 s apart). */
export const TURNSTILE_MAX_RETRIES = 2;

export const BLOCKED_PLACEHOLDER = "Couldn't verify this browser — reload to try again";
export const RETRYING_PLACEHOLDER = 'Verification is having trouble — retrying…';
export const DEFAULT_PLACEHOLDER = 'Type a message…';

export interface ComposerGate {
  /** A token is in hand: a send can go out. */
  canSend: boolean;
  /** No token can be obtained: the notice is on screen. */
  blocked: boolean;
  placeholder: string;
}

/** `errors` counts consecutive Turnstile failures; a success resets it to 0. */
export function composerGate(hasToken: boolean, state: TurnstileState, errors: number,
  maxRetries: number = TURNSTILE_MAX_RETRIES): ComposerGate {
  const blocked = !hasToken && state === 'error' && errors > maxRetries;
  const placeholder = blocked ? BLOCKED_PLACEHOLDER
    : !hasToken && state === 'error' ? RETRYING_PLACEHOLDER
    : DEFAULT_PLACEHOLDER;
  return { canSend: hasToken, blocked, placeholder };
}

/** Whether the panel should reset the widget once more after this failure. */
export function shouldRetry(state: TurnstileState, errors: number, maxRetries: number = TURNSTILE_MAX_RETRIES): boolean {
  return state === 'error' && errors >= 1 && errors <= maxRetries;
}
