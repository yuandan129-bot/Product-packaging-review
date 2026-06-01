import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

export function getRedis(): Redis {
  if (_redis) return _redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    throw new Error('Upstash Redis 未配置（UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN）')
  }

  _redis = new Redis({ url, token })
  return _redis
}
