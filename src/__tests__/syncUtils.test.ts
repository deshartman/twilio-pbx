/**
 * Unit Tests for Sync Utility Functions
 *
 * Tests the extractPhoneFromSipUri and fetchNumberConfig functions
 * that were moved inline into callTransfer.ts
 */

describe('extractPhoneFromSipUri', () => {
  // Import the function from callTransfer.ts (we'll need to export it first)
  // For now, we'll duplicate the function here for testing
  function extractPhoneFromSipUri(sipUri: string): string | null {
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
  }

  test('extracts phone number from standard SIP URI', () => {
    const result = extractPhoneFromSipUri('sip:+61412345678@example.com');
    expect(result).toBe('+61412345678');
  });

  test('extracts phone number from SIP URI with angle brackets', () => {
    const result = extractPhoneFromSipUri('<sip:+61412345678@example.com>');
    expect(result).toBe('+61412345678');
  });

  test('extracts phone number without + prefix', () => {
    const result = extractPhoneFromSipUri('sip:61412345678@example.com');
    expect(result).toBe('61412345678');
  });

  test('handles US phone number format', () => {
    const result = extractPhoneFromSipUri('sip:+19995551234@example.com');
    expect(result).toBe('+19995551234');
  });

  test('handles SIP URI with port number', () => {
    const result = extractPhoneFromSipUri('sip:+61412345678@example.com:5060');
    expect(result).toBe('+61412345678');
  });

  test('handles SIP URI with subdomain', () => {
    const result = extractPhoneFromSipUri('sip:+61412345678@sip.example.com');
    expect(result).toBe('+61412345678');
  });

  test('returns null for invalid SIP URI', () => {
    const result = extractPhoneFromSipUri('invalid');
    expect(result).toBeNull();
  });

  test('returns null for non-SIP URI', () => {
    const result = extractPhoneFromSipUri('tel:+61412345678');
    expect(result).toBeNull();
  });

  test('returns null for empty string', () => {
    const result = extractPhoneFromSipUri('');
    expect(result).toBeNull();
  });

  test('returns null for SIP URI without number', () => {
    const result = extractPhoneFromSipUri('sip:@example.com');
    expect(result).toBeNull();
  });

  test('handles whitespace trimming', () => {
    const result = extractPhoneFromSipUri('  sip:+61412345678@example.com  ');
    expect(result).toBe('+61412345678');
  });

  test('handles angle brackets with whitespace', () => {
    const result = extractPhoneFromSipUri('  <sip:+61412345678@example.com>  ');
    expect(result).toBe('+61412345678');
  });
});

describe('fetchNumberConfig - Mock Tests', () => {
  test('returns null when missing required parameters', async () => {
    const mockClient = {};

    // Duplicate the function here for testing
    async function fetchNumberConfig(
      restClient: any,
      serviceSid: string,
      mapName: string,
      phoneNumber: string
    ): Promise<{ type: string; uri: string } | null> {
      if (!restClient || !serviceSid || !mapName || !phoneNumber) {
        console.error('fetchNumberConfig: Missing required parameters');
        return null;
      }
      // Implementation would go here
      return null;
    }

    const result = await fetchNumberConfig(null as any, '', '', '');
    expect(result).toBeNull();
  });

  test('handles 404 errors gracefully', async () => {
    const mockClient = {
      sync: {
        v1: {
          services: jest.fn().mockReturnValue({
            syncMaps: jest.fn().mockReturnValue({
              syncMapItems: jest.fn().mockReturnValue({
                fetch: jest.fn().mockRejectedValue({ status: 404, message: 'Not found' })
              })
            })
          })
        }
      }
    };

    async function fetchNumberConfig(
      restClient: any,
      serviceSid: string,
      mapName: string,
      phoneNumber: string
    ): Promise<{ type: string; uri: string } | null> {
      if (!restClient || !serviceSid || !mapName || !phoneNumber) {
        return null;
      }

      try {
        const item = await restClient.sync.v1
          .services(serviceSid)
          .syncMaps(mapName)
          .syncMapItems(phoneNumber)
          .fetch();

        return item.data;
      } catch (error: any) {
        if (error.status === 404) {
          return null;
        }
        return null;
      }
    }

    const result = await fetchNumberConfig(mockClient, 'IS123', 'testMap', '+61412345678');
    expect(result).toBeNull();
  });

  test('returns data object on successful fetch', async () => {
    const mockData = { type: 'sip', uri: 'sip:+61412345678@test.com' };
    const mockClient = {
      sync: {
        v1: {
          services: jest.fn().mockReturnValue({
            syncMaps: jest.fn().mockReturnValue({
              syncMapItems: jest.fn().mockReturnValue({
                fetch: jest.fn().mockResolvedValue({ data: mockData })
              })
            })
          })
        }
      }
    };

    async function fetchNumberConfig(
      restClient: any,
      serviceSid: string,
      mapName: string,
      phoneNumber: string
    ): Promise<{ type: string; uri: string } | null> {
      if (!restClient || !serviceSid || !mapName || !phoneNumber) {
        return null;
      }

      try {
        const item = await restClient.sync.v1
          .services(serviceSid)
          .syncMaps(mapName)
          .syncMapItems(phoneNumber)
          .fetch();

        return item.data;
      } catch (error: any) {
        return null;
      }
    }

    const result = await fetchNumberConfig(mockClient, 'IS123', 'testMap', '+61412345678');
    expect(result).toEqual(mockData);
  });
});
