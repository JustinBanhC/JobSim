const SUPABASE_CONFIGURED = Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);

export default function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    if (!SUPABASE_CONFIGURED) {
      console.warn('[auth] No Bearer token — Supabase not configured, dev bypass active');
      req.userId = 'dev-local-user';
      return next();
    }
    return res.status(401).json({ error: 'Authorization header required' });
  }

  req.userId = 'dev-local-user';
  next();
}
