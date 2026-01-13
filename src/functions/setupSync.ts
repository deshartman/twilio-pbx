import '@twilio-labs/serverless-runtime-types';
import { Context, ServerlessCallback, ServerlessFunctionSignature } from '@twilio-labs/serverless-runtime-types/types';

export interface ServerlessEnvironment {
  ACCOUNT_SID: string;
  AUTH_TOKEN: string;
  SYNC_SERVICE_NAME?: string;
  SYNC_MAP_PHONES_NAME?: string;
  [key: string]: string | undefined;
}

export interface SetupSyncEvent {
  request: {
    cookies: {};
    headers: {};
  };
  [key: string]: any;
}

/**
 * Setup Sync Service and numberConfig Map
 *
 * This function creates a Sync service and Map idempotently. It checks for existing
 * resources before creating new ones, making it safe to run multiple times.
 *
 * After running this function, copy the SYNC_SERVICE_SID from the response
 * and add it to your .env files.
 *
 * Environment Variables Required:
 * - ACCOUNT_SID: Twilio Account SID
 * - AUTH_TOKEN: Twilio Auth Token
 * - SYNC_SERVICE_NAME: Friendly name for the Sync service (e.g., "pbx-routing")
 * - SYNC_MAP_PHONES_NAME: Name for the phone number Map (e.g., "numberConfig")
 */
export const handler: ServerlessFunctionSignature<ServerlessEnvironment, SetupSyncEvent> = async (
  context: Context<ServerlessEnvironment>,
  event: SetupSyncEvent,
  callback: ServerlessCallback
) => {
  const response = new (Response as any)();
  response.appendHeader('Content-Type', 'text/html');
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');

  const serviceName = context.SYNC_SERVICE_NAME;
  const mapName = context.SYNC_MAP_PHONES_NAME;

  // Validate required environment variables
  if (!serviceName || !mapName) {
    const errorMsg = 'Missing required environment variables: SYNC_SERVICE_NAME and/or SYNC_MAP_PHONES_NAME must be configured';
    console.error(`setupSync: ${errorMsg}`);
    response.setStatusCode(400);
    response.setBody(errorMsg);
    return callback(null, response);
  }

  try {
    const client = context.getTwilioClient();
    let serviceSid: string;
    let serviceCreated = false;

    // Step 1: Check if Sync service already exists
    console.log(`setupSync: Checking for existing Sync service: ${serviceName}`);

    try {
      const services = await client.sync.v1.services.list({ limit: 100 });
      const existingService = services.find(s => s.friendlyName === serviceName);

      if (existingService) {
        serviceSid = existingService.sid;
        console.log(`setupSync: Found existing Sync service: ${serviceSid}`);
      } else {
        // Create new service
        console.log(`setupSync: Creating new Sync service: ${serviceName}`);
        const newService = await client.sync.v1.services.create({
          friendlyName: serviceName
        });
        serviceSid = newService.sid;
        serviceCreated = true;
        console.log(`setupSync: Created Sync service: ${serviceSid}`);
      }
    } catch (error) {
      console.error(`setupSync: Error checking/creating Sync service: ${error instanceof Error ? error.message : error}`);
      throw error;
    }

    // Step 2: Check if Map already exists
    console.log(`setupSync: Checking for existing Map: ${mapName}`);
    let mapSid: string;
    let mapCreated = false;

    try {
      const existingMap = await client.sync.v1
        .services(serviceSid)
        .syncMaps(mapName)
        .fetch();

      mapSid = existingMap.sid;
      console.log(`setupSync: Found existing Map: ${mapSid}`);
    } catch (error: any) {
      if (error.status === 404) {
        // Map doesn't exist, create it
        console.log(`setupSync: Creating new Map: ${mapName}`);
        const newMap = await client.sync.v1
          .services(serviceSid)
          .syncMaps.create({
            uniqueName: mapName
          });
        mapSid = newMap.sid;
        mapCreated = true;
        console.log(`setupSync: Created Map: ${mapSid}`);
      } else {
        console.error(`setupSync: Error checking Map: ${error.message}`);
        throw error;
      }
    }

    // Return success response with HTML
    console.log('setupSync: Success', JSON.stringify({
      serviceSid,
      serviceName,
      serviceCreated,
      mapSid,
      mapName,
      mapCreated
    }, null, 2));

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sync Setup Complete</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 600px;
      width: 100%;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #2d3748;
      font-size: 24px;
      margin-bottom: 8px;
    }
    .checkmark {
      color: #48bb78;
      font-size: 48px;
      margin-bottom: 10px;
    }
    .section {
      background: #f7fafc;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      border-left: 4px solid #667eea;
    }
    .section-title {
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 12px;
      font-size: 16px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
    }
    .label {
      color: #4a5568;
      font-size: 14px;
    }
    .value {
      color: #2d3748;
      font-weight: 500;
      font-family: "Monaco", "Courier New", monospace;
      font-size: 13px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;
    }
    .value:hover {
      background: #e2e8f0;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-created {
      background: #c6f6d5;
      color: #22543d;
    }
    .badge-exists {
      background: #bee3f8;
      color: #2c5282;
    }
    .next-steps {
      background: #fffaf0;
      border-left: 4px solid #ed8936;
      border-radius: 8px;
      padding: 20px;
      margin-top: 20px;
    }
    .next-steps-title {
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 12px;
      font-size: 16px;
    }
    .next-steps ol {
      margin-left: 20px;
      color: #4a5568;
      line-height: 1.8;
    }
    .next-steps code {
      background: #2d3748;
      color: #48bb78;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
      font-family: "Monaco", "Courier New", monospace;
    }
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #2d3748;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      opacity: 0;
      transition: opacity 0.3s;
      z-index: 1000;
    }
    .toast.show {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="checkmark">✓</div>
      <h1>Sync Services Setup Complete</h1>
    </div>

    <div class="section">
      <div class="section-title">Sync Service</div>
      <div class="info-row">
        <span class="label">Service Name:</span>
        <span class="value">${serviceName}</span>
      </div>
      <div class="info-row">
        <span class="label">Service SID:</span>
        <span class="value" onclick="copyToClipboard('${serviceSid}')" title="Click to copy">${serviceSid}</span>
      </div>
      <div class="info-row">
        <span class="label">Status:</span>
        <span class="badge ${serviceCreated ? 'badge-created' : 'badge-exists'}">${serviceCreated ? 'created' : 'exists'}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Phone Number Routing Map</div>
      <div class="info-row">
        <span class="label">Map Name:</span>
        <span class="value">${mapName}</span>
      </div>
      <div class="info-row">
        <span class="label">Map SID:</span>
        <span class="value" onclick="copyToClipboard('${mapSid}')" title="Click to copy">${mapSid}</span>
      </div>
      <div class="info-row">
        <span class="label">Status:</span>
        <span class="badge ${mapCreated ? 'badge-created' : 'badge-exists'}">${mapCreated ? 'created' : 'exists'}</span>
      </div>
    </div>

    <div class="next-steps">
      <div class="next-steps-title">Next Steps</div>
      <ol>
        <li>Add <code>SYNC_SERVICE_SID=${serviceSid}</code> to your .env files</li>
        <li>Verify <code>SYNC_MAP_PHONES_NAME=${mapName}</code> is configured</li>
        <li>Populate the Map with phone number routing configurations</li>
      </ol>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    function copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard: ' + text);
      }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy to clipboard');
      });
    }

    function showToast(message) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 2000);
    }
  </script>
</body>
</html>
    `;

    response.setStatusCode(200);
    response.setBody(html);
    return callback(null, response);

  } catch (error) {
    console.error(`setupSync: Fatal error: ${error instanceof Error ? error.message : error}`);
    if (error instanceof Error && error.stack) {
      console.error(`Stack trace: ${error.stack}`);
    }

    const errorMsg = `Failed to setup Sync service and Map: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
    response.setStatusCode(500);
    response.setBody(errorMsg);
    return callback(null, response);
  }
};
