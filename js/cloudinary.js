// ============ Google Drive Upload/Delete ============
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadToDrive(file, stage) {
  const MAX_SIZE = 200 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('حجم الملف يتجاوز الحد الأقصى (200 ميجا)');
  }

  const base64Full = await fileToBase64(file);
  const base64Data = base64Full.split(',')[1];

  const ext = file.name.split('.').pop().toLowerCase();

  const result = await API.uploadFile(base64Data, file.name, stage);

  if (!result || result.error) {
    throw new Error(result?.error || 'فشل رفع الملف');
  }

  return {
    url: result.url,
    publicId: result.fileId,
    size: file.size,
    format: ext,
    resourceType: file.type
  };
}

async function deleteFromDrive(fileId) {
  if (!fileId) return false;
  try {
    const result = await API.deleteFile(fileId);
    return result && result.success;
  } catch (e) {
    console.error('Drive delete error:', e);
    return false;
  }
}

// Alias for backward compatibility
async function uploadToCloudinary(file, stage) {
  return uploadToDrive(file, stage);
}

async function deleteFromCloudinary(publicId) {
  return deleteFromDrive(publicId);
}

function extractPublicIdFromUrl(fileUrl) {
  if (!fileUrl || !fileUrl.includes('drive.google.com')) return null;
  try {
    const match = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  } catch (e) { return null; }
}
