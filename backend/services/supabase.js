import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is missing in backend .env");
}

if (!supabaseSecretKey) {
  throw new Error("SUPABASE_SECRET_KEY is missing in backend .env");
}

export const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey
);