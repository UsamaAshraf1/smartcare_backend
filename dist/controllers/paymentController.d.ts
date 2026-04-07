import { Request, Response, NextFunction } from 'express';
export declare function createSetupIntent(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function listPaymentMethods(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function savePaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deletePaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function setDefaultMethod(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=paymentController.d.ts.map