import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Wand2, Copy, Trash2, FileText, Check, AlertCircle, 
  Sparkles, Upload, Play, Pause, Search, Sidebar, Download, 
  MoreVertical, Clock, User, Settings, Folder, Languages
} from 'lucide-react';
import { SupportedLanguage, LANGUAGE_OPTIONS, StoredFile, TranscriptSegment } from './types';
import { LanguageSelector } from './components/LanguageSelector';
import { Button } from './components/Button';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { refineTextWithGemini, summarizeTextWithGemini, transcribeAudioFile } from './services/geminiService';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// --- UI Translations ---
const TRANSLATIONS = {
  [SupportedLanguage.VIETNAMESE]: {
    library: "Thư viện",
    newNote: "Ghi chú mới",
    searchPlaceholder: "Tìm kiếm bản ghi...",
    customVocab: "Từ điển tùy chỉnh / Ngữ cảnh",
    customVocabPlaceholder: "Ví dụ: Thuật ngữ y tế, Tên dự án...",
    liveMode: "Ghi âm Trực tiếp",
    uploadMode: "Tải lên Tệp (Hội thoại)",
    export: "Xuất file",
    exportTxt: "Văn bản (.txt)",
    exportSrt: "Phụ đề (.srt)",
    startRecord: "Ghi âm",
    stopRecord: "Dừng lại",
    recording: "Đang ghi âm...",
    refine: "Chuẩn hóa",
    summarize: "Tóm tắt",
    processing: "Đang xử lý...",
    uploadPrompt: "Nhấn để tải lên Audio/Video",
    uploadSub: "Hỗ trợ MP3, WAV, MP4, M4A",
    analyzing: "AI đang phân tích hội thoại & người nói...",
    summaryTitle: "Tóm tắt & Hành động (AI)",
    genSummary: "Tạo tóm tắt",
    placeholderType: "Bắt đầu nói hoặc nhập văn bản...",
    noFiles: "Chưa có bản ghi nào",
    errorRefine: "Lỗi khi chuẩn hóa văn bản",
    errorTranscribe: "Lỗi khi phân tích file",
    fileType: "Tệp",
    liveType: "Ghi âm"
  },
  [SupportedLanguage.ENGLISH]: {
    library: "Library",
    newNote: "New Note",
    searchPlaceholder: "Search transcripts...",
    customVocab: "Custom Vocabulary / Context",
    customVocabPlaceholder: "e.g. Medical terms, Project names...",
    liveMode: "Live Recording",
    uploadMode: "Import File (Conversation)",
    export: "Export",
    exportTxt: "Text (.txt)",
    exportSrt: "Subtitles (.srt)",
    startRecord: "Record",
    stopRecord: "Stop",
    recording: "Recording...",
    refine: "Refine",
    summarize: "Summarize",
    processing: "Processing...",
    uploadPrompt: "Click to Upload Audio/Video",
    uploadSub: "Supports MP3, WAV, MP4, M4A",
    analyzing: "AI is analyzing conversation & speakers...",
    summaryTitle: "Summary & Action Items (AI)",
    genSummary: "Generate Summary",
    placeholderType: "Start typing or recording...",
    noFiles: "No files yet",
    errorRefine: "Error refining text",
    errorTranscribe: "Failed to transcribe file",
    fileType: "File",
    liveType: "Live"
  },
  [SupportedLanguage.JAPANESE]: {
    library: "ライブラリ",
    newNote: "新規メモ",
    searchPlaceholder: "検索...",
    customVocab: "カスタム辞書 / コンテキスト",
    customVocabPlaceholder: "例：医療用語、プロジェクト名...",
    liveMode: "ライブ録音",
    uploadMode: "ファイルインポート（会話）",
    export: "エクスポート",
    exportTxt: "テキスト (.txt)",
    exportSrt: "字幕 (.srt)",
    startRecord: "録音開始",
    stopRecord: "停止",
    recording: "録音中...",
    refine: "修正・校正",
    summarize: "要約",
    processing: "処理中...",
    uploadPrompt: "クリックして音声/動画をアップロード",
    uploadSub: "MP3, WAV, MP4, M4A 対応",
    analyzing: "AIが会話と話者を分析中...",
    summaryTitle: "要約とアクションアイテム",
    genSummary: "要約を作成",
    placeholderType: "話すか、入力してください...",
    noFiles: "ファイルがありません",
    errorRefine: "テキスト修正エラー",
    errorTranscribe: "文字起こしに失敗しました",
    fileType: "ファイル",
    liveType: "ライブ"
  }
};

// --- Helper Functions for File Export ---
const downloadFile = (content: string, filename: string, type: 'text/plain' | 'application/json' = 'text/plain') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const generateSRT = (segments: TranscriptSegment[]): string => {
  return segments.map((seg, index) => {
    // Simple mock duration estimation
    const start = `00:${seg.timestamp},000`;
    const end = `00:${seg.timestamp.split(':')[0]}:${parseInt(seg.timestamp.split(':')[1]) + 3},000`; 
    return `${index + 1}\n${start} --> ${end}\n${seg.speaker}: ${seg.text}\n`;
  }).join('\n');
};

function App() {
  // --- Global State ---
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(SupportedLanguage.VIETNAMESE);
  const [activeMode, setActiveMode] = useState<'live' | 'upload'>('live');
  const [showSidebar, setShowSidebar] = useState(true);
  const [customVocabulary, setCustomVocabulary] = useState('');
  
  // --- Localization ---
  const t = TRANSLATIONS[currentLanguage];

  // --- File System State ---
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Processing State ---
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Live Recording State ---
  const {
    isRecording,
    transcript: liveTranscript,
    interimTranscript,
    startRecording,
    stopRecording,
    resetTranscript,
    setTranscript: setLiveTranscript,
    error: speechError
  } = useSpeechRecognition(currentLanguage);

  // --- Audio Player State (for Uploads) ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // --- Load/Save Files from LocalStorage ---
  useEffect(() => {
    const saved = localStorage.getItem('ecoscribe_files');
    if (saved) {
      try {
        setFiles(JSON.parse(saved));
      } catch (e) { console.error("Failed to load files", e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ecoscribe_files', JSON.stringify(files));
  }, [files]);

  // --- Active File Derivation ---
  const currentFile = files.find(f => f.id === currentFileId);

  // --- Handlers: File Management ---
  const createNewFile = (type: 'live' | 'upload') => {
    const newFile: StoredFile = {
      id: crypto.randomUUID(),
      name: `Note ${new Date().toLocaleString()}`,
      createdAt: Date.now(),
      language: currentLanguage,
      type: type,
      content: '',
      segments: []
    };
    setFiles(prev => [newFile, ...prev]);
    setCurrentFileId(newFile.id);
    setActiveMode(type);
    resetTranscript();
    return newFile;
  };

  const updateCurrentFile = (updates: Partial<StoredFile>) => {
    if (!currentFileId) return;
    setFiles(prev => prev.map(f => f.id === currentFileId ? { ...f, ...updates } : f));
  };

  const deleteFile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFiles(prev => prev.filter(f => f.id !== id));
    if (currentFileId === id) {
      setCurrentFileId(null);
      resetTranscript();
    }
  };

  // --- Handlers: Processing ---
  const handleLiveRefine = async () => {
    if (!liveTranscript) return;
    setIsProcessing(true);
    try {
      const refined = await refineTextWithGemini(liveTranscript, currentLanguage, customVocabulary);
      let fileId = currentFileId;
      if (!fileId || activeMode === 'upload') {
        const newFile = createNewFile('live');
        fileId = newFile.id;
        updateCurrentFile({ content: liveTranscript });
      }
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content: refined } : f));
      setLiveTranscript(refined);
    } catch (e) {
      alert(t.errorRefine);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSummarize = async () => {
    // Determine text source
    let textToSummarize = "";
    if (activeMode === 'live') {
        textToSummarize = liveTranscript;
    } else {
        // Upload mode: prefer segments, fallback to raw text if no segments
        if (currentFile?.segments?.length) {
            textToSummarize = currentFile.segments.map(s => `${s.speaker}: ${s.text}`).join('\n');
        } else {
            textToSummarize = currentFile?.content || "";
        }
    }

    if (!textToSummarize.trim()) return;

    setIsProcessing(true);
    try {
      // Ensure we have a file to save to
      if (activeMode === 'live' && !currentFileId) {
          const newFile = createNewFile('live');
          updateCurrentFile({ content: textToSummarize });
      }

      const summary = await summarizeTextWithGemini(textToSummarize, currentLanguage);
      if (currentFileId) {
        updateCurrentFile({ summary });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newAppFile = createNewFile('upload');
    updateCurrentFile({ name: file.name });
    setIsProcessing(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const mimeType = file.type;
        const blobUrl = URL.createObjectURL(file);
        
        updateCurrentFile({ audioUrl: blobUrl });

        const segments = await transcribeAudioFile(
            base64Data, 
            mimeType, 
            currentLanguage, 
            customVocabulary
        );

        updateCurrentFile({ segments });
        setIsProcessing(false);
      };
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      alert(t.errorTranscribe);
    }
  };

  const seekAudio = (timestampStr: string) => {
    if (!audioRef.current) return;
    const [min, sec] = timestampStr.split(':').map(Number);
    const time = min * 60 + sec;
    audioRef.current.currentTime = time;
    audioRef.current.play();
    setIsPlaying(true);
  };

  const handleExport = (format: 'txt' | 'srt') => {
    if (!currentFile) return;
    
    if (format === 'txt') {
        // Prepare text content with Summary if available
        let content = "";
        
        if (currentFile.summary) {
            content += `--- SUMMARY ---\n${currentFile.summary}\n\n--- TRANSCRIPT ---\n\n`;
        }

        if (currentFile.type === 'live') {
            content += currentFile.content;
        } else {
            content += currentFile.segments?.map(s => `[${s.timestamp}] ${s.speaker}: ${s.text}`).join('\n') || "";
        }
        
        downloadFile(content, `${currentFile.name}.txt`);
    } else if (format === 'srt' && currentFile.segments) {
        const content = generateSRT(currentFile.segments);
        downloadFile(content, `${currentFile.name}.srt`);
    }
  };

  return (
    <div className="flex h-screen bg-emerald-50 text-emerald-950 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-80' : 'w-0'} bg-white border-r border-emerald-100 transition-all duration-300 flex flex-col flex-shrink-0 relative shadow-sm`}>
        <div className="p-4 border-b border-emerald-100 flex items-center justify-between bg-emerald-50/50">
          <h2 className="font-bold text-lg text-emerald-800 flex items-center gap-2">
            <Folder className="w-5 h-5"/> {t.library}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => createNewFile('live')} className="p-1 text-emerald-600" title={t.newNote}>
            <FileText className="w-5 h-5"/>
          </Button>
        </div>
        
        <div className="p-3">
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400"/>
             <input 
               type="text" 
               placeholder={t.searchPlaceholder}
               className="w-full pl-9 pr-3 py-2 rounded-lg bg-emerald-50/50 border border-emerald-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 text-emerald-900 placeholder-emerald-400"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
          </div>
        </div>

        <div className="flex-grow overflow-y-auto px-2 space-y-1">
          {files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map(file => (
            <div 
              key={file.id}
              onClick={() => { setCurrentFileId(file.id); setActiveMode(file.type); if(file.type === 'live') setLiveTranscript(file.content); }}
              className={`p-3 rounded-lg cursor-pointer group flex justify-between items-start transition-colors ${currentFileId === file.id ? 'bg-emerald-100 shadow-sm' : 'hover:bg-emerald-50'}`}
            >
              <div className="min-w-0">
                <p className="font-medium text-sm truncate text-emerald-900">{file.name}</p>
                <div className="flex items-center gap-2 text-xs text-emerald-600 mt-1">
                  <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                  <span className={`px-1.5 py-0.5 rounded ${file.type === 'upload' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {file.type === 'upload' ? t.fileType : t.liveType}
                  </span>
                </div>
              </div>
              <button 
                onClick={(e) => deleteFile(e, file.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1"
              >
                <Trash2 className="w-4 h-4"/>
              </button>
            </div>
          ))}
          {files.length === 0 && (
            <div className="text-center text-emerald-400 text-sm py-8 flex flex-col items-center">
               <FileText className="w-8 h-8 mb-2 opacity-50"/>
               {t.noFiles}
            </div>
          )}
        </div>

        {/* Custom Vocab Settings (Mini) */}
        <div className="p-4 border-t border-emerald-100 bg-emerald-50/50">
           <label className="text-xs font-medium text-emerald-700 mb-1 block flex items-center gap-1">
             <Settings className="w-3 h-3"/> {t.customVocab}
           </label>
           <input 
             className="w-full text-xs p-2 rounded border border-emerald-200 focus:outline-none focus:border-emerald-500"
             placeholder={t.customVocabPlaceholder}
             value={customVocabulary}
             onChange={(e) => setCustomVocabulary(e.target.value)}
           />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-emerald-100 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
             <button onClick={() => setShowSidebar(!showSidebar)} className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg">
                <Sidebar className="w-5 h-5"/>
             </button>
             <h1 className="text-xl font-bold text-emerald-800 flex items-center gap-2 truncate">
               {currentFile ? currentFile.name : 'ENDO Tốc Ký'}
             </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <LanguageSelector currentLanguage={currentLanguage} onChange={setCurrentLanguage} disabled={isProcessing || isRecording} />
            <div className="h-8 w-px bg-emerald-100 mx-2 hidden sm:block"></div>
            
            <div className="relative group hidden sm:block">
              <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4"/>}>{t.export}</Button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-emerald-100 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                <button onClick={() => handleExport('txt')} className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-sm text-gray-700">{t.exportTxt}</button>
                <button onClick={() => handleExport('srt')} className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-sm text-gray-700" disabled={activeMode === 'live'}>{t.exportSrt}</button>
              </div>
            </div>
          </div>
        </header>

        {/* Workspace */}
        <main className="flex-1 overflow-hidden flex flex-col p-4 sm:p-6 max-w-5xl mx-auto w-full">
          
          {/* Tabs / Mode Switcher */}
          <div className="flex gap-4 mb-6 border-b border-emerald-200">
            <button 
              onClick={() => { setActiveMode('live'); if(!currentFileId) createNewFile('live'); }}
              className={`pb-3 px-2 font-medium text-sm transition-colors flex items-center gap-2 ${activeMode === 'live' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-emerald-600'}`}
            >
              <Mic className="w-4 h-4"/> {t.liveMode}
            </button>
            <button 
              onClick={() => setActiveMode('upload')}
              className={`pb-3 px-2 font-medium text-sm transition-colors flex items-center gap-2 ${activeMode === 'upload' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-emerald-600'}`}
            >
              <Upload className="w-4 h-4"/> {t.uploadMode}
            </button>
          </div>

          {/* Mode: Live Recording */}
          {activeMode === 'live' && (
            <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
               <div className="flex-shrink-0 bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden flex flex-col relative min-h-[300px]">
                  <textarea 
                    className="flex-1 w-full p-8 text-lg leading-relaxed resize-none focus:outline-none text-gray-800"
                    value={liveTranscript + (isRecording ? ' ' + interimTranscript : '')}
                    onChange={(e) => { setLiveTranscript(e.target.value); updateCurrentFile({ content: e.target.value }); }}
                    placeholder={t.placeholderType}
                  />
                  {isRecording && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-medium animate-pulse border border-red-100">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div> {t.recording}
                    </div>
                  )}
               </div>

               <div className="flex items-center justify-between gap-4 p-4 bg-white rounded-xl border border-emerald-100 shadow-sm flex-wrap flex-shrink-0">
                  <div className="flex items-center gap-4">
                     <Button 
                        variant={isRecording ? "danger" : "primary"}
                        onClick={isRecording ? stopRecording : startRecording}
                        icon={isRecording ? <MicOff /> : <Mic />}
                        className="w-40"
                      >
                        {isRecording ? t.stopRecord : t.startRecord}
                      </Button>
                      {speechError && <span className="text-red-500 text-sm">{speechError}</span>}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={handleLiveRefine} disabled={isProcessing || !liveTranscript} isLoading={isProcessing} icon={<Sparkles className="w-4 h-4"/>}>
                      {t.refine}
                    </Button>
                    <Button variant="secondary" onClick={handleSummarize} disabled={isProcessing || !liveTranscript} icon={<FileText className="w-4 h-4"/>}>
                      {t.summarize}
                    </Button>
                  </div>
               </div>

               {/* Live Mode Summary Display */}
               {currentFile?.summary && (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100 shadow-sm flex-shrink-0 animate-in fade-in slide-in-from-bottom-2">
                      <h3 className="text-blue-800 font-bold text-sm mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4"/> {t.summaryTitle}</h3>
                      <p className="text-blue-900/80 text-sm whitespace-pre-wrap leading-relaxed">{currentFile.summary}</p>
                    </div>
                )}
            </div>
          )}

          {/* Mode: File Upload */}
          {activeMode === 'upload' && (
            <div className="flex-1 flex flex-col gap-4 min-h-0">
              
              {!currentFile?.segments?.length && !isProcessing && (
                <div className="flex-1 border-2 border-dashed border-emerald-200 rounded-xl flex flex-col items-center justify-center bg-emerald-50/30 hover:bg-emerald-50 transition-colors cursor-pointer relative p-8 text-center">
                   <input type="file" accept="audio/*,video/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer"/>
                   <Upload className="w-16 h-16 text-emerald-400 mb-4"/>
                   <p className="text-emerald-800 font-bold text-lg">{t.uploadPrompt}</p>
                   <p className="text-emerald-500 text-sm mt-1">{t.uploadSub}</p>
                </div>
              )}

              {isProcessing && (
                <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-emerald-100">
                   <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
                   <p className="text-emerald-800 font-medium">{t.processing}</p>
                   <p className="text-emerald-500 text-sm">{t.analyzing}</p>
                </div>
              )}

              {currentFile?.segments && currentFile.segments.length > 0 && (
                <div className="flex-1 flex flex-col gap-4 min-h-0">
                  {/* Audio Player */}
                  {currentFile.audioUrl && (
                    <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm flex items-center gap-4">
                      <audio 
                        ref={audioRef} 
                        src={currentFile.audioUrl} 
                        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        className="w-full h-10 accent-emerald-600"
                        controls
                      />
                    </div>
                  )}

                  {/* Transcript View with Diarization */}
                  <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-emerald-100 shadow-sm p-6 space-y-6">
                    {currentFile.segments.map((seg) => (
                      <div key={seg.id} className="flex gap-4 hover:bg-emerald-50/50 p-3 rounded-lg transition-colors group">
                        <div className="w-24 flex-shrink-0 flex flex-col gap-1">
                          <span 
                             onClick={() => seekAudio(seg.timestamp)}
                             className="text-xs font-mono text-emerald-500 cursor-pointer hover:underline flex items-center gap-1 bg-emerald-50 w-fit px-1.5 py-0.5 rounded border border-emerald-100"
                          >
                            <Play className="w-3 h-3"/> {seg.timestamp}
                          </span>
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 w-fit px-2 py-0.5 rounded-full">{seg.speaker}</span>
                        </div>
                        <div className="flex-1">
                           <p className="text-gray-800 leading-relaxed text-lg">{seg.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Summary Box */}
                  {currentFile.summary && (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100 shadow-sm flex-shrink-0">
                      <h3 className="text-blue-800 font-bold text-sm mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4"/> {t.summaryTitle}</h3>
                      <p className="text-blue-900/80 text-sm whitespace-pre-wrap leading-relaxed">{currentFile.summary}</p>
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="flex justify-end">
                     <Button variant="secondary" size="sm" onClick={handleSummarize} isLoading={isProcessing}>
                       {t.genSummary}
                     </Button>
                  </div>
                </div>
              )}

            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default App;
