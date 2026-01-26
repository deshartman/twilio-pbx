# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2026-01-26

### Changed
- **Eliminated Runtime.getAssets() dependency**: Moved utility functions inline to `callTransfer.ts`
  - Simplifies deployment (no asset copying required for these utilities)
  - Eliminates potential asset loading failures
  - Easier to debug with all code in one file
  - No runtime dependency on build pipeline
- **Enhanced diagnostic logging in callTransfer**: Added comprehensive Sync debugging
  - Environment variable validation logging
  - Sync API call details
  - Full response object inspection
  - Detailed error messages with status codes
- **Improved error handling**: Better 404 vs other error differentiation in Sync lookups

### Fixed
- **Corrected Twilio import pattern**: Removed incorrect `import Twilio from 'twilio'` statements
  - Now using globally available `Twilio` object per Twilio Serverless best practices
  - Compiled output now correctly uses `Twilio.twiml.VoiceResponse()` instead of `twilio_1.default.twiml.VoiceResponse()`
  - Follows official Twilio TypeScript documentation pattern
  - Applied to: callTransfer.ts, callToPSTNwithRefer.ts, callToSIPwithRefer.ts, ringGroup.ts

### Added
- **Jest test framework**: Complete unit, integration, and end-to-end test suite
  - `syncUtils.test.ts`: 15 unit tests for utility functions
  - `syncIntegration.test.ts`: 13 integration tests for Sync API operations
  - `callTransfer.test.ts`: 8 end-to-end tests for complete SIP REFER → Sync routing flow
  - Test coverage for phone extraction, Sync CRUD operations, switch statement routing, TwiML generation, and error handling
- **Test scripts in package.json**:
  - `npm test`: Run all tests
  - `npm run test:watch`: Watch mode for development
  - `npm run test:coverage`: Generate coverage reports
  - `npm run typecheck`: TypeScript type checking (formerly `test`)
- **Test infrastructure**:
  - Jest configuration with ts-jest preset
  - Test setup with `.env.dev` loading
  - Automatic cleanup for integration tests

### Removed
- `src/assets/shared/syncUtils.js`: No longer needed (functions moved inline)
- Runtime.getAssets() dependency in callTransfer function

### Documentation
- Updated README with new testing section
- Added "Debugging Sync Issues" section to README
- Removed "Shared Utilities" section (replaced with "Function Structure")
- Updated test documentation with unit and integration test details

### Fixed
- Potential Sync Map lookup failures due to asset loading issues
- TypeScript configuration now includes Jest types
- **Build output exclusion**: Updated `tsconfig.json` to exclude test files from `dist/` folder
  - Added `src/**/*.test.ts` and `src/**/__tests__` to exclude list
  - Ensures deployment package only contains functions and assets
  - Prevents test files from being deployed to Twilio Serverless

## [0.0.1] - 2026-01-21

### Added
- Initial release of Twilio PBX with Sync integration
- **Twilio Sync Integration**: Dynamic call routing configuration via Sync Maps
  - `setupSync` function for idempotent Sync service and Map creation
  - Production-ready HTML interface with click-to-copy SID functionality
  - Environment variable validation (no default fallbacks)
  - Support for Console and CLI/API data formats

- **Core Routing Functions**:
  - `callTransfer`: Intelligent call transfer with Sync Map lookup
    - Automatic E.164 extraction from SIP URIs
    - Dynamic routing based on Map configuration
    - Support for SIP destinations (with UUI headers)
    - Support for PSTN numbers
    - Support for Twilio Client connections
    - Graceful PSTN fallback for unmapped numbers
  - `callToPSTNwithRefer`: PSTN calling with REFER support
  - `callToSIPwithRefer`: SIP calling with REFER support
  - `ringGroup`: Ring group functionality

- **Shared Utilities** (`src/assets/shared/syncUtils.js`):
  - `extractPhoneFromSipUri()`: Extract E.164 numbers from SIP URIs
  - `fetchNumberConfig()`: Query Sync Maps with error handling

- **Routing Features**:
  - Three routing types: SIP, PSTN, and Twilio Client
  - UUI header preservation for SIP routes only
  - Automatic PSTN fallback when Sync disabled or entry not found
  - E.164 phone number validation

- **Configuration**:
  - Environment-based configuration (`.env.example`)
  - Separate development and production environments
  - US1 region support for Sync compatibility

- **Build System**:
  - TypeScript compilation with type checking
  - Automatic asset copying to dist folder
  - Pre-build hooks for start and deploy commands
  - pnpm workspace configuration

### Documentation
- Comprehensive README with setup instructions
- Sync Map data structure examples
- Console vs CLI format guidelines
- Testing and deployment procedures
- Troubleshooting guide
- Architecture diagrams and flow charts

### Technical Implementation
- TypeScript for type safety
- CommonJS module exports for Twilio Serverless compatibility
- Runtime asset loading via `Runtime.getAssets()`
- Idempotent resource creation patterns
- Graceful error handling and logging
- Zero-downtime configuration updates via Sync

### Testing
- Local development with ngrok integration
- Multiple test scenarios (SIP, PSTN, Client, fallback)
- Integration testing procedures
- Production deployment verification steps

[0.0.1]: https://github.com/your-repo/twilio-pbx/releases/tag/v0.0.1
