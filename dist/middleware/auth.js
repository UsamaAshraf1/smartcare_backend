import jwt from 'jsonwebtoken';
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
export function roleMiddleware(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}
export function generateToken(payload) {
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d');
    return jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', {
        expiresIn,
    });
}
// Backward-compatible alias used by some routes.
export const authenticate = authMiddleware;
//# sourceMappingURL=auth.js.map