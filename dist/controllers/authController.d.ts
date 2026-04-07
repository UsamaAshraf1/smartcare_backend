import { Request, Response, NextFunction } from 'express';
export declare function register(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function loginEmail(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function requestOtp(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function loginUaePass(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function uaePassCallback(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getMe(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=authController.d.ts.map