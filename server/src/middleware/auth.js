const jwt = require('jsonwebtoken');

/**
 * Middleware: verify JWT access token from Authorization header.
 * Sets req.userId on success.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, data: null, error: 'No access token provided' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, data: null, error: 'Access token expired' });
    }
    return res.status(401).json({ success: false, data: null, error: 'Invalid access token' });
  }
}

module.exports = { authenticate };
