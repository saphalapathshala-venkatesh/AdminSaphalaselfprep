import { parseDocxHtml, validateRow } from '../lib/importValidator';
import mammoth from 'mammoth';

async function main() {
  const result = await mammoth.convertToHtml({ path: 'attached_assets/Test_Bulk_1775067150393.docx' });
  const rows = parseDocxHtml(result.value);
  console.log('Rows found:', rows.length);
  rows.forEach((r: any, i: number) => {
    console.log(`\n--- Row ${i+1} ---`);
    console.log('category:', JSON.stringify(r.category));
    console.log('subject:', JSON.stringify(r.subject));
    console.log('topic:', JSON.stringify(r.topic));
    console.log('subtopic:', JSON.stringify(r.subtopic));
    console.log('type:', JSON.stringify(r.type));
    console.log('difficulty:', JSON.stringify(r.difficulty));
    const vr = validateRow(r);
    console.log('isValid:', vr.isValid, '| error:', vr.errorMsg);
    if (vr.normalizedRow) {
      console.log('normalizedRow.category:', JSON.stringify(vr.normalizedRow.category));
      console.log('normalizedRow.subject:', JSON.stringify(vr.normalizedRow.subject));
      console.log('normalizedRow.topic:', JSON.stringify(vr.normalizedRow.topic));
      console.log('normalizedRow.subtopic:', JSON.stringify(vr.normalizedRow.subtopic));
    }
  });
}
main().catch(console.error);
