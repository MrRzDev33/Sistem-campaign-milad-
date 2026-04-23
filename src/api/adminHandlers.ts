import { createClient } from "@supabase/supabase-js";
import { Request, Response } from "express";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  : null;

export const handleDeleteUser = async (req: Request, res: Response) => {
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
};

export const handleUpdateUser = async (req: Request, res: Response) => {
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
};
