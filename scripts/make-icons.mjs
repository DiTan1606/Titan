// Xuất icon PNG cho PWA từ apps/web/icons/icon.svg
// Chạy: pnpm icons
import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const svg = readFileSync('apps/web/icons/icon.svg')
const out = 'apps/web/public'

const sizes = {
  'apple-touch-icon.png': 180, // iPhone màn hình chính
  'icon-192.png': 192,
  'icon-512.png': 512,
  'favicon-48.png': 48,
}

for (const [name, size] of Object.entries(sizes)) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(`${out}/${name}`, png)
  console.log(`✓ ${name} (${size}px, ${png.length} bytes)`)
}
writeFileSync(`${out}/favicon.svg`, svg)
console.log('✓ favicon.svg')
