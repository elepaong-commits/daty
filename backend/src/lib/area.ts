// Places keep the address Google gave in the country's own language, so the neighbourhood is read
// straight from the text: "대한민국 서울특별시 마포구 …" → "서울 마포구", "日本、〒150-0001 東京都渋谷区…" → "東京都 渋谷区".

const KOREAN_REGION = /(특별자치시|특별자치도|특별시|광역시)$/;

function koreanArea(address: string) {
  const tokens = address.replace(/^대한민국\s*/, "").split(/\s+/).filter(Boolean);
  const [first, second] = tokens;
  if (!first || !/(시|도)$/.test(first)) return null;
  const region = first.replace(KOREAN_REGION, "");
  return second && /(시|군|구)$/.test(second) ? `${region} ${second}` : region;
}

function japaneseArea(address: string) {
  const match = /(東京都|北海道|(?:京都|大阪)府|[^\s、,\d〒-]{2,3}県)\s*([^\s\d、,]+?[市区郡])?/.exec(address);
  if (!match) return null;
  return match[2] ? `${match[1]} ${match[2]}` : match[1]!;
}

/** City and district of an address, or `null` when it isn't a Korean or Japanese one we can read. */
export function areaOf(address: string | null) {
  if (!address) return null;
  return /[가-힣]/.test(address) ? koreanArea(address.trim()) : japaneseArea(address);
}
