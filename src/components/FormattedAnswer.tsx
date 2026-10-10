import React from 'react';

const renderInline = (text: string): React.ReactNode[] => text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
  if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
  if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
  if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
  return <React.Fragment key={index}>{part}</React.Fragment>;
});

const isBlockStart = (line: string) => /^#{1,4}\s|^```|^>\s?|^\s*[-*+]\s+|^\s*\d+[.)]\s+/.test(line);

export const FormattedAnswer: React.FC<{ content: string }> = ({ content }) => {
  // Some model answers place several Markdown list items on one line. Split
  // those common patterns before parsing so the list remains readable.
  const normalized = content
    .replace(/\r\n?/g, '\n')
    .replace(/\s+[-*+]\s+(?=(?:\*\*|`)[^\n]+)/g, '\n- ')
    .replace(/([.!?])\s+(?=\d+[.)]\s+(?:\*\*|`))/g, '$1\n');
  const lines = normalized.split('\n');
  const blocks: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }

    if (line.startsWith('```')) {
      index++;
      const code: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith('```')) code.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push(<pre key={`code-${index}`}><code>{code.join('\n')}</code></pre>);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const Heading = heading[1].length < 3 ? 'h3' : 'h4';
      blocks.push(<Heading key={`heading-${index}`}>{renderInline(heading[2])}</Heading>);
      index++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) quote.push(lines[index++].trim().replace(/^>\s?/, ''));
      blocks.push(<blockquote key={`quote-${index}`}>{renderInline(quote.join(' '))}</blockquote>);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (unordered || ordered) {
      const listItems: string[] = [];
      const listType = unordered ? 'unordered' : 'ordered';
      while (index < lines.length) {
        const itemLine = lines[index].trim();
        const item = listType === 'unordered' ? itemLine.match(/^[-*+]\s+(.*)$/) : itemLine.match(/^\d+[.)]\s+(.*)$/);
        if (!item) break;
        listItems.push(item[1]);
        index++;
      }
      const List = listType === 'unordered' ? 'ul' : 'ol';
      blocks.push(<List key={`list-${index}`}>{listItems.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</List>);
      continue;
    }

    const paragraph = [line];
    index++;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index].trim())) paragraph.push(lines[index++].trim());
    blocks.push(<p key={`paragraph-${index}`}>{renderInline(paragraph.join(' '))}</p>);
  }

  return <div className="formatted-answer">{blocks}</div>;
};
