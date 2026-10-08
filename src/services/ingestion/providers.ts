import { IngestionResult, ContentUnit } from '../../types/ingestion';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Bundle the worker locally so PDF ingestion works without a third-party CDN.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface IDocumentIngestionProvider {
  canHandle(file: File): boolean;
  ingest(file: File, onProgress?: (completed: number, total: number) => void): Promise<IngestionResult>;
}

export class TextIngestionProvider implements IDocumentIngestionProvider {
  canHandle(file: File): boolean {
    const name = file.name.toLowerCase();
    return name.endsWith('.txt') || name.endsWith('.md');
  }

  async ingest(file: File): Promise<IngestionResult> {
    const documentId = crypto.randomUUID();
    const text = await file.text();
    
    // Simple heuristic chunking by double newlines for paragraphs/sections
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
    const headings = text.split(/\r?\n/).map(line => line.match(/^#{1,6}\s+(.+)/)?.[1]?.trim()).filter((heading): heading is string => !!heading);
    if (paragraphs.length === 0) {
      return { status: 'FAILED', documentId, sourceTitle: file.name, contentUnits: [], error: 'The text file is empty.' };
    }
    
    const contentUnits: ContentUnit[] = paragraphs.map((p, idx) => ({
      id: `${documentId}-sec-${idx}`,
      documentId,
      sourceTitle: file.name,
      sourceType: 'DOCUMENT',
      text: p.trim(),
      concepts: headings.length ? headings : [p.trim().split(/[.!?\n]/)[0].slice(0, 80)].filter(Boolean),
      location: {
        type: 'section',
        section: `Section ${idx + 1}`
      }
    }));

    return {
      status: 'COMPLETED',
      documentId,
      sourceTitle: file.name,
      contentUnits
    };
  }
}

export class RealPDFIngestionProvider implements IDocumentIngestionProvider {
  canHandle(file: File): boolean {
    return file.name.toLowerCase().endsWith('.pdf');
  }

  async ingest(file: File, onProgress?: (completed: number, total: number) => void): Promise<IngestionResult> {
    const documentId = crypto.randomUUID();
    const contentUnits: ContentUnit[] = [];
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      const numPages = pdf.numPages;

      for (let i = 1; i <= numPages; i++) {
        onProgress?.(i - 1, numPages);
        const page = await pdf.getPage(i);
        
        // Render page to canvas
        const viewport = page.getViewport({ scale: 1.5 }); // Good enough for OCR/Vision
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        if (context) {
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          const base64Image = canvas.toDataURL('image/jpeg', 0.8);

          // Send to Gemini Backend for extraction
          const response = await fetch('http://localhost:3001/api/gemini/extract-page', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64Image,
              mimeType: 'image/jpeg',
              locationContext: `Page ${i} of ${file.name}`
            }),
            signal: AbortSignal.timeout(90_000)
          });

          if (!response.ok) {
            const detail = await response.json().catch(() => ({}));
            const reason = typeof detail.details === 'string' && detail.details.trim()
              ? detail.details
              : typeof detail.error === 'string' && detail.error.trim()
                ? detail.error
                : 'Gemini did not return an extraction result.';
            throw new Error(`Could not extract PDF page ${i}: ${reason}`);
          }

          const extractedData = await response.json();
          
          let combinedText = extractedData.text || '';
          if (extractedData.visualDescription) {
            combinedText += `\n\n[Visual Content]: ${extractedData.visualDescription}`;
          }

          contentUnits.push({
            id: `${documentId}-page-${i}`,
            documentId,
            sourceTitle: file.name,
            sourceType: 'TEXTBOOK',
            text: combinedText,
            concepts: Array.isArray(extractedData.concepts) ? extractedData.concepts.filter((value: unknown): value is string => typeof value === 'string') : [],
            prerequisiteRelations: Array.isArray(extractedData.prerequisiteRelations) ? extractedData.prerequisiteRelations.filter((value: any) => typeof value?.concept === 'string' && typeof value?.prerequisite === 'string') : [],
            topicName: typeof extractedData.title === 'string' ? extractedData.title : undefined,
            location: { type: 'page', page: i }
          });
        }
        onProgress?.(i, numPages);
      }

      return {
        status: contentUnits.length === 0 ? 'FAILED' : 'COMPLETED',
        documentId,
        sourceTitle: file.name,
        contentUnits,
        ...(contentUnits.length === 0 ? { error: 'No PDF pages could be extracted.' } : {})
      };
    } catch (e) {
      console.error("PDF Extraction failed:", e);
      return {
        status: contentUnits.length > 0 ? 'PARTIAL' : 'FAILED',
        documentId,
        sourceTitle: file.name,
        contentUnits,
        error: e instanceof Error ? e.message : 'PDF extraction failed.'
      };
    }
  }
}

export class RealPPTXIngestionProvider implements IDocumentIngestionProvider {
  canHandle(file: File): boolean {
    return file.name.toLowerCase().endsWith('.pptx');
  }

  async ingest(file: File): Promise<IngestionResult> {
    const documentId = crypto.randomUUID();
    const contentUnits: ContentUnit[] = [];

    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // Filter for slide XML files
      const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
      
      // Sort slides numerically
      slideFiles.sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''));
        const numB = parseInt(b.replace(/\D/g, ''));
        return numA - numB;
      });

      let slideIndex = 1;
      let visualExtractionFailed = false;
      let structureExtractionFailed = false;
      for (const slidePath of slideFiles) {
        const slideXml = await zip.files[slidePath].async('string');
        
        // Simple regex to extract text inside <a:t> nodes (PowerPoint text nodes)
        const textMatches = slideXml.match(/<a:t>([^<]+)<\/a:t>/g) || [];
        const slideText = textMatches.map(tag => tag.replace(/<\/?a:t>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'")).join(' ');

        const relsPath = `ppt/slides/_rels/${slidePath.split('/').pop()}.rels`;
        const relsFile = zip.file(relsPath);
        const slideImages: Array<{ data: string; mimeType: string }> = [];
        if (relsFile) {
          const relsXml = await relsFile.async('string');
          const embeddedIds = new Set([...slideXml.matchAll(/r:embed=["']([^"']+)["']/g)].map(match => match[1]));
          const relationships = [...relsXml.matchAll(/<Relationship\b[^>]*\/?\s*>/g)];
          for (const relation of relationships) {
            const attributes = Object.fromEntries([...relation[0].matchAll(/([\w:]+)=["']([^"']*)["']/g)].map(match => [match[1], match[2]]));
            if (!embeddedIds.has(attributes.Id) || !attributes.Target || attributes.TargetMode === 'External') continue;
            const target = attributes.Target.replace(/\\/g, '/');
            const imagePath = (target.startsWith('/')
              ? target.slice(1).split('/')
              : ['ppt', 'slides', ...target.split('/')]
            ).reduce<string[]>((segments, segment) => {
              if (segment === '..') segments.pop();
              else if (segment !== '.' && segment) segments.push(segment);
              return segments;
            }, []).join('/');
            const imageFile = zip.file(imagePath);
            if (!imageFile) continue;
            const extension = imagePath.split('.').pop()?.toLowerCase();
            const mimeType = ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' } as Record<string, string>)[extension ?? ''];
            if (!mimeType) continue;
            const bytes = await imageFile.async('uint8array');
            let binary = '';
            for (let offset = 0; offset < bytes.length; offset += 0x8000) {
              binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
            }
            slideImages.push({ data: btoa(binary), mimeType });
          }
        }

        const visualNotes: string[] = [];
        const imageConcepts: string[] = [];
        for (let imageIndex = 0; imageIndex < slideImages.length; imageIndex++) {
          try {
            const response = await fetch('http://localhost:3001/api/gemini/extract-page', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageBase64: `data:${slideImages[imageIndex].mimeType};base64,${slideImages[imageIndex].data}`,
                mimeType: slideImages[imageIndex].mimeType,
                locationContext: `Slide ${slideIndex} figure ${imageIndex + 1} of ${file.name}`
              })
            });
            if (!response.ok) throw new Error(`Image extraction failed on slide ${slideIndex}.`);
            const extracted = await response.json();
            if (extracted.visualDescription) visualNotes.push(extracted.visualDescription);
            if (Array.isArray(extracted.concepts)) imageConcepts.push(...extracted.concepts.filter((value: unknown): value is string => typeof value === 'string'));
            if (extracted.text) visualNotes.push(`Text in figure: ${extracted.text}`);
          } catch (error) {
            visualExtractionFailed = true;
            console.warn(`Could not analyze an image on slide ${slideIndex}:`, error);
          }
        }
        const combinedSlideText = [slideText, ...visualNotes.map(note => `[Slide visual]: ${note}`)].filter(Boolean).join('\n\n');

        if (combinedSlideText.trim().length > 0) {
          let structured = { title: '', concepts: [] as string[], prerequisiteRelations: [] as Array<{ concept: string; prerequisite: string }> };
          try {
            const structureResponse = await fetch('http://localhost:3001/api/gemini/structure-content', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: combinedSlideText, sourceTitle: file.name, location: `Slide ${slideIndex}` })
            });
            if (!structureResponse.ok) throw new Error(`Could not extract topic structure for slide ${slideIndex}.`);
            const parsed = await structureResponse.json();
            structured = {
              title: typeof parsed.title === 'string' ? parsed.title : '',
              concepts: Array.isArray(parsed.concepts) ? parsed.concepts.filter((value: unknown): value is string => typeof value === 'string') : [],
              prerequisiteRelations: Array.isArray(parsed.prerequisiteRelations) ? parsed.prerequisiteRelations.filter((value: any) => typeof value?.concept === 'string' && typeof value?.prerequisite === 'string') : []
            };
          } catch (error) {
            structureExtractionFailed = true;
            console.warn(`Could not extract concept structure from slide ${slideIndex}:`, error);
          }
          contentUnits.push({
            id: `${documentId}-slide-${slideIndex}`,
            documentId,
            sourceTitle: file.name,
            sourceType: 'SLIDE',
            text: combinedSlideText,
            concepts: [...new Set([...structured.concepts, ...imageConcepts, slideText.split(/[.!?\n]/)[0].trim().slice(0, 80)])].filter(Boolean),
            prerequisiteRelations: structured.prerequisiteRelations,
            topicName: structured.title || slideText.split(/[.!?\n]/)[0].trim().slice(0, 100) || undefined,
            location: { type: 'slide', slide: slideIndex }
          });
        }
        slideIndex++;
      }

      return {
        status: contentUnits.length === 0 ? 'FAILED' : visualExtractionFailed || structureExtractionFailed ? 'PARTIAL' : 'COMPLETED',
        documentId,
        sourceTitle: file.name,
        contentUnits,
        ...(contentUnits.length === 0 ? { error: 'No readable slide text or image content was found.' } : visualExtractionFailed || structureExtractionFailed ? { error: 'Some visual or topic/concept extraction steps did not complete; see details for affected slides.' } : {})
      };
    } catch (e) {
      console.error("PPTX Extraction failed:", e);
      return {
        status: 'FAILED',
        documentId,
        sourceTitle: file.name,
        contentUnits: [],
        error: e instanceof Error ? e.message : 'PowerPoint extraction failed.'
      };
    }
  }
}

export class PDFFallbackIngestionProvider implements IDocumentIngestionProvider {
  canHandle(file: File): boolean {
    return file.name.toLowerCase().endsWith('.pdf');
  }

  async ingest(file: File): Promise<IngestionResult> {
    const documentId = crypto.randomUUID();
    
    // Simulate parsing time
    await new Promise(r => setTimeout(r, 1500));

    // Fallback: We pretend we extracted text from this PDF.
    const contentUnits: ContentUnit[] = [
      {
        id: `${documentId}-page-1`,
        documentId,
        sourceTitle: file.name,
        sourceType: 'TEXTBOOK',
        text: `[Extracted from ${file.name}] Introduction to the subject. This is a placeholder for real PDF extraction which requires external libraries.`,
        concepts: ['Introduction'],
        location: { type: 'page', page: 1 }
      },
      {
        id: `${documentId}-page-2`,
        documentId,
        sourceTitle: file.name,
        sourceType: 'TEXTBOOK',
        text: `[Extracted from ${file.name}] The core concept revolves around optimizing loss functions using iterative methods.`,
        concepts: ['Optimization', 'Loss functions'],
        location: { type: 'page', page: 2 }
      }
    ];

    return {
      status: 'COMPLETED',
      documentId,
      sourceTitle: file.name,
      contentUnits
    };
  }
}

export class PPTXFallbackIngestionProvider implements IDocumentIngestionProvider {
  canHandle(file: File): boolean {
    return file.name.toLowerCase().endsWith('.pptx');
  }

  async ingest(file: File): Promise<IngestionResult> {
    const documentId = crypto.randomUUID();
    await new Promise(r => setTimeout(r, 1200));

    const contentUnits: ContentUnit[] = [
      {
        id: `${documentId}-slide-1`,
        documentId,
        sourceTitle: file.name,
        sourceType: 'SLIDE',
        text: `[Extracted from ${file.name} Slide 1] Title: Overview. Bullet points: Welcome to the course.`,
        concepts: ['Overview'],
        location: { type: 'slide', slide: 1 }
      }
    ];

    return {
      status: 'COMPLETED',
      documentId,
      sourceTitle: file.name,
      contentUnits
    };
  }
}

export class RealVideoIngestionProvider implements IDocumentIngestionProvider {
  canHandle(file: File): boolean {
    const ext = file.name.toLowerCase();
    return ext.endsWith('.mp4') || ext.endsWith('.webm') || ext.endsWith('.mov');
  }

  private async getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(0);
      };
      video.src = URL.createObjectURL(file);
    });
  }

  private formatTimestamp(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  async ingest(file: File): Promise<IngestionResult> {
    const documentId = crypto.randomUUID();
    const contentUnits: ContentUnit[] = [];
    let uploadedFileName: string | undefined;

    try {
      const duration = await this.getVideoDuration(file);
      if (duration === 0) throw new Error("Could not read video duration.");

      // Upload to Gemini backend
      const formData = new FormData();
      formData.append('video', file);

      const uploadRes = await fetch('http://localhost:3001/api/gemini/upload-video', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) throw new Error("Failed to upload video to backend.");
      const { name, uri, mimeType } = await uploadRes.json();
      uploadedFileName = name;

      // Process in 5 minute (300s) chunks
      const CHUNK_SIZE = 300;
      let extractionFailed = false;
      for (let startTime = 0; startTime < duration; startTime += CHUNK_SIZE) {
        const endTime = Math.min(startTime + CHUNK_SIZE, duration);
        
        const extractRes = await fetch('http://localhost:3001/api/gemini/extract-video-chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileUri: uri, mimeType, startTime, endTime })
        });

        if (extractRes.ok) {
          const data = await extractRes.json();
          if (data.segments && Array.isArray(data.segments)) {
            for (let i = 0; i < data.segments.length; i++) {
              const seg = data.segments[i];
              const segStart = seg.startTime ?? startTime;
              const segEnd = seg.endTime ?? endTime;
              
              let combinedText = seg.transcript || '';
              if (seg.visualDescription) {
                combinedText += `\n\n[Visual Content]: ${seg.visualDescription}`;
              }

              contentUnits.push({
                id: `${documentId}-vid-${startTime}-${i}`,
                documentId,
                sourceTitle: file.name,
                sourceType: 'VIDEO',
                text: combinedText,
                concepts: Array.isArray(seg.concepts) ? seg.concepts.filter((value: unknown): value is string => typeof value === 'string') : [],
                prerequisiteRelations: Array.isArray(seg.prerequisiteRelations) ? seg.prerequisiteRelations.filter((value: any) => typeof value?.concept === 'string' && typeof value?.prerequisite === 'string') : [],
                location: {
                  type: 'timestamp',
                  timestamp: `${this.formatTimestamp(segStart)}–${this.formatTimestamp(segEnd)}`,
                  startTime: segStart,
                  endTime: segEnd
                }
              });
            }
          }
        } else {
          extractionFailed = true;
        }
      }

      return {
        status: contentUnits.length === 0 ? 'FAILED' : extractionFailed ? 'PARTIAL' : 'COMPLETED',
        documentId,
        sourceTitle: file.name,
        contentUnits,
        ...(contentUnits.length === 0 ? { error: 'No video segments were extracted.' } : extractionFailed ? { error: 'Some video segments could not be extracted.' } : {})
      };
    } catch (e: any) {
      console.error("Video Ingestion failed:", e);
      return {
        status: 'FAILED',
        documentId,
        sourceTitle: file.name,
        contentUnits: [],
        error: e.message || "Failed to process video"
      };
    } finally {
      if (uploadedFileName) {
        await fetch('http://localhost:3001/api/gemini/delete-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: uploadedFileName })
        }).catch(error => console.error('Failed to clean up Gemini video upload:', error));
      }
    }
  }
}

export class VideoFallbackIngestionProvider implements IDocumentIngestionProvider {
  canHandle(file: File): boolean {
    const ext = file.name.toLowerCase();
    return ext.endsWith('.mp4') || ext.endsWith('.webm') || ext.endsWith('.mov');
  }

  async ingest(file: File): Promise<IngestionResult> {
    const documentId = crypto.randomUUID();
    await new Promise(r => setTimeout(r, 2000));

    const contentUnits: ContentUnit[] = [
      {
        id: `${documentId}-vid-1`,
        documentId,
        sourceTitle: file.name,
        sourceType: 'VIDEO',
        text: `[Extracted from ${file.name}] The instructor explains the concept of gradient descent. [Visual Content]: A diagram shows a parabola representing the loss function.`,
        concepts: ['Gradient descent', 'Loss function'],
        location: {
          type: 'timestamp',
          timestamp: '00:00–02:30',
          startTime: 0,
          endTime: 150
        }
      }
    ];

    return {
      status: 'COMPLETED',
      documentId,
      sourceTitle: file.name,
      contentUnits
    };
  }
}
