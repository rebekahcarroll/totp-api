// api/generate-totp.js
// This matches your ESP32 TOTP algorithm exactly

const crypto = require('crypto');

// Base32 decode function (matches ESP32 code)
function base32Decode(encoded) {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const decoded = [];
  let buffer = 0;
  let bitsLeft = 0;
  
  for (let i = 0; i < encoded.length; i++) {
    const c = encoded[i];
    if (c === '=') break; // Padding
    
    const val = base32Chars.indexOf(c);
    if (val === -1) continue; // Skip invalid characters
    
    buffer = (buffer << 5) | val;
    bitsLeft += 5;
    
    if (bitsLeft >= 8) {
      decoded.push((buffer >> (bitsLeft - 8)) & 0xFF);
      bitsLeft -= 8;
    }
  }
  
  return Buffer.from(decoded);
}

// Generate TOTP (matches ESP32 algorithm exactly)
function generateTOTP(secretKey, timestamp = null) {
  const timeStep = 60; // 60 seconds (matches ESP32)
  const digits = 4;    // 4 digits (matches ESP32)
  
  // Use current time if not provided
  if (!timestamp) {
    timestamp = Math.floor(Date.now() / 1000);
  }
  
  // Decode the secret key
  const decodedSecret = base32Decode(secretKey);
  
  // Calculate time counter (T)
  const T = Math.floor(timestamp / timeStep);
  
  // Convert T to big-endian byte array
  const timeBytes = Buffer.alloc(8);
  timeBytes.writeBigUInt64BE(BigInt(T));
  
  // Generate HMAC-SHA1
  const hmac = crypto.createHmac('sha1', decodedSecret);
  hmac.update(timeBytes);
  const hmacResult = hmac.digest();
  
  // Dynamic truncation
  const offset = hmacResult[19] & 0x0F;
  const code = ((hmacResult[offset] & 0x7F) << 24) |
               ((hmacResult[offset + 1] & 0xFF) << 16) |
               ((hmacResult[offset + 2] & 0xFF) << 8) |
               (hmacResult[offset + 3] & 0xFF);
  
  // Return 4-digit code with leading zeros
  return String(code % 10000).padStart(4, '0');
}

// API endpoint handler
module.exports = function handler(req, res) {
  // Set CORS headers for Glide
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    // Get parameters from request
    const { secretKey, boxId, timestamp } = req.method === 'POST' ? req.body : req.query;
    
    // Validate input
    if (!secretKey) {
      return res.status(400).json({ 
        error: 'Missing secretKey parameter',
        example: 'Add ?secretKey=JBSWY3DPEHPK3PXP&boxId=box001 to the URL'
      });
    }
    
    // Generate TOTP code
    const totpCode = generateTOTP(secretKey, timestamp ? parseInt(timestamp) : null);
    
    // Calculate time remaining for this code
    const now = Math.floor(Date.now() / 1000);
    const secondsInMinute = now % 60;
    const timeRemaining = 60 - secondsInMinute;
    
    // Return response
    res.status(200).json({
      success: true,
      boxId: boxId || 'unknown',
      totpCode: totpCode,
      timeRemaining: timeRemaining,
      validUntil: new Date((now + timeRemaining) * 1000).toISOString(),
      timestamp: now,
      message: `TOTP code ${totpCode} is valid for ${timeRemaining} more seconds`
    });
    
  } catch (error) {
    console.error('TOTP Generation Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate TOTP code',
      details: error.message 
    });
  }
};
