export enum SupportedLanguage {
  VIETNAMESE = 'vi-VN',
  ENGLISH = 'en-US',
  JAPANESE = 'ja-JP'
}

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  flag: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: SupportedLanguage.VIETNAMESE, label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: SupportedLanguage.ENGLISH, label: 'English', flag: '🇺🇸' },
  { code: SupportedLanguage.JAPANESE, label: '日本語', flag: '🇯🇵' },
];

export interface TranscriptSegment {
  id: string;
  speaker: string; // "Speaker A", "Speaker B" or custom name
  timestamp: string; // "00:00"
  text: string;
}

export interface StoredFile {
  id: string;
  name: string;
  createdAt: number;
  language: SupportedLanguage;
  type: 'live' | 'upload';
  content: string; // For live notes or refined text
  segments?: TranscriptSegment[]; // For AI diarized content
  audioUrl?: string; // For uploaded files (blob url)
  tags?: string[];
  summary?: string;
}

export interface AppSettings {
  customVocabulary: string;
  userName: string;
}
