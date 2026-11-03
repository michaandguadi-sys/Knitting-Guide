# KnitVision - AI Photo to Knitting Pattern Engine 🧶📱

Reads a photo of a knitted piece, works out what it is and how it was made, and writes it out step by step with a row counter, on your phone or the web.

---

## How it reads a picture

One picture is enough, including a saved one from Pinterest. You don't need the piece itself. You can analyse all of it, or tap just one part such as a collar or a cable.

1. **Clean.** Checks the picture (size, sharpness, exposure, glare, colour cast) and removes the surface behind the piece.
2. **Reveal.** Evens out the light and builds a grey *stitch map* where the stitch structure shows whatever the yarn colour.
3. **Measure.** Finds the stitch and row size, the texture (columns, ridges, Vs, bumps), the yarn colours and how they are laid out.
4. **Identify.** Claude first writes down only what it can see, then reasons from that record using knitters' rules. Results are checked against the measurements, and disagreements are flagged.
5. **How it was made.** Round or flat, bottom-up or top-down, folded brim, crown wedges, hand or machine. Each result shows its evidence and how sure the app is.
6. **Ask and correct.** While it works, the screen shows what has really been found so far. Anything uncertain then becomes one plain question at a time, next to the picture with the place to look marked, and "I can't tell from the picture" keeps the most likely answer. It can ask how the crown closes, whether the piece looks handmade, how the colours are arranged and how many stitches fit across a finger, which sets the yarn and needle. If something looks wrong, write a note or tap the spot on the picture, and Claude looks again. A claim that the picture clearly contradicts gets a reasoned reply, not blind agreement.

Nothing is invented. Without a key the app says it only has measurements and asks more. If the AI call fails, the app tells you why.

## How the pattern is written

Every row is generated stitch by stitch, so the written text, the chart and the row counter all come from the same data.

- **Worked in the round or flat.** Wrong-side rows are the true mirror of the right side, so garter in the round alternates knit and purl rounds, while flat garter is knit every row.
- **Hats** bottom-up or top-down, in the round or flat with a seam. **Cowls** and **scarves** in their own shapes. A rib hat's crown decreases the purl columns first so that the ribs run into the centre, unless you say the picture shows lines of decreases, and a rib brim uses a needle half a size smaller. A stockinette scarf is written as a tube, because a narrow border does not stop it rolling.
- **Starting gauges differ by fabric**, for example many more rows for garter. They are labelled as estimates, and your swatch decides.
- **Sweaters and cardigans** are decoded, but only a test swatch is written. The app says so instead of passing off a hat as a sweater.
- **Cables, lace, motifs, sweaters and selected parts** also get steps written by the AI from the picture. These are clearly marked: they have not been through the stitch check, and numbers can be estimates.
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

To compare the AI services on labelled photos, which spends money on your keys:

```bash
npm run bench:ai -- path/to/photos
```

Results on 14 labelled photos from Wikimedia Commons, one picture each:

| Reader | Right | Unsure | Wrong and sure |
|---|---|---|---|
| Measurements only | 6 | 4 | 4 |
| Claude Opus 5.5 | 13 | 1 (wrong, flagged as unsure) | 0 |

A hat counts as right when its body or its brim matches the label. The prompts were adjusted after a first run on these same photos, so these numbers may be somewhat optimistic for new pictures. The set is small and is not a statistical accuracy figure. Five of these pictures were also read correctly at 474 px wide, the size of a small Pinterest pin. A decode costs about 12 US cents and takes about 45 seconds. These counts were repeated after adding expert reading rules, with the same result.

## Privacy

Without a key nothing leaves the phone. With a key, photos go to the AI service you chose for analysis. The key is stored only in this browser and is sent in a request header, never in a URL.

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
