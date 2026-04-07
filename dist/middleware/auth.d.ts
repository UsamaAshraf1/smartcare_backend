import { Request, Response, NextFunction } from 'express';
export interface AuthPayload {
    userId: string;
    email: string;
    role: string;
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): void;
export declare function roleMiddleware(...allowedRoles: string[]): (req: Request, res: Response, next: NextFunction) => void;
export declare function generateToken(payload: AuthPayload): string;
export declare const authenticate: typeof authMiddleware;
//# sourceMappingURL=auth.d.ts.map