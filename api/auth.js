// POST /api/auth?action=register  { nombre, email, password }
// POST /api/auth?action=login     { email, password }
// POST /api/auth?action=forgot    { email }            → manda un enlace por correo
// POST /api/auth?action=reset     { token, password }  → cambia la clave con ese enlace
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { getDb } = require('../lib/db');
const { sign } = require('../lib/auth');
const { str } = require('../lib/util');

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

async function enviarCorreo(to, link, nombre) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) throw new Error('Faltan GMAIL_USER / GMAIL_APP_PASSWORD');
  const t = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') } });
  await t.sendMail({
    from: `KOING <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Crea tu nueva clave de KOING',
    text: `Hola${nombre ? ' ' + nombre : ''},\n\nPara crear una nueva clave entra aquí (vence en 30 minutos):\n${link}\n\nSi no lo pediste, ignora este correo: tu clave sigue igual.\n\nKOING`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#2E3424">
      <h2 style="color:#4A5634">Crea tu nueva clave</h2>
      <p>Hola${nombre ? ' ' + nombre : ''}, toca el botón para elegir una clave nueva. El enlace vence en <b>30 minutos</b>.</p>
      <p style="margin:28px 0"><a href="${link}" style="background:#68754E;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Crear nueva clave</a></p>
      <p style="color:#5E6450;font-size:13px">Si no lo pediste, ignora este correo: tu clave sigue igual.</p></div>`
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const db = await getDb();
    const users = db.collection('users');
    const b = req.body || {};
    const email = str(b.email, 120).toLowerCase();
    const password = String(b.password || '');
    const action = req.query.action;

    if (action === 'reset') {
      const token = String(b.token || '');
      if (password.length < 6) return res.status(400).json({ error: 'La clave debe tener al menos 6 caracteres' });
      const user = token && await users.findOne({ resetHash: sha(token) });
      if (!user || !user.resetVence || new Date(user.resetVence) < new Date()) {
        return res.status(400).json({ error: 'El enlace venció o ya se usó. Pide uno nuevo.' });
      }
      await users.updateOne({ _id: user._id }, { $set: { passHash: await bcrypt.hash(password, 10), resetHash: null, resetVence: null } });
      return res.json({ token: sign(user), user: { id: String(user._id), email: user.email, nombre: user.nombre } });
    }

    if (!emailOk(email)) return res.status(400).json({ error: 'Revisa el correo' });

    if (action === 'forgot') {
      const user = await users.findOne({ email });
      // Respondemos igual exista o no la cuenta, para no revelar qué correos están registrados
      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        await users.updateOne({ _id: user._id }, { $set: { resetHash: sha(token), resetVence: new Date(Date.now() + 30 * 60 * 1000) } });
        const base = process.env.APP_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
        try { await enviarCorreo(email, `${base.replace(/\/$/, '')}/?reset=${token}`, user.nombre); }
        catch (e) { console.error('Correo:', e.message); return res.status(500).json({ error: 'No pude enviar el correo. Intenta más tarde.' }); }
      }
      return res.json({ ok: true });
    }

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
