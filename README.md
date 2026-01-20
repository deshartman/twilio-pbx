# Twilio PBX

A modern IP PBX implementation using Twilio Voice with registered SIP endpoints and Twilio Sync for dynamic call routing configuration.

## Overview

This project provides a flexible PBX system that integrates Twilio Voice with SIP endpoints, enabling dynamic call routing, ring groups, and call transfers. Configuration is managed through Twilio Sync Maps, allowing real-time routing changes without redeployment.

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

## Available Functions

### `/setupSync`
Idempotently creates Sync service and Map. Returns an HTML interface with setup details.

**Environment Variables**:
- `SYNC_SERVICE_NAME`
- `SYNC_MAP_PHONES_NAME`

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
Implements ring group functionality for simultaneous/sequential ringing.

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

### Shared Utilities

**Location**: `src/assets/shared/syncUtils.js`

- `extractPhoneFromSipUri(sipUri)`: Extracts E.164 number from SIP URI
- `fetchNumberConfig(restClient, serviceSid, mapName, phoneNumber)`: Queries Sync Map

These utilities are loaded at runtime using `Runtime.getAssets()`.

## Testing

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
