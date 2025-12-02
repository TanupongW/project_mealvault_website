# Deployment Guide for MealVault

## Quick Start: Deploy to Vercel (Free)

### Prerequisites
- GitHub account
- Vercel account (sign up at https://vercel.com with GitHub)

---

## Step 1: Push to GitHub

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

---

## Step 2: Deploy Backend (API)

### Option A: Vercel (Recommended)

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure:
   - **Root Directory**: `Backend`
   - **Framework Preset**: Other
   - **Build Command**: (leave empty)
   - **Output Directory**: (leave empty)

4. Add Environment Variables (click "Environment Variables"):
   ```
   PORT=3000
   GEMINI_API_KEY=your_gemini_api_key_here
   SUPABASE_URL=https://hjecmsvuwexqdkhwylqw.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   JWT_SECRET=clvvOr2cxPJcB6KABNaZqdpaJj2glfrqa/hfb0J4gbsy8FJUehuF1lhRXzECATVf17uEqWjr2dxdQRVTMUkX1A==
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   EMAIL_USER=banked123456789@gmail.com
   EMAIL_PASS=inbjltcjxvnxowuu
   FRONTEND_URL=https://your-frontend.vercel.app
   GOOGLE_CLIENT_ID=495266507713-fdnqg3sivq16o3fkaceomeie6huprk1u.apps.googleusercontent.com
   ```

5. Click "Deploy"
6. After deployment, copy your backend URL (e.g., `https://your-backend.vercel.app`)

### Option B: Render

1. Go to https://render.com
2. New → Web Service
3. Connect your GitHub repo
4. Configure:
   - **Name**: mealvault-backend
   - **Root Directory**: Backend
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
5. Add all environment variables
6. Click "Create Web Service"

---

## Step 3: Deploy Frontend

1. Go to https://vercel.com/new
2. Import your GitHub repository AGAIN
3. Configure:
   - **Root Directory**: `Frontend/frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

4. Add Environment Variable:
   ```
   VITE_API_URL=https://your-backend.vercel.app
   ```

5. Update Frontend API URL:
   - Open `Frontend/frontend/src` files
   - Search for `http://localhost:3000`
   - Replace with `https://your-backend.vercel.app`
   - Or use environment variable: `import.meta.env.VITE_API_URL`

6. Click "Deploy"

---

## Step 4: Update Environment Variables

After both are deployed:

1. **Update Backend `.env` on Vercel:**
   - Go to your backend project settings
   - Update `FRONTEND_URL` to your frontend URL:
     ```
     FRONTEND_URL=https://your-frontend.vercel.app
     ```
   - Redeploy

2. **Update Google OAuth:**
   - Go to https://console.cloud.google.com
   - Add authorized origins:
     - `https://your-frontend.vercel.app`
   - Add authorized redirect URIs:
     - `https://your-frontend.vercel.app`

---

## Alternative: Deploy Both Together

### Railway (Full-Stack)
1. Go to https://railway.app
2. Connect GitHub
3. Deploy backend and frontend as separate services
4. Automatic domains provided

### Heroku (Backend)
```bash
# Install Heroku CLI
heroku login
heroku create mealvault-backend
git subtree push --prefix Backend heroku main
```

### Netlify (Frontend)
```bash
cd Frontend/frontend
npm run build
# Drag & drop dist folder to netlify.com
```

---

## Important Notes

✅ **Before deploying:**
- [ ] Remove console.logs with sensitive data
- [ ] Update CORS settings in `Backend/index.js`:
  ```javascript
  const cors = require('cors');
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173'
  }));
  ```
- [ ] Test all features locally
- [ ] Make sure `.env` is in `.gitignore`

✅ **After deploying:**
- [ ] Test forgot password with real email
- [ ] Test Google OAuth login
- [ ] Test image uploads
- [ ] Check all API endpoints

---

## Costs

- **Vercel**: Free tier (sufficient for most apps)
- **Render**: Free tier (sleeps after 15 min inactivity)
- **Railway**: $5/month credit
- **Netlify**: Free tier

---

## DNS & Custom Domain (Optional)

After deployment, you can add a custom domain:
1. Buy domain from Namecheap, GoDaddy, etc.
2. In Vercel: Settings → Domains → Add your domain
3. Update DNS records as instructed

Example: `www.mealvault.com` → Vercel deployment
