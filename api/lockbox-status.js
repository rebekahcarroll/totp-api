// api/lockbox-status.js
// Handles heartbeat and status updates from ESP32 lockboxes
// Stores status in memory and provides on-demand status checks

// In-memory storage for lockbox status (resets on deployment)
let lastStatus = {};

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
    // Handle POST requests (ESP32 heartbeats)
    if (req.method === 'POST') {
      const { lockboxId, status, lockOpen, timestamp } = req.body;
      
      // Validate required fields
      if (!lockboxId) {
        return res.status(400).json({ 
          error: 'Missing required field: lockboxId' 
        });
      }
      
      // Store latest status in memory
      lastStatus[lockboxId] = {
        status: status || 'unknown',
        lockOpen: lockOpen || false,
        timestamp: timestamp || Math.floor(Date.now() / 1000),
        lastSeen: Date.now(),
        receivedAt: new Date().toISOString()
      };
      
      // Log for debugging
      console.log('Heartbeat received from lockbox:', lockboxId, lastStatus[lockboxId]);
      
      return res.status(200).json({
        success: true,
        message: 'Heartbeat received successfully',
        lockboxId: lockboxId
      });
    }
    
    // Handle GET requests (Bubble status checks)
    if (req.method === 'GET') {
      const lockboxId = req.query.lockboxId;
      
      if (!lockboxId) {
        return res.status(400).json({ 
          error: 'Missing lockboxId parameter',
          example: '/api/lockbox-status?lockboxId=0001'
        });
      }
      
      const data = lastStatus[lockboxId];
      
      // If no data exists, lockbox has never connected
      if (!data) {
        return res.status(200).json({
          lockboxId: lockboxId,
          isOnline: false,
          status: 'never_connected',
          lockOpen: false,
          lastSeen: null,
          message: 'No heartbeat data available for this lockbox'
        });
      }
      
      // Check if lockbox is considered online (heartbeat within last 15 minutes)
      const timeSinceLastSeen = Date.now() - data.lastSeen;
      const isOnline = timeSinceLastSeen < 900000; // 15 minutes tolerance
      const minutesAgo = Math.floor(timeSinceLastSeen / 60000);
      
      return res.status(200).json({
        lockboxId: lockboxId,
        isOnline: isOnline,
        status: data.status,
        lockOpen: data.lockOpen,
        timestamp: data.timestamp,
        lastSeen: data.receivedAt,
        minutesAgo: minutesAgo,
        message: isOnline ? 
          `Lockbox is online (last seen ${minutesAgo} minutes ago)` : 
          `Lockbox is offline (last seen ${minutesAgo} minutes ago)`
      });
    }
    
    // Method not allowed
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint accepts GET and POST requests only'
    });
    
  } catch (error) {
    console.error('Lockbox Status Error:', error);
    res.status(500).json({ 
      error: 'Failed to process request',
      details: error.message 
    });
  }
}
