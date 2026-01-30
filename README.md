# Twilio PBX

A modern IP PBX implementation using Twilio Voice with registered SIP endpoints and Twilio Sync for dynamic call routing configuration.

## Overview

This project provides a flexible PBX system that integrates Twilio Voice with SIP endpoints, enabling dynamic call routing, ring groups, and call transfers. Configuration is managed through Twilio Sync Maps, allowing real-time routing changes without redeployment.

## History Rewrite Notice (January 28, 2026)

**IMPORTANT**: On January 28, 2026, this repository's git history was rewritten to remove accidentally committed sensitive information (phone numbers and SIP credentials).

If you have a local clone created before this date:
1. Delete your local repository
2. Re-clone from GitHub: `git clone https://github.com/deshartman/twilio-pbx.git`

The commit history has been modified, but all functionality remains intact. The removed credentials should be rotated as a security precaution.

## Features

### Core Capabilities
- **SIP Endpoint Registration**: Register and manage SIP endpoints with Twilio
- **Dynamic Call Routing**: Configure routing via Twilio Sync Maps
- **Multiple Routing Types**:
  - SIP destinations (with UUI header support)
  - PSTN numbers
  - Twilio Client connections
- **Ring Groups**: Simultaneous or sequential ringing across multiple endpoints
- **Call Transfer with REFER**: Standards-compliant SIP REFER support
- **Graceful Fallback**: Automatic PSTN routing when Sync Map entries are not found

### Twilio Sync Integration
- Idempotent service and map setup
- Real-time routing configuration updates
- No redeployment needed for routing changes
- Console and API management support

## Requirements

- Node.js 22
- Twilio Account (with US1 region access for Sync)
- pnpm package manager (or npm/yarn)
- Twilio CLI (for deployment)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd twilio-pbx
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy environment configuration:
```bash
cp .env.example .env.dev
```

4. Configure your environment variables in `.env.dev`:
```bash
# Twilio Account Credentials
ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AUTH_TOKEN=your_auth_token_here

# Function Variables
SERVER_URL=https://your-server.example.com
SIP_DOMAIN_URI=your-domain.sip.twilio.com

# Sync Service Configuration
SYNC_SERVICE_NAME=pbx-routing
SYNC_MAP_PHONES_NAME=numberConfig
SYNC_MAP_RINGGROUP_NAME=ringGroup
```

## Setup

### 1. Build the Project
```bash
npm run build
```

### 2. Local Testing with ngrok
Start the local development server:
```bash
npm run start
```

The server will run on `http://localhost:3000`. Use ngrok or a similar tool to expose it:
```bash
ngrok http 3000
```

Update your `.env.dev` with the ngrok URL.

### 3. Deploy to Twilio
```bash
npm run deploy
```

**Important**: Deploy to US1 region for Sync compatibility.

### 4. Initialize Sync Service
Navigate to your deployed `setupSync` function URL in a browser. The function will:
- Create a Sync service (if it doesn't exist)
- Create the `numberConfig` Map (if it doesn't exist)
- Create the `ringGroup` Map (if it doesn't exist)
- Populate ring group "1" with default destinations in the correct format: `{"group": [...]}`
- Display the `SYNC_SERVICE_SID`

Copy the `SYNC_SERVICE_SID` and add it to your `.env.dev` or `.env.prod`:
```bash
SYNC_SERVICE_SID=ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Redeploy after adding the SID.

## Configuration

### Sync Map Structure

The `numberConfig` Map stores routing configuration:

**Key**: E.164 phone number (e.g., `+61412345678`)
**Data**: JSON object with routing information

#### Adding Routes via Twilio Console

Navigate to: Explore Products → Sync → Services → [Your Service] → Maps → numberConfig

**SIP Route** (with UUI header):
```json
{
  "Data": {
    "type": "sip",
    "uri": "sip:+61412345678@yourdomain.sip.twilio.com"
  }
}
```

**PSTN Route**:
```json
{
  "Data": {
    "type": "number",
    "uri": "+61499999999"
  }
}
```

**Twilio Client Route** (no UUI):
```json
{
  "Data": {
    "type": "client",
    "uri": "client:support_agent"
  }
}
```

#### Adding Routes via Twilio CLI

```bash
twilio api:sync:v1:services:sync-maps:sync-map-items:create \
  --service-sid ISxxxx \
  --sync-map-sid numberConfig \
  --key "+61412345678" \
  --data '{"type":"sip","uri":"sip:+61412345678@test.sip.twilio.com"}'
```

**Note**: CLI format does not use the "Data" wrapper that the Console requires.

### Ring Group Configuration

The `ringGroup` Map stores ring group destination arrays for sequential dialing:

**Key**: Ring group ID (e.g., `1`, `2`, `group1`)
**Data**: JSON object with a `group` property containing an array of destination objects

**Important**: Twilio Sync Maps require the root value to be an object, not an array. Ring group destinations must be wrapped in a `group` property.

#### Adding Ring Groups via Twilio Console

Navigate to: Explore Products → Sync → Services → [Your Service] → Maps → ringGroup

**Ring Group Example** (key: `group1`):
```json
{
  "Data": {
    "group": [
      {
        "name": "sales_primary",
        "type": "sip",
        "destination": "sip:+61412345678@corporate.sip.twilio.com",
        "timeout": 10
      },
      {
        "name": "sales_fallback",
        "type": "number",
        "destination": "+61412345678",
        "timeout": 30
      }
    ]
  }
}
```

**Note**: Console requires the "Data" wrapper. The value inside "Data" must be an object with a "group" property containing your destinations array.

#### Adding Ring Groups via cURL

```bash
curl -X POST \
  'https://sync.twilio.com/v1/Services/ISxxxx/Maps/MPxxxx/Items' \
  -u 'ACxxxx:your_auth_token' \
  -d 'Key=group1' \
  -d 'Data={"group":[{"name":"support","type":"sip","destination":"sip:+61412345678@test.sip.twilio.com","timeout":15}]}'
```

**Note**: Use the Map SID (MPxxxx) instead of the unique name when using cURL. The data must be an object with a "group" property.

#### Adding Ring Groups via Twilio CLI

```bash
twilio api:sync:v1:services:sync-maps:sync-map-items:create \
  --service-sid ISxxxx \
  --sync-map-sid ringGroup \
  --key "2" \
  --data '{"group":[{"name":"support","type":"sip","destination":"sip:+61412345678@test.sip.twilio.com","timeout":15}]}'
```

**Note**: CLI format requires the data to be an object with a "group" property containing the destinations array.

#### Destination Fields

- `name`: Friendly identifier for logging
- `type`: Either `"sip"` or `"number"`
- `destination`: Full SIP URI or E.164 phone number
- `timeout`: Ring timeout in seconds (use integer, not string)

#### SDK Usage (in code)

When using the Twilio SDK in your functions, pass a JavaScript object with a `group` property:

```typescript
await client.sync.v1
  .services(serviceSid)
  .syncMaps('ringGroup')
  .syncMapItems
  .create({
    key: '3',
    data: {
      group: [
        {name: 'dest1', type: 'sip', destination: 'sip:+123@domain.com', timeout: 10}
      ]
    }  // Object with group property - SDK handles serialization
  });
```

## Available Functions

### `/setupSync`
Idempotently creates Sync service and Maps. Returns an HTML interface with setup details.

**Environment Variables**:
- `SYNC_SERVICE_NAME`
- `SYNC_MAP_PHONES_NAME`
- `SYNC_MAP_RINGGROUP_NAME`

### `/callTransfer`
Handles call transfers with Sync Map lookup for dynamic routing.

**Process**:
1. Extracts E.164 number from SIP URI
2. Queries Sync Map for routing configuration
3. Routes based on `type`:
   - `sip`: Dials as SIP with UUI header
   - `client`: Dials as Twilio Client
   - `number`/`pstn`: Dials as PSTN
4. Falls back to PSTN if no Map entry exists

**Environment Variables**:
- `SYNC_SERVICE_SID`
- `SYNC_MAP_PHONES_NAME`
- `SIP_DOMAIN_URI`

### `/callToPSTNwithRefer`
Handles calls to PSTN numbers with REFER support.

### `/callToSIPwithRefer`
Handles calls to SIP endpoints with REFER support.

### `/ringGroup`
Sequential ring group with Sync Map configuration. Attempts each destination in order, proceeding to the next only if the previous call was not answered.

**Query Parameters**:
- `ringGroupId` (optional): Ring group ID to load (defaults to "1")

**Environment Variables**:
- `SYNC_SERVICE_SID`
- `SYNC_MAP_RINGGROUP_NAME`

**Usage**: `https://your-domain.twil.io/ringGroup?ringGroupId=1`

Ring group destinations are loaded dynamically from the Sync Map, allowing real-time configuration changes without redeployment.

## Architecture

### Routing Logic Flow

```
Incoming Call/Transfer
    ↓
Extract E.164 number from SIP URI
    ↓
Query Sync Map (numberConfig)
    ↓
    ├─→ Map Entry Found
    │   ├─→ type: "sip" → Dial SIP with UUI
    │   ├─→ type: "client" → Dial Twilio Client
    │   └─→ type: "number/pstn" → Dial PSTN
    │
    └─→ No Map Entry → Fallback to PSTN
```

### Function Structure

Utility functions are implemented inline within each function file for simplified deployment and debugging. The main utilities are:

- `extractPhoneFromSipUri(sipUri)`: Extracts E.164 number from SIP URI
- `fetchNumberConfig(restClient, serviceSid, mapName, phoneNumber)`: Queries Sync Map with comprehensive diagnostic logging

## Testing

### Test Suite Overview

The project includes comprehensive unit, integration, and end-to-end tests to ensure all routing functionality works correctly with your `.env.dev` configuration.

Run the test suite:
```bash
npm test                    # Run all tests (36 tests)
npm run test:watch          # Watch mode
npm run test:coverage       # Generate coverage report
```

### Unit Tests (`syncUtils.test.ts`)

Tests for utility functions without making Twilio API calls:
- Phone number extraction from SIP URIs
- Various URI format handling (with/without angle brackets, with/without + prefix)
- Mock-based function validation
- No Twilio credentials required

### Integration Tests (`syncIntegration.test.ts`)

Tests that interact with the actual Twilio Sync service using `.env.dev` configuration:

#### 1. Basic CRUD Operations
- Create Sync Map items
- Read existing items
- Update item data
- Delete items
- Handle 404 errors for missing items

#### 2. fetchNumberConfig Function Tests (Comprehensive)

Validates the `fetchNumberConfig()` function from `callTransfer.ts` with multiple routing types:

**Test Data** (temporary entries created during tests):
- `+19999999999` - SIP routing (`sip:+19999999999@test.sip.twilio.com`)
- `+19998888888` - PSTN routing (`+18885551234`)
- `+19997777777` - Client routing (`client:test_agent`)

**Tests Include**:
- ✓ SIP routing configuration validation
- ✓ PSTN/number routing configuration validation
- ✓ Client routing configuration validation
- ✓ Null return for unmapped numbers (404 handling)
- ✓ Null return for invalid parameters
- ✓ Data structure validation (matches production format)

**Test Lifecycle**:
1. `beforeAll`: Creates all test entries in Sync Map
2. Tests run: Validates `fetchNumberConfig()` reads data correctly
3. `afterAll`: Removes all test entries (automatic cleanup)

**Important**: Tests use temporary phone numbers and **do NOT interact with production data** (+614... numbers). All test entries are automatically cleaned up after the test suite completes.

### End-to-End Tests (`callTransfer.test.ts`)

Tests that simulate the complete SIP REFER flow from `callToSIPwithRefer.ts` → `callTransfer.ts` → TwiML output:

**Test Data** (temporary entries created during tests):
- `+19991111111` - SIP routing
- `+19992222222` - Client routing
- `+19993333333` - PSTN routing
- `+19994444444` - Unmapped (fallback)

**Tests Include**:
- ✓ Routes to SIP destination when Sync entry type is "sip" (verifies switch case 'sip')
- ✓ Routes to Twilio Client when Sync entry type is "client" (verifies switch case 'client')
- ✓ Routes to PSTN number when Sync entry type is "number" (verifies switch case 'number')
- ✓ Falls back to PSTN when number is not in Sync Map (verifies default case)
- ✓ Extracts phone number from ReferTransferTarget with angle brackets
- ✓ Handles missing ReferTransferTarget with error
- ✓ Preserves UUI from SIP headers in transfer
- ✓ Uses CallSid as fallback UUI when headers are missing

**What These Tests Verify**:
1. Complete REFER event processing
2. Sync Map lookup for each routing type
3. Switch statement correctly routes based on `type` field (line 212 in callTransfer.ts)
4. TwiML generation matches expected output for each routing type
5. UUI header preservation for SIP routes
6. Error handling for edge cases

These tests provide end-to-end confirmation that the sync entry is correctly picked up and the switch statement routes calls appropriately.

### Prerequisites for Integration Tests

Required `.env.dev` configuration:
```bash
ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AUTH_TOKEN=your_auth_token_here
SYNC_SERVICE_SID=ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SYNC_MAP_PHONES_NAME=numberConfig
SYNC_MAP_RINGGROUP_NAME=ringGroup
```

If any variables are missing, the test setup will display clear warnings indicating which variables need to be set.

### Local Testing
1. Build: `npm run build`
2. Start: `npm run start`
3. Use ngrok to expose the local server
4. Test with SIP phone or Twilio Console

### Test Scenarios
- Number in Map (SIP type)
- Number in Map (PSTN type)
- Number in Map (Client type)
- Number NOT in Map (fallback)
- Invalid target format

### Debugging Sync Issues

The `fetchNumberConfig()` function includes comprehensive diagnostic logging:
- Environment variable validation
- Sync API call details
- Response object inspection
- Detailed error messages with status codes

Check Twilio Function logs to see:
- `Sync Config Check`: Validates environment configuration
- `Sync API call`: Shows the exact API call being made
- `Sync fetch result`: Full response object on success
- `Sync API error`: Detailed error information including status codes

## Deployment

### Development
```bash
npm run build
npm run deploy
```

### Production
1. Create `.env.prod` with production values
2. Ensure US1 region deployment (Sync requirement)
3. Deploy: `npm run deploy`
4. Run setupSync function
5. Update `.env.prod` with `SYNC_SERVICE_SID`
6. Redeploy with updated environment

## Rollback Strategy

If issues arise:
1. Remove or comment out `SYNC_SERVICE_SID` in `.env`
2. Redeploy
3. System automatically falls back to PSTN routing
4. Sync Map data persists for future re-enable

## Troubleshooting

### Sync Map lookups failing
- Verify `SYNC_SERVICE_SID` is correct
- Ensure deployment is in US1 region
- Check Twilio logs for specific errors

### Calls not routing correctly
- Verify Map entries use correct format (Console uses "Data" wrapper)
- Check E.164 formatting of phone numbers
- Review function logs for routing decisions

### UUI headers not present
- Only SIP routes receive UUI headers
- PSTN and Client routes intentionally exclude UUI

## Contributing

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## License

Private - All rights reserved

## Version

Current version: **0.0.1** - See [CHANGELOG.md](./CHANGELOG.md) for details.
