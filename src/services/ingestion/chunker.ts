import { ContentUnit } from '../../types/ingestion';
import { DocumentChunk } from '../../types/rag';

export class SemanticChunker {
  chunk(units: ContentUnit[]): DocumentChunk[] {
    // For this implementation, we maintain a 1:1 mapping between ContentUnit and DocumentChunk,
    // assuming ContentUnit was already broken down sensibly by the ingestion providers (e.g. by paragraph or by page).
    // In a more complex implementation, we might split large ContentUnits into smaller overlapping DocumentChunks.
    
    return units.map(unit => {
      let locationStr = 'Unknown Location';
      if (unit.location.type === 'page') locationStr = `Page ${unit.location.page}`;
      else if (unit.location.type === 'slide') locationStr = `Slide ${unit.location.slide}`;
      else if (unit.location.type === 'section') locationStr = `${unit.location.section}`;
      else if (unit.location.type === 'timestamp') locationStr = `${unit.location.timestamp}`;

      return {
        id: `chunk-${unit.id}`,
        text: unit.text,
        metadata: {
          courseId: unit.courseId,
          sourceId: unit.documentId,
          sourceTitle: unit.sourceTitle,
          sourceType: unit.sourceType,
          location: locationStr,
          topicId: unit.topicId,
          conceptId: unit.conceptId,
          startTime: unit.location.startTime,
          endTime: unit.location.endTime,
          topicName: unit.topicName,
          concepts: unit.concepts,
          prerequisiteRelations: unit.prerequisiteRelations
        }
      };
    });
  }
}
