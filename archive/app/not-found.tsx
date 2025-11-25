export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-8">
          <h1 className="text-4xl font-bold text-white mb-4">404</h1>
          <h2 className="text-xl font-semibold text-white mb-4">
            ページが見つかりません
          </h2>
          <p className="text-slate-300 mb-6">
            お探しのページは存在しないか、移動された可能性があります。
          </p>
          <a 
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
          >
            ホームに戻る
          </a>
        </div>
      </div>
    </div>
  );
}