// test/use-hooks.test.ts
// Comprehensive test for the beautiful trilogy working together
// Tests: useCyre + useBranch + useGroup living happily ever after

import {cyre, useCyre, useBranch, useGroup} from '../src'

/**
 * Happy Family Test Suite
 * Tests all three hooks working together in harmony
 */
describe('Happy Family: useCyre + useBranch + useGroup', () => {
  // Reset cyre state before each test
  beforeEach(() => {
    // Clear any existing channels/branches
    cyre.reset?.() // Assuming cyre has a reset method
  })

  // ========================================
  // TEST 1: Individual Hook Functionality
  // ========================================

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

      // Set up handler
      let handlerCalled = false
      testChannel.on((data: any) => {
        handlerCalled = true
        return {ok: true, payload: {received: data}, message: 'Test successful'}
      })

      // Call channel
      const result = await testChannel.call({test: 'data'})

      expect(result.ok).toBe(true)
      expect(handlerCalled).toBe(true)
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

      // Set up handlers
      channel1.on(() => ({ok: true, payload: {id: 1}, message: 'Channel 1'}))
      channel2.on(() => ({ok: true, payload: {id: 2}, message: 'Channel 2'}))
      channel3.on(() => ({ok: true, payload: {id: 3}, message: 'Channel 3'}))

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
    })
  })

  // ========================================
  // TEST 2: Integration Tests
  // ========================================

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

      // Set up handlers
      kitchenSensor.on(() => ({
        ok: true,
        payload: {room: 'kitchen'},
        message: 'Kitchen sensor'
      }))
      bedroomSensor.on(() => ({
        ok: true,
        payload: {room: 'bedroom'},
        message: 'Bedroom sensor'
      }))

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

      // Set up handlers
      mainChannel.on(() => ({
        ok: true,
        payload: {source: 'main'},
        message: 'Main channel'
      }))
      branchChannel.on(() => ({
        ok: true,
        payload: {source: 'branch'},
        message: 'Branch channel'
      }))

      // Group them together - should work despite different sources!
      const mixedGroup = useGroup([mainChannel, branchChannel], {
        name: 'mixed-sources-group',
        strategy: 'parallel'
      })

      expect(mixedGroup.channels.length).toBe(2)

      const result = await mixedGroup.call({test: 'mixed'})
      expect(result.ok).toBe(true)
      expect(result.payload.length).toBe(2)

      // Verify both sources executed
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

      // Step 3: Set up handlers
      homeTemp.on(data => ({
        ok: true,
        payload: {location: 'home', temp: data.value},
        message: 'Home temp'
      }))
      homeHumidity.on(data => ({
        ok: true,
        payload: {location: 'home', humidity: data.value},
        message: 'Home humidity'
      }))
      officeTemp.on(data => ({
        ok: true,
        payload: {location: 'office', temp: data.value},
        message: 'Office temp'
      }))

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

      // Verify all locations represented
      const locations = allResult.payload.map((r: any) => r.payload.location)
      expect(locations.filter(loc => loc === 'home')).toHaveLength(2)
      expect(locations.filter(loc => loc === 'office')).toHaveLength(1)
    })
  })

  // ========================================
  // TEST 3: Error Handling & Edge Cases
  // ========================================

  describe('Error Handling & Edge Cases', () => {
    test('useGroup should handle channel failures gracefully', async () => {
      const goodChannel = useCyre({channelId: 'good'})
      const badChannel = useCyre({channelId: 'bad'})

      goodChannel.on(() => ({
        ok: true,
        payload: {status: 'good'},
        message: 'Good channel'
      }))
      badChannel.on(() => ({
        ok: false,
        payload: null,
        message: 'Bad channel failed'
      }))

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
        channel.on(() => ({
          ok: true,
          payload: {id: i},
          message: `Channel ${i}`
        }))
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

  // ========================================
  // TEST 4: Real-World Scenarios
  // ========================================

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

      // Set up handlers
      userValidator.on(order => ({
        ok: !!order.userId,
        payload: order,
        message: order.userId ? 'User valid' : 'User invalid'
      }))

      orderProcessor.on(order => ({
        ok: order.items?.length > 0,
        payload: {...order, processed: true},
        message: 'Order processed'
      }))

      paymentHandler.on(order => ({
        ok: order.amount > 0,
        payload: {...order, paid: true},
        message: 'Payment processed'
      }))

      // Create sequential pipeline
      const orderPipeline = useGroup(
        [userValidator, orderProcessor, paymentHandler],
        {
          name: 'order-pipeline',
          strategy: 'sequential',
          errorStrategy: 'fail-fast'
        }
      )

      // Test valid order
      const validOrder = {
        userId: 'user123',
        items: ['item1', 'item2'],
        amount: 99.99
      }

      const result = await orderPipeline.call(validOrder)
      expect(result.ok).toBe(true)
      expect(result.payload.length).toBe(3)
      expect(result.payload[2].payload.paid).toBe(true)

      // Test invalid order (should fail fast)
      const invalidOrder = {userId: null, items: [], amount: 0}
      const failResult = await orderPipeline.call(invalidOrder)

      // Should fail at first step and skip remaining
      expect(failResult.ok).toBe(false)
      const skippedChannels = failResult.payload.filter((r: any) => r.skipped)
      expect(skippedChannels.length).toBe(2) // Two channels skipped
    })

    test('IoT Sensor Network', async () => {
      // Create location branches
      const floor1 = useBranch({id: 'floor1'})
      const floor2 = useBranch({id: 'floor2'})

      // Create sensors
      const temp1 = useCyre({channelId: 'temperature'}, floor1)
      const humidity1 = useCyre({channelId: 'humidity'}, floor1)
      const temp2 = useCyre({channelId: 'temperature'}, floor2)
      const humidity2 = useCyre({channelId: 'humidity'}, floor2)[
        // Set up sensor handlers
        (temp1, temp2)
      ].forEach((sensor, i) => {
        sensor.on(data => ({
          ok: true,
          payload: {floor: i + 1, type: 'temperature', value: data.value},
          message: `Floor ${i + 1} temperature`
        }))
      })

      ;[humidity1, humidity2].forEach((sensor, i) => {
        sensor.on(data => ({
          ok: true,
          payload: {floor: i + 1, type: 'humidity', value: data.value},
          message: `Floor ${i + 1} humidity`
        }))
      })

      // Create floor groups
      const floor1Group = useGroup([temp1, humidity1], {name: 'floor1-sensors'})
      const floor2Group = useGroup([temp2, humidity2], {name: 'floor2-sensors'})

      // Create building-wide group
      const buildingGroup = useGroup([temp1, humidity1, temp2, humidity2], {
        name: 'building-sensors',
        strategy: 'parallel'
      })

      // Test floor-specific readings
      const floor1Result = await floor1Group.call({value: 22})
      expect(floor1Result.ok).toBe(true)
      expect(
        floor1Result.payload.every((r: any) => r.payload.floor === 1)
      ).toBe(true)

      // Test building-wide reading
      const buildingResult = await buildingGroup.call({value: 23})
      expect(buildingResult.ok).toBe(true)
      expect(buildingResult.payload.length).toBe(4)

      const floors = buildingResult.payload.map((r: any) => r.payload.floor)
      expect(floors.filter(f => f === 1)).toHaveLength(2)
      expect(floors.filter(f => f === 2)).toHaveLength(2)
    })
  })

  // ========================================
  // TEST 5: Performance & Memory
  // ========================================

  describe('Performance & Memory Tests', () => {
    test('Memory: should not leak on repeated operations', async () => {
      const initialMemory = process.memoryUsage()

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        const branch = useBranch({id: `test-${i}`})
        const channel = useCyre({channelId: 'test'}, branch)
        channel.on(() => ({ok: true, payload: null, message: 'test'}))
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
        channel.on(() => ({
          ok: true,
          payload: {id: i},
          message: `Concurrent ${i}`
        }))
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
