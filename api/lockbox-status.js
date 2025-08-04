// api/lockbox-status.js
// Debug version to see what's happening with storage

// In-memory storage for lockbox status
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
      
      // DEBUG: Log everything we receive
      console.log('=== POST REQUEST DEBUG ===');
      console.log('Received lockboxId:', lockboxId);
      console.log('Received status:', status);
      console.log('Received lockOpen:', lockOpen);
      console.log('Received timestamp:', timestamp);
      console.log('Full request body:', req.body);
      
      // Validate required fields
      if (!lockboxId) {
        console.log('ERROR: Missing lockboxId');
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
      
      // DEBUG: Log what we stored
      console.log('Stored in memory:', lastStatus[lockboxId]);
      console.log('Current lastStatus object:', lastStatus);
      console.log('=== END POST DEBUG ===');
      
      return res.status(200).json({
        success: true,
        message: 'Heartbeat received successfully',
        lockboxId: lockboxId,
        debug: {
          storedData: lastStatus[lockboxId],
          allStoredData: lastStatus
        }
      });
    }
    
    // Handle GET requests (Bubble status checks)
    if (req.method === 'GET') {
      const lockboxId = req.query.lockboxId;
      
      // DEBUG: Log GET request
      console.log('=== GET REQUEST DEBUG ===');
      console.log('Requested lockboxId:', lockboxId);
      console.log('Current lastStatus object:', lastStatus);
      console.log('Data for this lockbox:', lastStatus[lockboxId]);
      
      if (!lockboxId) {
        return res.status(400).json({ 
          error: 'Missing lockboxId parameter',
          example: '/api/lockbox-status?lockboxId=0001'
        });
      }
      
      const data = lastStatus[lockboxId];
      
      // DEBUG: More logging
      console.log('Found data:', data);
      console.log('Data exists?', !!data);
      
      // If no data exists, lockbox has never connected
      if (!data) {
        console.log('No data found for lockbox:', lockboxId);
        console.log('=== END GET DEBUG ===');
        return res.status(200).json({
          lockboxId: lockboxId,
          isOnline: false,
          status: 'never_connected',
          lockOpen: false,
          lastSeen: null,
          message: 'No heartbeat data available for this lockbox',
          debug: {
            allStoredData: lastStatus,
            requestedId: lockboxId
          }
        });
      }
      
      // Check if lockbox is considered online
      const timeSinceLastSeen = Date.now() - data.lastSeen;
      const isOnline = timeSinceLastSeen < 900000; // 15 minutes
      const minutesAgo = Math.floor(timeSinceLastSeen / 60000);
      
      console.log('Time since last seen:', timeSinceLastSeen, 'ms');
      console.log('Minutes ago:', minutesAgo);
      console.log('Is online?', isOnline);
      console.log('=== END GET DEBUG ===');
      
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
          `Lockbox is offline (last seen ${minutesAgo} minutes ago)`,
        debug: {
          timeSinceLastSeen: timeSinceLastSeen,
          threshold: 900000,
          storedData: data
        }
      });
    }
    
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
