
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Calendar, MapPin, Users, Zap, Search, Filter, 
  ChevronRight, CreditCard, Share2, Plus, Clock, ShieldCheck,
  CheckCircle2, Info, ArrowRight, X, Heart, Smartphone
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import MotionButton from '../components/MotionButton';

// --- Types ---
interface Tournament {
  id: string;
  title: string;
  organizer: string;
  prizePool: string;
  entryFee: string;
  ballType: 'Leather' | 'Tennis';
  location: string;
  distance: string;
  startDate: string;
  endDate: string;
  banner: string;
  status: 'OPEN' | 'CLOSING SOON' | 'FULL';
  teamsJoined: number;
  totalTeams: number;
  category: 'Open' | 'U-19';
}

// --- Mock Data ---
const TOURNAMENTS: Tournament[] = [
  {
    id: 't1',
    title: 'KANPUR MONSOON BASH T20',
    organizer: 'Elite Cricket Assoc.',
    prizePool: '₹50,000',
    entryFee: '₹2,500',
    ballType: 'Leather',
    location: 'Palika Stadium, Kanpur',
    distance: '3.2 km',
    startDate: '15 MAR',
    endDate: '25 MAR',
    banner: 'https://images.unsplash.com/photo-1540747913346-19e3ad643649?auto=format&fit=crop&q=80&w=1200',
    status: 'CLOSING SOON',
    teamsJoined: 14,
    totalTeams: 16,
    category: 'Open'
  },
  {
    id: 't2',
    title: 'GULLY KINGS T10 LEAGUE',
    organizer: 'Street Legends',
    prizePool: '₹15,000',
    entryFee: '₹800',
    ballType: 'Tennis',
    location: 'Kidwai Nagar Park',
    distance: '1.5 km',
    startDate: '20 MAR',
    endDate: '22 MAR',
    banner: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=1200',
    status: 'OPEN',
    teamsJoined: 8,
    totalTeams: 24,
    category: 'Open'
  },
  {
    id: 't3',
    title: 'YOUTH CHAMPIONS CUP',
    organizer: 'Royal Academy',
    prizePool: '₹25,000',
    entryFee: '₹1,500',
    ballType: 'Leather',
    location: 'Green Park Outer',
    distance: '5.8 km',
    startDate: '02 APR',
    endDate: '10 APR',
    banner: 'https://images.unsplash.com/photo-1593341604935-03b44758e234?auto=format&fit=crop&q=80&w=1200',
    status: 'OPEN',
    teamsJoined: 10,
    totalTeams: 12,
    category: 'U-19'
  }
];

const REGISTERED_TEAMS = [
  { name: 'Avengers XI', logo: 'https://api.dicebear.com/7.x/initials/svg?seed=AX' },
  { name: 'Warriors CC', logo: 'https://api.dicebear.com/7.x/initials/svg?seed=WC' },
  { name: 'Titans XI', logo: 'https://api.dicebear.com/7.x/initials/svg?seed=TX' },
  { name: 'Street Kings', logo: 'https://api.dicebear.com/7.x/initials/svg?seed=SK' },
  { name: 'Nitro XI', logo: 'https://api.dicebear.com/7.x/initials/svg?seed=NX' },
];

const ConfettiEffect = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            y: -10, 
            x: `${Math.random() * 100}vw`,
            scale: Math.random() * 1 + 0.5,
            rotate: 0,
            opacity: 1 
          }}
          animate={{ 
            y: '110vh', 
            rotate: 720,
            opacity: 0 
          }}
          transition={{ 
            duration: Math.random() * 2 + 1,
            ease: "easeOut",
            delay: Math.random() * 0.5
          }}
          className="absolute w-2 h-2 rounded-sm"
          style={{ backgroundColor: i % 2 === 0 ? '#FFD700' : '#FDB931' }}
        />
      ))}
    </div>
  );
};

const Tournaments: React.FC = () => {
  const [selectedTourney, setSelectedTourney] = useState<Tournament | null>(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const featured = TOURNAMENTS[0];

  const handleRegister = () => {
    setIsRegistering(true);
    setTimeout(() => {
      setIsRegistering(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedTourney(null);
      }, 3000);
    }, 2000);
  };

  const filteredTourneys = TOURNAMENTS.filter(t => {
    const matchesFilter = activeFilter === 'All' || 
                         (activeFilter === 'Leather' && t.ballType === 'Leather') ||
                         (activeFilter === 'Tennis' && t.ballType === 'Tennis') ||
                         (activeFilter === 'Under-19' && t.category === 'U-19') ||
                         (activeFilter === 'Open' && t.category === 'Open');
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="h-full scroll-container pb-40">
      {showSuccess && <ConfettiEffect />}

      {/* Page Header with Coming Soon Status */}
      <div className="px-6 pt-10 space-y-4">
        <div className="flex items-center space-x-2 bg-[#FFD700]/10 border border-[#FFD700]/30 w-fit px-3 py-1 rounded-full">
           <div className="w-1.5 h-1.5 rounded-full bg-[#FFD700] animate-pulse" />
           <span className="text-[8px] font-black text-[#FFD700] uppercase tracking-[0.3em]">Module Status: Coming Soon</span>
        </div>
        <div className="space-y-1">
          <h1 className="font-heading text-6xl tracking-tighter leading-none">PRO CIRCUITS</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Elite Tournament Hub</p>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative h-[35vh] w-full overflow-hidden shrink-0 mt-6">
        <motion.img 
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 10, repeat: Infinity, repeatType: "reverse" }}
          src={featured.banner} 
          className="w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        
        <div className="absolute top-6 left-6">
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-2 bg-red-600/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-red-400/30"
          >
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            <span className="text-[8px] font-black tracking-widest uppercase">Live Registration</span>
          </motion.div>
        </div>

        <div className="absolute bottom-8 left-6 right-6 space-y-2">
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[#FFD700] text-[9px] font-black tracking-[0.3em] uppercase"
          >
            Elite Highlight
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-heading text-4xl tracking-tighter leading-none uppercase"
          >
            {featured.title}
          </motion.h2>
          
          <div className="relative inline-block overflow-hidden rounded-lg">
            <h3 className="font-numbers text-5xl text-[#FFD700] tracking-tighter relative z-10 leading-none">
              {featured.prizePool} <span className="text-xs text-white/40 uppercase font-heading tracking-widest">Pool</span>
            </h3>
          </div>
        </div>
      </section>

      {/* Filter & Search Bar */}
      <div className="px-6 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
          <input 
            type="text" 
            placeholder="Search tournaments..." 
            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-6 outline-none text-white font-black focus:border-[#FFD700]/30 transition-all text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex space-x-2 overflow-x-auto no-scrollbar">
          {['All', 'Leather', 'Tennis', 'Under-19', 'Open'].map(f => (
            <button 
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`whitespace-nowrap px-4 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all ${
                activeFilter === f ? 'bg-[#FFD700] text-black border-[#FFD700]' : 'bg-white/5 border-white/10 text-white/30'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Tournament List */}
      <section className="px-6 space-y-6">
        <AnimatePresence>
          {filteredTourneys.map((t, idx) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => setSelectedTourney(t)}
              className="relative cursor-pointer group"
            >
              <div className="bg-[#0D0D0D] border border-white/5 rounded-[28px] overflow-hidden group-hover:border-[#FFD700]/30 transition-all">
                <div className="h-32 relative">
                  <img src={t.banner} className="w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-all duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] to-transparent" />
                  
                  <div className="absolute top-3 right-3 flex space-x-1.5">
                    <span className="bg-black/60 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-white/60">
                       {t.teamsJoined}/{t.totalTeams} Slots
                    </span>
                    <div className={`px-2.5 py-1 rounded-full text-[8px] font-black tracking-widest border backdrop-blur-md ${
                      t.status === 'CLOSING SOON' ? 'border-red-500/40 bg-red-500/10 text-red-500' : 'border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700]'
                    }`}>
                      {t.status}
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0 space-y-4">
                  <div className="space-y-0.5">
                    <h4 className="font-heading text-2xl tracking-tight leading-none uppercase">{t.title}</h4>
                    <p className="text-[9px] text-white/20 font-black uppercase tracking-widest">{t.organizer}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-1 border-y border-white/5 py-3">
                    <div className="flex flex-col items-center space-y-1">
                      <Zap size={12} className="text-[#FFD700]" />
                      <span className="text-[8px] font-black uppercase text-white/40">{t.ballType}</span>
                    </div>
                    <div className="flex flex-col items-center space-y-1">
                      <MapPin size={12} className="text-[#FFD700]" />
                      <span className="text-[8px] font-black uppercase text-white/40">{t.distance}</span>
                    </div>
                    <div className="flex flex-col items-center space-y-1">
                      <Calendar size={12} className="text-[#FFD700]" />
                      <span className="text-[8px] font-black uppercase text-white/40">{t.startDate}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[8px] font-black text-white/20 uppercase">Prize Pool</p>
                      <p className="font-numbers text-3xl text-[#FFD700] leading-none">{t.prizePool}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-white/20 uppercase">Entry</p>
                      <p className="font-numbers text-3xl text-white leading-none">{t.entryFee}</p>
                    </div>
                  </div>

                  <button className="w-full bg-white/5 border border-white/10 group-hover:bg-[#FFD700] group-hover:text-black group-hover:border-[#FFD700] py-3.5 rounded-xl uppercase text-[9px] font-black tracking-widest transition-all">
                    VIEW DETAILS
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </section>

      {/* Tournament Details Modal */}
      <AnimatePresence>
        {selectedTourney && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-50">
              <button onClick={() => setSelectedTourney(null)} className="p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
                <X size={20} />
              </button>
              <div className="flex space-x-2">
                <button className="p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
                  <Share2 size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
              <div className="h-[35vh] relative shrink-0">
                <img src={selectedTourney.banner} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              </div>

              <div className="px-6 -mt-8 relative z-10 space-y-8">
                <div className="space-y-3">
                  <h2 className="font-heading text-4xl tracking-tighter leading-none uppercase">{selectedTourney.title}</h2>
                  <div className="flex items-center space-x-3">
                    <span className="text-[9px] font-black uppercase text-[#FFD700] bg-[#FFD700]/10 px-2.5 py-1 rounded-full border border-[#FFD700]/20">
                      {selectedTourney.category}
                    </span>
                    <div className="flex items-center text-white/40 text-[10px] font-black uppercase tracking-widest">
                       <ShieldCheck size={12} className="mr-1 text-[#39FF14]" /> Verified Host
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col items-center text-center">
                    <p className="text-[8px] font-black uppercase text-white/30 mb-1">Winning Pool</p>
                    <p className="font-numbers text-4xl text-[#FFD700]">{selectedTourney.prizePool}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col items-center text-center">
                    <p className="text-[8px] font-black uppercase text-white/30 mb-1">Entry Fee</p>
                    <p className="font-numbers text-4xl text-white">{selectedTourney.entryFee}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Competing Teams ({selectedTourney.teamsJoined}/{selectedTourney.totalTeams})</h3>
                  <div className="flex space-x-3 overflow-x-auto no-scrollbar">
                    {REGISTERED_TEAMS.map((team, idx) => (
                      <div key={idx} className="flex flex-col items-center space-y-1 shrink-0">
                        <div className="w-14 h-14 rounded-full border-2 border-white/5 p-0.5 bg-white/[0.02]">
                          <img src={team.logo} className="w-full h-full rounded-full" />
                        </div>
                        <span className="text-[7px] font-black text-white/30 uppercase truncate w-14 text-center">{team.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Event Protocols</h3>
                   <ul className="space-y-2.5">
                     {[
                       'Max 15 players per squad registration',
                       'Leather ball standards apply strictly',
                       'Standard T20 international rules',
                       'Dugout discipline is mandatory'
                     ].map((rule, i) => (
                       <li key={i} className="flex items-center space-x-3 text-[11px] font-black text-white/50 uppercase tracking-tight">
                         <div className="w-1.5 h-1.5 rounded-full bg-[#FFD700]" />
                         <span>{rule}</span>
                       </li>
                     ))}
                   </ul>
                </div>
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/95 backdrop-blur-2xl border-t border-white/5 z-50">
               <div className="flex items-center justify-between mb-4">
                 <div>
                   <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Available Spots</p>
                   <p className="text-lg font-numbers text-white">{selectedTourney.totalTeams - selectedTourney.teamsJoined} VACANCIES</p>
                 </div>
                 <div className="flex items-center space-x-1.5 text-red-500">
                   <Clock size={14} />
                   <span className="text-[9px] font-black uppercase">Closes Soon</span>
                 </div>
               </div>
               <MotionButton 
                onClick={handleRegister}
                className="w-full bg-gradient-to-r from-[#FFD700] to-[#FDB931] text-black font-black tracking-[0.3em] py-5 uppercase shadow-[0_15px_30px_rgba(255,215,0,0.2)]"
               >
                 {isRegistering ? 'INITIALIZING...' : 'AUTHORIZE REGISTRATION'}
               </MotionButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tournaments;
