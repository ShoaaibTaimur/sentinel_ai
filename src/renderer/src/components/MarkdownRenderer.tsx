import { useEffect, useRef, useMemo } from 'react'
import { Marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/tokyo-night-dark.css'

interface Props {
  content: string
  isStreaming?: boolean
}

export default function MarkdownRenderer({ content, isStreaming }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Configure marked with custom renderer
  const markedInstance = useMemo(() => {
    const marked = new Marked()

    const renderer = {
      code(token: { text: string; lang?: string }) {
        const lang = token.lang || ''
        const validLang = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
        const highlighted = hljs.highlight(token.text, { language: validLang }).value
        const escapedCode = encodeURIComponent(token.text)

        return `
          <div class="code-block-container">
            <div class="code-block-header">
              <span class="code-block-lang">${validLang}</span>
              <button class="copy-code-btn" data-code="${escapedCode}">
                <svg class="copy-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span class="copy-text">Copy</span>
              </button>
            </div>
            <pre><code class="hljs language-${validLang}">${highlighted}</code></pre>
          </div>
        `
      },
      link(token: { href: string; title?: string | null; text: string }) {
        const href = token.href || '#'
        const titleAttr = token.title ? ` title="${token.title}"` : ''
        const text = token.text || href
        return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`
      }
    }

    marked.use({ renderer })
    return marked
  }, [])

  // Parse markdown content synchronously
  const parsedHtml = useMemo(() => {
    try {
      // Allow breaking lines as in standard markdown
      let html = markedInstance.parse(content || '', { gfm: true, breaks: true }) as string

      if (isStreaming) {
        const trimmedHtml = html.trim()
        if (trimmedHtml.endsWith('</p>')) {
          html = html.replace(/<\/p>$/, '<span class="typing-cursor"></span></p>')
        } else if (trimmedHtml.endsWith('</code></pre>')) {
          html = html.replace(/<\/code><\/pre>$/, '<span class="typing-cursor"></span></code></pre>')
        } else if (trimmedHtml.endsWith('</li>')) {
          html = html.replace(/<\/li>$/, '<span class="typing-cursor"></span></li>')
        } else {
          html += '<span class="typing-cursor"></span>'
        }
      }

      return html
    } catch (err) {
      console.error('Markdown parse error:', err)
      return content || ''
    }
  }, [content, isStreaming, markedInstance])

  // Setup click listeners for copy buttons
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleCopyClick = async (e: MouseEvent) => {
      const button = (e.target as HTMLElement).closest('.copy-code-btn') as HTMLButtonElement | null
      if (!button) return

      const codeAttr = button.getAttribute('data-code')
      if (!codeAttr) return

      try {
        const code = decodeURIComponent(codeAttr)
        await navigator.clipboard.writeText(code)

        // Show success state
        button.classList.add('copied')
        const copyTextSpan = button.querySelector('.copy-text')
        if (copyTextSpan) {
          copyTextSpan.textContent = 'Copied!'
        }

        // Revert back after 1.5s
        setTimeout(() => {
          button.classList.remove('copied')
          if (copyTextSpan) {
            copyTextSpan.textContent = 'Copy'
          }
        }, 1500)
      } catch (err) {
        console.error('Failed to copy text:', err)
      }
    }

    container.addEventListener('click', handleCopyClick)
    return () => {
      container.removeEventListener('click', handleCopyClick)
    }
  }, [parsedHtml])

  return (
    <div
      ref={containerRef}
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: parsedHtml }}
    />
  )
}
