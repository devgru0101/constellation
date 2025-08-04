export interface SandpackFile {
  code: string;
  hidden?: boolean;
  active?: boolean;
  readOnly?: boolean;
}

export interface SandpackFiles {
  [key: string]: SandpackFile | string;
}

export interface SandpackBundlerFile {
  code: string;
  path: string;
}

export interface SandpackBundlerFiles {
  [key: string]: SandpackBundlerFile;
}

export interface ModuleList {
  [key: string]: {
    code: string;
    path: string;
  };
}

export interface DirectoryProps {
  path: string;
  selectFile: (path: string) => void;
  files: ModuleList;
  prefixedPath: string;
  depth: number;
  isDirOpen: boolean;
  toggleDirectory: (path: string) => void;
}

export interface FileProps {
  path: string;
  selectFile: (path: string) => void;
  active: boolean;
  depth: number;
  isDirOpen?: boolean;
}