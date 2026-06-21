import { Router } from 'express'
import { google } from 'googleapis'
import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { hashToken, randomToken } from '../../utils/crypto.js'
import { getAuthedGoogleClient, syncGoogleAppFolderFiles, syncGoogleQuota } from '../google/google.service.js'
import { deleteS3Object, syncS3Quota, createS3Client, getS3ConfigForAccount } from '../s3/s3.service.js'
import { streamProviderFile } from './stream-file.js'
import { googleDownloadExportMimeTypes, normalizeHeaders, withExtension } from './stream-google-file.js'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'
import archiverModule from 'archiver'
const archiver = (archiverModule as any).default || archiverModule


export const fileRouter = Router()

fileRouter.get('/preview/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token)
    const preview = await prisma.filePreviewToken.findFirst({
      where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
      include: { file: { include: { connectedAccount: true } } },
    })
    if (!preview || preview.file.status !== 'active') return res.status(404).json({ code: 'PREVIEW_NOT_FOUND', message: 'Preview token not found.' })
    return streamProviderFile(preview.file, req.headers.range, res, { disposition: 'inline' })
  } catch (error) {
    return next(error)
  }
})

fileRouter.use(requireAuth)

fileRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const query = z.object({ folderId: z.string().optional(), q: z.string().trim().max(255).optional() }).parse(req.query)
    const files = await prisma.file.findMany({ where: { userId: req.user!.id, status: 'active', ...(query.folderId ? { folderId: query.folderId } : {}), ...(query.q ? { name: { contains: query.q } } : {}) }, include: { connectedAccount: { select: { id: true, email: true, provider: true } }, folder: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } })
    return res.json({ files: files.map((file) => ({ ...file, sizeBytes: file.sizeBytes.toString() })) })
  } catch (error) {
    return next(error)
  }
})

const batchFileSchema = z.object({ fileIds: z.array(z.string().min(1)).min(1).max(100) })

fileRouter.patch('/batch', async (req: AuthRequest, res, next) => {
  try {
    const body = batchFileSchema.extend({ folderId: z.string().nullable().optional() }).parse(req.body)
    if (body.folderId) await prisma.folder.findFirstOrThrow({ where: { id: body.folderId, userId: req.user!.id, deletedAt: null } })
    const result = await prisma.file.updateMany({ where: { id: { in: body.fileIds }, userId: req.user!.id, status: 'active' }, data: { folderId: body.folderId ?? null } })
    return res.json({ status: 'ok', moved: result.count })
  } catch (error) {
    return next(error)
  }
})

fileRouter.delete('/batch', async (req: AuthRequest, res, next) => {
  try {
    const body = batchFileSchema.parse(req.body)
    const result = await prisma.file.updateMany({
      where: { id: { in: body.fileIds }, userId: req.user!.id, status: 'active' },
      data: { status: 'deleted', deletedAt: new Date() }
    })
    return res.json({ status: 'ok', deleted: result.count })
  } catch (error) {
    return next(error)
  }
})

fileRouter.get('/trash', async (req: AuthRequest, res, next) => {
  try {
    const query = z.object({ q: z.string().trim().max(255).optional() }).parse(req.query)
    const files = await prisma.file.findMany({
      where: {
        userId: req.user!.id,
        status: 'deleted',
        ...(query.q ? { name: { contains: query.q } } : {})
      },
      include: {
        connectedAccount: { select: { id: true, email: true, provider: true } },
        folder: { select: { id: true, name: true } }
      },
      orderBy: { deletedAt: 'desc' }
    })
    return res.json({ files: files.map((file) => ({ ...file, sizeBytes: file.sizeBytes.toString() })) })
  } catch (error) {
    return next(error)
  }
})

fileRouter.post('/batch/restore', async (req: AuthRequest, res, next) => {
  try {
    const body = batchFileSchema.parse(req.body)
    const result = await prisma.file.updateMany({
      where: { id: { in: body.fileIds }, userId: req.user!.id, status: 'deleted' },
      data: { status: 'active', deletedAt: null }
    })
    return res.json({ status: 'ok', restored: result.count })
  } catch (error) {
    return next(error)
  }
})

fileRouter.delete('/batch/permanent', async (req: AuthRequest, res, next) => {
  try {
    const body = batchFileSchema.parse(req.body)
    const files = await prisma.file.findMany({
      where: { id: { in: body.fileIds }, userId: req.user!.id, status: 'deleted' },
      include: { connectedAccount: true }
    })
    const deletedIds: string[] = []
    const syncedAccountIds = new Set<string>()
    const failed: Array<{ fileId: string; message: string }> = []

    for (const file of files) {
      try {
        if (file.provider === 's3') {
          await deleteS3Object(file)
        } else {
          const auth = await getAuthedGoogleClient(file.connectedAccount)
          const drive = google.drive({ version: 'v3', auth })
          await drive.files.delete({ fileId: file.providerFileId })
        }
        deletedIds.push(file.id)
        syncedAccountIds.add(file.connectedAccountId)
      } catch (error) {
        failed.push({ fileId: file.id, message: error instanceof Error ? error.message : 'Delete failed' })
      }
    }

    if (deletedIds.length > 0) {
      await prisma.file.deleteMany({
        where: { id: { in: deletedIds }, userId: req.user!.id }
      })
    }

    for (const accountId of syncedAccountIds) {
      const account = files.find((file) => file.connectedAccountId === accountId)?.connectedAccount
      if (account?.provider === 's3') {
        await syncS3Quota(accountId).catch(() => undefined)
      } else {
        await syncGoogleQuota(accountId).catch(() => undefined)
      }
    }

    if (deletedIds.length === 0 && failed.length > 0) {
      return res.status(400).json({ code: 'FILES_DELETE_FAILED', message: 'No files were permanently deleted.', deleted: 0, failed })
    }
    return res.json({ status: 'ok', deleted: deletedIds.length, failed })
  } catch (error) {
    return next(error)
  }
})

fileRouter.get('/shared-links', async (req: AuthRequest, res, next) => {
  try {
    const shares = await prisma.fileShare.findMany({
      where: { userId: req.user!.id, enabled: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { file: { include: { connectedAccount: { select: { email: true, provider: true } }, folder: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
    return res.json({
      shares: shares.filter((share) => share.file.status === 'active').map((share) => ({
        id: share.id,
        url: share.token ? `${env.FRONTEND_URL}/public/files/${share.token}` : null,
        createdAt: share.createdAt.toISOString(),
        expiresAt: share.expiresAt?.toISOString() ?? null,
        file: { ...share.file, sizeBytes: share.file.sizeBytes.toString() },
      })),
    })
  } catch (error) {
    return next(error)
  }
})

fileRouter.post('/sync-google', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({ connectedAccountId: z.string().min(1).optional() }).parse(req.body ?? {})
    const accounts = await prisma.connectedAccount.findMany({
      where: { userId: req.user!.id, provider: 'google_drive', status: 'connected', ...(body.connectedAccountId ? { id: body.connectedAccountId } : {}) },
      select: { id: true },
    })

    const results = []
    for (const account of accounts) results.push(await syncGoogleAppFolderFiles(account.id, req.user!.id))

    return res.json({
      status: 'ok',
      results,
    })
  } catch (error) {
    return next(error)
  }
})

fileRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const fileId = String(req.params.id)
    const file = await prisma.file.findFirstOrThrow({ where: { id: fileId, userId: req.user!.id }, include: { connectedAccount: { select: { id: true, email: true, provider: true } }, folder: { select: { id: true, name: true } } } })
    return res.json({ file: { ...file, sizeBytes: file.sizeBytes.toString() } })
  } catch (error) {
    return next(error)
  }
})

fileRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({ name: z.string().min(1).max(255).optional(), folderId: z.string().nullable().optional() }).parse(req.body)
    const fileId = String(req.params.id)
    const file = await prisma.file.findFirstOrThrow({ where: { id: fileId, userId: req.user!.id }, include: { connectedAccount: true } })
    const drive = file.provider === 's3' ? null : google.drive({ version: 'v3', auth: await getAuthedGoogleClient(file.connectedAccount) })
    if (body.folderId) await prisma.folder.findFirstOrThrow({ where: { id: body.folderId, userId: req.user!.id, deletedAt: null } })
    if (body.name && drive) await drive.files.update({ fileId: file.providerFileId, requestBody: { name: body.name } })
    const updated = await prisma.file.update({ where: { id: file.id }, data: { ...(body.name ? { name: body.name } : {}), ...(body.folderId !== undefined ? { folderId: body.folderId } : {}) }, include: { connectedAccount: { select: { id: true, email: true, provider: true } }, folder: { select: { id: true, name: true } } } })
    return res.json({ file: { ...updated, sizeBytes: updated.sizeBytes.toString() } })
  } catch (error) {
    return next(error)
  }
})

fileRouter.post('/:id/share', async (req: AuthRequest, res, next) => {
  try {
    const fileId = String(req.params.id)
    const file = await prisma.file.findFirstOrThrow({ where: { id: fileId, userId: req.user!.id, status: 'active' } })
    const existingShare = await prisma.fileShare.findFirst({ where: { fileId: file.id, userId: req.user!.id, enabled: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: 'desc' } })
    if (existingShare?.token) return res.json({ url: `${env.FRONTEND_URL}/public/files/${existingShare.token}`, shareId: existingShare.id })
    if (existingShare) await prisma.fileShare.update({ where: { id: existingShare.id }, data: { enabled: false } })
    const token = randomToken(32)
    const share = await prisma.fileShare.create({ data: { fileId: file.id, userId: req.user!.id, token, tokenHash: hashToken(token) } })
    return res.status(201).json({ url: `${env.FRONTEND_URL}/public/files/${token}`, shareId: share.id })
  } catch (error) {
    return next(error)
  }
})

fileRouter.delete('/:id/share', async (req: AuthRequest, res, next) => {
  try {
    const fileId = String(req.params.id)
    await prisma.fileShare.updateMany({ where: { fileId, userId: req.user!.id, enabled: true }, data: { enabled: false } })
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
})

fileRouter.post('/:id/preview-token', async (req: AuthRequest, res, next) => {
  try {
    const fileId = String(req.params.id)
    const file = await prisma.file.findFirstOrThrow({ where: { id: fileId, userId: req.user!.id, status: 'active' } })
    const token = randomToken(32)
    await prisma.filePreviewToken.create({ data: { fileId: file.id, userId: req.user!.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 10 * 60_000) } })
    const path = `/files/preview/${token}`
    return res.status(201).json({ path, url: `${req.protocol}://${req.get('host')}${path}` })
  } catch (error) {
    return next(error)
  }
})

fileRouter.get('/:id/view-url', async (req: AuthRequest, res, next) => {
  try {
    const fileId = String(req.params.id)
    const file = await prisma.file.findFirstOrThrow({ where: { id: fileId, userId: req.user!.id }, include: { connectedAccount: true } })
    if (file.provider === 's3') return res.json({ url: null })
    const auth = await getAuthedGoogleClient(file.connectedAccount)
    const drive = google.drive({ version: 'v3', auth })
    const metadata = await drive.files.get({ fileId: file.providerFileId, fields: 'webViewLink,webContentLink' })
    return res.json({ url: metadata.data.webViewLink ?? metadata.data.webContentLink })
  } catch (error) {
    return next(error)
  }
})

fileRouter.get('/:id/download', async (req: AuthRequest, res, next) => {
  try {
    const fileId = String(req.params.id)
    const file = await prisma.file.findFirstOrThrow({ where: { id: fileId, userId: req.user!.id }, include: { connectedAccount: true } })
    return streamProviderFile(file, req.headers.range, res, { disposition: 'attachment' })
  } catch (error) {
    return next(error)
  }
})

fileRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const fileId = String(req.params.id)
    const file = await prisma.file.findFirstOrThrow({ where: { id: fileId, userId: req.user!.id, status: 'active' } })
    await prisma.file.update({ where: { id: file.id }, data: { status: 'deleted', deletedAt: new Date() } })
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
})

fileRouter.post('/batch-download', async (req: AuthRequest, res, next) => {
  try {
    const body = batchFileSchema.parse(req.body)
    const files = await prisma.file.findMany({
      where: { id: { in: body.fileIds }, userId: req.user!.id, status: 'active' },
      include: { connectedAccount: true }
    })
    if (files.length === 0) return res.status(404).json({ code: 'FILES_NOT_FOUND', message: 'No files found.' })

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="9drive-download.zip"')

    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.on('error', (err: any) => {
      throw err
    })
    archive.pipe(res)

    for (const file of files) {
      try {
        let stream: Readable
        let fileName = file.name
        if (file.provider === 's3') {
          const config = await getS3ConfigForAccount(file.connectedAccountId)
          const client = createS3Client(config)
          const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: file.providerFileId }))
          stream = response.Body as Readable
        } else {
          const auth = await getAuthedGoogleClient(file.connectedAccount)
          const headers = normalizeHeaders(await auth.getRequestHeaders())
          const exportTarget = googleDownloadExportMimeTypes[file.mimeType]
          if (exportTarget) {
            fileName = withExtension(file.name, exportTarget.extension)
          }
          const url = exportTarget
            ? `https://www.googleapis.com/drive/v3/files/${file.providerFileId}/export?mimeType=${encodeURIComponent(exportTarget.mimeType)}`
            : `https://www.googleapis.com/drive/v3/files/${file.providerFileId}?alt=media`
          const response = await fetch(url, { headers })
          if (!response.ok || !response.body) continue
          stream = Readable.fromWeb(response.body as any)
        }
        archive.append(stream, { name: fileName })
      } catch (err) {
        console.error(`Failed to add file ${file.name} to zip:`, err)
      }
    }

    await archive.finalize()
  } catch (error) {
    return next(error)
  }
})
