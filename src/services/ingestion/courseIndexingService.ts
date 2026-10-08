import { 
  IDocumentIngestionProvider, 
  TextIngestionProvider, 
  RealPDFIngestionProvider,
  RealPPTXIngestionProvider,
  RealVideoIngestionProvider
} from './providers';
import { SemanticChunker } from './chunker';
import { IVectorStore } from '../rag/vectorStore';
import { IngestionJob, IngestionResult } from '../../types/ingestion';
import { courseRepository } from '../courseRepository';
import { evaluationBenchmarkService } from '../evaluationBenchmarkService';

export class CourseIndexingService {
  private providers: IDocumentIngestionProvider[];
  private chunker = new SemanticChunker();

  constructor(private vectorStore: IVectorStore) {
    this.providers = [
      new TextIngestionProvider(),
      new RealPDFIngestionProvider(),
      new RealPPTXIngestionProvider(),
      new RealVideoIngestionProvider()
    ];
  }

  async indexFiles(courseId: string, files: File[], onProgress: (job: IngestionJob) => void): Promise<IngestionJob> {
    const job: IngestionJob = {
      id: crypto.randomUUID(),
      status: 'PENDING',
      files,
      progress: 0,
      results: []
    };

    onProgress({...job});

    job.status = 'EXTRACTING';
    onProgress({...job});

    const totalFiles = files.length;
    let completedFiles = 0;

    for (const file of files) {
      const provider = this.providers.find(p => p.canHandle(file));
      
      let result: IngestionResult;
      
      if (!provider) {
        result = {
          status: 'FAILED',
          documentId: crypto.randomUUID(),
          sourceTitle: file.name,
          contentUnits: [],
          error: `Unsupported file type for ${file.name}`
        };
      } else {
        try {
          result = await provider.ingest(file, (completedPages, totalPages) => {
            const fileProgress = totalPages > 0 ? completedPages / totalPages : 0;
            job.progress = Math.round(((completedFiles + fileProgress) / totalFiles) * 50);
            job.detail = `Extracting ${file.name}: page ${Math.min(completedPages + 1, totalPages)} of ${totalPages}`;
            onProgress({ ...job });
          });
          // Apply courseId to all content units
          result.contentUnits.forEach(u => u.courseId = courseId);
        } catch (error: any) {
          result = {
            status: 'FAILED',
            documentId: crypto.randomUUID(),
            sourceTitle: file.name,
            contentUnits: [],
            error: error.message || 'Unknown extraction error'
          };
        }
      }
      
      job.results.push(result);
      completedFiles++;
      job.progress = Math.round((completedFiles / totalFiles) * 50); // Extraction is 50%
      job.detail = `Finished extracting ${file.name}.`;
      onProgress({...job});
    }

    // Now chunk all extracted content
    job.status = 'CHUNKING';
    job.detail = 'Preparing extracted content for indexing.';
    onProgress({...job});
    
    const allUnits = job.results.flatMap(r => r.contentUnits);
    const chunks = this.chunker.chunk(allUnits);
    
    job.progress = 70;
    onProgress({...job});

    if (chunks.length === 0) {
      job.status = 'FAILED';
      job.progress = 100;
      if (job.results.length === 0) {
        job.results.push({
          status: 'FAILED',
          documentId: crypto.randomUUID(),
          sourceTitle: 'Ingestion',
          contentUnits: [],
          error: 'No usable course content was extracted.'
        });
      }
      onProgress({ ...job });
      return job;
    }

    // Add to vector store
    job.status = 'EMBEDDING';
    job.detail = 'Generating embeddings and indexing course material.';
    onProgress({...job});
    
    try {
      await this.vectorStore.add(chunks);
      for (const [resultIndex, result] of job.results.entries()) {
        if (!files[resultIndex]?.name.toLocaleLowerCase().endsWith('.pdf') || result.contentUnits.length === 0) continue;
        const sourceChunks = chunks.filter(chunk => chunk.metadata.sourceId === result.documentId);
        try {
          const benchmark = await evaluationBenchmarkService.generate(result.sourceTitle, result.documentId, sourceChunks);
          result.benchmarkCaseCount = benchmark.cases.length;
        } catch (error) {
          result.benchmarkError = error instanceof Error ? error.message : 'Could not generate a draft evaluation benchmark.';
          console.warn(`Benchmark draft generation failed for ${result.sourceTitle}:`, error);
        }
        onProgress({ ...job });
      }
      for (const [resultIndex, result] of job.results.entries()) {
        if (result.contentUnits.length === 0) continue;
        const file = files[resultIndex];
        if (!file) continue;
        const formData = new FormData();
        formData.append('sourceId', result.documentId);
        formData.append('file', file);
        const storedSource = await fetch('http://localhost:3001/api/sources', { method: 'POST', body: formData });
        if (!storedSource.ok) {
          result.status = 'PARTIAL';
          result.error = 'Content was indexed, but the original file could not be saved for direct citation links.';
        }
      }
      if (this.vectorStore.removeSource) {
        const documents = new Map<string, string>();
        for (const unit of allUnits) documents.set(unit.sourceTitle, unit.documentId);
        for (const [sourceTitle, documentId] of documents) {
          await this.vectorStore.removeSource(courseId, sourceTitle, documentId);
        }
      }
      courseRepository.saveIngestedContent(courseId, allUnits);
      job.status = job.results.some(result => result.status === 'FAILED' || result.status === 'PARTIAL') ? 'PARTIAL' : 'COMPLETED';
      job.progress = 100;
      job.detail = job.status === 'PARTIAL'
        ? 'Indexing finished with extraction or file-storage warnings. Review the file details below.'
        : 'Course material indexed successfully.';
    } catch (e: any) {
      job.status = 'FAILED';
      job.progress = 100;
      job.detail = 'Indexing failed. Review the error details below.';
      job.results.push({
        status: 'FAILED',
        documentId: 'vector-store',
        sourceTitle: 'Indexing Engine',
        contentUnits: [],
        error: `Failed to embed and index chunks: ${e.message}`
      });
    }
    
    onProgress({...job});
    return job;
  }
}
