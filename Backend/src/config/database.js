/**
 * Conexion a MongoDB Atlas mediante Mongoose.
 * Expone connectDB() y los eventos basicos de la conexion.
 */
import mongoose from 'mongoose';
import env from './env.js';

async function connectDB() {
  if (!env.mongoUri) {
    throw new Error('Falta la variable MONGO_URI en el archivo .env');
  }

  mongoose.connection.on('connected', () => {
    console.log('[db] Conectado a MongoDB Atlas');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[db] Error de conexion:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] Desconectado de MongoDB');
  });

  await mongoose.connect(env.mongoUri, {
    autoIndex: env.nodeEnv !== 'production',
  });

  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

export { connectDB, disconnectDB };
