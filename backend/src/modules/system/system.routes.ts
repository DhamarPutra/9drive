import { Router } from 'express'
import { exec } from 'child_process'
import path from 'path'
import { requireAuth } from '../../middleware/auth.middleware.js'

export const systemRouter = Router()

systemRouter.post('/update', requireAuth, (req, res, next) => {
  // The process runs in backend/ dist or src, project root is one level up
  const projectRoot = path.resolve(process.cwd(), '..')

  exec('git pull', { cwd: projectRoot }, (error, stdout, stderr) => {
    if (error) {
      console.error('System update failed:', error)
      return res.status(500).json({
        code: 'UPDATE_FAILED',
        message: 'Failed to run git pull. Make sure git is installed and configured.',
        error: error.message,
        stderr
      })
    }

    console.log('System update stdout:', stdout)
    if (stderr) {
      console.warn('System update stderr:', stderr)
    }

    return res.json({
      status: 'success',
      message: 'System code updated successfully. Dev servers will auto-restart.',
      stdout,
      stderr
    })
  })
})
