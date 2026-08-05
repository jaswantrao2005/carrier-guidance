/**
 * HTTP Request Logging Middleware
 * Logs incoming HTTP requests and response performance metrics
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  // Safe body logging (hiding sensitive info)
  let safeBody = { ...req.body };
  const sensitiveKeys = ['password', 'token', 'accessToken', 'refreshToken'];
  sensitiveKeys.forEach(key => {
    if (safeBody[key]) safeBody[key] = '********';
  });

  // Log incoming request
  console.log(`[${timestamp}] 🚀 INCOMING REQUEST: ${req.method} ${req.originalUrl}`);
  if (Object.keys(safeBody).length > 0) {
    console.log(`      Payload: ${JSON.stringify(safeBody)}`);
  }

  // Intercept the response finish event to log completion status and duration
  res.on('finish', () => {
    const duration = Date.now() - start;
    const completedTimestamp = new Date().toISOString();
    const statusColor = res.statusCode >= 500 ? '❌' : res.statusCode >= 400 ? '⚠️' : '✅';
    
    console.log(`[${completedTimestamp}] ${statusColor} COMPLETED: ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${duration}ms)`);
  });

  next();
};

module.exports = requestLogger;
