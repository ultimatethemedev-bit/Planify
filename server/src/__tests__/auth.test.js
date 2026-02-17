import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import mongoose from 'mongoose'

let app

beforeAll(async () => {
  const authRoutes = (await import('../routes/auth.js')).default
  app = express()
  app.use(express.json())
  app.use('/api/auth', authRoutes)
})

beforeEach(async () => {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
})

describe('POST /api/auth/register', () => {
  it('should register a new user with a store', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
        store1: 'Ma Boutique',
      })

    expect(res.status).toBe(201)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.email).toBe('test@example.com')
    expect(res.body.user.firstName).toBe('Jean')
    expect(res.body.user.stores).toHaveLength(1)
    expect(res.body.user.stores[0].name).toBe('Ma Boutique')
    expect(res.body.user.stores[0].role).toBe('owner')
  })

  it('should register with two stores', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
        store1: 'Boutique 1',
        store2: 'Boutique 2',
      })

    expect(res.status).toBe(201)
    expect(res.body.user.stores).toHaveLength(2)
  })

  it('should reject duplicate email', async () => {
    const userData = {
      email: 'dup@example.com',
      password: 'password123',
      firstName: 'Jean',
      lastName: 'Dupont',
      store1: 'Ma Boutique',
    }

    await request(app).post('/api/auth/register').send(userData)
    const res = await request(app).post('/api/auth/register').send(userData)

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('déjà utilisé')
  })

  it('should reject missing required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com' })

    expect(res.status).toBe(400)
  })

  it('should reject short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: '12345',
        firstName: 'Jean',
        lastName: 'Dupont',
        store1: 'Ma Boutique',
      })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    const collections = mongoose.connection.collections
    for (const key in collections) {
      await collections[key].deleteMany({})
    }
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'login@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
        store1: 'Ma Boutique',
      })
  })

  it('should login with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@example.com',
        password: 'password123',
      })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.email).toBe('login@example.com')
    expect(res.body.user.stores).toHaveLength(1)
  })

  it('should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@example.com',
        password: 'wrongpassword',
      })

    expect(res.status).toBe(401)
  })

  it('should reject non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nobody@example.com',
        password: 'password123',
      })

    expect(res.status).toBe(401)
  })
})

describe('GET /api/auth/me', () => {
  it('should return user with valid token', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'me@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
        store1: 'Ma Boutique',
      })

    const token = registerRes.body.token

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.email).toBe('me@example.com')
    expect(res.body.stores).toHaveLength(1)
  })

  it('should reject request without token', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('should reject invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token')

    expect(res.status).toBe(401)
  })
})
