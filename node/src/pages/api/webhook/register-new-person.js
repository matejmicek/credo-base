export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests' 
    });
  }

  try {
    console.log('=== WEBHOOK: register-new-person ===');
    console.log('Timestamp:', new Date().toISOString());
    
    // Log request headers
    console.log('\n--- REQUEST HEADERS ---');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
    // Log the raw body
    console.log('\n--- RAW BODY ---');
    console.log('Body type:', typeof req.body);
    console.log('Body:', req.body);
    
    // Log stringified version for better visibility
    console.log('\n--- STRINGIFIED BODY ---');
    console.log('Body (stringified):', JSON.stringify(req.body, null, 2));
    
    // Log individual properties if it's an object
    if (req.body && typeof req.body === 'object') {
      console.log('\n--- BODY PROPERTIES ---');
      const keys = Object.keys(req.body);
      console.log('Number of properties:', keys.length);
      console.log('Property names:', keys);
      
      keys.forEach(key => {
        const value = req.body[key];
        console.log(`\n${key}:`);
        console.log('  Type:', typeof value);
        console.log('  Value:', value);
        
        // If it's an object or array, log more details
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            console.log('  Array length:', value.length);
            console.log('  Array items:', JSON.stringify(value, null, 2));
          } else {
            console.log('  Object keys:', Object.keys(value));
            console.log('  Object:', JSON.stringify(value, null, 2));
          }
        }
      });
    }
    
    // Log query parameters if any
    console.log('\n--- QUERY PARAMETERS ---');
    console.log('Query:', JSON.stringify(req.query, null, 2));
    
    // Log content type and other useful headers
    console.log('\n--- USEFUL HEADERS ---');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Content-Length:', req.headers['content-length']);
    console.log('User-Agent:', req.headers['user-agent']);
    console.log('Authorization:', req.headers['authorization'] ? '[PRESENT]' : '[NOT PRESENT]');
    
    console.log('\n=== END WEBHOOK LOG ===\n');

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Webhook received successfully',
      timestamp: new Date().toISOString(),
      receivedData: {
        bodyType: typeof req.body,
        hasBody: !!req.body,
        bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : null,
        queryParams: Object.keys(req.query).length > 0 ? req.query : null,
        contentType: req.headers['content-type']
      }
    });

  } catch (error) {
    console.error('=== WEBHOOK ERROR ===');
    console.error('Error processing webhook:', error);
    console.error('Error stack:', error.stack);
    console.error('=== END ERROR ===');
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process webhook request'
    });
  }
}
