export type UploadedMobileFile = {
  name: string;
  type: string;
  dataUrl: string;
};

type MobileUploadSession = {
  sessionId: string;
  kioskToken?: string;
  createdAt: number;
  files: UploadedMobileFile[];
};

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const mobileUploadStore = new Map<string, MobileUploadSession>();

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of mobileUploadStore.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      mobileUploadStore.delete(id);
    }
  }
}

export function saveMobileUploads(sessionId: string, kioskToken: string, files: UploadedMobileFile[]) {
  cleanExpiredSessions();
  mobileUploadStore.set(sessionId, {
    sessionId,
    kioskToken,
    createdAt: Date.now(),
    files
  });
}

export function getMobileUploads(sessionId: string, kioskToken: string): UploadedMobileFile[] | null {
  cleanExpiredSessions();
  const session = mobileUploadStore.get(sessionId);
  if (!session || !kioskToken || session.kioskToken !== kioskToken) return null;
  return session.files;
}

export function clearMobileUploads(sessionId: string) {
  mobileUploadStore.delete(sessionId);
}
