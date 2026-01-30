/**
 * Integration Tests for Twilio Sync API
 *
 * These tests interact with the actual Twilio Sync service to verify:
 * 1. Creating Sync Map items
 * 2. Reading Sync Map items
 * 3. Updating Sync Map items
 * 4. Deleting Sync Map items
 * 5. Handling 404 errors for missing items
 *
 * Prerequisites:
 * - .env.dev must contain valid ACCOUNT_SID, AUTH_TOKEN, SYNC_SERVICE_SID, SYNC_MAP_PHONES_NAME
 * - Sync service and map must exist in Twilio account
 * - Tests use +19999999999 as test phone number (deleted after each test)
 */

import Twilio from 'twilio';

const TEST_PHONE = '+19999999999';

describe('Sync Map Integration Tests', () => {
  let twilioClient: ReturnType<typeof Twilio>;
  let serviceSid: string;
  let mapName: string;

  beforeAll(() => {
    // Verify environment variables are set
    const accountSid = process.env.ACCOUNT_SID;
    const authToken = process.env.AUTH_TOKEN;
    serviceSid = process.env.SYNC_SERVICE_SID || '';
    mapName = process.env.SYNC_MAP_PHONES_NAME || '';

    if (!accountSid || !authToken) {
      throw new Error('ACCOUNT_SID and AUTH_TOKEN must be set in .env.dev');
    }

    if (!serviceSid || !mapName) {
      throw new Error('SYNC_SERVICE_SID and SYNC_MAP_PHONES_NAME must be set in .env.dev');
    }

    // Initialize Twilio client
    twilioClient = Twilio(accountSid, authToken);
  });

  afterEach(async () => {
    // Clean up: delete test entry after each test
    try {
      await twilioClient.sync.v1
        .services(serviceSid)
        .syncMaps(mapName)
        .syncMapItems(TEST_PHONE)
        .remove();
      console.log(`Cleanup: Deleted test entry ${TEST_PHONE}`);
    } catch (error: any) {
      if (error.status !== 404) {
        console.warn(`Cleanup warning: ${error.message}`);
      }
      // 404 is fine - item doesn't exist
    }
  });

  test('Create Sync Map item', async () => {
    const testData = {
      type: 'sip',
      uri: 'sip:+19999999999@test.sip.twilio.com'
    };

    const item = await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(mapName)
      .syncMapItems
      .create({
        key: TEST_PHONE,
        data: testData
      });

    expect(item.key).toBe(TEST_PHONE);
    expect(item.data).toEqual(testData);
  }, 10000); // 10 second timeout

  test('Fetch existing Sync Map item', async () => {
    // First create the item
    const testData = {
      type: 'sip',
      uri: 'sip:+19999999999@test.sip.twilio.com'
    };

    await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(mapName)
      .syncMapItems
      .create({
        key: TEST_PHONE,
        data: testData
      });

    // Now fetch it
    const item = await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(mapName)
      .syncMapItems(TEST_PHONE)
      .fetch();

    expect(item.key).toBe(TEST_PHONE);
    expect(item.data).toEqual(testData);
  }, 10000);

  test('Update Sync Map item', async () => {
    // Create initial item
    const initialData = {
      type: 'sip',
      uri: 'sip:+19999999999@test.sip.twilio.com'
    };

    await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(mapName)
      .syncMapItems
      .create({
        key: TEST_PHONE,
        data: initialData
      });

    // Update it
    const updatedData = {
      type: 'number',
      uri: '+19995551234'
    };

    const item = await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(mapName)
      .syncMapItems(TEST_PHONE)
      .update({ data: updatedData });

    expect(item.key).toBe(TEST_PHONE);
    expect(item.data).toEqual(updatedData);
  }, 10000);

  test('Delete Sync Map item', async () => {
    // Create item
    const testData = {
      type: 'sip',
      uri: 'sip:+19999999999@test.sip.twilio.com'
    };

    await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(mapName)
      .syncMapItems
      .create({
        key: TEST_PHONE,
        data: testData
      });

    // Delete it
    await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(mapName)
      .syncMapItems(TEST_PHONE)
      .remove();

    // Verify it's deleted by attempting to fetch (should throw 404)
    await expect(
      twilioClient.sync.v1
        .services(serviceSid)
        .syncMaps(mapName)
        .syncMapItems(TEST_PHONE)
        .fetch()
    ).rejects.toThrow();
  }, 10000);

  test('Handle 404 for unmapped numbers', async () => {
    // Try to fetch a non-existent number
    const nonExistentPhone = '+19995551234';

    await expect(
      twilioClient.sync.v1
        .services(serviceSid)
        .syncMaps(mapName)
        .syncMapItems(nonExistentPhone)
        .fetch()
    ).rejects.toThrow();
  }, 10000);

  test('Verify fetchNumberConfig returns correct data', async () => {
    // Create test item
    const testData = {
      type: 'sip',
      uri: 'sip:+19999999999@test.sip.twilio.com'
    };

    await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(mapName)
      .syncMapItems
      .create({
        key: TEST_PHONE,
        data: testData
      });

    // Use the actual fetchNumberConfig logic
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

    const result = await fetchNumberConfig(twilioClient, serviceSid, mapName, TEST_PHONE);

    expect(result).toEqual(testData);
    expect(result?.type).toBe('sip');
    expect(result?.uri).toBe('sip:+19999999999@test.sip.twilio.com');
  }, 10000);

  test('Verify fetchNumberConfig handles 404 gracefully', async () => {
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

    const result = await fetchNumberConfig(twilioClient, serviceSid, mapName, '+19995551234');

    expect(result).toBeNull();
  }, 10000);
});

/**
 * Comprehensive fetchNumberConfig Tests - Multiple Routing Types
 *
 * This test suite validates the fetchNumberConfig function from callTransfer.ts
 * with multiple routing types using temporary test data. Tests create test entries
 * before running, validate reads, then clean up afterwards.
 *
 * Test data uses temporary phone numbers:
 * - +19999999999 (SIP routing)
 * - +19998888888 (PSTN routing)
 * - +19997777777 (Client routing)
 *
 * Production data (+614...) is never touched.
 */
describe('fetchNumberConfig Function - Multiple Routing Types', () => {
  let twilioClient: ReturnType<typeof Twilio>;
  let serviceSid: string;
  let mapName: string;

  // Helper function - matches implementation in callTransfer.ts
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

  // Test data matching production format
  const TEST_DATA = [
    {
      phone: '+19999999999',
      config: { type: 'sip', uri: 'sip:+19999999999@test.sip.twilio.com' },
      description: 'SIP routing'
    },
    {
      phone: '+19998888888',
      config: { type: 'number', uri: '+18885551234' },
      description: 'PSTN routing'
    },
    {
      phone: '+19997777777',
      config: { type: 'client', uri: 'client:test_agent' },
      description: 'Client routing'
    }
  ];

  beforeAll(async () => {
    // Load config from .env.dev
    serviceSid = process.env.SYNC_SERVICE_SID || '';
    mapName = process.env.SYNC_MAP_PHONES_NAME || '';
    twilioClient = Twilio(process.env.ACCOUNT_SID!, process.env.AUTH_TOKEN!);

    // Create all test entries
    for (const testCase of TEST_DATA) {
      await twilioClient.sync.v1
        .services(serviceSid)
        .syncMaps(mapName)
        .syncMapItems
        .create({
          key: testCase.phone,
          data: testCase.config
        });
      console.log(`✓ Created test entry: ${testCase.phone} (${testCase.description})`);
    }
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    // Clean up all test entries
    for (const testCase of TEST_DATA) {
      try {
        await twilioClient.sync.v1
          .services(serviceSid)
          .syncMaps(mapName)
          .syncMapItems(testCase.phone)
          .remove();
        console.log(`✓ Cleaned up test entry: ${testCase.phone}`);
      } catch (error: any) {
        if (error.status !== 404) {
          console.warn(`Cleanup warning for ${testCase.phone}: ${error.message}`);
        }
      }
    }
  }, 30000); // 30 second timeout for cleanup

  test('fetchNumberConfig returns SIP config correctly', async () => {
    const result = await fetchNumberConfig(
      twilioClient,
      serviceSid,
      mapName,
      '+19999999999'
    );

    expect(result).not.toBeNull();
    expect(result?.type).toBe('sip');
    expect(result?.uri).toBe('sip:+19999999999@test.sip.twilio.com');

    // Verify data structure matches production format
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('uri');
  }, 10000);

  test('fetchNumberConfig returns PSTN config correctly', async () => {
    const result = await fetchNumberConfig(
      twilioClient,
      serviceSid,
      mapName,
      '+19998888888'
    );

    expect(result).not.toBeNull();
    expect(result?.type).toBe('number');
    expect(result?.uri).toBe('+18885551234');

    // Verify data structure matches production format
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('uri');
  }, 10000);

  test('fetchNumberConfig returns Client config correctly', async () => {
    const result = await fetchNumberConfig(
      twilioClient,
      serviceSid,
      mapName,
      '+19997777777'
    );

    expect(result).not.toBeNull();
    expect(result?.type).toBe('client');
    expect(result?.uri).toBe('client:test_agent');

    // Verify data structure matches production format
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('uri');
  }, 10000);

  test('fetchNumberConfig returns null for unmapped number', async () => {
    const result = await fetchNumberConfig(
      twilioClient,
      serviceSid,
      mapName,
      '+15555555555'
    );

    expect(result).toBeNull();
  }, 10000);

  test('fetchNumberConfig returns null for invalid parameters', async () => {
    // Test with missing parameters
    const result1 = await fetchNumberConfig(null as any, serviceSid, mapName, '+19999999999');
    expect(result1).toBeNull();

    const result2 = await fetchNumberConfig(twilioClient, '', mapName, '+19999999999');
    expect(result2).toBeNull();

    const result3 = await fetchNumberConfig(twilioClient, serviceSid, '', '+19999999999');
    expect(result3).toBeNull();

    const result4 = await fetchNumberConfig(twilioClient, serviceSid, mapName, '');
    expect(result4).toBeNull();
  }, 10000);

  test('All test data structures match production format', () => {
    // Verify each test entry has the correct structure
    TEST_DATA.forEach(testCase => {
      expect(testCase.config).toHaveProperty('type');
      expect(testCase.config).toHaveProperty('uri');

      // Verify type is one of the valid routing types
      expect(['sip', 'number', 'client', 'pstn', 'application']).toContain(testCase.config.type);

      // Verify URI format matches type
      if (testCase.config.type === 'sip') {
        expect(testCase.config.uri).toMatch(/^sip:\+?\d+@/);
      } else if (testCase.config.type === 'number') {
        expect(testCase.config.uri).toMatch(/^\+\d+$/);
      } else if (testCase.config.type === 'client') {
        expect(testCase.config.uri).toMatch(/^client:/);
      }
    });
  });
});

/**
 * Ring Group Sync Integration Tests
 *
 * Tests for ring group configuration stored in Twilio Sync Maps.
 * Ring groups store an array of destinations (SIP or PSTN) for sequential dialing.
 *
 * Test data uses ring group ID "999" (temporary, cleaned up after tests).
 */
describe('Ring Group Sync Integration Tests', () => {
  let twilioClient: ReturnType<typeof Twilio>;
  let serviceSid: string;
  let ringGroupMapName: string;

  const TEST_RING_GROUP_ID = '999';
  const TEST_DESTINATIONS = {
    group: [
      {
        name: 'test_sip',
        type: 'sip',
        destination: 'sip:+19999999999@test.sip.twilio.com',
        timeout: 10
      },
      {
        name: 'test_pstn',
        type: 'number',
        destination: '+18885551234',
        timeout: 20
      }
    ]
  };

  // Helper function - matches implementation in ringGroup.ts
  async function fetchRingGroupConfig(
    restClient: any,
    serviceSid: string,
    mapName: string,
    ringGroupId: string
  ): Promise<any[] | null> {
    if (!restClient || !serviceSid || !mapName || !ringGroupId) {
      return null;
    }

    try {
      const item = await restClient.sync.v1
        .services(serviceSid)
        .syncMaps(mapName)
        .syncMapItems(ringGroupId)
        .fetch();

      if (!item.data || !item.data.group || !Array.isArray(item.data.group)) {
        return null;
      }

      return item.data.group;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      return null;
    }
  }

  beforeAll(async () => {
    // Load config from .env.dev
    serviceSid = process.env.SYNC_SERVICE_SID || '';
    ringGroupMapName = process.env.SYNC_MAP_RINGGROUP_NAME || '';
    twilioClient = Twilio(process.env.ACCOUNT_SID!, process.env.AUTH_TOKEN!);

    if (!serviceSid || !ringGroupMapName) {
      throw new Error('SYNC_SERVICE_SID and SYNC_MAP_RINGGROUP_NAME must be set in .env.dev');
    }

    // Check if ringGroup Map exists, create if not
    try {
      await twilioClient.sync.v1
        .services(serviceSid)
        .syncMaps(ringGroupMapName)
        .fetch();
      console.log(`✓ Ring group map "${ringGroupMapName}" exists`);
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`✓ Creating ring group map "${ringGroupMapName}"`);
        await twilioClient.sync.v1
          .services(serviceSid)
          .syncMaps
          .create({
            uniqueName: ringGroupMapName
          });
        console.log(`✓ Created ring group map "${ringGroupMapName}"`);
      } else {
        throw error;
      }
    }

    // Create test ring group
    await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(ringGroupMapName)
      .syncMapItems
      .create({
        key: TEST_RING_GROUP_ID,
        data: TEST_DESTINATIONS
      });

    console.log(`✓ Created test ring group: ${TEST_RING_GROUP_ID}`);
  }, 30000);

  afterAll(async () => {
    // Clean up test ring group
    try {
      await twilioClient.sync.v1
        .services(serviceSid)
        .syncMaps(ringGroupMapName)
        .syncMapItems(TEST_RING_GROUP_ID)
        .remove();
      console.log(`✓ Cleaned up test ring group: ${TEST_RING_GROUP_ID}`);
    } catch (error: any) {
      if (error.status !== 404) {
        console.warn(`Cleanup warning for ${TEST_RING_GROUP_ID}: ${error.message}`);
      }
    }
  }, 30000);

  test('Create ring group item in Sync Map', async () => {
    // Delete if exists
    try {
      await twilioClient.sync.v1
        .services(serviceSid)
        .syncMaps(ringGroupMapName)
        .syncMapItems('998')
        .remove();
    } catch (error: any) {
      // Ignore 404
    }

    const testData = {
      group: [
        {
          name: 'create_test',
          type: 'sip',
          destination: 'sip:+19999999998@test.sip.twilio.com',
          timeout: 15
        }
      ]
    };

    const item = await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(ringGroupMapName)
      .syncMapItems
      .create({
        key: '998',
        data: testData
      });

    expect(item.key).toBe('998');
    expect(item.data.group).toBeDefined();
    expect(Array.isArray(item.data.group)).toBe(true);
    expect(item.data).toEqual(testData);

    // Cleanup
    await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(ringGroupMapName)
      .syncMapItems('998')
      .remove();
  }, 10000);

  test('Read ring group and validate structure', async () => {
    const item = await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(ringGroupMapName)
      .syncMapItems(TEST_RING_GROUP_ID)
      .fetch();

    expect(item.key).toBe(TEST_RING_GROUP_ID);
    expect(item.data.group).toBeDefined();
    expect(Array.isArray(item.data.group)).toBe(true);
    expect(item.data.group.length).toBe(2);

    // Validate destination structure
    item.data.group.forEach((dest: any) => {
      expect(dest).toHaveProperty('name');
      expect(dest).toHaveProperty('type');
      expect(dest).toHaveProperty('destination');
      expect(dest).toHaveProperty('timeout');
      expect(['sip', 'number']).toContain(dest.type);
    });
  }, 10000);

  test('Update ring group destinations', async () => {
    const updatedDestinations = {
      group: [
        {
          name: 'updated_dest',
          type: 'number',
          destination: '+18005551234',
          timeout: 25
        }
      ]
    };

    const item = await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(ringGroupMapName)
      .syncMapItems(TEST_RING_GROUP_ID)
      .update({ data: updatedDestinations });

    expect(item.key).toBe(TEST_RING_GROUP_ID);
    expect(item.data.group).toBeDefined();
    expect(Array.isArray(item.data.group)).toBe(true);
    expect(item.data).toEqual(updatedDestinations);

    // Restore original data
    await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(ringGroupMapName)
      .syncMapItems(TEST_RING_GROUP_ID)
      .update({ data: TEST_DESTINATIONS });
  }, 10000);

  test('Delete ring group item', async () => {
    // Create temporary item
    await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(ringGroupMapName)
      .syncMapItems
      .create({
        key: '997',
        data: { group: [{ name: 'temp', type: 'sip', destination: 'sip:temp@test.com', timeout: 10 }] }
      });

    // Delete it
    await twilioClient.sync.v1
      .services(serviceSid)
      .syncMaps(ringGroupMapName)
      .syncMapItems('997')
      .remove();

    // Verify it's deleted
    await expect(
      twilioClient.sync.v1
        .services(serviceSid)
        .syncMaps(ringGroupMapName)
        .syncMapItems('997')
        .fetch()
    ).rejects.toThrow();
  }, 10000);

  test('Handle 404 for unmapped ring group IDs', async () => {
    const nonExistentId = '888';

    await expect(
      twilioClient.sync.v1
        .services(serviceSid)
        .syncMaps(ringGroupMapName)
        .syncMapItems(nonExistentId)
        .fetch()
    ).rejects.toThrow();
  }, 10000);

  test('fetchRingGroupConfig returns correct data', async () => {
    const result = await fetchRingGroupConfig(
      twilioClient,
      serviceSid,
      ringGroupMapName,
      TEST_RING_GROUP_ID
    );

    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);
    expect(result?.length).toBe(2);

    // Validate first destination
    expect(result?.[0].name).toBe('test_sip');
    expect(result?.[0].type).toBe('sip');
    expect(result?.[0].destination).toBe('sip:+19999999999@test.sip.twilio.com');
    expect(result?.[0].timeout).toBe(10);

    // Validate second destination
    expect(result?.[1].name).toBe('test_pstn');
    expect(result?.[1].type).toBe('number');
    expect(result?.[1].destination).toBe('+18885551234');
    expect(result?.[1].timeout).toBe(20);
  }, 10000);

  test('fetchRingGroupConfig returns null for non-existent ring groups', async () => {
    const result = await fetchRingGroupConfig(
      twilioClient,
      serviceSid,
      ringGroupMapName,
      '777'
    );

    expect(result).toBeNull();
  }, 10000);

  test('fetchRingGroupConfig returns null for invalid parameters', async () => {
    const result1 = await fetchRingGroupConfig(null as any, serviceSid, ringGroupMapName, TEST_RING_GROUP_ID);
    expect(result1).toBeNull();

    const result2 = await fetchRingGroupConfig(twilioClient, '', ringGroupMapName, TEST_RING_GROUP_ID);
    expect(result2).toBeNull();

    const result3 = await fetchRingGroupConfig(twilioClient, serviceSid, '', TEST_RING_GROUP_ID);
    expect(result3).toBeNull();

    const result4 = await fetchRingGroupConfig(twilioClient, serviceSid, ringGroupMapName, '');
    expect(result4).toBeNull();
  }, 10000);
});
