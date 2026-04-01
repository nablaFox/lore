import adapter from '@sveltejs/adapter-static'
import { relative, sep } from 'node:path'
import { lore } from './src/lib/lore.ts'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    runes: ({ filename }) => {
      const relativePath = relative(import.meta.dirname, filename)
      const pathSegments = relativePath.toLowerCase().split(sep)
      const isExternalLibrary = pathSegments.includes('node_modules')

      return isExternalLibrary ? undefined : true
    }
  },
  kit: {
    adapter: adapter({
      pages: 'docs',
      assets: 'docs',
      fallback: null,
      precompress: false
    }),

    paths: {
      base: '/lore'
    }
  },
  preprocess: [lore()],
  extensions: ['.svelte', '.md']
}

export default config
