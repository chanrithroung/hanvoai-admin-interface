type GoogleIdentity = {
  initialize: (options: { client_id: string; callback: (response: { credential: string }) => void; auto_select: boolean }) => void
  renderButton: (element: HTMLElement, options: { theme: string; size: string; text: string }) => void
}
declare global {
  interface Window { google?: { accounts: { id: GoogleIdentity } } }
}

let loading: Promise<GoogleIdentity> | undefined

export function loadGoogle(): Promise<GoogleIdentity> {
  if (window.google) return Promise.resolve(window.google.accounts.id)
  loading ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    const timeout = window.setTimeout(() => fail(), 15000)
    const fail = () => {
      window.clearTimeout(timeout)
      script.remove()
      loading = undefined
      reject(new Error('Google sign-in could not load. Check your connection and reload the page.'))
    }
    script.onerror = fail
    script.onload = () => {
      window.clearTimeout(timeout)
      if (window.google) resolve(window.google.accounts.id)
      else fail()
    }
    document.head.append(script)
  })
  return loading
}
