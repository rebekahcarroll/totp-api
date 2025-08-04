// api/lockbox-status.js
// Handles heartbeat and status updates from ESP32 lockboxes

export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    // Only accept POST requests for status updates
    if (req.method !== 'POST') {
      return res.status(405).json({ 
        error: 'Method not allowed', 
        message: 'This endpoint only accepts POST requests' 
      });
    }
    
    // Extract data from request body
    const { lockboxId, status, lockOpen, timestamp } = req.body;
    
    // Validate required fields
    if (!lockboxId) {
      return res.status(400).json({ 
        error: 'Missing required field: lockboxId' 
      });
    }
    
    // Log the heartbeat (in production, you'd save this to a database)
    console.log('Lockbox Heartbeat Received:', {
      lockboxId,
      status: status || 'unknown',
      lockOpen: lockOpen || false,
      timestamp: timestamp || 'not provided',
      receivedAt: new Date().toISOString(),
      clientIP: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    });
    
    // Validate timestamp if provided
    let timestampStatus = 'not provided';
    if (timestamp) {
      const now = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(now - timestamp);
      
      if (timeDiff > 300) { // 5 minutes tolerance
        timestampStatus = `warning: ${timeDiff}s time difference`;
      } else {
        timestampStatus = 'synchronized';
      }
    }
    
    // Prepare response
    const response = {
      success: true,
      message: 'Heartbeat received successfully',
      lockboxId: lockboxId,
      receivedAt: new Date().toISOString(),
      timestampStatus: timestampStatus,
      data: {
        status: status || 'unknown',
        lockOpen: lockOpen || false,
        timestamp: timestamp
      }
    };
    
    // In a production system, you might want to:
    // 1. Store this data in a database
    // 2. Check if this lockbox is authorized
    // 3. Send commands back to the lockbox
    // 4. Trigger notifications for certain events
    
    // For now, just acknowledge receipt
    res.status(200).json(response);
    
  } catch (error) {
    console.error('Lockbox Status Error:', error);
    res.status(500).json({ 
      error: 'Failed to process lockbox status',
      details: error.message 
    });
  }
}
