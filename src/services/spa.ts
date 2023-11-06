import { FastifyInstance, FastifyReply } from 'fastify'
import path from 'path'
import { dirIsParent } from '../util/helpers'
import fs from 'fs-extra'
import { FileCache } from '../controllers/fileCache'
import dotenv from 'dotenv'
import mime from 'mime-types'
import { SSRRecord } from '../types'
import { getSSRData } from './ssr'
import { parse } from 'node-html-parser'
dotenv.config();


const ssr = fs.readJSONSync(process.env.SSR as string, 'utf-8') as SSRRecord[];

console.log(ssr);


const fileCacheLifetime = Number(process.env.FILE_CACHE_LIFETIME);
if (isNaN(fileCacheLifetime)) {
  console.error('FILE_CACHE_LIFETIME is not a number');
  
}
const fileCache = new FileCache(fileCacheLifetime);

export function useSPA(server: FastifyInstance, baseDir: string) {
  server.get('/*', async (request, reply) => {
    const requestPath = (request.params as { [k: string]: string; })['*'];
    console.log('...requestPath', requestPath);
    
    const pathFileLocation = path.resolve(baseDir, requestPath);
    const indexFileLocation = path.resolve(baseDir, 'index.html');

    const query = Object.assign({}, request.query as { [k: string]: string; });
    
    const ssrRecord = ssr.find(record => {
      return record.origins.some(originRegexStr => {
        const regex = new RegExp(originRegexStr);
        return regex.test('/' + requestPath);
      });
    });

    if (dirIsParent(path.resolve(baseDir), pathFileLocation) && await fs.pathExists(pathFileLocation) && (await fs.stat(pathFileLocation)).isFile()) {
      //reply.send(await fileCache.getFile(pathFileLocation));
      await sendFile(reply, pathFileLocation);
    }
    else if ('raw' in query) {
      //reply.send(await fileCache.getFile(indexFileLocation));
      await sendFile(reply, indexFileLocation);
    }
    else if (!ssrRecord) {
      //reply.send(await fileCache.getFile(indexFileLocation));
      await sendFile(reply, indexFileLocation);
    }
    else {
      const baseurl = process.env.BASE_URL ?? `http://localhost:${ process.env.PORT }`;
      const url = `${ baseurl }/${ requestPath }?${ new URLSearchParams({ raw: 'true' }).toString() }`;
      console.time('get ssr data');
      const [ data, indexRaw ] = await Promise.all([ getSSRData(url, ssrRecord.track), fs.readFile(indexFileLocation, 'utf8') ]);
      console.timeEnd('get ssr data');

      const root = parse(indexRaw);
      const head = root.querySelector('head');

      if (head) {
        for (const key in data.meta) {
          const value = data.meta[key as keyof typeof data.meta];
          
          if (value) {
            const rawMetaTag = (() => {
              if (key === 'title') {
                return `<title>${ value }</title>`;
              }
              else {
                return `<meta property="${ key }" content="${ value }" />`
              }
            })();
            
            head.insertAdjacentHTML('beforeend', rawMetaTag);
          }
        }

        for (const key in data.xhr) {
          const value = data.xhr[key as keyof typeof data.xhr];
          const rawMetaTag = (() => {
            return `<meta property="xhr-ssr:${ key }" content="${ value.toString('base64') }" />`
          })();
          head.insertAdjacentHTML('beforeend', rawMetaTag);
        }
        
      }
      
      
      reply.header('Content-Type', 'text/html');
      reply.send(root.toString());
    }
    
    //reply.send('index.html', baseDir)
  });
}


export async function sendFile(reply: FastifyReply, filePath: string) {
  const buffer = await fileCache.getFile(filePath);
  const contentType = mime.lookup(filePath) || 'application/octet-stream';
  reply.header('Content-Type', contentType);
  reply.send(buffer);
}