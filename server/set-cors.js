const { Storage } = require('@google-cloud/storage');

const storage = new Storage({ keyFilename: 'serviceAccountKey.json' });
const bucket = storage.bucket('womensafety-57ada.appspot.com');

async function configureBucketCors() {
  try {
    await bucket.setCorsConfiguration([
      {
        origin: ['*'],
        method: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
        maxAgeSeconds: 3600,
      },
    ]);
    console.log(`✅ Bucket CORS configuration set successfully on ${bucket.name}.`);
  } catch (err) {
    console.error('Failed to set CORS:', err);
  }
}

configureBucketCors();
