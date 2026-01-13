import { Context, ServerlessCallback, ServerlessFunctionSignature } from '@twilio-labs/serverless-runtime-types/types';
import Twilio from 'twilio';

export interface ServerlessEnvironment {
  SIP_DOMAIN_URI?: string;
  SYNC_SERVICE_SID?: string;
  SYNC_MAP_PHONES_NAME?: string;
  [key: string]: string | undefined;
}

export interface CallTransferEvent {
  CallSid: string;
  To?: string;
  From?: string;
  ReferTransferTarget?: string;
  DialCallStatus?: string;
  request: {
    cookies: {};
    headers: {};
  };
  [key: string]: any;
}

/**
 * Warm Transfer Handler for SIP REFER
 *
 * This function is triggered when a SIP phone sends a REFER message to transfer a call.
 * It extracts the transfer target from ReferTransferTarget, determines if it's a SIP or PSTN
 * destination, and completes the transfer while preserving UUI tracking.
 *
 *
 * Configuration:
 * - Set this as the referUrl on your initial <Dial> verbs
 * - URL: /pv/callTransfer
 *
 * Environment Variables Used:
 * - SIP_DOMAIN_URI: For constructing SIP destinations (optional)
 */
export const handler: ServerlessFunctionSignature<ServerlessEnvironment, CallTransferEvent> = async (
  context: Context<ServerlessEnvironment>,
  event: CallTransferEvent,
  callback: ServerlessCallback
) => {
  // Load shared utilities from assets
  const assets = Runtime.getAssets();
  const syncUtils = require(assets['/shared/syncUtils.js'].path);
  const { extractPhoneFromSipUri, fetchNumberConfig } = syncUtils;

  const voiceResponse = new Twilio.twiml.VoiceResponse();

  // Step 1: Validate ReferTransferTarget exists
  if (!event.ReferTransferTarget) {
    console.error(`callTransfer: No ReferTransferTarget for Call SID: ${event.CallSid}`);
    return callback('Missing ReferTransferTarget parameter');
  }

  // Step 2: Clean and normalize transfer target
  let target = event.ReferTransferTarget.trim();
  if (target.startsWith('<') && target.endsWith('>')) {
    target = target.slice(1, -1);
  }

  // Add + prefix if missing (for both SIP and PSTN)
  if (target.startsWith('sip:') && !target.startsWith('sip:+')) {
    target = target.replace('sip:', 'sip:+');
  } else if (!target.startsWith('sip:') && !target.startsWith('+')) {
    target = `+${target}`;
  }

  console.log(`callTransfer: Processing REFER for Call SID ${event.CallSid} to target: ${target}`);

  // Step 3: Extract phone number and check Sync Map for routing configuration
  const phoneNumber = extractPhoneFromSipUri(target);
  let mapConfig = null;
  let routingSource = 'default';

  if (phoneNumber && context.SYNC_SERVICE_SID && context.SYNC_MAP_PHONES_NAME) {
    try {
      console.log(`callTransfer: Looking up ${phoneNumber} in Sync Map`);

      const restClient = context.getTwilioClient();
      mapConfig = await fetchNumberConfig(
        restClient,
        context.SYNC_SERVICE_SID,
        context.SYNC_MAP_PHONES_NAME,
        phoneNumber
      );

      if (mapConfig) {
        console.log(`callTransfer: Found config - type=${mapConfig.type}, uri=${mapConfig.uri}`);
        routingSource = 'sync';
      } else {
        console.log(`callTransfer: No config found for ${phoneNumber}, using PSTN fallback`);
      }
    } catch (error) {
      console.error(`callTransfer: Sync lookup error: ${error instanceof Error ? error.message : error}`);
      // Continue with fallback
    }
  } else {
    console.log(`callTransfer: Sync not configured or no phone extracted, using default routing`);
  }

  // Step 4: Extract UUI from headers
  const UUI = event["SipHeader_x-inin-cnv"]
           || event["SipHeader_User-to-User"]
           || event.CallSid;

  console.log(`callTransfer: UUI for transfer: ${UUI}`);

  try {
    // Step 5: Extract original caller for caller ID
    let callerIdForTransfer = event.From;
    if (callerIdForTransfer && callerIdForTransfer.startsWith('sip:')) {
      const callerMatch = callerIdForTransfer.match(/^sip:((\+)?[0-9]+)@(.*)/);
      if (callerMatch) {
        callerIdForTransfer = callerMatch[1];
      }
    }

    // Step 6: Route and dial based on Sync Map result or fallback
    const routingType = mapConfig?.type || 'pstn';

    switch (routingType) {
      case 'sip': {
        // SIP routing from Map (with UUI)
        if (!mapConfig) {
          console.error(`callTransfer: mapConfig is null for SIP routing`);
          voiceResponse.reject({ reason: 'busy' });
          return callback(null, voiceResponse);
        }
        const sipDestination = mapConfig.uri;
        const sipTarget = sipDestination.includes('?')
          ? `${sipDestination}&User-to-User=${UUI}`
          : `${sipDestination}?User-to-User=${UUI}`;

        voiceResponse.dial().sip(sipTarget);
        console.log(`callTransfer: Dialing SIP ${sipTarget} with UUI ${UUI} [source: Sync]`);
        break;
      }

      case 'client': {
        // Client routing from Map (no UUI)
        if (!mapConfig) {
          console.error(`callTransfer: mapConfig is null for Client routing`);
          voiceResponse.reject({ reason: 'busy' });
          return callback(null, voiceResponse);
        }
        const clientDestination = mapConfig.uri;
        const clientName = clientDestination.replace('client:', '');

        voiceResponse.dial({ callerId: callerIdForTransfer }).client(clientName);
        console.log(`callTransfer: Dialing Client ${clientName} [source: Sync]`);
        break;
      }

      case 'number':
      case 'pstn':
      default: {
        // PSTN routing (from Map or fallback)
        const pstnDestination = mapConfig?.uri || phoneNumber || target;
        const source = mapConfig ? 'Sync' : 'fallback';

        // Validate E.164 format
        if (!pstnDestination.match(/^\+[1-9]\d{1,14}$/)) {
          console.error(`callTransfer: Invalid E.164 number: ${pstnDestination}`);
          voiceResponse.reject({ reason: 'busy' });
          return callback(null, voiceResponse);
        }

        voiceResponse.dial({ callerId: callerIdForTransfer }).number(pstnDestination);
        console.log(`callTransfer: Dialing PSTN ${pstnDestination} [source: ${source}]`);
        break;
      }
    }

    return callback(null, voiceResponse);

  } catch (error) {
    console.error(`callTransfer Error for Call SID ${event.CallSid}: ${error instanceof Error ? error.message : error}`);
    if (error instanceof Error && error.stack) {
      console.error(`Stack trace: ${error.stack}`);
    }
    return callback(`Error with callTransfer: ${error}`);
  }
};
