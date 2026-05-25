import React, { type RefObject } from 'react';
import { SUPPORTED_IMAGE_MIME_TYPES, SUPPORTED_UPLOAD_MIME_TYPES } from '@/constants/fileTypeSupport';

interface ChatInputFileInputs {
  fileInputRef: RefObject<HTMLInputElement>;
  imageInputRef: RefObject<HTMLInputElement>;
  folderInputRef: RefObject<HTMLInputElement>;
  zipInputRef: RefObject<HTMLInputElement>;
  cameraInputRef: RefObject<HTMLInputElement>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleFolderChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleZipChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

interface HiddenFileInputsProps {
  fileInputs: ChatInputFileInputs;
}

export const HiddenFileInputs: React.FC<HiddenFileInputsProps> = ({ fileInputs }) => (
  <>
    <input
      type="file"
      ref={fileInputs.fileInputRef}
      onChange={fileInputs.handleFileChange}
      accept={SUPPORTED_UPLOAD_MIME_TYPES.join(',')}
      className="hidden"
      aria-hidden="true"
      multiple
    />
    <input
      type="file"
      ref={fileInputs.imageInputRef}
      onChange={fileInputs.handleFileChange}
      accept={SUPPORTED_IMAGE_MIME_TYPES.join(',')}
      className="hidden"
      aria-hidden="true"
      multiple
    />
    <input
      type="file"
      ref={fileInputs.folderInputRef}
      onChange={fileInputs.handleFolderChange}
      className="hidden"
      aria-hidden="true"
      {...({ webkitdirectory: '', directory: '' } as { webkitdirectory: string; directory: string })}
      multiple
    />
    <input
      type="file"
      ref={fileInputs.zipInputRef}
      onChange={fileInputs.handleZipChange}
      accept=".zip"
      className="hidden"
      aria-hidden="true"
    />
    <input
      type="file"
      ref={fileInputs.cameraInputRef}
      onChange={fileInputs.handleFileChange}
      accept="image/*"
      capture="environment"
      className="hidden"
      aria-hidden="true"
    />
  </>
);
