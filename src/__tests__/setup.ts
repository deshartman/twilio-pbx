import * as dotenv from 'dotenv';
import * as path from 'path';
import Twilio from 'twilio';

// Load environment variables from .env.dev
const envPath = path.resolve(__dirname, '../../.env.dev');
const result = dotenv.config({ path: envPath });

// Make Twilio available globally (as it is in Twilio serverless environment)
(global as any).Twilio = Twilio;

if (result.error) {
  console.error(`❌ Failed to load .env.dev from ${envPath}`);
  console.error(`   Error: ${result.error.message}`);
  console.error(`   Integration tests will fail without proper environment configuration.`);
} else {
  console.log(`✓ Loaded environment from ${envPath}`);
}

// Verify required environment variables are set
const requiredEnvVars = ['ACCOUNT_SID', 'AUTH_TOKEN', 'SYNC_SERVICE_SID', 'SYNC_MAP_PHONES_NAME'];
const missingVars: string[] = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingVars.push(envVar);
  }
}

if (missingVars.length > 0) {
  console.warn(`\n⚠️  Warning: Missing required environment variables in .env.dev:`);
  missingVars.forEach(varName => {
    console.warn(`   - ${varName}`);
  });
  console.warn(`\n   Integration tests will fail without these variables.`);
  console.warn(`   Please ensure your .env.dev file contains all required values.\n`);
} else {
  console.log(`✓ All required environment variables are set`);
}
