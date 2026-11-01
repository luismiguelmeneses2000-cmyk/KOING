// Conexión a MongoDB reutilizada entre invocaciones (Vercel serverless)
const { MongoClient, ObjectId } = require('mongodb');

let cached = global._koingMongo;

async function getDb() {
  if (!process.env.MONGODB_URI) throw new Error('Falta la variable MONGODB_URI');
  if (!cached) {
    const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
    cached = global._koingMongo = { client, promise: client.connect(), indexed: false };
  }
  try {
    await cached.promise;
  } catch (e) {
    // Si la conexión falló, no la dejamos guardada: el próximo intento conecta de nuevo
    try { cached.client.close(); } catch (x) {}
    cached = global._koingMongo = null;
    throw e;
  }
  const db = cached.client.db(process.env.MONGODB_DB || 'koing');
  if (!cached.indexed) {
    cached.indexed = true;
    // Índices: se crean una sola vez por instancia (si ya existen no pasa nada)
    Promise.all([
      db.collection('users').createIndex({ email: 1 }, { unique: true }),
      db.collection('perfiles').createIndex({ userId: 1 }, { unique: true }),
      db.collection('movimientos').createIndex({ userId: 1, fecha: -1 }),
      db.collection('deudas').createIndex({ userId: 1 }),
      db.collection('metas').createIndex({ userId: 1, prioridad: 1 }),
      db.collection('ventas').createIndex({ userId: 1, fecha: -1 }),
      db.collection('proveedores').createIndex({ userId: 1, vence: 1 })
    ]).catch(() => { cached.indexed = false; });
  }
  return db;
}

function toId(id) {
  try { return new ObjectId(String(id)); } catch (e) { return null; }
}

module.exports = { getDb, toId, ObjectId };
