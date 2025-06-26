interface BenchmarkResult {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    duration: number;
    requestsPerSecond: number;
    avgLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    minLatency: number;
    maxLatency: number;
    errorRate: number;
    throughputMB: number;
}
declare class CyreBenchmarkClient {
    private host;
    private port;
    private keepAliveAgent;
    constructor(host?: string, port?: number);
    private makeRequest;
    private runConcurrentRequests;
    private calculateMetrics;
    benchmark(path: string, concurrent: number, totalRequests: number): Promise<BenchmarkResult>;
    private printResults;
    runFullBenchmarkSuite(): Promise<void>;
    destroy(): void;
}
export { CyreBenchmarkClient };
