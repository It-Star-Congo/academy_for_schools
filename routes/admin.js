const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();

// Les 4 catégories disponibles
const categories = ['auth', 'interaction', 'profile', 'general'];

router.get('/logs', (req, res) => {
  const category = req.query.category || 'general';
  const date     = req.query.date;   // format YYYY-MM-DD

  // 1) liste des fichiers
  const logDir = path.join(process.cwd(), 'logs', category);
  let files = [];
  if (fs.existsSync(logDir)) {
    files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
  }

  // 2) extrais les dates
  const dates = files.map(f => f.replace(`${category}-`, '').replace('.log',''));

  // 3) choisis le fichier
  let filename;
  if (date && dates.includes(date)) {
    filename = `${category}-${date}.log`;
  } else if (dates.length) {
    filename = `${category}-${dates.sort().reverse()[0]}.log`;
  }

  // 4) lit & parse
  let logs = [];
  if (filename) {
    const content = fs.readFileSync(path.join(logDir, filename), 'utf8');
    logs = content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line); }
        catch { return { raw: line }; }
      });
  }

  // 5) **aplatit** meta dans le log
  logs = logs.map(log => {
    if (log.meta && typeof log.meta === 'object') {
      // extrait meta et replace tout au 1er niveau
      const { meta, ...rest } = log;
      return { ...rest, ...meta };
    }
    return log;
  });

  // 6) render
  res.render('admin/logs', {
    categories,
    category,
    dates,
    selectedDate: filename ? filename.replace(`${category}-`, '').replace('.log','') : null,
    logs
  });
});

/**
 * Export JSON de TOUS les logs d’une catégorie
 * URL : /admin/logs/export?category=auth
 */
router.get('/logs/export', (req, res) => {
  const category = req.query.category || 'general';
  const logDir   = path.join(process.cwd(), 'logs', category);
  let exportLogs = [];

  if (fs.existsSync(logDir)) {
    const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
    files.forEach(file => {
      const content = fs.readFileSync(path.join(logDir, file), 'utf8');
      content
        .split('\n')
        .filter(line => line.trim())
        .forEach(line => {
          try {
            exportLogs.push(JSON.parse(line));
          } catch (_) { /* ignore */ }
        });
    });
  }

  const filename = `${category}-logs.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(exportLogs, null, 2));
});

module.exports = router;
