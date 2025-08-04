import React, { useEffect, useState } from 'react';
import { getIconURL, getFileIconType } from '../utils/getIconURL';

interface EntryIconProps {
  type?: string;
  filename?: string;
  isDirectory?: boolean;
  isOpen?: boolean;
  height?: number;
  width?: number;
  error?: boolean;
}

export const EntryIcon: React.FC<EntryIconProps> = ({
  type,
  filename,
  isDirectory = false,
  isOpen = false,
  height = 16,
  width = 16,
  error = false,
}) => {
  const [iconURL, setIconURL] = useState<string>('');

  useEffect(() => {
    const loadIcon = async () => {
      let iconType = type;
      
      if (!iconType) {
        if (isDirectory) {
          iconType = isOpen ? 'directory-open' : 'directory';
        } else if (filename) {
          iconType = getFileIconType(filename);
        } else {
          iconType = 'file';
        }
      }

      const url = await getIconURL(iconType);
      setIconURL(url);
    };

    loadIcon();
  }, [type, filename, isDirectory, isOpen]);

  if (error) {
    return (
      <span 
        style={{ 
          color: '#f44336', 
          width: `${width}px`, 
          height: `${height}px`,
          display: 'inline-block'
        }}
      >
        ⚠
      </span>
    );
  }

  return (
    <span
      style={{
        backgroundImage: `url(${iconURL})`,
        backgroundSize: `${width}px`,
        backgroundPosition: '0',
        backgroundRepeat: 'no-repeat',
        width: `${width}px`,
        height: `${height}px`,
        display: 'inline-block',
        WebkitFontSmoothing: 'antialiased',
        verticalAlign: 'top',
        flexShrink: 0,
      }}
      title={filename || type}
    />
  );
};