import matter from 'gray-matter'
import { Lexer, type Token, type Tokens } from 'marked'
import type { PreprocessorGroup } from 'svelte/compiler'
import katex from 'katex'

interface Section {
  title: string
  rtime: number
  body: Token[]
}

const WPM = 200

export function lore(): PreprocessorGroup {
  return {
    name: 'lore',
    markup({ content, filename }) {
      if (!filename?.endsWith('.md')) return

      const { data: frontmatter, content: body } = matter(content)

      const { script: userScript, content: mdBody } = extractUserScript(body)

      const tokens = new Lexer().lex(renderLatex(mdBody))

      const github = (frontmatter.github as string) ?? ''

      const { title, description, sections } = extractStructure(tokens, github)

      const props = {
        author: frontmatter.author ?? '',
        title,
        github,
        rtime: sections.reduce((sum, s) => sum + s.rtime, 0),
        sections: sections.map(s => ({ title: s.title, rtime: s.rtime }))
      }

      const sectionSnippets = sections
        .map((s, i) => `{#snippet section_${i}()}\n${tokensToSvelte(s.body, github)}\n{/snippet}`)
        .join('\n')

      return {
        code: `
<script>
  import MdLayout from 'lore-kit/MdLayout.svelte'
  ${userScript}
  const __props = ${JSON.stringify(props)}
</script>
<MdLayout {...__props}>
  {#snippet description()}
    ${description}
  {/snippet}
  ${sectionSnippets}
</MdLayout>
`
      }
    }
  }
}

function extractUserScript(body: string): { script: string; content: string } {
  const match = body
    .replace(/`{3}[\s\S]*?`{3}|`[^`\n]*`/g, '')
    .match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/)

  if (!match || match.index === undefined) return { script: '', content: body }

  return {
    script: match[1].trim(),
    content: body.slice(0, match.index) + body.slice(match.index + match[0].length)
  }
}

function renderLatex(text: string) {
  const codeBlock = /(`{3}[\s\S]*?`{3}|`[^`\n]*`)/g

  return text
    .split(codeBlock)
    .map((part, i) => {
      if (i % 2 === 1) return part

      return part
        .replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) =>
          katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false })
        )
        .replace(/(?<!\$)\$(?!\$)([\s\S]*?)(?<!\$)\$(?!\$)/g, (_, tex) =>
          katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false })
        )
    })
    .join('')
}

function estimateReadTime(tokens: Token[]): number {
  return tokens.reduce((words, token) => {
    const textWords = (() => {
      if (!('text' in token)) return 0
      const count = (token as any).text.split(/\s+/).length
      return token.type === 'code' ? count * 0.5 : count
    })()

    const childWords = (() => {
      if (!('tokens' in token) || !Array.isArray((token as any).tokens)) return 0
      return estimateReadTime((token as any).tokens)
    })()

    const itemWords = (() => {
      if (!('items' in token) || !Array.isArray((token as any).items)) return 0
      return (token as any).items.reduce((sum: number, item: any) =>
        sum + (item.tokens ? estimateReadTime(item.tokens) : 0), 0)
    })()

    return words + textWords + childWords + itemWords
  }, 0)
}

function extractStructure(tokens: Token[], github: string) {
  const h1 = tokens.findIndex(t => t.type === 'heading' && t.depth === 1)
  const title = h1 !== -1 ? (tokens[h1] as any).text as string : 'Untitled'

  const h2Indices = tokens.reduce<number[]>((acc, t, i) => {
    if (t.type === 'heading' && t.depth === 2) acc.push(i)
    return acc
  }, [])

  const descEnd = h2Indices[0] ?? tokens.length

  const description = tokensToSvelte(tokens.slice(h1 + 1, descEnd), github)

  const sections: Section[] = h2Indices.map((start, i) => {
    const end = h2Indices[i + 1] ?? tokens.length

    const body = tokens.slice(start + 1, end)

    return {
      title: (tokens[start] as any).text as string,
      body,
      rtime: Math.max(1, Math.round(estimateReadTime(body) / WPM))
    }
  })

  return { title, description, sections }
}

function tokensToSvelte(tokens: Token[], github: string): string {
  const parts: string[] = []

  let htmlBuffer = ''

  const flushHtml = () => {
    if (!htmlBuffer) return
    parts.push(`{@html ${JSON.stringify(htmlBuffer)}}`)
    htmlBuffer = ''
  }

  for (const token of tokens) {
    if (isSvelteComponent(token)) {
      flushHtml()
      parts.push((token as Tokens.HTML).text.trim())
    } else {
      htmlBuffer += blockTokenToHtml(token, github)
    }
  }

  flushHtml()

  return parts.join('\n')
}

function tokensToHtml(tokens: Token[], github: string): string {
  return tokens.map(t => blockTokenToHtml(t, github)).join('')
}

function isSvelteComponent(token: Token): boolean {
  if (token.type !== 'html') return false
  return /^<[A-Z]/.test((token as Tokens.HTML).text.trim())
}

function blockTokenToHtml(token: Token, github: string): string {
  switch (token.type) {
    case 'paragraph': {
      const t = token as Tokens.Paragraph
      return `<p>${inlineTokensToHtml(t.tokens, github)}</p>`
    }
    case 'code': {
      const t = token as Tokens.Code
      const lang = t.lang ? ` class="language-${escapeAttr(t.lang)}"` : ''
      return `<pre><code${lang}>${escapeHtml(t.text)}</code></pre>`
    }
    case 'list': {
      const t = token as Tokens.List
      const tag = t.ordered ? 'ol' : 'ul'
      const items = t.items
        .map(item => `<li>${tokensToHtml(item.tokens, github)}</li>`)
        .join('')
      return `<${tag}>${items}</${tag}>`
    }
    case 'blockquote': {
      const t = token as Tokens.Blockquote
      return `<blockquote>${tokensToHtml(t.tokens, github)}</blockquote>`
    }
    case 'heading': {
      const t = token as Tokens.Heading
      return `<h${t.depth}>${inlineTokensToHtml(t.tokens, github)}</h${t.depth}>`
    }
    case 'hr':
      return '<hr>'
    case 'html':
      return (token as Tokens.HTML).text
    case 'space':
      return ''

    case 'strong':
    case 'em':
    case 'del':
    case 'codespan':
    case 'link':
    case 'image':
    case 'br':
    case 'escape':
    case 'text':
      return inlineTokenToHtml(token, github)

    default:
      return token.raw ?? ''
  }
}

function inlineTokensToHtml(tokens: Token[], github: string): string {
  return tokens.map(t => inlineTokenToHtml(t, github)).join('')
}

function inlineTokenToHtml(token: Token, github: string): string {
  switch (token.type) {
    case 'text': {
      const t = token as Tokens.Text
      return t.tokens ? inlineTokensToHtml(t.tokens, github) : escapeHtml(t.text)
    }
    case 'strong': {
      const t = token as Tokens.Strong
      return `<strong>${inlineTokensToHtml(t.tokens, github)}</strong>`
    }
    case 'em': {
      const t = token as Tokens.Em
      return `<em>${inlineTokensToHtml(t.tokens, github)}</em>`
    }
    case 'del': {
      const t = token as Tokens.Del
      return `<del>${inlineTokensToHtml(t.tokens, github)}</del>`
    }
    case 'codespan': {
      const t = token as Tokens.Codespan
      return `<code>${escapeHtml(t.text)}</code>`
    }
    case 'link': {
      const t = token as Tokens.Link
      const href = resolveLink(t.href, github)
      const title = t.title ? ` title="${escapeAttr(t.title)}"` : ''
      return `<a href="${escapeAttr(href)}"${title}>${inlineTokensToHtml(t.tokens, github)}</a>`
    }
    case 'image': {
      const t = token as Tokens.Image
      const src = resolveImage(t.href, github)
      const alt = t.text ? ` alt="${escapeAttr(t.text)}"` : ''
      const title = t.title ? ` title="${escapeAttr(t.title)}"` : ''
      return `<img src="${escapeAttr(src)}"${alt}${title}>`
    }
    case 'br':
      return '<br>'
    case 'html':
      return (token as Tokens.HTML).text
    case 'escape': {
      const t = token as Tokens.Escape
      return escapeHtml(t.text)
    }
    default:
      return token.raw ?? ''
  }
}

function resolveLink(href: string, github: string): string {
  if (!github || isAbsoluteUrl(href)) return href
  return `https://github.com/${github}/blob/main/${href.replace(/^\//, '')}`
}

function resolveImage(href: string, github: string): string {
  if (!github || isAbsoluteUrl(href)) return href
  return `https://raw.githubusercontent.com/${github}/main/${href.replace(/^\//, '')}`
}

function isAbsoluteUrl(url: string): boolean {
  return /^(?:[a-z][a-z0-9+\-.]*:)?\/\//i.test(url) || url.startsWith('#') || url.startsWith('data:')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(text: string): string {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
