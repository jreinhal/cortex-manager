import '@testing-library/jest-dom'

// Provide a working localStorage for jsdom
const localStorageStore = {}
const localStorageMock = {
  getItem: (key) => (key in localStorageStore ? localStorageStore[key] : null),
  setItem: (key, value) => { localStorageStore[key] = String(value) },
  removeItem: (key) => { delete localStorageStore[key] },
  clear: () => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]) },
  get length() { return Object.keys(localStorageStore).length },
  key: (i) => Object.keys(localStorageStore)[i] || null,
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

// Stub matchMedia for jsdom (used by theme logic)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
