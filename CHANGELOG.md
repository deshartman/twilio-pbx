# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
