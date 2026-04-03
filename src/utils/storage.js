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
    localStorage.setItem(SK, JSON.stringify(data))
  } catch (e) {
    console.warn('Storage save failed:', e)
  }
}
