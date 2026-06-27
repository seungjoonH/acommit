import { exec } from 'node:child_process';
import { ensureWebBuild } from '../utils/webBuild.js';
import { startServer } from '../web/server.js';
import logger from '../utils/logger.js';

export async function rulesCommand({ port = 3000, open: doOpen = true, cwd = process.cwd() } = {}) {
  try {
    await ensureWebBuild();
  } catch (err) {
    logger.error(`Web build failed: ${err.message}`);
    process.exit(1);
  }

  let server, actualPort;
  try {
    ({ server, port: actualPort } = await startServer(cwd, { port }));
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }

  const url = `http://localhost:${actualPort}`;
  logger.info(`acommit rules  →  ${url}`);
  logger.info('Press Ctrl+C to stop.');

  if (doOpen) {
    const cmd = process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
    exec(cmd, (err) => { if (err) logger.info(`Open ${url} in your browser.`); });
  }

  await new Promise((resolve) => {
    let shuttingDown = false;
    const finish = (code = 0) => {
      process.removeListener('SIGINT', shutdown);
      process.removeListener('SIGTERM', shutdown);
      resolve();
      process.exit(code);
    };
    const shutdown = () => {
      if (shuttingDown) { finish(1); return; }
      shuttingDown = true;
      logger.info('Shutting down…');
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      server.close(() => finish(0));
      setTimeout(() => finish(0), 1500);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
