interface WebFetchArgs {
  url: string
}

export const webPlugin = {
  async fetchUrl(args: WebFetchArgs): Promise<{ success: boolean; url: string; content?: string; error?: string }> {
    let targetUrl = args.url.trim()
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const html = await response.text()
      
      // Clean HTML to extract text content
      let text = html
        // Remove script and style tags
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
        .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
        // Replace common block tags with newlines
        .replace(/<\/p>|<\/div>|<\/h[1-6]>|<\/li>|<\/tr>/gi, '\n')
        // Remove all other HTML tags
        .replace(/<[^>]+>/g, ' ')
        // Decode HTML entities basic
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Clean whitespace
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n\n')
        .trim()

      // Limit response size to prevent context window blowup
      if (text.length > 15000) {
        text = text.substring(0, 15000) + '\n\n...[Content truncated for length]...'
      }

      return {
        success: true,
        url: targetUrl,
        content: text
      }
    } catch (err: any) {
      return {
        success: false,
        url: targetUrl,
        error: err.message || String(err)
      }
    }
  }
}
