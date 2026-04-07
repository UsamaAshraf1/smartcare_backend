import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../middleware/auth.js';

interface TrackedClient {
  ws: WebSocket;
  userId: string;
  subscribedOrders: Set<string>;
}

const clients = new Map<string, TrackedClient>();

export function initWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as AuthPayload;

      const client: TrackedClient = {
        ws,
        userId: decoded.userId,
        subscribedOrders: new Set(),
      };

      clients.set(decoded.userId, client);
      console.log(`🔌 WebSocket connected: ${decoded.userId}`);

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());

          switch (msg.type) {
            case 'subscribe_tracking':
              client.subscribedOrders.add(msg.orderId);
              ws.send(JSON.stringify({ type: 'subscribed', orderId: msg.orderId }));
              break;

            case 'unsubscribe_tracking':
              client.subscribedOrders.delete(msg.orderId);
              break;

            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }));
              break;
          }
        } catch (e) {
          console.error('WebSocket message parse error:', e);
        }
      });

      ws.on('close', () => {
        clients.delete(decoded.userId);
        console.log(`🔌 WebSocket disconnected: ${decoded.userId}`);
      });

      ws.send(JSON.stringify({ type: 'connected', userId: decoded.userId }));
    } catch (error) {
      ws.close(4001, 'Invalid token');
    }
  });

  // Heartbeat
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 30000);

  console.log('🔌 WebSocket server initialized');
  return wss;
}

// Broadcast tracking update to subscribed clients
export function broadcastTrackingUpdate(orderId: string, data: any) {
  clients.forEach((client) => {
    if (client.subscribedOrders.has(orderId) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: 'tracking_update',
        orderId,
        data,
      }));
    }
  });
}

// Send notification to specific user
export function sendNotification(userId: string, notification: any) {
  const client = clients.get(userId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify({
      type: 'notification',
      data: notification,
    }));
  }
}
