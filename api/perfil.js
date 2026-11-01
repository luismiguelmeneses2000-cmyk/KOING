// GET    /api/perfil  → todo lo del usuario (perfil, deudas, metas, movimientos)
// PUT    /api/perfil  { perfil, deudas?, metas? }  → guarda perfil (y al terminar las preguntas, carga deudas y metas)
// DELETE /api/perfil  → borra la cuenta y todos sus datos
const { getDb, toId } = require('../lib/db');
const { requireUser } = require('../lib/auth');
const { cleanPerfil, cleanDeuda, cleanMeta } = require('../lib/util');

const pub = (doc) => { if (!doc) return doc; const { _id, userId, ...rest } = doc; return { id: String(_id), ...rest }; };

module.exports = async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const db = await getDb();

    if (req.method === 'GET') {
      // Movimientos de los últimos ~13 meses
      const desde = new Date(); desde.setMonth(desde.getMonth() - 13);
      const desdeStr = desde.toISOString().slice(0, 10);
      const [user, perfil, deudas, metas, movimientos] = await Promise.all([
        db.collection('users').findOne({ _id: toId(userId) }, { projection: { passHash: 0 } }),
        db.collection('perfiles').findOne({ userId }),
        db.collection('deudas').find({ userId }).toArray(),
        db.collection('metas').find({ userId }).sort({ prioridad: 1 }).toArray(),
        db.collection('movimientos').find({ userId, fecha: { $gte: desdeStr } }).sort({ fecha: -1, _id: -1 }).toArray()
      ]);
      if (!user) return res.status(401).json({ error: 'Cuenta no encontrada' });
      return res.json({
        user: { id: userId, email: user.email, nombre: user.nombre },
        perfil: perfil ? pub(perfil) : null,
        deudas: deudas.map(pub),
        metas: metas.map(pub),
        movimientos: movimientos.map(pub)
      });
    }

    if (req.method === 'PUT') {
      const b = req.body || {};
      const perfil = cleanPerfil(b.perfil || {});
      await db.collection('perfiles').updateOne(
        { userId },
        { $set: { ...perfil, userId, updatedAt: new Date() } },
        { upsert: true }
      );
      if (Array.isArray(b.deudas) && b.deudas.length) {
        await db.collection('deudas').insertMany(b.deudas.slice(0, 30).map((d) => ({ ...cleanDeuda(d), userId, createdAt: new Date() })));
      }
      if (Array.isArray(b.metas) && b.metas.length) {
        await db.collection('metas').insertMany(b.metas.slice(0, 30).map((m, i) => ({ ...cleanMeta({ ...m, prioridad: i }), userId, createdAt: new Date() })));
      }
      return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
      await Promise.all(['perfiles', 'deudas', 'metas', 'movimientos'].map((c) => db.collection(c).deleteMany({ userId })));
      await db.collection('users').deleteOne({ _id: toId(userId) });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};
