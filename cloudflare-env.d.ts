declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ADMIN_USERNAME: string;
    ADMIN_PASSWORD: string;
    SESSION_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
  }
}
