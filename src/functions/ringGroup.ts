import '@twilio-labs/serverless-runtime-types';
import { Context, ServerlessCallback, ServerlessFunctionSignature } from '@twilio-labs/serverless-runtime-types/types';

export interface ServerlessEnvironment {
  SYNC_SERVICE_SID?: string;
  SYNC_MAP_RINGGROUP_NAME?: string;
  [key: string]: string | undefined;
}

type DialCallStatus = 'completed' | 'answered' | 'busy' | 'no-answer' | 'failed' | 'canceled';

export interface RingGroupEvent {
  CallSid: string;
  To?: string;
  From?: string;
  Caller?: string;
  state?: string;
  ringGroupId?: string;
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
 * Ring group destinations are loaded from Twilio Sync Maps based on ringGroupId parameter.
 */

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Fetch ring group configuration from Sync Map
 * Returns null if not found or on error
 */
async function fetchRingGroupConfig(
  restClient: any,
  serviceSid: string,
  mapName: string,
  ringGroupId: string
): Promise<RingGroupDestination[] | null> {
  if (!restClient || !serviceSid || !mapName || !ringGroupId) {
    console.warn('Ring Group Sync: Missing required parameters');
    return null;
  }

  try {
    console.log(`Ring Group Sync: Checking configuration for service ${serviceSid}, map ${mapName}, ring group ${ringGroupId}`);

    const item = await restClient.sync.v1
      .services(serviceSid)
      .syncMaps(mapName)
      .syncMapItems(ringGroupId)
      .fetch();

    console.log('Ring Group Sync: Fetch result', JSON.stringify({ key: item.key, dataType: typeof item.data, hasGroup: !!item.data?.group, isGroupArray: Array.isArray(item.data?.group) }));

    // Validate that data.group exists and is an array
    if (!item.data || !item.data.group || !Array.isArray(item.data.group)) {
      console.error(`Ring Group Sync: Invalid data format for ring group ${ringGroupId} - expected object with 'group' array, got ${typeof item.data}`);
      return null;
    }

    return item.data.group as RingGroupDestination[];
  } catch (error: any) {
    if (error.status === 404) {
      console.warn(`Ring Group Sync: Ring group ${ringGroupId} not found in map`);
      return null;
    }

    console.error(`Ring Group Sync: Error fetching configuration: ${error.message || error}`);
    return null;
  }
}

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
    // Extract ringGroupId from event (default: "1")
    const ringGroupId = event.ringGroupId || '1';

    // Check if Sync is configured
    const serviceSid = context.SYNC_SERVICE_SID;
    const mapName = context.SYNC_MAP_RINGGROUP_NAME;

    if (!serviceSid || !mapName) {
      console.error('Ring Group: Sync service not configured - missing SYNC_SERVICE_SID or SYNC_MAP_RINGGROUP_NAME');
      voiceResponse.say('Ring group service is not configured. Please contact support.');
      voiceResponse.hangup();
      return callback(null, voiceResponse);
    }

    // Fetch destinations from Sync Map
    const client = context.getTwilioClient();
    const destinations = await fetchRingGroupConfig(client, serviceSid, mapName, ringGroupId);

    if (!destinations || destinations.length === 0) {
      console.error(`Ring Group: Ring group ${ringGroupId} not found or has no destinations`);
      voiceResponse.say(`Ring group ${ringGroupId} is not configured. Unable to connect your call.`);
      voiceResponse.hangup();
      return callback(null, voiceResponse);
    }

    console.info(`Ring Group: Loaded ${destinations.length} destinations for ring group ${ringGroupId}`);

    // Get current state (0-indexed position in destinations array)
    const state = parseInt(event.state || '0', 10);
    const previousStatus = event.DialCallStatus;

    console.info(`Ring Group State: ${state}, Ring Group ID: ${ringGroupId}, Call SID: ${event.CallSid}, Previous Status: ${previousStatus || 'initial'}`);

    // If this is not the initial call, check if we should proceed
    if (state > 0) {
      if (!shouldProceedToNext(previousStatus)) {
        // Previous call was answered successfully, end flow
        console.info(`State ${state - 1} (${destinations[state - 1].name}) answered successfully, ending flow`);
        return callback(null, voiceResponse);
      }
      console.info(`State ${state - 1} status: ${previousStatus}, proceeding to state ${state}`);
    }

    // Check if we've exhausted all destinations
    if (state >= destinations.length) {
      console.info(`Ring group flow complete, all destinations attempted`);
      return callback(null, voiceResponse);
    }

    // Get current destination
    const currentDest = destinations[state];
    const nextState = state + 1;

    console.info(`State ${state}: Dialing ${currentDest.name} (${currentDest.type}): ${currentDest.destination}, timeout: ${currentDest.timeout}s`);

    // Dial the current destination with timeout
    const dial = voiceResponse.dial({
      callerId: callerNumber,
      answerOnBridge: true,        // Keep caller connected during transfer (warm transfer)
      timeout: currentDest.timeout, // Ring timeout in seconds
      action: `/ringGroup?state=${nextState}&ringGroupId=${ringGroupId}`,
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
