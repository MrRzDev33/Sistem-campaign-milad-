import express from "express";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
}

const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  : null;

export const app = express();
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Handle preflight requests
app.options("*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE, PUT");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(204);
});

// API: Delete User from Supabase Auth
app.post("/api/admin/delete-user", async (req, res) => {
  console.log("POST /api/admin/delete-user", req.body);
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Supabase Admin SDK not configured" });
  }

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      if (error.message.includes("User not found") || error.status === 404) {
        return res.json({ success: true, message: "User already deleted" });
      }
      return res.status(500).json({ error: error.message });
    }
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unknown server error" });
  }
});

// API: Update User in Supabase Auth
app.post("/api/admin/update-user", async (req, res) => {
  console.log("POST /api/admin/update-user", req.body);
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Supabase Admin SDK not configured" });
  }

  const { userId, email, password } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  try {
    const updateData: any = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No update data provided" });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);

    if (error) {
      if (error.message.includes("User not found") || error.status === 404) {
        return res.status(404).json({ error: "Akun login tidak ditemukan." });
      }
      if (error.message.includes("Email already exists")) {
        return res.status(400).json({ error: "Nomor HP (Email) sudah digunakan." });
      }
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, message: "User updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unknown server error" });
  }
});

// Catch-all for other /api routes
app.all("/api/*", (req, res) => {
  res.status(405).json({ error: `Method ${req.method} not allowed for ${req.url}` });
});

// Setup dev/prod middlewares
async function setupMiddlewares() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    // Dynamic import to avoid bundling vite in production/vercel
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    // Local production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

// Start locally if not on Vercel
if (!process.env.VERCEL) {
  setupMiddlewares().then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}
