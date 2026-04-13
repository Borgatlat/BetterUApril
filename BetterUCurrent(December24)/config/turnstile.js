// Turnstile Configuration
// Get these keys from: https://dash.cloudflare.com/?to=/:account/turnstile

export const TURNSTILE_CONFIG = {
  // Your Turnstile Site Key (public - safe to expose)
  SITE_KEY: '0x4AAAAAABtXVQnZXX-XloE4',
  
  // Your Turnstile Secret Key (private - keep secure)
  SECRET_KEY: '0x4AAAAAABtXVeawZhPT_w_EV4MFUjk5oA8',
  
  // Turnstile API endpoint
  API_URL: 'https://challenges.cloudflare.com/turnstile/v0',
};

// Usage:
// import { TURNSTILE_CONFIG } from '../config/turnstile';
// 
// In your component:
// <TurnstileCaptcha siteKey={TURNSTILE_CONFIG.SITE_KEY} />
// 
// In your Supabase config:
// secret = "YOUR_TURNSTILE_SECRET_KEY_HERE"
