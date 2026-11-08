/**
 * idb_manager.js - SIGMA 클라이언트 초고속 로컬 IndexedDB 저장소 모듈
 * ─────────────────────────────────────────────────────────────
 * 목적:
 * 1. 3,600+ 교차로 마스터 및 세부 데이터를 브라우저 IndexedDB에 정형 저장
 * 2. 새로고침 시 네트워크 전송(수십 MB) 없이 0.05초 만에 메모리 복원
 * 3. 단일 교차로 삭제/추가/수정 시 트랜잭션 단위 즉시 반영 (전체 캐시 파기 불필요)
 */

const SigmaIDB = (function() {
    const DB_NAME = 'sigma_local_db';
    const DB_VERSION = 1;
    let _db = null;

    function openDB() {
        if (_db) return Promise.resolve(_db);
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.warn('[IDB] IndexedDB not supported in this browser.');
                return resolve(null);
            }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('junctions')) {
                    db.createObjectStore('junctions', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('meta')) {
                    db.createObjectStore('meta', { keyPath: 'key' });
                }
            };
            req.onsuccess = (e) => {
                _db = e.target.result;
                resolve(_db);
            };
            req.onerror = (e) => {
                console.warn('[IDB] Failed to open IndexedDB:', e.target.error);
                resolve(null);
            };
        });
    }

    async function setMeta(key, value) {
        const db = await openDB();
        if (!db) return;
        return new Promise((resolve) => {
            const tx = db.transaction('meta', 'readwrite');
            const store = tx.objectStore('meta');
            store.put({ key, value, updated_at: Date.now() });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async function getMeta(key) {
        const db = await openDB();
        if (!db) return null;
        return new Promise((resolve) => {
            const tx = db.transaction('meta', 'readonly');
            const store = tx.objectStore('meta');
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
            req.onerror = () => resolve(null);
        });
    }

    async function saveJunctions(junctionsMap) {
        const db = await openDB();
        if (!db) return;
        return new Promise((resolve) => {
            const tx = db.transaction('junctions', 'readwrite');
            const store = tx.objectStore('junctions');
            const list = Object.values(junctionsMap || {});
            list.forEach(j => {
                // Leaflet marker 등 순환 참조 및 DOM 엘리먼트 객체 제외하고 저장
                const clean = { ...j };
                delete clean.marker;
                delete clean.arrows;
                delete clean.overlayElemCache;
                delete clean.popup;
                try {
                    store.put(clean);
                } catch (pe) {
                    console.warn('[IDB] Skipping uncloneable junction:', j.id, pe);
                }
            });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async function getAllJunctions() {
        const db = await openDB();
        if (!db) return null;
        return new Promise((resolve) => {
            const tx = db.transaction('junctions', 'readonly');
            const store = tx.objectStore('junctions');
            const req = store.getAll();
            req.onsuccess = () => {
                const res = {};
                (req.result || []).forEach(j => { res[j.id] = j; });
                resolve(res);
            };
            req.onerror = () => resolve(null);
        });
    }

    async function deleteJunction(jid) {
        const db = await openDB();
        if (!db) return;
        return new Promise((resolve) => {
            const tx = db.transaction('junctions', 'readwrite');
            const store = tx.objectStore('junctions');
            store.delete(jid);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async function clearAll() {
        const db = await openDB();
        if (!db) return;
        return new Promise((resolve) => {
            const tx = db.transaction(['junctions', 'meta'], 'readwrite');
            tx.objectStore('junctions').clear();
            tx.objectStore('meta').clear();
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    return {
        openDB,
        setMeta,
        getMeta,
        saveJunctions,
        getAllJunctions,
        deleteJunction,
        clearAll
    };
})();

if (typeof window !== 'undefined') {
    window.SigmaIDB = SigmaIDB;
}
