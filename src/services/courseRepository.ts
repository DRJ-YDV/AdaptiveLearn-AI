import { Course, Topic, Concept, LearnerModel, ID } from '../types/domain';
import { demoCourse, demoTopics, demoConcepts, demoSources } from '../data/demoCourse';
import { learnerModelService } from './learnerModelService';
import { ContentUnit } from '../types/ingestion';

interface StoredCourseMap {
  topics: Topic[];
  concepts: Concept[];
}

export class CourseRepository {
  private courseMapSyncs = new Map<string, Promise<void>>();

  async getCourse(courseId: ID): Promise<Course> {
    if (courseId !== demoCourse.id) throw new Error(`Course ${courseId} was not found.`);
    return Promise.resolve(demoCourse);
  }

  async getTopics(courseId: ID): Promise<Topic[]> {
    await this.syncStoredMapFromIndex(courseId);
    const stored = this.getStoredMap(courseId).topics;
    const topics = stored.length > 0 ? stored : demoTopics.filter(topic => topic.courseId === courseId);
    return topics.sort((a, b) => a.order - b.order);
  }

  async getConceptsByCourse(courseId: ID): Promise<Concept[]> {
    await this.syncStoredMapFromIndex(courseId);
    const stored = this.getStoredMap(courseId);
    if (stored.concepts.length > 0) return stored.concepts;
    const topicIds = new Set(demoTopics.filter(topic => topic.courseId === courseId).map(topic => topic.id));
    return demoConcepts.filter(concept => topicIds.has(concept.topicId));
  }

  async getLearnerModel(userId: ID, courseId: ID): Promise<LearnerModel> {
    return Promise.resolve(learnerModelService.getLearnerModel(userId, courseId));
  }

  saveIngestedContent(courseId: ID, units: ContentUnit[]): void {
    if (typeof localStorage === 'undefined' || units.length === 0) return;

    const stored = this.getStoredMap(courseId);
    const groupedByDocument = new Map<string, ContentUnit[]>();
    for (const unit of units) {
      const group = groupedByDocument.get(unit.documentId) ?? [];
      group.push(unit);
      groupedByDocument.set(unit.documentId, group);
    }

    for (const [documentId, documentUnits] of groupedByDocument) {
      const sourceTitle = documentUnits[0].sourceTitle;
      const oldTopicIds = new Set(stored.topics
        .filter(topic => topic.sourceTitle === sourceTitle || topic.name === sourceTitle || topic.id.startsWith(`uploaded-topic-${documentId}`))
        .map(topic => topic.id));
      stored.topics = stored.topics.filter(topic => !oldTopicIds.has(topic.id));
      stored.concepts = stored.concepts.filter(concept => !oldTopicIds.has(concept.topicId));

      const unitsByTopic = new Map<string, ContentUnit[]>();
      for (const unit of documentUnits) {
        const topicName = unit.topicName?.trim().slice(0, 100) || sourceTitle;
        const topicUnits = unitsByTopic.get(topicName) ?? [];
        topicUnits.push(unit);
        unitsByTopic.set(topicName, topicUnits);
      }

      let nextConceptIndex = 0;
      const conceptByName = new Map<string, Concept>();
      for (const [topicName, topicUnits] of unitsByTopic) {
        const topicId = `uploaded-topic-${documentId}-${topicName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}`;
        const order = [...demoTopics, ...stored.topics].reduce((maximum, topic) => Math.max(maximum, topic.order), 0) + 1;
        stored.topics.push({ id: topicId, courseId, name: topicName, order, description: `Extracted from ${sourceTitle}.`, sourceId: documentId, sourceTitle });

        const seenConcepts = new Set<string>();
        for (const unit of topicUnits) {
          const rawNames = unit.concepts?.length ? unit.concepts : [unit.text.split(/[.!?\n]/)[0]];
          for (const rawName of rawNames) {
            const name = rawName.trim().replace(/\s+/g, ' ').slice(0, 100);
            const key = name.toLocaleLowerCase();
            if (!name || seenConcepts.has(key)) continue;
            seenConcepts.add(key);
            const location = unit.location.type === 'page' ? `Page ${unit.location.page}`
              : unit.location.type === 'slide' ? `Slide ${unit.location.slide}`
              : unit.location.type === 'timestamp' ? unit.location.timestamp ?? 'Video segment'
              : unit.location.section ?? 'Section';
            const id = `uploaded-${documentId}-${++nextConceptIndex}`;
            const concept: Concept = {
              id, topicId, name, description: unit.text.trim().slice(0, 400), prerequisites: [],
              sourceReferences: [{
                id: `evidence-${documentId}-${nextConceptIndex}`, sourceId: documentId,
                sourceType: unit.sourceType, location, label: `${sourceTitle} - ${location}`,
                excerpt: unit.text.trim().slice(0, 600)
              }]
            };
            stored.concepts.push(concept);
            conceptByName.set(key, concept);
          }
        }
      }

      for (const relation of documentUnits.flatMap(unit => unit.prerequisiteRelations ?? [])) {
        const concept = conceptByName.get(relation.concept.trim().toLocaleLowerCase());
        const prerequisite = conceptByName.get(relation.prerequisite.trim().toLocaleLowerCase());
        if (!concept || !prerequisite || concept.id === prerequisite.id) continue;
        if (!concept.prerequisites.some(item => item.conceptId === prerequisite.id)) {
          concept.prerequisites.push({ conceptId: prerequisite.id, isHardRequirement: false });
        }
      }
    }

    localStorage.setItem(this.getStorageKey(courseId), JSON.stringify(stored));
    this.courseMapSyncs.delete(courseId);
  }

  private async syncStoredMapFromIndex(courseId: ID): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    const existingSync = this.courseMapSyncs.get(courseId);
    if (existingSync) return existingSync;

    const sync = (async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/vector/chunks?courseId=${encodeURIComponent(courseId)}`);
        if (!response.ok) return;
        const data = await response.json() as { chunks?: Array<{ id: string; text: string; metadata: { sourceId: string; sourceTitle: string; sourceType: Concept['sourceReferences'][number]['sourceType']; location: string; topicName?: string; concepts?: string[]; prerequisiteRelations?: Array<{ concept: string; prerequisite: string }> } }> };
        const stored = this.getStoredMap(courseId);
        const demoSourceIds = new Set(demoSources.map(source => source.id));
        type IndexedChunk = NonNullable<typeof data.chunks>[number];
        const grouped = new Map<string, IndexedChunk[]>();
        const latestSourceByTitle = new Map<string, string>();
        for (const chunk of data.chunks ?? []) {
          if (!chunk.metadata?.sourceId || !chunk.metadata.sourceTitle || demoSourceIds.has(chunk.metadata.sourceId)) continue;
          const key = chunk.metadata.sourceId;
          const group = grouped.get(key) ?? [];
          group.push(chunk);
          grouped.set(key, group);
          latestSourceByTitle.set(chunk.metadata.sourceTitle, key);
        }

        for (const [sourceId, chunks] of grouped) {
          const sourceTitle = chunks[0]?.metadata.sourceTitle ?? 'Uploaded course material';
          if (latestSourceByTitle.get(sourceTitle) !== sourceId) continue;
          const obsoleteTopicIds = new Set(stored.topics
            .filter(topic => (topic.sourceTitle === sourceTitle || topic.name === sourceTitle) && topic.sourceId !== sourceId)
            .map(topic => topic.id));
          stored.topics = stored.topics.filter(topic => !obsoleteTopicIds.has(topic.id));
          stored.concepts = stored.concepts.filter(concept => !obsoleteTopicIds.has(concept.topicId));
          if (stored.topics.some(topic => topic.sourceId === sourceId)) continue;
          const topicGroups = new Map<string, IndexedChunk[]>();
          for (const chunk of chunks) {
            const topicName = chunk.metadata.topicName?.trim() || sourceTitle;
            const topicChunks = topicGroups.get(topicName) ?? [];
            topicChunks.push(chunk);
            topicGroups.set(topicName, topicChunks);
          }

          const conceptsByName = new Map<string, Concept>();
          const pendingRelations = chunks.flatMap(chunk => chunk.metadata.prerequisiteRelations ?? []);
          let conceptIndex = 0;
          for (const [topicName, topicChunks] of topicGroups) {
            const topicId = `uploaded-topic-${sourceId}-${topicName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}`;
            const order = [...demoTopics, ...stored.topics].reduce((maximum, topic) => Math.max(maximum, topic.order), 0) + 1;
            stored.topics.push({ id: topicId, courseId, name: topicName, order, description: `Concepts recovered from indexed material: ${sourceTitle}.`, sourceId, sourceTitle });
            for (const chunk of topicChunks) {
              const names = chunk.metadata.concepts?.length ? chunk.metadata.concepts : [chunk.text.split(/\r?\n/).map(line => line.trim()).find(line => line.length >= 3 && line.length <= 100) || sourceTitle];
              for (const rawName of names) {
                const name = rawName.replace(/\s+/g, ' ').trim().slice(0, 100);
                const normalized = name.toLocaleLowerCase();
                if (!name || conceptsByName.has(normalized)) continue;
                const concept: Concept = {
                  id: `uploaded-${sourceId}-${++conceptIndex}`,
                  topicId,
                  name,
                  description: chunk.text.trim().slice(0, 400),
                  prerequisites: [],
                  sourceReferences: [{
                    id: `evidence-${sourceId}-${conceptIndex}`,
                    sourceId,
                    sourceType: chunk.metadata.sourceType,
                    location: chunk.metadata.location,
                    label: `${sourceTitle} - ${chunk.metadata.location}`,
                    excerpt: chunk.text.trim().slice(0, 600)
                  }]
                };
                stored.concepts.push(concept);
                conceptsByName.set(normalized, concept);
              }
            }
          }
          for (const relation of pendingRelations) {
            const concept = conceptsByName.get(relation.concept.toLocaleLowerCase().trim());
            const prerequisite = conceptsByName.get(relation.prerequisite.toLocaleLowerCase().trim());
            if (concept && prerequisite && concept.id !== prerequisite.id) {
              concept.prerequisites.push({ conceptId: prerequisite.id, isHardRequirement: false });
            }
          }
        }
        localStorage.setItem(this.getStorageKey(courseId), JSON.stringify(stored));
      } catch (error) {
        console.warn('Could not sync the Knowledge Map from indexed course material.', error);
      }
    })();
    this.courseMapSyncs.set(courseId, sync);
    return sync;
  }

  private getStorageKey(courseId: ID): string {
    return `adaptivelearn:course-map:${courseId}`;
  }

  private getStoredMap(courseId: ID): StoredCourseMap {
    try {
      const value = localStorage.getItem(this.getStorageKey(courseId));
      if (value) {
        const parsed = JSON.parse(value) as StoredCourseMap;
        if (Array.isArray(parsed.topics) && Array.isArray(parsed.concepts)) return parsed;
      }
    } catch (error) {
      console.warn('Could not read the saved course map.', error);
    }
    return { topics: [], concepts: [] };
  }
}

export const courseRepository = new CourseRepository();
