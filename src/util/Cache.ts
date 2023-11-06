import pLimit from 'p-limit'

//const pLimit = import('p-limit')

export default class Cache<T> {
  private refreshInterval: number;
  private maxAge: number;
  private cache: { [k: string]: { data: T | null; updated: number; created: number; __resolve: () => void; }; } = {};
  private updater: ReturnType<typeof setInterval>;
  constructor(refreshInterval = 60, maxAge = 3600) {
    this.refreshInterval = refreshInterval;
    this.maxAge = maxAge;

    this.updater = setInterval(async () => {
      const now = Date.now();
      const limit = pLimit(1);
      for (const url in this.cache) {
        const { updated } = this.cache[url];
        if (now - updated >= maxAge * 1000) {
          this.delete(url);
        }
        else {
          limit(() => this.cache[url].__resolve());
        }
      }
    }, refreshInterval * 1000);
  }
  private async update(url: string, resolver: () => Promise<T>) {

    const now = Date.now();


    if (!(url in this.cache)) {
      this.cache[url] = {
        created: now,
        updated: now,
        data: null,
        async __resolve() {
          console.log('resolve', url);
          this.data = await resolver();
        }
      }
    }

    await this.cache[url].__resolve();
    
  }
  delete(url: string) {
    console.log('delete', url);
    
    delete this.cache[url];
  }
  async get(url: string, resolver: () => Promise<T>) {
    if (!(url in this.cache)) {
      await this.update(url, resolver);
    }
    this.cache[url].updated = Date.now();
    
    return this.cache[url].data as T;
  }
}
