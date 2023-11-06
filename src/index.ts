import Fastify from 'fastify'
import dotenv from 'dotenv'
import { useSPA } from './services/spa'

dotenv.config();

const server = Fastify({
  logger: false,
  requestTimeout: 30000
});

useSPA(server, 'public');


const port = Number(process.env.PORT);
 
server.listen({ port }, function (err, address) {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
 
  server.log.info(`Fastify is listening on port: ${ address }`);
});