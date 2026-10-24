const fs = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Where opt-in contributions (photos + answers) and feedback are stored.
 *
 *  - S3-compatible bucket (Cloudflare R2, AWS S3) when CONTRIB_S3_BUCKET, CONTRIB_S3_ENDPOINT,
 *    CONTRIB_S3_ACCESS_KEY_ID and CONTRIB_S3_SECRET_ACCESS_KEY are set.
 *  - A local folder when CONTRIB_LOCAL_DIR is set (development only: Render's disk is wiped
 *    on every deploy).
 *  - Otherwise disabled: the app hides the "help improve" option and stores nothing.
 */
function createBackend() {
  const {
    CONTRIB_S3_BUCKET: bucket,
    CONTRIB_S3_ENDPOINT: endpoint,
    CONTRIB_S3_ACCESS_KEY_ID: accessKeyId,
    CONTRIB_S3_SECRET_ACCESS_KEY: secretAccessKey,
    CONTRIB_S3_REGION: region = 'auto',
    CONTRIB_LOCAL_DIR: localDir,
  } = process.env;

  if (bucket && endpoint && accessKeyId && secretAccessKey) {
    const {
      S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectVersionsCommand,
    } = require('@aws-sdk/client-s3');
    const client = new S3Client({ region, endpoint, credentials: { accessKeyId, secretAccessKey } });
    return {
      kind: 's3',
      async put(key, body, contentType) {
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
      },
      async get(key) {
        try {
          const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
          return Buffer.from(await res.Body.transformToByteArray());
        } catch (err) {
          if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
          throw err;
        }
      },
      // A plain delete on a versioned bucket (Backblaze B2 always keeps versions) only hides the
      // file. "Delete my photo" must really delete it, so every version and marker is removed.
      async remove(key) {
        const res = await client.send(new ListObjectVersionsCommand({ Bucket: bucket, Prefix: key }));
        const all = [...(res.Versions || []), ...(res.DeleteMarkers || [])].filter(v => v.Key === key);
        for (const v of all) {
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key, VersionId: v.VersionId }));
        }
        if (!all.length) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      },
    };
  }

  if (localDir) {
    const root = path.resolve(localDir);
    const file = key => {
      const target = path.resolve(root, key);
      if (!target.startsWith(root + path.sep)) throw new Error('Invalid storage key');
      return target;
    };
    return {
      kind: 'local',
      async put(key, body) {
        await fs.mkdir(path.dirname(file(key)), { recursive: true });
        await fs.writeFile(file(key), body);
      },
      async get(key) {
        try {
          return await fs.readFile(file(key));
        } catch (err) {
          if (err.code === 'ENOENT') return null;
          throw err;
        }
      },
      async remove(key) {
        await fs.rm(file(key), { force: true });
      },
    };
  }

  return null;
}

const backend = createBackend();
if (backend) logger.info(`Contribution storage: ${backend.kind}`);

module.exports = {
  isEnabled: () => Boolean(backend),
  kind: () => backend?.kind || 'disabled',
  put: (...args) => backend.put(...args),
  get: (...args) => backend.get(...args),
  remove: (...args) => backend.remove(...args),
};
