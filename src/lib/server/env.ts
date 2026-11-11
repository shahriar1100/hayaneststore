function isRealValue(value: string | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("your-") || trimmed.includes("your-project-id")) return false;
  return true;
}

export function getBackendConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)?.trim();
  const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();

  const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  const adminEmail = process.env.ADMIN_EMAIL?.trim() || "admin@hayanestbd.com";
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || "hayanest-admin-2026";
  const adminSecret = process.env.ADMIN_SESSION_SECRET?.trim() || "hayanest-bd-session-secret-2026";

  const supabaseConfigured =
    isRealValue(supabaseUrl) &&
    (isRealValue(supabaseServiceRoleKey) || isRealValue(supabaseAnonKey));

  const supabaseWriteConfigured =
    isRealValue(supabaseUrl) && isRealValue(supabaseServiceRoleKey);

  const cloudinaryConfigured =
    isRealValue(cloudinaryCloudName) &&
    isRealValue(cloudinaryApiKey) &&
    isRealValue(cloudinaryApiSecret);

  return {
    supabaseUrl: supabaseUrl || "",
    supabaseAnonKey: supabaseAnonKey || "",
    supabaseServiceRoleKey: supabaseServiceRoleKey || "",
    supabaseConfigured,
    supabaseWriteConfigured,
    cloudinaryCloudName: cloudinaryCloudName || "",
    cloudinaryApiKey: cloudinaryApiKey || "",
    cloudinaryApiSecret: cloudinaryApiSecret || "",
    cloudinaryConfigured,
    adminEmail,
    adminPassword,
    adminSecret,
  };
}
