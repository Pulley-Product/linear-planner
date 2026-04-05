const SK = 'linear-planner-v1'

export function loadStorage() {
  try {
    const raw = localStorage.getItem(SK)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveStorage(data) {
  try {
    const existing = loadStorage()
    localStorage.setItem(SK, JSON.stringify({ ...existing, ...data }))
  } catch (e) {
    console.warn('Storage save failed:', e)
  }
}
