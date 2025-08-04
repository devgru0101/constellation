import type { SandpackFiles, ModuleList } from './types';

export const fromPropsToModules = (files: SandpackFiles): ModuleList => {
  return Object.keys(files).reduce((acc, key) => {
    if (typeof files[key] === 'string') {
      acc[key] = {
        code: files[key] as string,
        path: key,
      };
    } else {
      acc[key] = {
        code: (files[key] as any).code,
        path: key,
      };
    }
    return acc;
  }, {} as ModuleList);
};

export const getFileName = (path: string): string => {
  return path.split('/').pop() || '';
};

export const getParentPath = (path: string): string => {
  const segments = path.split('/');
  return segments.slice(0, -1).join('/');
};

export const isDirectory = (path: string, files: ModuleList): boolean => {
  const pathWithSlash = path.endsWith('/') ? path : `${path}/`;
  return Object.keys(files).some(filePath => 
    filePath !== path && filePath.startsWith(pathWithSlash)
  );
};

export const getDirectoryFiles = (path: string, files: ModuleList): string[] => {
  const pathWithSlash = path.endsWith('/') ? path : `${path}/`;
  return Object.keys(files).filter(filePath => 
    filePath.startsWith(pathWithSlash) && filePath !== path
  );
};

export const getDirectChildren = (path: string, files: ModuleList): string[] => {
  const pathWithSlash = path === '/' ? '' : (path.endsWith('/') ? path : `${path}/`);
  const children = new Set<string>();
  
  Object.keys(files).forEach(filePath => {
    if (filePath === path) return;
    
    const relativePath = pathWithSlash ? filePath.replace(pathWithSlash, '') : filePath.startsWith('/') ? filePath.slice(1) : filePath;
    
    if (relativePath && !relativePath.includes('/')) {
      children.add(pathWithSlash + relativePath);
    } else if (relativePath.includes('/')) {
      const firstSegment = relativePath.split('/')[0];
      children.add(pathWithSlash + firstSegment);
    }
  });
  
  return Array.from(children).sort();
};

export const createDirectoryTree = (files: ModuleList): string[] => {
  const directories = new Set<string>();
  
  Object.keys(files).forEach(filePath => {
    const segments = filePath.split('/');
    for (let i = 1; i < segments.length; i++) {
      const dirPath = segments.slice(0, i).join('/');
      if (dirPath) {
        directories.add(dirPath);
      }
    }
  });
  
  return Array.from(directories).sort();
};