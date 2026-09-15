import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.argv[2] || '.');
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp' };
createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://localhost');
    let file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + sep)) throw Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = resolve(file,'index.html');
    const data = await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
  } catch { res.writeHead(404);res.end('Arquivo não encontrado'); }
}).listen(5173,'127.0.0.1',()=>console.log('Tacet: http://127.0.0.1:5173'));
