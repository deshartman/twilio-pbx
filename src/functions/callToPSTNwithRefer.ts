import '@twilio-labs/serverless-runtime-types';
import { Context, ServerlessCallback, ServerlessFunctionSignature } from '@twilio-labs/serverless-runtime-types/types';

export interface ServerlessEnvironment {
  [key: string]: string | undefined;
}

export interface CallToPSTNEvent {
  CallSid: string;
  To: string;
  From: string;
  request: {
    cookies: {};
    headers: {};
  };
  [key: string]: any;
}

/**
 * This is the outbound to PSTN voice handler WITH REFER SUPPORT.
 * Routes the call from the Customer's SIP Domain to a PSTN destination with warm transfer capability.
 *
 * Same as callToPSTN.js but with answerOnBridge and referUrl for warm transfer capability.
 *
 */
export const handler: ServerlessFunctionSignature<ServerlessEnvironment, CallToPSTNEvent> = async (
  context: Context<ServerlessEnvironment>,
  event: CallToPSTNEvent,
  callback: ServerlessCallback
) => {

  const voiceResponse = new Twilio.twiml.VoiceResponse();

  // Extract the +E.164 number from the SIP URI
  const toMatch = event.To.match(/^sip:((\+)?[0-9]+)@(.*)/);
  if (!toMatch) {
    return callback(`Invalid To SIP URI format: ${event.To}`);
  }
  const to = toMatch[1];

  // Extract the +E.164 number from the SIP URI
  const fromMatch = event.From.match(/^sip:((\+)?[0-9]+)@(.*)/);
  if (!fromMatch) {
    return callback(`Invalid From SIP URI format: ${event.From}`);
  }
  const from = fromMatch[1];

  // Extract the SIP side UUI reference
  const UUI = event["SipHeader_x-inin-cnv"] || Date.now();

  try {
    // console.info(`Dialling ${to} with Caller ID ${from} for Call SID: ${event.CallSid} with UUI ${UUI}`);

    // Dial with REFER support for warm transfers
    voiceResponse.dial({
      callerId: from,
      answerOnBridge: true,        // Keep caller connected during transfer (warm transfer)
      referUrl: '/callTransfer', // Webhook for REFER handling
      referMethod: 'POST'
    }).number(to);

    return callback(null, voiceResponse);
  } catch (error) {
    return callback(`Error with callToPSTNwithRefer: ${error}`);
  }
};
