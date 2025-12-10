import * as fs from 'fs/promises';
import * as path from 'path';

interface CacheData<T> {
  cache_data: T;
  is_valid_to: string; // ISO string date
  created_at: string;
}

export class CacheService {
  private static readonly CACHE_DIR = path.join(process.cwd(), 'cache');

  private static sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private static getCacheFilePath(cacheKey: string): string {
    const sanitizedKey = this.sanitizeKey(cacheKey);
    return path.join(this.CACHE_DIR, `${sanitizedKey}.json`);
  }

  private static async ensureCacheDir(): Promise<void> {
    try {
      await fs.access(this.CACHE_DIR);
    } catch {
      await fs.mkdir(this.CACHE_DIR, { recursive: true });
    }
  }

  static async executeWithCache<T>(
    cacheKey: string,
    method: () => Promise<T>
  ): Promise<T> {
    await this.ensureCacheDir();

    const filePath = this.getCacheFilePath(cacheKey);
    const now = new Date();

    try {
      // Try to read existing cache file
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const cacheData: CacheData<T> = JSON.parse(fileContent);

      const validTo = new Date(cacheData.is_valid_to);

      // Check if cache is still valid (is_valid_to > now)
      if (validTo > now) {
        console.log(`Cache hit for key: ${cacheKey}`);
        return cacheData.cache_data;
      }

      console.log(`Cache expired for key: ${cacheKey}`);
    } catch (error) {
      // File doesn't exist or is corrupted
      console.log(`Cache miss for key: ${cacheKey}`);
    }

    // Execute method and cache result
    console.log(`Executing method for key: ${cacheKey}`);
    const result = await method();

    // Set cache expiration to 1 hour from now
    const validTo = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

    const cacheData: CacheData<T> = {
      cache_data: result,
      is_valid_to: validTo.toISOString(),
      created_at: now.toISOString()
    };

    // Save to cache file
    await fs.writeFile(filePath, JSON.stringify(cacheData, null, 2));
    console.log(`Cached result for key: ${cacheKey}, valid until: ${validTo.toISOString()}`);

    return result;
  }

  static async clearCache(cacheKey?: string): Promise<void> {
    if (cacheKey) {
      // Clear specific cache
      const filePath = this.getCacheFilePath(cacheKey);
      try {
        await fs.unlink(filePath);
        console.log(`Cleared cache for key: ${cacheKey}`);
      } catch (error) {
        console.log(`Cache file not found for key: ${cacheKey}`);
      }
    } else {
      // Clear all cache
      try {
        const files = await fs.readdir(this.CACHE_DIR);
        for (const file of files) {
          if (file.endsWith('.json')) {
            await fs.unlink(path.join(this.CACHE_DIR, file));
          }
        }
        console.log('Cleared all cache files');
      } catch (error) {
        console.log('Error clearing cache directory');
      }
    }
  }
}