import { useEffect, useState } from 'react'
import { Bell, Cloud, Globe, HardDrive, Link2, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DummyModal } from '@/components/drive/DummyModal'
import { PageHeader } from '@/components/drive/PageHeader'
import { apiFetch, formatBytes } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

type ConnectedAccount = { id: string; email: string; status: string; storageAccount?: { totalBytes: string | null; usedBytes: string; availableBytes: string | null; lastSyncedAt: string | null } | null }

export function SettingsPage() {
  const user = getStoredUser()
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [message, setMessage] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null)
  const [disconnectingAccountId, setDisconnectingAccountId] = useState<string | null>(null)
  const [accountToDisconnect, setAccountToDisconnect] = useState<ConnectedAccount | null>(null)

  async function load() {
    const data = await apiFetch<{ accounts: ConnectedAccount[] }>('/connected-accounts')
    setAccounts(data.accounts)
  }

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load settings'))
  }, [])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== 'GOOGLE_CONNECTED') return
      setMessage(event.data.status === 'success' ? 'Google Drive connected.' : 'Google Drive connection failed.')
      load().catch(() => undefined)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  async function connectDrive() {
    setConnecting(true)
    setMessage('')
    try {
      const data = await apiFetch<{ url: string }>('/connected-accounts/google/connect-url')
      const popup = window.open(data.url, 'google-drive-connect', 'width=540,height=720')
      if (!popup) window.location.href = data.url
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to start Google Drive connection')
    } finally {
      setConnecting(false)
    }
  }

  async function sync(accountId: string) {
    setSyncingAccountId(accountId)
    try {
      await apiFetch(`/connected-accounts/${accountId}/sync-quota`, { method: 'POST' })
      await load()
    } finally {
      setSyncingAccountId(null)
    }
  }

  async function disconnect() {
    if (!accountToDisconnect) return
    setDisconnectingAccountId(accountToDisconnect.id)
    setMessage('')
    try {
      await apiFetch(`/connected-accounts/${accountToDisconnect.id}`, { method: 'DELETE' })
      setAccountToDisconnect(null)
      setMessage('Google Drive account disconnected.')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to disconnect Google Drive account')
    } finally {
      setDisconnectingAccountId(null)
    }
  }

  return (
    <>
      <PageHeader title="Setting" description="Manage account and connected storage." actions={<Button onClick={connectDrive} disabled={connecting}><Link2 className="h-4 w-4" />{connecting ? 'Connecting...' : 'Connect Drive'}</Button>} />
      {message ? <p className="mt-5 rounded-xl bg-blue-50 p-3 text-sm text-blue-700">{message}</p> : null}
      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <Card className="p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <img src="https://i.pravatar.cc/96?img=12" alt="User avatar" className="h-20 w-20 rounded-2xl object-cover" />
              <div className="flex-1"><h2 className="text-xl font-extrabold">{user?.name ?? 'User'}</h2><p className="text-sm text-slate-500">{user?.email ?? '-'}</p></div>
              <Button variant="outline"><Upload className="h-4 w-4" />Change Photo</Button>
            </div>
          </Card>

          <Card className="overflow-hidden p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3"><Cloud className="h-6 w-6 text-blue-600" /><h2 className="text-xl font-extrabold">Google Drive</h2></div>
                <p className="mt-2 text-sm text-slate-500">Connect one or more Google Drive accounts. 9Drive will route uploads to account with enough space.</p>
              </div>
              <Button onClick={connectDrive} disabled={connecting}><Link2 className="h-4 w-4" />{connecting ? 'Opening...' : 'Connect Drive'}</Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-extrabold">Connected Google Accounts</h2>
            <div className="mt-4 grid gap-3">
              {accounts.length === 0 ? <p className="text-sm text-slate-500">No connected Google Drive account yet.</p> : accounts.map((account) => (
                <div key={account.id} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="font-semibold">{account.email}</p><p className="text-sm text-slate-500">{account.status}</p></div>
                    <div className="flex gap-2"><Button variant="outline" onClick={() => sync(account.id)} disabled={syncingAccountId === account.id}><RefreshCw className={syncingAccountId === account.id ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />{syncingAccountId === account.id ? 'Syncing...' : 'Sync'}</Button><Button variant="danger" onClick={() => setAccountToDisconnect(account)}><Trash2 className="h-4 w-4" />Disconnect</Button></div>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">{formatBytes(account.storageAccount?.usedBytes)} used of {formatBytes(account.storageAccount?.totalBytes)}. Available {formatBytes(account.storageAccount?.availableBytes)}.</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="grid gap-6">
          <Card className="p-5"><HardDrive className="h-6 w-6 text-blue-600" /><h2 className="mt-4 font-extrabold">Storage</h2><p className="mt-1 text-sm text-slate-500">Connected accounts: {accounts.length}</p></Card>
          <Card className="p-5"><Bell className="h-6 w-6 text-blue-600" /><h2 className="mt-4 font-extrabold">Notifications</h2><p className="mt-1 text-sm text-slate-500">Email and app alerts are active.</p></Card>
          <Card className="p-5"><Globe className="h-6 w-6 text-blue-600" /><h2 className="mt-4 font-extrabold">Region</h2><p className="mt-1 text-sm text-slate-500">Workspace region: local gateway.</p></Card>
        </div>
      </div>
      <DummyModal open={Boolean(accountToDisconnect)} title="Disconnect Google Drive?" description="This will remove this Drive account from 9Drive. Existing file records for this account may no longer be usable." onClose={() => setAccountToDisconnect(null)}>
        <div className="grid gap-4">
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-950">{accountToDisconnect?.email}</p>
            <p className="mt-1">Used storage: {formatBytes(accountToDisconnect?.storageAccount?.usedBytes)}</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setAccountToDisconnect(null)} disabled={Boolean(disconnectingAccountId)}>Cancel</Button>
            <Button variant="danger" onClick={disconnect} disabled={Boolean(disconnectingAccountId)}><Trash2 className="h-4 w-4" />{disconnectingAccountId ? 'Disconnecting...' : 'Disconnect'}</Button>
          </div>
        </div>
      </DummyModal>
    </>
  )
}
