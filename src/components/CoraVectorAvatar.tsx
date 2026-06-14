import React, { useState, useEffect } from 'react';

interface CoraVectorAvatarProps {
  speaking: boolean;
  isListening: boolean;
  className?: string;
}

export default function CoraVectorAvatar({ speaking, isListening, className = "w-52 h-52" }: CoraVectorAvatarProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Continuous micro-interaction: Cora's eyes gently track the user's cursor across the screen
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Calculate normalized positions from -1 to 1
      const x = (e.clientX - width / 2) / (width / 2);
      const y = (e.clientY - height / 2) / (height / 2);
      
      // Smooth damp targets to look organic and humanly responsive
      setMousePos({
        x: Math.max(-1, Math.min(1, x)) * 3.2,
        y: Math.max(-1, Math.min(1, y)) * 2.2,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className={`relative flex items-center justify-center rounded-full overflow-hidden border-4 border-slate-100 shadow-[0_20px_50px_rgba(8,112,184,0.15)] bg-gradient-to-b from-[#fafaf9] to-[#e7e5e4] transition-all duration-500 ${
      speaking 
        ? 'scale-[1.15] ring-8 ring-emerald-400/25 border-emerald-400/40 shadow-[0_30px_60px_rgba(15,76,58,0.25)]' 
        : 'hover:scale-[1.03]'
    } ${className}`}>
      
      {/* Background ambient room glow reflecting current voice interaction state */}
      <div className={`absolute inset-0 transition-all duration-1000 ${
        isListening 
          ? 'bg-gradient-to-tr from-teal-500/15 via-cyan-500/10 to-indigo-500/15 scale-105' 
          : speaking 
          ? 'bg-gradient-to-tr from-indigo-500/15 via-purple-400/10 to-pink-500/15 scale-105 animate-pulse' 
          : 'bg-gradient-to-b from-stone-100/50 to-stone-200/30'
      }`} />

      {/* Rhythmic voice energy fields around her portrait */}
      {isListening && (
        <div className="absolute inset-1 rounded-full border border-teal-400/25 animate-ping" style={{ animationDuration: '2.5s' }} />
      )}
      {speaking && (
        <div className="absolute inset-3 rounded-full border border-indigo-400/25 animate-pulse" style={{ animationDuration: '1.2s' }} />
      )}

      {/* Biological movement styles: micro-breathing, head-nodding, realistic blink and talking mouth */}
      <style>{`
        /* Continuous human physiological micro-breathing */
        @keyframes cora-human-breath {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-2.2px) rotate(0.4deg); }
        }
        .cora-biological-body {
          animation: cora-human-breath 4.5s infinite ease-in-out;
          transform-origin: 120px 220px;
        }

        /* Natural, slight active head nod when speaking */
        @keyframes cora-human-speaking-nod {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-2px) rotate(-0.5deg); }
          75% { transform: translateY(0.8px) rotate(0.6deg); }
        }
        .cora-speaking-active {
          animation: cora-human-speaking-nod 0.38s infinite ease-in-out;
          transform-origin: 120px 165px;
        }

        /* Organic, random human blinking sequence with double-blink rhythm */
        @keyframes cora-human-blink {
          0%, 82%, 88%, 94%, 100% { transform: scaleY(1); }
          85%, 91% { transform: scaleY(0.05); }
        }
        .cora-living-eyelid {
          animation: cora-human-blink 5.8s infinite;
          transform-origin: 100px 93px;
        }
        .cora-living-eyelid-right {
          animation: cora-human-blink 5.8s infinite;
          transform-origin: 140px 93px;
        }

        /* Fluent phoneme lip synchronization for natural speech rendering */
        @keyframes cora-human-talk {
          0%, 100% { transform: scaleY(0.5) scaleX(1); }
          20% { transform: scaleY(1.3) scaleX(0.92); }
          40% { transform: scaleY(0.7) scaleX(1.1); }
          60% { transform: scaleY(1.4) scaleX(0.85); }
          85% { transform: scaleY(0.85) scaleX(1.05); }
        }
        .cora-talking-mouth {
          animation: cora-human-talk 0.16s infinite ease-in-out;
          transform-origin: 120px 131px;
        }

        /* Organic hair waving affected by physical ambient environment */
        @keyframes cora-hair-breeze {
          0%, 100% { transform: skewX(0deg) rotate(0deg); }
          50% { transform: skewX(1.2deg) rotate(0.4deg); }
        }
        .cora-hair-overlay {
          animation: cora-hair-breeze 7s infinite ease-in-out;
          transform-origin: 120px 40px;
        }
      `}</style>

      {/* Highly engineered vector graphics for Cora (~30 years old, Senior Financial Advisor look) */}
      <svg 
        viewBox="0 0 240 240" 
        className="w-full h-full object-cover"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Subcutaneous natural human skin gradient */}
          <linearGradient id="skinGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff2eb" />
            <stop offset="35%" stopColor="#ffdcc8" />
            <stop offset="80%" stopColor="#fca5a5" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0.9" />
          </linearGradient>

          {/* Shading/depth layer for face contours */}
          <linearGradient id="faceContours" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd9c4" stopOpacity="0" />
            <stop offset="85%" stopColor="#f3a290" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#e11d48" stopOpacity="0.25" />
          </linearGradient>

          {/* 3D Volumetric Chestnut/Auburn rich hair gradient */}
          <linearGradient id="hairVolumetric" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#451a03" />
            <stop offset="45%" stopColor="#290f02" />
            <stop offset="100%" stopColor="#1a0700" />
          </linearGradient>

          {/* Amber glossy hair highlight lines */}
          <linearGradient id="hairSilkHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#d97706" stopOpacity="0.75" />
            <stop offset="45%" stopColor="#78350f" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#290f02" stopOpacity="0" />
          </linearGradient>

          {/* Professional business blazer jacket (Midnight Indigo) */}
          <linearGradient id="blazerJacket" x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="50%" stopColor="#312e81" />
            <stop offset="100%" stopColor="#3730a3" />
          </linearGradient>

          {/* Deep realistic hazel iris iris iris hazel */}
          <radialGradient id="hazelIris" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#eab308" />
            <stop offset="55%" stopColor="#b45309" />
            <stop offset="85%" stopColor="#78350f" />
            <stop offset="100%" stopColor="#451a03" />
          </radialGradient>

          {/* Natural, hydrated rosy lips gradient */}
          <linearGradient id="roseLips" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fda4af" />
            <stop offset="30%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>

          {/* 3D glasses blue reflections */}
          <linearGradient id="glassReflections" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.15" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.25" />
          </linearGradient>

          {/* Filter drop shadows for anatomical layering */}
          <filter id="jawDropShadow" x="-12%" y="-12%" width="124%" height="124%">
            <feDropShadow dx="0" dy="4.5" stdDeviation="3" floodColor="#9f1239" floodOpacity="0.18" />
          </filter>

          <filter id="blazerDropShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="5.5" stdDeviation="3.5" floodColor="#000" floodOpacity="0.22" />
          </filter>
        </defs>

        {/* BACK HAIR BASE PLANE */}
        <path 
          d="M 52,110 C 38,45 202,45 188,110 C 192,142 192,174 178,190 C 166,204 152,192 152,192 L 88,192 C 88,192 74,204 62,190 C 48,174 48,142 52,110 Z" 
          fill="url(#hairVolumetric)" 
        />

        {/* ANATOMICAL POSTURE & FACIAL MOTIONS GROUP */}
        <g className={`cora-biological-body ${speaking ? 'cora-speaking-active' : ''}`}>
          
          {/* NECK WITH SUB-CLAVICULAR GRADIENTS */}
          <path 
            d="M 102,146 L 138,146 L 133,184 L 107,184 Z" 
            fill="#ffd2b8" 
          />
          {/* Neck dynamic shadows */}
          <path 
            d="M 102,146 C 114,158 126,158 138,146 L 134,166 L 106,166 Z" 
            fill="#fda4af" 
            opacity="0.45" 
          />
          <path 
            d="M 105,176 Q 120,183 135,176" 
            fill="none" 
            stroke="#fca5a5" 
            strokeWidth="2" 
            strokeLinecap="round" 
          />

          {/* EXECUTIVE APPAREL */}
          <g filter="url(#blazerDropShadow)">
            {/* Business Blazer / Tailored jacket */}
            <path 
              d="M 38,202 C 54,185 86,177 120,177 C 154,177 186,185 202,202 L 210,245 L 30,245 Z" 
              fill="url(#blazerJacket)" 
            />
            {/* Elegant Silk Emerald inner blouse */}
            <path 
              d="M 96,177 L 144,177 L 120,207 Z" 
              fill="#065f46" 
            />
            <path 
              d="M 103,177 L 137,177 L 120,200 Z" 
              fill="#10b981" 
            />
            {/* Elegant premium gold minimalist necklace */}
            <path 
              d="M 105,177 C 105,190 135,190 135,177" 
              fill="none" 
              stroke="#fbbf24" 
              strokeWidth="1.8" 
              opacity="0.75"
            />
            <circle cx="120" cy="188" r="3.2" fill="#fbbf24" />
          </g>

          {/* MAIN HUMAN JAW - Realistic bone contour with rosy flesh lighting */}
          <g filter="url(#jawDropShadow)">
            <path 
              d="M 74,96 C 71,146 96,167 120,167 C 144,167 169,146 166,96 C 165,75 144,65 120,65 C 96,65 75,75 74,96 Z" 
              fill="url(#skinGlow)" 
            />
            {/* Sophisticated facial structural shade overlay */}
            <path 
              d="M 74,96 C 71,146 96,167 120,167 C 144,167 169,146 166,96 C 165,75 144,65 120,65 C 96,65 75,75 74,96 Z" 
              fill="url(#faceContours)" 
            />
          </g>

          {/* ROSY DERMIC WARMTH (Real blood circulation blush) */}
          <circle cx="88" cy="122" r="16" fill="#f43f5e" opacity="0.11" />
          <circle cx="152" cy="122" r="16" fill="#f43f5e" opacity="0.11" />

          {/* Forehead, cheek, and chin highlight glimmers for 3D human anatomical realism */}
          <ellipse cx="120" cy="74" rx="22" ry="6" fill="#ffffff" opacity="0.12" />
          <ellipse cx="88" cy="116" rx="8" ry="4" fill="#ffffff" opacity="0.15" />
          <ellipse cx="152" cy="116" rx="8" ry="4" fill="#ffffff" opacity="0.15" />
          <ellipse cx="120" cy="161" rx="10" ry="3.5" fill="#ffffff" opacity="0.12" />

          {/* Elegant Eye shadows for organic human depth */}
          <path d="M 85,91 Q 98,78 111,91" fill="none" stroke="#be123c" strokeWidth="4.5" opacity="0.07" strokeLinecap="round" />
          <path d="M 129,91 Q 142,78 155,91" fill="none" stroke="#be123c" strokeWidth="4.5" opacity="0.07" strokeLinecap="round" />

          {/* LEFT EYE (white backdrop, realistic Hazel iris following coordinates) */}
          <g>
            <path d="M 87,94 Q 98,86 109,94 Q 98,102 87,94 Z" fill="#ffffff" />
            
            {/* Eye blinking mechanism */}
            <g className="cora-living-eyelid">
              {/* Pupil, light spots and hazel iris tracking */}
              <g style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)` }}>
                {/* Iris */}
                <circle cx="98" cy="94" r="6.8" fill="url(#hazelIris)" />
                {/* Real crystalline pupil */}
                <circle cx="98" cy="94" r="3.5" fill="#0f0702" />
                {/* Multiple point specular light reflections */}
                <circle cx="96" cy="91.5" r="1.8" fill="#ffffff" />
                <circle cx="100.2" cy="96.2" r="0.9" fill="#ffffff" opacity="0.75" />
              </g>
            </g>
            {/* Eyelining eyelashes contour */}
            <path d="M 85.5,93.5 Q 98,83.5 110.5,93.5" fill="none" stroke="#1c1917" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M 84,93 Q 86,90 89,91" fill="none" stroke="#1c1917" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 107,91 Q 110,89 112,92" fill="none" stroke="#1c1917" strokeWidth="1.2" strokeLinecap="round" />
          </g>

          {/* RIGHT EYE */}
          <g>
            <path d="M 131,94 Q 142,86 153,94 Q 142,102 131,94 Z" fill="#ffffff" />
            
            {/* Eye blinking mechanism */}
            <g className="cora-living-eyelid-right">
              {/* Pupil and hazel iris tracking */}
              <g style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)` }}>
                {/* Iris */}
                <circle cx="142" cy="94" r="6.8" fill="url(#hazelIris)" />
                {/* Crystalline pupil */}
                <circle cx="142" cy="94" r="3.5" fill="#0f0702" />
                {/* Point specular light reflections */}
                <circle cx="140" cy="91.5" r="1.8" fill="#ffffff" />
                <circle cx="144.2" cy="96.2" r="0.9" fill="#ffffff" opacity="0.75" />
              </g>
            </g>
            {/* Eyelining eyelashes contour */}
            <path d="M 129.5,93.5 Q 142,84.5 154.5,93.5" fill="none" stroke="#1c1917" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M 128,93 Q 130,90 133,91" fill="none" stroke="#1c1917" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 151,91 Q 154,89 156,92" fill="none" stroke="#1c1917" strokeWidth="1.2" strokeLinecap="round" />
          </g>

          {/* NATURAL DEFINED CHARACTER ARCHED EYEBROWS */}
          <path d="M 83,83 Q 97,71 111,82" fill="none" stroke="#381a07" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 129,82 Q 143,71 157,83" fill="none" stroke="#381a07" strokeWidth="2.5" strokeLinecap="round" />

          {/* NOSE WITH DETAILED THREE-DIMENSIONAL SHADING */}
          <g>
            {/* Soft shade of parallel bone line */}
            <path d="M 115,95 Q 119,116 119,118" fill="none" stroke="#e11d48" strokeWidth="1.2" opacity="0.12" />
            <path d="M 114,118 Q 120,123 126,118" fill="none" stroke="#b91c1c" strokeWidth="1.8" opacity="0.25" strokeLinecap="round" />
            <circle cx="120" cy="116" r="1.5" fill="#ffffff" opacity="0.5" />
          </g>

          {/* REALISTIC HYDRATED MOUTH & LIPS */}
          <g>
            {speaking ? (
              /* Highly detailed speaking morph sequence */
              <g className="cora-talking-mouth">
                {/* Organic lips outline */}
                <ellipse cx="120" cy="133" rx="15" ry="10.5" fill="url(#roseLips)" />
                {/* Oral cavity interior depth shadowing */}
                <ellipse cx="120" cy="133" rx="12.5" ry="8.2" fill="#3e020d" />
                {/* Realistic White glossy teeth outline */}
                <path d="M 108.5,129.5 Q 120,131.5 131.5,129.5" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                {/* Tongue layer highlight */}
                <ellipse cx="120" cy="138" rx="8" ry="4" fill="#fb7185" />
              </g>
            ) : isListening ? (
              /* Serene smiling gesture focused on active listening */
              <g>
                <path d="M 104,129.5 Q 120,143 136,129.5" fill="none" stroke="#be123c" strokeWidth="3.6" strokeLinecap="round" />
                <path d="M 105.5,130 Q 120,138 134.5,130" fill="none" stroke="#ffffff" strokeWidth="1.8" />
                {/* Smile dimples */}
                <path d="M 104,130 Q 101.5,127.5 102,130.5" fill="none" stroke="#9f1239" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M 136,130 Q 138.5,127.5 138,130.5" fill="none" stroke="#9f1239" strokeWidth="1.8" strokeLinecap="round" />
              </g>
            ) : (
              /* Serene sweet corporate portrait rest smile */
              <g>
                <path d="M 105,131.5 Q 120,141.5 135,131.5" fill="none" stroke="url(#roseLips)" strokeWidth="3.2" strokeLinecap="round" />
                <path d="M 105,131.5 Q 103,129.5 103.5,131.8" fill="none" stroke="#9f1239" strokeWidth="1.5" />
                <path d="M 135,131.5 Q 137,129.5 136.5,131.8" fill="none" stroke="#9f1239" strokeWidth="1.5" />
              </g>
            )}
          </g>

          {/* VOLUMETRIC GLOSSY CHESTNUT HAIR LAYER OVER FACE WITH SILK HIGHLIGHTS */}
          <g className="cora-hair-overlay">
            {/* Elegant classic bob hairstyle with volume */}
            <path 
              d="M 120,56 C 82,56 70,76 70,101 C 70,128 80,140 77,148 C 85,143 88,129 88,109 C 88,109 98,79 120,79 C 142,79 152,109 152,109 C 152,129 155,143 163,148 C 160,140 170,128 170,101 C 170,76 158,56 120,56 Z" 
              fill="url(#hairVolumetric)" 
            />
            {/* Glossy silk volumetric highlights */}
            <path 
              d="M 83,73 Q 115,57 147,73" 
              fill="none" 
              stroke="url(#hairSilkHighlight)" 
              strokeWidth="4.5" 
              strokeLinecap="round" 
              opacity="0.8" 
            />
            {/* Individual textured hair strands overlay */}
            <path d="M 116,56 C 104,57 91,66 90,75" fill="none" stroke="#ea580c" strokeWidth="1.2" opacity="0.3" />
            <path d="M 124,56 C 136,57 149,66 150,75" fill="none" stroke="#ea580c" strokeWidth="1.2" opacity="0.3" />
            <path d="M 75,90 C 72,110 74,130 82,143" fill="none" stroke="#854d0e" strokeWidth="1" opacity="0.3" />
            <path d="M 165,90 C 168,110 166,130 158,143" fill="none" stroke="#854d0e" strokeWidth="1" opacity="0.3" />
          </g>

          {/* ADVISOR DECORATIONS (Droplet gold earrings) */}
          <g opacity="0.95">
            {/* Pearl droplet left */}
            <circle cx="70" cy="119" r="2.8" fill="#fbbf24" />
            <circle cx="69" cy="118.2" r="0.8" fill="#ffffff" />
            {/* Pearl droplet right */}
            <circle cx="170" cy="119" r="2.8" fill="#fbbf24" />
            <circle cx="169" cy="118.2" r="0.8" fill="#ffffff" />
          </g>

        </g>

        {/* VOICE CALIBRATION FLARES */}
        {isListening && (
          <g className="cora-listening-indicator" style={{ transformOrigin: '120px 120px' }}>
            <circle cx="34" cy="74" r="3" fill="#2dd4bf" />
            <circle cx="206" cy="74" r="3" fill="#2dd4bf" />
            <polygon points="120,34 124,40 120,46 116,40" fill="#2dd4bf" opacity="0.75" />
          </g>
        )}
      </svg>
      
    </div>
  );
}
