export const THEME_STORAGE_KEY = "noor-theme";

// Runs in the document head before first paint, including before React hydrates.
// Only a theme preference is stored; no account or user data is needed.
export const themeInitScript = `(() => {
  let preference = null;
  try { preference = localStorage.getItem('${THEME_STORAGE_KEY}'); } catch {}
  if (preference !== 'light' && preference !== 'dark') preference = null;
  const theme = preference || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference || 'system';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#171513' : '#ffffff';
})();`;
