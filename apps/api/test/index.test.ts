import { SELF } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'

describe('Worker', () => {
  describe('GET /health', () => {
    it('should return 200 status', async () => {
      const res = await SELF.fetch('http://localhost/health', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
    })

    it('should return correct JSON structure', async () => {
      const res = await SELF.fetch('http://localhost/health', {
        method: 'GET',
      })

      const json: { status: string; timestamp: string } = await res.json()

      expect(json).toHaveProperty('status', 'ok')
      expect(json).toHaveProperty('timestamp')
      expect(new Date(json.timestamp)).toBeInstanceOf(Date)
    })

    it('should return application/json content type', async () => {
      const res = await SELF.fetch('http://localhost/health', {
        method: 'GET',
      })

      expect(res.headers.get('content-type')).toBe('application/json')
    })
  })

  describe('Other routes', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await SELF.fetch('http://localhost/unknown', {
        method: 'GET',
      })

      expect(res.status).toBe(404)
    })
  })
})
