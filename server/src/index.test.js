import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from './index.js';

const adminAgent = () => request.agent(app);

describe('AlarmHosting API', () => {
  let agent;

  beforeEach(() => {
    agent = adminAgent();
  });

  it('returns health status', async () => {
    const res = await agent.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('prevents accessing alert logs without login', async () => {
    const res = await agent.get('/alerts/history');
    expect(res.status).toBe(401);
  });

  it('allows admin to view alert history after login and blocks non-admins', async () => {
    // login as admin
    const admin = request.agent(app);
    const loginRes = await admin
      .post('/auth/login')
      .send({ userId: 'user-1' })
      .set('Content-Type', 'application/json');
    expect(loginRes.status).toBe(200);

    const adminHistory = await admin.get('/alerts/history?limit=1');
    expect(adminHistory.status).toBe(200);

    // login as non-admin
    const user = request.agent(app);
    const loginRes2 = await user
      .post('/auth/login')
      .send({ userId: 'user-2' })
      .set('Content-Type', 'application/json');
    expect(loginRes2.status).toBe(200);

    const forbiddenRes = await user.get('/alerts/history?limit=1');
    expect(forbiddenRes.status).toBe(403);
  });
});
