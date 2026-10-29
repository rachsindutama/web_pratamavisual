import { useState } from 'react';

// Cloudinary Configuration
const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/d7wlzzdc/image/upload';
const CLOUDINARY_UPLOAD_PRESET = 'portfolio_unsigned'; // Must be created in Cloudinary Dashboard

export function useStorage() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const uploadFile = async (file, path) => {
    return new Promise((resolve, reject) => {
      setUploading(true);
      setError(null);
      setProgress(0);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', CLOUDINARY_UPLOAD_URL, true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          // Return the secure URL from Cloudinary
          setUploading(false);
          resolve(response.secure_url);
        } else {
          const errMessage = `Cloudinary upload failed: ${xhr.statusText}`;
          console.error(errMessage, xhr.responseText);
          setError(errMessage);
          setUploading(false);
          reject(new Error(errMessage));
        }
      };

      xhr.onerror = () => {
        const errMessage = 'Network error occurred during Cloudinary upload.';
        setError(errMessage);
        setUploading(false);
        reject(new Error(errMessage));
      };

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      // Optional: use the path to organize folders in Cloudinary
      if (path) {
        formData.append('folder', 'webportfolio/' + path.split('/').slice(0, -1).join('/'));
      }

      xhr.send(formData);
    });
  };

  return { uploadFile, uploading, progress, error };
}
