import { Request, Response, NextFunction } from 'express';
export declare function createOrder(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getOrders(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getOrderById(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function processPayment(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=orderController.d.ts.map