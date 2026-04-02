// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Swords,
  LineChart,
  Map,
  Library,
  Trophy as TrophyIcon,
  Menu,
  Bell,
  X,
  Crown,
  ShieldCheck,
  Settings,
  LogOut,
  User,
  Radar,
  Grid,
  Sun,
  Moon,
  Smartphone,
  ArrowRight,
  Lock,
  Check,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import SplashScreen from './pages/SplashScreen';
import Login from './pages/Login';
import Dugout from './pages/Dugout';
import MatchCenter from './MatchCenter';
import Performance from './pages/Performance';
import Arena from './pages/Arena';
import Archive from './pages/Archive';
import Tournaments from './pages/Tournaments';
import Profile from './pages/Profile';
import { AuthContext } from './AuthContext';
import LiveScoreboard from './pages/LiveScoreboard';
import { fetchMatchById, supabase } from './lib/supabase';

export type Page = 'DUGOUT' | 'MATCH_CENTER' | 'PERFORMANCE' | 'ARENA' | 'HISTORY' | 'TOURNAMENTS' | 'PROFILE';

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [userData, setUserData] = useState<any | null>(null);
  const [activePage, setActivePage] = useState<Page>('DUGOUT');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  /* ââ URL params: ?watch=MATCH_ID or ?resume=MATCH_ID ââ */
  const [watchMatchId] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get('watch'); } catch { return null; }
  });
  const [resumeMatchId] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get('resume'); } catch { return null; }
  });
  /* —— URL params: ?join=CODE&pass=PASS for device handoff —— */
  const [joinCode] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get('join'); } catch { return null; }
  });
  const [joinPass] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get('pass'); } catch { return null; }
  });
  /* —— URL params: ?spectate=CODE for spectator mode —— */
  const [spectateCode] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get('spectate'); } catch { return null; }
  });
  /* —— Join Match UI state (shown on dashboard) —— */
  const [showJoinMatch, setShowJoinMatch] = useState(false);
  const [joinMatchCode, setJoinMatchCode] = useState('');
  const [joinMatchPasscode, setJoinMatchPasscode] = useState('');
  const [joinStatus, setJoinStatus] = useState<'IDLE' | 'JOINING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [joinError, setJoinError] = useState('');

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('22YARDS_THEME');
      return saved === null ? false : saved !== 'light'; // default = light (white + red)
    } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    try { localStorage.setItem('22YARDS_THEME', isDark ? 'dark' : 'light'); } catch {}
  }, [isDark]);

  useEffect(() => {
    try {
      const savedData = localStorage.getItem('22YARDS_USER_DATA');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed && typeof parsed === 'object' && (parsed.name || parsed.phone)) {
          setUserData(parsed);
        } else {
          localStorage.removeItem('22YARDS_USER_DATA');
          setUserData(null);
        }
      }
    } catch (e) {
      console.error("Auth restoration failed:", e);
      localStorage.removeItem('22YARDS_USER_DATA');
      setUserData(null);
    }
  }, []);

  /* ââ Resume: after login, load match state from Supabase â localStorage â MATCH_CENTER ââ */
  useEffect(() => {
    if (!userData || !resumeMatchId) return;
    (async () => {
      const state = await fetchMatchById(resumeMatchId);
      if (state) {
        try { localStorage.setItem('22YARDS_ACTIVE_MATCH', JSON.stringify(state)); } catch {}
        /* strip the ?resume= param from the URL so a refresh doesn't re-trigger */
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('resume');
          window.history.replaceState({}, '', url.toString());
        } catch {}
        setActivePage('MATCH_CENTER');
      }
    })();
  }, [userData, resumeMatchId]);

  const handleLogin = (data: any) => {
    setUserData(data);
    localStorage.setItem('22YARDS_USER_DATA', JSON.stringify(data));
  };

  const handleLogout = () => {
    localStorage.removeItem('22YARDS_USER_DATA');
    setUserData(null);
    setIsSidebarOpen(false);
    setActivePage('DUGOUT');
  };

  const handleUpdateProfile = (name: string, role: string, avatar: string, age: string, city: string, battingStyle: string, bowlingStyle: string) => {
    const updatedData = { ...userData, name, role, avatar, age, city, battingStyle, bowlingStyle };
    setUserData(updatedData);
    localStorage.setItem('22YARDS_USER_DATA', JSON.stringify(updatedData));
    setActivePage('DUGOUT');
  };

  /* —— Join match handler: fetch match state from Supabase using code + passcode —— */
  const handleJoinMatch = async (code?: string, pass?: string) => {
    const useCode = (code || joinMatchCode).trim().toUpperCase();
    const usePass = (pass || joinMatchPasscode).trim();
    if (!useCode || !usePass) {
      setJoinError('Enter both Match Code and Passcode');
      setJoinStatus('ERROR');
      return;
    }
    setJoinStatus('JOINING');
    setJoinError('');
    try {
      if (!supabase) throw new Error('offline');
      const { data, error } = await supabase
        .from('match_transfers')
        .select('*')
        .eq('match_code', useCode)
        .eq('passcode', usePass)
        .single();
      if (error || !data) {
        setJoinError('Invalid code or passcode. Check and try again.');
        setJoinStatus('ERROR');
        return;
      }
      // Check expiry
      if (new Date(data.expires_at) < new Date()) {
        setJoinError('This transfer code has expired. Ask the scorer for a new one.');
        setJoinStatus('ERROR');
        return;
      }
      // Load the match state
      localStorage.setItem('22YARDS_ACTIVE_MATCH', JSON.stringify(data.match_state));
      // Update transfer status to CLAIMED
      await supabase.from('match_transfers').update({ status: 'CLAIMED' }).eq('match_code', useCode);
      // Clean URL params
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('join');
        url.searchParams.delete('pass');
        window.history.replaceState({}, '', url.toString());
      } catch {}
      setJoinStatus('SUCCESS');
      setTimeout(() => {
        setShowJoinMatch(false);
        setActivePage('MATCH_CENTER');
      }, 1000);
    } catch (e) {
      setJoinError('Could not connect to server. Supabase may not be configured yet.');
      setJoinStatus('ERROR');
    }
  };

  /* —— Auto-join if URL has ?join=CODE&pass=PASS —— */
  useEffect(() => {
    if (joinCode && joinPass && userData) {
      setJoinMatchCode(joinCode);
      setJoinMatchPasscode(joinPass);
      setShowJoinMatch(true);
      handleJoinMatch(joinCode, joinPass);
    }
  }, [joinCode, joinPass, userData]);

  if (!isReady) {
    return <SplashScreen onComplete={() => setIsReady(true)} />;
  }

  /* ââ Spectator mode: ?watch=MATCH_ID â no login required ââ */
  if (watchMatchId) {
    return <LiveScoreboard matchId={watchMatchId} />;
  }

  if (!userData) {
    return <Login onLogin={handleLogin} />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'DUGOUT': return <Dugout onNavigate={setActivePage} onUpgrade={() => setShowUpgradeModal(true)} />;
      case 'MATCH_CENTER': return <MatchCenter onBack={() => setActivePage('DUGOUT')} />;
      case 'PERFORMANCE': return <Performance userAvatar={userData.avatar} />;
      case 'ARENA': return <Arena />;
      case 'HISTORY': return <Archive />;
      case 'TOURNAMENTS': return <Tournaments />;
      case 'PROFILE': return <Profile 
        currentName={userData.name} 
        currentRole={userData.role} 
        currentAvatar={userData.avatar} 
        onSave={handleUpdateProfile} 
        onBack={() => setActivePage('DUGOUT')} 
      />;
      default: return <Dugout onNavigate={setActivePage} onUpgrade={() => setShowUpgradeModal(true)} />;
    }
  };

  const navItems = [
    { id: 'DUGOUT', label: 'Dugout', icon: LayoutDashboard },
    { id: 'MATCH_CENTER', label: 'Arena', icon: Swords },
    { id: 'PERFORMANCE', label: 'Stats', icon: LineChart },
    { id: 'ARENA', label: 'Grounds', icon: Map },
  ];

  return (
    <AuthContext.Provider value={{ userData, login: handleLogin, logout: handleLogout }}>
      <div className="h-[100dvh] w-full bg-[#020617] text-white flex flex-col overflow-hidden relative font-sans">
        {/* Top Navigation â safe-area-inset-top handles iPhone Dynamic Island / notch */}
        <div
          className="border-b border-white/5 shrink-0 bg-black/50 backdrop-blur-xl z-[100]"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="h-16 px-6 flex items-center justify-between">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-white/60 hover:text-[#00F0FF] transition-colors">
            <Menu size={20} />
          </button>

          <div className="flex items-center space-x-2">
            <span className="font-heading text-xl tracking-tighter text-[#00F0FF] font-black italic">22YARDS</span>
            <div className="h-4 w-px bg-white/10 mx-2" />
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{activePage.replace('_', ' ')}</span>
          </div>

          <div className="flex items-center space-x-1">
            {/* Theme toggle */}
            <button
              onClick={() => setIsDark(d => !d)}
              className="p-2 text-white/60 hover:text-[#00F0FF] transition-colors"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {/* B-17 fix: notification bell â dot removed until real notifications exist */}
            <button className="p-2 text-white/60 hover:text-[#00F0FF] relative transition-colors" title="Notifications â coming soon">
              <Bell size={18} />
            </button>
          </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="h-full w-full"
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom Tab Bar */}
        {activePage !== 'MATCH_CENTER' && activePage !== 'PROFILE' && (
          <div className="bg-black/80 backdrop-blur-2xl border-t border-white/5 flex items-center justify-around px-4 z-[90] shrink-0 bottom-tab-bar" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))', minHeight: '5rem' }}>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id as Page)}
                className={`flex flex-col items-center space-y-1 group transition-all ${activePage === item.id ? 'text-[#00F0FF]' : 'text-white/20'}`}
              >
                <div className={`p-2 rounded-xl transition-all ${activePage === item.id ? 'bg-[#00F0FF]/10 shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'group-hover:bg-white/5'}`}>
                  <item.icon size={20} strokeWidth={activePage === item.id ? 2.5 : 2} />
                </div>
                <span className={`text-[7px] font-black uppercase tracking-[0.2em] transition-all ${activePage === item.id ? 'opacity-100' : 'opacity-40 group-hover:opacity-60'}`}>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Sidebar Redesign - Matches Screenshot */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]" 
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed top-0 left-0 bottom-0 w-[300px] bg-[#020d1f] border-r border-white/5 z-[210] flex flex-col p-8 shadow-[20px_0_60px_rgba(0,0,0,0.8)]"
              >
                {/* User Info Header Section */}
                <div className="flex items-center space-x-4 mb-10">
                  <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0">
                    <img src={userData.avatar} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="font-heading text-4xl leading-none italic text-white tracking-tighter uppercase">{userData.name}</h2>
                    <div className="flex items-center space-x-1 mt-1 text-[#00F0FF]">
                      <ShieldCheck size={12} strokeWidth={2.5} />
                      <span className="text-[10px] font-black uppercase tracking-[0.1em]">{userData.role}</span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/5 mb-8" />

                <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar pr-2">
                  <SidebarItem icon={Grid} label="Dugout Hub" active={activePage === 'DUGOUT'} onClick={() => { setActivePage('DUGOUT'); setIsSidebarOpen(false); }} />
                  <SidebarItem icon={Swords} label="Start Match" active={activePage === 'MATCH_CENTER'} onClick={() => { setActivePage('MATCH_CENTER'); setIsSidebarOpen(false); }} />
                  <SidebarItem icon={LineChart} label="Performance Hub" active={activePage === 'PERFORMANCE'} onClick={() => { setActivePage('PERFORMANCE'); setIsSidebarOpen(false); }} />
                  <SidebarItem icon={Map} label="Arena Venue" active={activePage === 'ARENA'} onClick={() => { setActivePage('ARENA'); setIsSidebarOpen(false); }} />
                  <SidebarItem icon={Library} label="Personal Archive" active={activePage === 'HISTORY'} onClick={() => { setActivePage('HISTORY'); setIsSidebarOpen(false); }} />
                  <SidebarItem icon={TrophyIcon} label="Pro Circuits" active={activePage === 'TOURNAMENTS'} onClick={() => { setActivePage('TOURNAMENTS'); setIsSidebarOpen(false); }} />
                  <SidebarItem icon={Settings} label="Identity Config" active={activePage === 'PROFILE'} onClick={() => { setActivePage('PROFILE'); setIsSidebarOpen(false); }} />
                </div>

                <button onClick={handleLogout} className="flex items-center space-x-4 p-4 rounded-xl text-white/20 hover:bg-red-500/10 hover:text-red-500 transition-all mt-6 group">
                  <LogOut size={18} className="group-hover:animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Terminate Session</span>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Upgrade Modal */}
        <AnimatePresence>
          {showUpgradeModal && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
            >
              <div className="w-full max-w-sm bg-[#0a0a0a] border border-[#00F0FF]/20 rounded-[40px] p-10 space-y-8 relative overflow-hidden shadow-[0_0_100px_rgba(0,240,255,0.1)]">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#00F0FF]/5 blur-[60px] rounded-full" />
                <div className="text-center space-y-4 relative z-10">
                  <div className="w-16 h-16 bg-[#00F0FF]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Crown size={32} className="text-[#00F0FF]" />
                  </div>
                  <h3 className="font-heading text-4xl italic uppercase text-white leading-none">ELITE SQUADRON</h3>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Operational Superiority</p>
                </div>

                <div className="space-y-4">
                  <FeatureItem label="Advanced Telemetry" />
                  <FeatureItem label="Global Rankings" />
                  <FeatureItem label="Priority Arena Access" />
                </div>

                <div className="space-y-4">
                  {/* B-16 fix: upgrade button now shows coming-soon message */}
                  <button
                    className="w-full bg-[#00F0FF] text-black py-5 rounded-2xl font-black text-[10px] tracking-[0.5em] uppercase shadow-[0_10px_30px_rgba(0,240,255,0.3)]"
                    onClick={() => { setShowUpgradeModal(false); alert('â¡ Elite Squadron is coming soon!\n\nWe\'re building something special. Stay tuned for the launch announcement.'); }}
                  >AUTHORIZE UPGRADE</button>
                  <button onClick={() => setShowUpgradeModal(false)} className="w-full text-white/20 py-2 text-[8px] font-black uppercase tracking-widest">Decline Protocol</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* JOIN MATCH floating button — shown on all pages except MATCH_CENTER */}
        {activePage !== 'MATCH_CENTER' && (
          <button
            onClick={() => { setShowJoinMatch(true); setJoinStatus('IDLE'); setJoinError(''); }}
            className="fixed bottom-24 right-4 z-[200] bg-[#00F0FF] text-black w-14 h-14 rounded-full shadow-lg shadow-[#00F0FF]/30 flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
            title="Join Match"
          >
            <Smartphone size={22} />
          </button>
        )}

        {/* JOIN MATCH MODAL */}
        <AnimatePresence>
          {showJoinMatch && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowJoinMatch(false); setJoinStatus('IDLE'); }}
              className="fixed inset-0 z-[6000] bg-black/90 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 30 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-[32px] overflow-hidden"
              >
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#00F0FF]/10 flex items-center justify-center">
                      <Smartphone size={18} className="text-[#00F0FF]" />
                    </div>
                    <div>
                      <h3 className="font-heading text-lg uppercase italic text-[#00F0FF]">Join Match</h3>
                      <p className="text-[9px] text-white/40 uppercase tracking-wider">Take over scoring from another device</p>
                    </div>
                  </div>
                  <button onClick={() => { setShowJoinMatch(false); setJoinStatus('IDLE'); }} className="p-2 text-white/40 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Match Code Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/50 uppercase tracking-[0.15em] flex items-center gap-2">
                      <Swords size={12} /> Match Code
                    </label>
                    <input
                      type="text"
                      value={joinMatchCode}
                      onChange={(e) => setJoinMatchCode(e.target.value.toUpperCase().slice(0, 6))}
                      placeholder="e.g. AB3K7X"
                      maxLength={6}
                      className="w-full px-4 py-4 rounded-[16px] bg-white/5 border border-white/10 text-white text-center text-2xl font-heading tracking-[0.3em] placeholder:text-white/15 placeholder:text-base placeholder:tracking-normal focus:outline-none focus:border-[#00F0FF]/50"
                      disabled={joinStatus === 'JOINING'}
                    />
                  </div>

                  {/* Passcode Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/50 uppercase tracking-[0.15em] flex items-center gap-2">
                      <Lock size={12} /> Passcode
                    </label>
                    <input
                      type="text"
                      value={joinMatchPasscode}
                      onChange={(e) => setJoinMatchPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="4-digit passcode"
                      maxLength={4}
                      inputMode="numeric"
                      className="w-full px-4 py-4 rounded-[16px] bg-white/5 border border-white/10 text-white text-center text-2xl font-heading tracking-[0.3em] placeholder:text-white/15 placeholder:text-base placeholder:tracking-normal focus:outline-none focus:border-[#FFD600]/50"
                      disabled={joinStatus === 'JOINING'}
                    />
                  </div>

                  {/* Error message */}
                  {joinError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-[12px] bg-[#FF003C]/10 border border-[#FF003C]/20"
                    >
                      <p className="text-[11px] text-[#FF003C] font-bold">{joinError}</p>
                    </motion.div>
                  )}

                  {/* Success message */}
                  {joinStatus === 'SUCCESS' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-[16px] bg-[#39FF14]/10 border border-[#39FF14]/20 text-center"
                    >
                      <Check size={24} className="text-[#39FF14] mx-auto mb-2" />
                      <p className="text-[12px] text-[#39FF14] font-black uppercase tracking-wider">Match Joined!</p>
                      <p className="text-[10px] text-white/40 mt-1">Loading scoring interface...</p>
                    </motion.div>
                  )}

                  {/* Join Button */}
                  <button
                    onClick={() => handleJoinMatch()}
                    disabled={joinStatus === 'JOINING' || joinStatus === 'SUCCESS' || joinMatchCode.length < 4 || joinMatchPasscode.length < 4}
                    className={`w-full py-4 rounded-[20px] font-black text-[12px] uppercase tracking-wider transition-all flex items-center justify-center gap-3 ${
                      joinStatus === 'JOINING' ? 'bg-[#00F0FF]/20 text-[#00F0FF]/60' :
                      joinStatus === 'SUCCESS' ? 'bg-[#39FF14]/20 text-[#39FF14]' :
                      (joinMatchCode.length >= 4 && joinMatchPasscode.length >= 4) ? 'bg-[#00F0FF] text-black hover:bg-[#00F0FF]/90 active:scale-[0.98]' :
                      'bg-white/5 text-white/20 cursor-not-allowed'
                    }`}
                  >
                    {joinStatus === 'JOINING' ? (
                      <><Loader2 size={18} className="animate-spin" /> Connecting...</>
                    ) : joinStatus === 'SUCCESS' ? (
                      <><Check size={18} /> Connected!</>
                    ) : (
                      <><ArrowRight size={18} /> Join Match</>
                    )}
                  </button>

                  {/* Info text */}
                  <p className="text-[9px] text-white/20 text-center leading-relaxed">
                    Get the Match Code and Passcode from the current scorer's device.
                    They can find it in Settings → Transfer Scoring.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AuthContext.Provider>
  );
};

const SidebarItem = ({ icon: Icon, label, active = false, onClick }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center space-x-4 px-6 py-5 rounded-xl transition-all border ${
      active 
      ? 'bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]/30 shadow-[0_0_20px_rgba(0,240,255,0.1)]' 
      : 'text-white/40 hover:bg-white/5 hover:text-white border-transparent'
    }`}
  >
    <Icon size={20} className={active ? 'text-[#00F0FF]' : 'opacity-60'} strokeWidth={active ? 2.5 : 2} />
    <span className="text-[11px] font-black uppercase tracking-[0.1em] leading-none whitespace-nowrap">{label}</span>
  </button>
);

const FeatureItem = ({ label }) => (
  <div className="flex items-center space-x-3 text-white/60">
    <ShieldCheck size={14} className="text-[#39FF14]" />
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </div>
);

export default App;
