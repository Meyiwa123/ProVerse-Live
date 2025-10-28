import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline, env } from "@xenova/transformers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure Transformers.js
env.allowLocalModels = false;
env.useBrowserCache = false;

const MODEL = "Xenova/all-MiniLM-L6-v2";

async function computeEmbeddings(verses, batchSize = 100) {
  console.log("🔄 Loading embedding model...");
  const embedder = await pipeline("feature-extraction", MODEL);
  console.log("✅ Model loaded");

  const embeddings = [];
  const total = verses.length;

  for (let i = 0; i < total; i += batchSize) {
    const batch = verses.slice(i, i + batchSize);
    const texts = batch.map(v => v.text);
    
    console.log(`⏳ Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(total / batchSize)} (verses ${i + 1}-${Math.min(i + batchSize, total)})`);
    
    // Process each text in the batch
    for (const text of texts) {
      const result = await embedder(text, { pooling: "mean", normalize: true });
      embeddings.push(Array.from(result.data)); // Convert Float32Array to regular array for JSON
    }
    
    // Progress indicator
    const progress = Math.round((Math.min(i + batchSize, total) / total) * 100);
    console.log(`   Progress: ${progress}%`);
  }

  console.log(`✅ Computed ${embeddings.length} embeddings`);
  return embeddings;
}

async function main() {
  const translation = (process.argv[2] || "KJV").toUpperCase();
  
  const publicDir = path.join(__dirname, "..", "public");
  const versesPath = path.join(publicDir, `${translation.toLowerCase()}.json`);
  const embeddingsPath = path.join(publicDir, `${translation.toLowerCase()}-embeddings.json`);
  
  // Check if verses file exists
  if (!fs.existsSync(versesPath)) {
    console.error(`❌ Error: ${versesPath} not found. Please run build-bible-kjv-gutenberg.js first.`);
    process.exit(1);
  }
  
  console.log(`📖 Reading verses from ${versesPath}...`);
  const verses = JSON.parse(fs.readFileSync(versesPath, "utf8"));
  console.log(`✅ Loaded ${verses.length} verses`);
  
  console.log("\n🚀 Starting embedding computation...");
  const startTime = Date.now();
  
  const embeddings = await computeEmbeddings(verses, 100);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`⏱️  Completed in ${duration}s`);
  
  // Save embeddings
  console.log(`💾 Saving embeddings to ${embeddingsPath}...`);
  fs.writeFileSync(
    embeddingsPath,
    JSON.stringify(embeddings),
    "utf8"
  );
  
  const sizeMB = (fs.statSync(embeddingsPath).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Saved embeddings (${sizeMB} MB)`);
  console.log(`\n🎉 Done! Use loadEmbeddedBible("${translation}") to load with pre-computed embeddings.`);
}

main().catch(console.error);