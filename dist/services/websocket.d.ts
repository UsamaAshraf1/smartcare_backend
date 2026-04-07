import { WebSocket } from 'ws';
import { Server } from 'http';
export declare function initWebSocket(server: Server): import("ws").Server<typeof WebSocket, typeof import("node:http").IncomingMessage>;
export declare function broadcastTrackingUpdate(orderId: string, data: any): void;
export declare function sendNotification(userId: string, notification: any): void;
//# sourceMappingURL=websocket.d.ts.map