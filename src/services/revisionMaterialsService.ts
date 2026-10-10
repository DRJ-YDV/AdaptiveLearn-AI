export interface RevisionFlashcard {
  front: string;
  back: string;
  evidenceChunkIds: string[];
}

export interface RevisionKit {
  sourceId: string;
  sourceTitle: string;
  generatedAt: string;
  summary: string;
  keyPoints: string[];
  flashcards: RevisionFlashcard[];
}

const STORAGE_PREFIX = 'adaptivelearn:revision-kit:';

export class RevisionMaterialsService {
  async generate(courseId: string, sourceId: string): Promise<RevisionKit> {
    const response = await fetch('http://localhost:3001/api/gemini/generate-revision-kit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, sourceId })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Could not generate revision materials.');
    const kit = payload as RevisionKit;
    if (kit.sourceId !== sourceId || typeof kit.summary !== 'string' || !Array.isArray(kit.flashcards)) {
      throw new Error('The revision-kit service returned an invalid response.');
    }
    this.save(kit);
    return kit;
  }

  get(sourceId: string): RevisionKit | undefined {
    if (typeof localStorage === 'undefined') return undefined;
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}${sourceId}`);
      if (!saved) return undefined;
      const kit = JSON.parse(saved) as RevisionKit;
      return kit.sourceId === sourceId && Array.isArray(kit.flashcards) ? kit : undefined;
    } catch { return undefined; }
  }

  save(kit: RevisionKit): void {
    if (typeof localStorage !== 'undefined') localStorage.setItem(`${STORAGE_PREFIX}${kit.sourceId}`, JSON.stringify(kit));
  }

  remove(sourceId: string): void {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(`${STORAGE_PREFIX}${sourceId}`);
  }
}

export const revisionMaterialsService = new RevisionMaterialsService();
