import fs from 'fs-extra'
import path from 'path'
import Cache from '../util/Cache'
import puppeteer, { HTTPRequest, Page } from 'puppeteer'
import { SSRRecord } from '../types'
import dotenv from 'dotenv'
dotenv.config();

type MetaResolveOpts = {
  width: number;
  height: number;
  timeout: number;
}

type SSRData = {
  meta: {
    title?: string;
    'og:title'?: string;
    'og:image'?: string;
    'og:description'?: string;
    'og:type'?: string;
  };
  xhr: {
    [k: string]: Buffer;
  };
}

const screenshotLocation = path.resolve(process.env.OG_META_RESOURCES as string);
fs.ensureDir(screenshotLocation);

const cacheUpdateInterval = Number(process.env.CACHE_UPDATE_INTERVAL);
const cacheMaxAge = Number(process.env.CACHE_MAX_AGE);

console.log('cache update interval', cacheUpdateInterval);
console.log('cache max age', cacheMaxAge);


const browser = puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--use-gl=desktop'
  ],
  dumpio: false,
});

const ssrDataCache = new Cache<SSRData>(cacheUpdateInterval, cacheMaxAge);

export function getSSRData(url: string, track: SSRRecord['track']) {
  return ssrDataCache.get(url, () => resolveSSRData(url, {
    timeout: Number(process.env.ASYNC_OG_TIMEOUT),
    track
  }));
  // return resolveSSRData(url, {
  //   timeout: Number(process.env.ASYNC_OG_TIMEOUT),
  //   track
  // });
}

export async function resolveSSRData(url: string, { timeout, track }: { timeout: number; track: SSRRecord['track']; }): Promise<SSRData> {
  console.log('resolve ssr data', url);
  
  const page = await (await browser).newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36");
  //await page.setRequestInterception(true);

  const xhrPromises: { [k: string]: Promise<Buffer>; }= {};

  const handleRequestFinished = (request: HTTPRequest) => {
    if (track.xhr) {
      const xhrRecord = track.xhr.find(xhr => {
        const urlRegex = new RegExp(xhr.filter.url);
        const queryRegexes = Object.entries(xhr.filter.query).map(([ key, value ]) => {
          return [ key, new RegExp(value) ] as const;
        });
        if (!urlRegex.test(request.url())) {
          return false;
        }
        const query = new URL(request.url()).searchParams;
        for (const [ key, regex ] of queryRegexes) {
          const value = query.get(key) ?? '';
          if (value === null || !regex.test(value)) {
            return false;
          }
        }
        return true;
      });
      if (xhrRecord) {
        const xhrUrlPatternMatching = request.url().match(new RegExp(xhrRecord.filter.url));
        const xhrUrlVars = Array.from(xhrUrlPatternMatching ?? []).slice(1);

        const query = new URL(request.url()).searchParams;
        const xhrQueryVars = Object.entries(xhrRecord.filter.query).map(([ key, regexStr ]) => {
          const regex = new RegExp(regexStr);
          const xhrQueryMatching = Array.from(query.get(key)?.match(regex) ?? []).slice(1);
          return xhrQueryMatching;
        }).flat();

        const allVars = [ ...xhrUrlVars, ...xhrQueryVars ];

        const realCacheKey = xhrRecord.cacheKey.replace(/\$(\d+)/g, (_, index) => {
          return allVars[Number(index) - 1] ?? null;//xhrRecord.defaultVars[Number(index) - 1] ?? null;
        });
        const response = request.response();
        if (response) {
          xhrPromises[realCacheKey] = response.buffer();
        }
      }
    }
  }

  page.on('requestfinished', handleRequestFinished);
  
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Wait 1s
  await new Promise(resolve => setTimeout(resolve, 1000));

  page.removeAllListeners('requestfinished');

  const xhr = Object.fromEntries(await Promise.all(Object.entries(xhrPromises).map(async ([ key, promise ]) => [ key, await promise ] as const)));


  const meta: SSRData['meta'] = {};
  for (const metaKey of track.opengraph) {
    meta[metaKey as keyof typeof meta] = await page.evaluate((metaKey) => {
      return document.querySelector(`meta[property='${ metaKey }']`)?.getAttribute('content') ?? undefined;
    }, metaKey);
  }


  // Extract open graph meta tags
  return {
    meta: meta,
    xhr
  };

}
