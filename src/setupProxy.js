// Local development only: Create React App loads this file automatically for `npm start` (it is never part of the
// production build). It serves the Vercel serverless functions in /api from the same dev server, so the whole site
// runs locally with live data and hot reload, no `vercel dev` or login needed.
//
// The functions read their keys (FMP_KEY, POLYGON_KEY, ...) from process.env, which CRA fills from your local .env.
const fs = require('fs');
const path = require('path');

module.exports = function setupApi(app) {
  app.use('/api', (req, res, next) => {
    const name = req.path.replace(/^\//, '').replace(/[^a-z0-9-]/gi, '');
    const file = path.join(__dirname, '..', 'api', `${name}.js`);
    if (!name || name.startsWith('_') || !fs.existsSync(file)) return next();
    // Re-require the handler on each call so edits to api/*.js show up without restarting the dev server.
    delete require.cache[require.resolve(file)];
    Promise.resolve(require(file)(req, res)).catch((err) => {
      console.error(`[api/${name}]`, err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });
  });
};
