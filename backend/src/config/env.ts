import 'dotenv/config'

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  pgHost: required('PGHOST', 'localhost'),
  pgPort: Number(process.env.PGPORT ?? 5434),
  pgDatabase: required('PGDATABASE', 'hwalingo'),
  pgUser: required('PGUSER', 'postgres'),
  pgPassword: required('PGPASSWORD', 'postgres'),
  jwtSecret: required('JWT_SECRET'),
  dbSsl: process.env.DB_SSL === 'true',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPassword: process.env.SMTP_PASSWORD ?? '',
  mailFrom: process.env.MAIL_FROM ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-5-mini',
}

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error('PORT must be a valid TCP port')
}

if (!Number.isInteger(env.pgPort) || env.pgPort < 1 || env.pgPort > 65535) {
  throw new Error('PGPORT must be a valid TCP port')
}

if (!Number.isInteger(env.smtpPort) || env.smtpPort < 1 || env.smtpPort > 65535) {
  throw new Error('SMTP_PORT must be a valid TCP port')
}
