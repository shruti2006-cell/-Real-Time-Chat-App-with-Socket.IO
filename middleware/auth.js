const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWT_SECRET || 'secret';

function verifySocketToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, jwtSecret, (err, payload) => {
      if (err) return reject(err);
      resolve(payload);
    });
  });
}

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  jwt.verify(token, jwtSecret, (err, payload) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    req.user = payload;
    next();
  });
}

module.exports = {
  auth,
  verifySocketToken,
};
