export const metadata = { title: 'ClaimAI', description: 'EC・小売向けクレーム対応AI' }
export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0, background: '#0F172A' }}>{children}</body>
    </html>
  )
}
