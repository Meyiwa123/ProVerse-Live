export async function testConnection() {
  try {
    const response = await fetch(
      "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/config.json"
    );
    if (response.ok) {
      console.log("✅ CDN accessible");
      return true;
    }
    console.error("❌ CDN returned", response.status);
    return false;
  } catch (e) {
    console.error("❌ Cannot reach CDN:", e);
    return false;
  }
}
testConnection();