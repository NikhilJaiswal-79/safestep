export async function uploadToCloudinary(blob) {
  // Use env variables or fallback to localStorage config for easy testing
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || localStorage.getItem('CLOUDINARY_CLOUD_NAME');
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || localStorage.getItem('CLOUDINARY_UPLOAD_PRESET') || 'safestep_preset';

  if (!cloudName) {
    throw new Error('Cloudinary Cloud Name is not configured. Ask the user to run configuration.');
  }

  const formData = new FormData();
  formData.append('file', blob);
  formData.append('upload_preset', uploadPreset);
  
  // Cloudinary uses the 'video' endpoint for both audio and video files
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return data.secure_url;
}
