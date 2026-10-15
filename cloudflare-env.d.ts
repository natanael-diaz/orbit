declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    X_BEARER_TOKEN?: string;
    OPENAI_API_KEY?: string;
    OPENAI_BASE_URL?: string;
    OPENAI_MODEL?: string;
    ORBIT_PUBLIC_ORIGINS?: string;
    ORBIT_SETUP_TOKEN?: string;
  }
}
