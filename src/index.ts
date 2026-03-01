import express from 'express';
import { initDb } from './db/database';
import identifyRouter from './routes/identify';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/', identifyRouter);

// Initialise DB schema then start server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Bitespeed Identity Service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });

export default app;
