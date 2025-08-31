// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

exports.requireAuth = (req, res, next) => {
  try {
    let auth = req.headers.authorization || '';
    let token = '';

    if (auth.startsWith('Bearer ')) {
      token = auth.slice(7);
    } else {
      token = auth; // allow raw token (useful for tests)
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err || !decoded?.id) {
        return res.status(403).json({ error: 'Invalid token' });
      }
      req.userId = decoded.id;
      next();
    });
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
