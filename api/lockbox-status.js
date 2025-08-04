// api/lockbox-status.js
// Using global object for free storage (resets on deploy)

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    // Handle POST requests (ESP32 heartbeats)
    if (req.method === 'POST') {
      const { lockboxId, status, lockOpen, timestamp } = req.body;
      
      if (!lockboxId) {
        return res.status(400).json({ 
          error: 'Missing required field: lockboxId' 
        });
      }
      
      // Store in global object (persists during function lifetime)
      if (!global.lockboxData) {
        global.lockboxData = {};
      }
      
      global.lockboxData[lockboxId] = {
        status: status || 'unknown',
        lockOpen: lockOpen || false,
        timestamp: timestamp || Math.floor(Date.now() / 1000),
        lastSeen: Date.now(),
        receivedAt: new Date().toISOString()
      };
      
      return res.status(200).json({
        success: true,
        message: 'Heartbeat received successfully',
        lockboxId: lockboxId
      });
    }
    
    // Handle GET requests
    if (req.method === 'GET') {
      const lockboxId = req.query.lockboxId;
      
      if (!lockboxId) {
        return res.status(400).json({ 
          error: 'Missing lockboxId parameter'
        });
      }
      
      const data = global.lockboxData?.[lockboxId];
      
      if (!data) {
        return res.status(200).json({
          lockboxId: lockboxId,
          isOnline: false,
          status: 'never_connected',
          lockOpen: false,
          lastSeen: null,
          message: 'No heartbeat data available'
        });
      }
      
      const timeSinceLastSeen = Date.now() - data.lastSeen;
      const isOnline = timeSinceLastSeen < 900000; // 15 minutes
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
    
    return res.status(405).json({ 
      error: 'Method not allowed'
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Failed to process request',
      details: error.message 
    });
  }
}
