import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = join(scriptDirectory, "..", "public", "icons");

const icon = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="112" fill="#f4f0e7"/>
    <rect x="28" y="28" width="456" height="456" rx="92" fill="#201d18"/>
    <rect x="39" y="39" width="434" height="434" rx="82" fill="#f4f0e7"/>
    <circle cx="256" cy="256" r="172" fill="#201d18"/>

    <circle cx="373" cy="139" r="47" fill="#d75d3b"/>
    <circle cx="373" cy="139" r="24" fill="#e77959"/>

    <g fill="none" stroke="#f4f0e7" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
      <path d="M164 159v82c0 39 77 39 77 0v-82M202 159v207M309 159v207M309 159c59 0 74 47 74 78s-22 66-74 66"/>
    </g>

    <path d="M169 397h174" stroke="#d75d3b" stroke-width="13" stroke-linecap="round"/>
    <circle cx="256" cy="397" r="11" fill="#e77959"/>
    <circle cx="126" cy="327" r="6" fill="#f4f0e7"/>
    <circle cx="386" cy="317" r="5" fill="#f4f0e7"/>
  </svg>`;

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });

    await page.setContent(`
      <!doctype html>
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
        svg { display: block; width: 100%; height: 100%; }
      </style>
      ${icon}
    `);

    const outputPath = join(outputDirectory, `icon-${size}.png`);
    await page.screenshot({ path: outputPath, type: "png", omitBackground: false });
    await page.close();
    console.log(`Generated ${outputPath}`);
  }
} finally {
  await browser.close();
}
