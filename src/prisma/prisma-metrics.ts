import { Prisma } from '@prisma/client';
import client from 'prom-client';

// Create the histogram metric for Prometheus
const prismaQueryDuration = new client.Histogram({
  name: 'prisma_query_duration_seconds',
  help: 'Duration of Prisma queries in seconds',
  labelNames: ['model', 'action'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
});

export const prismaMetricsExtension = Prisma.defineExtension((prismaClient) => {
  return prismaClient.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        const startTime = process.hrtime();
        
        return query(args).finally(() => {
          const [seconds, nanoseconds] = process.hrtime(startTime);
          const durationInSeconds = seconds + nanoseconds / 1e9;
          
          if (model) {
            prismaQueryDuration.labels({ model, action: operation }).observe(durationInSeconds);
          }
        });
      },
    },
  });
});
