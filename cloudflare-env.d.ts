declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    X_BEARER_TOKEN?: string;
    OPENAI_API_KEY?: string;
  }
}
