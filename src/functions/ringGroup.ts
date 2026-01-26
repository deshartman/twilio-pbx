import '@twilio-labs/serverless-runtime-types';
import { Context, ServerlessCallback, ServerlessFunctionSignature } from '@twilio-labs/serverless-runtime-types/types';

export interface ServerlessEnvironment {
  [key: string]: string | undefined;
}

type DialCallStatus = 'completed' | 'answered' | 'busy' | 'no-answer' | 'failed' | 'canceled';

export interface RingGroupEvent {
  CallSid: string;
  To?: string;
  From?: string;
  Caller?: string;
  state?: string;
  DialCallStatus?: DialCallStatus;
  request: {
    cookies: {};
    headers: {};
  };
  [key: string]: any;
}

interface RingGroupDestination {
  name: string;
  type: 'sip' | 'number';
  destination: string;
  timeout: number;
}

/**
 * Sequential Ring Group Function - State Machine Implementation
 *
 * This function implements a state machine that attempts each destination sequentially,
 * only proceeding to the next if the previous call was not answered.
 *
 * Ring group destinations should be configured externally (e.g., via Twilio Sync Maps).
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
// NOTE: Ring group destinations should be loaded from external configuration
// (e.g., Twilio Sync Maps) rather than hardcoded here.
const RING_GROUP_DESTINATIONS: readonly RingGroupDestination[] = [
  // Configuration should be loaded dynamically
] as const;

// ============================================================================
// MAIN HANDLER
// ============================================================================
export const handler: ServerlessFunctionSignature<ServerlessEnvironment, RingGroupEvent> = async (
  context: Context<ServerlessEnvironment>,
  event: RingGroupEvent,
  callback: ServerlessCallback
) => {
  const voiceResponse = new Twilio.twiml.VoiceResponse();
  const callerNumber = event.From || event.Caller;

  try {
    // Get current state (0-indexed position in destinations array)
    const state = parseInt(event.state || '0', 10);
    const previousStatus = event.DialCallStatus;

    console.info(`Ring Group State: ${state}, Call SID: ${event.CallSid}, Previous Status: ${previousStatus || 'initial'}`);

    // If this is not the initial call, check if we should proceed
    if (state > 0) {
      if (!shouldProceedToNext(previousStatus)) {
        // Previous call was answered successfully, end flow
        console.info(`State ${state - 1} (${RING_GROUP_DESTINATIONS[state - 1].name}) answered successfully, ending flow`);
        return callback(null, voiceResponse);
      }
      console.info(`State ${state - 1} status: ${previousStatus}, proceeding to state ${state}`);
    }

    // Check if we've exhausted all destinations
    if (state >= RING_GROUP_DESTINATIONS.length) {
      console.info(`Ring group flow complete, all destinations attempted`);
      return callback(null, voiceResponse);
    }

    // Get current destination
    const currentDest = RING_GROUP_DESTINATIONS[state];
    const nextState = state + 1;

    console.info(`State ${state}: Dialing ${currentDest.name} (${currentDest.type}): ${currentDest.destination}, timeout: ${currentDest.timeout}s`);

    // Dial the current destination with timeout
    const dial = voiceResponse.dial({
      callerId: callerNumber,
      answerOnBridge: true,        // Keep caller connected during transfer (warm transfer)
      timeout: currentDest.timeout, // Ring timeout in seconds
      action: `/ringGroup?state=${nextState}`,
      method: 'POST',
      referUrl: '/callTransfer',   // Webhook for REFER handling
      referMethod: 'POST'
    });

    if (currentDest.type === 'sip') {
      dial.sip(currentDest.destination);
    } else {
      dial.number(currentDest.destination);
    }

    return callback(null, voiceResponse);

  } catch (error) {
    console.error(`Ring Group Error: ${error}`);
    voiceResponse.say('We are unable to connect your call at this time.');
    voiceResponse.hangup();
    return callback(null, voiceResponse);
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper function to determine if we should proceed to next destination
 */
function shouldProceedToNext(dialStatus: string | undefined): boolean {
  if (!dialStatus) return false;

  const failureStatuses = ['busy', 'cancelled', 'no-answer', 'failed'];
  return failureStatuses.includes(dialStatus);
}
