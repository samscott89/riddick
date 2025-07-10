import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Miniflare } from 'miniflare';
import worker from './index';

describe('Worker', () => {
  let mf: Miniflare;

  beforeEach(() => {
    mf = new Miniflare({
      modules: true,
      script: `
        export default {
          async fetch(request, env, ctx) {
            const url = new URL(request.url);
            
            if (url.pathname === '/health' && request.method === 'GET') {
              return new Response(
                JSON.stringify({
                  status: 'ok',
                  timestamp: new Date().toISOString()
                }),
                {
                  status: 200,
                  headers: {
                    'Content-Type': 'application/json'
                  }
                }
              );
            }
            
            return new Response('Not Found', { status: 404 });
          }
        }
      `
    });
  });

  afterEach(() => {
    mf.dispose();
  });

  describe('GET /health', () => {
    it('should return 200 status', async () => {
      const res = await mf.dispatchFetch('http://localhost/health', {
        method: 'GET'
      });
      
      expect(res.status).toBe(200);
    });

    it('should return correct JSON structure', async () => {
      const res = await mf.dispatchFetch('http://localhost/health', {
        method: 'GET'
      });
      
      const json = await res.json() as { status: string; timestamp: string };
      
      expect(json).toHaveProperty('status', 'ok');
      expect(json).toHaveProperty('timestamp');
      expect(new Date(json.timestamp)).toBeInstanceOf(Date);
    });

    it('should return application/json content type', async () => {
      const res = await mf.dispatchFetch('http://localhost/health', {
        method: 'GET'
      });
      
      expect(res.headers.get('content-type')).toBe('application/json');
    });
  });

  describe('Other routes', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await mf.dispatchFetch('http://localhost/unknown', {
        method: 'GET'
      });
      
      expect(res.status).toBe(404);
    });
  });
});