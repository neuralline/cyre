// cyre-streams-example.ts

// Import the required modules

import {createStream, interval, Stream} from '../src/streams'

// Define types for our domain
interface User {
  id: number
  name: string
  type: 'regular' | 'premium'
  action: string
  timestamp: number
  processedAt?: string
}

interface StockPrice {
  symbol: string
  price: number
  change: number
  timestamp: number
}

interface PriceAlert {
  symbol: string
  change: number
  message: string
  severity: 'low' | 'medium' | 'high'
}

interface SystemHeartbeat {
  type: 'heartbeat'
  timestamp: string
  count: number
}

console.log('\n=== CYRE Streams Demo ===\n')

// Create data sources
const userActions: Stream<User> = createStream<User>('user-actions')
const stockPrices: Stream<StockPrice> = createStream<StockPrice>('stock-prices')
const heartbeat: Stream<number> = interval(2000) // Emit every 2 seconds

console.log('🚀 Creating filtered stream for premium users')
// Filter for premium users only
const premiumUsers: Stream<User> = userActions
  .filter((user: User) => user.type === 'premium')
  .map((user: User) => ({
    ...user,
    processedAt: new Date().toISOString()
  }))

console.log('🚀 Creating price alerts stream')
// Create price alerts for significant changes
const priceAlerts: Stream<PriceAlert> = stockPrices
  .filter((stock: StockPrice) => Math.abs(stock.change) > 5)
  .map((stock: StockPrice) => ({
    symbol: stock.symbol,
    change: stock.change,
    message: `${stock.symbol} moved ${
      stock.change > 0 ? 'up' : 'down'
    } by ${Math.abs(stock.change)}%!`,
    severity:
      Math.abs(stock.change) > 10
        ? 'high'
        : ('medium' as 'low' | 'medium' | 'high')
  }))

// Combine heartbeat with price alerts, showing system is alive
const systemStatus: Stream<SystemHeartbeat> = heartbeat.map(
  (count: number) => ({
    type: 'heartbeat' as const,
    timestamp: new Date().toISOString(),
    count
  })
)

// Set up subscriptions
console.log('🚀 Setting up subscriptions to streams')

premiumUsers.subscribe((user: User) => {
  console.log(
    `👤 Premium user: ${user.name} (ID: ${user.id}) - Action: ${user.action}`
  )
})

priceAlerts.subscribe((alert: PriceAlert) => {
  console.log(
    `📈 PRICE ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`
  )
})

systemStatus.subscribe((status: SystemHeartbeat) => {
  console.log(`💓 System heartbeat #${status.count} at ${status.timestamp}`)
})

// Simulate activity
console.log('\n🚀 Starting simulation...\n')

// Push data into streams at regular intervals
const userTypeOptions: ('regular' | 'premium')[] = ['regular', 'premium']
const userActionOptions: string[] = ['login', 'purchase', 'view', 'logout']
const stockSymbols: string[] = ['AAPL', 'GOOG', 'AMZN', 'MSFT', 'TSLA']

// Simulate user activity
setInterval(() => {
  const user: User = {
    id: Math.floor(Math.random() * 1000),
    name: `User${Math.floor(Math.random() * 100)}`,
    type: userTypeOptions[Math.floor(Math.random() * userTypeOptions.length)],
    action:
      userActionOptions[Math.floor(Math.random() * userActionOptions.length)],
    timestamp: Date.now()
  }

  console.log(
    `➡️ New user action: ${user.name} (${user.type}) - ${user.action}`
  )
  userActions.next(user)
}, 3000)

// Simulate stock price changes
setInterval(() => {
  const stock: StockPrice = {
    symbol: stockSymbols[Math.floor(Math.random() * stockSymbols.length)],
    price: Math.floor(Math.random() * 1000) + 100,
    change: parseFloat((Math.random() * 20 - 10).toFixed(2)), // -10% to +10%
    timestamp: Date.now()
  }

  console.log(
    `➡️ Stock update: ${stock.symbol} @ $${stock.price} (${
      stock.change > 0 ? '+' : ''
    }${stock.change}%)`
  )
  stockPrices.next(stock)
}, 4000)

console.log('✅ Streams example running. Press Ctrl+C to exit.')
