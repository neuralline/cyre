// test/use-hooks.test.ts
// Corrected test for the hooks family working together
// Tests: useCyre + useBranch + useGroup with proper expectations

import {cyre, useCyre, useBranch, useGroup} from '../src'

/**
 * Corrected Hook Tests
 * Fixed expectations based on actual cyre behavior
 */
describe('Happy Family: useCyre + useBranch + useGroup', () => {
  // Reset cyre state before each test
  beforeEach(() => {
    // Clear any existing channels/branches
    cyre.reset?.() // Assuming cyre has a reset method
  })

  describe('Individual Hook Tests', () => {
    test('useCyre should create and manage single channels', async () => {
      // Create channel with useCyre
      const testChannel = useCyre({
        name: 'test-channel',
        channelId: 'test',
        priority: {level: 'medium'}
      })

      expect(testChannel.id).toBe('test')
      expect(testChannel.name).toBe('test-channel')

      // Set up handler - CORRECTED: handler return value becomes payload directly
      let handlerCalled = false
      testChannel.on((data: any) => {
        handlerCalled = true
        // Return the data structure you want as the payload
        return {received: data}
      })

      // Call channel
      const result = await testChannel.call({test: 'data'})

      expect(result.ok).toBe(true)
      expect(handlerCalled).toBe(true)
      // CORRECTED: result.payload is the handler return value directly
      expect(result.payload.received.test).toBe('data')
    })

    test('useBranch should create isolated namespaces', () => {
      // Create branches
      const branch1 = useBranch({id: 'branch1', name: 'test-branch-1'})
      const branch2 = useBranch({id: 'branch2', name: 'test-branch-2'})

      expect(branch1.id).toBe('branch1')
      expect(branch1.path).toBe('test-branch-1')
      expect(branch2.id).toBe('branch2')
      expect(branch2.path).toBe('test-branch-2')

      // Test isolation - same channel ID in different branches
      const result1 = branch1.action({id: 'sensor'})
      const result2 = branch2.action({id: 'sensor'})

      expect(result1.ok).toBe(true)
      expect(result2.ok).toBe(true)
      // No conflicts despite same ID!
    })

    test('useGroup should coordinate channel execution', async () => {
      // Create test channels
      const channel1 = useCyre({channelId: 'ch1'})
      const channel2 = useCyre({channelId: 'ch2'})
      const channel3 = useCyre({channelId: 'ch3'})

      // Set up handlers - CORRECTED: return data structure directly
      channel1.on(() => ({id: 1}))
      channel2.on(() => ({id: 2}))
      channel3.on(() => ({id: 3}))

      // Create group
      const group = useGroup([channel1, channel2, channel3], {
        name: 'test-group',
        strategy: 'parallel'
      })

      expect(group.channels.length).toBe(3)
      expect(group.name).toBe('test-group')

      // Execute group
      const result = await group.call({test: 'data'})
      expect(result.ok).toBe(true)
      expect(Array.isArray(result.payload)).toBe(true)
      expect(result.payload.length).toBe(3)

      // CORRECTED: Check the structure of group results
      expect(result.payload[0].payload.id).toBe(1)
      expect(result.payload[1].payload.id).toBe(2)
      expect(result.payload[2].payload.id).toBe(3)
    })
  })

  describe('Integration Tests - All Three Together', () => {
    test('useCyre + useBranch: channels in different branches', async () => {
      // Create branches
      const kitchenBranch = useBranch({id: 'kitchen'})
      const bedroomBranch = useBranch({id: 'bedroom'})

      // Create same-named channels in different branches
      const kitchenSensor = useCyre(
        {
          channelId: 'sensor',
          name: 'kitchen-sensor'
        },
        kitchenBranch
      )

      const bedroomSensor = useCyre(
        {
          channelId: 'sensor',
          name: 'bedroom-sensor'
        },
        bedroomBranch
      )

      expect(kitchenSensor.id).toBe('sensor')
      expect(bedroomSensor.id).toBe('sensor')
      // Same ID, different namespaces - no conflicts!

      // Set up handlers - CORRECTED: return data structure directly
      kitchenSensor.on(() => ({room: 'kitchen'}))
      bedroomSensor.on(() => ({room: 'bedroom'}))

      // Test both work independently
      const kitchenResult = await kitchenSensor.call({temp: 22})
      const bedroomResult = await bedroomSensor.call({temp: 20})

      expect(kitchenResult.ok).toBe(true)
      expect(kitchenResult.payload.room).toBe('kitchen')
      expect(bedroomResult.ok).toBe(true)
      expect(bedroomResult.payload.room).toBe('bedroom')
    })

    test('useCyre + useGroup: group channels from different sources', async () => {
      // Create main cyre channels
      const mainChannel = useCyre({channelId: 'main-sensor'})

      // Create branch and branch channel
      const branch = useBranch({id: 'sensors'})
      const branchChannel = useCyre({channelId: 'branch-sensor'}, branch)

      // Set up handlers - CORRECTED: return data structure directly
      mainChannel.on(() => ({source: 'main'}))
      branchChannel.on(() => ({source: 'branch'}))

      // Group them together - should work despite different sources!
      const mixedGroup = useGroup([mainChannel, branchChannel], {
        name: 'mixed-sources-group',
        strategy: 'parallel'
      })

      expect(mixedGroup.channels.length).toBe(2)

      const result = await mixedGroup.call({test: 'mixed'})
      expect(result.ok).toBe(true)
      expect(result.payload.length).toBe(2)

      // CORRECTED: Verify both sources executed with proper structure
      const sources = result.payload.map((r: any) => r.payload.source)
      expect(sources).toContain('main')
      expect(sources).toContain('branch')
    })

    test('Full Integration: useBranch → useCyre → useGroup', async () => {
      // Step 1: Create branch architecture
      const homeBranch = useBranch({id: 'home', name: 'smart-home'})
      const officeBranch = useBranch({id: 'office', name: 'smart-office'})

      // Step 2: Create channels in branches
      const homeTemp = useCyre(
        {channelId: 'temperature', name: 'home-temp'},
        homeBranch
      )
      const homeHumidity = useCyre(
        {channelId: 'humidity', name: 'home-humidity'},
        homeBranch
      )
      const officeTemp = useCyre(
        {channelId: 'temperature', name: 'office-temp'},
        officeBranch
      )

      // Step 3: Set up handlers - CORRECTED: return data structure directly
      homeTemp.on(data => ({location: 'home', temp: data.value}))
      homeHumidity.on(data => ({location: 'home', humidity: data.value}))
      officeTemp.on(data => ({location: 'office', temp: data.value}))

      // Step 4: Create groups with different strategies
      const homeGroup = useGroup([homeTemp, homeHumidity], {
        name: 'home-sensors',
        strategy: 'parallel'
      })

      const allSensorsGroup = useGroup([homeTemp, homeHumidity, officeTemp], {
        name: 'all-sensors',
        strategy: 'sequential'
      })

      // Step 5: Test execution
      const homeResult = await homeGroup.call({value: 22})
      expect(homeResult.ok).toBe(true)
      expect(homeResult.payload.length).toBe(2)

      const allResult = await allSensorsGroup.call({value: 25})
      expect(allResult.ok).toBe(true)
      expect(allResult.payload.length).toBe(3)

      // CORRECTED: Verify all locations represented with proper structure
      const locations = allResult.payload.map((r: any) => r.payload.location)
      expect(locations.filter(loc => loc === 'home')).toHaveLength(2)
      expect(locations.filter(loc => loc === 'office')).toHaveLength(1)
    })
  })

  describe('Error Handling & Edge Cases', () => {
    test('useGroup should handle channel failures gracefully', async () => {
      const goodChannel = useCyre({channelId: 'good'})
      const badChannel = useCyre({channelId: 'bad'})

      // CORRECTED: Handlers should return just the data, system provides ok/message structure
      goodChannel.on(() => ({status: 'good'}))

      // CORRECTED: For errors, either throw or return error indicator
      badChannel.on(() => {
        throw new Error('Bad channel failed')
      })

      // Test continue strategy
      const resilientGroup = useGroup([goodChannel, badChannel], {
        strategy: 'parallel',
        errorStrategy: 'continue'
      })

      const result = await resilientGroup.call({test: 'error-handling'})

      // Should complete despite one failure
      expect(result.payload.length).toBe(2)
      expect(result.payload[0].ok).toBe(true)
      expect(result.payload[1].ok).toBe(false)
    })

    test('useGroup should handle empty channel list', () => {
      expect(() => {
        useGroup([], {name: 'empty-group'})
      }).toThrow('useGroup requires at least one channel')
    })

    test('useBranch should handle nested branches', () => {
      const parent = useBranch({id: 'parent'})
      const child = parent.createChild({id: 'child'})
      const grandchild = child.createChild({id: 'grandchild'})

      expect(parent.path).toBe('parent')
      expect(child.path).toBe('parent/child')
      expect(grandchild.path).toBe('parent/child/grandchild')
    })

    test('Performance: should handle many channels efficiently', async () => {
      // Create 100 channels
      const channels = Array.from({length: 100}, (_, i) => {
        const channel = useCyre({channelId: `channel-${i}`})
        channel.on(() => ({id: i}))
        return channel
      })

      const massGroup = useGroup(channels, {
        name: 'mass-group',
        strategy: 'parallel'
      })

      const startTime = performance.now()
      const result = await massGroup.call({test: 'performance'})
      const endTime = performance.now()

      expect(result.ok).toBe(true)
      expect(result.payload.length).toBe(100)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete in under 1 second
    })
  })

  describe('Real-World Scenarios', () => {
    test('E-commerce Order Pipeline', async () => {
      // Create order processing branches
      const userBranch = useBranch({id: 'users'})
      const orderBranch = useBranch({id: 'orders'})
      const paymentBranch = useBranch({id: 'payments'})

      // Create processing channels
      const userValidator = useCyre({channelId: 'validator'}, userBranch)
      const orderProcessor = useCyre({channelId: 'processor'}, orderBranch)
      const paymentHandler = useCyre({channelId: 'handler'}, paymentBranch)

      // Set up handlers - CORRECTED: return data structure directly
      userValidator.on(order => ({
        valid: !!order.userId,
        userId: order.userId
      }))

      orderProcessor.on(order => ({
        processed: true,
        orderId: order.orderId,
        items: order.items
      }))

      paymentHandler.on(order => ({
        paid: order.amount > 0,
        amount: order.amount
      }))

      // Create processing pipeline
      const orderPipeline = useGroup(
        [userValidator, orderProcessor, paymentHandler],
        {
          name: 'order-pipeline',
          strategy: 'sequential'
        }
      )

      // Test valid order
      const validOrder = {
        userId: 123,
        orderId: 456,
        items: ['item1'],
        amount: 100
      }
      const result = await orderPipeline.call(validOrder)

      expect(result.ok).toBe(true)
      expect(result.payload.length).toBe(3)
      expect(result.payload[2].payload.paid).toBe(true)

      // Test invalid order (should fail fast if strategy is fail-fast)
      const invalidOrder = {userId: null, orderId: 789, items: [], amount: 0}
      const invalidResult = await orderPipeline.call(invalidOrder)

      // This should still process all steps with continue strategy
      expect(invalidResult.payload.length).toBe(3)
      expect(invalidResult.payload[0].payload.valid).toBe(false)
    })

    test('IoT Sensor Network', async () => {
      // Create location branches
      const homeBranch = useBranch({id: 'home'})
      const officeBranch = useBranch({id: 'office'})

      // Create sensors
      const homeTemp1 = useCyre({channelId: 'temp1'}, homeBranch)
      const homeTemp2 = useCyre({channelId: 'temp2'}, homeBranch)
      const officeTemp = useCyre({channelId: 'temp1'}, officeBranch)

      // Set up sensor handlers - CORRECTED
      const sensors = [homeTemp1, homeTemp2, officeTemp]
      sensors.forEach((sensor, i) => {
        sensor.on(data => ({
          sensorId: i,
          location: i < 2 ? 'home' : 'office',
          temperature: data.value,
          timestamp: Date.now()
        }))
      })

      // Create sensor groups
      const homeGroup = useGroup([homeTemp1, homeTemp2], {
        name: 'home-sensors',
        strategy: 'parallel'
      })

      const allSensorsGroup = useGroup(sensors, {
        name: 'all-sensors',
        strategy: 'parallel'
      })

      // Test sensor reading
      const homeReading = await homeGroup.call({value: 23})
      expect(homeReading.ok).toBe(true)
      expect(homeReading.payload.length).toBe(2)
      expect(
        homeReading.payload.every((r: any) => r.payload.location === 'home')
      ).toBe(true)

      const allReading = await allSensorsGroup.call({value: 25})
      expect(allReading.ok).toBe(true)
      expect(allReading.payload.length).toBe(3)
    })
  })

  describe('Performance & Memory Tests', () => {
    test('Memory: should not leak on repeated operations', async () => {
      const initialMemory = process.memoryUsage()

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        const branch = useBranch({id: `test-${i}`})
        const channel = useCyre({channelId: 'test'}, branch)
        channel.on(() => ({iteration: i}))
        await channel.call({iteration: i})

        // Clean up
        branch.destroy()
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })

    test('Concurrency: should handle concurrent group executions', async () => {
      const channels = Array.from({length: 10}, (_, i) => {
        const channel = useCyre({channelId: `concurrent-${i}`})
        channel.on(() => ({id: i}))
        return channel
      })

      const group = useGroup(channels, {
        name: 'concurrent-group',
        strategy: 'parallel'
      })

      // Execute multiple groups concurrently
      const promises = Array.from({length: 10}, (_, i) =>
        group.call({batch: i})
      )

      const results = await Promise.all(promises)

      // All should succeed
      expect(results.every(r => r.ok)).toBe(true)
      expect(results.every(r => r.payload.length === 10)).toBe(true)
    })
  })
})
