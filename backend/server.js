require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const macroRoutes = require('./routes/macroRoutes');
const { errorHandler, notFoundHandler } = require('./utils/errorHandlers');

const app = express();
const port = process.env.PORT || 3000;
const frontendDir = path.join(__dirname, '..', 'frontend');

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const allowAllOrigins = !allowedOrigins.length || allowedOrigins.includes('*');

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed: ${origin}`));
    },
  })
);
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));
app.use(express.static(frontendDir));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'vendor-follow-up-dashboard', timestamp: new Date().toISOString() });
});

app.use('/', macroRoutes);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/upload') || req.path.startsWith('/analyze') || req.path.startsWith('/run') || req.path.startsWith('/download') || req.path === '/health') {
    next();
    return;
  }

  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Backend started on http://localhost:${port}`);
});
