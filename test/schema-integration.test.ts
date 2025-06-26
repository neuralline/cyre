// test/schema-integration.test.ts
// Schema validation integration tests

import {describe, it, expect, beforeEach} from 'vitest'
import {cyre} from '../src'

/*

      C.Y.R.E - S.C.H.E.M.A - T.E.S.T.S
      
      Integration tests for schema validation:
      - Action registration with schema
      - Validation in protection pipeline
      - Error handling and reporting
      - Performance impact measurement

*/

describe('Schema Integration', () => {
  beforeEach(() => {
    cyre.clear()
  })

  it('should validate payload with schema', async () => {
    const userSchema = schema.object({
      id: schema.number().refine(n => n > 0, 'Must be positive'),
      name: schema
        .string()
        .refine(s => s.length >= 2, 'Must be at least 2 characters'),
      email: schema.email_string()
    })

    cyre.action({
      id: 'create-user',
      schema: userSchema
    })

    let receivedPayload: any = null
    cyre.on('create-user', payload => {
      receivedPayload = payload
      return {created: true}
    })

    const validPayload = {
      id: 123,
      name: 'John Doe',
      email: 'john@example.com'
    }

    const result = await cyre.call('create-user', validPayload)

    expect(result.ok).toBe(true)
    expect(receivedPayload).toEqual(validPayload)
    expect(result.metadata?.validationPassed).toBe(true)
  })

  it('should reject invalid payload', async () => {
    const userSchema = schema.object({
      id: schema.number().refine(n => n > 0, 'Must be positive'),
      name: schema
        .string()
        .refine(s => s.length >= 2, 'Must be at least 2 characters'),
      email: schema.email_string()
    })

    cyre.action({
      id: 'create-user-invalid',
      schema: userSchema
    })

    cyre.on('create-user-invalid', payload => {
      throw new Error('Should not reach handler')
    })

    const invalidPayload = {
      id: -1, // Invalid: negative
      name: 'A', // Invalid: too short
      email: 'invalid-email' // Invalid: not email format
    }

    const result = await cyre.call('create-user-invalid', invalidPayload)

    expect(result.ok).toBe(false)
    expect(result.message).toContain('Schema validation failed')
  })

  it('should work with optional fields', async () => {
    const userSchema = schema.object({
      name: schema.string(),
      age: schema.number().optional(),
      email: schema.email_string().optional()
    })

    cyre.action({
      id: 'create-user-optional',
      schema: userSchema
    })

    let receivedPayload: any = null
    cyre.on('create-user-optional', payload => {
      receivedPayload = payload
      return {created: true}
    })

    const minimalPayload = {name: 'John'}
    const result = await cyre.call('create-user-optional', minimalPayload)

    expect(result.ok).toBe(true)
    expect(receivedPayload.name).toBe('John')
  })

  it('should transform payload using schema', async () => {
    const configSchema = schema
      .object({
        timeout: schema.number(),
        retries: schema.number()
      })
      .transform(config => ({
        ...config,
        timeoutSeconds: config.timeout / 1000
      }))

    cyre.action({
      id: 'update-config',
      schema: configSchema
    })

    let receivedPayload: any = null
    cyre.on('update-config', payload => {
      receivedPayload = payload
      return {updated: true}
    })

    const inputPayload = {timeout: 5000, retries: 3}
    const result = await cyre.call('update-config', inputPayload)

    expect(result.ok).toBe(true)
    expect(receivedPayload.timeout).toBe(5000)
    expect(receivedPayload.timeoutSeconds).toBe(5)
  })

  it('should work with default values', async () => {
    const settingsSchema = schema.object({
      theme: schema.string().default('light'),
      notifications: schema.boolean().default(true),
      language: schema.string()
    })

    cyre.action({
      id: 'update-settings',
      schema: settingsSchema
    })

    let receivedPayload: any = null
    cyre.on('update-settings', payload => {
      receivedPayload = payload
      return {updated: true}
    })

    const partialPayload = {language: 'en'}
    const result = await cyre.call('update-settings', partialPayload)

    expect(result.ok).toBe(true)
    expect(receivedPayload.language).toBe('en')
    expect(receivedPayload.theme).toBe('light')
    expect(receivedPayload.notifications).toBe(true)
  })

  it('should validate arrays', async () => {
    const listSchema = schema.object({
      items: schema.array(
        schema.object({
          id: schema.number(),
          name: schema.string()
        })
      )
    })

    cyre.action({
      id: 'process-list',
      schema: listSchema
    })

    let receivedPayload: any = null
    cyre.on('process-list', payload => {
      receivedPayload = payload
      return {processed: true}
    })

    const listPayload = {
      items: [
        {id: 1, name: 'Item 1'},
        {id: 2, name: 'Item 2'}
      ]
    }

    const result = await cyre.call('process-list', listPayload)

    expect(result.ok).toBe(true)
    expect(receivedPayload.items).toHaveLength(2)
  })

  it('should work with union types', async () => {
    const eventSchema = schema.object({
      type: schema.enums('click', 'hover', 'focus'),
      data: schema.union(
        schema.object({x: schema.number(), y: schema.number()}), // mouse event
        schema.object({key: schema.string()}) // keyboard event
      )
    })

    cyre.action({
      id: 'handle-event',
      schema: eventSchema
    })

    let receivedPayload: any = null
    cyre.on('handle-event', payload => {
      receivedPayload = payload
      return {handled: true}
    })

    const mouseEvent = {
      type: 'click',
      data: {x: 100, y: 200}
    }

    const result = await cyre.call('handle-event', mouseEvent)

    expect(result.ok).toBe(true)
    expect(receivedPayload.type).toBe('click')
    expect(receivedPayload.data.x).toBe(100)
  })

  it('should work with custom refinements', async () => {
    const orderSchema = schema
      .object({
        items: schema.array(
          schema.object({
            price: schema.number(),
            quantity: schema.number()
          })
        )
      })
      .refine(order => {
        const total = order.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        )
        return total > 0
      }, 'Order total must be greater than 0')

    cyre.action({
      id: 'process-order',
      schema: orderSchema
    })

    cyre.on('process-order', payload => {
      return {processed: true}
    })

    // Valid order
    const validOrder = {
      items: [{price: 10, quantity: 2}]
    }
    const validResult = await cyre.call('process-order', validOrder)
    expect(validResult.ok).toBe(true)

    // Invalid order (zero total)
    const invalidOrder = {
      items: [{price: 0, quantity: 1}]
    }
    const invalidResult = await cyre.call('process-order', invalidOrder)
    expect(invalidResult.ok).toBe(false)
    expect(invalidResult.message).toContain(
      'Order total must be greater than 0'
    )
  })
})
