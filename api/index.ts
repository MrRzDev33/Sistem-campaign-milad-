import express from 'express';
import dotenv from 'dotenv';
import { handleUpdateUser, handleDeleteUser } from '../src/api/adminHandlers';

dotenv.config();

const app = express();
app.use(express.json());

// Handle preflight requests
app.options("*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE, PUT");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(204);
});

app.post('/api/admin/update-user', handleUpdateUser);
app.post('/api/admin/delete-user', handleDeleteUser);

// Catch-all for other /api routes
app.all("/api/*", (req, res) => {
  res.status(405).json({ error: `Method ${req.method} not allowed for ${req.url}` });
});

export default app;
