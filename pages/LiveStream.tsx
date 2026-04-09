// pages/LiveStream.tsx
// YouTube Live Streaming integration + Camera recording for highlights

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Video,
  Play,
  Square,
  Copy,
  Check,
  AlertCircle,
  X,
  Settings as SettingsIcon,
} from 'lucide-react';

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

export interface CameraRecorderState {
  isRecording: boolean;
  hasCamera: boolean;
  videoBlob: Blob | null;
  cameraError: string | null;
}

export interface LiveStreamConfig {
  youtubeStreamUrl?: string;
  youtubeEmbedUrl?: string;
  rtmpUrl?: string;
  streamKey?: string;
  isStreaming: boolean;
}

// Hook for managing camera recording
export const useCameraRecorder = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Initialize camera
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCamera(true);
        setCameraError(null);
      } catch (err: any) {
        setCameraError(err.message || 'Unable to access camera');
        setHasCamera(false);
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Start recording
  const startRecording = () => {
    if (!streamRef.current) {
      setCameraError('Camera not initialized');
      return;
    }

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'video/webm;codecs=vp8,opus',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      // Video is now available as a blob for highlights processing
      console.log('Recording stopped, video blob size:', blob.size);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
  };

  // Stop recording
  const stopRecording = (): Blob | null => {
    if (!mediaRecorderRef.current) return null;
    mediaRecorderRef.current.stop();
    setIsRecording(false);

    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    return blob;
  };

  // Extract clip from recording (last N seconds)
  const extractClip = (durationSeconds: number = 15): Blob | null => {
    if (chunksRef.current.length === 0) return null;

    // For simplicity, return the whole accumulated recording
    // In production, you'd slice this more precisely
    return new Blob(chunksRef.current, { type: 'video/webm' });
  };

  return {
    videoRef,
    isRecording,
    hasCamera,
    cameraError,
    startRecording,
    stopRecording,
    extractClip,
  };
};

// Camera Recorder PiP Component (for overlay on scorer's screen)
interface CameraRecorderProps {
  isActive: boolean;
  onClose: () => void;
}

export const CameraRecorder: React.FC<CameraRecorderProps> = ({ isActive, onClose }) => {
  const { videoRef, isRecording, hasCamera, cameraError, startRecording, stopRecording } = useCameraRecorder();
  const [showRecordingIndicator, setShowRecordingIndicator] = useState(false);

  useEffect(() => {
    if (isRecording) {
      setShowRecordingIndicator(true);
    }
  }, [isRecording]);

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="fixed bottom-6 right-6 z-50 rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: CYBER_COLORS.surface, border: `2px solid ${CYBER_COLORS.cyan}` }}
      >
        {/* Video preview */}
        <div className="relative w-56 h-32 bg-black">
          {hasCamera && !cameraError ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              muted
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <AlertCircle size={32} color={CYBER_COLORS.red} />
            </div>
          )}

          {/* Recording indicator */}
          {showRecordingIndicator && (
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 rounded-full"
              style={{ backgroundColor: CYBER_COLORS.red }}
            >
              <div className="w-2 h-2 bg-white rounded-full" />
              <span className="text-xs font-bold text-white">RECORDING</span>
            </motion.div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 rounded-lg transition-colors"
            style={{ backgroundColor: CYBER_COLORS.grey }}
          >
            <X size={16} color={CYBER_COLORS.cyan} />
          </button>
        </div>

        {/* Controls */}
        <div className="p-3 border-t" style={{ borderColor: CYBER_COLORS.grey }}>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!hasCamera || cameraError !== null}
            className="w-full py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2"
            style={{
              backgroundColor: isRecording ? CYBER_COLORS.red : CYBER_COLORS.green,
              color: 'white',
              opacity: hasCamera && !cameraError ? 1 : 0.5,
            }}
          >
            {isRecording ? (
              <>
                <Square size={14} />
                Stop
              </>
            ) : (
              <>
                <Play size={14} />
                Record
              </>
            )}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// YouTube Stream Setup Modal
interface YouTubeStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: LiveStreamConfig) => void;
  currentConfig?: LiveStreamConfig;
}

export const YouTubeStreamModal: React.FC<YouTubeStreamModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentConfig,
}) => {
  const [youtubeEmbedUrl, setYoutubeEmbedUrl] = useState(currentConfig?.youtubeEmbedUrl || '');
  const [rtmpUrl, setRtmpUrl] = useState(currentConfig?.rtmpUrl || '');
  const [streamKey, setStreamKey] = useState(currentConfig?.streamKey || '');
  const [copied, setCopied] = useState(false);

  const handleSave = () => {
    onSave({
      youtubeEmbedUrl,
      rtmpUrl,
      streamKey,
      isStreaming: youtubeEmbedUrl.length > 0,
    });
    onClose();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-3xl p-6 max-w-lg w-full"
        style={{ backgroundColor: CYBER_COLORS.surface }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-2xl uppercase italic" style={{ color: CYBER_COLORS.cyan }}>
            YouTube Live Setup
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:opacity-70"
            style={{ backgroundColor: CYBER_COLORS.grey }}
          >
            <X size={20} color={CYBER_COLORS.cyan} />
          </button>
        </div>

        {/* Instruction Box */}
        <div
          className="p-4 rounded-xl mb-6 text-sm"
          style={{ backgroundColor: CYBER_COLORS.grey, borderLeft: `4px solid ${CYBER_COLORS.gold}` }}
        >
          <p style={{ color: CYBER_COLORS.gold }} className="font-bold mb-2">
            Setup Instructions
          </p>
          <ol className="text-white space-y-2 text-xs list-decimal list-inside">
            <li>Go to YouTube Live Creator Studio</li>
            <li>Create a new live stream and get the embed URL</li>
            <li>Alternatively, paste your RTMP URL and Stream Key below</li>
            <li>Use OBS or YouTube Live app to push to the RTMP endpoint</li>
            <li>Your spectators will see the live stream embedded in the match</li>
          </ol>
        </div>

        {/* YouTube Embed URL */}
        <div className="mb-4">
          <label className="block text-sm font-bold mb-2" style={{ color: CYBER_COLORS.cyan }}>
            YouTube Embed URL
          </label>
          <input
            type="text"
            value={youtubeEmbedUrl}
            onChange={(e) => setYoutubeEmbedUrl(e.target.value)}
            placeholder="https://www.youtube.com/embed/..."
            className="w-full px-4 py-2 rounded-lg bg-black border-2 text-white focus:outline-none"
            style={{ borderColor: CYBER_COLORS.cyan }}
          />
          <p className="text-xs mt-2" style={{ color: CYBER_COLORS.textDim }}>
            e.g., https://www.youtube.com/embed/dQw4w9WgXcQ
          </p>
        </div>

        {/* RTMP URL */}
        <div className="mb-4">
          <label className="block text-sm font-bold mb-2" style={{ color: CYBER_COLORS.cyan }}>
            RTMP URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={rtmpUrl}
              onChange={(e) => setRtmpUrl(e.target.value)}
              placeholder="rtmp://a.rtmp.youtube.com/live2"
              className="flex-1 px-4 py-2 rounded-lg bg-black border-2 text-white focus:outline-none text-xs"
              style={{ borderColor: CYBER_COLORS.cyan }}
            />
            <button
              onClick={() => copyToClipboard(rtmpUrl)}
              className="px-3 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: CYBER_COLORS.grey }}
            >
              {copied ? <Check size={16} color={CYBER_COLORS.green} /> : <Copy size={16} color={CYBER_COLORS.cyan} />}
            </button>
          </div>
        </div>

        {/* Stream Key */}
        <div className="mb-6">
          <label className="block text-sm font-bold mb-2" style={{ color: CYBER_COLORS.cyan }}>
            Stream Key
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={streamKey}
              onChange={(e) => setStreamKey(e.target.value)}
              placeholder="Enter your stream key"
              className="flex-1 px-4 py-2 rounded-lg bg-black border-2 text-white focus:outline-none text-xs"
              style={{ borderColor: CYBER_COLORS.cyan }}
            />
            <button
              onClick={() => copyToClipboard(streamKey)}
              className="px-3 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: CYBER_COLORS.grey }}
            >
              {copied ? <Check size={16} color={CYBER_COLORS.green} /> : <Copy size={16} color={CYBER_COLORS.cyan} />}
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold transition-all"
            style={{ backgroundColor: CYBER_COLORS.grey, color: 'white' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl font-bold transition-all"
            style={{ backgroundColor: CYBER_COLORS.cyan, color: CYBER_COLORS.bg }}
          >
            Save Stream Config
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Live Stream View Component (for spectators)
interface LiveStreamViewProps {
  config?: LiveStreamConfig;
  matchId: string;
}

export const LiveStreamView: React.FC<LiveStreamViewProps> = ({ config, matchId }) => {
  if (!config?.youtubeEmbedUrl) {
    return (
      <div
        className="w-full aspect-video rounded-xl flex items-center justify-center"
        style={{ backgroundColor: CYBER_COLORS.grey }}
      >
        <div className="text-center">
          <Video size={48} color={CYBER_COLORS.textDim} className="mx-auto mb-4" />
          <p style={{ color: CYBER_COLORS.textDim }} className="text-sm">
            No live stream available for this match
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden" style={{ backgroundColor: '#000' }}>
      <iframe
        width="100%"
        height="100%"
        src={(() => {
          try {
            const url = new URL(config.youtubeEmbedUrl!);
            // Only allow YouTube embed domains
            if (['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname) && url.pathname.startsWith('/embed/')) {
              return url.toString();
            }
            return '';
          } catch { return ''; }
        })()}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Live Stream"
      />
    </div>
  );
};
