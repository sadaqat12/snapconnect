# 🔒 Security Setup - GitLeaks Integration

## Overview

GitLeaks is now configured to prevent secrets from being accidentally committed to the SnapConnect repository. This protects sensitive data like API keys, tokens, and credentials.

## ✅ What's Protected

The system will detect and prevent commits containing:

- **OpenAI API Keys**: `sk-...` patterns
- **Supabase URLs**: `https://[id].supabase.co` patterns  
- **Supabase Keys**: JWT token patterns
- **Environment Variables**: 
  - `EXPO_SUPABASE_URL`
  - `EXPO_SUPABASE_ANON_KEY` 
  - `EXPO_OPENAI_KEY`
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_OPENAI_KEY`
  - `OPENAI_API_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## 🛠️ How It Works

### Automatic Pre-Commit Check
Every time you commit, GitLeaks automatically scans your staged changes:

```bash
git add .
git commit -m "Your commit message"
# GitLeaks runs automatically and either:
# ✅ Allows commit if no secrets found
# ❌ Blocks commit if secrets detected
```

### Manual Scanning
You can manually scan for secrets anytime:

```bash
# Scan entire repository
gitleaks detect --source . --config .gitleaks.toml

# Scan only staged files
gitleaks protect --staged --config .gitleaks.toml

# Scan specific files
gitleaks detect --source ./specific-file.js --config .gitleaks.toml
```

## 📁 Safe Files (Allowlisted)

These files are allowed to contain example/configuration patterns:

- Documentation files: `README.md`, `CAPTION_COMPASS_GUIDE.md`, etc.
- Test files: `test_*.js`, `process_*.js`  
- Supabase config: `supabase/config.toml`
- Migration files: `supabase/migrations/`
- Node modules: `node_modules/`

## ✅ Safe Patterns

These patterns are **SAFE** and won't trigger alerts:

```javascript
// ✅ Environment variables (recommended)
const apiKey = process.env.OPENAI_API_KEY
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL

// ✅ Expo environment variables
EXPO_PUBLIC_SUPABASE_URL=your-url-here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-key-here
```

```toml
# ✅ Supabase config environment references
openai_api_key = "env(OPENAI_API_KEY)"
auth_token = "env(SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN)"
```

## ❌ Dangerous Patterns

These patterns **WILL BE BLOCKED**:

```javascript
// ❌ Hardcoded secrets
const apiKey = 'sk-abc123def456...'
const supabaseUrl = 'https://abc123.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

// ❌ Environment variable assignments with actual values
OPENAI_API_KEY=sk-abc123def456...
EXPO_PUBLIC_SUPABASE_URL=https://abc123.supabase.co
```

## 🚨 If GitLeaks Blocks Your Commit

1. **Review the flagged content** - Is it a real secret?

2. **If it's a real secret:**
   ```bash
   # Remove the secret and use environment variables instead
   git reset HEAD~1  # Undo the commit
   # Edit files to use process.env.VARIABLE_NAME
   # Add to .env file (make sure .env is in .gitignore!)
   ```

3. **If it's a false positive:**
   - Add the pattern to `.gitleaks.toml` allowlist
   - Or add the file to the paths allowlist

4. **Emergency bypass (NOT RECOMMENDED):**
   ```bash
   git commit --no-verify -m "Your message"
   ```

## 🔧 Configuration Files

- **`.gitleaks.toml`** - Main configuration with rules and allowlists
- **`.git/hooks/pre-commit`** - Automatic hook that runs on commits

## 🏗️ Integration with CI/CD

Add to your GitHub Actions workflow:

```yaml
- name: Run GitLeaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}
```

## 📚 Best Practices

1. **Never commit real secrets** - Always use environment variables
2. **Use `.env` files locally** - Add `.env` to `.gitignore`
3. **Use Supabase/Vercel/Expo environment variable systems** for deployment
4. **Review GitLeaks alerts carefully** - Don't just bypass them
5. **Keep the allowlist minimal** - Only add truly safe patterns

## 🆘 Need Help?

- Check GitLeaks documentation: https://github.com/gitleaks/gitleaks
- Review this project's `.gitleaks.toml` for examples
- Ask team members about environment variable setup

---

**🛡️ Remember: Security is everyone's responsibility. Keep secrets out of git!** 