import '@twilio-labs/serverless-runtime-types';
import { Context, ServerlessCallback, ServerlessFunctionSignature } from '@twilio-labs/serverless-runtime-types/types';

export interface ServerlessEnvironment {
  SIP_DOMAIN_URI: string;
  [key: string]: string | undefined;
}

export interface CallToSIPEvent {
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
 * This is the inbound call from PSTN that routes the call to the Customer destination SIP Domain WITH REFER SUPPORT.
 *
 * Same as callToSIP.js but with answerOnBridge and referUrl for warm transfer capability.
 *
 */
export const handler: ServerlessFunctionSignature<ServerlessEnvironment, CallToSIPEvent> = async (
  context: Context<ServerlessEnvironment>,
  event: CallToSIPEvent,
  callback: ServerlessCallback
) => {

  const restClient = context.getTwilioClient();
  const voiceResponse = new Twilio.twiml.VoiceResponse();
  const UUI = event.CallSid;  // Extract the PSTN side UUI reference

  try {
    const sipTo = `${event.To}@${context.SIP_DOMAIN_URI}?User-to-User=${UUI}`;
    // console.info(`callToSIPwithRefer: Calling SIP URI: ${sipTo} for Call SID: ${event.CallSid} and UUI: ${UUI}`)

    // Dial SIP URL with REFER support for warm transfers
    voiceResponse.dial({
      answerOnBridge: true,        // Keep caller connected during transfer (warm transfer)
      referUrl: '/callTransfer', // Webhook for REFER handling
      referMethod: 'POST'
    }).sip(sipTo);

    return callback(null, voiceResponse);
  } catch (error) {
    return callback(`Error with callToSIPwithRefer: ${error}`);
  }
};
