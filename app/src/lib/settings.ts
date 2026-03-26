const LS_KEYWORDS = 'coconot:keywords'
const LS_GEIGER = 'coconot:geiger'

const DEFAULT_KEYWORDS = ['coconut', 'copra', 'cocos nucifera']

export function getKeywords(): string[] {
  const raw = localStorage.getItem(LS_KEYWORDS)
  if (!raw) return [...DEFAULT_KEYWORDS]
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_KEYWORDS]
  } catch {
    return [...DEFAULT_KEYWORDS]
  }
}

export function setKeywords(keywords: string[]): void {
  localStorage.setItem(LS_KEYWORDS, JSON.stringify(keywords))
}

export function getGeigerEnabled(): boolean {
  return localStorage.getItem(LS_GEIGER) === 'true'
}

export function setGeigerEnabled(enabled: boolean): void {
  localStorage.setItem(LS_GEIGER, String(enabled))
}
