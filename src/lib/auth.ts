import { cookies } from "next/headers";

const SESSION_COOKIE = "pm_session";
const SESSION_VALUE = "authenticated";

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value === SESSION_VALUE;
}

export function validatePassword(password: string): boolean {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return false;
  return password === appPassword;
}

export { SESSION_COOKIE, SESSION_VALUE };
