// CodeSandbox uses VS Code Material Icon Theme from CDN
// This is the exact implementation from CodeSandbox client

const imageExists = async (url: string): Promise<boolean> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });

// VS Code Material Icon Theme CDN base URL (same as CodeSandbox)
const base = 'https://cdn.jsdelivr.net/gh/PKief/vscode-material-icon-theme@master/icons';

// Basic fallback icons - only for when CDN completely fails
const basicFallbackIconsSvg = {
  directory: `data:image/svg+xml;base64,${btoa(`
    <svg fill="currentColor" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.3334 12.6667H3.66675C3.11446 12.6667 2.66675 12.219 2.66675 11.6667V5C2.66675 4.44772 3.11446 4 3.66675 4H5.69731C5.89473 4 6.08774 4.05844 6.25201 4.16795L7.74816 5.16538C7.91242 5.2749 8.10543 5.33333 8.30286 5.33333H12.3334C12.8857 5.33333 13.3334 5.78105 13.3334 6.33333V11.6667C13.3334 12.219 12.8857 12.6667 12.3334 12.6667Z" fill="#C5C5C5" stroke="#C5C5C5" stroke-linecap="round"/>
    </svg>
  `)}`,
  'directory-open': `data:image/svg+xml;base64,${btoa(`
    <svg fill="currentColor" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5526 12.6667H3.66675C3.2922 12.6667 2.96575 12.4608 2.79442 12.156L3.81072 8.0908C3.92201 7.64563 4.32199 7.33333 4.78086 7.33333H13.386C14.0365 7.33333 14.5139 7.94472 14.3561 8.57587L13.5228 11.9092C13.4115 12.3544 13.0115 12.6667 12.5526 12.6667Z" fill="#C5C5C5"/>
      <path d="M13.3334 6.63333V6.33333C13.3334 5.78105 12.8857 5.33333 12.3334 5.33333H8.30286C8.10543 5.33333 7.91242 5.2749 7.74816 5.16538L6.25201 4.16795C6.08774 4.05844 5.89473 4 5.69731 4H3.66675C3.11446 4 2.66675 4.44772 2.66675 5L2.66675 11.6667C2.66675 12.219 3.11446 12.6667 3.66675 12.6667H3.81072" fill="#C5C5C5"/>
    </svg>
  `)}`,
  file: `data:image/svg+xml;base64,${btoa(`
    <svg fill="currentColor" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
      <path clip-rule="evenodd" d="M4.5 4.33325C4.5 4.05711 4.72386 3.83325 5 3.83325H8.5V6.33325C8.5 6.88554 8.94772 7.33325 9.5 7.33325H12V11.6666C12 11.9427 11.7761 12.1666 11.5 12.1666H5C4.72386 12.1666 4.5 11.9427 4.5 11.6666V4.33325ZM9.5 6.33325V4.33325L12 6.83325H9.5Z" fill="#C5C5C5" fill-rule="evenodd"/>
    </svg>
  `)}`,
};

// Try to use actual VS Code Material Icon Theme folder icons from CDN
const folderIconUrls = {
  directory: `${base}/folder.svg`,
  'directory-open': `${base}/folder-open.svg`,
};

export const getIconURL = async (type: string): Promise<string> => {
  // Special handling for directory icons
  if (type === 'directory' || type === 'directory-open') {
    const folderUrl = folderIconUrls[type];
    if (await imageExists(folderUrl)) {
      return folderUrl;
    }
    return basicFallbackIconsSvg[type];
  }

  // Try to get icon from Material Icon Theme CDN first (colorful icons)
  const materialIconURL = `${base}/${type}.svg`;
  
  if (await imageExists(materialIconURL)) {
    return materialIconURL;
  }

  // Fallback to basic file icon
  return basicFallbackIconsSvg.file;
};

// Helper function to get file extension icon type
export const getFileIconType = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  // Map extensions to Material Icon Theme icon names
  const extensionMap: { [key: string]: string } = {
    // TypeScript
    'ts': 'typescript',
    'tsx': 'react_ts',
    
    // JavaScript
    'js': 'javascript',
    'jsx': 'react',
    'mjs': 'javascript', 
    
    // JSON
    'json': 'json',
    'jsonc': 'json',
    
    // CSS/Styling
    'css': 'css',
    'scss': 'sass',
    'sass': 'sass',
    'less': 'less',
    'styl': 'stylus',
    
    // HTML
    'html': 'html',
    'htm': 'html',
    
    // Markdown
    'md': 'markdown',
    'mdx': 'mdx',
    
    // Images
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'svg': 'svg',
    'webp': 'image',
    'ico': 'image',
    
    // Config files
    'yml': 'yaml',
    'yaml': 'yaml',
    'toml': 'toml',
    'xml': 'xml',
    'env': 'settings',
    
    // Package files
    'lock': 'lock',
    'pkg': 'package',
    
    // Text files
    'txt': 'text',
    'log': 'log',
    'gitignore': 'git',
    'gitkeep': 'git',
    
    // Documentation
    'readme': 'readme',
    'license': 'license',
    'changelog': 'changelog',
    
    // Encore specific
    'app': 'settings', // encore.app files
  };

  // Special filename handling
  const lowerName = filename.toLowerCase();
  if (lowerName === 'package.json') return 'nodejs';
  if (lowerName === 'tsconfig.json') return 'tsconfig';
  if (lowerName === 'dockerfile') return 'docker';
  if (lowerName === 'readme.md') return 'readme';
  if (lowerName === '.env') return 'settings';
  if (lowerName === '.gitignore') return 'git';
  if (lowerName.includes('encore')) return 'settings';

  return extensionMap[extension || ''] || 'file';
};