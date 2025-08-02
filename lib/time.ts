/**
 * JST基準の時間管理ユーティリティ
 * 全てのサーバー・クライアント処理で日本時間を統一使用
 */

export const nowJst = () =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));

export const currentSeasonYear = () => nowJst().getFullYear();

export const todayJstYmd = (): string => {
  const jst = nowJst();
  const year = jst.getFullYear();
  const month = String(jst.getMonth() + 1).padStart(2, '0');
  const day = String(jst.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const currentMonthJst = (): string => {
  const jst = nowJst();
  const year = jst.getFullYear();
  const month = String(jst.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const formatJstDate = (date: Date): string => {
  return date.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};