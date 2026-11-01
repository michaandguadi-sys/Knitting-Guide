# KnitVision - AI Photo to Knitting Pattern Engine 🧶📱

Translates garment photos into verified, mathematically compiled row-by-row knitting patterns, stitch charts, and interactive counters for smartphones and web.

---

## 📱 Mobile-First Features (Optimized for your Phone)

- **📸 Direct Camera Capture:** Take a photo of any knitted hat, scarf, or garment directly from your phone camera or camera roll.
- **⚡ Instant Client-Side Analysis & Offline Mode:** 100% functional without a backend server! Extracts color palettes and anatomical structures directly in your browser.
- **🧠 Google Gemini 2.5 Flash Vision (Optional):** Add your free Google Gemini API key in **Ajustes / Settings** for deep computer vision deconstruction of complex stitches, crown decrease radials, and folded hems.
- **🔢 Big-Thumb Row Counter:** Giant tactile `+1` button designed to be tapped with your thumb while knitting with yarn in both hands.
- **💡 Screen Wake Lock API:** Keeps your phone screen awake while on the row counter so you never have to unlock your phone with busy hands.
- **📳 Haptic Feedback:** Physical tactile vibration when advancing rows on mobile devices.
- **📊 Interactive Stitch Grid:** Zoomable stitch chart with CYC & Argentine stitch symbols.
- **💾 Local Storage Persistence:** Automatically saves your projects and progress on your phone.
- **📲 Installable PWA:** Add to your iPhone or Android home screen for a full-screen, native-app feel.

---

## 🚀 How to Deploy to GitHub Pages

This repository is pre-configured with a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and publishes your site to GitHub Pages whenever you push to `main`.

### Step 1: Create a Repository on GitHub
1. Go to [GitHub.com/new](https://github.com/new) and create a repository (e.g. `knitvision` or `KnitVision---AI-Photo-to-Knitting-Pattern-Engine`).
2. Do **not** initialize with README or license (you already have them here).

### Step 2: Push your Code to GitHub
Run the following commands in your terminal:

```bash
git add .
git commit -m "feat: Mobile MVP with GitHub Pages deployment and client vision"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git branch -M main
git push -u origin main
```

### Step 3: Enable GitHub Pages in Repository Settings
1. Open your repository on GitHub.
2. Navigate to **Settings** > **Pages** (in the left sidebar).
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` will automatically trigger, build the static Vite application, and deploy it to:
   ```
   https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/
   ```

### Step 4: Open on your Phone
1. Open the GitHub Pages URL on your iPhone Safari or Android Chrome.
2. **On iPhone (Safari):** Tap the **Share** button > **Add to Home Screen**.
3. **On Android (Chrome):** Tap the **3-dots menu** > **Install App** or **Add to Home Screen**.
4. Enjoy your mobile knitting pattern companion!

---

## 💻 Local Development

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Run unit tests (mathematical compiler verification)
npm test

# 3. Start local development server
npm run dev
# or
npm run preview
```
