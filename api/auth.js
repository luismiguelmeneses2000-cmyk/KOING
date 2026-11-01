// POST /api/auth?action=register  { nombre, email, password }
// POST /api/auth?action=login     { email, password }
const bcrypt = require('bcryptjs');
const { getDb } = require('../lib/db');
const { sign } = require('../lib/auth');
const { str } = require('../lib/util');

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const db = await getDb();
    const users = db.collection('users');
    const b = req.body || {};
    const email = str(b.email, 120).toLowerCase();
    const password = String(b.password || '');
    const action = req.query.action;

    if (!emailOk(email)) return res.status(400).json({ error: 'Revisa el correo' });

    if (action === 'register') {
      if (password.length < 6) return res.status(400).json({ error: 'La clave debe tener al menos 6 caracteres' });
      if (await users.findOne({ email })) return res.status(409).json({ error: 'Ese correo ya tiene cuenta. Inicia sesión.' });
      const user = { email, nombre: str(b.nombre, 40), passHash: await bcrypt.hash(password, 10), createdAt: new Date() };
      const r = await users.insertOne(user);
      user._id = r.insertedId;
      return res.status(201).json({ token: sign(user), user: { id: String(user._id), email, nombre: user.nombre } });
    }

    if (action === 'login') {
      const user = await users.findOne({ email });
      if (!user || !(await bcrypt.compare(password, user.passHash))) {
        return res.status(401).json({ error: 'Correo o clave incorrectos' });
      }
      return res.json({ token: sign(user), user: { id: String(user._id), email, nombre: user.nombre } });
    }

    return res.status(400).json({ error: 'Acción no válida' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};
