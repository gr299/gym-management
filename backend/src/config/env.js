import 'dotenv/config';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = process.env.NODE_ENV || 'development';

export const config = {
  env,
  isProd: env === 'production',
  isTest: env === 'test',
  port: Number(process.env.PORT || 5000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gym_ms',
  },
  jwt: {
    get secret() {
      const secret = required('JWT_SECRET');
      if (secret.length < 32 || secret.startsWith('replace_with')) {
        throw new Error('JWT_SECRET must be a random string of at least 32 characters');
      }
      return secret;
    },
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  cookieName: 'gym_token',
};

