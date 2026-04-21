import express from "express";
import { createServer as createViteServer } from "vite";
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
  console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Admin features will not work.");
}

const supabaseAdmin = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Delete User from Supabase Auth
  app.post("/api/admin/delete-user", async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Admin SDK not configured" });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        // If user is already gone, consider it a success
        if (error.message.includes("User not found") || error.status === 404) {
          return res.json({ success: true, message: "User already deleted or not found in Auth" });
        }
        throw error;
      }
      res.json({ success: true, message: "User deleted successfully from Auth" });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API: Update User in Supabase Auth (Email/Phone and Password)
  app.post("/api/admin/update-user", async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Admin SDK not configured" });
    }

    const { userId, email, password } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

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
          return res.status(404).json({ error: "Akun login tidak ditemukan di sistem keamanan. Silakan hapus dan daftarkan ulang kasir ini." });
        }
        throw error;
      }
      res.json({ success: true, message: "User updated successfully in Auth" });
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
