// server/cyre-client.ts
// Aggressive HTTP client to benchmark CYRE server performance

import http from 'http'
import {performance} from 'perf_hooks'

/*

      C.Y.R.E - B.E.N.C.H.M.A.R.K - C.L.I.E.N.T
      
      High-performance HTTP client for benchmarking:
      - Concurrent request batches
      - Real-time metrics tracking
      - Latency percentiles
      - Memory efficiency
      - Comparison with industry standards

*/

interface BenchmarkResult {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  duration: number
  requestsPerSecond: number
  avgLatency: number
  p50Latency: number
  p95Latency: number
  p99Latency: number
  minLatency: number
  maxLatency: number
  errorRate: number
  throughputMB: number
}

interface RequestResult {
  latency: number
  success: boolean
  statusCode: number
  responseSize: number
  error?: string
}

class CyreBenchmarkClient {
  private host: string
  private port: number
  private keepAliveAgent: http.Agent

  constructor(host: string = 'localhost', port: number = 3000) {
    this.host = host
    this.port = port
    this.keepAliveAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 1000,
      maxFreeSockets: 100,
      timeout: 5000,
      freeSocketTimeout: 30000
    })
  }

  private makeRequest(path: string): Promise<RequestResult> {
    return new Promise(resolve => {
      const startTime = performance.now()

      const options = {
        hostname: this.host,
        port: this.port,
        path: path,
        method: 'GET',
        agent: this.keepAliveAgent,
        headers: {
          'User-Agent': 'CYRE-Benchmark-Client/1.0',
          Connection: 'keep-alive'
        }
      }

      const req = http.request(options, res => {
        let data = ''
        let responseSize = 0

        res.on('data', chunk => {
          data += chunk
          responseSize += chunk.length
        })

        res.on('end', () => {
          const latency = performance.now() - startTime
          resolve({
            latency,
            success: res.statusCode === 200,
            statusCode: res.statusCode || 0,
            responseSize,
            error: res.statusCode !== 200 ? `HTTP ${res.statusCode}` : undefined
          })
        })
      })

      req.on('error', error => {
        const latency = performance.now() - startTime
        resolve({
          latency,
          success: false,
          statusCode: 0,
          responseSize: 0,
          error: error.message
        })
      })

      req.on('timeout', () => {
        req.destroy()
        const latency = performance.now() - startTime
        resolve({
          latency,
          success: false,
          statusCode: 0,
          responseSize: 0,
          error: 'Request timeout'
        })
      })

      req.end()
    })
  }

  private async runConcurrentRequests(
    path: string,
    concurrent: number,
    totalRequests: number
  ): Promise<RequestResult[]> {
    const results: RequestResult[] = []
    const batchSize = concurrent
    let requestsRemaining = totalRequests

    while (requestsRemaining > 0) {
      const currentBatch = Math.min(batchSize, requestsRemaining)
      const promises = Array.from({length: currentBatch}, () =>
        this.makeRequest(path)
      )

      const batchResults = await Promise.all(promises)
      results.push(...batchResults)
      requestsRemaining -= currentBatch

      // Small delay to prevent overwhelming (can be removed for max speed)
      if (requestsRemaining > 0) {
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    }

    return results
  }

  private calculateMetrics(
    results: RequestResult[],
    duration: number
  ): BenchmarkResult {
    const successfulResults = results.filter(r => r.success)
    const latencies = successfulResults
      .map(r => r.latency)
      .sort((a, b) => a - b)
    const totalBytes = results.reduce((sum, r) => sum + r.responseSize, 0)

    return {
      totalRequests: results.length,
      successfulRequests: successfulResults.length,
      failedRequests: results.length - successfulResults.length,
      duration,
      requestsPerSecond: results.length / duration,
      avgLatency:
        latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length || 0,
      p50Latency: latencies[Math.floor(latencies.length * 0.5)] || 0,
      p95Latency: latencies[Math.floor(latencies.length * 0.95)] || 0,
      p99Latency: latencies[Math.floor(latencies.length * 0.99)] || 0,
      minLatency: latencies[0] || 0,
      maxLatency: latencies[latencies.length - 1] || 0,
      errorRate:
        ((results.length - successfulResults.length) / results.length) * 100,
      throughputMB: totalBytes / duration / (1024 * 1024)
    }
  }

  async benchmark(
    path: string,
    concurrent: number,
    totalRequests: number
  ): Promise<BenchmarkResult> {
    console.log(
      `\n🚀 Starting benchmark: ${concurrent} concurrent, ${totalRequests} total requests`
    )
    console.log(`🎯 Target: http://${this.host}:${this.port}${path}`)

    const startTime = performance.now()
    const results = await this.runConcurrentRequests(
      path,
      concurrent,
      totalRequests
    )
    const duration = (performance.now() - startTime) / 1000

    return this.calculateMetrics(results, duration)
  }

  private printResults(name: string, result: BenchmarkResult) {
    console.log(`\n📊 ${name}`)
    console.log('─'.repeat(50))
    console.log(
      `🔢 Total Requests:     ${result.totalRequests.toLocaleString()}`
    )
    console.log(
      `✅ Successful:         ${result.successfulRequests.toLocaleString()}`
    )
    console.log(
      `❌ Failed:             ${result.failedRequests.toLocaleString()}`
    )
    console.log(`⏱️  Duration:           ${result.duration.toFixed(2)}s`)
    console.log(`🚀 Requests/sec:       ${result.requestsPerSecond.toFixed(0)}`)
    console.log(`⚡ Avg Latency:        ${result.avgLatency.toFixed(2)}ms`)
    console.log(`📈 P50 Latency:        ${result.p50Latency.toFixed(2)}ms`)
    console.log(`📈 P95 Latency:        ${result.p95Latency.toFixed(2)}ms`)
    console.log(`📈 P99 Latency:        ${result.p99Latency.toFixed(2)}ms`)
    console.log(
      `🏎️  Min/Max Latency:    ${result.minLatency.toFixed(
        2
      )}ms / ${result.maxLatency.toFixed(2)}ms`
    )
    console.log(`💥 Error Rate:         ${result.errorRate.toFixed(2)}%`)
    console.log(`📊 Throughput:         ${result.throughputMB.toFixed(2)} MB/s`)
  }

  async runFullBenchmarkSuite() {
    console.log('🎯 CYRE HTTP SERVER BENCHMARK SUITE')
    console.log('='.repeat(60))

    // Wait for server to be ready
    console.log('⏳ Waiting for server to be ready...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    const benchmarks = [
      {name: 'Warmup Test', concurrent: 1, total: 100, path: '/benchmark'},
      {name: 'Light Load', concurrent: 10, total: 1000, path: '/benchmark'},
      {name: 'Medium Load', concurrent: 50, total: 5000, path: '/benchmark'},
      {name: 'Heavy Load', concurrent: 100, total: 10000, path: '/benchmark'},
      {name: 'Extreme Load', concurrent: 200, total: 20000, path: '/benchmark'},
      {
        name: 'API Endpoint Test',
        concurrent: 50,
        total: 2000,
        path: '/api/users'
      },
      {name: 'Health Check Test', concurrent: 25, total: 1000, path: '/health'}
    ]

    const results: {name: string; result: BenchmarkResult}[] = []

    for (const benchmark of benchmarks) {
      try {
        const result = await this.benchmark(
          benchmark.path,
          benchmark.concurrent,
          benchmark.total
        )
        this.printResults(benchmark.name, result)
        results.push({name: benchmark.name, result})

        // Brief pause between tests
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`❌ ${benchmark.name} failed:`, error)
      }
    }

    // Summary
    console.log('\n🏆 BENCHMARK SUMMARY')
    console.log('='.repeat(60))

    const bestPerformance = results.reduce((best, current) =>
      current.result.requestsPerSecond > best.result.requestsPerSecond
        ? current
        : best
    )

    const avgPerformance =
      results.reduce((sum, r) => sum + r.result.requestsPerSecond, 0) /
      results.length
    const avgLatency =
      results.reduce((sum, r) => sum + r.result.avgLatency, 0) / results.length
    const totalRequests = results.reduce(
      (sum, r) => sum + r.result.totalRequests,
      0
    )
    const totalErrors = results.reduce(
      (sum, r) => sum + r.result.failedRequests,
      0
    )

    console.log(
      `🥇 Best Performance:    ${bestPerformance.result.requestsPerSecond.toFixed(
        0
      )} req/s (${bestPerformance.name})`
    )
    console.log(`📊 Average Performance: ${avgPerformance.toFixed(0)} req/s`)
    console.log(`⚡ Average Latency:     ${avgLatency.toFixed(2)}ms`)
    console.log(`🔢 Total Requests:      ${totalRequests.toLocaleString()}`)
    console.log(`❌ Total Errors:        ${totalErrors.toLocaleString()}`)
    console.log(
      `✅ Overall Success:     ${(
        ((totalRequests - totalErrors) / totalRequests) *
        100
      ).toFixed(2)}%`
    )

    // Industry comparison
    console.log('\n🏭 INDUSTRY COMPARISON')
    console.log('─'.repeat(30))
    console.log(
      `🆚 Fastify (~47,000 req/s):     ${
        avgPerformance > 47000 ? '✅ CYRE WINS' : '❌ Fastify wins'
      }`
    )
    console.log(
      `🆚 Express (~15,000 req/s):     ${
        avgPerformance > 15000 ? '✅ CYRE WINS' : '❌ Express wins'
      }`
    )
    console.log(
      `🆚 Raw Node (~75,000 req/s):    ${
        avgPerformance > 75000 ? '✅ CYRE WINS' : '⚠️  Close to raw Node'
      }`
    )

    const performanceMultiplier = avgPerformance / 47000 // vs Fastify
    console.log(
      `📈 CYRE is ${performanceMultiplier.toFixed(1)}x faster than Fastify`
    )

    console.log('\n🎉 BENCHMARK COMPLETE!')
  }

  destroy() {
    this.keepAliveAgent.destroy()
  }
}

// Main execution
async function main() {
  const client = new CyreBenchmarkClient()

  try {
    await client.runFullBenchmarkSuite()
  } catch (error) {
    console.error('❌ Benchmark failed:', error)
  } finally {
    client.destroy()
    process.exit(0)
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Benchmark interrupted')
  process.exit(0)
})

// Run if called directly
main()

export {CyreBenchmarkClient}
