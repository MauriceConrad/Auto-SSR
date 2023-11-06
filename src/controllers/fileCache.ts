//import os from 'node:os'
import crypto from 'node:crypto'
import fs from 'fs/promises'


export function hash(data: string | Buffer) {
  return crypto.createHash('md5').update(data).digest('hex');
}

export class FileCache {
  cache = new Map<string, Buffer>();
  constructor(private lifetime: number) {

  }
  async getFile(path: string) {
    const pathHash = hash(path);
    if (!this.cache.has(pathHash)) {
      this.cache.set(pathHash, await fs.readFile(path));
      setTimeout(() => {
        this.cache.delete(pathHash);
      }, this.lifetime * 1000);
    }
    return this.cache.get(pathHash) as Buffer;
  }
}