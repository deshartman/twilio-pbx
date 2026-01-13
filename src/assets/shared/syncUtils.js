/**
 * Sync Utilities for Twilio Serverless Functions
 *
 * Shared utilities for working with Twilio Sync Maps in the PBX routing system.
 * This is a private asset that can be accessed by Serverless Functions using
 * the Runtime.getAssets() API.
 *
 * Usage in a Serverless Function:
 * const assetsPath = Runtime.getAssets();
 * const syncUtils = require(assetsPath['/shared/syncUtils.js'].path);
 * const { extractPhoneFromSipUri, fetchNumberConfig } = syncUtils;
 */

/**
 * Extract E.164 phone number from SIP URI
 *
 * @param {string} sipUri - SIP URI in format 'sip:+614xxxxx@domain.com' or '<sip:+614xxxxx@domain.com>'
 * @returns {string|null} - E.164 phone number (e.g., '+614xxxxx') or null if not found
 *
 * @example
 * extractPhoneFromSipUri('sip:+61412345678@example.com') // Returns: '+61412345678'
 * extractPhoneFromSipUri('<sip:+61412345678@example.com>') // Returns: '+61412345678'
 * extractPhoneFromSipUri('sip:614xxxxx@example.com') // Returns: '614xxxxx' (no + prefix)
 * extractPhoneFromSipUri('invalid') // Returns: null
 */
module.exports.extractPhoneFromSipUri = (sipUri) => {
  if (!sipUri || typeof sipUri !== 'string') {
    return null;
  }

  // Remove angle brackets if present
  let cleaned = sipUri.trim();
  if (cleaned.startsWith('<') && cleaned.endsWith('>')) {
    cleaned = cleaned.slice(1, -1);
  }

  // Extract number from SIP URI using regex
  // Pattern: sip:(optional +)(digits)@(domain)
  const match = cleaned.match(/^sip:((\+)?[0-9]+)@(.*)/);

  if (match && match[1]) {
    return match[1]; // Return the captured phone number (with or without +)
  }

  return null;
};

/**
 * Fetch phone number routing configuration from Sync Map
 *
 * @param {object} restClient - Twilio REST client instance
 * @param {string} serviceSid - Sync service SID (e.g., 'ISxxxx...')
 * @param {string} mapName - Sync Map unique name (e.g., 'numberConfig')
 * @param {string} phoneNumber - E.164 phone number to lookup (e.g., '+61412345678')
 * @returns {Promise<object|null>} - Map item data or null if not found
 *
 * @example
 * const config = await fetchNumberConfig(client, 'ISxxxx', 'numberConfig', '+61412345678');
 * // Returns: { type: 'sip', uri: 'sip:+61412345678@domain.com' }
 * // Or null if not found
 */
module.exports.fetchNumberConfig = async (restClient, serviceSid, mapName, phoneNumber) => {
  if (!restClient || !serviceSid || !mapName || !phoneNumber) {
    console.error('syncUtils.fetchNumberConfig: Missing required parameters');
    return null;
  }

  try {
    const item = await restClient.sync.v1
      .services(serviceSid)
      .syncMaps(mapName)
      .syncMapItems(phoneNumber)
      .fetch();

    // Return the data object which should contain { type, uri }
    return item.data;
  } catch (error) {
    // 404 means the phone number is not in the Map - this is expected behavior
    if (error.status === 404) {
      console.log(`syncUtils.fetchNumberConfig: No entry found for ${phoneNumber}`);
      return null;
    }

    // Other errors should be logged but still return null for graceful degradation
    console.error(`syncUtils.fetchNumberConfig: Error fetching config for ${phoneNumber}: ${error.message}`);
    return null;
  }
};
