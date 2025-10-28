# ![](/public/logo.png) ProVerse Live

An intelligent real-time system that listens to live speech (e.g., sermons, teachings, or prayers),
transcribes it into text, and automatically **suggests Bible verses** that match the context —
with optional **ProPresenter integration** for stage display.

Built with **Vite + React + Tailwind + Transformers.js**.

---

## ✨ Features

- **🎙 Live Speech Recognition**
  - Browser-based (Web Speech API)
  - or External Input (e.g., Scarlett, Behringer, any audio interface)
  - Stream mode allows capturing raw audio frames for external ASR (speech-to-text) engines

- **🧠 Real-Time Verse Suggestions**
  - Hybrid semantic + lexical + thematic algorithm
  - Learns from ongoing context to suggest the most relevant verses
  - Uses local or CDN-optimized AI embeddings (`Xenova/all-MiniLM-L6-v2`)

- **📖 History & Context**
  - Logs every suggestion, verse sent, and action
  - Exportable CSV log for later study or debugging

- **📡 ProPresenter Integration**
  - Send suggested verses directly to the stage as messages
  - Optionally search or open specific presentations automatically

- **🎨 Clean, Responsive UI**
  - Built with ShadCN UI components
  - Uses ProPresenter-style orange/black/white theme
  - Scrollable live transcript and suggestion panes


---

## 🚀 Setup Guide

### 1. Prerequisites

- Node.js ≥ 18  
- npm or pnpm  
- Modern browser (Chrome, Edge, or Safari recommended for speech recognition)

### 2. Install dependencies

```bash
npm install
```

### 3. Prepare Bible data

```bash
npm run prepare-all
```

### 4. Run locally

```bash
npm run dev
```

<video src="https://github.com/Meyiwa123/ProVerse-Live/raw/8638a413b8bb5dc5495cb4b427ce6893a50a3a87/public/demo.mp4" 
controls width="700">
  Your browser does not support the video tag.
</video>

## 🧠 Algorithm Overview

### 1. Speech to Text

The `LiveTranscript` component continuously listens to the microphone using the browser’s **Web Speech API**.

- Partial transcripts are displayed live in the UI.  
- When finalized, each line is timestamped and appended to the transcript history list.

---

### 2. Verse Matching Engine (`engine.ts`)

The verse suggestion engine is a **hybrid retrieval system**, combining multiple complementary search strategies.

#### 🔹 Dense (Semantic) Search

- Uses **sentence embeddings** from the transformer model  
  [`Xenova/all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2) via **Transformers.js**.  
- Each verse and transcript chunk is represented as a **384-dimensional vector**.  
- Verses are scored using **cosine similarity** between embeddings — capturing meaning, not just keywords.

#### 🔹 Lexical (BM25) Search

- Uses **FlexSearch** for keyword-based retrieval.  
- Effective for **exact phrases**, short queries, and traditional term matching.  
- Helps balance precision when the spoken input matches a known verse literally.

#### 🔹 Thematic Boosting

- Certain words (e.g., *faith*, *love*, *fear*, *grace*) trigger thematic boosts.  
- Verses that share those **themes** receive a small **+0.05 score bonus**.  
- Helps the system recognize emotional or topical intent even in paraphrased speech.

#### 🔹 Fusion (Reciprocal Rank Fusion)

Results from all three retrieval methods are merged using **Reciprocal Rank Fusion (RRF)** — a well-known technique for combining ranked lists.

<img alt="score formula" src="https://latex.codecogs.com/svg.image?\text{score}(id)=\sum_i\frac{1}{k+\text{rank}_i(id)}" />


This formula rewards items that appear **consistently high** across multiple search methods,
producing a more stable and balanced overall ranking.

#### 🔹 Hysteresis (Stability Control)

To avoid flickering or rapid changes in verse suggestions:

- A new verse must outperform the current top suggestion by **≥ 5% confidence** before replacing it.  
- This adds temporal stability and ensures smooth transitions between suggestions.


## 📜 ProPresenter License Notice

This project can interface with **ProPresenter** by **Renewed Vision**.  
You must obtain and use ProPresenter under a valid license from **Renewed Vision, LLC**.

---

⚠️ **Note:**  
This project does not include, distribute, or grant any rights to ProPresenter or its media content.  
Your use of ProPresenter remains subject to its **End User License Agreement (EULA)** and terms from Renewed Vision.

---

ProPresenter is a trademark of **Renewed Vision, LLC**.  
All other trademarks are the property of their respective owners.

---

✝️ **Hebrews 11:1 (KJV)**  

> “Now faith is the substance of things hoped for,  
> the evidence of things not seen.”  
> — *Hebrews 11:1*

