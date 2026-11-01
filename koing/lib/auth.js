// JWT: firmar, verificar y proteger endpoints
const jwt = require('jsonwebtoken');

const SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error('Falta la variable JWT_SECRET');
  return process.env.JWT_SECRET;
};

function sign(user) {
  return jwt.sign({ sub: String(user._id), email: user.email }, SECRET(), { expiresIn: '60d' });
}

// Devuelve el userId (string) o responde 401 y devuelve null
function requireUser(req, res) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'No has iniciado sesión' }); return null; }
  try {
    const p = jwt.verify(token, SECRET());
    return p.sub;
  } catch (e) {
    res.status(401).json({ error: 'Tu sesión venció, entra de nuevo' });
    return null;
  }
}

module.exports = { sign, requireUser };
