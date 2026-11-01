// CRUD de movimientos, deudas y metas del usuario
//   POST   /api/items?col=movimientos            crea (si es "A crédito" crea también la deuda)
//   POST   /api/items?col=deudas&action=pagar&id  registra el pago de una cuota
//   POST   /api/items?col=metas&action=reordenar  { ids: [...] }
//   PUT    /api/items?col=...&id=...             actualiza
//   DELETE /api/items?col=...&id=...             borra (y revierte efectos de pagos/ahorros)
const { getDb, toId } = require('../lib/db');
const { requireUser } = require('../lib/auth');
const { cleanDeuda, cleanMovimiento, cleanMeta, num, int, oneOf, date, nextDate } = require('../lib/util');

const CLEAN = { movimientos: cleanMovimiento, deudas: cleanDeuda, metas: cleanMeta };
const pub = (doc) => { if (!doc) return doc; const { _id, userId, ...rest } = doc; return { id: String(_id), ...rest }; };

const r2 = (n) => Math.round(n * 100) / 100;

module.exports = async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const col = req.query.col;
  if (!CLEAN[col]) return res.status(400).json({ error: 'Colección no válida' });

  try {
    const db = await getDb();
    const C = db.collection(col);
    const b = req.body || {};
    const action = req.query.action;
    const id = req.query.id ? toId(req.query.id) : null;

    // ---------- Pagar una cuota ----------
    if (req.method === 'POST' && col === 'deudas' && action === 'pagar') {
      const deuda = id && await C.findOne({ _id: id, userId });
      if (!deuda) return res.status(404).json({ error: 'Deuda no encontrada' });
      const monto = num(b.monto, deuda.cuota) || deuda.cuota;
      const prev = { proximoPago: deuda.proximoPago, cuotasPagadas: deuda.cuotasPagadas, saldo: deuda.saldo, activa: deuda.activa };
      const upd = {
        cuotasPagadas: (deuda.cuotasPagadas || 0) + 1,
        proximoPago: nextDate(deuda.proximoPago, deuda.frecuencia),
        saldo: deuda.saldo === null || deuda.saldo === undefined ? null : Math.max(0, r2(deuda.saldo - monto))
      };
      upd.activa = !((deuda.cuotasTotal && upd.cuotasPagadas >= deuda.cuotasTotal) || (upd.saldo !== null && upd.saldo <= 0));
      await C.updateOne({ _id: id }, { $set: upd });
      const mov = {
        ...cleanMovimiento({ tipo: 'pago', monto, descripcion: deuda.nombre, categoria: 'Otros', metodo: b.metodo, fecha: b.fecha, deudaId: String(id) }),
        prev, userId, createdAt: new Date()
      };
      const r = await db.collection('movimientos').insertOne(mov);
      return res.status(201).json({ deuda: pub({ ...deuda, ...upd }), movimiento: pub({ ...mov, _id: r.insertedId }) });
    }

    // ---------- Reordenar metas ----------
    if (req.method === 'POST' && col === 'metas' && action === 'reordenar') {
      const ids = Array.isArray(b.ids) ? b.ids.slice(0, 100) : [];
      await Promise.all(ids.map((x, i) => { const oid = toId(x); return oid ? C.updateOne({ _id: oid, userId }, { $set: { prioridad: i } }) : null; }));
      return res.json({ ok: true });
    }

    // ---------- Crear ----------
    if (req.method === 'POST') {
      const doc = { ...CLEAN[col](b), userId, createdAt: new Date() };
      let deuda = null, meta = null;

      if (col === 'movimientos' && doc.tipo === 'gasto' && doc.metodo === 'credito' && b.credito) {
        const cuotas = Math.max(1, int(b.credito.cuotas, 1));
        const frecuencia = oneOf(b.credito.frecuencia, ['semanal', 'quincenal', 'mensual'], 'quincenal');
        deuda = {
          ...cleanDeuda({
            nombre: doc.descripcion || doc.categoria, tipo: 'cuotas', frecuencia,
            cuota: r2(doc.monto / cuotas), cuotasTotal: cuotas, cuotasPagadas: 0,
            saldo: doc.monto, proximoPago: date(b.credito.primerPago)
          }),
          userId, createdAt: new Date()
        };
        const rd = await db.collection('deudas').insertOne(deuda);
        deuda._id = rd.insertedId;
        doc.deudaId = String(rd.insertedId);
        doc.creaDeuda = true;
      }

      if (col === 'movimientos' && doc.tipo === 'ahorro' && doc.metaId) {
        const mid = toId(doc.metaId);
        const m = mid && await db.collection('metas').findOne({ _id: mid, userId });
        if (m) {
          await db.collection('metas').updateOne({ _id: mid }, { $inc: { apartado: doc.monto } });
          meta = { ...m, apartado: r2((m.apartado || 0) + doc.monto) };
          if (!doc.descripcion) doc.descripcion = 'Apartado · ' + m.nombre;
        }
      }

      if (col === 'metas' && b.prioridad === undefined) {
        doc.prioridad = await C.countDocuments({ userId });
      }

      const r = await C.insertOne(doc);
      return res.status(201).json({ item: pub({ ...doc, _id: r.insertedId }), deuda: deuda && pub(deuda), meta: meta && pub(meta) });
    }

    // ---------- Actualizar ----------
    if (req.method === 'PUT') {
      const old = id && await C.findOne({ _id: id, userId });
      if (!old) return res.status(404).json({ error: 'No encontrado' });
      const merged = CLEAN[col]({ ...old, ...b });
      await C.updateOne({ _id: id }, { $set: { ...merged, updatedAt: new Date() } });
      return res.json({ item: pub({ ...old, ...merged }) });
    }

    // ---------- Borrar ----------
    if (req.method === 'DELETE') {
      const old = id && await C.findOne({ _id: id, userId });
      if (!old) return res.status(404).json({ error: 'No encontrado' });
      await C.deleteOne({ _id: id });
      let deuda = null, meta = null, deudaBorrada = null;

      if (col === 'movimientos' && old.tipo === 'pago' && old.deudaId && old.prev) {
        const did = toId(old.deudaId);
        await db.collection('deudas').updateOne({ _id: did, userId }, { $set: old.prev });
        deuda = pub(await db.collection('deudas').findOne({ _id: did, userId }));
      }
      if (col === 'movimientos' && old.creaDeuda && old.deudaId) {
        await db.collection('deudas').deleteOne({ _id: toId(old.deudaId), userId });
        deudaBorrada = old.deudaId;
      }
      if (col === 'movimientos' && old.tipo === 'ahorro' && old.metaId) {
        const mid = toId(old.metaId);
        await db.collection('metas').updateOne({ _id: mid, userId }, { $inc: { apartado: -old.monto } });
        meta = pub(await db.collection('metas').findOne({ _id: mid, userId }));
      }
      if (col === 'deudas') {
        // Los pagos ya hechos se quedan en el historial, solo se desvinculan
        await db.collection('movimientos').updateMany({ userId, deudaId: String(id) }, { $set: { deudaId: null, creaDeuda: false } });
      }
      return res.json({ ok: true, deuda, meta, deudaBorrada });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};
