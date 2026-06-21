import { ClipboardPaste, FolderPlus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmptyAreaContextMenu({ x, y, open, canPasteFolder = false, onClose, onUpload, onCreateFolder, onPasteFolder }: { x: number; y: number; open: boolean; canPasteFolder?: boolean; onClose: () => void; onUpload: () => void; onCreateFolder: () => void; onPasteFolder?: () => void }) {
  if (!open) return null
  const safeX = Math.max(12, Math.min(x, window.innerWidth - 220))
  const safeY = Math.max(12, Math.min(y, window.innerHeight - 148))

  return (
    <>
      <button className="fixed inset-0 z-40 cursor-default bg-slate-950/20 sm:bg-transparent" aria-label="Close empty area menu" onClick={onClose} />
      <div className="fixed inset-x-3 bottom-3 z-50 rounded-3xl border border-slate-200/80 bg-white/95 p-2 shadow-2xl shadow-slate-950/10 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/95 sm:inset-x-auto sm:bottom-auto sm:w-52 sm:rounded-2xl" style={{ left: window.innerWidth >= 640 ? safeX : undefined, top: window.innerWidth >= 640 ? safeY : undefined }}>
        <Button variant="ghost" className="h-10 w-full justify-start text-[13px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80" onClick={onUpload}><Upload className="h-4 w-4 text-slate-500" />Upload File</Button>
        <Button variant="ghost" className="h-10 w-full justify-start text-[13px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80" onClick={onCreateFolder}><FolderPlus className="h-4 w-4 text-slate-500" />Create Folder</Button>
        {canPasteFolder && onPasteFolder ? (
          <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
            <Button variant="ghost" className="h-10 w-full justify-start text-[13px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80" onClick={onPasteFolder}><ClipboardPaste className="h-4 w-4 text-slate-500" />Paste Folder Here</Button>
          </div>
        ) : null}
      </div>
    </>
  )
}
