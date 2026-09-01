// Runs OCR in an isolated child process so that a hang or crash inside
// tesseract.js (e.g. a stalled language-data download, or an internal
// worker-thread error that bypasses normal promise rejection) can never
// take down the main Next.js server process. The parent spawns this file
// with a hard timeout and simply falls back to a heuristic title if it
// doesn't get a clean result in time.
//
// Usage: node ocr-worker.cjs <path-to-image>
// Prints JSON { text } on success, or { error } (with a non-zero exit
// code) on failure.

const { createWorker } = require("tesseract.js");

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    throw new Error("missing image path argument");
  }

  const worker = await createWorker("tha+eng");
  try {
    const { data } = await worker.recognize(imagePath);
    process.stdout.write(JSON.stringify({ text: data.text ?? "" }));
  } finally {
    await worker.terminate();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    process.stderr.write(JSON.stringify({ error: String(err?.message ?? err) }));
    process.exit(1);
  });

process.on("unhandledRejection", (err) => {
  process.stderr.write(JSON.stringify({ error: String(err) }));
  process.exit(1);
});
