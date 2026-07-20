import { BrowserWindow } from 'electron'

let mcpWindow: BrowserWindow | null = null

function ensureWindow(): BrowserWindow {
  if (mcpWindow && !mcpWindow.isDestroyed()) {
    return mcpWindow
  }

  mcpWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    title: 'Sentinel Automated MCP Browser',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  // Prevent Google from blocking Electron User-Agent
  mcpWindow.webContents.setUserAgent(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )

  mcpWindow.on('closed', () => {
    mcpWindow = null
  })

  return mcpWindow
}

export const mcpBrowserPlugin = {
  async open(args: { url: string }) {
    const url = args.url.trim()
    const win = ensureWindow()
    win.show()
    win.focus()
    
    // Load URL asynchronously to prevent blocking IPC channel
    win.loadURL(url).catch((err) => {
      console.error('MCP Browser loadURL error:', err)
    })
    
    return { success: true, url: win.getURL(), title: win.getTitle() }
  },

  async close() {
    if (mcpWindow && !mcpWindow.isDestroyed()) {
      mcpWindow.close()
      mcpWindow = null
      return { success: true, message: 'MCP Browser closed.' }
    }
    return { success: false, message: 'MCP Browser was not open.' }
  },

  async click(args: { selector: string }) {
    const win = ensureWindow()
    const result = await win.webContents.executeJavaScript(`
      (() => {
        const el = document.querySelector(${JSON.stringify(args.selector)});
        if (!el) return { success: false, error: 'Element not found: ' + ${JSON.stringify(args.selector)} };
        
        // Scroll into view first
        el.scrollIntoView({ block: 'center' });
        
        // Dispatch click events
        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
        el.dispatchEvent(clickEvent);
        
        // Also try standard click
        if (typeof (el as any).click === 'function') {
          (el as any).click();
        }
        
        return { success: true };
      })()
    `)
    return result
  },

  async type(args: { selector: string; text: string }) {
    const win = ensureWindow()
    const result = await win.webContents.executeJavaScript(`
      (() => {
        const el = document.querySelector(${JSON.stringify(args.selector)});
        if (!el) return { success: false, error: 'Element not found: ' + ${JSON.stringify(args.selector)} };
        
        el.scrollIntoView({ block: 'center' });
        (el as any).focus();
        
        // Set value based on element type
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.value = ${JSON.stringify(args.text)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if ((el as any).isContentEditable) {
          (el as any).innerText = ${JSON.stringify(args.text)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          el.textContent = ${JSON.stringify(args.text)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        return { success: true };
      })()
    `)
    return result
  },

  async exec(args: { js: string }) {
    const win = ensureWindow()
    try {
      const result = await win.webContents.executeJavaScript(args.js)
      return { success: true, result }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  },

  async getContent() {
    const win = ensureWindow()
    try {
      const text = await win.webContents.executeJavaScript('document.body.innerText')
      
      const elements = await win.webContents.executeJavaScript(`
        (() => {
          const interactiveSelectors = 'button, input, textarea, [role="button"], [role="textbox"], [contenteditable="true"], a, h1, h2, h3';
          const elements = Array.from(document.querySelectorAll(interactiveSelectors));
          
          const results = [];
          elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return;
            
            let selector = el.tagName.toLowerCase();
            if (el.id) {
              selector += '#' + el.id;
            } else {
              const role = el.getAttribute('role');
              const ariaLabel = el.getAttribute('aria-label');
              const placeholder = el.getAttribute('placeholder');
              const type = el.getAttribute('type');
              if (role) selector += \`[role="\${role}"]\`;
              if (ariaLabel) selector += \`[aria-label="\${ariaLabel}"]\`;
              if (placeholder) selector += \`[placeholder="\${placeholder}"]\`;
              if (type) selector += \`[type="\${type}"]\`;
            }
            
            // Basic class fallback if generic
            if (selector === el.tagName.toLowerCase() && el.className) {
              const firstClass = el.className.split(/\\s+/)[0];
              if (firstClass && !firstClass.startsWith('gb_')) {
                selector += '.' + firstClass;
              }
            }
            
            results.push({
              tag: el.tagName.toLowerCase(),
              selector: selector,
              text: el.innerText ? el.innerText.trim().substring(0, 80) : '',
              ariaLabel: el.getAttribute('aria-label') || '',
              placeholder: el.getAttribute('placeholder') || ''
            });
          });
          
          return results.slice(0, 50);
        })()
      `)

      let textSummary = text
      if (textSummary.length > 4000) {
        textSummary = textSummary.substring(0, 4000) + '\\n\\n...[Content truncated]...'
      }

      return {
        success: true,
        url: win.getURL(),
        title: win.getTitle(),
        text: textSummary,
        interactiveElements: elements
      }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  }
}
