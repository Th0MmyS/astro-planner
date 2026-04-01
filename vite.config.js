import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
  },
  server: {
    open: true,
  },
  plugins: [viteSingleFile()],
})
