import { Context, ServerlessCallback, ServerlessFunctionSignature } from '@twilio-labs/serverless-runtime-types/types';
import Twilio from 'twilio';

export interface ServerlessEnvironment {
  SIP_DOMAIN_URI?: string;
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

  // Step 3: Extract UUI from headers
  const UUI = event["SipHeader_x-inin-cnv"]
           || event["SipHeader_User-to-User"]
           || event.CallSid;

  console.log(`callTransfer: UUI for transfer: ${UUI}`);

  try {
    // Step 4: Determine transfer type and validate
    let transferType: 'sip' | 'pstn';
    let transferDestination: string;

    if (target.startsWith('sip:')) {
      // SIP call
      transferType = 'sip';
      transferDestination = target;
    } else {
      // PSTN call
      transferType = 'pstn';
      transferDestination = target;

      // Validate E.164 format
      if (!transferDestination.match(/^\+[1-9]\d{1,14}$/)) {
        console.error(`callTransfer: Invalid E.164 number: ${transferDestination}`);
        voiceResponse.reject({ reason: 'busy' });
        return callback(null, voiceResponse);
      }
    }

    // Step 5: Extract original caller for caller ID
    let callerIdForTransfer = event.From;
    if (callerIdForTransfer && callerIdForTransfer.startsWith('sip:')) {
      const callerMatch = callerIdForTransfer.match(/^sip:((\+)?[0-9]+)@(.*)/);
      if (callerMatch) {
        callerIdForTransfer = callerMatch[1];
      }
    }

    console.log(`callTransfer: Type=${transferType}, Destination=${transferDestination}, CallerID=${callerIdForTransfer}`);

    // Step 6: Dial the transfer target based on type
    if (transferType === 'pstn') {
      // Transfer to PSTN number
      voiceResponse.dial({ callerId: callerIdForTransfer }).number(transferDestination);
      console.log(`callTransfer: Dialing PSTN ${transferDestination} with UUI ${UUI}`);

    } else if (transferType === 'sip') {
      // Transfer to SIP destination, pass UUI in header
      const sipTarget = transferDestination.includes('?')
        ? `${transferDestination}&User-to-User=${UUI}`
        : `${transferDestination}?User-to-User=${UUI}`;

      voiceResponse.dial().sip(sipTarget);
      console.log(`callTransfer: Dialing SIP ${sipTarget} with UUI ${UUI}`);
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
