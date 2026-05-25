import { pdfjs } from 'react-pdf';
import { configurePdfWorker } from './pdfWorker';

let pdfWorkerConfigured = false;

export const ensurePdfWorkerConfigured = () => {
  if (pdfWorkerConfigured) {
    return;
  }

  configurePdfWorker(pdfjs);
  pdfWorkerConfigured = true;
};
