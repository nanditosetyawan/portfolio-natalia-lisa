import type { CertificateCard } from '../data/default/certificates'

const DATABASE_NAME = 'portfolio-natalia'
const DATABASE_VERSION = 1
const CERTIFICATE_STORE = 'certificates'

export interface CertificateRepository {
  list(): Promise<unknown[]>
  put(certificate: CertificateCard): Promise<void>
  replaceAll(certificates: CertificateCard[]): Promise<void>
  clear(): Promise<void>
}

function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error('IndexedDB is unavailable'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.addEventListener('upgradeneeded', () => {
      const database = request.result
      if (!database.objectStoreNames.contains(CERTIFICATE_STORE)) {
        const store = database.createObjectStore(CERTIFICATE_STORE, { keyPath: 'id' })
        store.createIndex('order', 'order', { unique: false })
      }
    })
    request.addEventListener('success', () => resolve(request.result), { once: true })
    request.addEventListener('error', () => reject(request.error ?? new Error('Certificate database failed to open')), { once: true })
    request.addEventListener('blocked', () => reject(new Error('Certificate database upgrade is blocked')), { once: true })
  })
}

async function runTransaction(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => void
): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CERTIFICATE_STORE, mode)
    operation(transaction.objectStore(CERTIFICATE_STORE))
    transaction.addEventListener('complete', () => resolve(), { once: true })
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('Certificate database transaction aborted')), { once: true })
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('Certificate database transaction failed')), { once: true })
  }).finally(() => database.close())
}

async function list(): Promise<unknown[]> {
  const database = await openDatabase()
  try {
    return await new Promise<unknown[]>((resolve, reject) => {
      const transaction = database.transaction(CERTIFICATE_STORE, 'readonly')
      const request = transaction.objectStore(CERTIFICATE_STORE).getAll()
      request.addEventListener('success', () => resolve(request.result), { once: true })
      request.addEventListener('error', () => reject(request.error ?? new Error('Certificate database read failed')), { once: true })
    })
  } finally {
    database.close()
  }
}

export const certificateRepository: CertificateRepository = {
  list,
  put(certificate) {
    return runTransaction('readwrite', (store) => store.put(structuredClone(certificate)))
  },
  replaceAll(certificates) {
    return runTransaction('readwrite', (store) => {
      store.clear()
      certificates.forEach((certificate) => store.put(structuredClone(certificate)))
    })
  },
  clear() {
    return runTransaction('readwrite', (store) => store.clear())
  }
}

export const certificateDatabaseInfo = {
  name: DATABASE_NAME,
  version: DATABASE_VERSION,
  store: CERTIFICATE_STORE
} as const
