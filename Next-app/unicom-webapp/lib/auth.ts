import infra_config from '../public/infra_config.json'; // Ensure infra_config is imported

const COGNITO_LOGIN_URL: string = infra_config.cognito_login_url;
const COGNITO_LOGOUT_URL: string = infra_config.cognito_logout_url;
const TOKEN_STRING = 'id_token';

/**
 * Removes the stored token and redirects the user to the logout URL.
 */
export function logout(): void {
  localStorage.removeItem(TOKEN_STRING);
  localStorage.removeItem("signedUrlData");
  window.location.href = COGNITO_LOGOUT_URL;
}

/**
 * Extracts the ID token from the URL fragment (#).
 */
export function getIdTokenFromUrl(): string | null {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get(TOKEN_STRING);
}

/**
 * Stores the given ID token in local storage.
 * @param idToken The ID token to store.
 */
export function storeIdToken(idToken: string): void {
  localStorage.setItem(TOKEN_STRING, idToken);
}

/**
 * Retrieves the stored ID token from local storage.
 */
export function getStoredIdToken(): string | null {
  return localStorage.getItem(TOKEN_STRING);
}

/**
 * Checks if the given token is expired.
 * @param token The JWT token to check.
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;

  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp: number };
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch (e) {
    return true;
  }
}

/**
 * Redirects the user to the Cognito login page.
 */
export function redirectToLogin(): void {
  window.location.href = COGNITO_LOGIN_URL;
}
