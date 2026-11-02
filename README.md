# KnitVision - AI Photo to Knitting Pattern Engine 🧶📱

Reads a photo of a knitted piece, works out what it is and how it was made, and writes it out step by step with a row counter, on your phone or the web.

---

## How it reads a photo

1. **Clean.** Checks the photo first (size, sharpness, exposure, glare, colour cast) and says how to retake it. Removes the surface behind the piece. A close-up keeps all of its fabric.
2. **Reveal.** Evens out the light and builds a grey *stitch map* where the stitch structure shows whatever the yarn colour.
3. **Measure.** Finds the stitch and row size, the texture (columns, ridges, Vs, bumps), the yarn colours and how they are laid out, separately for the top, middle and bottom of the piece.
4. **Identify.** With a Gemini key, the AI first writes down only what it can see, then reasons from that record using knitters' rules. Results are checked against the measurements, and disagreements are flagged.
5. **How it was made.** Round or flat, bottom-up or top-down, folded brim, crown wedges, hand or machine. Each result shows its evidence and how sure the app is.
6. **Ask.** Anything uncertain becomes a plain question about the real piece. Your answer always wins.

Nothing is invented. Without a key the app says it only has measurements and stays below the "sure" line, because measurements alone misread some real fabric (see below). If the AI call fails, the app tells you why.

## How the pattern is written

Every row is generated stitch by stitch, so the written text, the chart and the row counter all come from the same data.

- **Worked in the round or flat.** Wrong-side rows are the true mirror of the right side, so garter in the round alternates knit and purl rounds, while flat garter is knit every row.
- **Hats** bottom-up or top-down, in the round or flat with a seam. **Cowls** and **scarves** in their own shapes. A stitch that curls gets a border.
- **Sweaters and cardigans** are decoded, but only a test swatch is written. The app says so instead of passing off a hat as a sweater.
- **Cables, lace and motifs** are recognised by the AI, but written as size and shape only, with a warning.
- **A swatch comes first**, and a measured width turns the stitch count in the photo into a real gauge.
- **The row counter** counts every real round, shows which side faces you, and saves every tap.

## Tests

```bash
npm test
```

Runs the stitch counter over thousands of garment, stitch, method and gauge combinations, the vision stages on generated fabric, and the AI client against a fake server, including failures.

To score the stitch reading on your own labelled photos, name them like `garter_1.jpg` or `rib_2.jpg` and run:

```bash
npm run bench:real -- path/to/photos
```

On 14 labelled photos from Wikimedia Commons, measurements alone were right on 6, said "unsure" on 4, and were wrong on 4: three cables, where the reading describes the fabric around the cable, and one fuzzy pair of mitts. That is why a measured result is never treated as certain and the app asks you to confirm it. Accuracy with the AI step has not been measured yet.

## Privacy

Without a key nothing leaves the phone. With a key, photos go to Google for analysis. The key is stored only in this browser and is sent in a request header, never in a URL.

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

# 2. Run the tests
npm test

# 3. Start the app
npm run dev
```
