import {useRef, useState, type ChangeEvent} from 'react';
import {ArrowRight, BookOpen, Clock3, Plus, Play, FolderPlus, ListVideo, FileText, X, Search, Zap} from 'lucide-react';
import {dayKey, type Course, type State} from './domain';
import {computeCourseProductivity} from './courseProductivity';
import {isTauri, invoke} from '@tauri-apps/api/core';

function timeLabel(seconds: number){
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
}

interface LocalLessonInput {
  title: string;
  durationSeconds?: number | null;
  sourceUrl?: string | null;
  section?: string;
}

export default function Courses({
  state,
  onAdd,
  onOpen,
  onEdit,
  onImportLocal,
  onOpenNotion
}: {
  state: State;
  onAdd: () => void;
  onOpen: (id: string) => void;
  onEdit: (course: Course) => void;
  onImportLocal: (data: { title: string; folder?: string; lessons: LocalLessonInput[]; notionUrl?: string | null }) => Promise<void>;
  onOpenNotion: (course: Course) => void;
}){
  const today = dayKey();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [manualPath, setManualPath] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [courseSearch, setCourseSearch] = useState('');

  // Handle native Webkit folder selection
  const handleFolderChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setScanning(true);
    setScanError('');
    try {
      const videoExts = ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v', '.wmv', '.flv', '.mpg', '.mpeg', '.ts'];
      const videoFiles = Array.from(files).filter(f => {
        const lower = f.name.toLowerCase();
        return videoExts.some(ext => lower.endsWith(ext));
      });

      if (videoFiles.length === 0) {
        throw new Error('No supported video files (.mp4, .mkv, .mov, etc.) found in the selected folder.');
      }

      // Sort by relative path or name
      videoFiles.sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, undefined, { numeric: true }));

      // Extract folder name from the first relative path
      const samplePath = videoFiles[0].webkitRelativePath || videoFiles[0].name;
      const rootFolder = samplePath.includes('/') ? samplePath.split('/')[0] : 'Local Video Course';

      const lessons: LocalLessonInput[] = videoFiles.map(f => {
        // Strip extension
        const cleanTitle = f.name.replace(/\.[^/.]+$/, '');
        const section = f.webkitRelativePath && f.webkitRelativePath.includes('/')
          ? f.webkitRelativePath.split('/').slice(0, -1).join(' / ')
          : 'Main';
        return {
          title: cleanTitle,
          durationSeconds: null,
          sourceUrl: (f as any).path ? (f as any).path : null,
          section
        };
      });

      await onImportLocal({
        title: rootFolder,
        folder: rootFolder,
        lessons
      });
      setShowFolderModal(false);
    } catch (err) {
      setScanError((err as Error).message);
    } finally {
      setScanning(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  // Native Windows folder selection & import
  const handlePickAndImportFolder = async () => {
    setScanning(true);
    setScanError('');
    try {
      if (isTauri()) {
        const folder = await invoke<string | null>('pick_folder');
        if (!folder) {
          setScanning(false);
          return;
        }
        const cleanFolder = folder.replace(/^["']|["']$/g, '').trim();
        const jsonStr: string = await invoke('scan_folder_videos', { folderPath: cleanFolder });
        const parsed = JSON.parse(jsonStr);
        await onImportLocal({
          title: parsed.title,
          folder: parsed.folder,
          lessons: parsed.videos
        });
        setShowFolderModal(false);
        setManualPath('');
      } else {
        folderInputRef.current?.click();
      }
    } catch (err) {
      setScanError((err as Error).message || 'Failed to scan selected folder.');
    } finally {
      setScanning(false);
    }
  };

  // Handle scanning a manually typed or pasted folder path on disk
  const handleManualScan = async () => {
    const trimmed = manualPath.replace(/^["']|["']$/g, '').trim();
    if (!trimmed) {
      setScanError('Please enter or paste a valid folder path.');
      return;
    }
    setScanning(true);
    setScanError('');
    try {
      if (isTauri()) {
        const jsonStr: string = await invoke('scan_folder_videos', { folderPath: trimmed });
        const parsed = JSON.parse(jsonStr);
        await onImportLocal({
          title: parsed.title,
          folder: parsed.folder,
          lessons: parsed.videos
        });
        setShowFolderModal(false);
        setManualPath('');
      } else {
        throw new Error('Direct folder path scanning is active in the Windows Desktop App.');
      }
    } catch (err) {
      setScanError((err as Error).message || 'Folder could not be scanned.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <>
      {/* Hidden folder input */}
      <input 
        ref={folderInputRef}
        type="file" 
        // @ts-expect-error webkitdirectory is standard in Chromium
        webkitdirectory="true" 
        directory="true" 
        multiple 
        style={{ display: 'none' }}
        onChange={handleFolderChange}
      />

      <div className="page-intro">
        <div>
          <p className="eyebrow">YOUR LEARNING UNIVERSE</p>
          <h1>Courses &amp; Video Lectures</h1>
          <p>Full lecture tracks with exact video runtimes, Notion notebooks, and local video playback.</p>
        </div>
        <div className="course-intro-buttons">
          <button 
            className="secondary-pill-btn" 
            title="Import course from a local folder of video files"
            disabled={scanning}
            onClick={() => setShowFolderModal(true)}
          >
            <FolderPlus size={16}/> {scanning ? 'Scanning Folder…' : 'Import Local Folder'}
          </button>
          <button className="primary" onClick={onAdd}>
            <Plus size={18}/> Add a course
          </button>
        </div>
      </div>

      {/* Courses Search & Counter Row */}
      <div className="courses-search-bar-row">
        <div className="search-pill-box" style={{ maxWidth: 360 }}>
          <Search size={15} className="search-icon"/>
          <input 
            placeholder="Search courses or lectures…" 
            value={courseSearch} 
            onChange={e => setCourseSearch(e.target.value)}
            className="search-pill-input"
          />
          {courseSearch && (
            <button type="button" className="search-clear-btn" onClick={() => setCourseSearch('')}>
              <X size={13}/>
            </button>
          )}
        </div>
        <span className="badge-count">📚 {state.courses.length} courses enrolled</span>
      </div>

      <div className="course-grid">
        {state.courses
          .filter(course => {
            const q = courseSearch.trim().toLowerCase();
            if (!q) return true;
            const titleMatch = course.title.toLowerCase().includes(q);
            const nextMatch = course.nextLesson && course.nextLesson.toLowerCase().includes(q);
            const lectureMatch = state.lessons.some(l => l.courseId === course.id && l.title.toLowerCase().includes(q));
            return titleMatch || nextMatch || lectureMatch;
          })
          .map((course, index) => {
          const lessons = state.lessons.filter(lesson => lesson.courseId === course.id).sort((a, b) => a.position - b.position);
          const next = lessons.find(lesson => !lesson.completed);
          const remaining = lessons.filter(lesson => !lesson.completed);
          const knownSeconds = remaining.reduce((sum, lesson) => sum + (lesson.durationSeconds || 0), 0);
          const unknown = remaining.filter(lesson => lesson.durationSeconds === null).length;
          const todayEvents = state.lessonEvents.filter(event => event.courseId === course.id && event.day === today);
          const count = Math.max(0, todayEvents.reduce((sum, event) => sum + event.delta, 0));
          const watchSeconds = Math.max(0, todayEvents.reduce((sum, event) => sum + (event.knownWatchSeconds || 0), 0));

          return (
            <article 
              className={'course-cover cover-' + (index % 3) + ' clickable-course-card'} 
              key={course.id}
              onClick={() => onOpen(course.id)}
              title={`Click anywhere to view all ${course.total} lectures`}
            >
              <div className="course-top-row">
                <span className="eyebrow">
                  {course.source === 'youtube' ? 'YOUTUBE COURSE' : course.source === 'local' ? 'LOCAL FOLDER' : 'PERSONAL PATH'} · {course.total} LECTURES
                </span>
                {course.notionUrl && (
                  <span className="course-has-notion-tag" title="Connected to Notion">
                    <FileText size={12}/> Notion
                  </span>
                )}
              </div>
              <BookOpen className="cover-watermark"/>
              <h2>{course.title}</h2>

              <div className="course-card-progress">
                <span>{course.done} / {course.total} completed ({Math.round(course.done / Math.max(1, course.total) * 100)}%)</span>
                <div 
                  className="meter" 
                  role="progressbar" 
                  aria-valuenow={course.done} 
                  aria-valuemin={0} 
                  aria-valuemax={course.total} 
                  aria-label={`${course.title} lectures completed`}
                >
                  <i style={{ width: `${(course.done / Math.max(1, course.total)) * 100}%` }}/>
                </div>
              </div>

              <div className="course-up-next">
                <span>UP NEXT · {next ? `#${next.position}` : 'COMPLETED'}</span>
                <p>{next?.title || course.nextLesson || 'All lectures finished!'}</p>
              </div>

              <div className="course-card-facts">
                <span><BookOpen size={14}/> {count} today</span>
                <span><Clock3 size={14}/> {watchSeconds ? `${timeLabel(watchSeconds)} watched` : 'No watch time today'}</span>
              </div>

              {(() => {
                const prod = computeCourseProductivity(state, course.id);
                return prod && prod.effectiveProcessingRate > 0 ? (
                  <div className="course-card-facts" style={{ marginTop: '4px', color: '#38bdf8' }} title="Pace calculated from your actual focus time vs lecture completion">
                    <span><Zap size={14}/> Pace: <strong>{prod.effectiveProcessingRate}x speed</strong></span>
                    <span><Clock3 size={14}/> Est. <strong>{prod.estimatedRemainingStudyHours}h</strong> left</span>
                  </div>
                ) : null;
              })()}

              <p className="course-time">
                {lessons.length ? (
                  knownSeconds ? (
                    `${timeLabel(knownSeconds)} left at 1×${unknown ? ` · ${unknown} unknown` : ''}`
                  ) : (
                    'No known durations'
                  )
                ) : course.minutesPerLesson ? (
                  `About ${Math.round((course.total - course.done) * course.minutesPerLesson / 60 * 10) / 10}h estimated`
                ) : (
                  'No lecture times available'
                )}
              </p>

              <div className="course-actions-grid" onClick={e => e.stopPropagation()}>
                <button className="course-card-btn-continue" onClick={(e) => { e.stopPropagation(); onOpen(course.id); }}>
                  <Play size={14} fill="currentColor"/> Continue #{next?.position || 1} <ArrowRight size={14}/>
                </button>
                <button className="course-card-btn-lectures" onClick={(e) => { e.stopPropagation(); onOpen(course.id); }}>
                  <ListVideo size={14}/> View all {course.total} lectures
                </button>
                <div className="course-card-sub-actions">
                  <button 
                    type="button" 
                    className="course-card-btn-notion" 
                    title="Open Notion notebook in Notion Desktop"
                    onClick={(e) => { e.stopPropagation(); onOpenNotion(course); }}
                  >
                    <FileText size={13}/> {course.notionUrl ? 'Notion Notebook' : 'Link Notion'}
                  </button>
                  <button type="button" className="course-card-btn-edit" onClick={(e) => { e.stopPropagation(); onEdit(course); }}>
                    Edit
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Local Folder Import Modal */}
      {showFolderModal && (
        <div className="modal-backdrop" onClick={() => setShowFolderModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header-row">
              <div>
                <h3>Import Course from Local Folder</h3>
                <p className="page-sub">Scan video files (.mp4, .mkv, .mov, etc.) into an organized course track.</p>
              </div>
              <button className="icon-button" onClick={() => setShowFolderModal(false)}><X/></button>
            </div>

            <div className="folder-import-options">
              <div className="folder-pick-box">
                <h4>Option 1: Choose Folder with Windows Explorer</h4>
                <p>Click below to choose a folder on your computer:</p>
                <button 
                  type="button" 
                  className="primary-pill-btn" 
                  disabled={scanning}
                  onClick={handlePickAndImportFolder}
                >
                  <FolderPlus size={16}/> {scanning ? 'Opening Explorer…' : 'Browse with Windows Explorer…'}
                </button>
              </div>

              <div className="folder-divider"><span>OR</span></div>

              <div className="folder-path-box">
                <h4>Option 2: Paste Local Folder Path</h4>
                <div className="folder-path-input-row">
                  <input 
                    type="text" 
                    placeholder="e.g. C:\Users\inesh\Videos\BlenderCourse" 
                    value={manualPath}
                    onChange={e => setManualPath(e.target.value)}
                    className="modern-input"
                  />
                  <button 
                    type="button" 
                    className="primary-pill-btn" 
                    disabled={scanning || !manualPath.trim()}
                    onClick={handleManualScan}
                  >
                    {scanning ? 'Scanning…' : 'Scan & Import'}
                  </button>
                </div>
              </div>
            </div>

            {scanError && <p className="form-error">{scanError}</p>}

            <div className="modal-actions-row">
              <button type="button" className="btn-clean-ghost" onClick={() => setShowFolderModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
