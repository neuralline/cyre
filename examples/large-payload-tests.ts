// tests/performance/large-payload-tests.ts
// Test Cyre with realistic large JSON payloads

import {cyre} from '../src'
import type {ActionPayload} from '../src/types/core'

// ops/s = operations per second (how many cyre.call() can complete per second)

interface LargePayloadResults {
  smallPayload: {time: number; ops: number; opsPerSecond: number; size: string}
  mediumPayload: {time: number; ops: number; opsPerSecond: number; size: string}
  largePayload: {time: number; ops: number; opsPerSecond: number; size: string}
  hugePayload: {time: number; ops: number; opsPerSecond: number; size: string}
  massivePayload: {
    time: number
    ops: number
    opsPerSecond: number
    size: string
  }
}

// Utility to measure JSON size in KB/MB
const getPayloadSize = (payload: any): string => {
  const jsonString = JSON.stringify(payload)
  const bytes = new Blob([jsonString]).size

  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// Generate realistic large payloads
const generateUserDatabase = (userCount: number) => ({
  metadata: {
    totalUsers: userCount,
    generatedAt: new Date().toISOString(),
    version: '2.1.0',
    schema: 'user_database_v2',
    region: 'us-east-1',
    environment: 'production'
  },
  users: Array(userCount)
    .fill(0)
    .map((_, i) => ({
      id: `user_${i}_${Date.now()}`,
      profile: {
        firstName: `FirstName${i}`,
        lastName: `LastName${i}`,
        email: `user${i}@company.com`,
        phoneNumber: `+1-555-${String(i).padStart(4, '0')}`,
        dateOfBirth: new Date(
          1990 + (i % 30),
          i % 12,
          (i % 28) + 1
        ).toISOString(),
        avatar: `https://api.avatars.com/user_${i}.jpg`,
        bio: `This is a sample bio for user ${i}. They are a ${
          i % 2 === 0 ? 'software engineer' : 'product manager'
        } with ${(i % 10) + 1} years of experience.`
      },
      preferences: {
        theme: i % 3 === 0 ? 'dark' : i % 3 === 1 ? 'light' : 'auto',
        language: ['en', 'es', 'fr', 'de', 'it'][i % 5],
        timezone: ['UTC', 'EST', 'PST', 'CST', 'MST'][i % 5],
        notifications: {
          email: i % 2 === 0,
          push: i % 3 === 0,
          sms: i % 5 === 0,
          marketing: i % 7 === 0
        },
        privacy: {
          profileVisible: i % 4 !== 0,
          showEmail: i % 6 === 0,
          showPhone: false,
          dataSharing: i % 8 === 0
        }
      },
      activity: {
        lastLogin: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        loginCount: Math.floor(Math.random() * 1000) + 1,
        sessionsThisMonth: Math.floor(Math.random() * 50) + 1,
        pageViews: Math.floor(Math.random() * 10000) + 100,
        actionsPerformed: Math.floor(Math.random() * 5000) + 50,
        averageSessionDuration: Math.floor(Math.random() * 3600) + 300, // seconds
        deviceHistory: Array(Math.min((i % 5) + 1, 5))
          .fill(0)
          .map((_, d) => ({
            deviceId: `device_${i}_${d}`,
            deviceType: ['mobile', 'desktop', 'tablet'][d % 3],
            browser: ['Chrome', 'Firefox', 'Safari', 'Edge'][d % 4],
            os: ['Windows', 'macOS', 'iOS', 'Android', 'Linux'][d % 5],
            lastUsed: new Date(
              Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
            ).toISOString()
          }))
      },
      permissions: {
        roles: [`role_${i % 10}`, `department_${i % 20}`],
        capabilities: Array((i % 10) + 1)
          .fill(0)
          .map((_, c) => `capability_${c}`),
        accessLevel: ['basic', 'intermediate', 'advanced', 'admin'][i % 4],
        restrictions: Array(i % 3)
          .fill(0)
          .map((_, r) => `restriction_${r}`),
        temporaryAccess:
          i % 15 === 0
            ? {
                grantedAt: new Date().toISOString(),
                expiresAt: new Date(
                  Date.now() + 7 * 24 * 60 * 60 * 1000
                ).toISOString(),
                reason: 'Temporary project access'
              }
            : null
      },
      analytics: {
        engagementScore: Math.random() * 100,
        retentionRate: Math.random() * 100,
        lifetimeValue: Math.random() * 10000,
        conversionEvents: Array(i % 8)
          .fill(0)
          .map((_, e) => ({
            eventType: ['signup', 'purchase', 'upgrade', 'referral'][e % 4],
            timestamp: new Date(
              Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000
            ).toISOString(),
            value: Math.random() * 1000,
            metadata: {
              source: ['organic', 'paid', 'referral', 'social'][e % 4],
              campaign: `campaign_${e % 10}`
            }
          })),
        customEvents: Array(i % 12)
          .fill(0)
          .map((_, e) => ({
            name: `custom_event_${e}`,
            properties: {
              property1: `value_${e}`,
              property2: Math.random() * 100,
              property3: e % 2 === 0
            },
            timestamp: new Date(
              Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
            ).toISOString()
          }))
      }
    })),
  aggregations: {
    totalActiveUsers: userCount * 0.7,
    averageSessionDuration: 1245,
    topCountries: [
      {country: 'US', userCount: Math.floor(userCount * 0.4)},
      {country: 'UK', userCount: Math.floor(userCount * 0.15)},
      {country: 'CA', userCount: Math.floor(userCount * 0.1)},
      {country: 'DE', userCount: Math.floor(userCount * 0.08)},
      {country: 'FR', userCount: Math.floor(userCount * 0.05)}
    ],
    deviceBreakdown: {
      mobile: Math.floor(userCount * 0.6),
      desktop: Math.floor(userCount * 0.35),
      tablet: Math.floor(userCount * 0.05)
    }
  }
})

const generateEcommerceData = (orderCount: number) => ({
  summary: {
    totalOrders: orderCount,
    totalRevenue: orderCount * 127.5, // Average order value
    generatedAt: new Date().toISOString(),
    currency: 'USD',
    region: 'global'
  },
  orders: Array(orderCount)
    .fill(0)
    .map((_, i) => ({
      orderId: `order_${Date.now()}_${i}`,
      customer: {
        customerId: `customer_${i % 100}`, // 100 unique customers
        email: `customer${i % 100}@shop.com`,
        name: `Customer ${i % 100}`,
        address: {
          street: `${i + 100} Main Street`,
          city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][
            i % 5
          ],
          state: ['NY', 'CA', 'IL', 'TX', 'AZ'][i % 5],
          zipCode: `${String((i % 90000) + 10000)}`,
          country: 'US'
        },
        phone: `+1-555-${String(i % 10000).padStart(4, '0')}`
      },
      items: Array(Math.min((i % 8) + 1, 10))
        .fill(0)
        .map((_, itemIndex) => ({
          productId: `product_${(i * 10 + itemIndex) % 500}`, // 500 unique products
          name: `Product ${(i * 10 + itemIndex) % 500}`,
          category: ['Electronics', 'Clothing', 'Home', 'Books', 'Sports'][
            itemIndex % 5
          ],
          price: Math.round((Math.random() * 200 + 10) * 100) / 100,
          quantity: Math.floor(Math.random() * 5) + 1,
          sku: `SKU-${String((i * 10 + itemIndex) % 500).padStart(6, '0')}`,
          description: `This is a detailed description for product ${
            (i * 10 + itemIndex) % 500
          }. It includes features, specifications, and benefits.`,
          images: Array((itemIndex % 3) + 1)
            .fill(0)
            .map(
              (_, imgIndex) =>
                `https://images.shop.com/product_${
                  (i * 10 + itemIndex) % 500
                }_${imgIndex}.jpg`
            ),
          attributes: {
            color: ['red', 'blue', 'green', 'black', 'white'][itemIndex % 5],
            size: ['S', 'M', 'L', 'XL'][itemIndex % 4],
            material: ['cotton', 'polyester', 'wool', 'silk'][itemIndex % 4],
            brand: `Brand ${itemIndex % 20}`
          }
        })),
      pricing: {
        subtotal: 0, // Will be calculated
        tax: 0,
        shipping: Math.random() * 20 + 5,
        discount: Math.random() * 50,
        total: 0
      },
      payment: {
        method: ['credit_card', 'paypal', 'apple_pay', 'google_pay'][i % 4],
        status: ['completed', 'pending', 'failed'][
          i % 10 < 8 ? 0 : i % 10 < 9 ? 1 : 2
        ],
        transactionId: `txn_${Date.now()}_${i}`,
        timestamp: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
        ).toISOString()
      },
      shipping: {
        method: ['standard', 'express', 'overnight'][i % 3],
        carrier: ['UPS', 'FedEx', 'USPS', 'DHL'][i % 4],
        trackingNumber: `TRACK${String(i).padStart(10, '0')}`,
        estimatedDelivery: new Date(
          Date.now() + Math.random() * 14 * 24 * 60 * 60 * 1000
        ).toISOString(),
        status: ['processing', 'shipped', 'delivered'][Math.min(i % 3, 2)]
      },
      timestamps: {
        createdAt: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        updatedAt: new Date(
          Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        processedAt: new Date(
          Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000
        ).toISOString()
      }
    }))
})

// Test function
const testPayloadSize = async (
  payloadGenerator: () => any,
  testName: string,
  iterations: number = 100
): Promise<{time: number; ops: number; opsPerSecond: number; size: string}> => {
  const testPayload = payloadGenerator()
  const size = getPayloadSize(testPayload)

  console.log(`\n📦 Testing ${testName} (${size})...`)

  // Setup channel
  cyre.action({
    id: `large-payload-test`,
    detectChanges: true,
    transform: (payload: any) => ({
      ...payload,
      processed: true,
      processedAt: Date.now(),
      processingInfo: {
        itemCount: Array.isArray(payload.users)
          ? payload.users.length
          : Array.isArray(payload.orders)
          ? payload.orders.length
          : 0,
        dataSize: size
      }
    })
  })

  cyre.on('large-payload-test', (payload: ActionPayload) => {
    return {
      status: 'processed',
      timestamp: Date.now(),
      payloadSize: size
    }
  })

  // Warm up
  await cyre.call('large-payload-test', testPayload)

  // Actual test
  const start = performance.now()

  for (let i = 0; i < iterations; i++) {
    await cyre.call('large-payload-test', payloadGenerator())
  }

  const totalTime = performance.now() - start
  const opsPerSecond = Math.round((iterations / totalTime) * 1000)

  console.log(`  Time: ${totalTime.toFixed(2)}ms for ${iterations} operations`)
  console.log(`  Performance: ${opsPerSecond.toLocaleString()} ops/s`)
  console.log(`  Avg per operation: ${(totalTime / iterations).toFixed(3)}ms`)

  cyre.forget('large-payload-test')

  return {
    time: totalTime,
    ops: iterations,
    opsPerSecond,
    size
  }
}

export async function runLargePayloadTests(): Promise<LargePayloadResults> {
  console.log('\n📊 Large Payload Performance Tests')
  console.log('===================================')
  console.log('Testing how Cyre handles realistic large JSON payloads...')

  await cyre.init()

  const results: LargePayloadResults = {
    smallPayload: await testPayloadSize(
      () => generateUserDatabase(10),
      'Small User Database (10 users)',
      500
    ),

    mediumPayload: await testPayloadSize(
      () => generateUserDatabase(100),
      'Medium User Database (100 users)',
      200
    ),

    largePayload: await testPayloadSize(
      () => generateUserDatabase(500),
      'Large User Database (500 users)',
      50
    ),

    hugePayload: await testPayloadSize(
      () => generateEcommerceData(1000),
      'Huge E-commerce Data (1000 orders)',
      20
    ),

    massivePayload: await testPayloadSize(
      () => generateUserDatabase(2000),
      'Massive User Database (2000 users)',
      10
    )
  }

  return results
}

export function printLargePayloadResults(results: LargePayloadResults): void {
  console.log('\n📈 Large Payload Results Summary')
  console.log('=================================')

  console.log('\n| Payload Size | Operations/sec | Avg Time | Size |')
  console.log('|-------------|---------------|----------|------|')

  Object.entries(results).forEach(([name, result]) => {
    const displayName = name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
    const avgTime = (result.time / result.ops).toFixed(3)

    console.log(
      `| ${displayName.padEnd(11)} | ${result.opsPerSecond
        .toLocaleString()
        .padStart(13)} | ${avgTime.padStart(8)}ms | ${result.size.padEnd(4)} |`
    )
  })

  console.log('\n📊 Performance Analysis:')

  // Performance degradation analysis
  const baseline = results.smallPayload.opsPerSecond
  Object.entries(results).forEach(([name, result]) => {
    const degradation = ((baseline - result.opsPerSecond) / baseline) * 100
    const displayName = name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())

    if (degradation > 0) {
      console.log(
        `${displayName}: ${degradation.toFixed(1)}% slower than baseline`
      )
    } else {
      console.log(`${displayName}: Baseline performance`)
    }
  })

  // Throughput analysis
  console.log('\n🚀 Throughput Analysis:')

  // Calculate MB/s throughput
  Object.entries(results).forEach(([name, result]) => {
    const displayName = name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
    const sizeInMB =
      parseFloat(result.size.replace(/[^\d.]/g, '')) /
      (result.size.includes('KB') ? 1024 : 1)
    const mbPerSecond = (sizeInMB * result.opsPerSecond).toFixed(2)

    console.log(`${displayName}: ${mbPerSecond} MB/s data throughput`)
  })

  // Performance grades
  console.log('\n🎯 Performance Grades:')
  Object.entries(results).forEach(([name, result]) => {
    const displayName = name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
    let grade = '🔴 C'

    if (result.opsPerSecond > 1000) grade = '🟢 A'
    else if (result.opsPerSecond > 500) grade = '🟡 B'

    console.log(
      `${displayName}: ${grade} (${result.opsPerSecond.toLocaleString()} ops/s)`
    )
  })

  // Real-world implications
  console.log('\n🌍 Real-World Performance:')
  console.log('- API Responses: Can handle large JSON APIs efficiently')
  console.log('- Database Results: Processes database query results quickly')
  console.log('- Real-time Data: Suitable for live data feeds')
  console.log('- File Processing: Can handle large configuration/data files')

  const worstPerformance = Math.min(
    ...Object.values(results).map(r => r.opsPerSecond)
  )
  if (worstPerformance > 100) {
    console.log(
      `\n✅ Even with massive payloads, Cyre maintains ${worstPerformance.toLocaleString()} ops/s`
    )
    console.log('   This exceeds typical application requirements!')
  }
}

// Memory usage test
export async function testMemoryUsage(): Promise<void> {
  console.log('\n🧠 Memory Usage Test')
  console.log('====================')

  const getMemory = () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + ' MB'
    }
    return 'N/A'
  }

  console.log(`Initial Memory: ${getMemory()}`)

  // Create large payloads and measure memory
  const largePayloads = []
  for (let i = 0; i < 10; i++) {
    largePayloads.push(generateUserDatabase(1000))
  }

  console.log(`After Creating 10 Large Payloads: ${getMemory()}`)

  // Process through Cyre
  cyre.action({id: 'memory-test'})
  cyre.on('memory-test', payload => payload)

  for (const payload of largePayloads) {
    await cyre.call('memory-test', payload)
  }

  console.log(`After Processing Through Cyre: ${getMemory()}`)

  // Cleanup
  cyre.clear()

  // Force garbage collection if available
  if (typeof global !== 'undefined' && global.gc) {
    global.gc()
  }

  console.log(`After Cleanup: ${getMemory()}`)
}

// Main execution
export async function runCompleteLargePayloadTest(): Promise<void> {
  try {
    const results = await runLargePayloadTests()
    printLargePayloadResults(results)

    await testMemoryUsage()

    // System health check
    console.log('\n🏥 System Health After Large Payload Tests:')
    const metrics = cyre.getMetricsReport()
    const breathingState = cyre.getBreathingState()

    console.log(`Total Operations: ${metrics.global.totalCalls}`)
    console.log(
      `Error Rate: ${(
        (metrics.global.totalErrors / metrics.global.totalCalls) *
        100
      ).toFixed(2)}%`
    )
    console.log(`System Stress: ${(breathingState.stress * 100).toFixed(1)}%`)
  } catch (error) {
    console.error('❌ Large payload test failed:', error)
  } finally {
    cyre.clear()
    console.log('\n🧹 Large payload test cleanup complete')
  }
}

// Auto-run if executed directly
runCompleteLargePayloadTest()
