import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  Circle, 
  Database, 
  HelpCircle, 
  Layers, 
  RefreshCw, 
  Search, 
  Sliders, 
  FileText, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Settings,
  Sparkles,
  RotateCcw,
  Menu,
  X
} from 'lucide-react';

// Define Interfaces matching our database schema
interface Objective {
  id: string;
  text: string;
  completed: boolean;
}

interface ScrapedMaterial {
  title: string;
  url: string;
  summary: string;
  source: string;
  date: string;
}

interface QuizItem {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

interface Day {
  id: number;
  title: string;
  domain: string;
  duration: string;
  difficulty: string;
  examWeight: string;
  description: string;
  lessonContent: string;
  objectives: Objective[];
  scrapedMaterials: ScrapedMaterial[];
  quiz: QuizItem[];
}

interface Feed {
  name: string;
  url: string;
  active: boolean;
}

interface ScraperConfig {
  targetFeeds: Feed[];
  keywords: string[];
  cronSchedule: string;
}

interface ScrapeLog {
  timestamp: string;
  status: string;
  articlesFound: number;
  articlesAdded: number;
  message: string;
}

interface DbData {
  days: Day[];
  scraperConfig: ScraperConfig;
  scrapeLogs: ScrapeLog[];
}

// Simple regex-based markdown parser to HTML
const renderMarkdownToHtml = (markdown: string): string => {
  if (!markdown) return '';
  let html = markdown;
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Bullet Lists
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
  // Wrap list items in ul blocks. Regex handles consecutive list items:
  html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
  // Fix nested ul blocks:
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  // Numbered Lists
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gim, '<ol>$1</ol>');
  html = html.replace(/<\/ol>\s*<ol>/g, '');

  // Line breaks
  html = html.replace(/\n/g, '<br/>');

  return html;
};

export default function App() {
  const [data, setData] = useState<DbData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'study' | 'scraper' | 'search'>('study');
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('All');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Scraper Tab State
  const [scrapingInProgress, setScrapingInProgress] = useState(false);
  const [cronExpression, setCronExpression] = useState('');
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [newFeedName, setNewFeedName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');

  // Close sidebar on day selection for mobile responsiveness
  useEffect(() => {
    setSidebarOpen(false);
  }, [selectedDayId]);

  // Quiz interactive state
  // key: dayId, value: index of option chosen, boolean for submission, boolean for correctness
  const [quizState, setQuizState] = useState<Record<number, { selectedIndex: number | null; submitted: boolean }>>({});

  const API_BASE = 'http://localhost:3001/api';

  // Fetch all database records
  const fetchData = async (selectFirstUnfinished = false) => {
    try {
      const res = await fetch(`${API_BASE}/lessons`);
      if (!res.ok) throw new Error('Failed to retrieve curriculum records.');
      const json: DbData = await res.json();
      setData(json);
      setCronExpression(json.scraperConfig.cronSchedule);
      
      if (selectFirstUnfinished) {
        // Find first day that has uncompleted objectives
        const unfinishedDay = json.days.find(day => 
          day.objectives.some(obj => !obj.completed)
        );
        if (unfinishedDay) {
          setSelectedDayId(unfinishedDay.id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error syncing with backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  if (loading) {
    return (
      <div className="loading-screen" style={{
        display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw',
        justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)'
      }}>
        <RefreshCw className="animate-spin-slow" size={48} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
        <h2 style={{ fontFamily: 'Outfit', fontWeight: 600 }}>Syncing SAFe RTE Study Planner...</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>Verifying local database connectivity...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="error-screen" style={{
        display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw',
        justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', padding: '24px', textAlign: 'center'
      }}>
        <AlertCircle size={64} style={{ color: 'var(--error)', marginBottom: '24px' }} />
        <h2 style={{ fontFamily: 'Outfit', fontWeight: 600 }}>Connection Error</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '12px 0 24px' }}>
          Unable to establish connection with the backend service. Ensure the Express server is running on port 3001.
        </p>
        <button onClick={() => { setLoading(true); fetchData(); }} className="glow-btn">
          <RefreshCw size={16} /> Retry Sync
        </button>
      </div>
    );
  }

  // Derived statistics
  const totalObjectives = data.days.reduce((acc, d) => acc + d.objectives.length, 0);
  const completedObjectives = data.days.reduce((acc, d) => acc + d.objectives.filter(o => o.completed).length, 0);
  const completionPercentage = Math.round((completedObjectives / totalObjectives) * 100) || 0;
  
  const completedDaysCount = data.days.filter(d => d.objectives.every(o => o.completed)).length;

  const domainsList = [
    "All",
    "Serving the Agile Release Train",
    "Executing the Program Increment (PI)",
    "Applying SAFe Principles",
    "Exploring the RTE Role"
  ];

  // Filtering days list (memoized to avoid redundant calculations)
  const filteredDays = React.useMemo(() => {
    return data.days.filter(day => {
      if (domainFilter === 'All') return true;
      return day.domain === domainFilter;
    });
  }, [data.days, domainFilter]);

  // Memoized current study day selection
  const selectedDay = React.useMemo(() => {
    return data.days.find(d => d.id === selectedDayId) || data.days[0];
  }, [data.days, selectedDayId]);

  // Toggling objective checklist item
  const handleToggleObjective = async (dayId: number, objId: string, currentCompleted: boolean) => {
    try {
      // Optimistic Update
      setData(prev => {
        if (!prev) return null;
        const updatedDays = prev.days.map(d => {
          if (d.id !== dayId) return d;
          return {
            ...d,
            objectives: d.objectives.map(o => {
              if (o.id !== objId) return o;
              return { ...o, completed: !currentCompleted };
            })
          };
        });
        return { ...prev, days: updatedDays };
      });

      const response = await fetch(`${API_BASE}/lessons/${dayId}/objectives/${objId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompleted })
      });

      if (!response.ok) throw new Error();
    } catch (err) {
      // Rollback on failure
      fetchData();
    }
  };

  // Triggering manual scrape
  const handleTriggerScrape = async () => {
    setScrapingInProgress(true);
    try {
      const response = await fetch(`${API_BASE}/scrape`, { method: 'POST' });
      if (!response.ok) throw new Error('Web scraper request failed.');
      await fetchData(); // refresh logs & data
    } catch (err: any) {
      alert(err.message || 'Scraper failed.');
    } finally {
      setScrapingInProgress(false);
    }
  };

  // Save new Cron Expression
  const handleSaveCron = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSuccess(null);
    setConfigError(null);
    try {
      const res = await fetch(`${API_BASE}/scraper-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cronSchedule: cronExpression })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update schedule config.');
      setConfigSuccess('Cron schedule updated successfully. Rescheduled background job!');
      setData(prev => prev ? { ...prev, scraperConfig: result.config } : null);
    } catch (err: any) {
      setConfigError(err.message || 'Validation error.');
    }
  };

  // Add Feed URL
  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedName || !newFeedUrl) return;
    
    const updatedFeeds = [
      ...data.scraperConfig.targetFeeds,
      { name: newFeedName, url: newFeedUrl, active: true }
    ];

    try {
      const res = await fetch(`${API_BASE}/scraper-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetFeeds: updatedFeeds })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setData(prev => prev ? { ...prev, scraperConfig: result.config } : null);
      setNewFeedName('');
      setNewFeedUrl('');
    } catch (err: any) {
      alert(err.message || 'Failed to add feed.');
    }
  };

  // Toggle Feed Activity state
  const handleToggleFeed = async (index: number) => {
    const updatedFeeds = data.scraperConfig.targetFeeds.map((feed, idx) => {
      if (idx !== index) return feed;
      return { ...feed, active: !feed.active };
    });

    try {
      const res = await fetch(`${API_BASE}/scraper-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetFeeds: updatedFeeds })
      });
      const result = await res.json();
      if (res.ok) {
        setData(prev => prev ? { ...prev, scraperConfig: result.config } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Feed
  const handleDeleteFeed = async (index: number) => {
    const updatedFeeds = data.scraperConfig.targetFeeds.filter((_, idx) => idx !== index);

    try {
      const res = await fetch(`${API_BASE}/scraper-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetFeeds: updatedFeeds })
      });
      const result = await res.json();
      if (res.ok) {
        setData(prev => prev ? { ...prev, scraperConfig: result.config } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reset progress database
  const handleResetProgress = async () => {
    if (!window.confirm("Are you sure you want to reset all checklist records and scraped study assets?")) return;
    try {
      const response = await fetch(`${API_BASE}/lessons/reset`, { method: 'POST' });
      if (response.ok) {
        fetchData();
        setQuizState({});
        alert("Study tracker has been initialized.");
      }
    } catch (err) {
      console.error("Reset failed:", err);
    }
  };

  // Search Results Compilation
  const getSearchResults = () => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    
    const matchedDays: Array<{ type: 'day'; id: number; title: string; subtitle: string; matchText: string }> = [];
    
    data.days.forEach(day => {
      const inTitle = day.title.toLowerCase().includes(query);
      const inDesc = day.description.toLowerCase().includes(query);
      const inContent = day.lessonContent.toLowerCase().includes(query);
      
      if (inTitle || inDesc || inContent) {
        matchedDays.push({
          type: 'day',
          id: day.id,
          title: `Day ${day.id}: ${day.title}`,
          subtitle: day.domain,
          matchText: inTitle ? "Matched in Title" : inDesc ? "Matched in Description" : "Matched in Lesson Content"
        });
      }

      day.scrapedMaterials.forEach(mat => {
        if (mat.title.toLowerCase().includes(query) || mat.summary.toLowerCase().includes(query)) {
          matchedDays.push({
            type: 'day',
            id: day.id,
            title: `[Supplementary Resource] ${mat.title}`,
            subtitle: `Belongs to Day ${day.id}: ${day.title} (${mat.source})`,
            matchText: "Matched in Scraped Supplementary Article"
          });
        }
      });
    });

    return matchedDays;
  };

  // Quiz Handling
  const handleSelectQuizOption = (dayId: number, optionIdx: number) => {
    setQuizState(prev => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        selectedIndex: optionIdx
      }
    }));
  };

  const handleSubmitQuiz = (dayId: number) => {
    if (quizState[dayId]?.selectedIndex === null || quizState[dayId]?.selectedIndex === undefined) return;
    setQuizState(prev => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        submitted: true
      }
    }));
  };

  // Search library query lookup (memoized)
  const searchResults = React.useMemo(() => {
    return getSearchResults();
  }, [searchQuery, data.days]);

  // Parse lesson markdown to HTML (memoized to avoid parsing on simple state triggers)
  const memoizedLessonHtml = React.useMemo(() => {
    return renderMarkdownToHtml(selectedDay.lessonContent);
  }, [selectedDay.id, selectedDay.lessonContent]);

  return (
    <div className="app-container">
      
      {/* Overlay backdrop for mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        
        {/* Sidebar Header */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Layers size={20} style={{ color: '#0b0f17' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>SAFe RTE Elite</h1>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>30-DAY CRUCIBLE</p>
              </div>
            </div>
            {/* Close button on mobile */}
            <button 
              onClick={() => setSidebarOpen(false)}
              className="sidebar-close-btn"
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', display: 'none', padding: '4px'
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Progress Tracker Widget */}
          <div className="glass-panel" style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Overall Objectives Met</span>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{completionPercentage}%</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${completionPercentage}%`,
                background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                borderRadius: '10px',
                transition: 'width 0.5s ease-out'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: 'var(--text-dark)' }}>
              <span>{completedObjectives} / {totalObjectives} Objectives</span>
              <span>{completedDaysCount} / 30 Days Mastered</span>
            </div>
          </div>
        </div>

        {/* Timeline Filtering Pills */}
        <div style={{ padding: '16px 20px 8px 20px' }}>
          <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-dark)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
            Filter Days by Syllabus Domain
          </label>
          <select 
            value={domainFilter} 
            onChange={(e) => setDomainFilter(e.target.value)}
            style={{ width: '100%', fontSize: '13px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
          >
            <option value="All">All Domains (30 Days)</option>
            <option value={domainsList[1]}>Serving the ART (30%)</option>
            <option value={domainsList[2]}>Executing the PI (28%)</option>
            <option value={domainsList[3]}>Applying Principles (22%)</option>
            <option value={domainsList[4]}>Exploring the RTE Role (15%)</option>
          </select>
        </div>

        {/* Days Scroll Area */}
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px 16px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredDays.map((day) => {
              const objectivesCount = day.objectives.length;
              const completedCount = day.objectives.filter(o => o.completed).length;
              const isDayComplete = objectivesCount > 0 && completedCount === objectivesCount;
              const isDayInProgress = completedCount > 0 && completedCount < objectivesCount;
              const isSelected = day.id === selectedDayId;

              return (
                <div 
                  key={day.id}
                  onClick={() => { setSelectedDayId(day.id); setActiveTab('study'); }}
                  className={`glass-panel ${isSelected ? 'selected' : ''}`}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(129, 140, 248, 0.12)' : 'rgba(22, 29, 49, 0.4)',
                    borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  {/* Complete Indicator */}
                  <div style={{ display: 'flex', flexShrink: 0 }}>
                    {isDayComplete ? (
                      <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                    ) : isDayInProgress ? (
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '50%',
                        border: '2px solid var(--warning)', borderTopColor: 'transparent',
                        transform: 'rotate(45deg)'
                      }} />
                    ) : (
                      <Circle size={18} style={{ color: 'var(--text-dark)' }} />
                    )}
                  </div>

                  {/* Day Info */}
                  <div style={{ overflow: 'hidden', flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: isSelected ? 'var(--accent)' : 'var(--text-dark)', fontWeight: 700 }}>
                        DAY {day.id}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>{day.duration}</span>
                    </div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: isSelected ? 'var(--text-main)' : 'rgba(248,250,252,0.8)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '2px'
                    }}>
                      {day.title}
                    </div>
                  </div>
                  
                  <ChevronRight size={14} style={{ color: isSelected ? 'var(--accent)' : 'var(--text-dark)', flexShrink: 0 }} />
                </div>
              );
            })}
            {filteredDays.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-dark)', fontSize: '13px', marginTop: '24px' }}>
                No days matching filter.
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN SCREEN AREA */}
      <main className="main-content">
        
        {/* Global Toolbar Header */}
        <header className="app-header">
          {/* Hamburger Menu Toggle on Mobile */}
          <button 
            onClick={() => setSidebarOpen(true)}
            className="hamburger-btn"
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
              color: 'var(--text-main)', cursor: 'pointer', display: 'none', 
              alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: '8px',
              marginRight: '12px'
            }}
          >
            <Menu size={20} />
          </button>
          
          {/* Sub Navigation */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setActiveTab('study')}
              className={`glow-btn-secondary ${activeTab === 'study' ? 'selected' : ''}`}
              style={{
                background: activeTab === 'study' ? 'rgba(255,255,255,0.06)' : 'transparent',
                borderColor: activeTab === 'study' ? 'var(--accent)' : 'transparent'
              }}
            >
              <BookOpen size={16} style={{ color: activeTab === 'study' ? 'var(--accent)' : 'var(--text-muted)' }} />
              Study Curriculum
            </button>
            <button 
              onClick={() => setActiveTab('scraper')}
              className={`glow-btn-secondary ${activeTab === 'scraper' ? 'selected' : ''}`}
              style={{
                background: activeTab === 'scraper' ? 'rgba(255,255,255,0.06)' : 'transparent',
                borderColor: activeTab === 'scraper' ? 'var(--accent)' : 'transparent'
              }}
            >
              <Database size={16} style={{ color: activeTab === 'scraper' ? 'var(--accent)' : 'var(--text-muted)' }} />
              Scraper Dashboard
              {data.scrapeLogs[0]?.status === 'Success' && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
              )}
            </button>
            <button 
              onClick={() => setActiveTab('search')}
              className={`glow-btn-secondary ${activeTab === 'search' ? 'selected' : ''}`}
              style={{
                background: activeTab === 'search' ? 'rgba(255,255,255,0.06)' : 'transparent',
                borderColor: activeTab === 'search' ? 'var(--accent)' : 'transparent'
              }}
            >
              <Search size={16} style={{ color: activeTab === 'search' ? 'var(--accent)' : 'var(--text-muted)' }} />
              Search Library
            </button>
          </div>

          {/* Quick Stats & System Toggles */}
          <div className="header-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', background: 'rgba(255,255,255,0.02)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: scrapingInProgress ? 'var(--warning)' : 'var(--success)', display: 'inline-block' }} 
                    className={scrapingInProgress ? 'animate-spin-slow' : ''} />
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Scraper Engine:</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{scrapingInProgress ? 'Scraping...' : 'Synced'}</span>
            </div>
            
            <button 
              onClick={handleResetProgress}
              className="glow-btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '12px', border: '1px solid rgba(248, 113, 113, 0.25)', color: '#f87171' }}
              title="Reset study checklists and scraper materials back to seed state."
            >
              <RotateCcw size={12} /> Reset Database
            </button>
          </div>
        </header>

        {/* WORKSPACE CONTENT BODY */}
        <div className="workspace-container">
          
          {/* TAB 1: STUDY PLAN DETAILS */}
          {activeTab === 'study' && (
            <div className="study-workspace">
              
              {/* Left Column: Lesson Content */}
              <div className="study-lesson-column fade-in">
                
                {/* Lesson Header Header */}
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <span style={{ background: 'rgba(129, 140, 248, 0.1)', border: '1px solid rgba(129, 140, 248, 0.2)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>
                      {selectedDay.domain}
                    </span>
                    <span style={{ background: 'rgba(34, 211, 238, 0.1)', border: '1px solid rgba(34, 211, 238, 0.2)', color: 'var(--accent)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>
                      Difficulty: {selectedDay.difficulty}
                    </span>
                    <span style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.15)', color: 'var(--warning)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>
                      Exam Weight: {selectedDay.examWeight}
                    </span>
                  </div>
                  
                  <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    Day {selectedDay.id}: {selectedDay.title}
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '8px', lineHeight: '1.5' }}>
                    {selectedDay.description}
                  </p>
                </div>

                {/* Core Study Content Body */}
                <div className="glass-panel" style={{ padding: '24px 32px', background: 'rgba(22, 29, 49, 0.3)' }}>
                  <h3 style={{ fontSize: '16px', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} style={{ color: 'var(--accent)' }} />
                    Core Lesson Materials
                  </h3>
                  
                  <div 
                    className="markdown-body"
                    dangerouslySetInnerHTML={{ __html: memoizedLessonHtml }}
                  />
                </div>

                {/* Day Specific Practice Quiz */}
                {selectedDay.quiz && selectedDay.quiz.length > 0 && (
                  <div className="glass-panel" style={{ padding: '24px 32px', background: 'rgba(22, 29, 49, 0.3)' }}>
                    <h3 style={{ fontSize: '16px', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <HelpCircle size={18} style={{ color: 'var(--primary)' }} />
                      RTE Concept Checklist Quiz
                    </h3>
                    
                    {selectedDay.quiz.map((q, idx) => {
                      const dayQuizState = quizState[selectedDay.id] || { selectedIndex: null, submitted: false };
                      const isCorrectAnswer = dayQuizState.selectedIndex === q.answerIndex;

                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-main)' }}>{q.question}</p>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {q.options.map((opt, optIdx) => {
                              const isOptionSelected = dayQuizState.selectedIndex === optIdx;
                              let optBg = 'rgba(255, 255, 255, 0.02)';
                              let optBorder = 'var(--border-color)';
                              
                              if (isOptionSelected) {
                                optBg = 'rgba(129, 140, 248, 0.08)';
                                optBorder = 'var(--primary)';
                              }
                              
                              if (dayQuizState.submitted) {
                                if (optIdx === q.answerIndex) {
                                  optBg = 'rgba(52, 211, 153, 0.15)';
                                  optBorder = 'var(--success)';
                                } else if (isOptionSelected) {
                                  optBg = 'rgba(248, 113, 113, 0.15)';
                                  optBorder = 'var(--error)';
                                }
                              }

                              return (
                                <button
                                  key={optIdx}
                                  disabled={dayQuizState.submitted}
                                  onClick={() => handleSelectQuizOption(selectedDay.id, optIdx)}
                                  style={{
                                    textAlign: 'left', padding: '14px 18px', borderRadius: '10px',
                                    background: optBg, border: `1px solid ${optBorder}`, color: 'var(--text-main)',
                                    cursor: dayQuizState.submitted ? 'default' : 'pointer', fontSize: '14px',
                                    transition: 'var(--transition-smooth)', width: '100%'
                                  }}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>

                          {/* Action & Explanation feedback */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                            {!dayQuizState.submitted ? (
                              <button
                                onClick={() => handleSubmitQuiz(selectedDay.id)}
                                disabled={dayQuizState.selectedIndex === null}
                                className="glow-btn"
                                style={{ alignSelf: 'flex-start', padding: '8px 24px', opacity: dayQuizState.selectedIndex === null ? 0.5 : 1 }}
                              >
                                Submit Answer
                              </button>
                            ) : (
                              <div style={{
                                padding: '16px 20px', borderRadius: '10px',
                                background: isCorrectAnswer ? 'rgba(52, 211, 153, 0.06)' : 'rgba(248, 113, 113, 0.06)',
                                borderLeft: `4px solid ${isCorrectAnswer ? 'var(--success)' : 'var(--error)'}`
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                  <Sparkles size={16} style={{ color: isCorrectAnswer ? 'var(--success)' : 'var(--error)' }} />
                                  <span style={{ fontWeight: 700, fontSize: '14px', color: isCorrectAnswer ? 'var(--success)' : 'var(--error)' }}>
                                    {isCorrectAnswer ? 'CORRECT CONCEPT ALIGNMENT' : 'INCORRECT MATCH'}
                                  </span>
                                </div>
                                <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                  <strong>Explanation:</strong> {q.explanation}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* Right Column: Checklists & Scraped Supplementary Feeds */}
              <div className="study-sidebar-column">
                
                {/* Checklist Container */}
                <div>
                  <h3 style={{ fontSize: '14px', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                    Mastery Objectives
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedDay.objectives.map((obj) => (
                      <div 
                        key={obj.id}
                        onClick={() => handleToggleObjective(selectedDay.id, obj.id, obj.completed)}
                        className="glass-panel"
                        style={{
                          padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                          background: obj.completed ? 'rgba(52, 211, 153, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                          borderColor: obj.completed ? 'rgba(52, 211, 153, 0.25)' : 'var(--border-color)',
                          display: 'flex', gap: '12px', alignItems: 'flex-start',
                          transition: 'var(--transition-smooth)'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={obj.completed}
                          onChange={() => {}} // click handled by parent container
                          style={{
                            cursor: 'pointer', width: '18px', height: '18px', flexShrink: 0, marginTop: '2px',
                            accentColor: 'var(--success)'
                          }}
                        />
                        <span style={{
                          fontSize: '13px',
                          color: obj.completed ? 'var(--text-muted)' : 'var(--text-main)',
                          textDecoration: obj.completed ? 'line-through' : 'none',
                          lineHeight: '1.4'
                        }}>
                          {obj.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scraped Materials Container */}
                <div>
                  <h3 style={{ fontSize: '14px', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
                    Live Scraped Insights
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {selectedDay.scrapedMaterials && selectedDay.scrapedMaterials.length > 0 ? (
                      selectedDay.scrapedMaterials.map((mat, idx) => (
                        <div 
                          key={idx} 
                          className="glass-panel glass-card-accent" 
                          style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dark)', marginBottom: '6px' }}>
                            <span>{mat.source}</span>
                            <span>{mat.date}</span>
                          </div>
                          <h4 style={{ fontSize: '13.5px', color: 'var(--text-main)', fontWeight: 600, lineHeight: '1.3' }}>
                            {mat.title}
                          </h4>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                            {mat.summary}
                          </p>
                          <a 
                            href={mat.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              fontSize: '11px', color: 'var(--accent)', textDecoration: 'none',
                              marginTop: '10px', fontWeight: 600
                            }}
                          >
                            Read Full Article <ExternalLink size={10} />
                          </a>
                        </div>
                      ))
                    ) : (
                      <div style={{
                        padding: '24px 16px', textAlign: 'center', borderRadius: '10px',
                        border: '1px dashed var(--border-color)', color: 'var(--text-dark)'
                      }}>
                        <Database size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                        <p style={{ fontSize: '12px' }}>No supplementary articles matched this day yet.</p>
                        <button 
                          onClick={() => setActiveTab('scraper')}
                          style={{
                            fontSize: '11px', background: 'none', border: 'none', color: 'var(--accent)',
                            cursor: 'pointer', marginTop: '6px', textDecoration: 'underline'
                          }}
                        >
                          Sync Scraper
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: SCRAPER CONTROLS */}
          {activeTab === 'scraper' && (
            <div className="scraper-workspace fade-in">
              
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Scraper Control Center & Cron Manager</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                  Manage RSS news feeds, refine keyword mappings, and trigger/schedule automated curriculum enrichment sweeps.
                </p>
              </div>

              {/* Scraper Stats Row */}
              <div className="scraper-stats-grid">
                
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(34, 211, 238, 0.1)', padding: '12px', borderRadius: '10px' }}>
                    <RefreshCw size={24} style={{ color: 'var(--accent)' }} className={scrapingInProgress ? 'animate-spin-slow' : ''} />
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Last Scrape Execution</span>
                    <h3 style={{ fontSize: '16px', color: 'var(--text-main)', marginTop: '2px' }}>
                      {data.scrapeLogs[0] ? new Date(data.scrapeLogs[0].timestamp).toLocaleTimeString() : 'Never'}
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>
                      Status: {data.scrapeLogs[0]?.status || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '12px', borderRadius: '10px' }}>
                    <Database size={24} style={{ color: 'var(--success)' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target Agile Channels</span>
                    <h3 style={{ fontSize: '18px', color: 'var(--text-main)', marginTop: '2px' }}>
                      {data.scraperConfig.targetFeeds.length} Active Feeds
                    </h3>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(129, 140, 248, 0.1)', padding: '12px', borderRadius: '10px' }}>
                    <Settings size={24} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cron Frequency Expression</span>
                    <h3 style={{ fontSize: '15px', color: 'var(--text-main)', marginTop: '4px', fontFamily: 'monospace' }}>
                      {data.scraperConfig.cronSchedule}
                    </h3>
                  </div>
                </div>

              </div>

              {/* Scraper Configuration Form & Feed list */}
              <div className="scraper-config-grid">
                
                {/* Cron Scheduling Config */}
                <div className="glass-panel" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sliders size={18} style={{ color: 'var(--accent)' }} /> Background Cron Setup
                  </h3>
                  
                  <form onSubmit={handleSaveCron} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Standard Cron Pattern (5 Fields)</label>
                      <input 
                        type="text" 
                        value={cronExpression} 
                        onChange={(e) => setCronExpression(e.target.value)}
                        placeholder="e.g. */30 * * * *"
                        style={{ fontFamily: 'monospace', fontSize: '15px' }}
                        required 
                      />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-dark)' }}>
                      <span>Quick Help:</span>
                      <span>• <code style={{ color: 'var(--accent)' }}>*/5 * * * *</code>: Run every 5 minutes (ideal for testing)</span>
                      <span>• <code style={{ color: 'var(--accent)' }}>0 * * * *</code>: Run at the top of every hour</span>
                      <span>• <code style={{ color: 'var(--accent)' }}>0 0 * * *</code>: Run once daily at midnight</span>
                    </div>

                    {configSuccess && <p style={{ fontSize: '12.5px', color: 'var(--success)' }}>{configSuccess}</p>}
                    {configError && <p style={{ fontSize: '12.5px', color: 'var(--error)' }}>{configError}</p>}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                      <button type="submit" className="glow-btn" style={{ padding: '8px 20px' }}>
                        Update Schedule
                      </button>
                      <button 
                        type="button" 
                        onClick={handleTriggerScrape} 
                        disabled={scrapingInProgress}
                        className="glow-btn"
                        style={{ padding: '8px 20px', background: 'linear-gradient(135deg, var(--accent), #0891b2)' }}
                      >
                        <RefreshCw size={14} className={scrapingInProgress ? 'animate-spin-slow' : ''} />
                        {scrapingInProgress ? 'Scraping...' : 'Force Run Now'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Target Feeds Configuration */}
                <div className="glass-panel" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={18} style={{ color: 'var(--primary)' }} /> Scrape Target RSS Channels
                  </h3>

                  {/* Add Feed */}
                  <form onSubmit={handleAddFeed} style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                    <input 
                      type="text" 
                      placeholder="Feed Name" 
                      value={newFeedName} 
                      onChange={(e) => setNewFeedName(e.target.value)} 
                      style={{ flex: 1, fontSize: '13px' }} 
                      required
                    />
                    <input 
                      type="url" 
                      placeholder="RSS Feed URL" 
                      value={newFeedUrl} 
                      onChange={(e) => setNewFeedUrl(e.target.value)} 
                      style={{ flex: 2, fontSize: '13px' }} 
                      required
                    />
                    <button type="submit" className="glow-btn" style={{ padding: '8px 14px', fontSize: '12px' }}>
                      Add Target
                    </button>
                  </form>

                  {/* Feed List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {data.scraperConfig.targetFeeds.map((feed, idx) => (
                      <div key={idx} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
                        border: '1px solid var(--border-color)', gap: '10px'
                      }}>
                        <div style={{ overflow: 'hidden', flex: 1 }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {feed.name}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-dark)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {feed.url}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input 
                            type="checkbox" 
                            checked={feed.active} 
                            onChange={() => handleToggleFeed(idx)}
                            style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                            title="Toggle active state for next scraping sweep"
                          />
                          <button 
                            type="button" 
                            onClick={() => handleDeleteFeed(idx)}
                            style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '11px' }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>

              </div>

              {/* Scrape Execution Logs Grid */}
              <div className="glass-panel" style={{ padding: '24px 28px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={18} style={{ color: 'var(--success)' }} /> Cron Engine Execution Logs
                </h3>

                <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '12px 16px' }}>Timestamp</th>
                        <th style={{ padding: '12px 16px' }}>Run Status</th>
                        <th style={{ padding: '12px 16px' }}>Matched Articles</th>
                        <th style={{ padding: '12px 16px' }}>Curriculum Placed</th>
                        <th style={{ padding: '12px 16px' }}>Log Detail Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.scrapeLogs.map((log, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                              background: log.status === 'Success' ? 'rgba(52, 211, 153, 0.1)' : log.status === 'No New Content' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                              color: log.status === 'Success' ? 'var(--success)' : log.status === 'No New Content' ? 'var(--warning)' : 'var(--error)'
                            }}>
                              {log.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-main)', textAlign: 'center' }}>
                            {log.articlesFound}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--accent)', textAlign: 'center', fontWeight: 700 }}>
                            {log.articlesAdded}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                            {log.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: KNOWLEDGE SEARCH */}
          {activeTab === 'search' && (
            <div className="search-workspace fade-in">
              
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Knowledge Base Global Search</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                  Perform immediate indexed search across all 30 days of the study guide and articles scraped dynamically from the web.
                </p>
              </div>

              {/* Search Box Card */}
              <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Search size={22} style={{ color: 'var(--accent)' }} />
                <input
                  type="text"
                  placeholder="Enter keywords (e.g. 'WSJF', 'ROAM', 'Inspect & Adapt', 'Servant Leader', 'Scrum of Scrums')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flexGrow: 1, fontSize: '16px', background: 'transparent',
                    border: 'none', color: 'var(--text-main)', padding: '4px 0'
                  }}
                  autoFocus
                />
                {searchQuery.trim() && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dark)', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Clear Search
                  </button>
                )}
              </div>

              {/* Results List */}
              <div>
                {searchQuery.trim() ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-dark)', fontWeight: 600 }}>
                      FOUND {searchResults.length} INDEXED MATCHES FOR "{searchQuery}"
                    </p>
                    
                    {searchResults.map((result, idx) => (
                      <div 
                        key={idx}
                        onClick={() => { setSelectedDayId(result.id); setActiveTab('study'); }}
                        className="glass-panel"
                        style={{
                          padding: '16px 20px', borderRadius: '12px', cursor: 'pointer',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: 'rgba(255,255,255,0.01)', transition: 'var(--transition-smooth)'
                        }}
                      >
                        <div>
                          <h4 style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: 600 }}>
                            {result.title}
                          </h4>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {result.subtitle}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--accent)', background: 'rgba(34, 211, 238, 0.08)', padding: '3px 8px', borderRadius: '20px' }}>
                            {result.matchText}
                          </span>
                          <ChevronRight size={16} style={{ color: 'var(--text-dark)' }} />
                        </div>
                      </div>
                    ))}

                    {searchResults.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-dark)' }}>
                        <AlertCircle size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                        <p>No matches located in the study plan or scraped articles database.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    padding: '80px 24px', textAlign: 'center', borderRadius: '12px',
                    border: '1px dashed var(--border-color)', color: 'var(--text-dark)'
                  }}>
                    <Search size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                    <h4 style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '16px' }}>Global Library Search</h4>
                    <p style={{ fontSize: '13px', maxWidth: '400px', margin: '8px auto 0', lineHeight: '1.4' }}>
                      Type in keywords or topics above to browse corresponding days on the 30-day curriculum or review third-party blog insights.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </main>

    </div>
  );
}
