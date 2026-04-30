// @ts-nocheck
// Build: 2026-04-15
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Line, Legend, LineChart, Cell
} from 'recharts';
import {
  ChevronLeft, ChevronDown, Swords, Plus, Minus, Check, Zap, X,
  Undo2, Disc, User, Trash2, ArrowRight,
  CheckCircle2, Target, Shield, Flame, Activity, Trophy, Share2,
  TrendingUp, BarChart2, Users, Star, Award,
  ArrowUpRight, Clock, MapPin, UserPlus, UserCheck,
  ClipboardList, Search, RefreshCcw, ShieldAlert, Camera, HelpCircle,
  LayoutDashboard, PieChart, ZapOff, Calendar, Crown, Settings, Image as ImageIcon, Save,
  ChevronRight, Smartphone, Medal, Zap as Bolt, Crosshair, Edit2, Upload,
  ArrowLeftRight, History, Coins, Video, QrCode, ScanLine, Sparkles
} from 'lucide-react';
import MotionButton from './components/MotionButton';
import { MatchState, Player, TeamID, PlayerID, BallEvent } from './types';
import { useAuth } from './AuthContext';
import { syncMatchToSupabase, saveMatchRecord, upsertPlayer, generatePlayerId, buildStatsFromHistory, pushLiveMatchState, fetchMatchById, findMatchByPasscode, supabase } from './lib/supabase';
import { calculateDLSTarget, getDLSParScore, getMatchStatus } from './lib/dls';
import { createSuperOverState, createNextSuperOverState, updateSuperOverAfterBall, shouldEndSuperOverInnings, determineSuperOverResult, setSuperOverLineup, transitionSuperOverPhase, SuperOverState } from './lib/superOver';
import LiveScoreboard from './pages/LiveScoreboard';
import HighlightsPage from './pages/Highlights';
import { CameraRecorder, YouTubeStreamModal, LiveStreamView, useCameraRecorder, type LiveStreamConfig } from './pages/LiveStream';

const CYBER_COLORS = {
  bg: '#050505',
  surface: '#121212',
  cyan: '#00F0FF',
  red: '#FF003C',
  purple: '#BC13FE',
  gold: '#FFD600',
  green: '#39FF14',
  grey: '#1A1A1A',
  teal: '#4DB6AC',
  textDim: '#666666',
  orange: '#FF6D00'
};

const GloveIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M16 11V6a2 2 0 0 0-4 0v5" />
    <path d="M12 10V4a2 2 0 0 0-4 0v6" />
    <path d="M8 10V6a2 2 0 0 0-4 0v10" />
    <path d="M16 8a2 2 0 1 1 4 0v7a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7V11" />
    <path d="M19 14h2" />
  </svg>
);

const KeypadButton = ({ children, onClick, color = 'white', border = 'transparent', bg = CYBER_COLORS.grey, span = 1, active = false, disabled = false }) => (
  <motion.button
    whileTap={!disabled ? { scale: 0.94 } : {}}
    onClick={!disabled ? onClick : undefined}
    style={{
      backgroundColor: active ? CYBER_COLORS.cyan + '22' : bg,
      borderColor: active ? CYBER_COLORS.cyan : border,
      color: active ? CYBER_COLORS.cyan : color,
      gridColumn: `span ${span}`,
      opacity: disabled ? 0.3 : 1
    }}
    className={`h-14 sm:h-16 rounded-xl border-2 flex items-center justify-center font-numbers text-xl sm:text-2xl font-black shadow-lg transition-all ${active ? 'animate-pulse' : ''}`}
  >
    {children}
  </motion.button>
);

const MatchCenter: React.FC<{ onBack: () => void; onNavigate?: (page: string) => void }> = ({ onBack, onNavigate }) => {
  const { userData } = useAuth();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [activeLogoTeamId, setActiveLogoTeamId] = useState<TeamID | null>(null);
  const [forcedSpectatorMode, setForcedSpectatorMode] = useState<string | null>(null);

  function createInitialState(): MatchState {
    return {
      matchId: `M-${Date.now()}`,
      status: 'CONFIG',
      currentInnings: 1,
      toss: { winnerId: null, decision: null },
      config: {
        overs: 5, oversPerBowler: 1, ballType: 'TENNIS', matchType: 'LIMITED_OVERS', pitchType: 'TURF',
        city: 'Kanpur', ground: '', wagonWheel: true,
        powerPlay: 2,
        dateTime: new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
      },
      teams: {
        teamA: { id: 'A', name: 'TEAM A', city: '', squad: [], logo: '', resolutionMode: 'NEW', resolutionHandled: false },
        teamB: { id: 'B', name: 'TEAM B', city: '', squad: [], logo: '', resolutionMode: 'NEW', resolutionHandled: false },
        battingTeamId: 'A', bowlingTeamId: 'B',
      },
      liveScore: { runs: 0, wickets: 0, balls: 0 },
      crease: { strikerId: null, nonStrikerId: null, bowlerId: null, previousBowlerId: null },
      history: [],
    };
  }

  const [match, setMatch] = useState<MatchState>(() => {
    const saved = localStorage.getItem('22YARDS_ACTIVE_MATCH');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.status === 'COMPLETED') return createInitialState();
      return parsed;
    }
    return createInitialState();
  });

  const [status, setStatus] = useState<string>(match.status === 'COMPLETED' ? 'SUMMARY' : match.status);
  const [summaryTab, setSummaryTab] = useState<'SUMMARY' | 'SCORECARD' | 'COMMS' | 'ANALYSIS' | 'MVP' | 'HIGHLIGHTS'>('SUMMARY');

  // YouTube Live Streaming state
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [liveStreamConfig, setLiveStreamConfig] = useState<LiveStreamConfig>({
    youtubeStreamUrl: match.config.youtubeStreamUrl,
    youtubeEmbedUrl: match.config.youtubeEmbedUrl,
    rtmpUrl: match.config.rtmpUrl,
    streamKey: match.config.streamKey,
    isStreaming: false,
  });
  const [showCameraRecorder, setShowCameraRecorder] = useState(false);

  // Highlights state
  const [showHighlights, setShowHighlights] = useState(false);
  const [overlayAnim, setOverlayAnim] = useState<'FOUR' | 'SIX' | 'WICKET' | 'FREE_HIT' | 'INNINGS_BREAK' | null>(null);
  const [winnerTeam, setWinnerTeam] = useState<{name: string, id: TeamID | null, margin: string} | null>(null);
  const [selectionTarget, setSelectionTarget] = useState<'STRIKER' | 'NON_STRIKER' | 'BOWLER' | 'NEW_BATSMAN' | 'NEXT_BOWLER' | 'FIELDER' | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<TeamID | null>(null);
  const [showLiveScorecard, setShowLiveScorecard] = useState(false);
  const [pendingExtra, setPendingExtra] = useState<'WD' | 'NB' | 'BYE' | 'LB' | null>(null);
  const [wicketWizard, setWicketWizard] = useState<{ open: boolean, type?: string }>({ open: false });
  const [newName, setNewName] = useState('');
  const [tossFlipPhase, setTossFlipPhase] = useState('WAITING');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [editingTeamNameId, setEditingTeamNameId] = useState<TeamID | null>(null);
  const [logoPopupTeamId, setLogoPopupTeamId] = useState<TeamID | null>(null);
  const [tossCall, setTossCall] = useState<{ teamA: 'HEADS' | 'TAILS'; teamB: 'HEADS' | 'TAILS' }>({ teamA: 'HEADS', teamB: 'TAILS' });
  const [tossResult, setTossResult] = useState<'HEADS' | 'TAILS' | null>(null);
  const [tossPhase, setTossPhase] = useState<'CALL' | 'FLIP' | 'WINNER' | 'DECISION' | 'RESULT'>('CALL');
  const [tossCaller, setTossCaller] = useState<'A' | 'B' | null>(null);

  // NEW: Config flow step tracking (1: format, 2: details, 3: teams)
  const [configStep, setConfigStep] = useState(1);
  const [matchMode, setMatchMode] = useState<'INDIVIDUAL' | 'TOURNAMENT'>('INDIVIDUAL');
  const [showCustomRules, setShowCustomRules] = useState(false);
  const [showOfficials, setShowOfficials] = useState(false);

  // Premium team selection state
  const [teamDrawer, setTeamDrawer] = useState<{ open: boolean; targetTeam: 'A' | 'B' | null; mode: 'SEARCH' | 'CREATE' }>({ open: false, targetTeam: null, mode: 'SEARCH' });
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [teamCreateName, setTeamCreateName] = useState('');
  const [vsRevealed, setVsRevealed] = useState(false);

  // Share scorecard
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareText, setShareText] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  // Add Player Mid-Match
  const [showAddPlayer, setShowAddPlayer] = useState<{ open: boolean; team: 'batting' | 'bowling' | null }>({ open: false, team: null });
  const [showScorecardPreview, setShowScorecardPreview] = useState(false);
  const [addPlayerName, setAddPlayerName] = useState('');
  const [addPlayerPhone, setAddPlayerPhone] = useState('');

  // Player action menu (tap on player name in live scorecard)
  const [playerActionMenu, setPlayerActionMenu] = useState<{
    open: boolean;
    playerId: string | null;
    role: 'STRIKER' | 'NON_STRIKER' | 'BOWLER' | null;
  }>({ open: false, playerId: null, role: null });

  // Summary reveal animation state
  const [summaryPhase, setSummaryPhase] = useState<'SKELETON' | 'COUNTING' | 'REVEAL' | 'READY'>('SKELETON');
  const [countingRuns, setCountingRuns] = useState({ inn1: 0, inn2: 0 });
  const [scorecardReady, setScorecardReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const scorecardRef = useRef<HTMLDivElement>(null);

  // FIRE MODE: Dynamic theme for hot run rates
  const [fireMode, setFireMode] = useState(false);
  const [fireModeBanner, setFireModeBanner] = useState(false);
  const [fireModeDeclined, setFireModeDeclined] = useState(false);

  // ICE MODE: Dynamic theme for slow run rates
  const [iceMode, setIceMode] = useState(false);
  const [iceModeBanner, setIceModeBanner] = useState(false);
  const [iceModeDeclined, setIceModeDeclined] = useState(false);
  const [fireModeBallCount, setFireModeBallCount] = useState(0);
  const [iceModeBallCount, setIceModeBallCount] = useState(0);

  // ═══ DEVICE BACK BUTTON / BROWSER BACK SUPPORT ═══
  useEffect(() => {
    const handleBackButton = (e: PopStateEvent) => {
      if (playerActionMenu.open) {
        e.preventDefault();
        setPlayerActionMenu({ open: false, playerId: null, role: null });
        window.history.pushState({ mc: true }, '');
        return;
      }
      if (showScorecardPreview) {
        e.preventDefault();
        setShowScorecardPreview(false);
        window.history.pushState({ mc: true }, '');
        return;
      }
      if (wicketWizard.open) {
        e.preventDefault();
        setWicketWizard({ open: false });
        window.history.pushState({ mc: true }, '');
        return;
      }
      if (showAddPlayer.open) {
        e.preventDefault();
        setShowAddPlayer({ open: false, team: null });
        window.history.pushState({ mc: true }, '');
        return;
      }
      if (editingTeamId) {
        e.preventDefault();
        setEditingTeamId(null);
        window.history.pushState({ mc: true }, '');
        return;
      }
      if (showShareModal || showShareSheet) {
        e.preventDefault();
        setShowShareModal(false);
        setShowShareSheet(false);
        window.history.pushState({ mc: true }, '');
        return;
      }
      if (showLiveScorecard) {
        e.preventDefault();
        setShowLiveScorecard(false);
        window.history.pushState({ mc: true }, '');
        return;
      }
      if (selectionTarget === 'BOWLER' && status === 'OPENERS') {
        e.preventDefault();
        skipHistoryPushRef.current = true;
        setSelectionTarget('NON_STRIKER');
        setMatch(m => ({ ...m, crease: { ...m.crease, bowlerId: null } }));
        window.history.pushState({ mc: true }, '');
        return;
      }
      if (selectionTarget === 'NON_STRIKER' && status === 'OPENERS') {
        e.preventDefault();
        skipHistoryPushRef.current = true;
        setSelectionTarget('STRIKER');
        setMatch(m => ({ ...m, crease: { ...m.crease, nonStrikerId: null } }));
        window.history.pushState({ mc: true }, '');
        return;
      }
      if (selectionTarget === 'STRIKER' && status === 'OPENERS') {
        e.preventDefault();
        skipHistoryPushRef.current = true;
        setStatus('TOSS_FLIP');
        setSelectionTarget(null);
        setMatch(m => ({ ...m, crease: { ...m.crease, strikerId: null }, status: 'TOSS_FLIP' }));
        window.history.pushState({ mc: true }, '');
        return;
      }
      // TOSS_FLIP step 2 (winner chosen) → step 1 (clear winner)
      if (status === 'TOSS_FLIP' && match.toss.winnerId) {
        e.preventDefault();
        setMatch(m => ({ ...m, toss: { ...m.toss, winnerId: null, decision: null } }));
        window.history.pushState({ mc: true }, '');
        return;
      }
      // TOSS_FLIP step 1 → back to CONFIG step 3
      if (status === 'TOSS_FLIP' && !match.toss.winnerId) {
        e.preventDefault();
        skipHistoryPushRef.current = true;
        setStatus('CONFIG');
        setMatch(m => ({ ...m, status: 'CONFIG' }));
        setConfigStep(3);
        window.history.pushState({ mc: true }, '');
        return;
      }
      if (status === 'CONFIG' && configStep > 1) {
        e.preventDefault();
        skipHistoryPushRef.current = true;
        setConfigStep(s => s - 1);
        window.history.pushState({ mc: true }, '');
        return;
      }
      if (status === 'CONFIG' && configStep === 1) {
        return;
      }
      if (status === 'LIVE') {
        e.preventDefault();
        setShowLeaveConfirm(true);
        window.history.pushState({ mc: true }, '');
        return;
      }
    };
    window.addEventListener('popstate', handleBackButton);
    return () => window.removeEventListener('popstate', handleBackButton);
  }, [status, configStep, selectionTarget, playerActionMenu.open, showScorecardPreview, wicketWizard.open, showAddPlayer.open, editingTeamId, showShareModal, showShareSheet, showLiveScorecard, match.toss.winnerId]);

  // Push one history entry on mount so the first back press has something to pop
  useEffect(() => {
    window.history.pushState({ mc: true }, '');
  }, []);

  // Match Settings (mid-match)
  const [showMatchSettings, setShowMatchSettings] = useState(false);
  const [abandonConfirm, setAbandonConfirm] = useState(false);
  const [abandonReason, setAbandonReason] = useState('');
  // Leave confirmation modal (replaces window.confirm for back button during LIVE)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // DLS (Rain Delay) state
  const [showDLSModal, setShowDLSModal] = useState(false);
  const [dlsReducedOvers, setDlsReducedOvers] = useState<number>(0);
  const [dlsActive, setDlsActive] = useState(false);

  // Super Over state
  const [superOverState, setSuperOverState] = useState<SuperOverState | null>(null);
  const [superOverPhase, setSuperOverPhase] = useState<string | null>(null); // 'SETUP_TEAM1' | 'BATTING_TEAM1' | etc
  const [soSelectedBatsmen, setSoSelectedBatsmen] = useState<string[]>([]);
  const [soSelectedBowler, setSoSelectedBowler] = useState<string | null>(null);
  const [showSuperOverPrompt, setShowSuperOverPrompt] = useState(false);

  // QR Scanner
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanMode, setQrScanMode] = useState<'PLAYER' | 'TEAM'>('PLAYER');
  const [qrScanTargetTeam, setQrScanTargetTeam] = useState<TeamID | null>(null);
  const [qrScanStatus, setQrScanStatus] = useState<'SCANNING' | 'SUCCESS' | 'ERROR'>('SCANNING');
  const [qrScanError, setQrScanError] = useState('');
  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrAnimRef = useRef<number | null>(null);

  // Team Share / Import
  const [teamShareModal, setTeamShareModal] = useState<{ open: boolean; teamId: TeamID | null; qrDataUrl: string }>({ open: false, teamId: null, qrDataUrl: '' });
  const [teamImportConfirm, setTeamImportConfirm] = useState<{ open: boolean; targetTeam: TeamID | null; incomingName: string; incomingLogo: string; incomingSquad: any[]; existingCount: number }>({ open: false, targetTeam: null, incomingName: '', incomingLogo: '', incomingSquad: [], existingCount: 0 });
  const [teamReadyAnimation, setTeamReadyAnimation] = useState<{ open: boolean; name: string; logo: string }>({ open: false, name: '', logo: '' });

  // Transfer Scoring / Device Handoff
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTab, setTransferTab] = useState<'HANDOFF' | 'SPECTATOR'>('HANDOFF');
  const [transferLinkCopied, setTransferLinkCopied] = useState(false);
  const [transferStatus, setTransferStatus] = useState<'IDLE' | 'WAITING' | 'TRANSFERRED'>('IDLE');
  const [transferPasscode, setTransferPasscode] = useState('');
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivePasscode, setReceivePasscode] = useState('');
  const [receiveError, setReceiveError] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);
  const [isSpectateMode, setIsSpectateMode] = useState(false);
  const spectateChannelRef = useRef<any>(null);

  // Scoring lock — prevents race conditions from rapid clicks
  const isProcessingBall = useRef(false);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Player ID search dropdown
  const [playerDropdownList, setPlayerDropdownList] = useState<Array<{id: string, name: string, phone: string}>>([]);
  const [selectedVaultPlayer, setSelectedVaultPlayer] = useState<{id: string, name: string, phone: string} | null>(null);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);

  const [squadConflict, setSquadConflict] = useState<{
    open: boolean;
    teamId: TeamID;
    name: string;
    existingSquad: any[];
    archivedTeamId: string;
  } | null>(null);

  // Squad selection: after merge, user picks which players play this match
  const [squadSelectionTeamId, setSquadSelectionTeamId] = useState<TeamID | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [squadSelectionSource, setSquadSelectionSource] = useState<'DRAWER' | 'CONFLICT'>('DRAWER');

  useEffect(() => {
    // Don't persist match state when we've handed off scoring to another device
    if (forcedSpectatorMode) return;
    // Always save — including COMPLETED so we know the match is done
    localStorage.setItem('22YARDS_ACTIVE_MATCH', JSON.stringify(match));
  }, [match, forcedSpectatorMode]);

  // Handle incoming transfer/spectate via URL parameters
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);

      // Method 1: Full base64 transfer (legacy / copy-link method)
      const transferData = params.get('transfer');
      if (transferData) {
        const json = decodeURIComponent(escape(atob(transferData)));
        const parsed = JSON.parse(json);
        if (parsed && parsed.status) {
          setMatch(parsed);
          setStatus(parsed.status === 'COMPLETED' ? 'SUMMARY' : parsed.status);
          localStorage.setItem('22YARDS_ACTIVE_MATCH', JSON.stringify(parsed));
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
      }

      // Method 2: Transfer via matchId (QR code / short link method)
      const transferId = params.get('transfer_id');
      if (transferId) {
        (async () => {
          try {
            const result = await fetchMatchById(transferId);
            if (result) {
              const matchData = result.live_state || result;
              setMatch(matchData);
              setStatus(matchData.status === 'COMPLETED' ? 'SUMMARY' : matchData.status);
              localStorage.setItem('22YARDS_ACTIVE_MATCH', JSON.stringify(matchData));
            }
          } catch (e) {
            console.error('Transfer fetch failed:', e);
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        })();
        return;
      }

      // Method 3: Spectator mode via matchId
      const spectateId = params.get('spectate');
      if (spectateId) {
        setIsSpectateMode(true);
        (async () => {
          try {
            const result = await fetchMatchById(spectateId);
            if (result) {
              const matchData = result.live_state || result;
              setMatch(matchData);
              setStatus(matchData.status === 'COMPLETED' ? 'SUMMARY' : matchData.status);
              // Clean up previous spectate channel if any
              if (spectateChannelRef.current) {
                supabase.removeChannel(spectateChannelRef.current);
              }
              const ch = supabase.channel('live:' + spectateId);
              ch.on('broadcast', { event: 'score_update' }, ({ payload }) => {
                if (payload) {
                  setMatch(payload);
                  setStatus(payload.status === 'COMPLETED' ? 'SUMMARY' : payload.status);
                }
              });
              ch.subscribe();
              spectateChannelRef.current = ch;
            }
          } catch (e) {
            console.error('Spectate fetch failed:', e);
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        })();
        return;
      }
    } catch (e) {
      console.error('URL parameter handling failed:', e);
    }
  }, []);

  // Cleanup spectate channel on unmount
  useEffect(() => {
    return () => {
      if (spectateChannelRef.current) {
        supabase.removeChannel(spectateChannelRef.current);
        spectateChannelRef.current = null;
      }
    };
  }, []);

  // Push browser history on forward navigation so back button works
  const prevStatusRef = useRef(status);
  const prevConfigStepRef = useRef(configStep);
  const prevSelectionRef = useRef(selectionTarget);
  const skipHistoryPushRef = useRef(false);
  useEffect(() => {
    const changed = status !== prevStatusRef.current || configStep !== prevConfigStepRef.current || selectionTarget !== prevSelectionRef.current;
    if (changed && !skipHistoryPushRef.current) {
      window.history.pushState({ mc: true }, '');
    }
    skipHistoryPushRef.current = false;
    prevStatusRef.current = status;
    prevConfigStepRef.current = configStep;
    prevSelectionRef.current = selectionTarget;
  }, [status, configStep, selectionTarget]);

  // Keep match.status in sync with the UI status state
  useEffect(() => {
    if (status && status !== match.status && status !== 'SUMMARY') {
      setMatch(m => {
        if (m.status === status) return m;
        return { ...m, status };
      });
    }
  }, [status]);

  const liveChannelRef = useRef<any>(null);

  useEffect(() => {
    if (!match.matchId) return;
    const ch = supabase.channel(`live:${match.matchId}`);
    // Listen for transfer_accepted — another device took over scoring (cross-device)
    ch.on('broadcast', { event: 'transfer_accepted' }, ({ payload }) => {
      // Skip if THIS device is the new scorer (receiver accepted transfer here)
      const scorerFlag = sessionStorage.getItem(`22Y_I_AM_SCORER_${match.matchId}`);
      if (scorerFlag) {
        console.log('[MatchCenter] Transfer accepted but I am the new scorer — ignoring');
        return;
      }
      console.log('[MatchCenter] Transfer accepted (broadcast) by:', payload?.acceptedBy);
      // Clear active match from localStorage so re-mounting shows fresh CONFIG, not old scoreboard
      localStorage.removeItem('22YARDS_ACTIVE_MATCH');
      // Save as followed match so Dugout shows the "Follow Match" shortcut
      localStorage.setItem('22Y_FOLLOWING_MATCH', match.matchId);
      setForcedSpectatorMode(match.matchId);
    });
    ch.subscribe();
    liveChannelRef.current = ch;

    // Poll localStorage for transfer_accepted flag (same-device / reliable fallback)
    // BUT skip if THIS device is the new scorer (receiver) — check I_AM_SCORER flag
    const transferPollId = setInterval(() => {
      // If this device just accepted the transfer (is the new scorer), do NOT switch to spectator
      const scorerFlag = sessionStorage.getItem(`22Y_I_AM_SCORER_${match.matchId}`);
      if (scorerFlag) {
        // Clean up the transfer_accepted flag so it doesn't linger
        localStorage.removeItem(`22Y_TRANSFER_ACCEPTED_${match.matchId}`);
        return; // I am the scorer — do not become spectator
      }

      const flag = localStorage.getItem(`22Y_TRANSFER_ACCEPTED_${match.matchId}`);
      if (flag) {
        try {
          const data = JSON.parse(flag);
          // Only react if accepted within last 60 seconds (avoid stale flags)
          if (data.acceptedAt && Date.now() - data.acceptedAt < 60000) {
            console.log('[MatchCenter] Transfer accepted (localStorage) by:', data.acceptedBy);
            localStorage.removeItem(`22Y_TRANSFER_ACCEPTED_${match.matchId}`);
            // Clear active match so re-mounting shows fresh CONFIG, not old scoreboard
            localStorage.removeItem('22YARDS_ACTIVE_MATCH');
            // Save as followed match so Dugout shows the "Follow Match" shortcut
            localStorage.setItem('22Y_FOLLOWING_MATCH', match.matchId);
            setForcedSpectatorMode(match.matchId);
          } else {
            // Stale flag — clean it up
            localStorage.removeItem(`22Y_TRANSFER_ACCEPTED_${match.matchId}`);
          }
        } catch (_) {
          localStorage.removeItem(`22Y_TRANSFER_ACCEPTED_${match.matchId}`);
        }
      }
    }, 1500);

    return () => {
      clearInterval(transferPollId);
      supabase.removeChannel(ch);
      liveChannelRef.current = null;
    };
  }, [match.matchId]);

  useEffect(() => {
    if (!match.matchId || (status !== 'LIVE' && status !== 'INNINGS_BREAK' && status !== 'COMPLETED' && status !== 'SUMMARY')) return;
    pushLiveMatchState(match);
    liveChannelRef.current?.send({
      type: 'broadcast',
      event: 'score_update',
      payload: match,
    });
  }, [match.liveScore.balls, match.liveScore.wickets, match.currentInnings, status]);

  useEffect(() => {
    if (status === 'SUMMARY' && winnerTeam) {
      persistToGlobalVault(match, winnerTeam.name, winnerTeam.margin);
    }
  }, [status, winnerTeam]);

  // Summary reveal animation sequence
  useEffect(() => {
    if (status !== 'SUMMARY') { setSummaryPhase('SKELETON'); return; }

    // Phase 1: Skeleton shimmer (1.5s)
    setSummaryPhase('SKELETON');
    const t1 = setTimeout(() => setSummaryPhase('COUNTING'), 1500);

    // Phase 2: Counting numbers (1.5s more = 3s total)
    const t2 = setTimeout(() => setSummaryPhase('REVEAL'), 3000);

    // Phase 3: Ready
    const t3 = setTimeout(() => { setSummaryPhase('READY'); setScorecardReady(true); }, 3500);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [status]);

  // Counting animation for runs
  useEffect(() => {
    if (summaryPhase !== 'COUNTING') return;
    const inn1Target = match.config.innings1Score || 0;
    const inn2Target = match.liveScore.runs;
    const duration = 1200;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCountingRuns({
        inn1: Math.round(inn1Target * eased),
        inn2: Math.round(inn2Target * eased),
      });
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [summaryPhase, match.config.innings1Score, match.liveScore.runs]);

  // FIRE MODE + ICE MODE: Monitor CRR during live scoring
  // Activation: CRR >= 15 (fire) or CRR < 4 (ice), both require 6+ legal balls
  // Deactivation: CRR drops below 14 (fire) or rises above 4.5 (ice) for 3 consecutive legal balls
  useEffect(() => {
    if (status !== 'LIVE') return;
    const balls = match.liveScore.balls || 0;
    const crr = balls > 0 ? (match.liveScore.runs / balls) * 6 : 0;

    // FIRE MODE ACTIVATION: CRR >= 15, at least 6 balls bowled
    if (balls >= 6 && crr >= 15 && !fireMode && !fireModeDeclined && !fireModeBanner) {
      if (iceMode) { setIceMode(false); setIceModeDeclined(false); setIceModeBallCount(0); }
      setFireModeBanner(true);
    }

    // FIRE MODE DEACTIVATION CHECK: if CRR bounces back above 14, reset the deactivation counter
    if (fireMode && crr >= 14) {
      setFireModeBallCount(0);
    }

    // ICE MODE ACTIVATION: CRR < 4, at least 6 balls bowled, fire mode not active
    if (balls >= 6 && crr < 4 && crr > 0 && !iceMode && !iceModeDeclined && !iceModeBanner && !fireMode) {
      setIceModeBanner(true);
    }

    // ICE MODE DEACTIVATION CHECK: if CRR drops back below 4.5, reset the deactivation counter
    if (iceMode && crr < 4.5) {
      setIceModeBallCount(0);
    }
  }, [match.liveScore.runs, match.liveScore.balls, status]);

  // Deactivate fire/ice after 3 consecutive legal balls with CRR beyond threshold
  // Ball counting happens in commitBall — only counts when CRR is in the deactivation zone
  useEffect(() => {
    if (fireMode && fireModeBallCount >= 3) {
      setFireMode(false);
      setFireModeBallCount(0);
    }
    if (iceMode && iceModeBallCount >= 3) {
      setIceMode(false);
      setIceModeBallCount(0);
    }
  }, [fireModeBallCount, iceModeBallCount]);

  const getTeamObj = (id: TeamID) => id === 'A' ? match.teams.teamA : match.teams.teamB;
  const getPlayer = (id: PlayerID | null) => {
    if (!id) return null;
    return [...(match.teams.teamA?.squad || []), ...(match.teams.teamB?.squad || [])].find(p => p.id === id) || null;
  };

  const checkTeamConflicts = () => {
    if (!userData?.phone) { setMatch(m => ({ ...m, toss: { winnerId: null, decision: null } })); setStatus('TOSS_FLIP'); return; }

    const globalVault = JSON.parse(localStorage.getItem('22YARDS_GLOBAL_VAULT') || '{}');
    const userVault = globalVault[userData.phone] || { teams: [] };
    const archivedTeams = userVault.teams || [];

    const isUserInA = (match.teams.teamA.squad || []).some(p => p.phone === userData.phone);
    const isUserInB = (match.teams.teamB.squad || []).some(p => p.phone === userData.phone);

    if (isUserInA && !match.teams.teamA.resolutionHandled) {
      const conflictA = archivedTeams.find(t => t.name.toUpperCase() === match.teams.teamA.name.toUpperCase());
      if (conflictA) {
        setSquadConflict({ open: true, teamId: 'A', name: match.teams.teamA.name, existingSquad: conflictA.players || conflictA.squad || [], archivedTeamId: conflictA.id });
        return;
      }
    }

    if (isUserInB && !match.teams.teamB.resolutionHandled) {
      const conflictB = archivedTeams.find(t => t.name.toUpperCase() === match.teams.teamB.name.toUpperCase());
      if (conflictB) {
        setSquadConflict({ open: true, teamId: 'B', name: match.teams.teamB.name, existingSquad: conflictB.players || conflictB.squad || [], archivedTeamId: conflictB.id });
        return;
      }
    }

    setMatch(m => ({ ...m, toss: { winnerId: null, decision: null } }));
    setStatus('TOSS_FLIP');
  };

  const handleResolveConflict = (resolveType: 'EXISTING' | 'NEW') => {
    if (!squadConflict) return;

    setMatch(m => {
      const key = squadConflict.teamId === 'A' ? 'teamA' : 'teamB';
      let mergedSquad = m.teams[key].squad || [];

      if (resolveType === 'EXISTING') {
        // ADD TO TEAM: merge archived roster into current squad (dedup by name)
        const archivedPlayers = (squadConflict.existingSquad || []);
        const currentNames = new Set((mergedSquad).map((p: any) => p.name?.toUpperCase()));
        const newFromArchive = archivedPlayers.filter((p: any) => !currentNames.has(p.name?.toUpperCase()));
        mergedSquad = [...mergedSquad, ...newFromArchive.map((p: any) => ({
          ...p,
          // Reset stats for the new match
          runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, wicketType: null,
          overs: 0, oversBowled: 0, runsConceded: 0, wicketsTaken: 0, maidens: 0,
          dotBalls: 0, catches: 0, runOuts: 0, stumpings: 0, extras: 0,
        }))];
      }

      return {
        ...m,
        teams: {
          ...m.teams,
          [key]: {
            ...m.teams[key],
            squad: mergedSquad,
            resolutionMode: resolveType,
            resolutionHandled: true,
            linkedArchivedId: resolveType === 'EXISTING' ? squadConflict.archivedTeamId : null
          }
        }
      };
    });

    setSquadConflict(null);

    // After merge, go to squad selection so user picks playing members
    // For START FRESH, go straight to toss
    if (resolveType === 'EXISTING') {
      // Show squad selection for the merged team — pre-select all
      const teamId = squadConflict.teamId;
      const key = teamId === 'A' ? 'teamA' : 'teamB';
      // Need to get merged squad after setMatch — use setTimeout to read updated state
      setTimeout(() => {
        setMatch(m => {
          const squad = m.teams[key]?.squad || [];
          setSelectedPlayerIds(new Set(squad.map((p: any) => p.id)));
          return m; // no mutation, just reading
        });
        setSquadSelectionSource('CONFLICT');
        setSquadSelectionTeamId(teamId);
      }, 50);
    } else {
      setMatch(m => ({ ...m, toss: { winnerId: null, decision: null } }));
      setStatus('TOSS_FLIP');
    }
  };

  const handleSaveYouTubeConfig = (config: LiveStreamConfig) => {
    setLiveStreamConfig(config);
    setMatch(m => ({
      ...m,
      config: {
        ...m.config,
        youtubeStreamUrl: config.youtubeStreamUrl,
        youtubeEmbedUrl: config.youtubeEmbedUrl,
        rtmpUrl: config.rtmpUrl,
        streamKey: config.streamKey,
      }
    }));
    setShowYouTubeModal(false);
    // Broadcast to spectators
    if (match.matchId) {
      pushLiveMatchState(match);
    }
  };

  const handleScore = (runs: number) => {
    // Race condition guard: block scoring while a ball is being processed
    if (isProcessingBall.current) return;

    if (!match.crease.bowlerId) {
       setSelectionTarget('NEXT_BOWLER');
       return;
    }

    if (!match.crease.strikerId) {
       setSelectionTarget('NEW_BATSMAN');
       return;
    }

    // Block scoring if innings is already over (overs exhausted or all out)
    const battingTeamKey = match.teams.battingTeamId === 'A' ? 'teamA' : 'teamB';
    const squadSize = (match.teams[battingTeamKey]?.squad || []).length;
    const allOutWickets = Math.max(1, Math.min(squadSize - 1, 10));
    const totalOversCompleted = Math.floor(match.liveScore.balls / 6);
    const ballsInCurrentOver = match.liveScore.balls % 6;
    if (match.liveScore.wickets >= allOutWickets) return;
    const _effOversGuard = match.currentInnings === 1
      ? (match.config.reducedOvers1 || match.config.overs)
      : (match.config.reducedOvers2 || match.config.overs);
    if (match.liveScore.balls >= _effOversGuard * 6) return;
    if (match.status === 'COMPLETED' || match.status === 'INNINGS_BREAK') return;

    // Lock scoring
    isProcessingBall.current = true;
    setTimeout(() => { isProcessingBall.current = false; }, 150);

    // Clear any existing overlay animation first to prevent stacking
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
    }
    // Reset overlay before setting new one - forces AnimatePresence to re-trigger
    setOverlayAnim(null);

    // Use requestAnimationFrame to ensure the null state is committed before setting new animation
    requestAnimationFrame(() => {
      if (pendingExtra === 'NB') {
        setOverlayAnim('FREE_HIT');
        overlayTimerRef.current = setTimeout(() => { setOverlayAnim(null); overlayTimerRef.current = null; }, 2500);
      } else if (runs === 4) {
        setOverlayAnim('FOUR');
        overlayTimerRef.current = setTimeout(() => { setOverlayAnim(null); overlayTimerRef.current = null; }, 1500);
      } else if (runs === 6) {
        setOverlayAnim('SIX');
        overlayTimerRef.current = setTimeout(() => { setOverlayAnim(null); overlayTimerRef.current = null; }, 1500);
      }
    });
    commitBall(runs, pendingExtra);
    setPendingExtra(null);
  };

  const handleWicketAction = (type: string, runs = 0) => {
    if (type === 'RETIRED OUT') {
      setWicketWizard({ open: false });
      // Retired Out: mark batsman as out, increment wicket count, no ball bowled, no bowler wicket credit
      setMatch(m => {
        const battingTeamKey = m.teams.battingTeamId === 'A' ? 'teamA' : 'teamB';
        const updatedBattingSquad = (m.teams[battingTeamKey]?.squad || []).map(p => {
          if (p.id === m.crease.strikerId) {
            return { ...p, isOut: true, wicketType: 'RETIRED OUT' };
          }
          return p;
        });
        const newWickets = m.liveScore.wickets + 1;
        const squadSize = (m.teams[battingTeamKey]?.squad || []).length;
        const allOutWickets = Math.max(1, Math.min(squadSize - 1, 10));

        // Check if all out after retired out
        if (newWickets >= allOutWickets) {
          const newLiveScore = { ...m.liveScore, wickets: newWickets };
          const _innEffOvers = m.currentInnings === 1
            ? (m.config.reducedOvers1 || m.config.overs)
            : (m.config.reducedOvers2 || m.config.overs);

          if (m.currentInnings === 1) {
            const newConfig = { ...m.config, innings1Score: newLiveScore.runs, innings1Wickets: newWickets, innings1Balls: newLiveScore.balls, innings1Completed: true };
            setOverlayAnim('INNINGS_BREAK');
            setTimeout(() => { setOverlayAnim(null); setStatus('INNINGS_BREAK'); }, 2000);
            return {
              ...m,
              status: 'INNINGS_BREAK',
              config: newConfig,
              teams: { ...m.teams, [battingTeamKey]: { ...m.teams[battingTeamKey], squad: updatedBattingSquad } },
              liveScore: newLiveScore,
              crease: { ...m.crease, strikerId: null },
            };
          } else {
            // Innings 2 — determine winner
            const inn1Score = m.config.innings1Score || 0;
            const inn2Score = newLiveScore.runs;
            const battingTeamName = getTeamObj(m.teams.battingTeamId)?.name || 'Team';
            const bowlingTeamName = getTeamObj(m.teams.bowlingTeamId)?.name || 'Team';
            if (inn2Score >= (m.config.target || inn1Score + 1)) {
              const wicketsLeft = Math.max(0, allOutWickets - newWickets);
              setWinnerTeam({ name: battingTeamName, id: m.teams.battingTeamId, margin: `Won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}` });
            } else if (inn2Score === inn1Score) {
              setShowSuperOverPrompt(true);
            } else {
              const runDiff = inn1Score - inn2Score;
              setWinnerTeam({ name: bowlingTeamName, id: m.teams.bowlingTeamId, margin: `Won by ${runDiff} run${runDiff !== 1 ? 's' : ''}` });
            }
            setTimeout(() => setStatus('SUMMARY'), 100);
            return {
              ...m,
              status: 'COMPLETED',
              teams: { ...m.teams, [battingTeamKey]: { ...m.teams[battingTeamKey], squad: updatedBattingSquad } },
              liveScore: newLiveScore,
              crease: { ...m.crease, strikerId: null },
            };
          }
        }

        // Not all out — select new batsman
        return {
          ...m,
          teams: { ...m.teams, [battingTeamKey]: { ...m.teams[battingTeamKey], squad: updatedBattingSquad } },
          liveScore: { ...m.liveScore, wickets: newWickets },
          crease: { ...m.crease, strikerId: null },
        };
      });
      setTimeout(() => setSelectionTarget('NEW_BATSMAN'), 50);
      return;
    }

    if (type === 'CAUGHT' || type === 'RUN OUT') {
      setWicketWizard({ open: false, type: type });
      setSelectionTarget('FIELDER');
      return;
    }

    if (type === 'STUMPED') {
      const bowlingKey = match.teams.bowlingTeamId === 'A' ? 'teamA' : 'teamB';
      const wk = (match.teams[bowlingKey]?.squad || []).find(p => p.isWicketKeeper);
      setWicketWizard({ open: false });

      if (wk) {
        setMatch(m => {
          const bKey = m.teams.bowlingTeamId === 'A' ? 'teamA' : 'teamB';
          const updatedBowlingSquad = (m.teams[bKey]?.squad || []).map(p => {
            if (p.id === wk.id) return { ...p, stumpings: (p.stumpings || 0) + 1 };
            return p;
          });
          return { ...m, teams: { ...m.teams, [bKey]: { ...m.teams[bKey], squad: updatedBowlingSquad } } };
        });
        commitBall(0, pendingExtra || undefined, true, 'STUMPED', wk.id);
        setPendingExtra(null);
      } else {
        setWicketWizard({ open: false, type: 'STUMPED' });
        setSelectionTarget('FIELDER');
      }
      return;
    }

    setWicketWizard({ open: false });
    commitBall(runs, pendingExtra || undefined, true, type);
    setPendingExtra(null);
  };

  const handleFielderSelected = (fielderId: PlayerID) => {
    const wType = wicketWizard.type;
    setSelectionTarget(null);
    setMatch(m => {
      const bowlingKey = m.teams.bowlingTeamId === 'A' ? 'teamA' : 'teamB';
      const updatedBowlingSquad = (m.teams[bowlingKey]?.squad || []).map(p => {
        if (p.id === fielderId) {
            if (wType === 'CAUGHT') return { ...p, catches: (p.catches || 0) + 1 };
            if (wType === 'RUN OUT') return { ...p, run_outs: (p.run_outs || 0) + 1 };
            if (wType === 'STUMPED') return { ...p, stumpings: (p.stumpings || 0) + 1 };
        }
        return p;
      });
      return { ...m, teams: { ...m.teams, [bowlingKey]: { ...m.teams[bowlingKey], squad: updatedBowlingSquad } } };
    });
    commitBall(0, pendingExtra || undefined, true, wType, fielderId);
    setPendingExtra(null);
  };

  const handleUndo = () => {
    if (!match.history || match.history.length === 0) return;

    setMatch(m => {
      const lastBall = m.history[m.history.length - 1];
      if (!lastBall) return m;

      const battingTeamKey = m.teams.battingTeamId === 'A' ? 'teamA' : 'teamB';
      const bowlingTeamKey = m.teams.bowlingTeamId === 'A' ? 'teamA' : 'teamB';
      const isLegalDelivery = !lastBall.type || lastBall.type === 'LEGAL' || lastBall.type === 'BYE' || lastBall.type === 'LB';
      const isNoBallOrWide = lastBall.type === 'WD' || lastBall.type === 'NB';

      const updatedBattingSquad = (m.teams[battingTeamKey]?.squad || []).map(p => {
        if (p.id === lastBall.strikerId) {
          return {
            ...p,
            runs: Math.max(0, (p.runs || 0) - (lastBall.type === 'BYE' || lastBall.type === 'LB' ? 0 : (lastBall.runsScored || 0))),
            balls: Math.max(0, (p.balls || 0) - (isLegalDelivery ? 1 : 0)),
            fours: lastBall.runsScored === 4 && lastBall.type !== 'BYE' && lastBall.type !== 'LB' ? Math.max(0, (p.fours || 0) - 1) : (p.fours || 0),
            sixes: lastBall.runsScored === 6 && lastBall.type !== 'BYE' && lastBall.type !== 'LB' ? Math.max(0, (p.sixes || 0) - 1) : (p.sixes || 0),
            isOut: lastBall.isWicket ? false : p.isOut,
            wicketType: lastBall.isWicket ? undefined : p.wicketType,
          };
        }
        return p;
      });

      const updatedBowlingSquad = (m.teams[bowlingTeamKey]?.squad || []).map(p => {
        if (p.id === lastBall.bowlerId) {
          return {
            ...p,
            wickets: lastBall.isWicket ? Math.max(0, (p.wickets || 0) - 1) : (p.wickets || 0),
            runs_conceded: Math.max(0, (p.runs_conceded || 0) - (lastBall.type === 'BYE' || lastBall.type === 'LB' ? 0 : (lastBall.runsScored || 0)) - (isNoBallOrWide ? 1 : 0)),
            balls_bowled: Math.max(0, (p.balls_bowled || 0) - (isLegalDelivery ? 1 : 0)),
          };
        }
        // Reverse fielder stats
        if (lastBall.fielderId && p.id === lastBall.fielderId) {
          return {
            ...p,
            catches: lastBall.wicketType === 'CAUGHT' ? Math.max(0, (p.catches || 0) - 1) : (p.catches || 0),
            run_outs: lastBall.wicketType === 'RUN OUT' ? Math.max(0, (p.run_outs || 0) - 1) : (p.run_outs || 0),
            stumpings: lastBall.wicketType === 'STUMPED' ? Math.max(0, (p.stumpings || 0) - 1) : (p.stumpings || 0),
          };
        }
        return p;
      });

      // Restore crease positions from the ball event
      const restoredCrease = {
        ...m.crease,
        strikerId: lastBall.strikerId,
        nonStrikerId: lastBall.nonStrikerId || m.crease.nonStrikerId,
        bowlerId: lastBall.bowlerId,
      };

      return {
        ...m,
        teams: {
          ...m.teams,
          [battingTeamKey]: { ...m.teams[battingTeamKey], squad: updatedBattingSquad },
          [bowlingTeamKey]: { ...m.teams[bowlingTeamKey], squad: updatedBowlingSquad },
        },
        liveScore: {
          runs: Math.max(0, m.liveScore.runs - (lastBall.runsScored || 0) - (isNoBallOrWide ? 1 : 0)),
          wickets: Math.max(0, m.liveScore.wickets - (lastBall.isWicket ? 1 : 0)),
          balls: Math.max(0, m.liveScore.balls - (isLegalDelivery ? 1 : 0)),
        },
        history: m.history.slice(0, -1),
        crease: restoredCrease,
      };
    });
    // Clear any pending selection targets
    setSelectionTarget(null);
  };

  const persistToGlobalVault = (finalMatchState: MatchState, winnerName = '', winnerMargin = '') => {
    const globalVault = JSON.parse(localStorage.getItem('22YARDS_GLOBAL_VAULT') || '{}');

    const teamA = finalMatchState.teams.teamA;
    const teamB = finalMatchState.teams.teamB;

    const buildMatchRecord = (playerObj: any, playerTeamId: 'A' | 'B') => {
      const myTeamObj = playerTeamId === 'A' ? teamA : teamB;
      const oppTeamObj = playerTeamId === 'A' ? teamB : teamA;

      // Compute innings scores
      const inn1Score = finalMatchState.config.innings1Score || 0;
      const inn1Wickets = finalMatchState.config.innings1Wickets || 0;
      const inn1Balls = finalMatchState.config.innings1Balls || 0;
      const inn2Score = finalMatchState.liveScore.runs;
      const inn2Wickets = finalMatchState.liveScore.wickets;
      const inn2Balls = finalMatchState.liveScore.balls;

      // Which team batted first? bowlingTeamId in final state = team that batted 1st
      const inn1BattingTeamId = finalMatchState.teams.bowlingTeamId;
      const inn1BattingKey = inn1BattingTeamId === 'A' ? 'teamA' : 'teamB';
      const inn1BowlingKey = inn1BattingTeamId === 'A' ? 'teamB' : 'teamA';
      const inn2BattingKey = finalMatchState.teams.battingTeamId === 'A' ? 'teamA' : 'teamB';
      const inn2BowlingKey = finalMatchState.teams.battingTeamId === 'A' ? 'teamB' : 'teamA';

      // Determine if this player's team batted first
      const myTeamBattedFirst = inn1BattingTeamId === playerTeamId;
      const myTeamScore = myTeamBattedFirst ? inn1Score : inn2Score;
      const myTeamWickets = myTeamBattedFirst ? inn1Wickets : inn2Wickets;
      const myTeamBalls = myTeamBattedFirst ? inn1Balls : inn2Balls;
      const oppTeamScore = myTeamBattedFirst ? inn2Score : inn1Score;
      const oppTeamWickets = myTeamBattedFirst ? inn2Wickets : inn1Wickets;
      const oppTeamBalls = myTeamBattedFirst ? inn2Balls : inn1Balls;

      // Result — fix: use actual score comparison, not target-1
      let result = 'DREW';
      if (finalMatchState.status === 'COMPLETED') {
        if (inn2Score > inn1Score) {
          // Chasing team won
          result = finalMatchState.teams.battingTeamId === playerTeamId ? 'WON' : 'LOST';
        } else if (inn2Score === inn1Score) {
          result = 'TIED';
        } else {
          // Defending team won
          result = finalMatchState.teams.bowlingTeamId === playerTeamId ? 'WON' : 'LOST';
        }
      }

      // Not-out detection: player batted but wasn't dismissed
      const notOut = (playerObj.balls > 0 || playerObj.runs > 0) && !playerObj.isOut;

      const formatOvers = (balls: number) => {
        const overs = Math.floor(balls / 6);
        const rem = balls % 6;
        return rem > 0 ? `${overs}.${rem}` : `${overs}`;
      };

      return {
        id: finalMatchState.matchId,
        date: finalMatchState.config.dateTime,
        opponent: oppTeamObj.name,
        result,
        // Player individual stats
        runs: playerObj.runs || 0,
        ballsFaced: playerObj.balls || 0,
        fours: playerObj.fours || 0,
        sixes: playerObj.sixes || 0,
        wicketsTaken: playerObj.wickets || 0,
        runsConceded: playerObj.runs_conceded || 0,
        ballsBowled: playerObj.balls_bowled || 0,
        catches: playerObj.catches || 0,
        stumpings: playerObj.stumpings || 0,
        runOuts: playerObj.run_outs || 0,
        notOut,
        asCaptain: playerObj.isCaptain,
        asKeeper: playerObj.isWicketKeeper,
        matchWon: result === 'WON',
        tossWon: finalMatchState.toss.winnerId === playerTeamId,
        // Team-level scores for Archive display
        myTeamName: myTeamObj.name,
        myTeamScore,
        myTeamWickets,
        myTeamOvers: formatOvers(myTeamBalls),
        oppTeamName: oppTeamObj.name,
        oppTeamScore,
        oppTeamWickets,
        oppTeamOvers: formatOvers(oppTeamBalls),
        matchResult: winnerName ? `${winnerName} - ${winnerMargin}` : result,
        overs: finalMatchState.config.overs,
        // Full scorecard with innings totals
        fullScorecard: {
          // Legacy format (battingTeam/bowlingTeam) — used by Archive.tsx ScorecardView & PDF
          battingTeam: {
            name: finalMatchState.teams[inn1BattingKey].name,
            squad: finalMatchState.teams[inn1BattingKey].squad || [],
          },
          bowlingTeam: {
            name: finalMatchState.teams[inn1BowlingKey].name,
            squad: finalMatchState.teams[inn1BowlingKey].squad || [],
          },
          // New format with per-innings totals
          innings1: {
            teamName: finalMatchState.teams[inn1BattingKey].name,
            batters: finalMatchState.teams[inn1BattingKey].squad || [],
            bowlers: finalMatchState.teams[inn1BowlingKey].squad || [],
            runs: inn1Score,
            wickets: inn1Wickets,
            balls: inn1Balls,
            overs: formatOvers(inn1Balls),
          },
          innings2: {
            teamName: finalMatchState.teams[inn2BattingKey].name,
            batters: finalMatchState.teams[inn2BattingKey].squad || [],
            bowlers: finalMatchState.teams[inn2BowlingKey].squad || [],
            runs: inn2Score,
            wickets: inn2Wickets,
            balls: inn2Balls,
            overs: formatOvers(inn2Balls),
          },
          inn1Total: { runs: inn1Score, wickets: inn1Wickets, balls: inn1Balls },
          inn2Total: { runs: inn2Score, wickets: inn2Wickets, balls: inn2Balls },
          matchResult: winnerName ? `${winnerName} - ${winnerMargin}` : result,
          target: finalMatchState.config.target || inn1Score + 1,
        },
      };
    };

    // Helper: save a match record for a single player by phone
    const saveForPlayer = (playerObj: any, teamId: 'A' | 'B', teamObj: any) => {
      const phone = playerObj.phone;
      if (!phone) return; // skip players without phone numbers

      if (!globalVault[phone]) {
        globalVault[phone] = { history: [], teams: [], name: playerObj.name || '' };
      }

      // Deduplicate — don't add same match twice
      const alreadySaved = globalVault[phone].history.some((h: any) => h.id === finalMatchState.matchId);
      if (!alreadySaved) {
        globalVault[phone].history.push(buildMatchRecord(playerObj, teamId));
      }

      // Upsert team entry for this player
      const existingTeamIdx = globalVault[phone].teams.findIndex(
        (t: any) => t.name.toUpperCase() === teamObj.name.toUpperCase()
      );
      const teamEntry = {
        id: existingTeamIdx >= 0 ? (globalVault[phone].teams[existingTeamIdx].id || `T-${Date.now()}`) : `T-${Date.now()}`,
        name: teamObj.name,
        city: teamObj.city || '',
        players: teamObj.squad || [],
        dateLastPlayed: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
      };
      if (existingTeamIdx >= 0) {
        globalVault[phone].teams[existingTeamIdx] = teamEntry;
      } else {
        globalVault[phone].teams.push(teamEntry);
      }

      // Cloud sync: push to Supabase if connected (fire-and-forget)
      try {
        syncMatchToSupabase(phone, buildMatchRecord(playerObj, teamId), globalVault[phone].history).catch(() => {});
      } catch (_) {}
    };

    // Save for EVERY player in both teams
    (teamA.squad || []).forEach((p: any) => saveForPlayer(p, 'A', teamA));
    (teamB.squad || []).forEach((p: any) => saveForPlayer(p, 'B', teamB));

    localStorage.setItem('22YARDS_GLOBAL_VAULT', JSON.stringify(globalVault));

    // Also save match record to Supabase matches table
    try {
      saveMatchRecord(finalMatchState, winnerName, winnerMargin).catch(() => {});
    } catch (_) {}
  };

  // Strip match-specific stats from players when importing from vault
  const resetPlayerStats = (players: any[]) =>
    players.map(p => ({
      ...p,
      runs: 0, balls: 0, fours: 0, sixes: 0,
      isOut: false, wicketType: undefined,
      wickets: 0, runs_conceded: 0, balls_bowled: 0,
      catches: 0, stumpings: 0, run_outs: 0,
    }));

  const getTeamInitials = (name: string) => {
    const words = name.split(' ');
    return words.length > 1
      ? (words[0][0] + words[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  const getRecentTeams = (): Array<{ name: string; logo?: string; squad: any[] }> => {
    try {
      const globalVault = JSON.parse(localStorage.getItem('22YARDS_GLOBAL_VAULT') || '{}');
      const allTeams: Array<{ name: string; logo?: string; squad: any[] }> = [];
      Object.values(globalVault).forEach((userVault: any) => {
        if (userVault?.teams) {
          userVault.teams.forEach((t: any) => {
            if (t.name && !allTeams.some(existing => existing.name.toUpperCase() === t.name.toUpperCase())) {
              allTeams.push({ name: t.name, logo: t.logo, squad: t.players || t.squad || [] });
            }
          });
        }
      });
      return allTeams;
    } catch { return []; }
  };

  const isConfigValid = () => {
    const hasTeamA = match.teams.teamA.name && match.teams.teamA.squad.length > 0;
    const hasTeamB = match.teams.teamB.name && match.teams.teamB.squad.length > 0;
    const teamACaptain = match.teams.teamA.squad.some(p => p.isCaptain);
    const teamAWK = match.teams.teamA.squad.some(p => p.isWicketKeeper);
    const teamBCaptain = match.teams.teamB.squad.some(p => p.isCaptain);
    const teamBWK = match.teams.teamB.squad.some(p => p.isWicketKeeper);
    return match.config.overs > 0 && hasTeamA && hasTeamB && match.config.matchType && teamACaptain && teamAWK && teamBCaptain && teamBWK;
  };

  const getTeamSetupWarnings = () => {
    const warnings: string[] = [];
    if (match.teams.teamA.squad.length > 0) {
      if (!match.teams.teamA.squad.some(p => p.isCaptain)) warnings.push(`${match.teams.teamA.name || 'Team A'}: No Captain`);
      if (!match.teams.teamA.squad.some(p => p.isWicketKeeper)) warnings.push(`${match.teams.teamA.name || 'Team A'}: No Wicket Keeper`);
    }
    if (match.teams.teamB.squad.length > 0) {
      if (!match.teams.teamB.squad.some(p => p.isCaptain)) warnings.push(`${match.teams.teamB.name || 'Team B'}: No Captain`);
      if (!match.teams.teamB.squad.some(p => p.isWicketKeeper)) warnings.push(`${match.teams.teamB.name || 'Team B'}: No Wicket Keeper`);
    }
    return warnings;
  };

  const commitBall = (runs: number, extra?: string, isWicket?: boolean, wicketType?: string, fielderId?: PlayerID) => {
    setMatch(m => {
      if (!m.crease.strikerId || !m.crease.bowlerId) return m;

      // GUARD: Reject ball if innings is already complete (prevents race condition from queued state updates)
      if (m.status === 'COMPLETED' || m.status === 'INNINGS_BREAK') return m;
      const _bKey = m.teams.battingTeamId === 'A' ? 'teamA' : 'teamB';
      const _sqSize = (m.teams[_bKey]?.squad || []).length;
      const _allOut = Math.max(1, _sqSize - 1);
      if (m.liveScore.wickets >= _allOut) return m;
      const _effOvers = m.currentInnings === 1
        ? (m.config.reducedOvers1 || m.config.overs)
        : (m.config.reducedOvers2 || m.config.overs);
      if (m.liveScore.balls >= _effOvers * 6) return m;

      const battingTeamKey = m.teams.battingTeamId === 'A' ? 'teamA' : 'teamB';
      const bowlingTeamKey = m.teams.bowlingTeamId === 'A' ? 'teamA' : 'teamB';
      const isLegalDelivery = !extra || (extra === 'BYE' || extra === 'LB');
      const isNoBallOrWide = extra === 'WD' || extra === 'NB';

      const updatedBattingSquad = (m.teams[battingTeamKey]?.squad || []).map(p => {
        if (p.id === m.crease.strikerId) {
          return {
            ...p,
            runs: (p.runs || 0) + (extra === 'BYE' || extra === 'LB' ? 0 : runs),
            balls: (p.balls || 0) + (isLegalDelivery ? 1 : 0),
            fours: runs === 4 && extra !== 'BYE' && extra !== 'LB' ? (p.fours || 0) + 1 : (p.fours || 0),
            sixes: runs === 6 && extra !== 'BYE' && extra !== 'LB' ? (p.sixes || 0) + 1 : (p.sixes || 0),
            isOut: isWicket ? true : p.isOut,
            wicketType: isWicket ? wicketType : p.wicketType,
          };
        }
        return p;
      });

      const updatedBowlingSquad = (m.teams[bowlingTeamKey]?.squad || []).map(p => {
        if (p.id === m.crease.bowlerId) {
          return {
            ...p,
            wickets: isWicket ? (p.wickets || 0) + 1 : (p.wickets || 0),
            runs_conceded: (p.runs_conceded || 0) + (extra === 'BYE' || extra === 'LB' ? 0 : runs) + (isNoBallOrWide ? 1 : 0),
            balls_bowled: (p.balls_bowled || 0) + (isLegalDelivery ? 1 : 0),
          };
        }
        return p;
      });

      const newLiveScore = {
        runs: m.liveScore.runs + runs + (isNoBallOrWide ? 1 : 0),
        wickets: m.liveScore.wickets + (isWicket ? 1 : 0),
        balls: m.liveScore.balls + (isLegalDelivery ? 1 : 0),
      };

      const ballEvent: BallEvent = {
        ballId: `${m.matchId}-${m.currentInnings}-${m.history.length}`,
        overNumber: Math.floor(m.liveScore.balls / 6),
        ballNumber: (m.liveScore.balls % 6) + 1,
        bowlerId: m.crease.bowlerId!,
        strikerId: m.crease.strikerId!,
        nonStrikerId: m.crease.nonStrikerId,
        fielderId,
        runsScored: runs,
        totalValue: runs + (isNoBallOrWide ? 1 : 0),
        extras: isNoBallOrWide || extra === 'BYE' || extra === 'LB' ? 1 : 0,
        isWicket: isWicket || false,
        type: extra ? (extra as any) : 'LEGAL',
        zone: undefined,
        wicketType,
        innings: m.currentInnings,
        teamId: m.teams.battingTeamId,
        teamTotalAtThisBall: newLiveScore.runs,
        wicketsAtThisBall: newLiveScore.wickets,
      };

      // --- STRIKE ROTATION ---
      let newStrikerId = m.crease.strikerId;
      let newNonStrikerId = m.crease.nonStrikerId;
      const isOddRuns = runs % 2 === 1;

      // Swap on odd runs (but not if wicket fell — new batsman selection handles that)
      if (isOddRuns && !isWicket) {
        newStrikerId = m.crease.nonStrikerId;
        newNonStrikerId = m.crease.strikerId;
      }

      // --- OVER COMPLETION ---
      const newBallsInOver = newLiveScore.balls % 6;
      const isOverComplete = isLegalDelivery && newBallsInOver === 0 && newLiveScore.balls > 0;

      // Swap at end of over (on top of any odd-run swap)
      if (isOverComplete && !isWicket) {
        const temp = newStrikerId;
        newStrikerId = newNonStrikerId;
        newNonStrikerId = temp;
      }

      // --- INNINGS TRANSITION ---
      const totalOvers = Math.floor(newLiveScore.balls / 6);
      const battingSquadSize = (m.teams[battingTeamKey]?.squad || []).length;
      const allOutWickets = Math.max(1, Math.min(battingSquadSize - 1, 10));
      const _innEffectiveOvers = m.currentInnings === 1
        ? (m.config.reducedOvers1 || m.config.overs)
        : (m.config.reducedOvers2 || m.config.overs);
      const shouldTransition = newLiveScore.wickets >= allOutWickets || (totalOvers >= _innEffectiveOvers && newBallsInOver === 0);

      let newStatus = m.status;
      let newCurrentInnings = m.currentInnings;

      // Save innings 1 data immediately so it survives crashes
      let newConfig = m.config;
      if (shouldTransition && m.currentInnings === 1) {
        newStatus = 'INNINGS_BREAK';
        newCurrentInnings = 1; // stays 1 until user clicks "Start Innings 2"
        newConfig = { ...m.config, innings1Score: newLiveScore.runs, innings1Wickets: newLiveScore.wickets, innings1Balls: newLiveScore.balls, innings1Completed: true };
        setOverlayAnim('INNINGS_BREAK');
        setTimeout(() => { setOverlayAnim(null); setStatus('INNINGS_BREAK'); }, 2000);
      }

      if (shouldTransition && m.currentInnings === 2) {
        newStatus = 'COMPLETED';
        // Determine winner
        const inn1Score = m.config.innings1Score || 0;
        const inn2Score = newLiveScore.runs;
        const battingTeamName = getTeamObj(m.teams.battingTeamId)?.name || 'Team';
        const bowlingTeamName = getTeamObj(m.teams.bowlingTeamId)?.name || 'Team';

        if (inn2Score >= (m.config.target || inn1Score + 1)) {
          const battingTeamKey = m.teams.battingTeamId === 'A' ? 'teamA' : 'teamB';
          const battingSquadSize = (m.teams[battingTeamKey]?.squad || []).length;
          const wicketsLeft = Math.max(0, battingSquadSize - 1 - newLiveScore.wickets);
          setWinnerTeam({ name: battingTeamName, id: m.teams.battingTeamId, margin: `Won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}` });
        } else if (inn2Score === inn1Score) {
          // Match tied — trigger Super Over prompt
          setShowSuperOverPrompt(true);
        } else {
          const runDiff = inn1Score - inn2Score;
          setWinnerTeam({ name: bowlingTeamName, id: m.teams.bowlingTeamId, margin: `Won by ${runDiff} run${runDiff !== 1 ? 's' : ''}` });
        }
        setTimeout(() => setStatus('SUMMARY'), 100);
      }

      // Target chase mid-over
      if (!shouldTransition && m.currentInnings === 2 && m.config.target && newLiveScore.runs >= m.config.target) {
        newStatus = 'COMPLETED';
        const battingTeamName = getTeamObj(m.teams.battingTeamId)?.name || 'Team';
        const _battingTeamKey2 = m.teams.battingTeamId === 'A' ? 'teamA' : 'teamB';
        const _battingSquadSize2 = (m.teams[_battingTeamKey2]?.squad || []).length;
        const wicketsLeft = Math.max(0, _battingSquadSize2 - 1 - newLiveScore.wickets);
        setWinnerTeam({ name: battingTeamName, id: m.teams.battingTeamId, margin: `Won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}` });
        setTimeout(() => setStatus('SUMMARY'), 100);
      }

      // --- NEW BATSMAN after wicket ---
      let newCrease = {
        ...m.crease,
        strikerId: newStrikerId,
        nonStrikerId: newNonStrikerId,
        previousBowlerId: isOverComplete ? m.crease.bowlerId : m.crease.previousBowlerId,
        bowlerId: isOverComplete && newStatus === 'LIVE' ? null : m.crease.bowlerId,
      };

      if (isWicket && newStatus !== 'COMPLETED' && newStatus !== 'INNINGS_BREAK') {
        // Need to select new batsman — set striker to null, will trigger NEW_BATSMAN selection
        newCrease.strikerId = null;
        setTimeout(() => setSelectionTarget('NEW_BATSMAN'), 50);
      }

      // Need new bowler after over completes
      if (isOverComplete && newStatus !== 'COMPLETED' && newStatus !== 'INNINGS_BREAK' && !isWicket) {
        setTimeout(() => setSelectionTarget('NEXT_BOWLER'), 50);
      }

      // If wicket falls ON the last ball of an over, need both new batsman AND new bowler
      if (isWicket && isOverComplete && newStatus !== 'COMPLETED' && newStatus !== 'INNINGS_BREAK') {
        newCrease.bowlerId = null;
        // NEW_BATSMAN first, then NEXT_BOWLER will be triggered after batsman is selected
      }

      return {
        ...m,
        status: newStatus,
        config: newConfig,
        teams: {
          ...m.teams,
          [battingTeamKey]: { ...m.teams[battingTeamKey], squad: updatedBattingSquad },
          [bowlingTeamKey]: { ...m.teams[bowlingTeamKey], squad: updatedBowlingSquad },
        },
        liveScore: newLiveScore,
        history: [...(m.history || []), ballEvent],
        currentInnings: newCurrentInnings,
        crease: newCrease,
      };
    });

    // Track legal balls for fire/ice deactivation — only count when CRR is in the deactivation zone
    if (!extra || extra === 'BYE' || extra === 'LB') {
      // Use post-ball state to check CRR
      const postBalls = (match.liveScore.balls || 0) + 1;
      const postRuns = (match.liveScore.runs || 0) + runs + (0); // extras handled separately
      const postCRR = postBalls > 0 ? (postRuns / postBalls) * 6 : 0;

      // Fire mode: only count balls where CRR < 14 (deactivation zone)
      if (fireMode) {
        if (postCRR < 14) {
          setFireModeBallCount(c => c + 1);
        } else {
          setFireModeBallCount(0); // CRR recovered, reset counter
        }
      }
      // Ice mode: only count balls where CRR > 4.5 (deactivation zone)
      if (iceMode) {
        if (postCRR > 4.5) {
          setIceModeBallCount(c => c + 1);
        } else {
          setIceModeBallCount(0); // CRR dropped back, reset counter
        }
      }
    }
  };

  const getPlayerAvatar = (player: any): string => {
    if (player?.avatar) return player.avatar;
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${player?.id || player?.name || 'unknown'}&backgroundColor=050505`;
  };

  const triggerLogoUpload = (teamId: TeamID) => { setActiveLogoTeamId(teamId); logoInputRef.current?.click(); };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeLogoTeamId) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const logoData = reader.result as string;
        setMatch(m => {
          const key = activeLogoTeamId === 'A' ? 'teamA' : 'teamB';
          return { ...m, teams: { ...m.teams, [key]: { ...m.teams[key], logo: logoData } } };
        });
        setActiveLogoTeamId(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const getWicketDetail = (player, inningsNum) => {
    const outEvent = (match.history || []).find(h => h.innings === inningsNum && h.isWicket && h.strikerId === player.id);
    if (!outEvent) {
        const isBattingNow = status === 'LIVE' && match.currentInnings === inningsNum && (match.crease.strikerId === player.id || match.crease.nonStrikerId === player.id);
        const hasFacedBalls = (player.balls || 0) > 0;
        return (hasFacedBalls || isBattingNow) ? 'not out' : '';
    }
    const bowler = getPlayer(outEvent.bowlerId);
    const bowlerName = bowler ? bowler.name : 'Unknown';
    const fielder = getPlayer(outEvent.fielderId);
    const fielderName = fielder ? fielder.name : '';
    switch(outEvent.wicketType) {
        case 'BOWLED': return `b ${bowlerName}`;
        case 'CAUGHT': return (fielderName && fielderName !== bowlerName) ? `c ${fielderName} b ${bowlerName}` : `c & b ${bowlerName}`;
        case 'LBW': return `lbw b ${bowlerName}`;
        case 'STUMPED': return `st ${fielderName || 'Keeper'} b ${bowlerName}`;
        case 'RUN OUT': return `run out (${fielderName || 'Fielder'})`;
        case 'HIT WICKET': return `hit wicket b ${bowlerName}`;
        case 'RETIRED OUT': return 'retired out';
        default: return `out b ${bowlerName}`;
    }
  };

  const generateShareText = (phase: string) => {
    const battingTeam = getTeamObj(match.teams.battingTeamId);
    const bowlingTeam = getTeamObj(match.teams.bowlingTeamId);
    const overs = Math.floor(match.liveScore.balls / 6);
    const balls = match.liveScore.balls % 6;
    const followUrl = `${window.location.origin}${window.location.pathname}?watch=${match.matchId}`;
    return `${battingTeam.name} ${match.liveScore.runs}/${match.liveScore.wickets} (${overs}.${balls}) vs ${bowlingTeam.name} | 22 Yards\n\n📺 Follow live:\n${followUrl}`;
  };

  const innings1TeamId = match.currentInnings === 1 ? match.teams.battingTeamId : match.teams.bowlingTeamId;
  const innings2TeamId = match.currentInnings === 1 ? match.teams.bowlingTeamId : match.teams.battingTeamId;

  const calculateMOTM = () => {
    const allPlayers = [...(match.teams.teamA.squad || []), ...(match.teams.teamB.squad || [])];
    return allPlayers.reduce((best, p) => {
      const impact = (p.runs || 0) + (p.wickets || 0) * 25 + (p.catches || 0) * 10 + (p.stumpings || 0) * 10 + (p.run_outs || 0) * 10;
      const bestImpact = (best.runs || 0) + (best.wickets || 0) * 25 + (best.catches || 0) * 10 + (best.stumpings || 0) * 10 + (best.run_outs || 0) * 10;
      return impact > bestImpact ? p : best;
    }, allPlayers[0] || {});
  };

  const generateScorecardPDF = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const margin = 12;
      const contentW = pw - 2 * margin;
      let y = 12;

      // Reference template colors
      const headerGreen: [number, number, number] = [112, 159, 93];   // team name bar / FoW header
      const lightGreen: [number, number, number] = [197, 220, 167];   // column header rows
      const borderGray: [number, number, number] = [210, 210, 210];
      const rowDivider: [number, number, number] = [235, 235, 235];
      const textBlack: [number, number, number] = [40, 40, 40];
      const textGray: [number, number, number] = [120, 120, 120];

      const ensureSpace = (needed: number) => {
        if (y + needed > ph - 14) {
          doc.addPage();
          y = 12;
        }
      };

      // Column widths (fractions of contentW)
      // Batsman | R | B | 4s | 6s | SR
      const batCol = [0.48, 0.09, 0.09, 0.10, 0.10, 0.14].map(f => contentW * f);
      // Bowler  | O | M | R | W | ER
      const bowlCol = [0.48, 0.09, 0.09, 0.10, 0.10, 0.14].map(f => contentW * f);

      // Header: thin line → centered title → thin line
      doc.setDrawColor(...borderGray);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pw - margin, y);
      y += 8;

      // Title
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(20);
      doc.setTextColor(...textBlack);
      doc.text(`${match.teams.teamA.name} v/s ${match.teams.teamB.name}`, pw / 2, y, { align: 'center' });
      y += 4;

      doc.line(margin, y, pw - margin, y);
      y += 6;

      // Result line (top-left)
      if (winnerTeam) {
        doc.setFontSize(10);
        doc.setTextColor(...textBlack);
        doc.setFont('helvetica', 'normal');
        doc.text(`${winnerTeam.name} ${winnerTeam.margin}`, margin, y);
        y += 3;
        doc.setDrawColor(...borderGray);
        doc.line(margin, y, pw - margin, y);
        y += 4;
      }

      const renderInnings = (
        battingTeam: any,
        bowlingTeam: any,
        score: number,
        wickets: number,
        balls: number,
        history: any[],
        inningsNum: number,
      ) => {
        const overs = `${Math.floor(balls / 6)}.${balls % 6}`;
        const scoreStr = `${score}-${wickets} (${overs})`;

        // Team name header bar (sage green, white text)
        ensureSpace(10);
        doc.setFillColor(...headerGreen);
        doc.rect(margin, y, contentW, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(battingTeam.name, margin + 2, y + 5);
        doc.text(scoreStr, pw - margin - 2, y + 5, { align: 'right' });
        y += 7;

        // Batting column header (light sage, black text)
        doc.setFillColor(...lightGreen);
        doc.rect(margin, y, contentW, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...textBlack);
        const batHeaders = ['Batsman', 'R', 'B', '4s', '6s', 'SR'];
        let cumX = margin;
        batHeaders.forEach((h, i) => {
          if (i === 0) {
            doc.text(h, margin + 2, y + 4);
          } else {
            const rightEdge = margin + batCol.slice(0, i + 1).reduce((a, b) => a + b, 0) - 2;
            doc.text(h, rightEdge, y + 4, { align: 'right' });
          }
        });
        y += 6;

        // Batter rows — include anyone who batted (faced a ball, scored, got out, or is currently batting)
        const isBattingNow = (p: any) =>
          status === 'LIVE' && match.currentInnings === inningsNum &&
          (match.crease.strikerId === p.id || match.crease.nonStrikerId === p.id);
        const batters = (battingTeam.squad || []).filter((p: any) =>
          (p.runs || 0) > 0 || (p.balls || 0) > 0 || p.isOut || isBattingNow(p)
        );

        batters.forEach((p: any) => {
          const dismissal = getWicketDetail(p, inningsNum);
          const rowH = dismissal ? 10 : 7;
          ensureSpace(rowH + 2);

          // Name
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(...textBlack);
          doc.text(p.name, margin + 2, y + 4);

          // Stats (right-aligned)
          const sr = (p.balls || 0) > 0 ? (((p.runs || 0) / (p.balls || 0)) * 100).toFixed(2) : '0.00';
          const vals = [String(p.runs || 0), String(p.balls || 0), String(p.fours || 0), String(p.sixes || 0), sr];
          vals.forEach((v, i) => {
            const rightEdge = margin + batCol.slice(0, i + 2).reduce((a, b) => a + b, 0) - 2;
            doc.text(v, rightEdge, y + 4, { align: 'right' });
          });

          // Dismissal line (small gray below name)
          if (dismissal) {
            doc.setFontSize(8);
            doc.setTextColor(...textGray);
            doc.text(dismissal, margin + 2, y + 8);
          }

          y += rowH;
          doc.setDrawColor(...rowDivider);
          doc.setLineWidth(0.2);
          doc.line(margin, y, pw - margin, y);
        });

        // Extras row
        const wd = history.filter((b: any) => b.type === 'WD').length;
        const nb = history.filter((b: any) => b.type === 'NB').length;
        const byes = history.filter((b: any) => b.type === 'BYE').reduce((s: number, b: any) => s + (b.runsScored || 0), 0);
        const lbs = history.filter((b: any) => b.type === 'LB').reduce((s: number, b: any) => s + (b.runsScored || 0), 0);
        const totalExtras = wd + nb + byes + lbs;
        ensureSpace(8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...textBlack);
        doc.text('Extras', margin + 2, y + 5);
        doc.text(`(${totalExtras}) ${byes} B, ${lbs} LB, ${wd} WD, ${nb} NB, 0 P`, pw - margin - 2, y + 5, { align: 'right' });
        y += 7;
        doc.setDrawColor(...rowDivider);
        doc.line(margin, y, pw - margin, y);

        // Total row
        const rr = balls > 0 ? ((score / balls) * 6).toFixed(2) : '0.00';
        ensureSpace(8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Total', margin + 2, y + 5);
        doc.text(`${score}-${wickets} (${overs}) ${rr}`, pw - margin - 2, y + 5, { align: 'right' });
        y += 7;
        doc.setDrawColor(...rowDivider);
        doc.line(margin, y, pw - margin, y);

        // Bowler header row (light sage)
        ensureSpace(10);
        doc.setFillColor(...lightGreen);
        doc.rect(margin, y, contentW, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...textBlack);
        const bowlHeaders = ['Bowler', 'O', 'M', 'R', 'W', 'ER'];
        bowlHeaders.forEach((h, i) => {
          if (i === 0) {
            doc.text(h, margin + 2, y + 4);
          } else {
            const rightEdge = margin + bowlCol.slice(0, i + 1).reduce((a, b) => a + b, 0) - 2;
            doc.text(h, rightEdge, y + 4, { align: 'right' });
          }
        });
        y += 6;

        // Bowler rows
        const bowlers = (bowlingTeam.squad || []).filter((p: any) => (p.balls_bowled || 0) > 0);
        bowlers.forEach((p: any) => {
          ensureSpace(8);
          const ov = `${Math.floor((p.balls_bowled || 0) / 6)}.${(p.balls_bowled || 0) % 6}`;
          const econ = (p.balls_bowled || 0) > 0 ? (((p.runs_conceded || 0) / (p.balls_bowled || 0)) * 6).toFixed(2) : '0.00';
          const maidens = p.maidens || 0;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(...textBlack);
          doc.text(p.name, margin + 2, y + 5);
          const vals = [ov, String(maidens), String(p.runs_conceded || 0), String(p.wickets || 0), econ];
          vals.forEach((v, i) => {
            const rightEdge = margin + bowlCol.slice(0, i + 2).reduce((a, b) => a + b, 0) - 2;
            doc.text(v, rightEdge, y + 5, { align: 'right' });
          });
          y += 7;
          doc.setDrawColor(...rowDivider);
          doc.line(margin, y, pw - margin, y);
        });

        // Fall of Wickets
        const fows = history.filter((b: any) => b.isWicket);
        if (fows.length > 0) {
          ensureSpace(10);
          doc.setFillColor(...headerGreen);
          doc.rect(margin, y, contentW, 6, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(255, 255, 255);
          doc.text('Fall of wickets', margin + 2, y + 4);
          doc.text('Score', pw / 2, y + 4, { align: 'center' });
          doc.text('Over', pw - margin - 2, y + 4, { align: 'right' });
          y += 6;

          fows.forEach((b: any, idx: number) => {
            ensureSpace(7);
            const batter = getPlayer(b.strikerId);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...textBlack);
            doc.text(batter?.name || 'Unknown', margin + 2, y + 5);
            doc.text(`${b.teamTotalAtThisBall}/${idx + 1}`, pw / 2, y + 5, { align: 'center' });
            doc.text(`${b.overNumber}.${b.ballNumber}`, pw - margin - 2, y + 5, { align: 'right' });
            y += 7;
            doc.setDrawColor(...rowDivider);
            doc.line(margin, y, pw - margin, y);
          });
        }

        y += 3;
      };

      // Innings 1
      const inn1BattingTeam = getTeamObj(innings1TeamId);
      const inn1BowlingTeam = getTeamObj(innings2TeamId);
      const inn1Score = match.config.innings1Score || 0;
      const inn1Wickets = match.config.innings1Wickets || 0;
      const inn1Balls = match.config.innings1Balls || 0;
      const inn1History = (match.history || []).filter((b: any) => b.innings === 1);
      renderInnings(inn1BattingTeam, inn1BowlingTeam, inn1Score, inn1Wickets, inn1Balls, inn1History, 1);

      // Innings 2 (if played)
      const inn2Played = match.currentInnings === 2 || (match.config?.innings1Score !== undefined && match.liveScore.balls > 0);
      if (inn2Played) {
        const inn2BattingTeam = getTeamObj(match.teams.battingTeamId);
        const inn2BowlingTeam = getTeamObj(match.teams.bowlingTeamId);
        const inn2History = (match.history || []).filter((b: any) => b.innings === 2);
        renderInnings(inn2BattingTeam, inn2BowlingTeam, match.liveScore.runs, match.liveScore.wickets, match.liveScore.balls, inn2History, 2);
      }

      // Man of the Match section
      const motm = calculateMOTM();
      if (motm?.name) {
        ensureSpace(18);
        doc.setFillColor(...headerGreen);
        doc.rect(margin, y, contentW, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text('Man of the Match', margin + 2, y + 5);
        y += 7;

        ensureSpace(8);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...textBlack);
        doc.text(motm.name, margin + 2, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...textGray);
        const motmParts: string[] = [];
        if ((motm.runs || 0) > 0 || (motm.balls || 0) > 0) motmParts.push(`${motm.runs || 0}(${motm.balls || 0})`);
        if ((motm.wickets || 0) > 0) motmParts.push(`${motm.wickets}-${motm.runs_conceded || 0}`);
        if (motmParts.length > 0) {
          doc.text(motmParts.join(' · '), pw - margin - 2, y + 5, { align: 'right' });
        }
        y += 7;
        doc.setDrawColor(...rowDivider);
        doc.line(margin, y, pw - margin, y);
      }

      // Footer: "Powered by 22 Yards"
      const footerY = ph - 8;
      doc.setDrawColor(...borderGray);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 3, pw - margin, footerY - 3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...textGray);
      doc.text('Powered by 22 Yards (www.22yards.app)', pw / 2, footerY, { align: 'center' });

      // Save / share
      const pdfBlob = doc.output('blob');
      const fileName = `${match.teams.teamA.name}_vs_${match.teams.teamB.name}_${Date.now()}.pdf`;

      if (navigator.share && (navigator as any).canShare) {
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if ((navigator as any).canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: '22 Yards Scorecard' });
          setIsCapturing(false);
          return;
        }
      }
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error('PDF generation failed:', e); }
    setIsCapturing(false);
  };


  // Squad Editor Modal Helper Functions
  const handleEnlistNewPlayer = () => {
    if (!editingTeamId || !newName.trim()) return;
    const key = editingTeamId === 'A' ? 'teamA' : 'teamB';
    const newPlayer = {
      id: generatePlayerId(phoneQuery || `${Date.now()}`),
      name: newName.trim(),
      phone: phoneQuery,
      isCaptain: false,
      isWicketKeeper: false,
      runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false,
      wickets: 0, runs_conceded: 0, balls_bowled: 0, catches: 0, stumpings: 0, run_outs: 0,
    };
    setMatch(m => ({
      ...m,
      teams: { ...m.teams, [key]: { ...m.teams[key], squad: [...(m.teams[key].squad || []), newPlayer] } }
    }));
    setNewName('');
    setPhoneQuery('');
    setSelectedVaultPlayer(null);
  };

  // Add player mid-match
  const handleAddPlayerMidMatch = () => {
    if (!addPlayerName.trim() || !showAddPlayer.team) return;
    const teamKey = showAddPlayer.team === 'batting'
      ? (match.teams.battingTeamId === 'A' ? 'teamA' : 'teamB')
      : (match.teams.bowlingTeamId === 'A' ? 'teamA' : 'teamB');
    const newPlayer = {
      id: generatePlayerId(addPlayerPhone || `${Date.now()}`),
      name: addPlayerName.trim(),
      phone: addPlayerPhone.trim(),
      isCaptain: false,
      isWicketKeeper: false,
      runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false,
      wickets: 0, runs_conceded: 0, balls_bowled: 0, catches: 0, stumpings: 0, run_outs: 0,
    };
    setMatch(m => ({
      ...m,
      teams: { ...m.teams, [teamKey]: { ...m.teams[teamKey], squad: [...(m.teams[teamKey].squad || []), newPlayer] } }
    }));
    setAddPlayerName('');
    setAddPlayerPhone('');
    setShowAddPlayer({ open: false, team: null });
  };

  // ABANDON MATCH handler
  const handleAbandonMatch = () => {
    const teamAName = match.teams.teamA?.name || 'Team A';
    const teamBName = match.teams.teamB?.name || 'Team B';
    const reason = abandonReason.trim() || 'Match abandoned';
    setWinnerTeam({ name: 'Match Abandoned', id: null, margin: reason });
    setMatch(m => ({ ...m, status: 'COMPLETED' }));
    setShowMatchSettings(false);
    setAbandonConfirm(false);
    setAbandonReason('');
    setTimeout(() => setStatus('SUMMARY'), 100);
  };

  // SUPER OVER start handler
  const startSuperOver = () => {
    setShowSuperOverPrompt(false);
    const soState = createSuperOverState(match.teams, match.history);
    setSuperOverState(soState);
    setSuperOverPhase('SETUP_TEAM1');
    setMatch(m => ({ ...m, status: 'SUPER_OVER' as any, superOver: soState }));
    setStatus('SUPER_OVER');
  };

  // Super Over: select lineup for a team
  const confirmSuperOverLineup = (teamNumber: 1 | 2) => {
    if (!superOverState) return;
    if (soSelectedBatsmen.length < 2 || !soSelectedBowler) return; // need at least 2 batsmen + bowler (3 max)

    const batsmen = soSelectedBatsmen.slice(0, 3);
    const newState = setSuperOverLineup(superOverState, teamNumber, batsmen, soSelectedBowler);

    // Set crease for first ball — bowler is whoever was just selected
    newState.crease = { strikerId: batsmen[0], nonStrikerId: batsmen[1] || null, bowlerId: soSelectedBowler };

    const transitioned = transitionSuperOverPhase(newState);
    setSuperOverState(transitioned);
    setSuperOverPhase(transitioned.phase);
    setSoSelectedBatsmen([]);
    setSoSelectedBowler(null);
  };

  // Super Over: record a ball
  const recordSuperOverBall = (runs: number, isWicket: boolean = false, type: string = 'LEGAL') => {
    if (!superOverState) return;

    const currentTeam = superOverState.currentBatting;
    const score = currentTeam === 1 ? superOverState.team1Score : superOverState.team2Score;

    const ballEvent = {
      ballNumber: score.balls + 1,
      runs: type === 'WD' || type === 'NB' ? runs + 1 : runs,
      runsScored: runs,
      type,
      wicket: isWicket,
      strikerId: superOverState.crease.strikerId || '',
      bowlerId: superOverState.crease.bowlerId || '',
    };

    const newState = updateSuperOverAfterBall(superOverState, ballEvent);

    // Handle strike rotation on odd runs
    if (runs % 2 === 1 && !isWicket) {
      newState.crease = {
        ...newState.crease,
        strikerId: newState.crease.nonStrikerId,
        nonStrikerId: newState.crease.strikerId,
      };
    }

    // Handle wicket — bring in next batsman
    if (isWicket) {
      const batsmen = currentTeam === 1 ? newState.team1Batsmen : newState.team2Batsmen;
      const history = currentTeam === 1 ? newState.team1History : newState.team2History;
      const outBatsmen = history.filter(b => b.wicket).map(b => b.strikerId);
      const nextBatsman = batsmen.find(b => !outBatsmen.includes(b) && b !== newState.crease.nonStrikerId);
      if (nextBatsman) {
        newState.crease.strikerId = nextBatsman;
      }
    }

    setSuperOverState(newState);
    setSuperOverPhase(newState.phase);

    // Check if we need to transition phase
    if (newState.phase === 'BREAK') {
      // Set up for team 2 batting
      setTimeout(() => setSuperOverPhase('SETUP_TEAM2'), 1500);
    }

    if (newState.phase === 'RESULT') {
      // Determine result
      const result = determineSuperOverResult(newState, match.teams);
      const finalState = { ...newState, result };
      setSuperOverState(finalState);

      if (result.winnerId) {
        // We have a winner — end the match
        const winnerName = result.winner;
        setWinnerTeam({ name: winnerName, id: result.winnerId, margin: `${result.margin} (${result.method})` });
        setMatch(m => ({ ...m, status: 'COMPLETED', superOver: finalState }));
        setTimeout(() => setStatus('SUMMARY'), 2000);
      } else {
        // Super Over tied — ask the scorer whether to play another SO or declare tie (informal games)
        const playAnother = window.confirm(
          `Super Over #${finalState.superOverNumber} tied at ${finalState.team1Score.runs}-${finalState.team1Score.runs}.\n\n` +
          `Per ICC rules, another Super Over must be played until one team wins.\n\n` +
          `OK = Play another Super Over\nCancel = End match as a tie (informal)`
        );
        if (playAnother) {
          const nextSO = createNextSuperOverState(finalState, match.teams);
          setSuperOverState(nextSO);
          setSuperOverPhase('SETUP_TEAM1');
          setMatch(m => ({ ...m, superOver: nextSO }));
          setSoSelectedBatsmen([]);
          setSoSelectedBowler(null);
        } else {
          setWinnerTeam({ name: 'Match Tied', id: null, margin: `Super Over #${finalState.superOverNumber} also tied` });
          setMatch(m => ({ ...m, status: 'COMPLETED', superOver: finalState }));
          setTimeout(() => setStatus('SUMMARY'), 2000);
        }
      }
    }
  };

  // DLS RAIN DELAY handler
  const handleDLSRainDelay = (newOvers: number) => {
    if (!Number.isInteger(newOvers) || newOvers <= 0 || newOvers >= match.config.overs) return;

    const currentInnings = match.currentInnings;
    const legalBalls = match.history.filter(b => b.innings === currentInnings && (b.type === 'LEGAL' || b.type === 'BYE' || b.type === 'LB')).length;
    const oversCompleted = Math.floor(legalBalls / 6);

    // Can't reduce below already completed overs
    if (newOvers <= oversCompleted) return;

    if (currentInnings === 1) {
      // Rain during innings 1: reduce overs for both innings (symmetric rain reduction)
      // Team 2 will also bat for the same reduced overs — no DLS adjustment needed since
      // both teams have the same resources.
      setMatch(m => ({
        ...m,
        config: { ...m.config, reducedOvers1: newOvers, reducedOvers2: newOvers, isRainAffected: true }
      }));
    } else {
      // Rain during innings 2: calculate DLS target
      const inn1Score = match.config.innings1Score || 0;
      const inn1Overs = match.config.overs;
      const inn1Wickets = match.config.innings1Wickets || 0;
      const inn1Balls = match.config.innings1Balls || 0;

      const dlsResult = calculateDLSTarget({
        team1Score: inn1Score,
        team1OversAvailable: inn1Overs,
        team1OversUsed: inn1Balls / 6,
        team1WicketsAtInterruption: inn1Wickets,
        team2OversAvailable: newOvers,
        team2WicketsLost: match.liveScore.wickets,
        team2BallsBowled: match.liveScore.balls,
        matchOvers: inn1Overs,
      });

      setMatch(m => ({
        ...m,
        config: {
          ...m.config,
          reducedOvers2: newOvers,
          isRainAffected: true,
          dlsTarget: dlsResult.revisedTarget,
          target: dlsResult.revisedTarget,
          dlsParScore: dlsResult.parScore,
        }
      }));
    }

    setDlsActive(true);
    setShowDLSModal(false);
    setShowMatchSettings(false);
  };

  const handleSetCaptain = (playerId: PlayerID) => {
    if (!editingTeamId) return;
    const key = editingTeamId === 'A' ? 'teamA' : 'teamB';
    setMatch(m => ({
      ...m,
      teams: {
        ...m.teams,
        [key]: {
          ...m.teams[key],
          squad: (m.teams[key].squad || []).map(p => ({ ...p, isCaptain: p.id === playerId }))
        }
      }
    }));
  };

  const handleSetWicketKeeper = (playerId: PlayerID) => {
    if (!editingTeamId) return;
    const key = editingTeamId === 'A' ? 'teamA' : 'teamB';
    setMatch(m => ({
      ...m,
      teams: {
        ...m.teams,
        [key]: {
          ...m.teams[key],
          squad: (m.teams[key].squad || []).map(p => ({ ...p, isWicketKeeper: p.id === playerId }))
        }
      }
    }));
  };

  const isCaptainSelected = () => {
    if (!editingTeamId) return false;
    const key = editingTeamId === 'A' ? 'teamA' : 'teamB';
    return (match.teams[key]?.squad || []).some(p => p.isCaptain);
  };

  const isWicketKeeperSelected = () => {
    if (!editingTeamId) return false;
    const key = editingTeamId === 'A' ? 'teamA' : 'teamB';
    return (match.teams[key]?.squad || []).some(p => p.isWicketKeeper);
  };

  const handleSelectVaultPlayer = (player: any) => {
    setSelectedVaultPlayer(player);
    setNewName(player.name);
    setPhoneQuery(player.phone || '');
    setShowPlayerDropdown(false);
  };

  const handleClearVaultPlayer = () => {
    setSelectedVaultPlayer(null);
    setNewName('');
    setPhoneQuery('');
  };

  const acquireCameraStream = async (): Promise<MediaStream> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('This browser does not expose camera APIs. Use Chrome, Safari or Firefox over HTTPS.');
    }
    if (!window.isSecureContext) {
      throw new Error('Camera only works on HTTPS. Open the app via its https:// link.');
    }
    // Try rear camera first, then fall back to any camera (desktop/front-only devices)
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 640 } }
      });
    } catch (err: any) {
      if (err && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
        return await navigator.mediaDevices.getUserMedia({ video: true });
      }
      throw err;
    }
  };

  const describeCameraError = (err: any): string => {
    if (!err) return 'Unknown camera error.';
    const name = err.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Permission was blocked. Tap the lock/camera icon in the address bar and allow camera, then retry. On iOS also check Settings → Safari → Camera.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'No camera detected on this device.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Camera is busy in another app (WhatsApp, Zoom, another tab). Close it and retry.';
    }
    if (name === 'OverconstrainedError') {
      return 'No camera matched the requested settings. Retry with any camera.';
    }
    if (name === 'SecurityError') {
      return 'Browser blocked the camera for security. Open over HTTPS and retry.';
    }
    return `Camera error: ${err.message || name || 'unknown'}`;
  };

  const startQRScanner = async () => {
    setQrScanMode('PLAYER');
    setQrScanTargetTeam(null);
    setShowQRScanner(true);
    setQrScanStatus('SCANNING');
    setQrScanError('');
    try {
      const stream = await acquireCameraStream();
      qrStreamRef.current = stream;
      // Wait for the video element to be available in DOM
      setTimeout(() => {
        if (qrVideoRef.current) {
          qrVideoRef.current.srcObject = stream;
          qrVideoRef.current.play();
          // Start scanning loop
          scanQRFrame();
        }
      }, 300);
    } catch (err) {
      setQrScanStatus('ERROR');
      setQrScanError(describeCameraError(err));
    }
  };

  const scanQRFrame = async () => {
    if (!qrVideoRef.current || !qrCanvasRef.current) return;
    const video = qrVideoRef.current;
    const canvas = qrCanvasRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      qrAnimRef.current = requestAnimationFrame(scanQRFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    try {
      const jsQR = (await import('jsqr')).default;
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        try {
          const payload = JSON.parse(code.data);
          if (payload.app === '22YARDS') {
            // TEAM scan mode — import full squad
            if (qrScanMode === 'TEAM' && payload.type === 'TEAM' && Array.isArray(payload.squad)) {
              setQrScanStatus('SUCCESS');
              if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
              const targetTeam = qrScanTargetTeam;
              setTimeout(() => {
                closeQRScanner();
                if (targetTeam) {
                  const key = targetTeam === 'A' ? 'teamA' : 'teamB';
                  const existing = match.teams[key]?.squad?.length || 0;
                  setTeamImportConfirm({
                    open: true,
                    targetTeam,
                    incomingName: payload.name || `TEAM ${targetTeam}`,
                    incomingLogo: payload.logo || '',
                    incomingSquad: payload.squad,
                    existingCount: existing,
                  });
                }
              }, 600);
              return;
            }
            // PLAYER scan mode — fill single player fields
            if (qrScanMode === 'PLAYER' && payload.name) {
              setQrScanStatus('SUCCESS');
              setNewName(payload.name);
              setPhoneQuery(payload.phone || '');
              if (navigator.vibrate) navigator.vibrate(100);
              setTimeout(() => closeQRScanner(), 800);
              return;
            }
          }
        } catch {}
        // Not valid 22YARDS QR for the current mode
        setQrScanStatus('ERROR');
        setQrScanError(
          qrScanMode === 'TEAM'
            ? 'Not a valid 22 Yards team QR code.'
            : 'Not a valid 22 Yards player QR code.'
        );
        setTimeout(() => { setQrScanStatus('SCANNING'); setQrScanError(''); }, 2000);
      }
    } catch {}
    // Continue scanning
    qrAnimRef.current = requestAnimationFrame(scanQRFrame);
  };

  const closeQRScanner = () => {
    // Stop camera stream
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach(t => t.stop());
      qrStreamRef.current = null;
    }
    // Cancel animation frame
    if (qrAnimRef.current) {
      cancelAnimationFrame(qrAnimRef.current);
      qrAnimRef.current = null;
    }
    setShowQRScanner(false);
    setQrScanStatus('SCANNING');
  };

  // ---- Team Share / Import ---------------------------------------------------
  const openTeamShareQR = async (teamId: TeamID) => {
    const key = teamId === 'A' ? 'teamA' : 'teamB';
    const team = match.teams[key];
    if (!team || !team.squad || team.squad.length === 0) {
      alert('Add at least one player before sharing this team.');
      return;
    }
    // Strip match-time fields to keep payload small (QR capacity is limited).
    const slimSquad = team.squad.map((p: any) => ({
      id: p.id,
      name: p.name,
      phone: p.phone || '',
      role: p.role || 'ALLROUNDER',
      battingStyle: p.battingStyle || '',
      bowlingStyle: p.bowlingStyle || '',
      isCaptain: !!p.isCaptain,
      isWicketKeeper: !!p.isWicketKeeper,
    }));
    const payload = JSON.stringify({
      app: '22YARDS',
      type: 'TEAM',
      name: team.name || `TEAM ${teamId}`,
      logo: team.logo || '',
      squad: slimSquad,
    });
    try {
      const QRCode = (await import('qrcode')).default;
      const url = await QRCode.toDataURL(payload, {
        width: 340,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#00F0FF', light: '#020617' },
      });
      setTeamShareModal({ open: true, teamId, qrDataUrl: url });
    } catch (err) {
      alert('Could not generate QR. Try removing team logo (too large to encode).');
    }
  };

  const startTeamImportScanner = async (targetTeam: TeamID) => {
    setQrScanMode('TEAM');
    setQrScanTargetTeam(targetTeam);
    setShowQRScanner(true);
    setQrScanStatus('SCANNING');
    setQrScanError('');
    try {
      const stream = await acquireCameraStream();
      qrStreamRef.current = stream;
      setTimeout(() => {
        if (qrVideoRef.current) {
          qrVideoRef.current.srcObject = stream;
          qrVideoRef.current.play();
          scanQRFrame();
        }
      }, 300);
    } catch (err) {
      setQrScanStatus('ERROR');
      setQrScanError(describeCameraError(err));
    }
  };

  const confirmTeamImport = () => {
    if (!teamImportConfirm.targetTeam) return;
    const key = teamImportConfirm.targetTeam === 'A' ? 'teamA' : 'teamB';
    const hydratedSquad = teamImportConfirm.incomingSquad.map((p: any) => ({
      id: p.id || `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: p.name,
      phone: p.phone || '',
      role: p.role || 'ALLROUNDER',
      battingStyle: p.battingStyle || '',
      bowlingStyle: p.bowlingStyle || '',
      isCaptain: !!p.isCaptain,
      isWicketKeeper: !!p.isWicketKeeper,
      runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissalType: '', dismissedBy: '',
      overs_bowled: 0, balls_bowled: 0, runs_conceded: 0, wickets: 0, maidens: 0,
      catches: 0, stumpings: 0, run_outs: 0,
    }));
    setMatch(m => ({
      ...m,
      teams: {
        ...m.teams,
        [key]: {
          ...m.teams[key],
          name: teamImportConfirm.incomingName,
          logo: teamImportConfirm.incomingLogo || m.teams[key].logo || '',
          squad: hydratedSquad,
        },
      },
    }));
    const importedName = teamImportConfirm.incomingName;
    const importedLogo = teamImportConfirm.incomingLogo;
    setTeamImportConfirm({ open: false, targetTeam: null, incomingName: '', incomingLogo: '', incomingSquad: [], existingCount: 0 });
    // Trigger the "ready for battle" celebration
    setTeamReadyAnimation({ open: true, name: importedName, logo: importedLogo });
    if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 180]);
    setTimeout(() => setTeamReadyAnimation({ open: false, name: '', logo: '' }), 2800);
  };

  const handleShareAction = (action: string) => {
    if (action === 'whatsapp') {
      const text = encodeURIComponent(shareText);
      window.open(`https://wa.me/?text=${text}`);
    } else if (action === 'copy') {
      navigator.clipboard.writeText(shareText);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const MAX_QR_DATA_LENGTH = 2500; // QR server limit ~2953 chars; keep safe margin

  const getQRCodeUrl = (data: string) => {
    if (data.length > MAX_QR_DATA_LENGTH) {
      console.warn(`[22Y] QR data too long (${data.length} chars). QR may fail to generate.`);
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}&bgcolor=ffffff&color=000000&margin=10`;
  };

  const isQRSafe = (data: string) => data.length <= MAX_QR_DATA_LENGTH;

  // Compress match state to a URL-safe base64 string
  const compressMatchState = () => {
    try {
      const matchState = JSON.parse(localStorage.getItem('22YARDS_ACTIVE_MATCH') || '{}');
      // Strip heavy fields to keep QR scannable — keep only what's needed to resume scoring
      const slim = {
        ...matchState,
        // Remove history array items' heavy fields if too many
        history: (matchState.history || []).map((h: any) => ({
          runs: h.runs, extras: h.extras, wicket: h.wicket,
          batsmanId: h.batsmanId, bowlerId: h.bowlerId,
          overNum: h.overNum, ballNum: h.ballNum,
          isBoundary: h.isBoundary, isExtra: h.isExtra,
          extraType: h.extraType, timestamp: h.timestamp
        }))
      };
      const json = JSON.stringify(slim);
      // Use btoa with URI encoding for safety
      const b64 = btoa(unescape(encodeURIComponent(json)));
      return b64;
    } catch (e) {
      console.error('Failed to compress match state:', e);
      return null;
    }
  };

  const getTransferUrl = () => {
    if (!match.matchId) return null;
    const baseUrl = window.location.origin;
    // Use transfer_id — receiver fetches full state from Supabase via App.tsx handler
    return `${baseUrl}?transfer_id=${match.matchId}`;
  };

  const generatePasscode = () => {
    // Generate a 6-digit numeric passcode from matchId
    if (!match.matchId) return '------';
    const hash = match.matchId.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
    return String(Math.abs(hash) % 1000000).padStart(6, '0');
  };

  const getTransferShortUrl = () => {
    if (!match.matchId) return null;
    return window.location.origin + '?transfer_id=' + match.matchId;
  };

  const getSpectatorUrl = () => {
    if (!match.matchId) return null;
    return window.location.origin + '?watch=' + match.matchId;
  };

  const openTransferModal = () => {
    // Push latest state to Supabase before showing transfer QR
    pushLiveMatchState(match);
    setTransferStatus('WAITING');
    setTransferTab('HANDOFF');
    setTransferPasscode(generatePasscode());
    setShowTransferModal(true);
  };

  const handleReceiveTransfer = async (code: string) => {
    setIsReceiving(true);
    setReceiveError('');
    try {
      // Try to find a match whose matchId hashes to this passcode
      // Since we can't reverse the hash, we use the matchId directly from URL or search Supabase
      // For passcode: we store the passcode alongside the match data
      // Actually, we'll look up by passcode in the URL-based approach
      // Passcode entry is just an alternative to QR - it opens the same URL
      setReceiveError('Enter the 6-digit code shown on the scorer\'s device, or scan their QR code.');
      setIsReceiving(false);
    } catch (e) {
      setReceiveError('Transfer failed. Please try again.');
      setIsReceiving(false);
    }
  };

  const copyTransferCode = () => {
    // Not applicable for direct transfer mode
  };

  const copyTransferLink = () => {
    const link = getTransferUrl();
    if (link) {
      navigator.clipboard.writeText(link);
      setTransferLinkCopied(true);
      setTimeout(() => setTransferLinkCopied(false), 2000);
    }
  };

  const isAddPlayerDisabled = !newName.trim() || (phoneQuery.length > 0 && phoneQuery.length !== 10);

  // If another device accepted the transfer, switch to spectator mode
  if (forcedSpectatorMode) {
    return (
      <div className="h-full w-full flex flex-col overflow-hidden relative max-h-[100dvh]">
        <LiveScoreboard matchId={forcedSpectatorMode} />
        {/* Back to Dugout button */}
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => onBack()}
            className="px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-black uppercase tracking-wider hover:bg-black/80 transition-all"
          >
            ← Dugout
          </button>
        </div>
        {/* Button for sender to start a completely new match */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center z-50 px-6">
          <button
            onClick={() => {
              // Reset everything — clear old match, scorer flag, and start fresh
              setForcedSpectatorMode(null);
              sessionStorage.removeItem(`22Y_I_AM_SCORER_${forcedSpectatorMode}`);
              const freshState = createInitialState();
              localStorage.setItem('22YARDS_ACTIVE_MATCH', JSON.stringify(freshState));
              setMatch(freshState);
              setStatus('CONFIG');
              setWinnerTeam(null);
              setSelectionTarget(null);
              setConfigStep(1);
              setVsRevealed(false);
              setOverlayAnim(null);
              setSummaryTab('SUMMARY');
              setFireMode(false);
              setFireModeBanner(false);
              setFireModeDeclined(false);
              setFireModeBallCount(0);
              setIceMode(false);
              setIceModeBanner(false);
              setIceModeDeclined(false);
              setIceModeBallCount(0);
              setSummaryPhase('SKELETON');
              setScorecardReady(false);
              setPendingExtra(null);
            }}
            className="px-6 py-3 rounded-full bg-[#00F0FF]/15 border border-[#00F0FF]/30 text-[#00F0FF] text-[11px] font-black uppercase tracking-wider backdrop-blur-md hover:bg-[#00F0FF]/25 transition-all flex items-center gap-2"
          >
            <Plus size={14} />
            Start New Match
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#050505] text-white flex flex-col overflow-hidden relative font-sans max-h-[100dvh]">
      <input type="file" ref={logoInputRef} onChange={handleLogoFileChange} className="hidden" accept="image/*" />

      {/* HEADER */}
      <div className="main-header h-14 flex items-center px-6 border-b border-white/5 z-[100] shrink-0">
        <button onClick={() => {
          if (status === 'LIVE' || status === 'INNINGS_BREAK' || status === 'OPENERS') {
            setShowLeaveConfirm(true);
            return;
          }
          if (status === 'SUMMARY') {
            localStorage.setItem('22YARDS_ACTIVE_MATCH', JSON.stringify({ ...match, status: 'COMPLETED' }));
          }
          // Clean up scorer flag on navigation away
          if (match.matchId) sessionStorage.removeItem(`22Y_I_AM_SCORER_${match.matchId}`);
          onBack();
        }} className="p-2 -ml-2 text-[#00F0FF] hover:bg-white/5 rounded-full transition-all"><ChevronLeft size={20} /></button>
        <h2 className="ml-4 font-heading text-xl tracking-[0.1em] text-white uppercase italic">
          {status === 'LIVE' ? 'BATTLEFIELD' : status === 'SUMMARY' ? 'ARENA TELEMETRY' : 'MATCH SETUP'}
        </h2>
        <div className="flex-1" />
        {status === 'LIVE' && (
          <div className="flex items-center space-x-1">
            {match.history && match.history.length > 0 && (
              <button
                onClick={() => { setShareText(generateShareText('LIVE')); setShowShareModal(true); }}
                className="p-2 text-[#39FF14] hover:bg-white/5 rounded-full transition-all"
                title="Share live scorecard"
              >
                <Share2 size={18} />
              </button>
            )}
            <button onClick={() => setShowLiveScorecard(true)} className="p-2 text-[#00F0FF]"><ClipboardList size={20} /></button>
            <button onClick={() => setShowMatchSettings(true)} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-full transition-all" title="Match Settings"><Settings size={18} /></button>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
        {/* Overlay Animations */}
        <AnimatePresence>
          {overlayAnim && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[5000] flex items-center justify-center pointer-events-none overflow-hidden"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.7, 0] }}
                transition={{ duration: overlayAnim === 'FREE_HIT' ? 2 : 0.6, repeat: overlayAnim === 'FREE_HIT' ? 1 : 0 }}
                className={`absolute inset-0 ${
                  overlayAnim === 'SIX' ? 'bg-[#FFD600]' :
                  overlayAnim === 'FOUR' ? 'bg-[#BC13FE]' :
                  overlayAnim === 'WICKET' ? 'bg-[#FF003C]' :
                  overlayAnim === 'FREE_HIT' ? 'bg-gradient-to-tr from-[#00F0FF] via-[#FFD600] to-[#00F0FF]' :
                  'bg-[#00F0FF]'
                }`}
              />
              <motion.div
                initial={{ scale: 0.2, rotate: overlayAnim === 'FREE_HIT' ? 12 : -15, filter: 'blur(15px)' }}
                animate={{
                  scale: [1, 1.4, 1],
                  rotate: 0,
                  filter: 'blur(0px)',
                  x: overlayAnim === 'FREE_HIT' ? [0, -15, 15, -15, 15, 0] : 0,
                  y: overlayAnim === 'FREE_HIT' ? [0, 10, -10, 10, -10, 0] : 0
                }}
                exit={{ scale: 3, opacity: 0, filter: 'blur(30px)' }}
                transition={{ type: 'spring', damping: 8, stiffness: 300, duration: overlayAnim === 'FREE_HIT' ? 2 : 0.6 }}
                className="relative z-10 px-6 text-center"
              >
                <h1 className={`font-heading ${overlayAnim === 'INNINGS_BREAK' ? 'text-[80px] sm:text-[100px]' : 'text-[120px] sm:text-[140px]'} italic font-black leading-none drop-shadow-[0_0_40px_rgba(0,0,0,0.6)] ${
                  overlayAnim === 'SIX' ? 'text-[#FFD600]' :
                  overlayAnim === 'FOUR' ? 'text-[#BC13FE]' :
                  overlayAnim === 'WICKET' ? 'text-[#FF003C]' :
                  overlayAnim === 'FREE_HIT' ? 'text-white' :
                  'text-[#00F0FF]'
                }`}>
                  {overlayAnim === 'INNINGS_BREAK' ? 'INNINGS BREAK' : overlayAnim === 'FREE_HIT' ? 'FREE HIT!' : overlayAnim}
                </h1>
                {overlayAnim === 'FREE_HIT' && (
                  <motion.div
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ repeat: Infinity, duration: 0.2 }}
                    className="mt-2 text-[10px] font-black uppercase tracking-[0.8em] text-[#00F0FF]"
                  >
                    DANGER SQUADRON ACTIVE
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CONFIG SCREEN - CRICHEROS STYLE 3-STEP FLOW */}
        {status === 'CONFIG' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <>
              {/* STEP 1: MATCH MODE SELECTION (Individual vs Tournament) */}
              {configStep === 1 && (
                <div
                  className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5 flex flex-col"
                >
                  <div className="space-y-1">
                    <h3 className="font-heading text-2xl uppercase italic text-[#00F0FF]">Match Type</h3>
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.15em]">Choose your match format</p>
                  </div>

                  <div className="space-y-3 flex-1">
                    {/* INDIVIDUAL MATCH CARD */}
                    <motion.button
                      onClick={() => {
                        setMatchMode('INDIVIDUAL');
                        setConfigStep(2);
                      }}
                      whileTap={{ scale: 0.97 }}
                      className={`w-full p-5 rounded-[24px] border-2 transition-all ${
                        matchMode === 'INDIVIDUAL'
                          ? 'bg-[#00F0FF]/10 border-[#00F0FF] shadow-[0_0_30px_rgba(0,240,255,0.2)]'
                          : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-[#00F0FF]/20 border border-[#00F0FF] flex items-center justify-center shrink-0">
                          <Swords size={24} className="text-[#00F0FF]" />
                        </div>
                        <div className="flex-1 text-left">
                          <h4 className="font-heading text-base uppercase italic text-white">Individual Match</h4>
                          <p className="text-[10px] text-white/50 mt-0.5">Standalone friendly game between two teams</p>
                        </div>
                      </div>
                    </motion.button>

                    {/* TOURNAMENT MATCH CARD */}
                    <motion.button
                      onClick={() => {
                        setMatchMode('TOURNAMENT');
                        setConfigStep(2);
                      }}
                      whileTap={{ scale: 0.97 }}
                      className={`w-full p-5 rounded-[24px] border-2 transition-all ${
                        matchMode === 'TOURNAMENT'
                          ? 'bg-[#39FF14]/10 border-[#39FF14] shadow-[0_0_30px_rgba(57,255,20,0.2)]'
                          : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-[#39FF14]/20 border border-[#39FF14] flex items-center justify-center shrink-0">
                          <Trophy size={24} className="text-[#39FF14]" />
                        </div>
                        <div className="flex-1 text-left">
                          <h4 className="font-heading text-base uppercase italic text-white">Tournament Match</h4>
                          <p className="text-[10px] text-white/50 mt-0.5">Linked to a tournament with multiple rounds</p>
                        </div>
                      </div>
                    </motion.button>
                  </div>

                  {/* Tournament selector placeholder (if needed in future) */}
                  {matchMode === 'TOURNAMENT' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Tournament</label>
                        <div className="w-full bg-white/5 border border-white/10 rounded-[20px] p-4 text-white/40 text-sm">
                          Select Tournament (Coming Soon)
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Round</label>
                        <div className="w-full bg-white/5 border border-white/10 rounded-[20px] p-4 text-white/40 text-sm">
                          Select Round (Coming Soon)
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* STEP 2: MATCH DETAILS (Single scrollable screen with all config) */}
              {/* STEP 3: MATCH DETAILS */}
              {configStep === 3 && (
                <div
                  className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4 pb-28"
                >
                  <div className="space-y-1">
                    <h3 className="font-heading text-2xl uppercase italic text-[#00F0FF]">Match Details</h3>
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.15em]">Configure your match</p>
                  </div>

                  {/* MATCH TYPE SELECTOR - Horizontal Pills */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Match Type</label>
                    <div className="flex flex-wrap gap-2">
                      {['LIMITED_OVERS', 'TEST', 'BOX_CRICKET', 'PAIRS_CRICKET'].map((type) => (
                        <motion.button
                          key={type}
                          onClick={() => {
                            setMatch(m => ({ ...m, config: { ...m.config, matchType: type } }));
                            if (type === 'BOX_CRICKET') {
                              setShowCustomRules(true);
                            }
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all ${
                            match.config.matchType === type
                              ? 'bg-[#00F0FF] text-black shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                              : 'bg-white/5 border border-white/10 text-white hover:border-white/20'
                          }`}
                        >
                          {type.replace('_', ' ')}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* CUSTOM MATCH RULES - Collapsible */}
                  <motion.div className="border border-white/10 rounded-[24px] overflow-hidden">
                    <motion.button
                      onClick={() => setShowCustomRules(!showCustomRules)}
                      className="w-full p-4 bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-between transition-all"
                    >
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Custom Match Rules</span>
                      <motion.div
                        animate={{ rotate: showCustomRules ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown size={16} className="text-white/40" />
                      </motion.div>
                    </motion.button>
                    <AnimatePresence>
                      {showCustomRules && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="bg-black/40 border-t border-white/5 p-4 space-y-4"
                        >
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Minus Runs Per Wicket</label>
                            <input
                              type="number"
                              placeholder="-5"
                              // @ts-nocheck - store as custom field
                              value={match.config.minusRunsPerWicket || '-5'}
                              onChange={(e) => setMatch(m => ({ ...m, config: { ...m.config, minusRunsPerWicket: e.target.value } }))}
                              className="w-full bg-white/5 border border-white/10 rounded-[20px] p-3 text-white font-bold text-center outline-none focus:border-[#00F0FF]/40"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Any Other Rules</label>
                            <input
                              type="text"
                              placeholder="E.g., No wides, Boundary line rule..."
                              // @ts-nocheck
                              value={match.config.customRules || ''}
                              onChange={(e) => setMatch(m => ({ ...m, config: { ...m.config, customRules: e.target.value } }))}
                              className="w-full bg-white/5 border border-white/10 rounded-[20px] p-3 text-white font-bold outline-none focus:border-[#00F0FF]/40 placeholder:text-white/25"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* NUMBER OF OVERS - Input with Quick Presets */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Number of Overs</label>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {[5, 10, 15, 20, 50].map((preset) => (
                        <motion.button
                          key={preset}
                          onClick={() => setMatch(m => ({ ...m, config: { ...m.config, overs: preset } }))}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                            match.config.overs === preset
                              ? 'bg-[#00F0FF] text-black shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                              : 'bg-white/5 border border-white/10 text-white hover:border-white/20'
                          }`}
                        >
                          {preset}
                        </motion.button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={match.config.overs}
                      onChange={(e) => setMatch(m => ({ ...m, config: { ...m.config, overs: parseInt(e.target.value) || 0 } }))}
                      className="w-full bg-white/5 border border-white/10 rounded-[20px] p-3 text-white font-bold text-center outline-none focus:border-[#00F0FF]/40"
                      placeholder="Enter overs"
                    />
                  </div>

                  {/* MAX OVERS PER BOWLER */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Max Overs Per Bowler</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={match.config.oversPerBowler}
                      onChange={(e) => setMatch(m => ({ ...m, config: { ...m.config, oversPerBowler: parseInt(e.target.value) || 0 } }))}
                      className="w-full bg-white/5 border border-white/10 rounded-[20px] p-3 text-white font-bold text-center outline-none focus:border-[#00F0FF]/40"
                    />
                  </div>

                  {/* BALL TYPE - Horizontal Pills */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Ball Type</label>
                    <div className="flex gap-2 flex-wrap">
                      {['TENNIS', 'LEATHER', 'OTHER'].map((type) => (
                        <motion.button
                          key={type}
                          onClick={() => setMatch(m => ({ ...m, config: { ...m.config, ballType: type } }))}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all ${
                            match.config.ballType === type
                              ? 'bg-[#00F0FF] text-black shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                              : 'bg-white/5 border border-white/10 text-white hover:border-white/20'
                          }`}
                        >
                          {type}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* PITCH TYPE - Horizontal Pills */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Pitch Type</label>
                    <div className="flex gap-2 flex-wrap">
                      {['TURF', 'MATTING', 'INDOOR', 'OTHER'].map((type) => (
                        <motion.button
                          key={type}
                          onClick={() => setMatch(m => ({ ...m, config: { ...m.config, pitchType: type } }))}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all ${
                            match.config.pitchType === type
                              ? 'bg-[#00F0FF] text-black shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                              : 'bg-white/5 border border-white/10 text-white hover:border-white/20'
                          }`}
                        >
                          {type}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* GROUND NAME - Search Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Ground Name</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                      <input
                        type="text"
                        value={match.config.ground}
                        onChange={(e) => setMatch(m => ({ ...m, config: { ...m.config, ground: e.target.value } }))}
                        className="w-full bg-white/5 border border-white/10 rounded-[20px] p-3 pl-10 text-white font-bold outline-none focus:border-[#00F0FF]/40 placeholder:text-white/25"
                        placeholder="Search ground or stadium..."
                      />
                    </div>
                  </div>

                  {/* DATE & TIME */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Date & Time</label>
                    <input
                      type="datetime-local"
                      value={match.config.dateTime}
                      onChange={(e) => setMatch(m => ({ ...m, config: { ...m.config, dateTime: e.target.value } }))}
                      className="w-full bg-white/5 border border-white/10 rounded-[20px] p-3 text-white font-bold outline-none focus:border-[#00F0FF]/40"
                    />
                  </div>

                  {/* MATCH OFFICIALS - Collapsible */}
                  <motion.div className="border border-white/10 rounded-[24px] overflow-hidden">
                    <motion.button
                      onClick={() => setShowOfficials(!showOfficials)}
                      className="w-full p-4 bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-between transition-all"
                    >
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Match Officials</span>
                      <motion.div
                        animate={{ rotate: showOfficials ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown size={16} className="text-white/40" />
                      </motion.div>
                    </motion.button>
                    <AnimatePresence>
                      {showOfficials && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="bg-black/40 border-t border-white/5 p-4 space-y-4"
                        >
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Umpire Name</label>
                            <input
                              type="text"
                              placeholder="Enter umpire name"
                              // @ts-nocheck
                              value={match.config.umpireName || ''}
                              onChange={(e) => setMatch(m => ({ ...m, config: { ...m.config, umpireName: e.target.value } }))}
                              className="w-full bg-white/5 border border-white/10 rounded-[20px] p-3 text-white font-bold outline-none focus:border-[#00F0FF]/40 placeholder:text-white/25"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Scorer Name</label>
                            <input
                              type="text"
                              placeholder="Enter scorer name"
                              // @ts-nocheck
                              value={match.config.scorerName || ''}
                              onChange={(e) => setMatch(m => ({ ...m, config: { ...m.config, scorerName: e.target.value } }))}
                              className="w-full bg-white/5 border border-white/10 rounded-[20px] p-3 text-white font-bold outline-none focus:border-[#00F0FF]/40 placeholder:text-white/25"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* TIE-BREAKER METHOD - Horizontal Pills */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Tie-Breaker Method</label>
                    <div className="flex gap-2 flex-wrap">
                      {['SUPER_OVER', 'BOWL_OUT', 'NO_TIEBREAKER'].map((type) => (
                        <motion.button
                          key={type}
                          onClick={() => setMatch(m => ({ ...m, config: { ...m.config, tieBreaker: type } }))}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all ${
                            match.config.tieBreaker === type
                              ? 'bg-[#39FF14] text-black shadow-[0_0_20px_rgba(57,255,20,0.3)]'
                              : 'bg-white/5 border border-white/10 text-white hover:border-white/20'
                          }`}
                        >
                          {type.replace('_', ' ')}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: PREMIUM TEAM SELECTION */}
              {configStep === 2 && (
                <div
                  className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5 pb-28"
                >
                  <div className="space-y-1">
                    <h3 className="font-heading text-2xl uppercase italic text-[#00F0FF]">Team Selection</h3>
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.15em]">Select or create your teams</p>
                  </div>

                  {/* TWO SLEEK TEAM CARDS */}
                  <div className="flex flex-col lg:flex-row gap-0 lg:gap-6">
                    {(['A', 'B'] as const).map((teamId, idx) => {
                      const team = getTeamObj(teamId);
                      const isTeamSelected = !!team.name;

                      return (
                        <React.Fragment key={teamId}>
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="relative flex-1"
                        >
                          <>
                            {!isTeamSelected ? (
                              // EMPTY STATE
                              <div
                                className="relative bg-gradient-to-br from-[#0A0A0A] to-[#111] rounded-[28px] border-2 border-dashed border-white/10 p-8 flex flex-col items-center justify-center hover:border-white/20 transition-all min-h-[160px]"
                              >
                                <div
                                  onClick={() => setTeamDrawer({ open: true, targetTeam: teamId, mode: 'SEARCH' })}
                                  className="absolute inset-0 cursor-pointer active:scale-[0.98] transition-transform"
                                />
                                <motion.div
                                  animate={{ scale: [1, 1.08, 1] }}
                                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                  className="pointer-events-none"
                                >
                                  <Plus size={48} className="text-white/40 mb-4" />
                                </motion.div>
                                <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] pointer-events-none">Tap to select</p>
                                <p className="text-[8px] text-white/25 uppercase tracking-widest small-caps mt-6 absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none">Team {teamId}</p>

                                {/* QUICK IMPORT CHIP — lets opponent team be scanned without picking a team first */}
                                <motion.button
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  whileHover={{ scale: 1.04 }}
                                  whileTap={{ scale: 0.94 }}
                                  onClick={(e) => { e.stopPropagation(); startTeamImportScanner(teamId); }}
                                  className="relative z-10 mt-6 flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF6D00]/10 border border-[#FF6D00]/40 text-[#FF6D00] hover:bg-[#FF6D00]/20 transition-all"
                                >
                                  <motion.span
                                    animate={{ y: [0, -1.5, 0] }}
                                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                                    className="flex"
                                  >
                                    <ScanLine size={13} className="drop-shadow-[0_0_6px_rgba(255,109,0,0.6)]" />
                                  </motion.span>
                                  <span className="text-[9px] font-black uppercase tracking-[0.22em]">Scan Opponent</span>
                                </motion.button>
                              </div>
                            ) : (
                              // FILLED STATE
                              <div
                                className="bg-[#121212] border-2 border-[#39FF14]/30 rounded-[28px] p-5 space-y-3"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center space-x-4 flex-1">
                                    <div className="relative">
                                      {/* Clickable logo — tap to change */}
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setLogoPopupTeamId(logoPopupTeamId === teamId ? null : teamId)}
                                        className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFD600] to-[#FF6D00] flex items-center justify-center font-heading text-xl font-black text-black overflow-hidden shadow-xl relative group"
                                      >
                                        {team.logo ? (
                                          <img src={team.logo} className="w-full h-full object-cover" alt={team.name} />
                                        ) : (
                                          getTeamInitials(team.name)
                                        )}
                                        {/* Always-visible upload badge */}
                                        <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#00F0FF] flex items-center justify-center shadow-lg border-2 border-black z-10">
                                          <Camera size={10} className="text-black" />
                                        </div>
                                      </motion.button>

                                      {/* Logo customization popup */}
                                      <AnimatePresence>
                                        {logoPopupTeamId === teamId && (
                                          <>
                                          {/* Invisible backdrop to catch outside clicks */}
                                          <div className="fixed inset-0 z-40" onClick={() => setLogoPopupTeamId(null)} />
                                          <motion.div
                                            initial={{ opacity: 0, scale: 0.9, y: -5 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: -5 }}
                                            className="absolute top-full left-0 mt-2 z-50 bg-[#1a1a1a] border border-white/20 rounded-2xl p-3 shadow-2xl min-w-[200px]"
                                          >
                                            <p className="text-[9px] font-black text-[#00F0FF] uppercase tracking-[0.2em] mb-2">Team Logo</p>
                                            <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-all mb-2">
                                              <Camera size={14} className="text-[#00F0FF]" />
                                              <span className="text-xs text-white font-bold">Upload Image</span>
                                              <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                  if (e.target.files?.[0]) {
                                                    const reader = new FileReader();
                                                    reader.onload = (event) => {
                                                      const key = teamId === 'A' ? 'teamA' : 'teamB';
                                                      setMatch(m => ({
                                                        ...m,
                                                        teams: {
                                                          ...m.teams,
                                                          [key]: {
                                                            ...m.teams[key],
                                                            logo: event.target?.result as string
                                                          }
                                                        }
                                                      }));
                                                      setLogoPopupTeamId(null);
                                                    };
                                                    reader.readAsDataURL(e.target.files[0]);
                                                  }
                                                }}
                                                className="hidden"
                                              />
                                            </label>
                                            {team.logo && (
                                              <button
                                                onClick={() => {
                                                  const key = teamId === 'A' ? 'teamA' : 'teamB';
                                                  setMatch(m => ({
                                                    ...m,
                                                    teams: { ...m.teams, [key]: { ...m.teams[key], logo: undefined } }
                                                  }));
                                                  setLogoPopupTeamId(null);
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 transition-all text-red-400"
                                              >
                                                <X size={14} />
                                                <span className="text-xs font-bold">Remove Logo</span>
                                              </button>
                                            )}
                                          </motion.div>
                                          </>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      {/* Clickable team name — tap to inline edit */}
                                      {editingTeamNameId === teamId ? (
                                        <input
                                          type="text"
                                          autoFocus
                                          defaultValue={team.name}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
                                              if (val) {
                                                const key = teamId === 'A' ? 'teamA' : 'teamB';
                                                setMatch(m => ({
                                                  ...m,
                                                  teams: { ...m.teams, [key]: { ...m.teams[key], name: val } }
                                                }));
                                              }
                                              setEditingTeamNameId(null);
                                            }
                                            if (e.key === 'Escape') setEditingTeamNameId(null);
                                          }}
                                          onBlur={(e) => {
                                            const val = e.target.value.trim().toUpperCase();
                                            if (val) {
                                              const key = teamId === 'A' ? 'teamA' : 'teamB';
                                              setMatch(m => ({
                                                ...m,
                                                teams: { ...m.teams, [key]: { ...m.teams[key], name: val } }
                                              }));
                                            }
                                            setEditingTeamNameId(null);
                                          }}
                                          className="w-full bg-white/10 border border-[#00F0FF]/40 rounded-xl px-3 py-1.5 text-white font-heading text-lg uppercase italic outline-none focus:border-[#00F0FF] focus:shadow-[0_0_12px_rgba(0,240,255,0.3)]"
                                        />
                                      ) : (
                                        <button
                                          onClick={() => setEditingTeamNameId(teamId)}
                                          className="flex items-center gap-1.5 group w-full"
                                        >
                                          <h4 className="font-heading text-lg uppercase italic text-white truncate group-hover:text-[#00F0FF] transition-colors">{team.name}</h4>
                                          <Edit2 size={12} className="text-white/20 group-hover:text-[#00F0FF] shrink-0 transition-colors" />
                                        </button>
                                      )}
                                      <p className="text-[10px] text-white/40 uppercase tracking-[0.2em]">{(team.squad || []).length} Players</p>
                                    </div>
                                  </div>
                                  <motion.button
                                    onClick={() => setTeamDrawer({ open: true, targetTeam: teamId, mode: 'SEARCH' })}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="text-[#39FF14] text-xs uppercase font-black tracking-[0.1em] py-1 px-2 rounded-full hover:bg-white/5 transition-all"
                                  >
                                    Change
                                  </motion.button>
                                </div>

                                <motion.button
                                  onClick={() => setEditingTeamId(teamId)}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className="w-full py-4 rounded-[24px] bg-[#4DB6AC] text-black font-black uppercase tracking-[0.2em] text-sm shadow-lg"
                                >
                                  Manage Squad
                                </motion.button>

                                {/* SPLIT BUTTON — Share squad / Import opponent */}
                                <div className="relative mt-3 h-[52px] rounded-[18px] overflow-hidden bg-gradient-to-r from-[#00F0FF]/[0.06] via-[#BC13FE]/[0.05] to-[#FF6D00]/[0.06] border border-white/10 backdrop-blur-sm">
                                  {/* Animated shimmer line */}
                                  <motion.div
                                    aria-hidden
                                    className="absolute inset-y-0 w-[40%] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none"
                                    animate={{ x: ['-60%', '260%'] }}
                                    transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
                                  />
                                  <div className="relative flex h-full">
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.97 }}
                                      onClick={() => openTeamShareQR(teamId)}
                                      disabled={(team.squad || []).length === 0}
                                      className="group flex-1 flex items-center justify-center gap-2 text-[#00F0FF] disabled:text-white/20 disabled:pointer-events-none transition-all"
                                    >
                                      <motion.span
                                        whileHover={{ rotate: [0, -8, 8, 0] }}
                                        transition={{ duration: 0.5 }}
                                        className="flex"
                                      >
                                        <QrCode size={16} className="drop-shadow-[0_0_6px_rgba(0,240,255,0.6)]" />
                                      </motion.span>
                                      <span className="text-[10px] font-black uppercase tracking-[0.22em]">Share</span>
                                    </motion.button>
                                    <div className="w-px bg-gradient-to-b from-transparent via-white/20 to-transparent my-2" />
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.97 }}
                                      onClick={() => startTeamImportScanner(teamId)}
                                      className="group flex-1 flex items-center justify-center gap-2 text-[#FF6D00] transition-all"
                                    >
                                      <motion.span
                                        animate={{ y: [0, -1.5, 0] }}
                                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                                        className="flex"
                                      >
                                        <ScanLine size={16} className="drop-shadow-[0_0_6px_rgba(255,109,0,0.6)]" />
                                      </motion.span>
                                      <span className="text-[10px] font-black uppercase tracking-[0.22em]">Import</span>
                                    </motion.button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        </motion.div>
                        {idx === 0 && (
                          <div className="flex justify-center items-center py-3 flex-shrink-0 lg:hidden" style={{minHeight: '62px'}}>
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FFD600] to-[#FF6D00] flex items-center justify-center shadow-[0_0_40px_rgba(255,214,0,0.5)]">
                              <span className="font-heading text-xl text-black font-black italic">VS</span>
                            </div>
                          </div>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* THE VS BADGE */}
                  <div className="relative h-16 flex items-center justify-center">
                    <AnimatePresence>
                      {match.teams.teamA.name && match.teams.teamB.name && (
                        <>
                          <motion.div
                            key="vs-badge-desktop"
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            onAnimationComplete={() => {
                              setVsRevealed(true);
                              try {
                                window.navigator.vibrate?.(50);
                              } catch {}
                            }}
                            className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                          >
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFD600] to-[#FF6D00] flex items-center justify-center shadow-[0_0_40px_rgba(255,214,0,0.5)]">
                              <span className="font-heading text-2xl text-black font-black italic">VS</span>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* THE BOTTOM SHEET DRAWER */}
                  <AnimatePresence>
                    {teamDrawer.open && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9500] bg-black/80 backdrop-blur-sm"
                        onClick={() => setTeamDrawer({ open: false, targetTeam: null, mode: 'SEARCH' })}
                      >
                        <motion.div
                          initial={{ y: '100%' }}
                          animate={{ y: 0 }}
                          exit={{ y: '100%' }}
                          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-0 left-0 right-0 bg-[#0A0A0A] rounded-t-[40px] border-t border-white/10 max-h-[85vh] flex flex-col overflow-hidden"
                        >
                          {/* Drag handle */}
                          <div className="flex justify-center pt-3 pb-2">
                            <div className="w-10 h-1 rounded-full bg-white/20" />
                          </div>

                          {/* SEARCH MODE */}
                          {teamDrawer.mode === 'SEARCH' ? (
                            <div className="flex-1 flex flex-col overflow-hidden">
                              {/* Header */}
                              <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0">
                                <h3 className="font-heading text-2xl uppercase italic text-white">Select Team</h3>
                                <button
                                  onClick={() => setTeamDrawer({ open: false, targetTeam: null, mode: 'SEARCH' })}
                                  className="p-2 text-white/40 hover:text-white transition-colors"
                                >
                                  <X size={20} />
                                </button>
                              </div>

                              {/* Search Input */}
                              <div className="p-6 border-b border-white/10 shrink-0">
                                <div className="relative">
                                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                                  <input
                                    type="text"
                                    placeholder="Search teams..."
                                    value={teamSearchQuery}
                                    onChange={(e) => setTeamSearchQuery(e.target.value)}
                                    autoFocus
                                    className="w-full bg-white/5 border border-white/10 rounded-[20px] pl-12 pr-4 py-3 text-white outline-none focus:border-[#00F0FF]/40 placeholder:text-white/40 text-sm"
                                  />
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 overflow-y-auto no-scrollbar">
                                {(() => {
                                  const recentTeams = getRecentTeams();
                                  const filtered = recentTeams.filter(t =>
                                    t.name.toUpperCase().includes(teamSearchQuery.toUpperCase())
                                  );

                                  if (filtered.length === 0 && teamSearchQuery === '') {
                                    // No recent teams
                                    return (
                                      <div className="p-6 flex flex-col items-center justify-center min-h-[300px]">
                                        <Shield size={48} className="text-white/25 mb-4" />
                                        <p className="text-center text-white/50 text-sm mb-6">No teams yet. Your legacy starts here.</p>
                                        <motion.button
                                          onClick={() => {
                                            setTeamSearchQuery('');
                                            setTeamDrawer({ open: true, targetTeam: teamDrawer.targetTeam, mode: 'CREATE' });
                                          }}
                                          whileHover={{ scale: 1.05 }}
                                          whileTap={{ scale: 0.95 }}
                                          className="flex items-center space-x-2 px-6 py-3 rounded-[20px] bg-[#39FF14] text-black font-black text-sm uppercase tracking-[0.1em]"
                                        >
                                          <Plus size={16} />
                                          <span>Create Your First Team</span>
                                        </motion.button>
                                      </div>
                                    );
                                  }

                                  if (filtered.length === 0) {
                                    return (
                                      <div className="p-6 text-center text-white/40 text-sm">No teams match your search</div>
                                    );
                                  }

                                  return (
                                    <div className="p-6 space-y-3">
                                      {filtered.length > 0 && (
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">
                                          YOUR RECENT TEAMS
                                        </p>
                                      )}
                                      {filtered.map((team) => (
                                        <motion.button
                                          key={team.name}
                                          onClick={() => {
                                            const targetKey = teamDrawer.targetTeam === 'A' ? 'teamA' : 'teamB';
                                            const resetSquad = resetPlayerStats(team.squad || []);
                                            setMatch(m => ({
                                              ...m,
                                              teams: {
                                                ...m.teams,
                                                [targetKey]: {
                                                  ...m.teams[targetKey],
                                                  name: team.name,
                                                  logo: team.logo || '',
                                                  squad: resetSquad
                                                }
                                              }
                                            }));
                                            setTeamSearchQuery('');
                                            setTeamDrawer({ open: false, targetTeam: null, mode: 'SEARCH' });
                                            // Open squad selection if team has 3+ players
                                            if (resetSquad.length >= 3) {
                                              setSelectedPlayerIds(new Set(resetSquad.map((p: any) => p.id)));
                                              setSquadSelectionSource('DRAWER');
                                              setSquadSelectionTeamId(teamDrawer.targetTeam);
                                            }
                                          }}
                                          whileHover={{ scale: 1.02 }}
                                          whileTap={{ scale: 0.98 }}
                                          className="w-full flex items-center space-x-4 p-4 rounded-[24px] bg-white/5 border border-white/10 hover:border-[#39FF14]/40 transition-all"
                                        >
                                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFD600] to-[#FF6D00] flex items-center justify-center font-heading text-sm font-black text-black flex-shrink-0">
                                            {team.logo ? (
                                              <img src={team.logo} className="w-full h-full object-cover rounded-full" alt={team.name} />
                                            ) : (
                                              getTeamInitials(team.name)
                                            )}
                                          </div>
                                          <div className="flex-1 text-left min-w-0">
                                            <p className="font-black text-white text-sm truncate">{team.name}</p>
                                            <p className="text-[10px] text-white/40">{team.squad.length} Players</p>
                                          </div>
                                        </motion.button>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Footer - Create New */}
                              <div className="p-6 border-t border-white/10 shrink-0">
                                <motion.button
                                  onClick={() => {
                                    setTeamSearchQuery('');
                                    setTeamDrawer({ open: true, targetTeam: teamDrawer.targetTeam, mode: 'CREATE' });
                                  }}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className="w-full flex items-center justify-center space-x-2 py-4 rounded-[24px] bg-white/5 border border-white/10 font-black text-white text-sm uppercase tracking-[0.1em] hover:bg-white/10 transition-all"
                                >
                                  <Plus size={16} />
                                  <span>Create New Team</span>
                                </motion.button>
                              </div>
                            </div>
                          ) : (
                            // CREATE MODE
                            <div className="flex-1 flex flex-col overflow-hidden">
                              {/* Header */}
                              <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0">
                                <div className="flex items-center space-x-3">
                                  <button
                                    onClick={() => setTeamDrawer({ open: true, targetTeam: teamDrawer.targetTeam, mode: 'SEARCH' })}
                                    className="p-2 text-white/40 hover:text-white transition-colors"
                                  >
                                    <ChevronLeft size={20} />
                                  </button>
                                  <h3 className="font-heading text-2xl uppercase italic text-white">Create Team</h3>
                                </div>
                                <button
                                  onClick={() => setTeamDrawer({ open: false, targetTeam: null, mode: 'SEARCH' })}
                                  className="p-2 text-white/40 hover:text-white transition-colors"
                                >
                                  <X size={20} />
                                </button>
                              </div>

                              {/* Form */}
                              <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
                                {/* Team Name Input */}
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Team Name</label>
                                  <input
                                    type="text"
                                    placeholder="Enter team name"
                                    value={teamCreateName}
                                    onChange={(e) => setTeamCreateName(e.target.value.toUpperCase())}
                                    autoFocus
                                    className="w-full bg-white/5 border border-white/10 rounded-[20px] px-4 py-3 text-white font-black uppercase outline-none focus:border-[#00F0FF]/40 placeholder:text-white/25 text-sm"
                                  />
                                </div>

                                {/* Logo Upload */}
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Team Logo</label>
                                  <motion.label
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="flex flex-col items-center justify-center p-8 rounded-[24px] border-2 border-dashed border-white/10 cursor-pointer hover:border-white/20 transition-all"
                                  >
                                    <Camera size={32} className="text-white/40 mb-2" />
                                    <p className="text-[10px] text-white/40 uppercase tracking-[0.2em]">Tap to upload logo (optional)</p>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                          const reader = new FileReader();
                                          reader.onload = (event) => {
                                            setMatch(m => ({
                                              ...m,
                                              teams: {
                                                ...m.teams,
                                                [teamDrawer.targetTeam === 'A' ? 'teamA' : 'teamB']: {
                                                  ...m.teams[teamDrawer.targetTeam === 'A' ? 'teamA' : 'teamB'],
                                                  name: teamCreateName,
                                                  logo: event.target?.result as string,
                                                  squad: []
                                                }
                                              }
                                            }));
                                            setTeamCreateName('');
                                            setTeamSearchQuery('');
                                            setTeamDrawer({ open: false, targetTeam: null, mode: 'SEARCH' });
                                          };
                                          reader.readAsDataURL(e.target.files[0]);
                                        }
                                      }}
                                      className="hidden"
                                    />
                                  </motion.label>
                                </div>
                              </div>

                              {/* Footer - Create Button */}
                              <div className="p-6 border-t border-white/10 shrink-0">
                                <motion.button
                                  onClick={() => {
                                    if (teamCreateName.trim()) {
                                      setMatch(m => ({
                                        ...m,
                                        teams: {
                                          ...m.teams,
                                          [teamDrawer.targetTeam === 'A' ? 'teamA' : 'teamB']: {
                                            ...m.teams[teamDrawer.targetTeam === 'A' ? 'teamA' : 'teamB'],
                                            name: teamCreateName,
                                            squad: []
                                          }
                                        }
                                      }));
                                      setTeamCreateName('');
                                      setTeamSearchQuery('');
                                      setTeamDrawer({ open: false, targetTeam: null, mode: 'SEARCH' });
                                    }
                                  }}
                                  disabled={!teamCreateName.trim()}
                                  whileHover={teamCreateName.trim() ? { scale: 1.02 } : {}}
                                  whileTap={teamCreateName.trim() ? { scale: 0.98 } : {}}
                                  className={`w-full py-4 rounded-[24px] font-black uppercase tracking-[0.2em] text-sm transition-all ${
                                    teamCreateName.trim()
                                      ? 'bg-[#39FF14] text-black shadow-[0_0_30px_rgba(57,255,20,0.3)]'
                                      : 'bg-white/5 text-white/40 cursor-not-allowed'
                                  }`}
                                >
                                  Create Team
                                </motion.button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>

            {/* CONFIG FOOTER - NAVIGATION */}
            <div className="p-4 bg-[#050505] border-t border-white/5 z-[200] shrink-0 pb-8 flex gap-3">
              {configStep < 3 ? (
                <motion.button
                  onClick={() => setConfigStep(configStep + 1)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-5 rounded-[20px] bg-[#00F0FF] text-black font-black uppercase tracking-[0.3em] text-sm shadow-[0_0_30px_rgba(0,240,255,0.3)]"
                >
                  Next
                </motion.button>
              ) : (
                <div className="flex-1 flex flex-col gap-2">
                  {!isConfigValid() && getTeamSetupWarnings().length > 0 && (
                    <div className="text-center space-y-1">
                      {getTeamSetupWarnings().map((w, i) => (
                        <p key={i} className="text-[9px] font-black text-[#FF6D00] uppercase tracking-wide">{w}</p>
                      ))}
                      <p className="text-[8px] text-white/30">Tap a team card above → open squad → assign Captain & WK</p>
                    </div>
                  )}
                  <motion.div
                    animate={isConfigValid() ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.4, delay: 0.3 }}
                  >
                    <MotionButton
                      disabled={!isConfigValid()}
                      onClick={checkTeamConflicts}
                      className={`flex-1 py-5 !rounded-[20px] font-black uppercase tracking-[0.2em] text-sm transition-all ${
                        isConfigValid() ? 'bg-[#39FF14] text-black shadow-[0_8px_30px_rgba(57,255,20,0.3)]' : 'bg-white/5 text-white/25'
                      }`}
                    >
                      Proceed to Toss
                    </MotionButton>
                  </motion.div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SQUAD CONFLICT MODAL */}
        <AnimatePresence>
          {squadConflict && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl"
            >
              <motion.div
                initial={{ scale: 0.9, y: 40 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-[48px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)]"
              >
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                  <div className="flex items-center space-x-3">
                    <ShieldAlert size={24} className="text-[#FFD600]" />
                    <h3 className="font-heading text-4xl tracking-tighter uppercase italic">SQUAD RECON</h3>
                  </div>
                </div>
                <div className="p-10 space-y-8">
                  <div className="space-y-4 text-center">
                    <p className="text-[11px] font-black text-[#00F0FF] uppercase tracking-[0.4em]">Conflict Detected</p>
                    <h4 className="font-heading text-5xl uppercase leading-none text-white italic">{squadConflict.name}</h4>
                    <p className="text-[10px] font-black text-white/40 uppercase leading-relaxed tracking-widest">
                      THIS TEAM ALREADY EXISTS IN YOUR CAREER ARCHIVE
                    </p>
                  </div>
                  <div className="p-5 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                    <div className="flex justify-between items-center px-2">
                      <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em]">Archived Roster</span>
                      <span className="text-[9px] font-black text-[#39FF14] uppercase">{(squadConflict.existingSquad || []).length} PERSONNEL</span>
                    </div>
                    <div className="flex -space-x-3 justify-center overflow-hidden py-2">
                      {(squadConflict.existingSquad || []).slice(0, 5).map((p, i) => (
                        <div key={i} className="w-10 h-10 rounded-full border-2 border-black bg-[#111] overflow-hidden">
                          <img src={getPlayerAvatar(p)} className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {squadConflict.existingSquad.length > 5 && (
                        <div className="w-10 h-10 rounded-full border-2 border-black bg-[#111] flex items-center justify-center text-[10px] font-black text-white/40">
                          +{squadConflict.existingSquad.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col space-y-3">
                    <MotionButton
                      onClick={() => handleResolveConflict('EXISTING')}
                      className="w-full bg-[#00F0FF] text-black py-5 !rounded-[24px] font-black tracking-[0.3em]"
                    >
                      ADD TO TEAM
                    </MotionButton>
                    <button
                      onClick={() => handleResolveConflict('NEW')}
                      className="w-full text-white/40 hover:text-white py-4 font-black uppercase text-[9px] tracking-[0.4em] transition-all"
                    >
                      START FRESH
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SQUAD SELECTION MODAL — pick playing members from full roster */}
        <AnimatePresence>
          {squadSelectionTeamId && (() => {
            const key = squadSelectionTeamId === 'A' ? 'teamA' : 'teamB';
            const teamObj = match.teams[key];
            const fullRoster = teamObj?.squad || [];
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-xl"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 40 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-[48px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] max-h-[85vh] flex flex-col"
                >
                  <div className="p-8 border-b border-white/5 bg-white/[0.02] shrink-0">
                    <div className="flex items-center space-x-3">
                      <Users size={24} className="text-[#00F0FF]" />
                      <h3 className="font-heading text-3xl tracking-tighter uppercase italic">SELECT SQUAD</h3>
                    </div>
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] mt-2">
                      {teamObj?.name} · {selectedPlayerIds.size} of {fullRoster.length} selected
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-2">
                    {fullRoster.map((player: any) => {
                      const isSelected = selectedPlayerIds.has(player.id);
                      return (
                        <motion.button
                          key={player.id}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            setSelectedPlayerIds(prev => {
                              const next = new Set(prev);
                              if (next.has(player.id)) next.delete(player.id);
                              else next.add(player.id);
                              return next;
                            });
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                            isSelected
                              ? 'bg-[#00F0FF]/10 border-[#00F0FF]/40'
                              : 'bg-white/[0.03] border-white/[0.06] hover:border-white/15'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden border-2 shrink-0" style={{ borderColor: isSelected ? '#00F0FF' : 'rgba(255,255,255,0.1)' }}>
                            <img src={getPlayerAvatar(player)} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className={`text-sm font-black uppercase truncate ${isSelected ? 'text-[#00F0FF]' : 'text-white'}`}>{player.name}</p>
                            {player.role && <p className="text-[8px] text-white/30 uppercase tracking-wider">{player.role}</p>}
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected ? 'bg-[#00F0FF] border-[#00F0FF]' : 'border-white/20'
                          }`}>
                            {isSelected && <Check size={14} className="text-black" />}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                  <div className="p-6 border-t border-white/5 shrink-0 space-y-3">
                    <button
                      onClick={() => {
                        // Select all
                        setSelectedPlayerIds(new Set(fullRoster.map((p: any) => p.id)));
                      }}
                      className="w-full py-2.5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-white/50 hover:text-white transition-all"
                    >
                      Select All
                    </button>
                    <MotionButton
                      onClick={() => {
                        if (selectedPlayerIds.size < 2) return; // need at least 2
                        // Filter squad to only selected players
                        setMatch(m => {
                          const k = squadSelectionTeamId === 'A' ? 'teamA' : 'teamB';
                          const filteredSquad = (m.teams[k]?.squad || []).filter((p: any) => selectedPlayerIds.has(p.id));
                          return {
                            ...m,
                            teams: { ...m.teams, [k]: { ...m.teams[k], squad: filteredSquad } }
                          };
                        });
                        const source = squadSelectionSource;
                        setSquadSelectionTeamId(null);
                        setSelectedPlayerIds(new Set());

                        if (source === 'CONFLICT') {
                          // Came from ADD TO TEAM conflict flow → check other team or proceed to toss
                          setTimeout(() => checkTeamConflicts(), 100);
                        }
                        // source === 'DRAWER' → just close and return to CONFIG screen (do nothing extra)
                      }}
                      disabled={selectedPlayerIds.size < 2}
                      className={`w-full py-5 !rounded-[24px] font-black tracking-[0.3em] ${
                        selectedPlayerIds.size >= 2
                          ? 'bg-[#00F0FF] text-black'
                          : 'bg-white/10 text-white/30 cursor-not-allowed'
                      }`}
                    >
                      CONFIRM SQUAD ({selectedPlayerIds.size})
                    </MotionButton>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* TOSS SCREEN - 2-step: Who Won → Bat/Bowl → straight to Openers */}
        {status === 'TOSS_FLIP' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
            <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5 pb-20 flex flex-col items-center justify-center">
              <>
                {/* STEP 1: Who won the toss? */}
                {!match.toss.winnerId && (
                  <div className="space-y-4 w-full max-w-sm text-center">
                    <div className="space-y-2">
                      <Coins size={32} className="text-[#FFD600] mx-auto" />
                      <h2 className="font-heading text-2xl uppercase italic text-white">Who Won The Toss?</h2>
                      <p className="text-[10px] text-white/40 uppercase tracking-[0.15em]">Tap the winning team</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMatch(m => ({ ...m, toss: { ...m.toss, winnerId: 'A' } }))}
                      className="w-full p-4 rounded-[20px] bg-gradient-to-r from-[#FFD600]/12 to-[#FFD600]/5 border-2 border-[#FFD600]/50 hover:border-[#FFD600] flex items-center gap-3 transition-all active:scale-[0.97]"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#FFD600]/20 border border-[#FFD600] flex items-center justify-center font-black text-sm text-[#FFD600] shrink-0">
                        A
                      </div>
                      <p className="font-black text-[14px] uppercase text-[#FFD600] text-left truncate">{match.teams.teamA.name}</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMatch(m => ({ ...m, toss: { ...m.toss, winnerId: 'B' } }))}
                      className="w-full p-4 rounded-[20px] bg-gradient-to-r from-[#00F0FF]/12 to-[#00F0FF]/5 border-2 border-[#00F0FF]/50 hover:border-[#00F0FF] flex items-center gap-3 transition-all active:scale-[0.97]"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#00F0FF]/20 border border-[#00F0FF] flex items-center justify-center font-black text-sm text-[#00F0FF] shrink-0">
                        B
                      </div>
                      <p className="font-black text-[14px] uppercase text-[#00F0FF] text-left truncate">{match.teams.teamB.name}</p>
                    </button>
                  </div>
                )}

                {/* STEP 2: Bat or Bowl? → directly goes to Openers */}
                {match.toss.winnerId && (
                  <div className="space-y-4 w-full max-w-sm text-center">
                    <div className="space-y-1">
                      <Trophy size={28} className="text-[#00F0FF] mx-auto" />
                      <h2 className="font-heading text-xl uppercase italic text-white">
                        {getTeamObj(match.toss.winnerId).name}
                      </h2>
                      <p className="text-[11px] font-black text-[#00F0FF] uppercase tracking-[0.15em]">Won the toss!</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const winnerId = match.toss.winnerId;
                        const loserId = winnerId === 'A' ? 'B' : 'A';
                        setMatch(m => ({
                          ...m,
                          status: 'OPENERS',
                          toss: { ...m.toss, decision: 'BAT' },
                          teams: { ...m.teams, battingTeamId: winnerId, bowlingTeamId: loserId }
                        }));
                        setSelectionTarget('STRIKER');
                        setStatus('OPENERS');
                      }}
                      className="w-full p-5 rounded-[20px] bg-gradient-to-r from-[#39FF14]/12 to-[#39FF14]/5 border-2 border-[#39FF14]/50 hover:border-[#39FF14] transition-all space-y-1 active:scale-[0.97]"
                    >
                      <Zap size={22} className="text-[#39FF14] mx-auto" />
                      <p className="font-black text-[14px] text-[#39FF14] uppercase">Bat First</p>
                      <p className="text-[10px] text-white/40">Set the target</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const winnerId = match.toss.winnerId;
                        const loserId = winnerId === 'A' ? 'B' : 'A';
                        setMatch(m => ({
                          ...m,
                          status: 'OPENERS',
                          toss: { ...m.toss, decision: 'BOWL' },
                          teams: { ...m.teams, battingTeamId: loserId, bowlingTeamId: winnerId }
                        }));
                        setSelectionTarget('STRIKER');
                        setStatus('OPENERS');
                      }}
                      className="w-full p-5 rounded-[20px] bg-gradient-to-r from-[#BC13FE]/12 to-[#BC13FE]/5 border-2 border-[#BC13FE]/50 hover:border-[#BC13FE] transition-all space-y-1 active:scale-[0.97]"
                    >
                      <Disc size={22} className="text-[#BC13FE] mx-auto" />
                      <p className="font-black text-[14px] text-[#BC13FE] uppercase">Bowl First</p>
                      <p className="text-[10px] text-white/40">Chase later</p>
                    </button>
                  </div>
                )}
              </>
            </div>
          </div>
        )}

        {/* OPENERS SCREEN */}
        {status === 'OPENERS' && (() => {
          // Safety net: if selectionTarget is null when entering OPENERS, auto-set to STRIKER
          const activeTarget = selectionTarget || 'STRIKER';

          const battingSquad = getTeamObj(match.teams.battingTeamId)?.squad || [];
          const bowlingSquad = getTeamObj(match.teams.bowlingTeamId)?.squad || [];
          const battingTeamName = getTeamObj(match.teams.battingTeamId)?.name || 'Batting';
          const bowlingTeamName = getTeamObj(match.teams.bowlingTeamId)?.name || 'Bowling';

          const stepLabels = [
            { key: 'STRIKER', label: 'Striker', icon: '🏏', desc: 'Opening Strike' },
            { key: 'NON_STRIKER', label: 'Non-Striker', icon: '🛡️', desc: 'Support End' },
            { key: 'BOWLER', label: 'Bowler', icon: '🔥', desc: 'First Over' },
          ];
          const currentStepIdx = stepLabels.findIndex(s => s.key === activeTarget);

          const stepColor = activeTarget === 'BOWLER' ? '#BC13FE' : '#00F0FF';
          const stepGlow = activeTarget === 'BOWLER' ? 'rgba(188,19,254,0.3)' : 'rgba(0,240,255,0.3)';

          return (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto no-scrollbar pb-32">

              {/* ── Hero Banner with animated gradient ── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative overflow-hidden px-6 pt-5 pb-6 openers-hero"
                style={{ background: `linear-gradient(135deg, ${activeTarget === 'BOWLER' ? '#1a0025' : '#001a20'} 0%, #0a0a0a 100%)` }}
              >
                {/* Animated pulse ring behind step number */}
                <motion.div
                  animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute top-4 right-6 w-20 h-20 rounded-full"
                  style={{ border: `2px solid ${stepColor}`, opacity: 0.2 }}
                />
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0, 0.15] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                  className="absolute top-4 right-6 w-20 h-20 rounded-full"
                  style={{ border: `2px solid ${stepColor}` }}
                />

                {/* Step number badge (top-right) */}
                <div className="absolute top-5 right-7 w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: `${stepColor}15`, border: `2px solid ${stepColor}40` }}>
                  <span className="text-2xl">{stepLabels[currentStepIdx]?.icon}</span>
                </div>

                {/* Main title */}
                <motion.div
                  key={activeTarget}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.35em] mb-1" style={{ color: `${stepColor}90` }}>
                    Step {currentStepIdx + 1} of 3
                  </p>
                  <h2 className="font-heading text-3xl uppercase italic text-white leading-none">
                    {activeTarget === 'STRIKER' && 'Pick Striker'}
                    {activeTarget === 'NON_STRIKER' && 'Pick Non-Striker'}
                    {activeTarget === 'BOWLER' && 'Pick Bowler'}
                  </h2>
                  <p className="text-[10px] text-white/40 uppercase tracking-[0.15em] mt-1.5">
                    {activeTarget === 'BOWLER' ? bowlingTeamName : battingTeamName} · {stepLabels[currentStepIdx]?.desc}
                  </p>
                </motion.div>

                {/* ── Step dots (compact, below title) ── */}
                <div className="flex items-center gap-3 mt-5">
                  {stepLabels.map((step, i) => (
                    <div key={step.key} className="flex items-center gap-2">
                      <motion.div
                        animate={i === currentStepIdx ? { scale: [1, 1.15, 1] } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
                        style={{
                          background: i < currentStepIdx ? '#39FF14' : i === currentStepIdx ? stepColor : 'rgba(255,255,255,0.08)',
                          color: i <= currentStepIdx ? '#000' : 'rgba(255,255,255,0.3)',
                          boxShadow: i === currentStepIdx ? `0 0 12px ${stepGlow}` : 'none',
                        }}
                      >
                        {i < currentStepIdx ? '✓' : i + 1}
                      </motion.div>
                      {i < stepLabels.length - 1 && (
                        <div className="w-6 h-0.5 rounded-full" style={{ background: i < currentStepIdx ? '#39FF14' : 'rgba(255,255,255,0.08)' }} />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ── Selected players chips (slide in when picked) ── */}
              <AnimatePresence>
                {(match.crease.strikerId || match.crease.nonStrikerId) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 overflow-hidden"
                  >
                    <div className="flex gap-2 pt-4 pb-2">
                      {match.crease.strikerId && (() => {
                        const p = battingSquad.find(pl => pl.id === match.crease.strikerId);
                        return p ? (
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/30"
                          >
                            <img src={getPlayerAvatar(p)} className="w-6 h-6 rounded-full" />
                            <span className="text-[10px] font-black text-[#39FF14] uppercase">{p.name}</span>
                            <span className="text-[8px] text-[#39FF14]/60">🏏</span>
                          </motion.div>
                        ) : null;
                      })()}
                      {match.crease.nonStrikerId && (() => {
                        const p = battingSquad.find(pl => pl.id === match.crease.nonStrikerId);
                        return p ? (
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/30"
                          >
                            <img src={getPlayerAvatar(p)} className="w-6 h-6 rounded-full" />
                            <span className="text-[10px] font-black text-[#39FF14] uppercase">{p.name}</span>
                            <span className="text-[8px] text-[#39FF14]/60">🛡️</span>
                          </motion.div>
                        ) : null;
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Share buttons (compact row) ── */}
              {(() => {
                const followUrl = `${window.location.origin}${window.location.pathname}?watch=${match.matchId}`;
                const tossWinner = getTeamObj(match.toss.winnerId)?.name || 'Team';
                const decision = match.toss.decision === 'BAT' ? 'bat' : 'bowl';
                return (
                  <div className="flex gap-2 px-6 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        const text = `🏏 Match Starting!\n\n${match.teams.teamA.name} vs ${match.teams.teamB.name}\n${tossWinner} won the toss and elected to ${decision}.\n\n📍 ${match.config.ground || match.config.city}\n\n📺 Follow live:\n${followUrl}`;
                        window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
                      }}
                      className="flex-1 py-3 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Share2 size={14} className="text-[#25D366]" />
                      <span className="text-[10px] font-black text-[#25D366] uppercase tracking-wider">WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(followUrl); }}
                      className="py-3 px-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <ClipboardList size={14} className="text-white/40" />
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-wider">Copy Link</span>
                    </button>
                  </div>
                );
              })()}

              {/* ── Instruction banner (animated) ── */}
              <div className="px-6 pt-5">
                <motion.div
                  key={activeTarget}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: `${stepColor}08`, border: `1px solid ${stepColor}25` }}
                >
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="text-lg shrink-0"
                  >
                    {activeTarget === 'STRIKER' ? '👆' : activeTarget === 'NON_STRIKER' ? '👆' : '🎯'}
                  </motion.div>
                  <p className="text-[11px] font-black uppercase tracking-[0.1em]" style={{ color: stepColor }}>
                    {activeTarget === 'STRIKER' && 'Tap a player to open the innings'}
                    {activeTarget === 'NON_STRIKER' && 'Now pick who stands at the other end'}
                    {activeTarget === 'BOWLER' && 'Select who bowls the first over'}
                  </p>
                </motion.div>
              </div>

              {/* ── Player Cards ── */}
              <div className="px-6 pt-4 space-y-2.5">
                <>
                    <div className="space-y-2.5">
                    {activeTarget === 'STRIKER' && battingSquad.map((player, idx) => (
                      <motion.button
                        key={player.id}
                        type="button"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.06 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          setMatch(m => ({ ...m, crease: { ...m.crease, strikerId: player.id } }));
                          setSelectionTarget('NON_STRIKER');
                        }}
                        className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-[#00F0FF]/40 flex items-center gap-4 transition-colors group relative overflow-hidden"
                      >
                        {/* Hover glow */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: `radial-gradient(circle at 30% 50%, ${stepColor}08, transparent 70%)` }} />
                        <div className="relative">
                          <img src={getPlayerAvatar(player)} className="w-12 h-12 rounded-xl border-2 border-white/10 group-hover:border-[#00F0FF]/40 transition-colors" />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md flex items-center justify-center text-[8px]"
                            style={{ background: `${stepColor}20`, border: `1px solid ${stepColor}40` }}>🏏</div>
                        </div>
                        <div className="flex-1 text-left relative">
                          <p className="font-black text-[14px] text-white uppercase tracking-wide group-hover:text-[#00F0FF] transition-colors">{player.name}</p>
                          {player.phone && <p className="text-[9px] text-white/30 mt-0.5">{player.phone}</p>}
                        </div>
                        <ChevronRight size={16} className="text-white/20 group-hover:text-[#00F0FF] transition-colors" />
                      </motion.button>
                    ))}

                    {activeTarget === 'NON_STRIKER' && battingSquad.filter(p => p.id !== match.crease.strikerId).map((player, idx) => (
                      <motion.button
                        key={player.id}
                        type="button"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.06 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          setMatch(m => ({ ...m, crease: { ...m.crease, nonStrikerId: player.id } }));
                          setSelectionTarget('BOWLER');
                        }}
                        className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-[#00F0FF]/40 flex items-center gap-4 transition-colors group relative overflow-hidden"
                      >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: `radial-gradient(circle at 30% 50%, ${stepColor}08, transparent 70%)` }} />
                        <div className="relative">
                          <img src={getPlayerAvatar(player)} className="w-12 h-12 rounded-xl border-2 border-white/10 group-hover:border-[#00F0FF]/40 transition-colors" />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md flex items-center justify-center text-[8px]"
                            style={{ background: `${stepColor}20`, border: `1px solid ${stepColor}40` }}>🛡️</div>
                        </div>
                        <div className="flex-1 text-left relative">
                          <p className="font-black text-[14px] text-white uppercase tracking-wide group-hover:text-[#00F0FF] transition-colors">{player.name}</p>
                          {player.phone && <p className="text-[9px] text-white/30 mt-0.5">{player.phone}</p>}
                        </div>
                        <ChevronRight size={16} className="text-white/20 group-hover:text-[#00F0FF] transition-colors" />
                      </motion.button>
                    ))}

                    {activeTarget === 'BOWLER' && bowlingSquad.map((player, idx) => (
                      <motion.button
                        key={player.id}
                        type="button"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.06 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          setMatch(m => ({ ...m, status: 'LIVE', crease: { ...m.crease, bowlerId: player.id } }));
                          setSelectionTarget(null);
                          setStatus('LIVE');
                        }}
                        className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-[#BC13FE]/40 flex items-center gap-4 transition-colors group relative overflow-hidden"
                      >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: 'radial-gradient(circle at 30% 50%, rgba(188,19,254,0.05), transparent 70%)' }} />
                        <div className="relative">
                          <img src={getPlayerAvatar(player)} className="w-12 h-12 rounded-xl border-2 border-white/10 group-hover:border-[#BC13FE]/40 transition-colors" />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md flex items-center justify-center text-[8px]"
                            style={{ background: 'rgba(188,19,254,0.15)', border: '1px solid rgba(188,19,254,0.4)' }}>🔥</div>
                        </div>
                        <div className="flex-1 text-left relative">
                          <p className="font-black text-[14px] text-white uppercase tracking-wide group-hover:text-[#BC13FE] transition-colors">{player.name}</p>
                          {player.phone && <p className="text-[9px] text-white/30 mt-0.5">{player.phone}</p>}
                        </div>
                        <ChevronRight size={16} className="text-white/20 group-hover:text-[#BC13FE] transition-colors" />
                      </motion.button>
                    ))}
                  </div>
                </>

                {/* Empty state if no players in squad */}
                {((activeTarget === 'STRIKER' || activeTarget === 'NON_STRIKER') && battingSquad.length === 0) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-10 text-center space-y-3">
                    <Users size={32} className="text-white/20 mx-auto" />
                    <p className="text-[12px] text-white/40 font-black uppercase">No players in batting squad</p>
                    <p className="text-[10px] text-white/30">Go back and add players first</p>
                  </motion.div>
                )}
                {(activeTarget === 'BOWLER' && bowlingSquad.length === 0) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-10 text-center space-y-3">
                    <Users size={32} className="text-white/20 mx-auto" />
                    <p className="text-[12px] text-white/40 font-black uppercase">No players in bowling squad</p>
                    <p className="text-[10px] text-white/30">Go back and add players first</p>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
          );
        })()}

        {/* LIVE SCORING SCREEN */}
        {status === 'LIVE' && (() => {
          const striker = getPlayer(match.crease.strikerId);
          const nonStriker = getPlayer(match.crease.nonStrikerId);
          const bowler = getPlayer(match.crease.bowlerId);
          const battingTeamName = getTeamObj(match.teams.battingTeamId)?.name || 'Batting';
          const bowlingTeamName = getTeamObj(match.teams.bowlingTeamId)?.name || 'Bowling';
          const overs = Math.floor(match.liveScore.balls / 6);
          const ballsInOver = match.liveScore.balls % 6;
          const crr = match.liveScore.balls > 0 ? ((match.liveScore.runs / match.liveScore.balls) * 6).toFixed(2) : '0.00';
          const target = match.config.target || 0;
          const need = target > 0 ? Math.max(0, target - match.liveScore.runs) : 0;
          const _effOversLive = match.currentInnings === 1
            ? (match.config.reducedOvers1 || match.config.overs)
            : (match.config.reducedOvers2 || match.config.overs);
          const ballsRemaining = target > 0 ? Math.max(0, (_effOversLive * 6) - match.liveScore.balls) : 0;
          const rrr = ballsRemaining > 0 && need > 0 ? ((need / ballsRemaining) * 6).toFixed(2) : '0.00';

          // Partnership calculation
          const currentHistory = (match.history || []).filter(b => b.innings === match.currentInnings);
          const lastWicketIdx = [...currentHistory].reverse().findIndex(b => b.isWicket);
          const partnershipBalls = lastWicketIdx >= 0 ? currentHistory.slice(currentHistory.length - lastWicketIdx) : currentHistory;
          const partnershipRuns = partnershipBalls.reduce((sum, b) => sum + (b.runsScored || 0) + (b.type === 'WD' || b.type === 'NB' ? 1 : 0), 0);
          const partnershipBallCount = partnershipBalls.filter(b => !b.type || b.type === 'LEGAL' || b.type === 'BYE' || b.type === 'LB').length;
          const wicketNumber = match.liveScore.wickets + 1;

          // Current over balls display
          const currentOverBalls = (() => {
            const allBalls = currentHistory;
            if (allBalls.length === 0) return [];
            const result = [];
            let legalCount = 0;
            for (let i = allBalls.length - 1; i >= 0; i--) {
              const b = allBalls[i];
              const isLegal = !b.type || b.type === 'LEGAL' || b.type === 'BYE' || b.type === 'LB';
              result.unshift(b);
              if (isLegal) legalCount++;
              if (legalCount >= 6) break;
            }
            return result;
          })();

          // Bowler stats
          const bowlerOvers = bowler ? `${Math.floor((bowler.balls_bowled || 0) / 6)}.${(bowler.balls_bowled || 0) % 6}` : '0.0';
          const bowlerEcon = bowler && (bowler.balls_bowled || 0) > 0 ? (((bowler.runs_conceded || 0) / (bowler.balls_bowled || 0)) * 6).toFixed(1) : '0.0';
          const bowlerMaxOvers = match.config.oversPerBowler || 99;
          const bowlerOversComplete = bowler ? Math.floor((bowler.balls_bowled || 0) / 6) : 0;

          // Striker SR
          const strikerSR = striker && (striker.balls || 0) > 0 ? (((striker.runs || 0) / (striker.balls || 0)) * 100).toFixed(0) : '0';
          const nonStrikerSR = nonStriker && (nonStriker.balls || 0) > 0 ? (((nonStriker.runs || 0) / (nonStriker.balls || 0)) * 100).toFixed(0) : '0';

          return (
            <div className={`flex-1 flex flex-col overflow-hidden relative scoring-page ${fireMode ? 'bg-[#1a0500]' : iceMode ? 'bg-[#000a1a]' : 'bg-black'}`}>
              {/* Fire mode ambient effects */}
              {fireMode && (
                <>
                  <div className="absolute inset-0 z-0 pointer-events-none opacity-20" style={{
                    background: 'radial-gradient(ellipse at bottom, rgba(255,109,0,0.4) 0%, rgba(255,0,60,0.2) 40%, transparent 70%)'
                  }} />
                  <div className="absolute bottom-0 left-0 right-0 h-32 z-0 pointer-events-none opacity-30" style={{
                    background: 'linear-gradient(to top, rgba(255,109,0,0.5), transparent)'
                  }} />
                </>
              )}
              {/* Ice mode ambient effects */}
              {iceMode && (
                <>
                  <div className="absolute inset-0 z-0 pointer-events-none opacity-25" style={{
                    background: 'radial-gradient(ellipse at top, rgba(100,180,255,0.3) 0%, rgba(0,100,200,0.15) 40%, transparent 70%)'
                  }} />
                  <div className="absolute top-0 left-0 right-0 h-40 z-0 pointer-events-none opacity-20" style={{
                    background: 'linear-gradient(to bottom, rgba(100,200,255,0.4), transparent)'
                  }} />
                  <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L30 60M0 30L60 30M8.8 8.8L51.2 51.2M51.2 8.8L8.8 51.2' stroke='%2380D0FF' stroke-width='0.5'/%3E%3C/svg%3E")`,
                    backgroundSize: '30px 30px'
                  }} />
                </>
              )}



              {/* FIRE MODE BANNER */}
              <AnimatePresence>
                {fireModeBanner && (
                  <motion.div
                    initial={{ y: -80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -80, opacity: 0 }}
                    className="absolute top-0 left-0 right-0 z-[100] p-3 bg-gradient-to-r from-[#FF003C] via-[#FF6D00] to-[#FFD600] shadow-[0_4px_20px_rgba(255,109,0,0.5)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <Flame size={20} className="text-white animate-pulse" />
                        <div>
                          <p className="text-[11px] font-black text-white uppercase">Run Rate on Fire!</p>
                          <p className="text-[8px] text-white/80">Switch to BLAZE MODE?</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setFireMode(true); setFireModeBanner(false); setFireModeBallCount(0); }}
                          className="px-4 py-2 rounded-lg bg-white text-black font-black text-[10px] uppercase active:scale-95"
                        >
                          LET'S GO
                        </button>
                        <button
                          onClick={() => { setFireModeBanner(false); setFireModeDeclined(true); }}
                          className="px-3 py-2 rounded-lg bg-black/30 text-white font-black text-[10px] uppercase active:scale-95"
                        >
                          NAH
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ICE MODE BANNER */}
              <AnimatePresence>
                {iceModeBanner && (
                  <motion.div
                    initial={{ y: -80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -80, opacity: 0 }}
                    className="absolute top-0 left-0 right-0 z-[100] p-3 bg-gradient-to-r from-[#1a3a5c] via-[#2196F3] to-[#80D8FF] shadow-[0_4px_20px_rgba(33,150,243,0.4)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <ZapOff size={20} className="text-white animate-pulse" />
                        <div>
                          <p className="text-[11px] font-black text-white uppercase">Run rate freezing!</p>
                          <p className="text-[8px] text-white/80">Switch to FROST MODE?</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setIceMode(true); setIceModeBanner(false); setIceModeBallCount(0); }}
                          className="px-4 py-2 rounded-lg bg-white text-[#1565C0] font-black text-[10px] uppercase active:scale-95"
                        >
                          FREEZE
                        </button>
                        <button
                          onClick={() => { setIceModeBanner(false); setIceModeDeclined(true); }}
                          className="px-3 py-2 rounded-lg bg-black/30 text-white font-black text-[10px] uppercase active:scale-95"
                        >
                          NAH
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ═══ COMPACT SCORE HEADER ═══ */}
              <div className="shrink-0 px-3 pt-3 pb-2.5 border-b border-white/5">
                {/* Score line */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowAddPlayer({ open: true, team: 'batting' })}
                    className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
                  >
                    <span className="text-sm font-black text-white/50 uppercase tracking-wide">{getTeamInitials(battingTeamName)}</span>
                    <Plus size={10} className="text-white/30" />
                  </button>
                  <div className="text-center flex-1">
                    <span className={`font-numbers text-5xl font-black tracking-tight ${fireMode ? 'text-[#FF6D00]' : iceMode ? 'text-[#80D8FF]' : 'text-white'}`}>
                      {match.liveScore.runs}<span className="text-white/40">/{match.liveScore.wickets}</span>
                    </span>
                    <span className={`ml-2 font-numbers text-lg ${fireMode ? 'text-[#FF6D00]/50' : iceMode ? 'text-[#80D8FF]/60' : 'text-white/40'}`}>
                      ({overs}.{ballsInOver})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddPlayer({ open: true, team: 'bowling' })}
                    className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
                  >
                    <Plus size={10} className="text-white/30" />
                    <span className="text-sm font-black text-white/50 uppercase tracking-wide">{getTeamInitials(bowlingTeamName)}</span>
                  </button>
                </div>
                {/* Run rate + target row */}
                <div className="flex items-center justify-center gap-3 mt-0.5">
                  <span className="text-xs font-bold text-white/40">CRR {crr}</span>
                  {match.currentInnings === 2 && target > 0 && (
                    <>
                      <span className="text-white/20">|</span>
                      <span className="text-[10px] font-bold text-white/40">Need {need} off {ballsRemaining}b</span>
                      <span className="text-white/20">|</span>
                      <span className="text-[10px] font-bold text-white/40">RRR {rrr}</span>
                    </>
                  )}
                </div>
                {/* DLS PAR SCORE */}
                {dlsActive && match.currentInnings === 2 && match.config.isRainAffected && (
                  <div className="flex items-center justify-center gap-2 mt-1 px-3 py-1 rounded-lg bg-[#FFD600]/10 border border-[#FFD600]/15">
                    <span className="text-[9px] font-black text-[#FFD600]/60 uppercase">DLS Par</span>
                    <span className="font-numbers text-xs font-black text-[#FFD600]">
                      {getDLSParScore({
                        team1Score: match.config.innings1Score || 0,
                        matchOvers: match.config.reducedOvers2 || match.config.overs,
                        team2OversRemaining: (match.config.reducedOvers2 || match.config.overs) - (match.liveScore.balls / 6),
                        team2WicketsLost: match.liveScore.wickets,
                        team2OversTotal: match.config.reducedOvers2 || match.config.overs,
                      })}
                    </span>
                    <span className="text-[9px] font-black uppercase" style={{ color: match.liveScore.runs >= getDLSParScore({ team1Score: match.config.innings1Score || 0, matchOvers: match.config.reducedOvers2 || match.config.overs, team2OversRemaining: (match.config.reducedOvers2 || match.config.overs) - (match.liveScore.balls / 6), team2WicketsLost: match.liveScore.wickets, team2OversTotal: match.config.reducedOvers2 || match.config.overs }) ? '#39FF14' : '#FF003C' }}>
                      {match.liveScore.runs >= getDLSParScore({ team1Score: match.config.innings1Score || 0, matchOvers: match.config.reducedOvers2 || match.config.overs, team2OversRemaining: (match.config.reducedOvers2 || match.config.overs) - (match.liveScore.balls / 6), team2WicketsLost: match.liveScore.wickets, team2OversTotal: match.config.reducedOvers2 || match.config.overs }) ? 'AHEAD' : 'BEHIND'}
                    </span>
                  </div>
                )}
              </div>

              {/* ═══ BATSMAN + BOWLER COMPACT PANEL ═══ */}
              <div className="shrink-0 px-3 py-2.5 border-b border-white/5 space-y-1">
                {/* Column headers */}
                <div className="flex items-center gap-2 text-[10px] font-black text-white/25 uppercase tracking-wider px-1">
                  <div className="flex-1">Batsman</div>
                  <div className="w-8 text-right">R</div>
                  <div className="w-8 text-right">B</div>
                  <div className="w-6 text-right">4s</div>
                  <div className="w-6 text-right">6s</div>
                  <div className="w-9 text-right">SR</div>
                </div>
                {/* Striker */}
                {striker && (
                  <button
                    type="button"
                    onClick={() => setPlayerActionMenu({ open: true, playerId: striker.id, role: 'STRIKER' })}
                    className="w-full flex items-center gap-2 px-1 py-2.5 rounded-lg hover:bg-white/5 active:bg-white/10 transition-all"
                  >
                    <div className="w-3 h-3 rounded-full bg-[#00F0FF] shrink-0" />
                    <div className="flex-1 font-black text-[15px] text-white uppercase truncate text-left">{striker.name}</div>
                    <div className="font-numbers font-black text-[15px] text-white w-8 text-right">{striker.runs || 0}</div>
                    <div className="font-numbers text-[11px] text-white/50 w-8 text-right">{striker.balls || 0}</div>
                    <div className="font-numbers text-[11px] text-white/50 w-6 text-right">{striker.fours || 0}</div>
                    <div className="font-numbers text-[11px] text-white/50 w-6 text-right">{striker.sixes || 0}</div>
                    <div className={`font-numbers text-[11px] font-bold w-9 text-right ${fireMode ? 'text-[#FFD600]' : iceMode ? 'text-[#E1BEE7]' : 'text-[#BC13FE]'}`}>{strikerSR}</div>
                  </button>
                )}
                {/* Non-Striker */}
                {nonStriker && (
                  <button
                    type="button"
                    onClick={() => setPlayerActionMenu({ open: true, playerId: nonStriker.id, role: 'NON_STRIKER' })}
                    className="w-full flex items-center gap-2 px-1 py-2 rounded-lg hover:bg-white/5 active:bg-white/10 transition-all"
                  >
                    <div className="w-2 h-2 rounded-full bg-transparent border border-white/20 shrink-0" />
                    <div className="flex-1 font-black text-[13px] text-white/50 uppercase truncate text-left">{nonStriker.name}</div>
                    <div className="font-numbers text-[11px] text-white/50 w-8 text-right">{nonStriker.runs || 0}</div>
                    <div className="font-numbers text-[11px] text-white/40 w-8 text-right">{nonStriker.balls || 0}</div>
                    <div className="font-numbers text-[11px] text-white/40 w-6 text-right">{nonStriker.fours || 0}</div>
                    <div className="font-numbers text-[11px] text-white/40 w-6 text-right">{nonStriker.sixes || 0}</div>
                    <div className="font-numbers text-[11px] text-white/40 w-9 text-right">{nonStrikerSR}</div>
                  </button>
                )}
                {/* Partnership + Bowler in one row */}
                <div className="flex items-center gap-2 pt-1.5 border-t border-white/5">
                  <div className="flex-1 text-[11px] font-bold text-[#4DB6AC] uppercase">
                    P'ship {partnershipRuns}({partnershipBallCount}b)
                  </div>
                  {bowler && (
                    <button
                      type="button"
                      onClick={() => setPlayerActionMenu({ open: true, playerId: bowler.id, role: 'BOWLER' })}
                      className="flex items-center gap-2 active:opacity-70 transition-opacity"
                    >
                      <span className="text-xs font-black text-white/60 uppercase truncate max-w-[80px]">{bowler.name}</span>
                      <span className="font-numbers text-[10px] text-white/50">{bowlerOvers}-{bowler.runs_conceded || 0}-{bowler.wickets || 0}</span>
                      <span className={`font-numbers text-[10px] font-bold ${fireMode ? 'text-[#FFD600]' : iceMode ? 'text-[#E1BEE7]' : 'text-[#BC13FE]'}`}>E{bowlerEcon}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ═══ OVER TICKER ═══ */}
              <div className="shrink-0 px-3 py-2.5 border-b border-white/5 flex items-center gap-2.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-black text-white/30 uppercase shrink-0 mr-1">This Over</span>
                {currentOverBalls.map((ball, idx) => {
                  let bgColor = 'bg-white/15';
                  let textColor = 'text-white/70';
                  let displayText = '0';

                  if (ball.isWicket) {
                    bgColor = 'bg-[#FF003C]'; textColor = 'text-white';
                    displayText = 'W';
                  } else if (ball.type === 'WD') {
                    bgColor = 'bg-[#FF6D00]/80'; textColor = 'text-white';
                    displayText = 'Wd';
                  } else if (ball.type === 'NB') {
                    bgColor = 'bg-[#FF6D00]/80'; textColor = 'text-white';
                    displayText = 'Nb';
                  } else if (ball.runsScored === 4) {
                    bgColor = 'bg-[#BC13FE]'; textColor = 'text-white';
                    displayText = '4';
                  } else if (ball.runsScored === 6) {
                    bgColor = 'bg-[#FFD600]'; textColor = 'text-black';
                    displayText = '6';
                  } else if (ball.runsScored > 0) {
                    bgColor = 'bg-white/25'; textColor = 'text-white';
                    displayText = String(ball.runsScored);
                  }

                  return (
                    <div
                      key={idx}
                      className={`w-9 h-9 ${bgColor} rounded-full flex items-center justify-center text-[11px] font-black ${textColor} shrink-0`}
                    >
                      {displayText}
                    </div>
                  );
                })}
                {currentOverBalls.length === 0 && (
                  <span className="text-[10px] text-white/20 italic">New over</span>
                )}
              </div>

              {/* ═══ SCORING KEYPAD — CricHeroes-style ═══ */}
              <div className="flex-1 flex flex-col px-2 py-1.5 gap-1.5 overflow-hidden">
                {/* Primary runs: 0 1 2 3 */}
                <div className="grid grid-cols-4 gap-1.5" style={{ flex: '0.45' }}>
                  {[0, 1, 2, 3].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleScore(r)}
                      className="bg-white/[0.08] hover:bg-white/15 text-white font-black rounded-lg border border-white/10 active:scale-[0.93] transition-all select-none touch-manipulation text-sm flex items-center justify-center"
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {/* Boundary + Extras: 4 6 WD NB */}
                <div className="grid grid-cols-4 gap-1.5" style={{ flex: '0.45' }}>
                  <button
                    type="button"
                    onClick={() => handleScore(4)}
                    className="bg-[#BC13FE]/15 hover:bg-[#BC13FE]/25 text-[#BC13FE] font-black rounded-lg border border-[#BC13FE]/30 active:scale-[0.93] transition-all select-none touch-manipulation text-sm flex items-center justify-center"
                  >
                    4
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScore(6)}
                    className="bg-[#FFD600]/15 hover:bg-[#FFD600]/25 text-[#FFD600] font-black rounded-lg border border-[#FFD600]/30 active:scale-[0.93] transition-all select-none touch-manipulation text-sm flex items-center justify-center"
                  >
                    6
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingExtra('WD')}
                    className={`rounded-lg border active:scale-[0.93] transition-all select-none touch-manipulation text-xs font-black flex items-center justify-center ${
                      pendingExtra === 'WD'
                        ? 'bg-[#FF6D00] text-black border-[#FF6D00] shadow-[0_0_15px_rgba(255,109,0,0.4)]'
                        : 'bg-[#FF6D00]/15 text-[#FF6D00] border-[#FF6D00]/30 hover:bg-[#FF6D00]/25'
                    }`}
                  >
                    WD
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingExtra('NB')}
                    className={`rounded-lg border active:scale-[0.93] transition-all select-none touch-manipulation text-xs font-black flex items-center justify-center ${
                      pendingExtra === 'NB'
                        ? 'bg-[#FF6D00] text-black border-[#FF6D00] shadow-[0_0_15px_rgba(255,109,0,0.4)]'
                        : 'bg-[#FF6D00]/15 text-[#FF6D00] border-[#FF6D00]/30 hover:bg-[#FF6D00]/25'
                    }`}
                  >
                    NB
                  </button>
                </div>
                {/* Secondary: BYE LB 5 7 */}
                <div className="grid grid-cols-4 gap-1.5" style={{ flex: '0.45' }}>
                  <button
                    type="button"
                    onClick={() => setPendingExtra('BYE')}
                    className={`rounded-lg border active:scale-[0.93] transition-all select-none touch-manipulation text-xs font-black flex items-center justify-center ${
                      pendingExtra === 'BYE'
                        ? 'bg-[#FF6D00] text-black border-[#FF6D00]'
                        : 'bg-[#FF6D00]/10 text-[#FF6D00]/80 border-[#FF6D00]/20 hover:bg-[#FF6D00]/20'
                    }`}
                  >
                    BYE
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingExtra('LB')}
                    className={`rounded-lg border active:scale-[0.93] transition-all select-none touch-manipulation text-xs font-black flex items-center justify-center ${
                      pendingExtra === 'LB'
                        ? 'bg-[#FF6D00] text-black border-[#FF6D00]'
                        : 'bg-[#FF6D00]/10 text-[#FF6D00]/80 border-[#FF6D00]/20 hover:bg-[#FF6D00]/20'
                    }`}
                  >
                    LB
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScore(5)}
                    className="bg-white/[0.06] hover:bg-white/12 text-white/60 font-black rounded-lg border border-white/10 active:scale-[0.93] transition-all select-none touch-manipulation text-xs flex items-center justify-center"
                  >
                    5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScore(7)}
                    className="bg-white/[0.06] hover:bg-white/12 text-white/60 font-black rounded-lg border border-white/10 active:scale-[0.93] transition-all select-none touch-manipulation text-xs flex items-center justify-center"
                  >
                    7
                  </button>
                </div>
              </div>

              {/* ═══ BOTTOM ACTION BAR ═══ */}
              <div className="shrink-0 px-2 pb-2 pt-1 space-y-1.5">
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWicketWizard({ open: true })}
                    className="col-span-2 h-[40px] bg-[#FF003C] hover:bg-[#FF003C]/90 text-white font-black rounded-xl border border-[#FF003C]/60 active:scale-[0.95] transition-all select-none touch-manipulation text-sm tracking-wider"
                  >
                    WICKET
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMatch(m => ({
                        ...m,
                        crease: { ...m.crease, strikerId: m.crease.nonStrikerId, nonStrikerId: m.crease.strikerId }
                      }));
                    }}
                    className="h-[40px] bg-[#4DB6AC]/15 hover:bg-[#4DB6AC]/25 text-[#4DB6AC] font-black rounded-xl border border-[#4DB6AC]/30 active:scale-[0.95] transition-all select-none touch-manipulation text-xs"
                  >
                    SWAP
                  </button>
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!match.history || match.history.length === 0}
                    className="h-[44px] bg-white/[0.06] hover:bg-white/12 disabled:opacity-25 disabled:cursor-not-allowed text-[#FF6D00] font-black rounded-xl border border-white/10 active:scale-[0.95] transition-all select-none touch-manipulation text-xs"
                  >
                    UNDO
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScorecardPreview(true)}
                  className={`w-full h-[38px] font-black rounded-lg border active:scale-[0.98] transition-all select-none touch-manipulation text-xs flex items-center justify-center gap-1.5 ${
                    fireMode
                      ? 'bg-[#FF6D00]/15 text-[#FF6D00] border-[#FF6D00]/30'
                      : iceMode
                      ? 'bg-[#80D8FF]/15 text-[#80D8FF] border-[#80D8FF]/30'
                      : 'bg-[#00F0FF]/10 text-[#00F0FF]/80 border-[#00F0FF]/20'
                  }`}
                >
                  <ClipboardList size={13} />
                  SCORECARD
                </button>
              </div>

              {/* PLAYER ACTION MENU — Tap on player name */}
              <AnimatePresence>
                {playerActionMenu.open && (() => {
                  const actionPlayer = playerActionMenu.playerId ? getPlayer(playerActionMenu.playerId) : null;
                  if (!actionPlayer) return null;
                  const isBatsman = playerActionMenu.role === 'STRIKER' || playerActionMenu.role === 'NON_STRIKER';
                  const isBowler = playerActionMenu.role === 'BOWLER';
                  const hasFacedBalls = (actionPlayer.balls || 0) > 0 || (actionPlayer.runs || 0) > 0;
                  const hasBowled = (actionPlayer.balls_bowled || 0) > 0;
                  const battingTeamObj = getTeamObj(match.teams.battingTeamId);
                  const bowlingTeamObj = getTeamObj(match.teams.bowlingTeamId);
                  const availableReplacements = isBatsman
                    ? (battingTeamObj?.squad || []).filter(p =>
                        p.id !== match.crease.strikerId &&
                        p.id !== match.crease.nonStrikerId &&
                        !p.isOut &&
                        !p.isRetired
                      )
                    : (bowlingTeamObj?.squad || []).filter(p =>
                        p.id !== match.crease.bowlerId &&
                        p.id !== match.crease.previousBowlerId
                      );
                  const retiredPlayers = isBatsman
                    ? (battingTeamObj?.squad || []).filter(p => p.isRetired && !p.isOut)
                    : [];

                  return (
                    <motion.div
                      key="player-action-menu"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setPlayerActionMenu({ open: false, playerId: null, role: null })}
                      className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-end justify-center"
                    >
                      <motion.div
                        initial={{ y: 200 }}
                        animate={{ y: 0 }}
                        exit={{ y: 200 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg bg-[#0A0A0A] border-t border-white/10 rounded-t-[28px] overflow-hidden max-h-[70vh] flex flex-col"
                      >
                        <div className="px-5 pt-5 pb-3 border-b border-white/5">
                          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
                          <h3 className="font-heading text-lg uppercase italic text-white text-center">{actionPlayer.name}</h3>
                          <p className="text-[9px] text-white/40 text-center uppercase tracking-wider mt-1">
                            {isBatsman ? `${actionPlayer.runs || 0} (${actionPlayer.balls || 0})` : `${Math.floor((actionPlayer.balls_bowled || 0) / 6)}.${(actionPlayer.balls_bowled || 0) % 6} ov | ${actionPlayer.runs_conceded || 0}r | ${actionPlayer.wickets || 0}w`}
                          </p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                          {isBatsman && !hasFacedBalls && (
                            <>
                              <p className="text-[9px] font-black text-[#FF6D00] uppercase tracking-[0.2em] px-1 mb-1">Replace (Wrong Player Selected)</p>
                              {availableReplacements.length > 0 ? availableReplacements.map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    const creaseKey = playerActionMenu.role === 'STRIKER' ? 'strikerId' : 'nonStrikerId';
                                    setMatch(m => ({
                                      ...m,
                                      crease: { ...m.crease, [creaseKey]: p.id }
                                    }));
                                    setPlayerActionMenu({ open: false, playerId: null, role: null });
                                  }}
                                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#00F0FF]/30 transition-all active:scale-[0.98]"
                                >
                                  <ArrowLeftRight size={14} className="text-[#FF6D00] shrink-0" />
                                  <span className="font-black text-white text-sm uppercase truncate">{p.name}</span>
                                </button>
                              )) : (
                                <p className="text-[10px] text-white/30 px-1">No available replacements in squad</p>
                              )}
                            </>
                          )}
                          {isBowler && !hasBowled && (
                            <>
                              <p className="text-[9px] font-black text-[#FF6D00] uppercase tracking-[0.2em] px-1 mb-1">Replace Bowler</p>
                              {availableReplacements.length > 0 ? availableReplacements.map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    setMatch(m => ({
                                      ...m,
                                      crease: { ...m.crease, bowlerId: p.id }
                                    }));
                                    setPlayerActionMenu({ open: false, playerId: null, role: null });
                                  }}
                                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#00F0FF]/30 transition-all active:scale-[0.98]"
                                >
                                  <ArrowLeftRight size={14} className="text-[#FF6D00] shrink-0" />
                                  <span className="font-black text-white text-sm uppercase truncate">{p.name}</span>
                                </button>
                              )) : (
                                <p className="text-[10px] text-white/30 px-1">No available replacements</p>
                              )}
                            </>
                          )}

                          {isBatsman && hasFacedBalls && (
                            <>
                              <p className="text-[9px] font-black text-[#BC13FE] uppercase tracking-[0.2em] px-1 mb-1">Retire Batsman</p>
                              <button
                                onClick={() => {
                                  const teamKey = match.teams.battingTeamId === 'A' ? 'teamA' : 'teamB';
                                  const creaseKey = playerActionMenu.role === 'STRIKER' ? 'strikerId' : 'nonStrikerId';
                                  setMatch(m => ({
                                    ...m,
                                    teams: {
                                      ...m.teams,
                                      [teamKey]: {
                                        ...m.teams[teamKey],
                                        squad: m.teams[teamKey].squad.map(p =>
                                          p.id === actionPlayer.id ? { ...p, isRetired: true } : p
                                        )
                                      }
                                    },
                                    crease: { ...m.crease, [creaseKey]: null }
                                  }));
                                  setSelectionTarget('NEW_BATSMAN');
                                  setPlayerActionMenu({ open: false, playerId: null, role: null });
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#BC13FE]/10 border border-[#BC13FE]/30 hover:bg-[#BC13FE]/20 transition-all active:scale-[0.98]"
                              >
                                <Shield size={14} className="text-[#BC13FE] shrink-0" />
                                <div className="text-left">
                                  <span className="font-black text-white text-sm uppercase">Retire Hurt</span>
                                  <p className="text-[8px] text-white/40 mt-0.5">Player can return when a wicket falls</p>
                                </div>
                              </button>

                              <button
                                onClick={() => {
                                  const teamKey = match.teams.battingTeamId === 'A' ? 'teamA' : 'teamB';
                                  const creaseKey = playerActionMenu.role === 'STRIKER' ? 'strikerId' : 'nonStrikerId';
                                  setMatch(m => ({
                                    ...m,
                                    teams: {
                                      ...m.teams,
                                      [teamKey]: {
                                        ...m.teams[teamKey],
                                        squad: m.teams[teamKey].squad.map(p =>
                                          p.id === actionPlayer.id ? { ...p, isRetired: true, isOut: true, wicketType: 'Retired Out' } : p
                                        )
                                      }
                                    },
                                    crease: { ...m.crease, [creaseKey]: null },
                                    liveScore: { ...m.liveScore, wickets: m.liveScore.wickets + 1 }
                                  }));
                                  setSelectionTarget('NEW_BATSMAN');
                                  setPlayerActionMenu({ open: false, playerId: null, role: null });
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#FF003C]/10 border border-[#FF003C]/30 hover:bg-[#FF003C]/20 transition-all active:scale-[0.98]"
                              >
                                <X size={14} className="text-[#FF003C] shrink-0" />
                                <div className="text-left">
                                  <span className="font-black text-white text-sm uppercase">Retired Out</span>
                                  <p className="text-[8px] text-white/40 mt-0.5">Permanent — counts as a wicket</p>
                                </div>
                              </button>
                            </>
                          )}

                          {retiredPlayers.length > 0 && isBatsman && (
                            <>
                              <div className="mt-3 pt-3 border-t border-white/10">
                                <p className="text-[9px] font-black text-[#39FF14] uppercase tracking-[0.2em] px-1 mb-1">Bring Back Retired Player</p>
                              </div>
                              {retiredPlayers.map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    const teamKey = match.teams.battingTeamId === 'A' ? 'teamA' : 'teamB';
                                    const creaseKey = playerActionMenu.role === 'STRIKER' ? 'strikerId' : 'nonStrikerId';
                                    setMatch(m => ({
                                      ...m,
                                      teams: {
                                        ...m.teams,
                                        [teamKey]: {
                                          ...m.teams[teamKey],
                                          squad: m.teams[teamKey].squad.map(pl =>
                                            pl.id === p.id ? { ...pl, isRetired: false } : pl
                                          )
                                        }
                                      },
                                      crease: { ...m.crease, [creaseKey]: p.id }
                                    }));
                                    setPlayerActionMenu({ open: false, playerId: null, role: null });
                                  }}
                                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#39FF14]/10 border border-[#39FF14]/30 hover:bg-[#39FF14]/20 transition-all active:scale-[0.98]"
                                >
                                  <RefreshCcw size={14} className="text-[#39FF14] shrink-0" />
                                  <div className="text-left flex-1">
                                    <span className="font-black text-white text-sm uppercase truncate">{p.name}</span>
                                    <p className="text-[8px] text-white/40 mt-0.5">{p.runs || 0}({p.balls || 0}) — Retired Hurt</p>
                                  </div>
                                </button>
                              ))}
                            </>
                          )}

                          {isBatsman && hasFacedBalls && (
                            <p className="text-[8px] text-white/20 text-center mt-2 px-2">
                              Replace is only available before the batsman faces their first ball
                            </p>
                          )}
                        </div>

                        <div className="p-4 border-t border-white/5">
                          <button
                            onClick={() => setPlayerActionMenu({ open: false, playerId: null, role: null })}
                            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 font-black text-[11px] uppercase text-white hover:bg-white/10 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>

              {/* SCORECARD PREVIEW OVERLAY */}
              <AnimatePresence>
                {showScorecardPreview && (() => {
                  const battingTeam = getTeamObj(match.teams.battingTeamId);
                  const bowlingTeam = getTeamObj(match.teams.bowlingTeamId);
                  const battingSquad = battingTeam?.squad || [];
                  const bowlingSquad = bowlingTeam?.squad || [];
                  const inningsHistory = (match.history || []).filter(b => b.innings === match.currentInnings);

                  const battedPlayers = battingSquad.filter(p => (p.balls || 0) > 0 || (p.runs || 0) > 0 || p.isOut);
                  const yetToBat = battingSquad.filter(p => !p.isOut && (p.balls || 0) === 0 && (p.runs || 0) === 0 && p.id !== match.crease.strikerId && p.id !== match.crease.nonStrikerId);

                  const bowlers = bowlingSquad.filter(p => (p.balls_bowled || 0) > 0);

                  const partnerships: { batsman1: string; batsman2: string; runs: number; balls: number }[] = [];
                  let pRuns = 0, pBalls = 0, pBat1 = '', pBat2 = '';
                  for (const ball of inningsHistory) {
                    const s = ball.strikerId ? (battingSquad.find(p => p.id === ball.strikerId)?.name || '?') : '?';
                    const ns = ball.nonStrikerId ? (battingSquad.find(p => p.id === ball.nonStrikerId)?.name || '?') : '?';
                    if (!pBat1) { pBat1 = s; pBat2 = ns; }
                    const isLegal = !ball.type || ball.type === 'LEGAL' || ball.type === 'BYE' || ball.type === 'LB';
                    pRuns += (ball.runsScored || 0) + (ball.type === 'WD' || ball.type === 'NB' ? 1 : 0);
                    if (isLegal) pBalls++;
                    if (ball.isWicket) {
                      partnerships.push({ batsman1: pBat1, batsman2: pBat2, runs: pRuns, balls: pBalls });
                      pRuns = 0; pBalls = 0; pBat1 = ''; pBat2 = '';
                    }
                  }
                  if (pBalls > 0 || pRuns > 0) partnerships.push({ batsman1: pBat1, batsman2: pBat2, runs: pRuns, balls: pBalls });

                  const fowList: { wicket: number; runs: number; overs: string; player: string }[] = [];
                  let fowRuns = 0, fowLegalBalls = 0, fowWickets = 0;
                  for (const ball of inningsHistory) {
                    fowRuns += (ball.runsScored || 0) + (ball.type === 'WD' || ball.type === 'NB' ? 1 : 0);
                    const isLegal = !ball.type || ball.type === 'LEGAL' || ball.type === 'BYE' || ball.type === 'LB';
                    if (isLegal) fowLegalBalls++;
                    if (ball.isWicket) {
                      fowWickets++;
                      const ov = Math.floor(fowLegalBalls / 6);
                      const bl = fowLegalBalls % 6;
                      const outPlayer = ball.strikerId ? (battingSquad.find(p => p.id === ball.strikerId)?.name || '?') : '?';
                      fowList.push({ wicket: fowWickets, runs: fowRuns, overs: `${ov}.${bl}`, player: outPlayer });
                    }
                  }

                  const previewAccent = fireMode ? '#FF6D00' : iceMode ? '#80D8FF' : '#00F0FF';

                  return (
                    <motion.div
                      key="scorecard-preview"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowScorecardPreview(false)}
                      className="fixed inset-0 z-[5000] bg-black/95 backdrop-blur-sm flex items-start justify-center overflow-y-auto"
                    >
                      <motion.div
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 60, opacity: 0 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg my-4 mx-2 bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden shadow-2xl scorecard-preview-panel"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10" style={{ backgroundColor: `${previewAccent}15` }}>
                          <h3 className="font-black text-base uppercase" style={{ color: previewAccent }}>
                            Live Scorecard
                          </h3>
                          <button onClick={() => setShowScorecardPreview(false)} className="p-1 text-white/40 hover:text-white">
                            <X size={18} />
                          </button>
                        </div>

                        {/* BATTING */}
                        <div className="px-3 pt-3 pb-1">
                          <div className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-2">
                            {battingTeam?.name || 'Batting'} — {match.liveScore.runs}/{match.liveScore.wickets}
                          </div>
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="text-white/30 border-b border-white/5">
                                <th className="text-left py-1 font-black">BATTER</th>
                                <th className="text-right py-1 w-8 font-black">R</th>
                                <th className="text-right py-1 w-8 font-black">B</th>
                                <th className="text-right py-1 w-6 font-black">4s</th>
                                <th className="text-right py-1 w-6 font-black">6s</th>
                                <th className="text-right py-1 w-10 font-black">SR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {battedPlayers.map(p => {
                                const sr = (p.balls || 0) > 0 ? (((p.runs || 0) / (p.balls || 0)) * 100).toFixed(1) : '0.0';
                                const isOnCrease = p.id === match.crease.strikerId || p.id === match.crease.nonStrikerId;
                                const isStriker = p.id === match.crease.strikerId;
                                return (
                                  <tr key={p.id} className={`border-b border-white/5 ${isOnCrease ? 'text-white' : p.isOut ? 'text-white/40' : 'text-white/70'}`}>
                                    <td className="py-1.5 text-left font-bold">
                                      {p.name}{isStriker ? ' *' : isOnCrease ? ' ' : ''}{p.isOut ? '' : isOnCrease ? '' : ''}
                                      {p.isOut && <span className="text-[9px] text-white/25 ml-1">{p.dismissalType || 'out'}</span>}
                                    </td>
                                    <td className="text-right font-black">{p.runs || 0}</td>
                                    <td className="text-right text-white/50">{p.balls || 0}</td>
                                    <td className="text-right text-white/50">{p.fours || 0}</td>
                                    <td className="text-right text-white/50">{p.sixes || 0}</td>
                                    <td className="text-right" style={{ color: previewAccent }}>{sr}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {yetToBat.length > 0 && (
                            <div className="text-[9px] text-white/25 mt-1">
                              Yet to bat: {yetToBat.map(p => p.name).join(', ')}
                            </div>
                          )}
                        </div>

                        {/* BOWLING */}
                        <div className="px-3 pt-3 pb-1 border-t border-white/5">
                          <div className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-2">
                            {bowlingTeam?.name || 'Bowling'}
                          </div>
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="text-white/30 border-b border-white/5">
                                <th className="text-left py-1 font-black">BOWLER</th>
                                <th className="text-right py-1 w-10 font-black">O</th>
                                <th className="text-right py-1 w-8 font-black">R</th>
                                <th className="text-right py-1 w-6 font-black">W</th>
                                <th className="text-right py-1 w-10 font-black">ECO</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bowlers.map(p => {
                                const bOv = `${Math.floor((p.balls_bowled || 0) / 6)}.${(p.balls_bowled || 0) % 6}`;
                                const eco = (p.balls_bowled || 0) > 0 ? (((p.runs_conceded || 0) / (p.balls_bowled || 0)) * 6).toFixed(1) : '0.0';
                                const isBowling = p.id === match.crease.bowlerId;
                                return (
                                  <tr key={p.id} className={`border-b border-white/5 ${isBowling ? 'text-white' : 'text-white/60'}`}>
                                    <td className="py-1.5 text-left font-bold">{p.name}{isBowling ? ' *' : ''}</td>
                                    <td className="text-right">{bOv}</td>
                                    <td className="text-right">{p.runs_conceded || 0}</td>
                                    <td className="text-right font-black" style={{ color: (p.wickets || 0) > 0 ? previewAccent : undefined }}>{p.wickets || 0}</td>
                                    <td className="text-right text-white/50">{eco}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* PARTNERSHIPS */}
                        {partnerships.length > 0 && (
                          <div className="px-3 pt-3 pb-1 border-t border-white/5">
                            <div className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-2">Partnerships</div>
                            <div className="space-y-1">
                              {partnerships.map((p, i) => (
                                <div key={i} className="flex items-center justify-between text-[10px] text-white/50">
                                  <span className="truncate flex-1">{p.batsman1} & {p.batsman2}</span>
                                  <span className="font-black text-white/70 ml-2">{p.runs}({p.balls}b)</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* FALL OF WICKETS */}
                        {fowList.length > 0 && (
                          <div className="px-3 pt-3 pb-3 border-t border-white/5">
                            <div className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-2">Fall of Wickets</div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/50">
                              {fowList.map((f, i) => (
                                <span key={i}>
                                  <span className="font-black text-white/70">{f.runs}/{f.wicket}</span>
                                  <span className="text-white/30"> ({f.player}, {f.overs} ov)</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>

              {/* WICKET WIZARD */}
              <AnimatePresence>
                {wicketWizard.open && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[5000] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => { setWicketWizard({ open: false }); setPendingExtra(null); }}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 40 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 40 }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                    >
                      <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                        <h3 className="font-heading text-2xl uppercase italic text-[#FF003C]">Wicket Type</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3 p-4">
                        {[
                          { type: 'BOWLED', icon: '🎳' },
                          { type: 'CAUGHT', icon: '🤚' },
                          { type: 'LBW', icon: '🦵' },
                          { type: 'STUMPED', icon: '🏏' },
                          { type: 'RUN OUT', icon: '💨' },
                          { type: 'HIT WICKET', icon: '💥' },
                          { type: 'RETIRED OUT', icon: '🚶' },
                        ].map((item) => (
                          <motion.button
                            key={item.type}
                            onClick={() => handleWicketAction(item.type)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-[#FF003C]/40 hover:bg-white/10 font-black uppercase text-xs flex flex-col items-center gap-2 transition-all"
                          >
                            <span className="text-2xl">{item.icon}</span>
                            {item.type}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* FIELDER SELECTION */}
              <AnimatePresence>
                {selectionTarget === 'FIELDER' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => { setSelectionTarget(null); setPendingExtra(null); }}
                    className="fixed inset-0 z-[5000] bg-black/95 backdrop-blur-sm flex items-end justify-center p-4"
                  >
                    <motion.div
                      initial={{ y: 100 }}
                      animate={{ y: 0 }}
                      exit={{ y: 100 }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-t-3xl overflow-hidden max-h-[70vh] flex flex-col"
                    >
                      <div className="p-4 border-b border-white/5">
                        <h3 className="font-heading text-lg uppercase italic text-[#FFD600]">Select Fielder</h3>
                        <p className="text-[9px] text-white/40 uppercase mt-1">Who took the {wicketWizard.type === 'CAUGHT' ? 'catch' : wicketWizard.type === 'RUN OUT' ? 'run out' : 'stumping'}?</p>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3">
                        <div className="grid grid-cols-3 gap-2">
                          {(getTeamObj(match.teams.bowlingTeamId)?.squad || []).map(player => (
                            <motion.button
                              key={player.id}
                              type="button"
                              onClick={() => handleFielderSelected(player.id)}
                              whileTap={{ scale: 0.95 }}
                              className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-[#FFD600]/40 flex flex-col items-center gap-1 transition-all"
                            >
                              <img src={getPlayerAvatar(player)} className="w-10 h-10 rounded-full" />
                              <p className="text-[9px] font-black text-white uppercase text-center leading-tight">{player.name}</p>
                              {player.isWicketKeeper && (
                                <span className="text-[7px] text-[#FFD600] font-black">WK</span>
                              )}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* NEW BATSMAN SELECTION */}
              <AnimatePresence>
                {selectionTarget === 'NEW_BATSMAN' && (() => {
                  const availableBatsmen = (getTeamObj(match.teams.battingTeamId)?.squad || [])
                    .filter(p => !p.isOut && p.id !== match.crease.nonStrikerId && p.id !== match.crease.strikerId);
                  // Safety net: if no batsmen available, auto-end innings
                  if (availableBatsmen.length === 0) {
                    setTimeout(() => {
                      setSelectionTarget(null);
                      const battingTeamKey = match.teams.battingTeamId === 'A' ? 'teamA' : 'teamB';
                      const squadSize = (match.teams[battingTeamKey]?.squad || []).length;
                      const allOutWickets = Math.max(1, Math.min(squadSize - 1, 10));
                      setMatch(m => {
                        if (m.status === 'COMPLETED' || m.status === 'INNINGS_BREAK') return m;
                        const newLiveScore = { ...m.liveScore, wickets: allOutWickets };
                        if (m.currentInnings === 1) {
                          const newConfig = { ...m.config, innings1Score: newLiveScore.runs, innings1Wickets: allOutWickets, innings1Balls: newLiveScore.balls, innings1Completed: true };
                          setOverlayAnim('INNINGS_BREAK');
                          setTimeout(() => { setOverlayAnim(null); setStatus('INNINGS_BREAK'); }, 2000);
                          return { ...m, status: 'INNINGS_BREAK', config: newConfig, liveScore: newLiveScore };
                        } else {
                          const inn1Score = m.config.innings1Score || 0;
                          const inn2Score = newLiveScore.runs;
                          const battingTeamName = getTeamObj(m.teams.battingTeamId)?.name || 'Team';
                          const bowlingTeamName = getTeamObj(m.teams.bowlingTeamId)?.name || 'Team';
                          if (inn2Score >= (m.config.target || inn1Score + 1)) {
                            setWinnerTeam({ name: battingTeamName, id: m.teams.battingTeamId, margin: `Won by 0 wickets` });
                          } else if (inn2Score === inn1Score) {
                            setShowSuperOverPrompt(true);
                          } else {
                            const runDiff = inn1Score - inn2Score;
                            setWinnerTeam({ name: bowlingTeamName, id: m.teams.bowlingTeamId, margin: `Won by ${runDiff} run${runDiff !== 1 ? 's' : ''}` });
                          }
                          setTimeout(() => setStatus('SUMMARY'), 100);
                          return { ...m, status: 'COMPLETED', liveScore: newLiveScore };
                        }
                      });
                    }, 50);
                    return null;
                  }
                  return (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectionTarget(null)}
                    className="fixed inset-0 z-[5000] bg-black/95 backdrop-blur-sm flex items-end justify-center p-4"
                  >
                    <motion.div
                      initial={{ y: 100 }}
                      animate={{ y: 0 }}
                      exit={{ y: 100 }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-t-3xl overflow-hidden max-h-[70vh] flex flex-col"
                    >
                      <div className="p-4 border-b border-white/5">
                        <h3 className="font-heading text-lg uppercase italic text-[#FF003C]">New Batsman</h3>
                        <p className="text-[9px] text-white/40 uppercase mt-1">Select who comes in next</p>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3">
                        <div className="space-y-2">
                          {availableBatsmen.map(player => (
                            <motion.button
                              key={player.id}
                              type="button"
                              onClick={() => {
                                setMatch(m => {
                                  const updated = { ...m, crease: { ...m.crease, strikerId: player.id } };
                                  if (!updated.crease.bowlerId) {
                                    setTimeout(() => setSelectionTarget('NEXT_BOWLER'), 50);
                                  } else {
                                    setTimeout(() => setSelectionTarget(null), 0);
                                  }
                                  return updated;
                                });
                              }}
                              whileTap={{ scale: 0.95 }}
                              className="w-full p-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#00F0FF]/40 flex items-center gap-3 transition-all"
                            >
                              <img src={getPlayerAvatar(player)} className="w-10 h-10 rounded-full" />
                              <div className="flex-1 text-left">
                                <p className="text-[11px] font-black text-white uppercase">{player.name}</p>
                                <p className="text-[9px] text-white/40">{player.runs || 0}({player.balls || 0})</p>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                  );
                })()}
              </AnimatePresence>

              {/* NEXT BOWLER SELECTION */}
              <AnimatePresence>
                {selectionTarget === 'NEXT_BOWLER' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectionTarget(null)}
                    className="fixed inset-0 z-[5000] bg-black/95 backdrop-blur-sm flex items-end justify-center p-4"
                  >
                    <motion.div
                      initial={{ y: 100 }}
                      animate={{ y: 0 }}
                      exit={{ y: 100 }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-t-3xl overflow-hidden max-h-[70vh] flex flex-col"
                    >
                      <div className="p-4 border-b border-white/5">
                        <h3 className="font-heading text-lg uppercase italic text-[#BC13FE]">Next Bowler</h3>
                        <p className="text-[9px] text-white/40 uppercase mt-1">Over {Math.floor(match.liveScore.balls / 6)} complete</p>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3">
                        <div className="space-y-2">
                          {(getTeamObj(match.teams.bowlingTeamId)?.squad || [])
                            .sort((a, b) => {
                              // Prev bowler last
                              if (a.id === match.crease.previousBowlerId) return 1;
                              if (b.id === match.crease.previousBowlerId) return -1;
                              // Max reached last
                              const aMax = Math.floor((a.balls_bowled || 0) / 6) >= bowlerMaxOvers;
                              const bMax = Math.floor((b.balls_bowled || 0) / 6) >= bowlerMaxOvers;
                              if (aMax && !bMax) return 1;
                              if (!aMax && bMax) return -1;
                              // Fewest overs first
                              return (a.balls_bowled || 0) - (b.balls_bowled || 0);
                            })
                            .map(player => {
                              const playerOversComplete = Math.floor((player.balls_bowled || 0) / 6);
                              const isMaxReached = playerOversComplete >= bowlerMaxOvers;
                              const isLastBowler = player.id === match.crease.previousBowlerId;
                              const isOneOverLeft = playerOversComplete === bowlerMaxOvers - 1;

                              return (
                                <motion.button
                                  key={player.id}
                                  type="button"
                                  onClick={() => {
                                    setMatch(m => ({ ...m, crease: { ...m.crease, bowlerId: player.id, previousBowlerId: m.crease.bowlerId || m.crease.previousBowlerId } }));
                                    setSelectionTarget(null);
                                  }}
                                  disabled={isLastBowler || isMaxReached}
                                  whileTap={{ scale: isLastBowler || isMaxReached ? 1 : 0.95 }}
                                  className={`w-full p-3 rounded-xl border flex items-center gap-3 transition-all ${
                                    isLastBowler || isMaxReached
                                      ? 'bg-white/5 border-white/10 opacity-40 cursor-not-allowed'
                                      : 'bg-white/5 border-white/10 hover:border-[#BC13FE]/40 hover:bg-white/10'
                                  }`}
                                >
                                  <img src={getPlayerAvatar(player)} className="w-10 h-10 rounded-full" />
                                  <div className="flex-1 text-left">
                                    <p className="text-[11px] font-black text-white uppercase">{player.name}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <div className="flex-1 bg-white/20 rounded-full h-1 overflow-hidden">
                                        <div
                                          className="bg-[#BC13FE] h-full"
                                          style={{ width: `${Math.min(100, (playerOversComplete / bowlerMaxOvers) * 100)}%` }}
                                        />
                                      </div>
                                      <p className="text-[8px] text-white/60 w-8 text-right">{playerOversComplete}/{bowlerMaxOvers}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[8px] text-white/60 font-black">
                                      {player.wickets || 0}-{player.runs_conceded || 0}
                                    </p>
                                    {isLastBowler && (
                                      <span className="text-[7px] text-[#FF003C] font-black uppercase">Last</span>
                                    )}
                                    {isMaxReached && (
                                      <span className="text-[7px] text-[#FF6D00] font-black uppercase">Max</span>
                                    )}
                                    {isOneOverLeft && (
                                      <span className="text-[7px] text-[#FFD600] font-black uppercase">1 left</span>
                                    )}
                                  </div>
                                </motion.button>
                              );
                            })}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })()}

        {/* INNINGS BREAK */}
        {status === 'INNINGS_BREAK' && (() => {
          const battingTeamName = getTeamObj(match.teams.battingTeamId)?.name || 'Team';
          const overs = Math.floor(match.liveScore.balls / 6);
          const balls = match.liveScore.balls % 6;

          // Find top performer (highest scorer)
          const topPerformer = (getTeamObj(match.teams.battingTeamId)?.squad || [])
            .reduce((best, p) => (p.runs || 0) > (best.runs || 0) ? p : best, {} as any);
          const topPerformerInfo = topPerformer?.name ? `${topPerformer.name} ${topPerformer.runs}(${topPerformer.balls})` : 'N/A';

          // Find best bowler
          const bowlers = (getTeamObj(match.teams.bowlingTeamId)?.squad || []).filter(p => (p.wickets || 0) > 0);
          const bestBowler = bowlers.reduce((best, p) => (p.wickets || 0) > (best.wickets || 0) ? p : best, {} as any);
          const bestBowlerInfo = bestBowler?.name ? `${bestBowler.name} ${bestBowler.wickets}-${bestBowler.runs_conceded || 0} (${Math.floor((bestBowler.balls_bowled || 0) / 6)}.${(bestBowler.balls_bowled || 0) % 6})` : 'N/A';

          // Key partnerships (> 20 runs)
          const currentHistory = (match.history || []).filter(b => b.innings === match.currentInnings);
          const partnerships: any[] = [];
          let currentPartnershipRuns = 0;
          let lastWicketIndex = 0;
          for (let i = 0; i < currentHistory.length; i++) {
            const ball = currentHistory[i];
            currentPartnershipRuns += (ball.runsScored || 0) + (ball.type === 'WD' || ball.type === 'NB' ? 1 : 0);
            if (ball.isWicket) {
              if (currentPartnershipRuns > 20) {
                partnerships.push({ runs: currentPartnershipRuns, wicket: i });
              }
              currentPartnershipRuns = 0;
              lastWicketIndex = i + 1;
            }
          }
          if (currentPartnershipRuns > 20) {
            partnerships.push({ runs: currentPartnershipRuns });
          }

          // Current over display (for summary)
          const lastOverBalls = currentHistory.slice(-6);
          // Run rate
          const runRate = match.liveScore.balls > 0 ? ((match.liveScore.runs / match.liveScore.balls) * 6).toFixed(2) : '0.00';
          // Extras and boundaries
          const totalExtras = currentHistory.reduce((sum, b) => sum + (b.type === 'WD' || b.type === 'NB' ? 1 : 0) + (b.type === 'BYE' || b.type === 'LB' ? (b.runsScored || 0) : 0), 0);
          const totalFours = currentHistory.filter(b => b.runsScored === 4 && !b.isWicket && b.type !== 'BYE' && b.type !== 'LB').length;
          const totalSixes = currentHistory.filter(b => b.runsScored === 6 && !b.isWicket && b.type !== 'BYE' && b.type !== 'LB').length;
          const target = match.config.target || match.liveScore.runs + 1;

          return (
            <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar bg-black">
              <div className="flex-1 p-4 pb-10 space-y-4">

                {/* HERO SCORE CARD */}
                <motion.div
                  initial={{ scale: 0.92, opacity: 0, y: 30 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 180 }}
                  className="relative overflow-hidden rounded-[28px] border border-white/10"
                  style={{ background: 'linear-gradient(135deg, rgba(0,240,255,0.12) 0%, rgba(188,19,254,0.15) 50%, rgba(255,214,0,0.08) 100%)' }}
                >
                  {/* Decorative glow */}
                  <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-[#00F0FF]/10 blur-3xl" />
                  <div className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full bg-[#BC13FE]/10 blur-3xl" />

                  <div className="relative z-10 p-6 text-center space-y-1">
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.4em]">Innings {match.currentInnings} Complete</p>
                    <h2 className="font-heading text-2xl uppercase italic text-white leading-tight">{battingTeamName}</h2>
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                      className="py-2"
                    >
                      <span className="font-numbers text-6xl font-black text-[#00F0FF] leading-none">{match.liveScore.runs}</span>
                      <span className="font-numbers text-3xl font-black text-white/40 mx-1">/</span>
                      <span className="font-numbers text-4xl font-black text-[#FF003C] leading-none">{match.liveScore.wickets}</span>
                    </motion.div>
                    <p className="text-[10px] text-white/50 font-black">{overs}.{balls} overs &bull; RR {runRate}</p>
                  </div>

                  {/* Quick Stats Row */}
                  <div className="relative z-10 grid grid-cols-4 border-t border-white/10">
                    <div className="p-3 text-center border-r border-white/5">
                      <p className="font-numbers text-lg font-black text-[#BC13FE]">{totalFours}</p>
                      <p className="text-[7px] font-black text-white/40 uppercase">Fours</p>
                    </div>
                    <div className="p-3 text-center border-r border-white/5">
                      <p className="font-numbers text-lg font-black text-[#FFD600]">{totalSixes}</p>
                      <p className="text-[7px] font-black text-white/40 uppercase">Sixes</p>
                    </div>
                    <div className="p-3 text-center border-r border-white/5">
                      <p className="font-numbers text-lg font-black text-[#FF6D00]">{totalExtras}</p>
                      <p className="text-[7px] font-black text-white/40 uppercase">Extras</p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="font-numbers text-lg font-black text-[#4DB6AC]">{partnerships.length}</p>
                      <p className="text-[7px] font-black text-white/40 uppercase">P'ships</p>
                    </div>
                  </div>
                </motion.div>

                {/* TOP PERFORMER + BEST BOWLER — side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="p-4 rounded-2xl bg-[#FFD600]/5 border border-[#FFD600]/20 space-y-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <Star size={12} className="text-[#FFD600]" />
                      <p className="text-[8px] font-black text-[#FFD600] uppercase tracking-wider">Star</p>
                    </div>
                    <p className="text-[12px] font-black text-white leading-tight">{topPerformer?.name || 'N/A'}</p>
                    {topPerformer?.name && (
                      <p className="font-numbers text-[10px] text-white/50 font-black">
                        {topPerformer.runs}({topPerformer.balls}) {topPerformer.fours ? `${topPerformer.fours}x4` : ''} {topPerformer.sixes ? `${topPerformer.sixes}x6` : ''}
                      </p>
                    )}
                  </motion.div>
                  <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="p-4 rounded-2xl bg-[#BC13FE]/5 border border-[#BC13FE]/20 space-y-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <Target size={12} className="text-[#BC13FE]" />
                      <p className="text-[8px] font-black text-[#BC13FE] uppercase tracking-wider">Best Bowl</p>
                    </div>
                    <p className="text-[12px] font-black text-white leading-tight">{bestBowler?.name || 'N/A'}</p>
                    {bestBowler?.name && (
                      <p className="font-numbers text-[10px] text-white/50 font-black">
                        {bestBowler.wickets}-{bestBowler.runs_conceded} ({Math.floor((bestBowler.balls_bowled || 0) / 6)}.{(bestBowler.balls_bowled || 0) % 6})
                      </p>
                    )}
                  </motion.div>
                </div>

                {/* PARTNERSHIPS */}
                {partnerships.length > 0 && (
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="p-4 rounded-2xl bg-white/[0.02] border border-[#4DB6AC]/15 space-y-3"
                  >
                    <div className="flex items-center gap-1.5">
                      <Users size={12} className="text-[#4DB6AC]" />
                      <p className="text-[8px] font-black text-[#4DB6AC] uppercase tracking-wider">Key Partnerships</p>
                    </div>
                    {partnerships.slice(0, 3).map((p, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (p.runs / Math.max(1, match.liveScore.runs)) * 100)}%` }}
                            transition={{ delay: 0.5 + idx * 0.1, duration: 0.6 }}
                            className="h-full bg-[#4DB6AC] rounded-full"
                          />
                        </div>
                        <span className="font-numbers text-[11px] font-black text-white w-10 text-right">{p.runs}</span>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* LAST OVER */}
                {lastOverBalls.length > 0 && (
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5"
                  >
                    <p className="text-[8px] font-black text-white/40 uppercase shrink-0">Last Over</p>
                    <div className="flex gap-1.5 flex-1 justify-center">
                      {lastOverBalls.map((ball, idx) => {
                        let bgColor = 'bg-white/15';
                        let displayText = '0';
                        if (ball.isWicket) { bgColor = 'bg-[#FF003C]'; displayText = 'W'; }
                        else if (ball.type === 'WD') { bgColor = 'bg-[#FF6D00]/60'; displayText = 'Wd'; }
                        else if (ball.type === 'NB') { bgColor = 'bg-[#FF6D00]/60'; displayText = 'Nb'; }
                        else if (ball.runsScored === 4) { bgColor = 'bg-[#BC13FE]'; displayText = '4'; }
                        else if (ball.runsScored === 6) { bgColor = 'bg-[#FFD600]'; displayText = '6'; }
                        else if (ball.runsScored > 0) { bgColor = 'bg-white/25'; displayText = String(ball.runsScored); }
                        return (
                          <div key={idx} className={`w-7 h-7 ${bgColor} rounded-full flex items-center justify-center text-[9px] font-black text-white`}>
                            {displayText}
                          </div>
                        );
                      })}
                    </div>
                    <p className="font-numbers text-[11px] font-black text-white/50 shrink-0">
                      {lastOverBalls.reduce((s, b) => s + (b.runsScored || 0) + (b.type === 'WD' || b.type === 'NB' ? 1 : 0), 0)}r
                    </p>
                  </motion.div>
                )}

                {/* TARGET BANNER */}
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.55 }}
                  className="p-5 rounded-2xl bg-gradient-to-r from-[#39FF14]/10 to-[#39FF14]/5 border border-[#39FF14]/30 text-center"
                >
                  <p className="text-[8px] font-black text-[#39FF14]/60 uppercase tracking-[0.3em] mb-1">Target Set</p>
                  <p className="font-numbers text-4xl font-black text-[#39FF14]">{target}</p>
                </motion.div>

                {/* BUTTONS */}
                <div className="space-y-3 pt-2 pb-6">
                  <motion.button
                    onClick={() => {
                      const followUrl = `${window.location.origin}${window.location.pathname}?watch=${match.matchId}`;
                      const msg = encodeURIComponent(
                        `🏏 ${battingTeamName} scored ${match.liveScore.runs}/${match.liveScore.wickets} in ${overs}.${balls} overs\n\nTarget: ${target}\n\n📺 Follow live:\n${followUrl}`
                      );
                      window.open(`https://wa.me/?text=${msg}`);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full py-4 rounded-2xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] font-black text-[12px] uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                  >
                    <Share2 size={16} />
                    Share on WhatsApp
                  </motion.button>

                  <motion.button
                    onClick={() => {
                      setMatch(m => ({
                        ...m,
                        status: 'OPENERS',
                        config: { ...m.config, target: target, innings1Score: m.liveScore.runs, innings1Wickets: m.liveScore.wickets, innings1Balls: m.liveScore.balls },
                        teams: { ...m.teams, battingTeamId: m.teams.bowlingTeamId, bowlingTeamId: m.teams.battingTeamId },
                        liveScore: { runs: 0, wickets: 0, balls: 0 },
                        crease: { strikerId: null, nonStrikerId: null, bowlerId: null, previousBowlerId: null },
                        currentInnings: 2,
                      }));
                      setSelectionTarget('STRIKER');
                      setStatus('OPENERS');
                      setFireMode(false);
                      setFireModeBanner(false);
                      setFireModeDeclined(false);
                      setIceMode(false);
                      setIceModeBanner(false);
                      setIceModeDeclined(false);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full py-5 rounded-2xl bg-[#39FF14] text-black font-black text-[13px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(57,255,20,0.3)]"
                  >
                    <Zap size={18} />
                    Start Innings 2
                  </motion.button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* SUMMARY SCREEN */}
        {status === 'SUMMARY' && (
          <>
            <style>{`
              @keyframes shimmer {
                0% { background-position: -400px 0; }
                100% { background-position: 400px 0; }
              }
              .skeleton-shimmer {
                background: linear-gradient(90deg, #111 25%, #1a1a1a 50%, #111 75%);
                background-size: 800px 100%;
                animation: shimmer 1.5s infinite linear;
              }
            `}</style>

            {/* VISIBLE SUMMARY SCREEN */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Notification Banner */}
              {scorecardReady && (
                <motion.div
                  initial={{ y: -60, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-[#00F0FF]/10 border-b border-[#00F0FF]/20 px-6 py-3 text-center text-[12px] font-black text-[#00F0FF] uppercase tracking-[0.2em]"
                >
                  Your match card is ready — tap to share
                </motion.div>
              )}

              {/* TAB BAR - Sticky at top */}
              {summaryPhase !== 'SKELETON' && (
                <div className="summary-tab-bar sticky top-0 z-40 bg-[#050505] border-b border-white/5 px-4 pt-4">
                  <div className="flex gap-1 overflow-x-auto no-scrollbar pb-4">
                    {['SUMMARY', 'SCORECARD', 'COMMS', 'ANALYSIS', 'MVP', 'HIGHLIGHTS'].map((tab) => (
                      <motion.button
                        key={tab}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSummaryTab(tab as any)}
                        className={`px-4 py-2 rounded-full font-black text-[11px] uppercase tracking-[0.15em] transition-all whitespace-nowrap border-b-2 relative ${
                          summaryTab === tab
                            ? 'text-[#00F0FF] border-[#00F0FF]'
                            : 'text-white/40 border-transparent hover:text-white/60'
                        }`}
                      >
                        {tab}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6 pb-24">
                {/* Phase 1: Skeleton Shimmer */}
                {summaryPhase === 'SKELETON' && (
                  <div className="space-y-4">
                    <div className="skeleton-shimmer h-32 rounded-[32px]" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="skeleton-shimmer h-20 rounded-[16px]" />
                      <div className="skeleton-shimmer h-20 rounded-[16px]" />
                    </div>
                    <div className="skeleton-shimmer h-40 rounded-[20px]" />
                  </div>
                )}

                {/* Phase 2-3: Content */}
                {summaryPhase !== 'SKELETON' && (
                  <>
                    {/* Result Banner */}
                    <motion.div
                      initial={summaryPhase === 'COUNTING' ? { scale: 0.9, opacity: 0 } : { scale: 1, opacity: 1 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: summaryPhase === 'COUNTING' ? 0.2 : 0 }}
                      className="p-8 rounded-[40px] bg-gradient-to-br from-[#00F0FF]/10 to-[#FFD600]/10 border border-white/10 space-y-4 text-center"
                    >
                      <h2 className="font-heading text-4xl uppercase italic text-[#00F0FF]">Match Complete</h2>
                      {winnerTeam ? (
                        <>
                          <h3 className={`font-heading text-5xl uppercase italic ${winnerTeam.id ? 'text-[#39FF14]' : 'text-[#FFD600]'}`}>
                            {winnerTeam.name}
                          </h3>
                          <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">{winnerTeam.margin}</p>
                        </>
                      ) : (
                        <p className="text-[13px] text-white/40 font-black uppercase">Calculating result...</p>
                      )}
                    </motion.div>

                    {/* SUMMARY TAB */}
                    {summaryTab === 'SUMMARY' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        {(() => {
                          const allPlayers = [...(match.teams.teamA.squad || []), ...(match.teams.teamB.squad || [])];
                          const inn1History = (match.history || []).filter(b => b.innings === 1);
                          const inn2History = (match.history || []).filter(b => b.innings === 2);
                          const inn1Team = getTeamObj(innings1TeamId);
                          const inn2Team = getTeamObj(innings2TeamId);
                          const inn1Squad = inn1Team.squad || [];
                          const inn2Squad = inn2Team.squad || [];

                          // Innings stats helpers
                          const calcInningsStats = (history: any[]) => {
                            const legalBalls = history.filter(b => !b.type || b.type === 'LEGAL' || b.type === 'BYE' || b.type === 'LB').length;
                            const totalRuns = history.reduce((s, b) => s + (b.runsScored || 0) + ((b.type === 'WD' || b.type === 'NB') ? 1 : 0), 0);
                            const dots = history.filter(b => (!b.type || b.type === 'LEGAL') && (b.runsScored || 0) === 0 && !b.isWicket).length;
                            const fours = history.filter(b => (b.runsScored || 0) === 4 && b.type !== 'BYE' && b.type !== 'LB').length;
                            const sixes = history.filter(b => (b.runsScored || 0) === 6 && b.type !== 'BYE' && b.type !== 'LB').length;
                            const wides = history.filter(b => b.type === 'WD').length;
                            const noBalls = history.filter(b => b.type === 'NB').length;
                            const byes = history.filter(b => b.type === 'BYE').reduce((s, b) => s + (b.runsScored || 0), 0);
                            const legByes = history.filter(b => b.type === 'LB').reduce((s, b) => s + (b.runsScored || 0), 0);
                            const extras = wides + noBalls + byes + legByes;
                            const wickets = history.filter(b => b.isWicket).length;
                            const overs = Math.floor(legalBalls / 6);
                            const ballsInOver = legalBalls % 6;
                            const crr = legalBalls > 0 ? ((totalRuns / legalBalls) * 6).toFixed(2) : '0.00';
                            const boundaries = fours + sixes;
                            const boundaryRuns = (fours * 4) + (sixes * 6);
                            const boundaryPct = totalRuns > 0 ? Math.round((boundaryRuns / totalRuns) * 100) : 0;
                            const dotPct = legalBalls > 0 ? Math.round((dots / legalBalls) * 100) : 0;
                            return { totalRuns, legalBalls, dots, fours, sixes, wides, noBalls, byes, legByes, extras, wickets, overs, ballsInOver, crr, boundaries, boundaryRuns, boundaryPct, dotPct };
                          };

                          const inn1Stats = calcInningsStats(inn1History);
                          const inn2Stats = calcInningsStats(inn2History);

                          // Best partnership per innings
                          const calcBestPartnership = (history: any[]) => {
                            if (history.length === 0) return null;
                            const wicketIndices = history.map((b, i) => b.isWicket ? i : -1).filter(i => i >= 0);
                            const segments: any[][] = [];
                            let start = 0;
                            wicketIndices.forEach(wi => {
                              segments.push(history.slice(start, wi));
                              start = wi + 1;
                            });
                            segments.push(history.slice(start));
                            let best = { runs: 0, balls: 0, wicketNum: 0 };
                            segments.forEach((seg, idx) => {
                              const runs = seg.reduce((s, b) => s + (b.runsScored || 0) + ((b.type === 'WD' || b.type === 'NB') ? 1 : 0), 0);
                              const balls = seg.filter(b => !b.type || b.type === 'LEGAL' || b.type === 'BYE' || b.type === 'LB').length;
                              if (runs > best.runs) best = { runs, balls, wicketNum: idx + 1 };
                            });
                            return best.runs > 0 ? best : null;
                          };

                          const inn1BestPartnership = calcBestPartnership(inn1History);
                          const inn2BestPartnership = calcBestPartnership(inn2History);

                          // Fall of wickets
                          const calcFOW = (history: any[]) => {
                            const fow: { wicketNum: number; score: number; over: string; playerName: string }[] = [];
                            let totalRuns = 0;
                            let legalBalls = 0;
                            let wicketCount = 0;
                            history.forEach(b => {
                              totalRuns += (b.runsScored || 0) + ((b.type === 'WD' || b.type === 'NB') ? 1 : 0);
                              const isLegal = !b.type || b.type === 'LEGAL' || b.type === 'BYE' || b.type === 'LB';
                              if (isLegal) legalBalls++;
                              if (b.isWicket) {
                                wicketCount++;
                                const ov = Math.floor(legalBalls / 6);
                                const bl = legalBalls % 6;
                                const striker = allPlayers.find(p => p.id === b.strikerId);
                                fow.push({ wicketNum: wicketCount, score: totalRuns, over: `${ov}.${bl}`, playerName: striker?.name || 'Unknown' });
                              }
                            });
                            return fow;
                          };

                          const inn1FOW = calcFOW(inn1History);
                          const inn2FOW = calcFOW(inn2History);

                          // Key moments
                          const keyMoments: { icon: string; text: string; over: string; innings: number }[] = [];
                          const checkMilestones = (history: any[], innNum: number) => {
                            const batRuns: Record<string, number> = {};
                            let legalBalls = 0;
                            let totalRuns = 0;
                            history.forEach(b => {
                              totalRuns += (b.runsScored || 0) + ((b.type === 'WD' || b.type === 'NB') ? 1 : 0);
                              const isLegal = !b.type || b.type === 'LEGAL' || b.type === 'BYE' || b.type === 'LB';
                              if (isLegal) legalBalls++;
                              const ov = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
                              // Track batter runs
                              if (b.strikerId && b.type !== 'BYE' && b.type !== 'LB') {
                                batRuns[b.strikerId] = (batRuns[b.strikerId] || 0) + (b.runsScored || 0);
                                const player = allPlayers.find(p => p.id === b.strikerId);
                                if (player) {
                                  if (batRuns[b.strikerId] === 50 || (batRuns[b.strikerId] > 50 && batRuns[b.strikerId] - (b.runsScored || 0) < 50)) {
                                    keyMoments.push({ icon: '🔥', text: `${player.name} reaches 50!`, over: ov, innings: innNum });
                                  }
                                  if (batRuns[b.strikerId] === 100 || (batRuns[b.strikerId] > 100 && batRuns[b.strikerId] - (b.runsScored || 0) < 100)) {
                                    keyMoments.push({ icon: '💯', text: `${player.name} century!`, over: ov, innings: innNum });
                                  }
                                }
                              }
                              if (b.isWicket) {
                                const striker = allPlayers.find(p => p.id === b.strikerId);
                                keyMoments.push({ icon: '🏏', text: `${striker?.name || 'Batsman'} out — ${b.wicketType || 'Wicket'}`, over: ov, innings: innNum });
                              }
                              if ((b.runsScored || 0) === 6) {
                                const striker = allPlayers.find(p => p.id === b.strikerId);
                                keyMoments.push({ icon: '💥', text: `SIX by ${striker?.name || 'Batsman'}!`, over: ov, innings: innNum });
                              }
                            });
                          };
                          checkMilestones(inn1History, 1);
                          checkMilestones(inn2History, 2);

                          // Top fielders
                          const fielders = allPlayers
                            .map(p => ({ ...p, fieldingPts: (p.catches || 0) + (p.stumpings || 0) + (p.run_outs || 0) }))
                            .filter(p => p.fieldingPts > 0)
                            .sort((a, b) => b.fieldingPts - a.fieldingPts);

                          // Head-to-head comparison
                          const motm = calculateMOTM();
                          const topScorer = allPlayers.reduce((best, p) => (p.runs || 0) > (best.runs || 0) ? p : best, {} as any);
                          const bestBowler = allPlayers.reduce((best, p) => (p.wickets || 0) > (best.wickets || 0) ? p : best, {} as any);
                          const highestSR = allPlayers.filter(p => (p.balls || 0) >= 3).reduce((best, p) => {
                            const sr = ((p.runs || 0) / (p.balls || 1)) * 100;
                            const bestSr = ((best.runs || 0) / (best.balls || 1)) * 100;
                            return sr > bestSr ? p : best;
                          }, {} as any);
                          const bestEconomy = allPlayers.filter(p => (p.balls_bowled || 0) >= 6).reduce((best, p) => {
                            const econ = ((p.runs_conceded || 0) / (p.balls_bowled || 1)) * 6;
                            const bestEcon = ((best.runs_conceded || 0) / (best.balls_bowled || 1)) * 6;
                            return (!best.name || econ < bestEcon) ? p : best;
                          }, {} as any);

                          return (
                            <>
                              {/* ═══ SCORE CARDS ═══ */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-5 rounded-[24px] bg-white/5 border border-white/10 text-center space-y-2">
                                  <p className="text-[9px] font-black text-white/50 uppercase tracking-wider">{inn1Team.name}</p>
                                  <p className="font-numbers text-3xl font-black text-[#00F0FF]">{countingRuns.inn1}<span className="text-lg text-white/30">/{inn1Stats.wickets}</span></p>
                                  <p className="text-[8px] text-white/40 font-numbers">{inn1Stats.overs}.{inn1Stats.ballsInOver} ov · RR {inn1Stats.crr}</p>
                                </div>
                                <div className="p-5 rounded-[24px] bg-white/5 border border-white/10 text-center space-y-2">
                                  <p className="text-[9px] font-black text-white/50 uppercase tracking-wider">{inn2Team.name}</p>
                                  <p className="font-numbers text-3xl font-black text-[#39FF14]">{countingRuns.inn2}<span className="text-lg text-white/30">/{inn2Stats.wickets}</span></p>
                                  <p className="text-[8px] text-white/40 font-numbers">{inn2Stats.overs}.{inn2Stats.ballsInOver} ov · RR {inn2Stats.crr}</p>
                                </div>
                              </div>

                              {/* ═══ MATCH INFO ═══ */}
                              <div className="p-4 rounded-[20px] bg-white/[0.03] border border-white/[0.06] space-y-2">
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Match Info</p>
                                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[9px]">
                                  <div className="flex justify-between"><span className="text-white/40">Format</span><span className="text-white/70 font-black">{match.config.overs} Overs</span></div>
                                  <div className="flex justify-between"><span className="text-white/40">Ball</span><span className="text-white/70 font-black">{match.config.ballType || 'Tennis'}</span></div>
                                  <div className="flex justify-between"><span className="text-white/40">Toss</span><span className="text-white/70 font-black">{match.toss?.winnerId ? getTeamObj(match.toss.winnerId)?.name : '—'}</span></div>
                                  <div className="flex justify-between"><span className="text-white/40">Elected</span><span className="text-white/70 font-black">{match.toss?.decision === 'BAT' ? 'Bat' : 'Bowl'}</span></div>
                                </div>
                              </div>

                              {/* ═══ HEAD-TO-HEAD COMPARISON ═══ */}
                              <div className="p-4 rounded-[20px] bg-white/[0.03] border border-white/[0.06] space-y-4">
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Head to Head</p>
                                {[
                                  { label: 'Total Runs', v1: inn1Stats.totalRuns, v2: inn2Stats.totalRuns, color1: '#00F0FF', color2: '#39FF14' },
                                  { label: 'Boundaries', v1: inn1Stats.boundaries, v2: inn2Stats.boundaries, color1: '#00F0FF', color2: '#39FF14' },
                                  { label: 'Dot Balls', v1: inn1Stats.dots, v2: inn2Stats.dots, color1: '#00F0FF', color2: '#39FF14' },
                                  { label: 'Extras', v1: inn1Stats.extras, v2: inn2Stats.extras, color1: '#00F0FF', color2: '#39FF14' },
                                  { label: 'Wickets Lost', v1: inn1Stats.wickets, v2: inn2Stats.wickets, color1: '#00F0FF', color2: '#39FF14' },
                                ].map(item => {
                                  const max = Math.max(item.v1, item.v2, 1);
                                  return (
                                    <div key={item.label} className="space-y-1">
                                      <div className="flex justify-between text-[8px]">
                                        <span className="font-numbers font-black" style={{ color: item.color1 }}>{item.v1}</span>
                                        <span className="text-white/40 uppercase tracking-wider">{item.label}</span>
                                        <span className="font-numbers font-black" style={{ color: item.color2 }}>{item.v2}</span>
                                      </div>
                                      <div className="flex gap-1 h-2">
                                        <div className="flex-1 flex justify-end"><div className="h-full rounded-l-full transition-all" style={{ width: `${(item.v1 / max) * 100}%`, backgroundColor: item.color1, opacity: 0.7 }} /></div>
                                        <div className="flex-1"><div className="h-full rounded-r-full transition-all" style={{ width: `${(item.v2 / max) * 100}%`, backgroundColor: item.color2, opacity: 0.7 }} /></div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* ═══ INNINGS BREAKDOWN — BOUNDARIES & DOTS ═══ */}
                              <div className="grid grid-cols-2 gap-3">
                                {[{ team: inn1Team, stats: inn1Stats, color: '#00F0FF' }, { team: inn2Team, stats: inn2Stats, color: '#39FF14' }].map(({ team, stats, color }) => (
                                  <div key={team.id} className="p-4 rounded-[20px] bg-white/5 border border-white/10 space-y-3">
                                    <p className="text-[8px] font-black uppercase tracking-wider" style={{ color }}>{team.name}</p>
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-[8px]"><span className="text-white/40">4s</span><span className="text-white font-black font-numbers">{stats.fours}</span></div>
                                      <div className="flex justify-between text-[8px]"><span className="text-white/40">6s</span><span className="text-white font-black font-numbers">{stats.sixes}</span></div>
                                      <div className="flex justify-between text-[8px]"><span className="text-white/40">Boundary %</span><span className="text-white font-black font-numbers">{stats.boundaryPct}%</span></div>
                                      <div className="flex justify-between text-[8px]"><span className="text-white/40">Dot %</span><span className="text-white font-black font-numbers">{stats.dotPct}%</span></div>
                                      <div className="flex justify-between text-[8px]"><span className="text-white/40">Extras</span><span className="text-white font-black font-numbers">{stats.extras}</span></div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* ═══ EXTRAS BREAKDOWN ═══ */}
                              <div className="p-4 rounded-[20px] bg-white/[0.03] border border-white/[0.06] space-y-3">
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Extras Breakdown</p>
                                <div className="grid grid-cols-2 gap-3">
                                  {[{ team: inn1Team, stats: inn1Stats, color: '#00F0FF' }, { team: inn2Team, stats: inn2Stats, color: '#39FF14' }].map(({ team, stats, color }) => (
                                    <div key={team.id} className="space-y-1">
                                      <p className="text-[8px] font-black uppercase" style={{ color }}>{team.name} — {stats.extras}</p>
                                      <p className="text-[7px] text-white/40">WD {stats.wides} · NB {stats.noBalls} · B {stats.byes} · LB {stats.legByes}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* ═══ HEROES OF THE MATCH ═══ */}
                              <div className="space-y-4">
                                <p className="text-[9px] font-black text-[#FFD600] uppercase tracking-[0.2em]">Heroes of the Match</p>

                                {/* MOTM Card */}
                                {motm?.name && (
                                  <div className="p-5 rounded-[24px] bg-gradient-to-br from-[#FFD600]/20 to-[#FF6D00]/10 border border-[#FFD600]/30 space-y-3 relative overflow-hidden">
                                    <div className="absolute top-3 right-3 opacity-10 text-6xl">🏆</div>
                                    <div className="flex items-center justify-between">
                                      <p className="text-[10px] font-black text-[#FFD600] uppercase tracking-wider">Man of the Match</p>
                                      <Trophy size={16} className="text-[#FFD600]" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <img src={getPlayerAvatar(motm)} className="w-12 h-12 rounded-full border-2 border-[#FFD600]/40" />
                                      <div>
                                        <p className="text-[16px] font-black text-white">{motm.name}</p>
                                        <p className="text-[9px] text-white/50">{getTeamObj(motm.teamId || innings1TeamId).name}</p>
                                      </div>
                                    </div>
                                    <div className="flex gap-3 pt-1">
                                      {(motm.runs || 0) > 0 && <span className="text-[11px] font-numbers font-black text-[#00F0FF]">{motm.runs} runs ({motm.balls || 0}b)</span>}
                                      {(motm.wickets || 0) > 0 && <span className="text-[11px] font-numbers font-black text-[#FF6D00]">{motm.wickets}W</span>}
                                      {(motm.fours || 0) > 0 && <span className="text-[9px] font-numbers text-white/40">{motm.fours}×4</span>}
                                      {(motm.sixes || 0) > 0 && <span className="text-[9px] font-numbers text-white/40">{motm.sixes}×6</span>}
                                    </div>
                                    {(motm.balls || 0) > 0 && <p className="text-[8px] text-white/30 font-numbers">SR {(((motm.runs || 0) / (motm.balls || 1)) * 100).toFixed(1)}</p>}
                                  </div>
                                )}

                                {/* Award Cards Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                  {topScorer?.name && (
                                    <div className="p-4 rounded-[20px] bg-white/5 border border-white/10 space-y-2">
                                      <p className="text-[8px] font-black text-[#00F0FF] uppercase tracking-wider">🏏 Top Scorer</p>
                                      <div className="flex items-center gap-2">
                                        <img src={getPlayerAvatar(topScorer)} className="w-8 h-8 rounded-full border border-[#00F0FF]/30" />
                                        <div>
                                          <p className="text-[12px] font-black text-white">{topScorer.name}</p>
                                          <p className="text-[8px] text-white/40">{getTeamObj(topScorer.teamId || innings1TeamId).name}</p>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap gap-1 text-[8px] font-numbers pt-1">
                                        <span className="text-[#00F0FF] font-black">{topScorer.runs || 0}({topScorer.balls || 0})</span>
                                        {(topScorer.fours || 0) > 0 && <span className="text-white/30">{topScorer.fours}×4</span>}
                                        {(topScorer.sixes || 0) > 0 && <span className="text-white/30">{topScorer.sixes}×6</span>}
                                      </div>
                                      <p className="text-[7px] text-white/25 font-numbers">SR {(((topScorer.runs || 0) / (topScorer.balls || 1)) * 100).toFixed(1)}</p>
                                    </div>
                                  )}
                                  {bestBowler?.name && (
                                    <div className="p-4 rounded-[20px] bg-white/5 border border-white/10 space-y-2">
                                      <p className="text-[8px] font-black text-[#FF6D00] uppercase tracking-wider">🎯 Best Bowler</p>
                                      <div className="flex items-center gap-2">
                                        <img src={getPlayerAvatar(bestBowler)} className="w-8 h-8 rounded-full border border-[#FF6D00]/30" />
                                        <div>
                                          <p className="text-[12px] font-black text-white">{bestBowler.name}</p>
                                          <p className="text-[8px] text-white/40">{getTeamObj(bestBowler.teamId || innings2TeamId).name}</p>
                                        </div>
                                      </div>
                                      <div className="flex gap-1 text-[8px] font-numbers pt-1">
                                        <span className="text-[#FF6D00] font-black">{bestBowler.wickets || 0}/{bestBowler.runs_conceded || 0}</span>
                                        <span className="text-white/30">({Math.floor((bestBowler.balls_bowled || 0) / 6)}.{(bestBowler.balls_bowled || 0) % 6} ov)</span>
                                      </div>
                                      <p className="text-[7px] text-white/25 font-numbers">Econ {((bestBowler.runs_conceded || 0) / ((bestBowler.balls_bowled || 1) / 6)).toFixed(1)}</p>
                                    </div>
                                  )}
                                  {highestSR?.name && (
                                    <div className="p-4 rounded-[20px] bg-white/5 border border-white/10 space-y-2">
                                      <p className="text-[8px] font-black text-[#BC13FE] uppercase tracking-wider">⚡ Fastest SR</p>
                                      <div className="flex items-center gap-2">
                                        <img src={getPlayerAvatar(highestSR)} className="w-8 h-8 rounded-full border border-[#BC13FE]/30" />
                                        <div>
                                          <p className="text-[12px] font-black text-white">{highestSR.name}</p>
                                          <p className="text-[8px] text-white/40">{getTeamObj(highestSR.teamId || innings1TeamId).name}</p>
                                        </div>
                                      </div>
                                      <p className="text-[10px] font-numbers font-black text-[#BC13FE]">{(((highestSR.runs || 0) / (highestSR.balls || 1)) * 100).toFixed(1)}</p>
                                      <p className="text-[7px] text-white/25 font-numbers">{highestSR.runs || 0}({highestSR.balls || 0})</p>
                                    </div>
                                  )}
                                  {bestEconomy?.name && (
                                    <div className="p-4 rounded-[20px] bg-white/5 border border-white/10 space-y-2">
                                      <p className="text-[8px] font-black text-[#4DB6AC] uppercase tracking-wider">🧊 Best Economy</p>
                                      <div className="flex items-center gap-2">
                                        <img src={getPlayerAvatar(bestEconomy)} className="w-8 h-8 rounded-full border border-[#4DB6AC]/30" />
                                        <div>
                                          <p className="text-[12px] font-black text-white">{bestEconomy.name}</p>
                                          <p className="text-[8px] text-white/40">{getTeamObj(bestEconomy.teamId || innings2TeamId).name}</p>
                                        </div>
                                      </div>
                                      <p className="text-[10px] font-numbers font-black text-[#4DB6AC]">{((bestEconomy.runs_conceded || 0) / ((bestEconomy.balls_bowled || 1) / 6)).toFixed(1)}</p>
                                      <p className="text-[7px] text-white/25 font-numbers">{bestEconomy.wickets || 0}/{bestEconomy.runs_conceded || 0}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* ═══ BEST PARTNERSHIP ═══ */}
                              {(inn1BestPartnership || inn2BestPartnership) && (
                                <div className="p-4 rounded-[20px] bg-white/[0.03] border border-white/[0.06] space-y-3">
                                  <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Best Partnership</p>
                                  <div className="grid grid-cols-2 gap-3">
                                    {inn1BestPartnership && (
                                      <div className="space-y-1">
                                        <p className="text-[8px] font-black text-[#00F0FF] uppercase">{inn1Team.name}</p>
                                        <p className="text-[14px] font-numbers font-black text-white">{inn1BestPartnership.runs}<span className="text-[9px] text-white/30"> ({inn1BestPartnership.balls}b)</span></p>
                                        <p className="text-[7px] text-white/40">{inn1BestPartnership.wicketNum}{inn1BestPartnership.wicketNum === 1 ? 'st' : inn1BestPartnership.wicketNum === 2 ? 'nd' : inn1BestPartnership.wicketNum === 3 ? 'rd' : 'th'} wkt</p>
                                      </div>
                                    )}
                                    {inn2BestPartnership && (
                                      <div className="space-y-1">
                                        <p className="text-[8px] font-black text-[#39FF14] uppercase">{inn2Team.name}</p>
                                        <p className="text-[14px] font-numbers font-black text-white">{inn2BestPartnership.runs}<span className="text-[9px] text-white/30"> ({inn2BestPartnership.balls}b)</span></p>
                                        <p className="text-[7px] text-white/40">{inn2BestPartnership.wicketNum}{inn2BestPartnership.wicketNum === 1 ? 'st' : inn2BestPartnership.wicketNum === 2 ? 'nd' : inn2BestPartnership.wicketNum === 3 ? 'rd' : 'th'} wkt</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* ═══ FALL OF WICKETS ═══ */}
                              {(inn1FOW.length > 0 || inn2FOW.length > 0) && (
                                <div className="p-4 rounded-[20px] bg-white/[0.03] border border-white/[0.06] space-y-4">
                                  <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Fall of Wickets</p>
                                  {inn1FOW.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-[8px] font-black text-[#00F0FF] uppercase">{inn1Team.name}</p>
                                      <div className="flex flex-wrap gap-2">
                                        {inn1FOW.map(f => (
                                          <div key={f.wicketNum} className="px-3 py-2 rounded-xl bg-[#FF003C]/10 border border-[#FF003C]/20 text-center">
                                            <p className="text-[10px] font-numbers font-black text-white">{f.score}/{f.wicketNum}</p>
                                            <p className="text-[7px] text-white/30">{f.over} ov</p>
                                            <p className="text-[6px] text-[#FF003C]/60 truncate max-w-[60px]">{f.playerName}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {inn2FOW.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-[8px] font-black text-[#39FF14] uppercase">{inn2Team.name}</p>
                                      <div className="flex flex-wrap gap-2">
                                        {inn2FOW.map(f => (
                                          <div key={f.wicketNum} className="px-3 py-2 rounded-xl bg-[#FF003C]/10 border border-[#FF003C]/20 text-center">
                                            <p className="text-[10px] font-numbers font-black text-white">{f.score}/{f.wicketNum}</p>
                                            <p className="text-[7px] text-white/30">{f.over} ov</p>
                                            <p className="text-[6px] text-[#FF003C]/60 truncate max-w-[60px]">{f.playerName}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* ═══ FIELDING HIGHLIGHTS ═══ */}
                              {fielders.length > 0 && (
                                <div className="p-4 rounded-[20px] bg-white/[0.03] border border-white/[0.06] space-y-3">
                                  <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Fielding Highlights</p>
                                  <div className="space-y-2">
                                    {fielders.slice(0, 5).map(p => (
                                      <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                                        <div>
                                          <p className="text-[9px] font-black text-white">{p.name}</p>
                                          <p className="text-[7px] text-white/30">{getTeamObj(p.teamId || innings1TeamId).name}</p>
                                        </div>
                                        <div className="flex gap-2 text-[8px] font-numbers">
                                          {(p.catches || 0) > 0 && <span className="text-[#4DB6AC]">{p.catches}c</span>}
                                          {(p.stumpings || 0) > 0 && <span className="text-[#BC13FE]">{p.stumpings}st</span>}
                                          {(p.run_outs || 0) > 0 && <span className="text-[#FF6D00]">{p.run_outs}ro</span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* ═══ STAR PERFORMANCES ═══ */}
                              {(() => {
                                const stars = allPlayers
                                  .map(p => ({ ...p, impact: (p.runs || 0) + (p.wickets || 0) * 25 + (p.catches || 0) * 10 + (p.stumpings || 0) * 10 + (p.run_outs || 0) * 10 }))
                                  .sort((a, b) => b.impact - a.impact)
                                  .slice(0, 6);
                                return stars.length > 0 ? (
                                  <div className="space-y-3">
                                    <p className="text-[9px] font-black text-[#FFD600] uppercase tracking-[0.2em]">Star Performances</p>
                                    <div className="grid grid-cols-2 gap-3">
                                      {stars.map((player) => (
                                        <div key={player.id} className="p-3 rounded-[16px] bg-white/5 border border-white/10 space-y-1">
                                          <p className="text-[10px] font-black text-white truncate">{player.name}</p>
                                          <p className="text-[7px] text-white/40">{getTeamObj(player.teamId || innings1TeamId).name}</p>
                                          <div className="flex flex-wrap gap-1 text-[8px] font-numbers">
                                            {(player.runs || 0) > 0 && <span className="text-[#00F0FF]">{player.runs}({player.balls || 0})</span>}
                                            {(player.wickets || 0) > 0 && <span className="text-[#FF6D00]">{player.wickets}W</span>}
                                            {(player.catches || 0) > 0 && <span className="text-[#4DB6AC]">{player.catches}c</span>}
                                          </div>
                                          <div className="w-full bg-white/5 rounded-full h-1 mt-1">
                                            <div className="h-full rounded-full bg-[#FFD600]" style={{ width: `${Math.min(100, (player.impact / (stars[0]?.impact || 1)) * 100)}%` }} />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null;
                              })()}
                            </>
                          );
                        })()}
                      </motion.div>
                    )}

                    {/* SCORECARD TAB */}
                    {summaryTab === 'SCORECARD' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        {/* Innings 1 */}
                        <div className="space-y-3">
                          <button className="w-full p-3 rounded-[16px] bg-[#00F0FF]/10 border border-[#00F0FF]/20 text-left">
                            <p className="text-[11px] font-black text-[#00F0FF] uppercase">{getTeamObj(innings1TeamId).name}</p>
                            <p className="text-[9px] text-white/40 mt-1">{countingRuns.inn1}/{match.config.innings1Wickets || 0}</p>
                          </button>
                          <div className="space-y-2">
                            {(getTeamObj(innings1TeamId).squad || []).map((player) => (
                              <div key={player.id} className="p-3 rounded-[16px] bg-white/5 border border-white/10">
                                <div className="flex justify-between items-start mb-1">
                                  <div>
                                    <p className="text-[9px] font-black text-white">{player.name}</p>
                                    <p className="text-[8px] text-white/40">{player.isOut ? getWicketDetail(player, 1) : 'not out'}</p>
                                  </div>
                                  <p className="text-[9px] font-numbers text-[#00F0FF]">{player.runs || 0}({player.balls || 0})</p>
                                </div>
                                <div className="flex gap-2 text-[8px] text-white/40">
                                  {player.fours > 0 && <span>{player.fours}x4</span>}
                                  {player.sixes > 0 && <span>{player.sixes}x6</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Innings 2 */}
                        <div className="space-y-3">
                          <button className="w-full p-3 rounded-[16px] bg-[#39FF14]/10 border border-[#39FF14]/20 text-left">
                            <p className="text-[11px] font-black text-[#39FF14] uppercase">{getTeamObj(innings2TeamId).name}</p>
                            <p className="text-[9px] text-white/40 mt-1">{countingRuns.inn2}/{match.liveScore.wickets || 0}</p>
                          </button>
                          <div className="space-y-2">
                            {(getTeamObj(innings2TeamId).squad || []).map((player) => (
                              <div key={player.id} className="p-3 rounded-[16px] bg-white/5 border border-white/10">
                                <div className="flex justify-between items-start mb-1">
                                  <div>
                                    <p className="text-[9px] font-black text-white">{player.name}</p>
                                    <p className="text-[8px] text-white/40">{player.isOut ? getWicketDetail(player, 2) : 'not out'}</p>
                                  </div>
                                  <p className="text-[9px] font-numbers text-[#39FF14]">{player.runs || 0}({player.balls || 0})</p>
                                </div>
                                <div className="flex gap-2 text-[8px] text-white/40">
                                  {player.fours > 0 && <span>{player.fours}x4</span>}
                                  {player.sixes > 0 && <span>{player.sixes}x6</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Bowling — Innings 1 (bowled by innings2TeamId) */}
                        <div className="space-y-3 pt-4 border-t border-white/10">
                          <h4 className="text-[10px] font-black text-[#00F0FF] uppercase">Bowling — {getTeamObj(innings2TeamId).name}</h4>
                          {(getTeamObj(innings2TeamId).squad || []).filter(p => (p.wickets || 0) > 0 || (p.balls_bowled || 0) > 0).length > 0 ? (
                            (getTeamObj(innings2TeamId).squad || []).filter(p => (p.wickets || 0) > 0 || (p.balls_bowled || 0) > 0).map((player) => (
                              <div key={player.id} className="p-3 rounded-[16px] bg-white/5 border border-white/10 text-[8px]">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <img src={getPlayerAvatar(player)} className="w-7 h-7 rounded-full" />
                                    <div>
                                      <p className="font-black text-white">{player.name}</p>
                                      <p className="text-white/40">{Math.floor((player.balls_bowled || 0) / 6)}.{(player.balls_bowled || 0) % 6} ov</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-numbers text-[#FF6D00] font-black">{player.wickets || 0}-{player.runs_conceded || 0}</p>
                                    <p className="text-white/30 font-numbers">Econ {((player.runs_conceded || 0) / Math.max(1, (player.balls_bowled || 0) / 6)).toFixed(1)}</p>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-[8px] text-white/30 italic">No bowling data</p>
                          )}
                        </div>

                        {/* Bowling — Innings 2 (bowled by innings1TeamId) */}
                        <div className="space-y-3 pt-4 border-t border-white/10">
                          <h4 className="text-[10px] font-black text-[#39FF14] uppercase">Bowling — {getTeamObj(innings1TeamId).name}</h4>
                          {(getTeamObj(innings1TeamId).squad || []).filter(p => (p.wickets || 0) > 0 || (p.balls_bowled || 0) > 0).length > 0 ? (
                            (getTeamObj(innings1TeamId).squad || []).filter(p => (p.wickets || 0) > 0 || (p.balls_bowled || 0) > 0).map((player) => (
                              <div key={player.id} className="p-3 rounded-[16px] bg-white/5 border border-white/10 text-[8px]">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <img src={getPlayerAvatar(player)} className="w-7 h-7 rounded-full" />
                                    <div>
                                      <p className="font-black text-white">{player.name}</p>
                                      <p className="text-white/40">{Math.floor((player.balls_bowled || 0) / 6)}.{(player.balls_bowled || 0) % 6} ov</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-numbers text-[#FF6D00] font-black">{player.wickets || 0}-{player.runs_conceded || 0}</p>
                                    <p className="text-white/30 font-numbers">Econ {((player.runs_conceded || 0) / Math.max(1, (player.balls_bowled || 0) / 6)).toFixed(1)}</p>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-[8px] text-white/30 italic">No bowling data</p>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* COMMS TAB */}
                    {summaryTab === 'COMMS' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        {(() => {
                          const comms = (match.history || [])
                            .sort((a, b) => {
                              if (b.innings !== a.innings) return b.innings - a.innings;
                              if (b.overNumber !== a.overNumber) return b.overNumber - a.overNumber;
                              return (b.ballNumber || 0) - (a.ballNumber || 0);
                            })
                            .reduce((acc, ball) => {
                              const ballNum = `${ball.overNumber}.${ball.ballNumber}`;
                              let desc = '';
                              if (ball.isWicket) {
                                desc = `WICKET - ${ball.wicketType || 'out'}`;
                              } else if (ball.runsScored) {
                                desc = `${ball.runsScored} runs`;
                              } else if (ball.type === 'WD') {
                                desc = 'Wide';
                              } else if (ball.type === 'NB') {
                                desc = 'No Ball';
                              } else {
                                desc = 'Dot';
                              }
                              acc.push({ ballNum, desc, innings: ball.innings });
                              return acc;
                            }, [] as any[]);

                          const groupedByOver = comms.reduce((acc, c) => {
                            const key = `Innings ${c.innings} - Over ${Math.floor(parseFloat(c.ballNum))}`;
                            if (!acc[key]) acc[key] = [];
                            acc[key].push(c);
                            return acc;
                          }, {} as Record<string, any[]>);

                          return (
                            <>
                              {Object.entries(groupedByOver).map(([overKey, balls]) => (
                                <div key={overKey} className="space-y-2">
                                  <p className="text-[9px] font-black text-[#00F0FF] uppercase">{overKey}</p>
                                  {balls.map((ball, idx) => (
                                    <div key={idx} className="p-2 rounded-[12px] bg-white/5 border border-white/10">
                                      <p className="text-[8px] text-white/60">{ball.ballNum}</p>
                                      <p className="text-[9px] font-black text-white">{ball.desc}</p>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </>
                          );
                        })()}
                      </motion.div>
                    )}

                    {/* ANALYSIS TAB */}
                    {summaryTab === 'ANALYSIS' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        {(() => {
                          const inn1History = (match.history || []).filter(b => b.innings === 1);
                          const inn2History = (match.history || []).filter(b => b.innings === 2);

                          // Build per-over data
                          const buildPerOverData = (history: any[]) => {
                            const overs: {over: string, runs: number}[] = [];
                            let currentOver = -1;
                            let currentRuns = 0;
                            history.forEach(b => {
                              if (b.overNumber !== currentOver) {
                                if (currentOver >= 0) overs.push({ over: `${currentOver}`, runs: currentRuns });
                                currentOver = b.overNumber;
                                currentRuns = 0;
                              }
                              currentRuns += b.runsScored || 0;
                              if (b.type === 'WD' || b.type === 'NB') currentRuns += 1;
                            });
                            if (currentOver >= 0) overs.push({ over: `${currentOver}`, runs: currentRuns });
                            return overs;
                          };

                          // Build cumulative data
                          const buildCumulativeData = (history: any[]) => {
                            const overs: {over: string, cumulative: number}[] = [];
                            let currentOver = -1;
                            let cumulative = 0;
                            let currentRuns = 0;
                            history.forEach(b => {
                              if (b.overNumber !== currentOver) {
                                if (currentOver >= 0) {
                                  cumulative += currentRuns;
                                  overs.push({ over: `${currentOver}`, cumulative });
                                }
                                currentOver = b.overNumber;
                                currentRuns = 0;
                              }
                              currentRuns += b.runsScored || 0;
                              if (b.type === 'WD' || b.type === 'NB') currentRuns += 1;
                            });
                            if (currentOver >= 0) {
                              cumulative += currentRuns;
                              overs.push({ over: `${currentOver}`, cumulative });
                            }
                            return overs;
                          };

                          // Build scoring breakdown
                          const buildScoringBreakdown = (history: any[]) => {
                            const counts = {
                              'Dots': 0,
                              '1s': 0,
                              '2s': 0,
                              '3s': 0,
                              '4s': 0,
                              '6s': 0,
                              'Extras': 0
                            };
                            history.forEach(b => {
                              const isExtra = b.type === 'WD' || b.type === 'NB' || b.type === 'BYE' || b.type === 'LB';
                              if (isExtra) {
                                if (b.type === 'WD' || b.type === 'NB') counts['Extras'] += 1 + (b.runsScored || 0);
                                else counts['Extras'] += (b.runsScored || 0);
                              } else {
                                if (b.runsScored === 0) counts['Dots']++;
                                else if (b.runsScored === 1) counts['1s']++;
                                else if (b.runsScored === 2) counts['2s']++;
                                else if (b.runsScored === 3) counts['3s']++;
                                else if (b.runsScored === 4) counts['4s']++;
                                else if (b.runsScored === 6) counts['6s']++;
                              }
                            });
                            return Object.entries(counts).map(([type, count]) => ({ type, count }));
                          };

                          // Build wicket timeline
                          const buildWicketData = (history: any[]) => {
                            const data: {over: string, wickets: number}[] = [];
                            let currentOver = -1;
                            let wickets = 0;
                            history.forEach(b => {
                              if (b.overNumber !== currentOver) {
                                if (currentOver >= 0) data.push({ over: `${currentOver}`, wickets });
                                currentOver = b.overNumber;
                                wickets = 0;
                              }
                              if (b.isWicket) wickets++;
                            });
                            if (currentOver >= 0) data.push({ over: `${currentOver}`, wickets });
                            return data;
                          };

                          // Combine data for overlaid charts
                          const buildManhattanData = () => {
                            const inn1 = buildPerOverData(inn1History);
                            const inn2 = buildPerOverData(inn2History);
                            const maxOvers = Math.max(inn1.length, inn2.length);
                            const combined = [];
                            for (let i = 0; i < maxOvers; i++) {
                              combined.push({
                                over: `${i}`,
                                inn1Runs: inn1[i]?.runs || 0,
                                inn2Runs: inn2[i]?.runs || 0
                              });
                            }
                            return combined;
                          };

                          const buildRunProgressionData = () => {
                            const inn1 = buildCumulativeData(inn1History);
                            const inn2 = buildCumulativeData(inn2History);
                            const maxOvers = Math.max(inn1.length, inn2.length);
                            const combined = [];
                            for (let i = 0; i < maxOvers; i++) {
                              combined.push({
                                over: `${i}`,
                                inn1Cumulative: inn1[i]?.cumulative || 0,
                                inn2Cumulative: inn2[i]?.cumulative || 0
                              });
                            }
                            return combined;
                          };

                          const inn1Data = buildPerOverData(inn1History);
                          const inn2Data = buildPerOverData(inn2History);
                          const inn1Cumulative = buildCumulativeData(inn1History);
                          const inn2Cumulative = buildCumulativeData(inn2History);
                          const inn1Scoring = buildScoringBreakdown(inn1History);
                          const inn2Scoring = buildScoringBreakdown(inn2History);
                          const inn1Wickets = buildWicketData(inn1History);
                          const inn2Wickets = buildWicketData(inn2History);
                          const manhattanData = buildManhattanData();
                          const runProgressionData = buildRunProgressionData();

                          return (
                            <div className="space-y-6">
                              {/* CHART 1: MANHATTAN */}
                              {manhattanData.length > 0 && (
                                <div className="bg-white/[0.03] border border-white/[0.06] rounded-[20px] p-4 space-y-3">
                                  <p className="text-[11px] font-black text-white/70 uppercase tracking-[0.15em]">Manhattan</p>
                                  <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={manhattanData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                      <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                                      <XAxis dataKey="over" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                                      <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                                      <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: '#fff', fontSize: 11 }} itemStyle={{ fontSize: 10 }} />
                                      <Bar dataKey="inn1Runs" fill="#00F0FF" />
                                      <Bar dataKey="inn2Runs" fill="#39FF14" />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              )}

                              {/* CHART 2: WORM (Run Progression) */}
                              {runProgressionData.length > 0 && (
                                <div className="bg-white/[0.03] border border-white/[0.06] rounded-[20px] p-4 space-y-3">
                                  <p className="text-[11px] font-black text-white/70 uppercase tracking-[0.15em]">Run Progression</p>
                                  <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={runProgressionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                      <defs>
                                        <linearGradient id="gradInn1" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor="#00F0FF" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="gradInn2" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#39FF14" stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor="#39FF14" stopOpacity={0}/>
                                        </linearGradient>
                                      </defs>
                                      <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                                      <XAxis dataKey="over" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                                      <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                                      <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: '#fff', fontSize: 11 }} itemStyle={{ fontSize: 10 }} />
                                      <Area type="monotone" dataKey="inn1Cumulative" stroke="#00F0FF" fill="url(#gradInn1)" />
                                      <Area type="monotone" dataKey="inn2Cumulative" stroke="#39FF14" fill="url(#gradInn2)" />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                              )}

                              {/* CHART 3: RUN RATE PER OVER */}
                              {(() => {
                                const buildRRData = () => {
                                  const inn1 = buildPerOverData(inn1History);
                                  const inn2 = buildPerOverData(inn2History);
                                  const maxOvers = Math.max(inn1.length, inn2.length);
                                  const combined = [];
                                  let inn1Total = 0, inn2Total = 0;
                                  for (let i = 0; i < maxOvers; i++) {
                                    inn1Total += inn1[i]?.runs || 0;
                                    inn2Total += inn2[i]?.runs || 0;
                                    combined.push({
                                      over: `${i + 1}`,
                                      inn1CRR: i >= 0 && inn1[i] ? +((inn1Total / (i + 1)).toFixed(2)) : null,
                                      inn2CRR: i >= 0 && inn2[i] ? +((inn2Total / (i + 1)).toFixed(2)) : null,
                                    });
                                  }
                                  return combined;
                                };
                                const rrData = buildRRData();
                                return rrData.length > 0 ? (
                                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-[20px] p-4 space-y-3">
                                    <p className="text-[11px] font-black text-white/70 uppercase tracking-[0.15em]">Run Rate</p>
                                    <ResponsiveContainer width="100%" height={200}>
                                      <LineChart data={rrData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                                        <XAxis dataKey="over" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                                        <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                                        <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: '#fff', fontSize: 11 }} itemStyle={{ fontSize: 10 }} />
                                        <Line type="monotone" dataKey="inn1CRR" stroke="#00F0FF" strokeWidth={2} dot={{ r: 3, fill: '#00F0FF' }} name={getTeamObj(innings1TeamId).name} connectNulls />
                                        <Line type="monotone" dataKey="inn2CRR" stroke="#39FF14" strokeWidth={2} dot={{ r: 3, fill: '#39FF14' }} name={getTeamObj(innings2TeamId).name} connectNulls />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                ) : null;
                              })()}

                              {/* CHART 4: SCORING BREAKDOWN */}
                              {(inn1Scoring.length > 0 || inn2Scoring.length > 0) && (
                                <div className="bg-white/[0.03] border border-white/[0.06] rounded-[20px] p-4 space-y-3">
                                  <p className="text-[11px] font-black text-white/70 uppercase tracking-[0.15em]">Scoring Breakdown</p>
                                  <div className="grid grid-cols-1 gap-4">
                                    {/* Innings 1 */}
                                    <div>
                                      <p className="text-[9px] text-white/60 mb-2">{getTeamObj(innings1TeamId).name}</p>
                                      <ResponsiveContainer width="100%" height={120}>
                                        <BarChart data={inn1Scoring} layout="vertical" margin={{ top: 5, right: 10, left: 40, bottom: 5 }}>
                                          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                                          <XAxis type="number" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9 }} />
                                          <YAxis dataKey="type" type="category" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9 }} />
                                          <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: '#fff', fontSize: 10 }} />
                                          <Bar dataKey="count" fill="#00F0FF" />
                                        </BarChart>
                                      </ResponsiveContainer>
                                    </div>
                                    {/* Innings 2 */}
                                    <div>
                                      <p className="text-[9px] text-white/60 mb-2">{getTeamObj(innings2TeamId).name}</p>
                                      <ResponsiveContainer width="100%" height={120}>
                                        <BarChart data={inn2Scoring} layout="vertical" margin={{ top: 5, right: 10, left: 40, bottom: 5 }}>
                                          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                                          <XAxis type="number" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9 }} />
                                          <YAxis dataKey="type" type="category" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9 }} />
                                          <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: '#fff', fontSize: 10 }} />
                                          <Bar dataKey="count" fill="#39FF14" />
                                        </BarChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* CHART 5: WICKET MAP */}
                              {(inn1Wickets.length > 0 || inn2Wickets.length > 0) && (
                                <div className="bg-white/[0.03] border border-white/[0.06] rounded-[20px] p-4 space-y-3">
                                  <p className="text-[11px] font-black text-white/70 uppercase tracking-[0.15em]">Wicket Map</p>
                                  <div className="grid grid-cols-1 gap-4">
                                    {/* Innings 1 */}
                                    <div>
                                      <p className="text-[9px] text-white/60 mb-2">{getTeamObj(innings1TeamId).name}</p>
                                      <ResponsiveContainer width="100%" height={100}>
                                        <BarChart data={inn1Wickets} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                                          <XAxis dataKey="over" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9 }} />
                                          <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9 }} />
                                          <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: '#fff', fontSize: 10 }} />
                                          <Bar dataKey="wickets" fill="#FF6D00" />
                                        </BarChart>
                                      </ResponsiveContainer>
                                    </div>
                                    {/* Innings 2 */}
                                    <div>
                                      <p className="text-[9px] text-white/60 mb-2">{getTeamObj(innings2TeamId).name}</p>
                                      <ResponsiveContainer width="100%" height={100}>
                                        <BarChart data={inn2Wickets} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                                          <XAxis dataKey="over" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9 }} />
                                          <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9 }} />
                                          <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: '#fff', fontSize: 10 }} />
                                          <Bar dataKey="wickets" fill="#FF6D00" />
                                        </BarChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}

                    {/* MVP TAB */}
                    {summaryTab === 'HIGHLIGHTS' && (
                      <HighlightsPage
                        match={match}
                        onBack={() => setSummaryTab('SUMMARY')}
                      />
                    )}

                    {summaryTab === 'MVP' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3"
                      >
                        {(() => {
                          const mvpList = [...(match.teams.teamA.squad || []), ...(match.teams.teamB.squad || [])]
                            .map(p => ({
                              ...p,
                              impact: (p.runs || 0) + (p.wickets || 0) * 25 + (p.catches || 0) * 10 + (p.stumpings || 0) * 10 + (p.run_outs || 0) * 10
                            }))
                            .sort((a, b) => b.impact - a.impact);

                          return mvpList.map((player, idx) => (
                            <div key={player.id} className="p-4 rounded-[16px] bg-white/5 border border-white/10 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#00F0FF]/20 flex items-center justify-center">
                                <p className="text-[10px] font-black text-[#00F0FF]">#{idx + 1}</p>
                              </div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black text-white">{player.name}</p>
                                <p className="text-[8px] text-white/60">{getTeamObj(player.teamId || innings1TeamId).name}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] font-black text-[#FFD600]">{Math.round(player.impact)}</p>
                                <p className="text-[7px] text-white/40">impact</p>
                              </div>
                            </div>
                          ));
                        })()}
                      </motion.div>
                    )}

                    {/* Action Buttons - Bottom */}
                    <div className="space-y-3 pt-6 border-t border-white/10">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowShareSheet(true)}
                        className="w-full py-4 rounded-[20px] bg-gradient-to-r from-[#00F0FF] to-[#39FF14] text-black font-black uppercase text-[12px] tracking-[0.2em] flex items-center justify-center gap-2 transition-all shadow-[0_0_30px_rgba(0,240,255,0.2)]"
                      >
                        <Share2 size={16} />
                        Share
                      </motion.button>

                      <button
                        type="button"
                        onClick={() => {
                          // Clean up scorer flag from transfer
                          if (match.matchId) sessionStorage.removeItem(`22Y_I_AM_SCORER_${match.matchId}`);
                          setForcedSpectatorMode(null);
                          const freshState = createInitialState();
                          localStorage.setItem('22YARDS_ACTIVE_MATCH', JSON.stringify(freshState));
                          setMatch(freshState);
                          setStatus('CONFIG');
                          setWinnerTeam(null);
                          setSelectionTarget(null);
                          setConfigStep(1);
                          setVsRevealed(false);
                          setOverlayAnim(null);
                          setSummaryTab('SUMMARY');
                          setShowShareSheet(false);
                          setFireMode(false);
                          setFireModeBanner(false);
                          setFireModeDeclined(false);
                          setIceMode(false);
                          setIceModeBanner(false);
                          setIceModeDeclined(false);
                          setSummaryPhase('SKELETON');
                          setScorecardReady(false);
                          setPendingExtra(null);
                          isProcessingBall.current = false;
                        }}
                        className="w-full py-3 rounded-[16px] bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] font-black uppercase text-[10px] tracking-[0.15em] flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <Swords size={14} />
                        New Match
                      </button>
                    </div>

                    {/* Share Bottom Sheet */}
                    <AnimatePresence>
                      {showShareSheet && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setShowShareSheet(false)}
                          className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm flex items-end justify-center"
                        >
                          <motion.div
                            initial={{ y: 300, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 300, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md bg-[#0A0A0A] border-t border-white/10 rounded-t-[32px] p-6 pb-10 space-y-4"
                          >
                            {/* Handle bar */}
                            <div className="flex justify-center">
                              <div className="w-10 h-1 rounded-full bg-white/20" />
                            </div>
                            <h3 className="text-[13px] font-black text-white uppercase tracking-[0.2em] text-center">Share Match</h3>

                            <div className="space-y-2">
                              {/* Share Full Scorecard PDF */}
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => { setShowShareSheet(false); generateScorecardPDF(); }}
                                disabled={isCapturing}
                                className="w-full p-4 rounded-[16px] bg-white/5 border border-white/10 flex items-center gap-4 active:bg-white/10 transition-all disabled:opacity-50"
                              >
                                <div className="w-10 h-10 rounded-full bg-[#39FF14]/15 flex items-center justify-center">
                                  <ClipboardList size={18} className="text-[#39FF14]" />
                                </div>
                                <div className="text-left">
                                  <p className="text-[11px] font-black text-white uppercase tracking-[0.1em]">{isCapturing ? 'Generating...' : 'Full Scorecard PDF'}</p>
                                  <p className="text-[9px] text-white/40 mt-0.5">Download or share detailed scorecard</p>
                                </div>
                              </motion.button>

                              {/* Share to WhatsApp */}
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => {
                                  setShowShareSheet(false);
                                  const followUrl = `${window.location.origin}${window.location.pathname}?watch=${match.matchId}`;
                                  const result = winnerTeam ? `${winnerTeam.name} ${winnerTeam.margin}` : 'Match Complete';
                                  const text = `*${match.teams.teamA.name} vs ${match.teams.teamB.name}*\n\n${result}\n\nFull Scorecard: ${followUrl}\n\n_Scored on 22 Yards_`;
                                  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
                                }}
                                className="w-full p-4 rounded-[16px] bg-white/5 border border-white/10 flex items-center gap-4 active:bg-white/10 transition-all"
                              >
                                <div className="w-10 h-10 rounded-full bg-[#25D366]/15 flex items-center justify-center">
                                  <Share2 size={18} className="text-[#25D366]" />
                                </div>
                                <div className="text-left">
                                  <p className="text-[11px] font-black text-white uppercase tracking-[0.1em]">Share on WhatsApp</p>
                                  <p className="text-[9px] text-white/40 mt-0.5">Send result with match link</p>
                                </div>
                              </motion.button>

                              {/* Copy Link */}
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => {
                                  const followUrl = `${window.location.origin}${window.location.pathname}?watch=${match.matchId}`;
                                  navigator.clipboard.writeText(followUrl);
                                  setShareCopied(true);
                                  setTimeout(() => { setShareCopied(false); setShowShareSheet(false); }, 1200);
                                }}
                                className="w-full p-4 rounded-[16px] bg-white/5 border border-white/10 flex items-center gap-4 active:bg-white/10 transition-all"
                              >
                                <div className="w-10 h-10 rounded-full bg-[#00F0FF]/15 flex items-center justify-center">
                                  {shareCopied ? <Check size={18} className="text-[#39FF14]" /> : <Coins size={18} className="text-[#00F0FF]" />}
                                </div>
                                <div className="text-left">
                                  <p className="text-[11px] font-black text-white uppercase tracking-[0.1em]">{shareCopied ? 'Link Copied!' : 'Copy Match Link'}</p>
                                  <p className="text-[9px] text-white/40 mt-0.5">Copy scorecard URL to clipboard</p>
                                </div>
                              </motion.button>
                            </div>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* SQUAD EDITOR MODAL */}
      <AnimatePresence>
        {editingTeamId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/95 flex items-end md:items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="w-full max-w-2xl bg-[#0A0A0A] border border-white/10 rounded-[40px] overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <button
                  onClick={() => {
                    const squad = getTeamObj(editingTeamId)?.squad || [];
                    if (squad.length > 0 && (!isCaptainSelected() || !isWicketKeeperSelected())) {
                      // Don't close — the blinking prompt guides the user
                      return;
                    }
                    setEditingTeamId(null);
                  }}
                  className="p-2 -ml-2 text-[#00F0FF] hover:bg-white/5 rounded-full"
                >
                  <ChevronLeft size={20} />
                </button>
                <h3 className="font-heading text-xl uppercase italic">{getTeamObj(editingTeamId)?.name || 'Squad Editor'}</h3>
                <div className="w-10" />
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* ═══ TEAM IDENTITY — Name & Logo Editor ═══ */}
                <div className="space-y-4 p-4 rounded-[24px] bg-white/5 border border-white/10">
                  <p className="text-[11px] font-black text-[#00F0FF] uppercase tracking-[0.2em]">Team Identity</p>

                  {/* Logo upload / change */}
                  <div className="flex items-center gap-4">
                    <motion.label
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="relative w-20 h-20 rounded-2xl border-2 border-dashed border-white/15 hover:border-[#00F0FF]/40 cursor-pointer transition-all flex items-center justify-center overflow-hidden shrink-0 group"
                    >
                      {getTeamObj(editingTeamId)?.logo ? (
                        <>
                          <img src={getTeamObj(editingTeamId)?.logo} className="w-full h-full object-cover" alt="Team logo" />
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera size={18} className="text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Camera size={20} className="text-white/30" />
                          <span className="text-[7px] text-white/25 uppercase tracking-wider font-black">Logo</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const key = editingTeamId === 'A' ? 'teamA' : 'teamB';
                              setMatch(m => ({
                                ...m,
                                teams: {
                                  ...m.teams,
                                  [key]: {
                                    ...m.teams[key],
                                    logo: event.target?.result as string
                                  }
                                }
                              }));
                            };
                            reader.readAsDataURL(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                    </motion.label>

                    <div className="flex-1 space-y-2">
                      <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Team Name</label>
                      {editingTeamNameId === editingTeamId ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            autoFocus
                            defaultValue={getTeamObj(editingTeamId)?.name || ''}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
                                if (val) {
                                  const key = editingTeamId === 'A' ? 'teamA' : 'teamB';
                                  setMatch(m => ({
                                    ...m,
                                    teams: { ...m.teams, [key]: { ...m.teams[key], name: val } }
                                  }));
                                }
                                setEditingTeamNameId(null);
                              }
                              if (e.key === 'Escape') setEditingTeamNameId(null);
                            }}
                            onBlur={(e) => {
                              const val = e.target.value.trim().toUpperCase();
                              if (val) {
                                const key = editingTeamId === 'A' ? 'teamA' : 'teamB';
                                setMatch(m => ({
                                  ...m,
                                  teams: { ...m.teams, [key]: { ...m.teams[key], name: val } }
                                }));
                              }
                              setEditingTeamNameId(null);
                            }}
                            className="flex-1 bg-white/10 border border-[#00F0FF]/30 rounded-xl px-3 py-2 text-white font-black uppercase text-sm outline-none focus:border-[#00F0FF] placeholder:text-white/25"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingTeamNameId(editingTeamId)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all group"
                        >
                          <span className="font-black text-white uppercase text-sm truncate">{getTeamObj(editingTeamId)?.name || 'Unnamed'}</span>
                          <Edit2 size={12} className="text-white/20 group-hover:text-[#00F0FF] shrink-0 ml-2 transition-colors" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Remove logo button if one exists */}
                  {getTeamObj(editingTeamId)?.logo && (
                    <button
                      onClick={() => {
                        const key = editingTeamId === 'A' ? 'teamA' : 'teamB';
                        setMatch(m => ({
                          ...m,
                          teams: { ...m.teams, [key]: { ...m.teams[key], logo: undefined } }
                        }));
                      }}
                      className="text-[9px] font-black text-[#FF003C]/60 hover:text-[#FF003C] uppercase tracking-wider transition-colors"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>

                {/* Current Squad */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">Current Squad</p>
                    {(!isCaptainSelected() || !isWicketKeeperSelected()) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="px-2 py-1 bg-[#FF6D00]/20 border border-[#FF6D00] rounded-full text-[8px] font-black text-[#FF6D00] uppercase"
                      >
                        {!isCaptainSelected() && !isWicketKeeperSelected() ? 'Set Captain & WK' : !isCaptainSelected() ? 'Set Captain' : 'Set WK'}
                      </motion.div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {(getTeamObj(editingTeamId)?.squad || []).map((player) => (
                      <div key={player.id} className="p-3 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <img src={getPlayerAvatar(player)} alt={player.name} className="w-8 h-8 rounded-full" />
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-white">{player.name}</p>
                            <p className="text-[8px] text-white/40">{player.phone || 'No phone'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleSetCaptain(player.id)}
                            title="Set as Captain"
                            className={`p-2 rounded-lg transition-all ${
                              player.isCaptain
                                ? 'bg-[#FFD600]/30 text-[#FFD600] border border-[#FFD600]'
                                : 'bg-white/5 text-white/40 hover:text-white border border-transparent hover:border-white/20'
                            }`}
                          >
                            <Crown size={14} />
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleSetWicketKeeper(player.id)}
                            title="Set as Wicket Keeper"
                            className={`p-2 rounded-lg transition-all ${
                              player.isWicketKeeper
                                ? 'bg-[#00F0FF]/30 text-[#00F0FF] border border-[#00F0FF]'
                                : 'bg-white/5 text-white/40 hover:text-white border border-transparent hover:border-white/20'
                            }`}
                          >
                            <GloveIcon size={14} />
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setMatch(m => {
                              const key = editingTeamId === 'A' ? 'teamA' : 'teamB';
                              return { ...m, teams: { ...m.teams, [key]: { ...m.teams[key], squad: m.teams[key].squad.filter(p => p.id !== player.id) } } };
                            })}
                            className="p-2 text-[#FF003C] hover:bg-[#FF003C]/20 rounded-lg transition-all border border-transparent hover:border-[#FF003C]/30"
                          >
                            <Trash2 size={14} />
                          </motion.button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* New Recruitment */}
                <div className="space-y-3 p-4 rounded-[24px] bg-white/5 border border-white/10">
                  <p className="text-[11px] font-black text-[#00F0FF] uppercase tracking-[0.2em]">New Recruitment</p>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Player name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value.toUpperCase())}
                      className="w-full px-3 py-3 min-h-[34px] rounded-[12px] bg-white/10 border border-white/20 text-[13px] text-white placeholder:text-white/40 outline-none"
                    />
                    {showPlayerDropdown && playerDropdownList.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 max-h-48 overflow-y-auto bg-[#1A1A1A] border border-white/20 rounded-[12px] z-50 shadow-2xl"
                      >
                        {playerDropdownList.map((p) => (
                          <motion.button
                            key={p.id}
                            whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                            onClick={() => handleSelectVaultPlayer(p)}
                            className="w-full px-3 py-2 text-left text-[12px] text-white hover:bg-white/10 transition-all border-b border-white/5 last:border-b-0"
                          >
                            <p className="font-black">{p.name}</p>
                            <p className="text-[10px] text-white/40">{p.phone}</p>
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Phone (10 digits)"
                    value={phoneQuery}
                    onChange={(e) => setPhoneQuery(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    maxLength={10}
                    className="w-full px-3 py-3 min-h-[34px] rounded-[12px] bg-white/10 border border-white/20 text-[13px] text-white placeholder:text-white/40 outline-none"
                  />
                  <button
                    onClick={startQRScanner}
                    className="w-full py-3 min-h-[34px] rounded-[12px] bg-white/10 border border-white/20 text-[12px] font-black text-[#00F0FF] uppercase hover:bg-white/15 transition-all flex items-center justify-center gap-2"
                  >
                    <Camera size={14} /> Scan QR
                  </button>
                </div>

                {/* Add Player Button */}
                <button
                  type="button"
                  onClick={() => { handleEnlistNewPlayer(); }}
                  className={`w-full min-h-[38px] py-4 rounded-[20px] font-black uppercase text-[13px] tracking-[0.2em] transition-all duration-150 flex items-center justify-center gap-2 select-none touch-manipulation ${
                    isAddPlayerDisabled
                      ? 'bg-white/5 text-white/40 pointer-events-none'
                      : 'bg-[#00F0FF] text-black shadow-[0_4px_20px_rgba(0,240,255,0.3)] cursor-pointer active:scale-95 active:shadow-[0_0_10px_rgba(0,240,255,0.5)]'
                  }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <Plus size={18} />
                  <span>Add Player</span>
                </button>
              </div>

              <div className="p-4 border-t border-white/5">
                {isCaptainSelected() && isWicketKeeperSelected() ? (
                  <button
                    onClick={() => setEditingTeamId(null)}
                    className="w-full py-4 rounded-[20px] bg-[#39FF14] text-black font-black text-[12px] uppercase tracking-[0.2em] hover:shadow-[0_0_20px_rgba(57,255,20,0.3)] transition-all active:scale-[0.98]"
                  >
                    Save Squadron
                  </button>
                ) : (
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-full py-4 rounded-[20px] bg-[#FF6D00]/15 border-2 border-dashed border-[#FF6D00]/50 text-center"
                  >
                    <p className="text-[11px] font-black text-[#FF6D00] uppercase tracking-[0.2em]">
                      {!isCaptainSelected() && !isWicketKeeperSelected()
                        ? 'Select Captain & Wicket Keeper'
                        : !isCaptainSelected()
                        ? 'Select Captain'
                        : 'Select Wicket Keeper'}
                    </p>
                    <p className="text-[9px] text-[#FF6D00]/60 mt-1">Tap the crown or glove icon next to a player</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LIVE SCORECARD MODAL */}
      <AnimatePresence>
        {showLiveScorecard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLiveScorecard(false)}
            className="fixed inset-0 z-[4000] bg-black/95 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-[#0A0A0A] border border-white/10 rounded-[40px] overflow-hidden max-h-[80vh] overflow-y-auto p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-xl uppercase italic text-[#00F0FF]">Live Scorecard</h3>
                <button onClick={() => setShowLiveScorecard(false)} className="p-2 text-white/40 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              {/* Batting Team */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black text-[#00F0FF] uppercase tracking-[0.2em]">Batting</p>
                  <button
                    onClick={() => { setShowLiveScorecard(false); setShowAddPlayer({ open: true, team: 'batting' }); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all"
                  >
                    <UserPlus size={12} />
                    Add Player
                  </button>
                </div>
                <div className="space-y-2">
                  {(match.teams[match.teams.battingTeamId === 'A' ? 'teamA' : 'teamB']?.squad || []).map((player) => (
                    <div key={player.id} className="p-3 rounded-[16px] bg-white/5 border border-white/10 flex justify-between items-center">
                      <p className="text-[10px] font-black text-white">{player.name}</p>
                      <p className="text-[10px] font-numbers text-[#00F0FF]">{player.runs}({player.balls}) {player.fours > 0 ? `${player.fours}x4` : ''} {player.sixes > 0 ? `${player.sixes}x6` : ''}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bowling Team */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black text-[#39FF14] uppercase tracking-[0.2em]">Bowling</p>
                  <button
                    onClick={() => { setShowLiveScorecard(false); setShowAddPlayer({ open: true, team: 'bowling' }); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all"
                  >
                    <UserPlus size={12} />
                    Add Player
                  </button>
                </div>
                <div className="space-y-2">
                  {(match.teams[match.teams.bowlingTeamId === 'A' ? 'teamA' : 'teamB']?.squad || []).map((player) => (
                    <div key={player.id} className="p-3 rounded-[16px] bg-white/5 border border-white/10 flex justify-between items-center">
                      <p className="text-[10px] font-black text-white">{player.name}</p>
                      <p className="text-[10px] font-numbers text-[#39FF14]">{Math.floor((player.balls_bowled || 0) / 6)}.{(player.balls_bowled || 0) % 6} - {player.runs_conceded}/{player.wickets}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SHARE MODAL */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowShareModal(false)}
            className="fixed inset-0 z-[4000] bg-black/95 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-[40px] overflow-hidden p-6 space-y-4"
            >
              <h3 className="font-heading text-lg uppercase italic text-[#00F0FF]">Share Score</h3>
              <pre className="p-4 rounded-[16px] bg-white/5 border border-white/10 text-[10px] text-white/80 overflow-x-auto">
                {shareText}
              </pre>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleShareAction('whatsapp')}
                  className="py-2 rounded-[12px] bg-[#25D366] text-black font-black text-[11px] uppercase"
                >
                  WhatsApp
                </button>
                <button
                  onClick={() => handleShareAction('copy')}
                  className="py-2 rounded-[12px] bg-[#00F0FF] text-black font-black text-[11px] uppercase"
                >
                  {shareCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MATCH SETTINGS MODAL (mid-match) */}
      <AnimatePresence>
        {showMatchSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowMatchSettings(false); setAbandonConfirm(false); setAbandonReason(''); }}
            className="fixed inset-0 z-[5000] bg-black/90 flex items-end justify-center"
          >
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#0A0A0A] border-t border-white/10 rounded-t-[32px] p-6 space-y-5"
            >
              {/* Handle bar */}
              <div className="flex justify-center">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="flex items-center justify-between">
                <h3 className="font-heading text-lg uppercase italic text-[#00F0FF]">Match Settings</h3>
                <button onClick={() => { setShowMatchSettings(false); setAbandonConfirm(false); setAbandonReason(''); }} className="p-2 text-white/40 hover:text-white"><X size={18} /></button>
              </div>

              {/* TRANSFER SCORING — Device Handoff */}
              <button
                onClick={() => { setShowMatchSettings(false); openTransferModal(); }}
                className="w-full py-4 rounded-[20px] bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] font-black text-[12px] uppercase tracking-wider hover:bg-[#00F0FF]/20 transition-all flex items-center justify-center gap-3"
              >
                <Smartphone size={18} />
                Transfer Scoring to Another Device
              </button>

              {/* SPECTATOR LINK — share live view */}
              <button
                onClick={() => { setShowMatchSettings(false); setTransferTab('SPECTATOR'); pushLiveMatchState(match); setShowTransferModal(true); }}
                className="w-full py-4 rounded-[20px] bg-[#BC13FE]/10 border border-[#BC13FE]/30 text-[#BC13FE] font-black text-[12px] uppercase tracking-wider hover:bg-[#BC13FE]/20 transition-all flex items-center justify-center gap-3"
              >
                <Users size={18} />
                Spectator Link
              </button>

              {/* GO LIVE — YouTube Streaming */}
              <button
                onClick={() => { setShowMatchSettings(false); setShowYouTubeModal(true); }}
                className="w-full py-4 rounded-[20px] bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] font-black text-[12px] uppercase tracking-wider hover:bg-[#39FF14]/20 transition-all flex items-center justify-center gap-3"
              >
                <Video size={18} />
                Go Live on YouTube
              </button>

              {match.config.scorerName && (
                <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider text-center">Current scorer: {match.config.scorerName}</p>
              )}

              {/* RAIN DELAY — DLS */}
              <button
                onClick={() => { setShowMatchSettings(false); setDlsReducedOvers(Math.max(1, match.config.overs - 2)); setShowDLSModal(true); }}
                className="w-full py-4 rounded-[20px] bg-[#FFD600]/10 border border-[#FFD600]/30 text-[#FFD600] font-black text-[12px] uppercase tracking-wider hover:bg-[#FFD600]/20 transition-all flex items-center justify-center gap-3"
              >
                <Activity size={18} />
                Rain Delay (DLS Method)
              </button>

              {/* DIVIDER */}
              <div className="h-px bg-white/10" />

              {/* ABANDON MATCH */}
              {!abandonConfirm ? (
                <button
                  onClick={() => setAbandonConfirm(true)}
                  className="w-full py-4 rounded-[20px] bg-[#FF003C]/10 border border-[#FF003C]/30 text-[#FF003C] font-black text-[12px] uppercase tracking-wider hover:bg-[#FF003C]/20 transition-all flex items-center justify-center gap-3"
                >
                  <ShieldAlert size={18} />
                  Abandon Match
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 p-4 rounded-[20px] bg-[#FF003C]/5 border border-[#FF003C]/20"
                >
                  <div className="flex items-center gap-2 text-[#FF003C]">
                    <ShieldAlert size={16} />
                    <span className="text-[11px] font-black uppercase tracking-wider">Are you sure?</span>
                  </div>
                  <p className="text-[10px] text-white/50">This action cannot be undone. The match will be recorded as abandoned.</p>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-[0.15em]">Reason (optional)</label>
                    <select
                      value={abandonReason}
                      onChange={(e) => setAbandonReason(e.target.value)}
                      className="w-full px-4 py-3 rounded-[12px] bg-white/5 border border-white/10 text-white text-[12px] focus:outline-none focus:border-[#FF003C]/50 appearance-none"
                    >
                      <option value="">Select reason...</option>
                      <option value="Rain / Bad weather">Rain / Bad weather</option>
                      <option value="Bad light">Bad light</option>
                      <option value="Player injury">Player injury</option>
                      <option value="Unplayable pitch">Unplayable pitch</option>
                      <option value="Mutual agreement">Mutual agreement</option>
                      <option value="Insufficient players">Insufficient players</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => { setAbandonConfirm(false); setAbandonReason(''); }}
                      className="flex-1 py-3 rounded-[16px] bg-white/5 border border-white/10 text-white text-[11px] font-black uppercase tracking-wider hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAbandonMatch}
                      className="flex-1 py-3 rounded-[16px] bg-[#FF003C] text-white text-[11px] font-black uppercase tracking-wider hover:bg-[#FF003C]/90 transition-all active:scale-[0.98]"
                    >
                      Confirm Abandon
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DLS RAIN DELAY MODAL */}
      {showDLSModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowDLSModal(false)}
          className="fixed inset-0 z-[5000] bg-black/90 flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#0A0A0A] border border-[#FFD600]/20 rounded-[24px] p-6 space-y-5"
          >
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#FFD600]/10 flex items-center justify-center">
                <Activity size={24} className="text-[#FFD600]" />
              </div>
              <h3 className="font-heading text-xl uppercase italic text-[#FFD600]">Rain Delay</h3>
              <p className="text-[10px] text-white/50 font-bold">DLS Method will revise the target</p>
            </div>

            <div className="space-y-3">
              <label className="text-[9px] font-black text-white/40 uppercase tracking-[0.15em]">
                {match.currentInnings === 1 ? 'Reduce Innings 1 to' : 'Reduce Innings 2 to'} (overs)
              </label>
              <div className="flex items-center gap-4 justify-center">
                <button
                  onClick={() => setDlsReducedOvers(v => Math.max(1, v - 1))}
                  className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10"
                >
                  <Minus size={18} />
                </button>
                <span className="font-numbers text-4xl font-black text-[#FFD600] w-16 text-center">{dlsReducedOvers}</span>
                <button
                  onClick={() => setDlsReducedOvers(v => Math.min(match.config.overs - 1, v + 1))}
                  className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10"
                >
                  <Plus size={18} />
                </button>
              </div>
              <p className="text-[9px] text-white/30 text-center">Original: {match.config.overs} overs → New: {dlsReducedOvers} overs</p>
            </div>

            {match.currentInnings === 2 && match.config.innings1Score !== undefined && (
              <div className="p-4 rounded-[16px] bg-[#FFD600]/5 border border-[#FFD600]/10 text-center space-y-1">
                <p className="text-[9px] text-white/40 font-black uppercase tracking-wider">Revised DLS Target</p>
                <p className="font-numbers text-3xl font-black text-[#FFD600]">
                  {(() => {
                    const result = calculateDLSTarget({
                      team1Score: match.config.innings1Score || 0,
                      team1OversAvailable: match.config.overs,
                      team1OversUsed: (match.config.innings1Balls || 0) / 6,
                      team1WicketsAtInterruption: match.config.innings1Wickets || 0,
                      team2OversAvailable: dlsReducedOvers,
                      team2WicketsLost: match.liveScore.wickets,
                      team2BallsBowled: match.liveScore.balls,
                      matchOvers: match.config.overs,
                    });
                    return result.revisedTarget;
                  })()}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowDLSModal(false)}
                className="flex-1 py-3 rounded-[16px] bg-white/5 border border-white/10 text-white text-[11px] font-black uppercase tracking-wider hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDLSRainDelay(dlsReducedOvers)}
                className="flex-1 py-3 rounded-[16px] bg-[#FFD600] text-black text-[11px] font-black uppercase tracking-wider hover:bg-[#FFD600]/90 active:scale-[0.98]"
              >
                Apply DLS
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* SUPER OVER PROMPT */}
      {showSuperOverPrompt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[6000] bg-black/95 flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className="w-full max-w-sm bg-[#0A0A0A] border border-[#FFD600]/30 rounded-[28px] p-8 space-y-6 text-center"
          >
            <div className="space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#FFD600]/10 flex items-center justify-center">
                <Swords size={28} className="text-[#FFD600]" />
              </div>
              <h2 className="font-heading text-3xl uppercase italic text-[#FFD600]">Match Tied!</h2>
              <p className="text-[11px] text-white/50 font-bold">Both teams scored {match.config.innings1Score} runs</p>
            </div>

            <div className="space-y-3">
              <motion.button
                onClick={startSuperOver}
                whileTap={{ scale: 0.95 }}
                className="w-full py-5 rounded-[20px] bg-gradient-to-r from-[#FFD600] to-[#FF6D00] text-black font-black text-[13px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,214,0,0.3)]"
              >
                <Zap size={18} />
                Start Super Over
              </motion.button>

              <button
                onClick={() => {
                  setShowSuperOverPrompt(false);
                  setWinnerTeam({ name: 'Match Tied', id: null, margin: `Both teams scored ${match.config.innings1Score} runs` });
                  setTimeout(() => setStatus('SUMMARY'), 100);
                }}
                className="w-full py-4 rounded-[20px] bg-white/5 border border-white/10 text-white/60 font-black text-[11px] uppercase tracking-wider"
              >
                End as Tie
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* SUPER OVER SCREEN */}
      {(status === 'SUPER_OVER' && superOverState) && (
        <div className="fixed inset-0 z-[5500] bg-[#050505] flex flex-col overflow-auto">
          {/* Header */}
          <div className="super-over-header h-14 flex items-center px-5 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-3 flex-1">
              <Swords size={18} className="text-[#FFD600]" />
              <span className="font-heading text-sm uppercase italic text-[#FFD600]">
                Super Over {superOverState.superOverNumber > 1 ? `#${superOverState.superOverNumber}` : ''}
              </span>
            </div>
            <div className="font-numbers text-xs text-white/40">
              {superOverPhase === 'BATTING_TEAM1' || superOverPhase === 'BATTING_TEAM2' ? (
                `${superOverState.currentBatting === 1 ? superOverState.team1Score.runs : superOverState.team2Score.runs}/${superOverState.currentBatting === 1 ? superOverState.team1Score.wickets : superOverState.team2Score.wickets} (${((superOverState.currentBatting === 1 ? superOverState.team1Score.balls : superOverState.team2Score.balls) / 6).toFixed(1)} ov)`
              ) : ''}
            </div>
          </div>

          {/* SETUP PHASE — Select batsmen & bowler */}
          {(superOverPhase === 'SETUP_TEAM1' || superOverPhase === 'SETUP_TEAM2') && (() => {
            const teamNum = superOverPhase === 'SETUP_TEAM1' ? 1 : 2;
            const teamId = teamNum === 1 ? superOverState.team1Id : superOverState.team2Id;
            const teamKey = teamId === 'A' ? 'teamA' : 'teamB';
            const team = match.teams[teamKey];
            const oppositeTeamId = teamNum === 1 ? superOverState.team2Id : superOverState.team1Id;
            const oppositeKey = oppositeTeamId === 'A' ? 'teamA' : 'teamB';
            const oppositeTeam = match.teams[oppositeKey];
            // Apply ICC ineligibility rules for subsequent Super Overs:
            //  - Dismissed batsmen in previous SOs cannot bat.
            //  - Bowler who bowled the previous SO cannot bowl again.
            const ineligibleBatsmen = new Set(superOverState.ineligibleBatsmen || []);
            const ineligibleBowlersForThisTeam = new Set(
              (superOverState.ineligibleBowlers && superOverState.ineligibleBowlers[oppositeTeamId]) || []
            );
            const squad = (team?.squad || []).filter((p: any) => !ineligibleBatsmen.has(p.id));
            const oppositeSquad = (oppositeTeam?.squad || []).filter((p: any) => !ineligibleBowlersForThisTeam.has(p.id));

            return (
              <div className="flex-1 overflow-auto p-5 space-y-5">
                <div className="text-center space-y-2">
                  <h3 className="font-heading text-2xl uppercase italic text-white">{team?.name || 'Team'}</h3>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">
                    {teamNum === 1 ? 'Batting First' : 'Batting Second'} — Select Players
                  </p>
                </div>

                {/* Select Batsmen (up to 3) */}
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-[#00F0FF]/60 uppercase tracking-[0.2em]">
                    Select Batsmen ({soSelectedBatsmen.length}/3)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {squad.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (soSelectedBatsmen.includes(p.id)) {
                            setSoSelectedBatsmen(prev => prev.filter(id => id !== p.id));
                          } else if (soSelectedBatsmen.length < 3) {
                            setSoSelectedBatsmen(prev => [...prev, p.id]);
                          }
                        }}
                        className={`px-3 py-3 rounded-[14px] text-left text-[11px] font-bold border transition-all ${
                          soSelectedBatsmen.includes(p.id)
                            ? 'bg-[#00F0FF]/15 border-[#00F0FF]/50 text-[#00F0FF]'
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {p.name || 'Player'}
                        {soSelectedBatsmen.includes(p.id) && <Check size={12} className="inline ml-2" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Select Bowler from opposing team */}
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-[#FF003C]/60 uppercase tracking-[0.2em]">
                    Select Bowler from {oppositeTeam?.name || 'Opposition'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {oppositeSquad.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSoSelectedBowler(soSelectedBowler === p.id ? null : p.id)}
                        className={`px-3 py-3 rounded-[14px] text-left text-[11px] font-bold border transition-all ${
                          soSelectedBowler === p.id
                            ? 'bg-[#FF003C]/15 border-[#FF003C]/50 text-[#FF003C]'
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {p.name || 'Player'}
                        {soSelectedBowler === p.id && <Check size={12} className="inline ml-2" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Confirm button */}
                <motion.button
                  onClick={() => {
                    if (soSelectedBatsmen.length >= 2 && soSelectedBowler) {
                      // Set bowler in crease
                      const newState = { ...superOverState };
                      newState.crease = { ...newState.crease, bowlerId: soSelectedBowler };
                      setSuperOverState(newState);
                      confirmSuperOverLineup(teamNum as 1 | 2);
                    }
                  }}
                  disabled={soSelectedBatsmen.length < 2 || !soSelectedBowler}
                  whileTap={{ scale: 0.95 }}
                  className={`w-full py-5 rounded-[20px] font-black text-[13px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all ${
                    soSelectedBatsmen.length >= 2 && soSelectedBowler
                      ? 'bg-[#39FF14] text-black shadow-[0_0_30px_rgba(57,255,20,0.3)]'
                      : 'bg-white/5 text-white/20 cursor-not-allowed'
                  }`}
                >
                  <Check size={18} />
                  Confirm Lineup
                </motion.button>
              </div>
            );
          })()}

          {/* BATTING PHASE — Scoring keypad */}
          {(superOverPhase === 'BATTING_TEAM1' || superOverPhase === 'BATTING_TEAM2') && (() => {
            const teamNum = superOverState.currentBatting;
            const teamId = teamNum === 1 ? superOverState.team1Id : superOverState.team2Id;
            const teamKey = teamId === 'A' ? 'teamA' : 'teamB';
            const team = match.teams[teamKey];
            const score = teamNum === 1 ? superOverState.team1Score : superOverState.team2Score;
            const history = teamNum === 1 ? superOverState.team1History : superOverState.team2History;
            const striker = superOverState.crease.strikerId;
            const nonStriker = superOverState.crease.nonStrikerId;
            const allSquad = [...(match.teams.teamA?.squad || []), ...(match.teams.teamB?.squad || [])];
            const strikerName = allSquad.find(p => p.id === striker)?.name || 'Striker';
            const nonStrikerName = allSquad.find(p => p.id === nonStriker)?.name || 'Non-Striker';
            const bowlerName = allSquad.find(p => p.id === superOverState.crease.bowlerId)?.name || 'Bowler';

            // Target for team 2
            const target2 = teamNum === 2 ? superOverState.team1Score.runs + 1 : null;
            const needFromBalls = target2 ? `Need ${target2 - score.runs} from ${6 - score.balls} balls` : null;

            return (
              <div className="flex-1 overflow-auto p-5 space-y-4">
                {/* Score display */}
                <div className="text-center space-y-2 py-4">
                  <p className="text-[9px] font-black text-[#FFD600]/60 uppercase tracking-[0.3em]">{team?.name || 'Team'}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-numbers text-[56px] font-black text-white leading-none">{score.runs}</span>
                    <span className="font-numbers text-[28px] font-black text-[#FF003C] leading-none">/{score.wickets}</span>
                  </div>
                  <p className="font-numbers text-sm text-white/40">{Math.floor(score.balls / 6)}.{score.balls % 6} overs</p>
                  {needFromBalls && (
                    <p className="text-[11px] font-black text-[#39FF14] uppercase tracking-wider">{needFromBalls}</p>
                  )}
                </div>

                {/* Crease info */}
                <div className="flex justify-between px-2 py-2 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px]">
                    <span className="text-[#00F0FF] font-black">⚡ {strikerName}</span>
                  </div>
                  <div className="text-[10px] text-white/40">{nonStrikerName}</div>
                  <div className="text-[10px] text-[#FF003C]">🏐 {bowlerName}</div>
                </div>

                {/* Ball history */}
                <div className="flex gap-2 px-1">
                  {[0,1,2,3,4,5].map(i => {
                    const ball = history[i];
                    return (
                      <div key={i} className={`flex-1 h-10 rounded-lg flex items-center justify-center font-numbers text-sm font-black ${
                        ball ? (
                          ball.wicket ? 'bg-[#FF003C]/20 text-[#FF003C] border border-[#FF003C]/30' :
                          ball.runsScored === 4 ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30' :
                          ball.runsScored === 6 ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30' :
                          'bg-white/10 text-white border border-white/10'
                        ) : 'bg-white/5 border border-white/5 text-white/20'
                      }`}>
                        {ball ? (ball.wicket ? 'W' : ball.type === 'WD' ? `${ball.runsScored}wd` : ball.type === 'NB' ? `${ball.runsScored}nb` : ball.runsScored) : i + 1}
                      </div>
                    );
                  })}
                </div>

                {/* Check if team 2 already won mid-over */}
                {target2 && score.runs >= target2 ? (
                  <div className="text-center py-6 space-y-3">
                    <h3 className="font-heading text-2xl text-[#39FF14] uppercase italic">{team?.name} Wins!</h3>
                    <p className="text-[10px] text-white/40 font-bold">by {2 - score.wickets} wicket{2 - score.wickets !== 1 ? 's' : ''} (Super Over)</p>
                  </div>
                ) : (
                  <>
                    {/* Scoring keypad */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[0, 1, 2, 3].map(r => (
                        <motion.button
                          key={r}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => recordSuperOverBall(r)}
                          className="h-14 rounded-xl bg-white/5 border border-white/10 text-white font-numbers text-xl font-black hover:bg-white/10"
                        >
                          {r}
                        </motion.button>
                      ))}
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => recordSuperOverBall(4)}
                        className="h-14 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] font-numbers text-xl font-black">
                        4
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => recordSuperOverBall(6)}
                        className="h-14 rounded-xl bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] font-numbers text-xl font-black">
                        6
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => recordSuperOverBall(1, false, 'WD')}
                        className="h-14 rounded-xl bg-[#FFD600]/10 border border-[#FFD600]/30 text-[#FFD600] font-numbers text-sm font-black">
                        WD
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => recordSuperOverBall(1, false, 'NB')}
                        className="h-14 rounded-xl bg-[#FFD600]/10 border border-[#FFD600]/30 text-[#FFD600] font-numbers text-sm font-black">
                        NB
                      </motion.button>
                    </div>

                    {/* Wicket button */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => recordSuperOverBall(0, true)}
                      className="w-full py-4 rounded-[20px] bg-[#FF003C]/10 border border-[#FF003C]/30 text-[#FF003C] font-black text-[12px] uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <Target size={16} />
                      Wicket
                    </motion.button>
                  </>
                )}
              </div>
            );
          })()}

          {/* BREAK PHASE */}
          {superOverPhase === 'BREAK' && (
            <div className="flex-1 flex items-center justify-center p-8">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center space-y-6 max-w-sm"
              >
                <h2 className="font-heading text-3xl uppercase italic text-[#FFD600]">Super Over Break</h2>
                <div className="p-6 rounded-[24px] bg-white/5 border border-white/10 space-y-3">
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-wider">{match.teams[superOverState.team1Id === 'A' ? 'teamA' : 'teamB']?.name || 'Team 1'} Scored</p>
                  <p className="font-numbers text-5xl font-black text-white">{superOverState.team1Score.runs}<span className="text-[#FF003C]">/{superOverState.team1Score.wickets}</span></p>
                  <p className="font-numbers text-sm text-white/30">{Math.floor(superOverState.team1Score.balls / 6)}.{superOverState.team1Score.balls % 6} overs</p>
                </div>
                <div className="p-4 rounded-[16px] bg-[#39FF14]/5 border border-[#39FF14]/20 text-center">
                  <p className="text-[9px] text-[#39FF14]/60 font-black uppercase tracking-wider">Target</p>
                  <p className="font-numbers text-3xl font-black text-[#39FF14]">{superOverState.team1Score.runs + 1}</p>
                  <p className="text-[9px] text-white/30">from 6 balls</p>
                </div>
                <motion.button
                  onClick={() => {
                    setSoSelectedBatsmen([]);
                    setSoSelectedBowler(null);
                    setSuperOverPhase('SETUP_TEAM2');
                  }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-5 rounded-[20px] bg-[#39FF14] text-black font-black text-[13px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(57,255,20,0.3)]"
                >
                  <Zap size={18} />
                  Start {match.teams[superOverState.team2Id === 'A' ? 'teamA' : 'teamB']?.name || 'Team 2'} Innings
                </motion.button>
              </motion.div>
            </div>
          )}

          {/* RESULT PHASE */}
          {superOverPhase === 'RESULT' && superOverState.result && (
            <div className="flex-1 flex items-center justify-center p-8">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="text-center space-y-6 max-w-sm"
              >
                <Trophy size={48} className="text-[#FFD600] mx-auto" />
                <h2 className="font-heading text-4xl uppercase italic text-[#39FF14]">{superOverState.result.winner}</h2>
                <p className="text-[11px] text-white/40 font-black uppercase tracking-[0.2em]">{superOverState.result.margin}</p>
                <p className="text-[9px] text-white/30 font-bold">via {superOverState.result.method}</p>

                <div className="flex gap-4">
                  <div className="flex-1 p-4 rounded-[16px] bg-white/5 border border-white/10 space-y-1">
                    <p className="text-[8px] text-white/30 font-black uppercase">{match.teams[superOverState.team1Id === 'A' ? 'teamA' : 'teamB']?.name}</p>
                    <p className="font-numbers text-5xl font-black text-white">{superOverState.team1Score.runs}/{superOverState.team1Score.wickets}</p>
                  </div>
                  <div className="flex-1 p-4 rounded-[16px] bg-white/5 border border-white/10 space-y-1">
                    <p className="text-[8px] text-white/30 font-black uppercase">{match.teams[superOverState.team2Id === 'A' ? 'teamA' : 'teamB']?.name}</p>
                    <p className="font-numbers text-5xl font-black text-white">{superOverState.team2Score.runs}/{superOverState.team2Score.wickets}</p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}

      {/* ADD PLAYER MID-MATCH MODAL */}
      <AnimatePresence>
        {showAddPlayer.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowAddPlayer({ open: false, team: null }); setAddPlayerName(''); setAddPlayerPhone(''); }}
            className="fixed inset-0 z-[5000] bg-black/90 flex items-end justify-center"
          >
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#0A0A0A] border-t border-white/10 rounded-t-[32px] p-6 space-y-5"
            >
              {/* Handle bar */}
              <div className="flex justify-center">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="flex items-center justify-between">
                <h3 className="font-heading text-lg uppercase italic text-[#00F0FF]">
                  Add to {showAddPlayer.team === 'batting' ? 'Batting' : 'Bowling'} Team
                </h3>
                <button
                  onClick={() => { setShowAddPlayer({ open: false, team: null }); setAddPlayerName(''); setAddPlayerPhone(''); }}
                  className="p-2 text-white/40 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Player Name */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/50 uppercase tracking-[0.15em]">Player Name *</label>
                <input
                  type="text"
                  value={addPlayerName}
                  onChange={(e) => setAddPlayerName(e.target.value)}
                  placeholder="Enter player name"
                  className="w-full px-4 py-3 rounded-[16px] bg-white/5 border border-white/10 text-white text-[13px] placeholder:text-white/20 focus:outline-none focus:border-[#00F0FF]/50"
                  autoFocus
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/50 uppercase tracking-[0.15em]">Phone Number (10 digits)</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={addPlayerPhone}
                  onChange={(e) => setAddPlayerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  placeholder="Enter 10-digit number"
                  className="w-full px-4 py-3 rounded-[16px] bg-white/5 border border-white/10 text-white text-[13px] placeholder:text-white/20 focus:outline-none focus:border-[#00F0FF]/50"
                />
              </div>

              {/* Add Button */}
              <button
                onClick={handleAddPlayerMidMatch}
                disabled={!addPlayerName.trim() || (addPlayerPhone.length > 0 && addPlayerPhone.length !== 10)}
                className={`w-full py-4 rounded-[20px] font-black text-[13px] uppercase tracking-wider transition-all ${
                  addPlayerName.trim() && !(addPlayerPhone.length > 0 && addPlayerPhone.length !== 10)
                    ? 'bg-[#00F0FF] text-black active:scale-[0.98]'
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <UserPlus size={16} />
                  Add Player
                </div>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR SCANNER MODAL */}
      <AnimatePresence>
        {showQRScanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={closeQRScanner}
            className="fixed inset-0 z-[10050] bg-black/95 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350, mass: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-[32px] overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-9 h-9 rounded-full bg-[#00F0FF]/10 flex items-center justify-center"
                  >
                    <Camera size={16} className="text-[#00F0FF]" />
                  </motion.div>
                  <div>
                    <h3 className="font-heading text-base uppercase italic text-[#00F0FF]">
                      {qrScanMode === 'TEAM' ? 'Scan Opponent Team' : 'QR Scanner'}
                    </h3>
                    <p className="text-[8px] text-white/30 uppercase tracking-widest">
                      {qrScanMode === 'TEAM' ? `Import into Team ${qrScanTargetTeam || ''}` : 'Scan player ID'}
                    </p>
                  </div>
                </div>
                <button onClick={closeQRScanner} className="p-2 text-white/40 hover:text-white rounded-full hover:bg-white/5 transition-all">
                  <X size={18} />
                </button>
              </div>

              {/* Scanner viewport */}
              <div className="px-5 pb-2">
                <div className="relative w-full aspect-square rounded-[20px] bg-black overflow-hidden">
                  <video ref={qrVideoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay playsInline />

                  {/* Corner brackets instead of full border */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-52 h-52 relative">
                      {/* Top-left */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-[#00F0FF] rounded-tl-lg" />
                      {/* Top-right */}
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-[#00F0FF] rounded-tr-lg" />
                      {/* Bottom-left */}
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-[#00F0FF] rounded-bl-lg" />
                      {/* Bottom-right */}
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-[#00F0FF] rounded-br-lg" />

                      {/* Animated scan line */}
                      <motion.div
                        animate={{ y: [0, 192, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-[#00F0FF] to-transparent shadow-[0_0_12px_rgba(0,240,255,0.6)]"
                      />
                    </div>
                  </div>

                  {/* Dim overlay outside scan area */}
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: 'radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.6) 65%)'
                  }} />
                </div>
              </div>

              {/* Status text */}
              <div className="p-5 pt-3 text-center">
                <motion.p
                  key={qrScanStatus}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    qrScanStatus === 'SCANNING' ? 'text-white/40' :
                    qrScanStatus === 'SUCCESS' ? 'text-[#39FF14]' : 'text-[#FF003C]'
                  }`}
                >
                  {qrScanStatus === 'SCANNING' ? 'Point camera at QR code' :
                   qrScanStatus === 'SUCCESS' ? 'Player found!' : qrScanError || 'Scan failed'}
                </motion.p>
                {qrScanStatus === 'SCANNING' && (
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }} className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }} className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" />
                  </div>
                )}
                {qrScanStatus === 'ERROR' && (
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        const mode = qrScanMode;
                        const target = qrScanTargetTeam;
                        closeQRScanner();
                        setTimeout(() => {
                          if (mode === 'TEAM' && target) startTeamImportScanner(target);
                          else startQRScanner();
                        }, 150);
                      }}
                      className="px-4 py-2 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] text-[10px] font-black uppercase tracking-wider hover:bg-[#00F0FF]/20 transition-all"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
              <canvas ref={qrCanvasRef} className="hidden" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TEAM SHARE QR MODAL */}
      <AnimatePresence>
        {teamShareModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setTeamShareModal({ open: false, teamId: null, qrDataUrl: '' })}
            className="fixed inset-0 z-[10100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 26, stiffness: 340 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-[36px] overflow-hidden border border-[#00F0FF]/20 bg-gradient-to-br from-[#08080C] via-[#0A0A12] to-[#050508] shadow-[0_0_80px_rgba(0,240,255,0.15)]"
            >
              {/* glow rings */}
              <motion.div
                aria-hidden
                className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-[#00F0FF]/10 blur-[80px] pointer-events-none"
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                aria-hidden
                className="absolute -bottom-24 -right-24 w-60 h-60 rounded-full bg-[#BC13FE]/10 blur-[80px] pointer-events-none"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              />

              <div className="relative p-5 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: [0, 8, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-9 h-9 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center"
                  >
                    <QrCode size={16} className="text-[#00F0FF]" />
                  </motion.div>
                  <div>
                    <h3 className="font-heading text-base uppercase italic text-[#00F0FF]">Team QR</h3>
                    <p className="text-[8px] text-white/30 uppercase tracking-widest">Let opponent scan this</p>
                  </div>
                </div>
                <button onClick={() => setTeamShareModal({ open: false, teamId: null, qrDataUrl: '' })} className="p-2 text-white/40 hover:text-white rounded-full hover:bg-white/5 transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="relative p-6 space-y-5">
                {/* Team header */}
                {(() => {
                  if (!teamShareModal.teamId) return null;
                  const tObj = getTeamObj(teamShareModal.teamId);
                  return (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFD600] to-[#FF6D00] flex items-center justify-center font-heading text-sm font-black text-black overflow-hidden shadow-lg shadow-[#FF6D00]/20">
                        {tObj.logo ? (
                          <img src={tObj.logo} className="w-full h-full object-cover" alt={tObj.name} />
                        ) : (
                          getTeamInitials(tObj.name)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading text-base uppercase italic text-white truncate">{tObj.name}</p>
                        <p className="text-[9px] text-white/40 uppercase tracking-[0.2em]">{(tObj.squad || []).length} players ready</p>
                      </div>
                    </div>
                  );
                })()}

                {/* QR container */}
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: 'spring', damping: 22, stiffness: 280 }}
                  className="relative mx-auto w-fit"
                >
                  {/* corner brackets */}
                  <div className="absolute -inset-3 pointer-events-none">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-[#00F0FF] rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-[#00F0FF] rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-[#00F0FF] rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-[#00F0FF] rounded-br-lg" />
                  </div>
                  <div className="p-3 rounded-[20px] bg-[#020617] border border-[#00F0FF]/20 shadow-[inset_0_0_30px_rgba(0,240,255,0.1)]">
                    {teamShareModal.qrDataUrl ? (
                      <img src={teamShareModal.qrDataUrl} alt="Team QR" className="w-60 h-60 rounded-[12px]" />
                    ) : (
                      <div className="w-60 h-60 rounded-[12px] bg-black/40 flex items-center justify-center">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
                          <QrCode size={32} className="text-[#00F0FF]/50" />
                        </motion.div>
                      </div>
                    )}
                  </div>
                </motion.div>

                <p className="text-center text-[10px] text-white/50 leading-relaxed">
                  On the opponent's phone, tap <span className="text-[#FF6D00] font-black">Scan Opponent</span> and point it here.
                </p>

                <button
                  onClick={() => setTeamShareModal({ open: false, teamId: null, qrDataUrl: '' })}
                  className="w-full py-3 rounded-[20px] bg-white/5 border border-white/10 font-black text-[11px] uppercase text-white/70 hover:bg-white/10 transition-all tracking-[0.2em]"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TEAM IMPORT CONFIRM DIALOG */}
      <AnimatePresence>
        {teamImportConfirm.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10110] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 320 }}
              className="w-full max-w-sm bg-gradient-to-br from-[#0A0A10] to-[#050508] border border-[#FF6D00]/20 rounded-[32px] overflow-hidden"
            >
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFD600] to-[#FF6D00] flex items-center justify-center font-heading text-sm font-black text-black overflow-hidden shadow-lg">
                    {teamImportConfirm.incomingLogo ? (
                      <img src={teamImportConfirm.incomingLogo} className="w-full h-full object-cover" alt={teamImportConfirm.incomingName} />
                    ) : (
                      getTeamInitials(teamImportConfirm.incomingName)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#FF6D00]">Incoming Team</p>
                    <p className="font-heading text-lg uppercase italic text-white truncate">{teamImportConfirm.incomingName}</p>
                  </div>
                </div>

                <div className="p-4 rounded-[20px] bg-white/[0.03] border border-white/10 space-y-1.5">
                  <p className="text-[10px] text-white/60">
                    <span className="text-[#00F0FF] font-black">{teamImportConfirm.incomingSquad.length}</span> players will be loaded into <span className="text-white font-black">Team {teamImportConfirm.targetTeam}</span>.
                  </p>
                  {teamImportConfirm.existingCount > 0 && (
                    <p className="text-[10px] text-[#FF6D00]">
                      ⚠ This will replace <span className="font-black">{teamImportConfirm.existingCount}</span> existing player{teamImportConfirm.existingCount === 1 ? '' : 's'}.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setTeamImportConfirm({ open: false, targetTeam: null, incomingName: '', incomingLogo: '', incomingSquad: [], existingCount: 0 })}
                    className="py-3 rounded-[18px] bg-white/5 border border-white/10 font-black text-[11px] uppercase text-white/70 hover:bg-white/10 transition-all tracking-[0.18em]"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={confirmTeamImport}
                    className="py-3 rounded-[18px] bg-[#39FF14] text-black font-black text-[11px] uppercase shadow-[0_0_20px_rgba(57,255,20,0.3)] tracking-[0.18em]"
                  >
                    {teamImportConfirm.existingCount > 0 ? 'Replace' : 'Import'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* READY FOR BATTLE ANIMATION */}
      <AnimatePresence>
        {teamReadyAnimation.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[10200] bg-black/97 backdrop-blur-md flex items-center justify-center p-6 pointer-events-none"
          >
            {/* Background radial pulse */}
            <motion.div
              aria-hidden
              className="absolute inset-0 flex items-center justify-center"
            >
              <motion.div
                className="w-[120%] h-[120%] rounded-full bg-gradient-radial from-[#FFD600]/10 via-[#FF6D00]/5 to-transparent blur-3xl"
                animate={{ scale: [0.8, 1.2, 1], opacity: [0, 0.8, 0.5] }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                style={{ background: 'radial-gradient(circle, rgba(255,214,0,0.18) 0%, rgba(255,109,0,0.08) 40%, transparent 70%)' }}
              />
            </motion.div>

            {/* Particle sparks */}
            {[...Array(14)].map((_, i) => {
              const angle = (i / 14) * Math.PI * 2;
              const distance = 180 + (i % 3) * 40;
              return (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-[#FFD600] shadow-[0_0_8px_rgba(255,214,0,0.9)]"
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  animate={{
                    x: Math.cos(angle) * distance,
                    y: Math.sin(angle) * distance,
                    opacity: [0, 1, 0],
                    scale: [0, 1.2, 0],
                  }}
                  transition={{ duration: 1.6, delay: 0.2 + (i % 4) * 0.05, ease: 'easeOut' }}
                />
              );
            })}

            <div className="relative flex flex-col items-center gap-6">
              {/* Team logo with orbit ring */}
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 14, stiffness: 220, delay: 0.1 }}
                className="relative"
              >
                {/* orbit ring */}
                <motion.div
                  className="absolute inset-0 -m-3 rounded-full border-2 border-[#FFD600]/50"
                  animate={{ rotate: 360, scale: [1, 1.08, 1] }}
                  transition={{ rotate: { duration: 6, repeat: Infinity, ease: 'linear' }, scale: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } }}
                  style={{ borderStyle: 'dashed' }}
                />
                <motion.div
                  className="absolute inset-0 -m-6 rounded-full border border-[#FF6D00]/30"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
                />
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#FFD600] to-[#FF6D00] flex items-center justify-center font-heading text-3xl font-black text-black overflow-hidden shadow-[0_0_60px_rgba(255,214,0,0.6)]">
                  {teamReadyAnimation.logo ? (
                    <img src={teamReadyAnimation.logo} className="w-full h-full object-cover" alt={teamReadyAnimation.name} />
                  ) : (
                    getTeamInitials(teamReadyAnimation.name)
                  )}
                </div>
                {/* sparkle */}
                <motion.div
                  className="absolute -top-2 -right-2"
                  initial={{ scale: 0, rotate: -40 }}
                  animate={{ scale: [0, 1.3, 1], rotate: [0, 20, 0] }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                >
                  <Sparkles size={22} className="text-[#FFD600] drop-shadow-[0_0_10px_rgba(255,214,0,0.9)]" />
                </motion.div>
              </motion.div>

              {/* Team name */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-center"
              >
                <motion.p
                  initial={{ letterSpacing: '0.05em' }}
                  animate={{ letterSpacing: '0.2em' }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="font-heading text-2xl md:text-3xl uppercase italic text-white drop-shadow-[0_0_15px_rgba(255,214,0,0.4)]"
                >
                  {teamReadyAnimation.name}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6, type: 'spring', damping: 14 }}
                  className="mt-2 text-[11px] md:text-[12px] font-black uppercase tracking-[0.35em] bg-gradient-to-r from-[#FFD600] via-[#FF6D00] to-[#FFD600] bg-clip-text text-transparent"
                >
                  is ready for battle
                </motion.p>
              </motion.div>

              {/* Crossed swords flourish */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, type: 'spring', damping: 12 }}
                className="flex items-center gap-3"
              >
                <div className="h-px w-10 bg-gradient-to-r from-transparent to-[#FFD600]" />
                <Swords size={18} className="text-[#FFD600] drop-shadow-[0_0_10px_rgba(255,214,0,0.7)]" />
                <div className="h-px w-10 bg-gradient-to-l from-transparent to-[#FFD600]" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TRANSFER SCORING MODAL — Device Handoff */}
      <AnimatePresence>
        {showTransferModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowTransferModal(false); setTransferStatus('IDLE'); }}
            className="fixed inset-0 z-[6000] bg-black/95 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-[32px] overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              {/* Header — changes based on which mode */}
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${transferTab === 'SPECTATOR' ? 'bg-[#BC13FE]/10' : 'bg-[#00F0FF]/10'}`}>
                    {transferTab === 'SPECTATOR' ? <Users size={18} className="text-[#BC13FE]" /> : <Smartphone size={18} className="text-[#00F0FF]" />}
                  </div>
                  <div>
                    <h3 className={`font-heading text-base uppercase italic ${transferTab === 'SPECTATOR' ? 'text-[#BC13FE]' : 'text-[#00F0FF]'}`}>
                      {transferTab === 'SPECTATOR' ? 'Spectator Link' : 'Transfer Scoring'}
                    </h3>
                    <p className="text-[9px] text-white/40 uppercase tracking-wider">
                      {transferTab === 'SPECTATOR' ? 'Share live match view' : 'Hand off to another device'}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setShowTransferModal(false); setTransferStatus('IDLE'); }} className="p-2 text-white/40 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {transferTab === 'HANDOFF' ? (
                  <>
                    {/* How it works */}
                    <div className="p-3 rounded-[16px] bg-[#00F0FF]/5 border border-[#00F0FF]/10">
                      <p className="text-[10px] text-[#00F0FF]/70 font-bold uppercase tracking-wider mb-2">How it works</p>
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-white/50">1. Show this QR or share the passcode</p>
                        <p className="text-[11px] text-white/50">2. New scorer scans QR or enters code</p>
                        <p className="text-[11px] text-white/50">3. Match continues on their device instantly</p>
                      </div>
                    </div>

                    {/* PASSCODE DISPLAY */}
                    <div className="p-4 rounded-[20px] bg-gradient-to-br from-[#00F0FF]/10 to-[#00F0FF]/5 border border-[#00F0FF]/20 text-center">
                      <p className="text-[9px] text-[#00F0FF]/60 uppercase tracking-[0.3em] mb-2">Transfer Passcode</p>
                      <div className="flex justify-center gap-2">
                        {transferPasscode.split('').map((d, i) => (
                          <div key={i} className="w-10 h-12 rounded-[12px] bg-black/40 border border-[#00F0FF]/30 flex items-center justify-center">
                            <span className="font-heading text-2xl text-[#00F0FF] font-black">{d}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[9px] text-white/30 mt-2">Tell this code to the new scorer</p>
                    </div>

                    {/* QR Code */}
                    {(() => {
                      const shortUrl = getTransferShortUrl();
                      return shortUrl ? (
                        <>
                          <div className="flex justify-center">
                            <div className="bg-white rounded-[20px] p-3 shadow-lg shadow-[#00F0FF]/10">
                              <img
                                src={getQRCodeUrl(shortUrl)}
                                alt="Scan to take over scoring"
                                className="w-48 h-48 rounded-[12px]"
                              />
                            </div>
                          </div>
                          <p className="text-[9px] text-white/30 text-center uppercase tracking-widest">Scan with phone camera or Google Lens</p>
                        </>
                      ) : null;
                    })()}

                    {/* Match info */}
                    <div className="p-4 rounded-[16px] bg-white/5 border border-white/10 text-center">
                      <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Transferring Match</p>
                      <p className="font-heading text-lg text-white">
                        {match.teams?.teamA?.name || 'Team A'} vs {match.teams?.teamB?.name || 'Team B'}
                      </p>
                      <p className="text-[10px] text-[#00F0FF] mt-1">
                        {match.liveScore?.runs || 0}/{match.liveScore?.wickets || 0} ({Math.floor((match.liveScore?.balls || 0) / 6)}.{(match.liveScore?.balls || 0) % 6} ov)
                      </p>
                    </div>

                    {/* Copy full transfer link */}
                    <button
                      onClick={copyTransferLink}
                      className="w-full py-3 rounded-[16px] bg-[#00F0FF] text-black font-black text-[11px] uppercase tracking-wider hover:bg-[#00F0FF]/90 transition-all flex items-center justify-center gap-2"
                    >
                      {transferLinkCopied ? <><Check size={14} /> Link Copied!</> : <><Share2 size={14} /> Copy Transfer Link</>}
                    </button>
                  </>) : (
                  <>
                    {/* Spectator mode info */}
                    <div className="p-3 rounded-[16px] bg-[#BC13FE]/5 border border-[#BC13FE]/10">
                      <p className="text-[10px] text-[#BC13FE]/70 font-bold uppercase tracking-wider mb-2">Spectator Mode</p>
                      <p className="text-[11px] text-white/50">Share this QR or link so others can watch the match live with real-time score updates.</p>
                    </div>

                    {/* Spectator QR — links to ?spectate=matchId */}
                    {(() => {
                      const specUrl = getSpectatorUrl();
                      return specUrl ? (
                        <>
                          <div className="flex justify-center">
                            <div className="bg-white rounded-[20px] p-3 shadow-lg shadow-[#BC13FE]/10">
                              <img
                                src={getQRCodeUrl(specUrl)}
                                alt="Spectator QR"
                                className="w-48 h-48 rounded-[12px]"
                              />
                            </div>
                          </div>
                          <p className="text-[9px] text-white/30 text-center uppercase tracking-widest">Scan to follow this match live</p>
                        </>
                      ) : (
                        <div className="flex justify-center">
                          <div className="bg-white rounded-[20px] p-3 shadow-lg shadow-[#BC13FE]/10">
                            <img
                              src={getQRCodeUrl(window.location.origin)}
                              alt="Spectator QR"
                              className="w-48 h-48 rounded-[12px]"
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Match info */}
                    <div className="p-4 rounded-[16px] bg-white/5 border border-white/10 text-center">
                      <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Live Match</p>
                      <p className="font-heading text-lg text-white">
                        {match.teams?.teamA?.name || 'Team A'} vs {match.teams?.teamB?.name || 'Team B'}
                      </p>
                      <p className="text-[10px] text-[#BC13FE] mt-1">
                        {match.liveScore?.runs || 0}/{match.liveScore?.wickets || 0} ({Math.floor((match.liveScore?.balls || 0) / 6)}.{(match.liveScore?.balls || 0) % 6} ov)
                      </p>
                    </div>

                    {/* Spectator link copy */}
                    <button
                      onClick={() => {
                        const specUrl = getSpectatorUrl() || window.location.origin;
                        navigator.clipboard.writeText(specUrl);
                        setTransferLinkCopied(true);
                        setTimeout(() => setTransferLinkCopied(false), 2000);
                      }}
                      className="w-full py-3 rounded-[16px] bg-[#BC13FE] text-white font-black text-[11px] uppercase tracking-wider hover:bg-[#BC13FE]/90 transition-all flex items-center justify-center gap-2"
                    >
                      {transferLinkCopied ? <><Check size={14} /> Link Copied!</> : <><Share2 size={14} /> Copy Spectator Link</>}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      
      </AnimatePresence>

      {/* RECEIVE TRANSFER MODAL */}
      <AnimatePresence>
        {showReceiveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowReceiveModal(false); setReceivePasscode(''); setReceiveError(''); }}
            className="fixed inset-0 z-[6000] bg-black/95 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-[32px] overflow-hidden"
            >
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#39FF14]/10 flex items-center justify-center">
                    <ArrowLeftRight size={18} className="text-[#39FF14]" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base uppercase italic text-[#39FF14]">Receive Transfer</h3>
                    <p className="text-[9px] text-white/40 uppercase tracking-wider">Enter the scorer's passcode</p>
                  </div>
                </div>
                <button onClick={() => { setShowReceiveModal(false); setReceivePasscode(''); setReceiveError(''); }} className="p-2 text-white/40 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <p className="text-[11px] text-white/50 text-center">Ask the current scorer for their 6-digit transfer passcode, or scan their QR code with your camera.</p>

                {/* Passcode input */}
                <div className="flex justify-center gap-2">
                  {[0,1,2,3,4,5].map((i) => (
                    <input
                      key={i}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={receivePasscode[i] || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        const newCode = receivePasscode.split('');
                        newCode[i] = val;
                        setReceivePasscode(newCode.join(''));
                        if (val && e.target.nextElementSibling) {
                          (e.target.nextElementSibling as HTMLInputElement).focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !receivePasscode[i] && e.target instanceof HTMLInputElement && e.target.previousElementSibling) {
                          (e.target.previousElementSibling as HTMLInputElement).focus();
                        }
                      }}
                      className="w-12 h-14 rounded-[12px] bg-black/60 border border-white/20 text-center text-2xl font-heading text-[#39FF14] font-black focus:border-[#39FF14] focus:outline-none transition-all"
                    />
                  ))}
                </div>

                {receiveError && (
                  <p className="text-[10px] text-white/40 text-center">{receiveError}</p>
                )}

                <button
                  onClick={async () => {
                    if (receivePasscode.length !== 6) return;
                    setIsReceiving(true);
                    setReceiveError('');
                    try {
                      const foundMatch = await findMatchByPasscode(receivePasscode);
                      if (!foundMatch || !foundMatch.matchId) {
                        setReceiveError('No active match found with that code. Ask the scorer to check their code, or try scanning the QR.');
                        setIsReceiving(false);
                        return;
                      }
                      // Mark THIS tab as the new scorer BEFORE writing transfer_accepted
                      sessionStorage.setItem(`22Y_I_AM_SCORER_${foundMatch.matchId}`, JSON.stringify({
                        scorerSince: Date.now(),
                        scorerName: 'Receiver (passcode)',
                      }));
                      // Signal sender (same/other device) to switch to spectator
                      localStorage.setItem(`22Y_TRANSFER_ACCEPTED_${foundMatch.matchId}`, JSON.stringify({
                        acceptedBy: 'Another device',
                        acceptedAt: Date.now(),
                      }));
                      // Broadcast for cross-device scenarios — retry to fight race condition
                      try {
                        const ch = supabase.channel(`live:${foundMatch.matchId}`);
                        ch.subscribe((st: string) => {
                          if (st === 'SUBSCRIBED') {
                            const payload = { matchId: foundMatch.matchId, acceptedBy: 'Another device' };
                            ch.send({ type: 'broadcast', event: 'transfer_accepted', payload });
                            setTimeout(() => ch.send({ type: 'broadcast', event: 'transfer_accepted', payload }), 500);
                            setTimeout(() => ch.send({ type: 'broadcast', event: 'transfer_accepted', payload }), 1500);
                            setTimeout(() => supabase.removeChannel(ch), 5000);
                          }
                        });
                      } catch {}
                      // Load the match into this device as the new scorer
                      try {
                        localStorage.setItem('22YARDS_ACTIVE_MATCH', JSON.stringify(foundMatch));
                      } catch {}
                      setMatch(foundMatch);
                      // Infer the right status from the loaded match state
                      setStatus((foundMatch.status as any) || 'LIVE');
                      setShowReceiveModal(false);
                      setIsReceiving(false);
                    } catch (e) {
                      setReceiveError('Transfer failed. Please check your connection and try again.');
                      setIsReceiving(false);
                    }
                  }}
                  disabled={receivePasscode.length < 6 || isReceiving}
                  className="w-full py-3.5 rounded-[16px] bg-[#39FF14] text-black font-black text-[12px] uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#39FF14]/90 transition-all flex items-center justify-center gap-2"
                >
                  {isReceiving ? 'Connecting...' : 'Connect'}
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[9px] text-white/30 uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <button
                  onClick={() => { setShowReceiveModal(false); startQRScanner(); }}
                  className="w-full py-3 rounded-[16px] bg-white/5 border border-white/10 text-white/60 font-black text-[11px] uppercase tracking-wider hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <Camera size={14} />
                  Scan QR Code Instead
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* YouTube Stream Modal */}
      <YouTubeStreamModal
        isOpen={showYouTubeModal}
        onClose={() => setShowYouTubeModal(false)}
        onSave={handleSaveYouTubeConfig}
        currentConfig={liveStreamConfig}
      />

      {/* Camera Recorder PiP Overlay */}
      <CameraRecorder
        isActive={showCameraRecorder}
        onClose={() => setShowCameraRecorder(false)}
      />

      {/* ═══ LEAVE MATCH CONFIRMATION MODAL ═══ */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[5000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-[28px] p-8 space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-[#FF003C]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert size={28} className="text-[#FF003C]" />
                </div>
                <h3 className="font-heading text-xl uppercase italic text-white">Match In Progress</h3>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Your match is auto-saved. You can resume from the Dugout anytime.
                </p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowLeaveConfirm(false);
                    if (match.matchId) sessionStorage.removeItem(`22Y_I_AM_SCORER_${match.matchId}`);
                    onBack();
                  }}
                  className="w-full py-4 rounded-[16px] bg-[#FF003C]/15 border border-[#FF003C]/30 text-[#FF003C] font-black text-[11px] uppercase tracking-wider hover:bg-[#FF003C]/25 transition-all"
                >
                  Save & Leave
                </button>
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="w-full py-3 rounded-[16px] bg-white/5 border border-white/10 text-white/50 font-black text-[11px] uppercase tracking-wider hover:bg-white/10 transition-all"
                >
                  Continue Match
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MatchCenter;
