import type { Language } from './types';

const kn: Record<string, string> = {
  'Overview': 'ಸಾರಾಂಶ', 'Eligibility': 'ಅರ್ಹತೆ', 'Documents': 'ದಾಖಲೆಗಳು', 'Action plan': 'ಕ್ರಿಯಾ ಯೋಜನೆ',
  'Assistant': 'ಸಹಾಯಕ', 'What this means': 'ಇದರ ಅರ್ಥ', 'Application deadline': 'ಅರ್ಜಿಯ ಗಡುವು',
  'Eligibility requirements': 'ಅರ್ಹತಾ ನಿಯಮಗಳು', 'Required documents': 'ಅಗತ್ಯ ದಾಖಲೆಗಳು',
  'Download checklist': 'ಪಟ್ಟಿಯನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ', 'Your next steps': 'ಮುಂದಿನ ಕ್ರಮಗಳು',
  'Original document': 'ಮೂಲ ದಾಖಲೆ', 'Page': 'ಪುಟ', 'Previous page': 'ಹಿಂದಿನ ಪುಟ', 'Next page': 'ಮುಂದಿನ ಪುಟ',
  'Zoom in': 'ಹಿಗ್ಗಿಸಿ', 'Zoom out': 'ಕುಗ್ಗಿಸಿ', 'Fit to width': 'ಅಗಲಕ್ಕೆ ಹೊಂದಿಸಿ', 'Expand viewer': 'ವೀಕ್ಷಕವನ್ನು ವಿಸ್ತರಿಸಿ',
  'Close viewer': 'ವೀಕ್ಷಕವನ್ನು ಮುಚ್ಚಿ', 'View evidence': 'ಮೂಲವನ್ನು ವೀಕ್ಷಿಸಿ', 'Supporting quotation': 'ಮೂಲ ಉಲ್ಲೇಖ',
  'Verified quotation': 'ದೃಢಪಡಿಸಿದ ಉಲ್ಲೇಖ', 'Partial match': 'ಭಾಗಶಃ ಹೊಂದಾಣಿಕೆ', 'Unverified quotation': 'ದೃಢಪಡಿಸದ ಉಲ್ಲೇಖ',
  'Text verification unavailable': 'ಪಠ್ಯ ಪರಿಶೀಲನೆ ಲಭ್ಯವಿಲ್ಲ', 'Page unconfirmed': 'ಪುಟ ದೃಢಪಟ್ಟಿಲ್ಲ',
  'No quoted evidence - verify manually': 'ಉಲ್ಲೇಖವಿಲ್ಲ - ಸ್ವತಃ ಪರಿಶೀಲಿಸಿ',
  'Satisfied': 'ಪೂರೈಸಿದ ನಿಯಮಗಳು', 'Possible mismatches': 'ಸಂಭಾವ್ಯ ಅಸಾಮ್ಯಗಳು', 'Needs verification': 'ಪರಿಶೀಲನೆ ಅಗತ್ಯ',
  'Student value': 'ವಿದ್ಯಾರ್ಥಿಯ ಮಾಹಿತಿ', 'Not supplied': 'ನೀಡಲಾಗಿಲ್ಲ', 'Extracted condition': 'ಪಡೆಯಲಾದ ನಿಯಮ',
  'Scholarship assistant': 'ವಿದ್ಯಾರ್ಥಿವೇತನ ಸಹಾಯಕ', 'Ask about this notice': 'ಈ ಪ್ರಕಟಣೆಯ ಬಗ್ಗೆ ಕೇಳಿ',
  'Send question': 'ಪ್ರಶ್ನೆ ಕಳುಹಿಸಿ', 'Reset chat': 'ಸಂಭಾಷಣೆ ಮರುಹೊಂದಿಸಿ', 'Retry': 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
  'Preparing an answer': 'ಉತ್ತರ ಸಿದ್ಧವಾಗುತ್ತಿದೆ', 'General suggestions': 'ಸಾಮಾನ್ಯ ಸಲಹೆಗಳು', 'Missing information': 'ಬಾಕಿ ಮಾಹಿತಿ',
  'Why do I need verification?': 'ನನಗೆ ಪರಿಶೀಲನೆ ಏಕೆ ಬೇಕು?', 'What documents should I prepare?': 'ಯಾವ ದಾಖಲೆಗಳನ್ನು ಸಿದ್ಧಪಡಿಸಬೇಕು?',
  'What is the age limit?': 'ವಯಸ್ಸಿನ ಮಿತಿ ಏನು?', 'Print checklist': 'ಪಟ್ಟಿಯನ್ನು ಮುದ್ರಿಸಿ',
  'critical': 'ಅತ್ಯಗತ್ಯ', 'important': 'ಮುಖ್ಯ', 'optional': 'ಐಚ್ಛಿಕ',
  'Checklist completion does not submit an application.': 'ಪಟ್ಟಿಯನ್ನು ಪೂರ್ಣಗೊಳಿಸುವುದು ಅರ್ಜಿ ಸಲ್ಲಿಕೆಯಲ್ಲ.',
  'Before you apply, double-check these details': 'ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ಮೊದಲು ಈ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ',
  'Deadline not found in the uploaded document. Verify it through the official scholarship provider.': 'ಅಪ್‌ಲೋಡ್ ಮಾಡಿದ ದಾಖಲೆಯಲ್ಲಿ ಗಡುವು ಕಂಡುಬಂದಿಲ್ಲ. ಅಧಿಕೃತ ವಿದ್ಯಾರ್ಥಿವೇತನ ಸಂಸ್ಥೆಯೊಂದಿಗೆ ಪರಿಶೀಲಿಸಿ.',
  'New analysis': 'ಹೊಸ ವಿಶ್ಲೇಷಣೆ', 'Education level': 'ಶಿಕ್ಷಣದ ಮಟ್ಟ', 'State of residence': 'ವಾಸಿಸುವ ರಾಜ್ಯ',
  'Annual family income (₹)': 'ಕುಟುಂಬದ ವಾರ್ಷಿಕ ಆದಾಯ (₹)', 'Previous marks (%)': 'ಹಿಂದಿನ ಅಂಕಗಳು (%)',
  'Category': 'ವರ್ಗ', 'Age': 'ವಯಸ್ಸು', 'Study mode': 'ಅಧ್ಯಯನ ವಿಧಾನ', 'Analyze with Gemma 4': 'Gemma 4 ಮೂಲಕ ವಿಶ್ಲೇಷಿಸಿ',
  'Analyzing…': 'ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ…', 'Output language': 'ವಿವರಣೆಯ ಭಾಷೆ', 'Analysis results': 'ವಿಶ್ಲೇಷಣೆಯ ಫಲಿತಾಂಶಗಳು',
  'Open original': 'ಮೂಲವನ್ನು ತೆರೆಯಿರಿ', 'No eligibility criteria could be confidently extracted. Check the official notice.': 'ಅರ್ಹತಾ ನಿಯಮಗಳನ್ನು ವಿಶ್ವಾಸದಿಂದ ಪಡೆಯಲಾಗಲಿಲ್ಲ. ಅಧಿಕೃತ ಪ್ರಕಟಣೆಯನ್ನು ಪರಿಶೀಲಿಸಿ.',
  'No document requirements were clearly extracted. Review the notice manually.': 'ಅಗತ್ಯ ದಾಖಲೆಗಳು ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ. ಪ್ರಕಟಣೆಯನ್ನು ಪರಿಶೀಲಿಸಿ.',
  'This file exceeds the 8 MB limit.': 'ಈ ಫೈಲ್ 8 MB ಮಿತಿಯನ್ನು ಮೀರಿದೆ.',
  'Please choose a PDF, JPG, or PNG file.': 'PDF, JPG ಅಥವಾ PNG ಫೈಲ್ ಆಯ್ಕೆ ಮಾಡಿ.',
  'Upload a notice or choose a sample first.': 'ಮೊದಲು ಪ್ರಕಟಣೆ ಅಥವಾ ಮಾದರಿ ಆಯ್ಕೆ ಮಾಡಿ.',
  'Marks percentage must be between 0 and 100.': 'ಅಂಕಗಳ ಶೇಕಡಾವಾರು 0 ರಿಂದ 100 ರ ನಡುವೆ ಇರಬೇಕು.',
  'Annual income cannot be negative.': 'ವಾರ್ಷಿಕ ಆದಾಯ ಋಣಾತ್ಮಕವಾಗಿರಬಾರದು.',
  'Age must be a whole number between 0 and 120.': 'ವಯಸ್ಸು 0 ರಿಂದ 120 ರ ನಡುವೆ ಪೂರ್ಣ ಸಂಖ್ಯೆಯಾಗಿರಬೇಕು.',
  'Invalid student profile values.': 'ವಿದ್ಯಾರ್ಥಿಯ ಮಾಹಿತಿಯ ಮೌಲ್ಯಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.',
  'Analyze a scholarship notice': 'ವಿದ್ಯಾರ್ಥಿವೇತನ ಪ್ರಕಟಣೆಯನ್ನು ವಿಶ್ಲೇಷಿಸಿ',
  'Your document': 'ನಿಮ್ಮ ದಾಖಲೆ', 'Student profile': 'ವಿದ್ಯಾರ್ಥಿಯ ಮಾಹಿತಿ',
  'Upload the original scholarship notice.': 'ಮೂಲ ವಿದ್ಯಾರ್ಥಿವೇತನ ಪ್ರಕಟಣೆಯನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.',
  'Helps compare eligibility requirements.': 'ಅರ್ಹತಾ ನಿಯಮಗಳನ್ನು ಹೋಲಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.',
  'Drag & drop your file here': 'ನಿಮ್ಮ ಫೈಲ್ ಅನ್ನು ಇಲ್ಲಿ ಎಳೆಯಿರಿ',
  'browse from your device': 'ನಿಮ್ಮ ಸಾಧನದಿಂದ ಆಯ್ಕೆ ಮಾಡಿ',
  'Scholarship PDF': 'ವಿದ್ಯಾರ್ಥಿವೇತನ PDF', 'Notice image': 'ಪ್ರಕಟಣೆಯ ಚಿತ್ರ',
  'Your clarity starts here': 'ನಿಮ್ಮ ಸ್ಪಷ್ಟತೆ ಇಲ್ಲಿ ಆರಂಭವಾಗುತ್ತದೆ',
  'Complete the missing profile details and analyze again to update comparisons.': 'ಹೋಲಿಕೆಯನ್ನು ನವೀಕರಿಸಲು ಬಾಕಿ ಮಾಹಿತಿಯನ್ನು ನೀಡಿ ಮತ್ತೆ ವಿಶ್ಲೇಷಿಸಿ.',
  'No upload history': 'ಅಪ್‌ಲೋಡ್ ಇತಿಹಾಸವಿಲ್ಲ',
  'Document could not be displayed. Open the original file.': 'ದಾಖಲೆ ಪ್ರದರ್ಶಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮೂಲ ಫೈಲ್ ತೆರೆಯಿರಿ.',
};
export const t = (language: Language, text: string) => language === 'kn' ? kn[text] ?? text : text;

export function friendlyError(language: Language, message: string): string {
  if (language === 'en') return message;
  if (kn[message]) return kn[message];
  if (/session|expired/i.test(message)) return 'ದಾಖಲೆಯ ಅವಧಿ ಮುಗಿದಿದೆ. ಪ್ರಕಟಣೆಯನ್ನು ಮತ್ತೆ ವಿಶ್ಲೇಷಿಸಿ.';
  if (/quota|rate limit|429/i.test(message)) return 'Gemma API ಬಳಕೆ ಮಿತಿ ತಲುಪಿದೆ. ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಪ್ರಯತ್ನಿಸಿ.';
  if (/access denied|configured|API key/i.test(message)) return 'Gemma API ಸಂರಚನೆಯನ್ನು ಪರಿಶೀಲಿಸಿ. ಮಾನ್ಯ API ಕೀ ಅಗತ್ಯವಿದೆ.';
  if (/timeout|timed out/i.test(message)) return 'Gemma ಉತ್ತರಿಸಲು ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಂಡಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';
  return 'ವಿನಂತಿ ಪೂರ್ಣಗೊಳ್ಳಲಿಲ್ಲ. ಮಾಹಿತಿಯನ್ನು ಉಳಿಸಲಾಗಿದೆ; ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';
}
